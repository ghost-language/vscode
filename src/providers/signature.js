// @ts-check
'use strict';

const vscode = require('vscode');
const api = require('../api');
const analyzer = require('../analyzer');

/** @typedef {import('../api').Api} Api */

/**
 * Signature help — the parameter hints shown while typing a call.
 *
 * Ghost's own functions take their parameters positionally with no types, so
 * what actually helps is the shape: which argument comes next, and which of the
 * trailing ones are optional. Lumen's drawing calls in particular have long
 * optional tails (`draw(x, y, [rotation, sx, sy, ox, oy])`) that are hard to
 * remember and easy to get out of order.
 */
class GhostSignatureHelpProvider {
	/**
	 * @param {(document?: vscode.TextDocument) => Api} getApi
	 */
	constructor(getApi) {
		this.getApi = getApi;
	}

	/**
	 * @param {vscode.TextDocument} document
	 * @param {vscode.Position} position
	 * @returns {vscode.SignatureHelp | undefined}
	 */
	provideSignatureHelp(document, position) {
		const model = this.getApi(document);
		const line = analyzer.strip(document.lineAt(position.line).text).slice(0, position.character);
		const call = openCall(line);

		if (!call) {
			return undefined;
		}

		const entry = this.resolve(model, document, line.slice(0, call.nameStart + call.name.length), call.name, call.nameStart);

		if (!entry) {
			return undefined;
		}

		const help = new vscode.SignatureHelp();
		const information = new vscode.SignatureInformation(entry.signature);

		information.parameters = parametersOf(entry.signature).map(
			(parameter) => new vscode.ParameterInformation(parameter)
		);

		if (entry.doc) {
			information.documentation = new vscode.MarkdownString(entry.doc);
		}

		help.signatures = [information];
		help.activeSignature = 0;
		help.activeParameter = Math.min(call.argumentIndex, Math.max(information.parameters.length - 1, 0));

		return help;
	}

	/**
	 * @param {Api} model
	 * @param {vscode.TextDocument} document
	 * @param {string} upToName
	 * @param {string} name
	 * @param {number} nameStart
	 * @returns {{ signature: string, doc?: string } | undefined}
	 */
	resolve(model, document, upToName, name, nameStart) {
		const before = upToName.slice(0, nameStart);
		const text = document.getText();

		if (/\.\s*$/.test(before)) {
			const chain = analyzer.receiverChain(before, before.lastIndexOf('.'));

			if (chain) {
				const known = analyzer.inferTypes(model, text);
				const imports = analyzer.resolveImports(model, text);
				const resolved = analyzer.resolveChain(model, chain, known, imports);

				if (resolved && resolved.kind === 'module') {
					const found = api.findModuleMember(model, resolved.name, name);

					if (found && found.member.signature) {
						return { signature: found.member.signature, doc: found.member.doc };
					}
				}

				if (resolved && resolved.kind === 'type') {
					const found = api.findTypeMethod(model, resolved.name, name);

					if (found && found.member.signature) {
						return { signature: resolved.name + '.' + found.member.signature, doc: found.member.doc };
					}
				}
			}

			const candidates = api.findMethodEverywhere(model, name);

			if (candidates.length === 1 && candidates[0].member.signature) {
				return {
					signature: candidates[0].type.name + '.' + candidates[0].member.signature,
					doc: candidates[0].member.doc
				};
			}

			return undefined;
		}

		const fn = api.findFunction(model, name);

		if (fn) {
			return { signature: fn.signature, doc: fn.doc };
		}

		// A bare call can also be a name pulled in with `import { sqrt } from
		// "ghost:math"` — reachable, and callable, without the module prefix.
		const binding = analyzer.resolveImports(model, text).get(name);

		if (binding && binding.kind === 'member') {
			const owner = model.moduleByName.get(binding.module);
			const member = owner && owner.members.find((candidate) => candidate.name === binding.member);

			if (member && member.signature) {
				return { signature: member.signature, doc: member.doc };
			}
		}

		if (binding && binding.kind === 'class') {
			const type = model.typeByName.get(/** @type {string} */ (binding.type));

			if (type) {
				return { signature: 'new ' + type.name + '(...)', doc: type.doc };
			}
		}

		return undefined;
	}
}

/**
 * Finds the call the cursor is inside: the name before the innermost unclosed
 * `(`, and how many arguments have been typed so far.
 *
 * @param {string} line  the line up to the cursor, with strings blanked
 * @returns {{ name: string, nameStart: number, argumentIndex: number } | undefined}
 */
function openCall(line) {
	let depth = 0;
	let commas = 0;

	for (let index = line.length - 1; index >= 0; index--) {
		const character = line[index];

		if (character === ')' || character === ']') {
			depth++;
		} else if (character === '[') {
			depth--;
		} else if (character === '(') {
			if (depth === 0) {
				let end = index;

				while (end > 0 && /\s/.test(line[end - 1])) {
					end--;
				}

				let start = end;

				while (start > 0 && /[A-Za-z0-9_]/.test(line[start - 1])) {
					start--;
				}

				const name = line.slice(start, end);

				return name ? { name, nameStart: start, argumentIndex: commas } : undefined;
			}

			depth--;
		} else if (character === ',' && depth === 0) {
			commas++;
		}
	}

	return undefined;
}

/**
 * Splits a signature's parameter list, keeping optional groups written as
 * `[a, b, c]` as one entry per name so each still highlights in turn.
 *
 * @param {string} signature
 * @returns {string[]}
 */
function parametersOf(signature) {
	const match = /\(([\s\S]*)\)\s*$/.exec(signature);

	if (!match || !match[1].trim()) {
		return [];
	}

	/** @type {string[]} */
	const parameters = [];
	let current = '';
	let depth = 0;

	for (const character of match[1]) {
		if (character === '[') {
			depth++;
			continue;
		}

		if (character === ']') {
			depth--;
			continue;
		}

		if (character === ',') {
			parameters.push(current.trim());
			current = '';
			continue;
		}

		current += character;
	}

	if (current.trim()) {
		parameters.push(current.trim());
	}

	return parameters.filter(Boolean);
}

module.exports = { GhostSignatureHelpProvider, openCall, parametersOf };

// @ts-check
'use strict';

const vscode = require('vscode');
const api = require('../api');
const analyzer = require('../analyzer');

/** @typedef {import('../api').Api} Api */

const LEGEND = new vscode.SemanticTokensLegend(
	['namespace', 'function', 'method', 'property', 'event'],
	['defaultLibrary', 'declaration']
);

/**
 * Semantic highlighting for the standard library.
 *
 * The TextMate grammar deliberately stops at syntax. Deciding whether `image`
 * is Lumen's module or a variable someone named `image` is not a question a
 * regular expression can answer, so it is answered here, where the whole
 * document is in hand:
 *
 *   - A name the document assigns to is that assignment, not a module. Writing
 *     `image = 3` shadows the module, and the highlighting follows.
 *   - Whether Lumen's surface exists at all follows `ghost.lumen.enable`, which
 *     a grammar cannot be switched off by.
 *   - Members are resolved against the module they are actually reached
 *     through, so `canvas.print` is highlighted and `canvas.pritn` is not.
 */
class GhostSemanticTokensProvider {
	/**
	 * @param {(document?: vscode.TextDocument) => Api} getApi
	 */
	constructor(getApi) {
		this.getApi = getApi;
	}

	/**
	 * @param {vscode.TextDocument} document
	 * @returns {vscode.SemanticTokens}
	 */
	provideDocumentSemanticTokens(document) {
		const model = this.getApi(document);
		const text = document.getText();
		const stripped = analyzer.strip(text);
		const builder = new vscode.SemanticTokensBuilder(LEGEND);
		const shadowed = shadowedNames(text);

		/** @type {(offset: number, length: number, type: string, modifiers: string[]) => void} */
		const push = (offset, length, type, modifiers) => {
			const start = document.positionAt(offset);

			// A token cannot span lines; every one of these is a single name, so
			// this only guards against a pathological document.
			if (document.positionAt(offset + length).line !== start.line) {
				return;
			}

			builder.push(start.line, start.character, length, LEGEND.tokenTypes.indexOf(type), encode(modifiers));
		};

		// Module accesses: `module.member`.
		const access = /\b([A-Za-z_]\w*)\s*\.\s*([A-Za-z_]\w*)/g;
		let match;

		while ((match = access.exec(stripped)) !== null) {
			const [, moduleName, memberName] = match;

			if (shadowed.has(moduleName) || !model.moduleByName.has(moduleName)) {
				continue;
			}

			// Skip a member access that is itself reached through something else
			// (`game.image.load`), where the leading name is not the module.
			const preceding = stripped.slice(Math.max(0, match.index - 2), match.index);

			if (/\.\s*$/.test(preceding)) {
				continue;
			}

			push(match.index, moduleName.length, 'namespace', ['defaultLibrary']);

			const found = api.findModuleMember(model, moduleName, memberName);

			if (found) {
				const memberOffset = match.index + match[0].lastIndexOf(memberName);

				push(
					memberOffset,
					memberName.length,
					found.member.kind === 'property' ? 'property' : 'method',
					['defaultLibrary']
				);
			}
		}

		// Global functions, only where called and not shadowed.
		const globals = /\b([A-Za-z_]\w*)\s*\(/g;

		while ((match = globals.exec(stripped)) !== null) {
			const name = match[1];

			if (shadowed.has(name) || !api.findFunction(model, name)) {
				continue;
			}

			if (/[.\w]\s*$/.test(stripped.slice(Math.max(0, match.index - 2), match.index))) {
				continue;
			}

			push(match.index, name.length, 'function', ['defaultLibrary']);
		}

		// Lumen's engine callbacks, where they are declared. The engine finds
		// these by name, so marking them makes a misspelt one visible — it would
		// otherwise simply never be called, with nothing to report.
		const declarations = /\bfunction\s+([A-Za-z_]\w*)\s*\(/g;

		while ((match = declarations.exec(stripped)) !== null) {
			const name = match[1];

			if (!api.findCallback(model, name)) {
				continue;
			}

			push(match.index + match[0].indexOf(name), name.length, 'event', ['defaultLibrary', 'declaration']);
		}

		return builder.build();
	}
}

/**
 * Names the document binds itself. A module name is only a module until
 * something in the file assigns to it.
 *
 * @param {string} text
 * @returns {Set<string>}
 */
function shadowedNames(text) {
	/** @type {Set<string>} */
	const names = new Set();

	/** @param {import('../analyzer').Symbol[]} nodes */
	const collect = (nodes) => {
		for (const node of nodes) {
			if (node.kind !== 'field') {
				names.add(node.name);
			}

			collect(node.children);
		}
	};

	collect(analyzer.parseSymbols(text));

	// Imported names bind too, and are not assignments.
	const imported = /\bimport\s+([^\n]*?)\bfrom\b/g;
	let match;

	while ((match = imported.exec(analyzer.strip(text))) !== null) {
		for (const name of match[1].split(',')) {
			const cleaned = name.trim().split(/\s+as\s+/).pop();

			if (cleaned && /^[A-Za-z_]\w*$/.test(cleaned)) {
				names.add(cleaned);
			}
		}
	}

	return names;
}

/**
 * @param {string[]} modifiers
 * @returns {number}
 */
function encode(modifiers) {
	let bits = 0;

	for (const modifier of modifiers) {
		const index = LEGEND.tokenModifiers.indexOf(modifier);

		if (index !== -1) {
			bits |= 1 << index;
		}
	}

	return bits;
}

module.exports = { GhostSemanticTokensProvider, LEGEND, shadowedNames };

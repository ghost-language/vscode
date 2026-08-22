// @ts-check
'use strict';

const vscode = require('vscode');
const api = require('../api');
const analyzer = require('../analyzer');

/** @typedef {import('../api').Api} Api */
/** @typedef {import('../api/types').Member} Member */

/**
 * Completion for Ghost.
 *
 * After a `.` this offers what the receiver actually has, working the receiver
 * out from the API model and from assignments in the document. When the
 * receiver cannot be identified — which happens often in a dynamically typed
 * language — it falls back to every built-in method there is, each labelled
 * with the types that provide it, rather than offering nothing.
 */
class GhostCompletionProvider {
	/**
	 * @param {(document?: vscode.TextDocument) => Api} getApi
	 */
	constructor(getApi) {
		this.getApi = getApi;
	}

	/**
	 * @param {vscode.TextDocument} document
	 * @param {vscode.Position} position
	 * @returns {vscode.CompletionItem[]}
	 */
	provideCompletionItems(document, position) {
		const model = this.getApi(document);
		const line = document.lineAt(position.line).text.slice(0, position.character);
		const stripped = analyzer.strip(line);

		// A member access is in progress when the last thing before the cursor,
		// past any partly typed name, is a dot.
		const memberMatch = /\.([A-Za-z0-9_]*)$/.exec(stripped);

		if (memberMatch) {
			const dotIndex = stripped.length - memberMatch[0].length;

			return this.memberCompletions(model, document, position, stripped, dotIndex);
		}

		return this.globalCompletions(model, document, position);
	}

	/**
	 * @param {Api} model
	 * @param {vscode.TextDocument} document
	 * @param {vscode.Position} position
	 * @param {string} strippedLine
	 * @param {number} dotIndex
	 * @returns {vscode.CompletionItem[]}
	 */
	memberCompletions(model, document, position, strippedLine, dotIndex) {
		const text = document.getText();
		const chain = analyzer.receiverChain(strippedLine, dotIndex);

		// `this.` offers the enclosing class's own members, which the API model
		// knows nothing about — they come from the document.
		if (chain && chain.length === 1 && chain[0] === 'this') {
			return this.selfCompletions(text, document.offsetAt(position));
		}

		if (chain) {
			const known = analyzer.inferTypes(model, text);
			const resolved = analyzer.resolveChain(model, chain, known);

			if (resolved && resolved.kind === 'module') {
				const module = model.moduleByName.get(resolved.name);

				if (module) {
					return module.members.map((member) => this.memberItem(member, module.name, module.source));
				}
			}

			if (resolved && resolved.kind === 'type') {
				const type = model.typeByName.get(resolved.name);

				if (type) {
					return type.methods.map((method) => this.memberItem(method, type.name, type.source));
				}
			}
		}

		return this.unknownReceiverCompletions(model);
	}

	/**
	 * Everything a built-in value could offer, when we cannot tell what the
	 * receiver is. Each entry names the types that have it, so the list stays
	 * informative rather than becoming noise.
	 *
	 * @param {Api} model
	 * @returns {vscode.CompletionItem[]}
	 */
	unknownReceiverCompletions(model) {
		return api.allMethods(model).map(({ name, members }) => {
			const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Method);
			const owners = members.map((entry) => entry.type.name);

			item.detail = owners.join(', ');
			item.documentation = new vscode.MarkdownString(
				members
					.map((entry) => '**' + entry.type.name + '.' + (entry.member.signature || name) + '**\n\n' + (entry.member.doc || ''))
					.join('\n\n---\n\n')
			);
			item.insertText = new vscode.SnippetString(name + (endsWithNoArguments(members[0].member) ? '()' : '($0)'));
			// Sorted after anything a resolved receiver would have offered.
			item.sortText = 'z' + name;

			return item;
		});
	}

	/**
	 * The methods and fields of the class or trait the cursor is inside.
	 *
	 * @param {string} text
	 * @param {number} offset
	 * @returns {vscode.CompletionItem[]}
	 */
	selfCompletions(text, offset) {
		const symbols = analyzer.parseSymbols(text);
		const enclosing = analyzer.enclosingType(symbols, offset);

		if (!enclosing) {
			return [];
		}

		/** @type {vscode.CompletionItem[]} */
		const items = [];
		/** @type {Set<string>} */
		const seen = new Set();

		/** @param {import('../analyzer').Symbol[]} nodes */
		const collect = (nodes) => {
			for (const node of nodes) {
				if (node.kind === 'method' || node.kind === 'function') {
					if (!seen.has(node.name)) {
						seen.add(node.name);

						const item = new vscode.CompletionItem(node.name, vscode.CompletionItemKind.Method);
						item.detail = enclosing.name;
						item.insertText = new vscode.SnippetString(node.name + '($0)');
						items.push(item);
					}
				} else if (node.kind === 'field') {
					if (!seen.has(node.name)) {
						seen.add(node.name);

						const item = new vscode.CompletionItem(node.name, vscode.CompletionItemKind.Field);
						item.detail = enclosing.name;
						items.push(item);
					}
				}

				collect(node.children);
			}
		};

		collect(enclosing.children);

		return items;
	}

	/**
	 * @param {Member} member
	 * @param {string} owner
	 * @param {import('../api/types').Source} ownerSource
	 * @returns {vscode.CompletionItem}
	 */
	memberItem(member, owner, ownerSource) {
		const kind = member.kind === 'property'
			? vscode.CompletionItemKind.Property
			: vscode.CompletionItemKind.Method;
		const item = new vscode.CompletionItem(member.name, kind);
		const source = member.source || ownerSource;

		item.detail = member.signature || owner + '.' + member.name;
		item.documentation = documentationFor(member, source);

		if (member.kind === 'method') {
			item.insertText = new vscode.SnippetString(member.name + (endsWithNoArguments(member) ? '()' : '($0)'));
		}

		return item;
	}

	/**
	 * @param {Api} model
	 * @param {vscode.TextDocument} document
	 * @param {vscode.Position} position
	 * @returns {vscode.CompletionItem[]}
	 */
	globalCompletions(model, document, position) {
		/** @type {vscode.CompletionItem[]} */
		const items = [];

		for (const keyword of model.keywords) {
			const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
			item.sortText = '4' + keyword;
			items.push(item);
		}

		for (const module of model.modules) {
			const item = new vscode.CompletionItem(module.name, vscode.CompletionItemKind.Module);
			item.detail = module.source === 'lumen' ? 'Lumen module' : 'Ghost module';
			item.documentation = new vscode.MarkdownString(module.doc);
			item.sortText = '1' + module.name;
			items.push(item);
		}

		for (const fn of model.functions) {
			const item = new vscode.CompletionItem(fn.name, vscode.CompletionItemKind.Function);
			item.detail = fn.signature;
			item.documentation = documentationFor(fn, fn.source);
			item.insertText = new vscode.SnippetString(fn.name + '($0)');
			item.sortText = '1' + fn.name;
			items.push(item);
		}

		items.push(...this.documentCompletions(document, position));
		items.push(...this.callbackCompletions(model, document, position));

		return items;
	}

	/**
	 * Names the document itself introduces.
	 *
	 * @param {vscode.TextDocument} document
	 * @param {vscode.Position} position
	 * @returns {vscode.CompletionItem[]}
	 */
	documentCompletions(document, position) {
		const symbols = analyzer.parseSymbols(document.getText());
		/** @type {vscode.CompletionItem[]} */
		const items = [];
		/** @type {Set<string>} */
		const seen = new Set();
		const word = document.getWordRangeAtPosition(position);
		const typing = word ? document.getText(word) : '';

		/** @param {import('../analyzer').Symbol[]} nodes */
		const collect = (nodes) => {
			for (const node of nodes) {
				// Don't offer the name currently being typed back to itself.
				if (!seen.has(node.name) && node.name !== typing) {
					seen.add(node.name);

					const kind = node.kind === 'class'
						? vscode.CompletionItemKind.Class
						: node.kind === 'trait'
							? vscode.CompletionItemKind.Interface
							: node.kind === 'function' || node.kind === 'method'
								? vscode.CompletionItemKind.Function
								: vscode.CompletionItemKind.Variable;

					const item = new vscode.CompletionItem(node.name, kind);
					item.detail = node.detail ? node.kind + ' ' + node.detail : node.kind;
					item.sortText = '2' + node.name;

					if (node.kind === 'function' || node.kind === 'method') {
						item.insertText = new vscode.SnippetString(node.name + '($0)');
					}

					items.push(item);
				}

				collect(node.children);
			}
		};

		collect(symbols);

		return items;
	}

	/**
	 * Lumen's engine callbacks, offered as whole function bodies. These are
	 * worth completing as a unit because the engine finds them by name — a
	 * misspelt `updat` is simply never called, with nothing to report.
	 *
	 * @param {Api} model
	 * @param {vscode.TextDocument} document
	 * @param {vscode.Position} position
	 * @returns {vscode.CompletionItem[]}
	 */
	callbackCompletions(model, document, position) {
		if (model.callbacks.length === 0) {
			return [];
		}

		// Only at the start of a line: a callback is always a top-level
		// declaration, never part of an expression.
		if (!/^\s*[A-Za-z_]*$/.test(document.lineAt(position.line).text.slice(0, position.character))) {
			return [];
		}

		return model.callbacks.map((callback) => {
			const item = new vscode.CompletionItem(callback.name, vscode.CompletionItemKind.Event);
			const parameters = /\(([^)]*)\)/.exec(callback.signature);
			const body = callback.signature + ' {\n\t$0\n}';

			item.detail = callback.signature;
			item.documentation = documentationFor(callback, 'lumen');
			item.insertText = new vscode.SnippetString(body);
			item.filterText = callback.name;
			item.sortText = '0' + callback.name;
			item.label = {
				label: callback.name,
				description: 'Lumen callback' + (parameters && parameters[1] ? ' (' + parameters[1] + ')' : '')
			};

			return item;
		});
	}
}

/**
 * Whether a signature takes no arguments, so completion can close the
 * parentheses instead of leaving the cursor inside them.
 *
 * @param {Member | { signature?: string }} member
 * @returns {boolean}
 */
function endsWithNoArguments(member) {
	return Boolean(member.signature && /\(\s*\)\s*$/.test(member.signature));
}

/**
 * @param {{ signature?: string, doc?: string }} entry
 * @param {import('../api/types').Source} source
 * @returns {vscode.MarkdownString}
 */
function documentationFor(entry, source) {
	const markdown = new vscode.MarkdownString();

	if (entry.doc) {
		markdown.appendMarkdown(entry.doc);
	}

	markdown.appendMarkdown('\n\n_' + (source === 'lumen' ? 'Lumen' : 'Ghost') + '_');

	return markdown;
}

module.exports = { GhostCompletionProvider, documentationFor };

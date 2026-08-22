// @ts-check
'use strict';

const vscode = require('vscode');
const api = require('../api');
const analyzer = require('../analyzer');
const { documentationFor } = require('./completion');

/** @typedef {import('../api').Api} Api */

/**
 * Hover documentation.
 *
 * The word under the cursor is looked up the same way completion resolves a
 * receiver, so `sheet.newAnimation` documents the Spritesheet method even
 * though `sheet` is an ordinary untyped variable.
 */
class GhostHoverProvider {
	/**
	 * @param {(document?: vscode.TextDocument) => Api} getApi
	 */
	constructor(getApi) {
		this.getApi = getApi;
	}

	/**
	 * @param {vscode.TextDocument} document
	 * @param {vscode.Position} position
	 * @returns {vscode.Hover | undefined}
	 */
	provideHover(document, position) {
		const model = this.getApi(document);
		const range = document.getWordRangeAtPosition(position, /[A-Za-z_]\w*/);

		if (!range) {
			return undefined;
		}

		const word = document.getText(range);
		const line = document.lineAt(position.line).text;
		const stripped = analyzer.strip(line);

		// Inside a string or comment there is nothing to document.
		if (stripped.slice(range.start.character, range.end.character).trim() !== word) {
			return undefined;
		}

		const before = stripped.slice(0, range.start.character);
		const isMember = /\.\s*$/.test(before);

		if (isMember) {
			return this.memberHover(model, document, range, word, stripped, before.lastIndexOf('.'));
		}

		return this.plainHover(model, document, range, word, position);
	}

	/**
	 * @param {Api} model
	 * @param {vscode.TextDocument} document
	 * @param {vscode.Range} range
	 * @param {string} word
	 * @param {string} strippedLine
	 * @param {number} dotIndex
	 * @returns {vscode.Hover | undefined}
	 */
	memberHover(model, document, range, word, strippedLine, dotIndex) {
		const chain = analyzer.receiverChain(strippedLine, dotIndex);

		if (chain) {
			const known = analyzer.inferTypes(model, document.getText());
			const resolved = analyzer.resolveChain(model, chain, known);

			if (resolved && resolved.kind === 'module') {
				const found = api.findModuleMember(model, resolved.name, word);

				if (found) {
					return this.render(range, found.member.signature || resolved.name + '.' + word, found.member, found.member.source || found.module.source);
				}
			}

			if (resolved && resolved.kind === 'type') {
				const found = api.findTypeMethod(model, resolved.name, word);

				if (found) {
					return this.render(range, resolved.name + '.' + (found.member.signature || word), found.member, found.type.source);
				}
			}
		}

		// The receiver could not be identified. If exactly one built-in type has
		// a method by this name, that is almost certainly the one meant; if
		// several do, say so rather than guessing.
		const candidates = api.findMethodEverywhere(model, word);

		if (candidates.length === 1) {
			const [only] = candidates;

			return this.render(range, only.type.name + '.' + (only.member.signature || word), only.member, only.type.source);
		}

		if (candidates.length > 1) {
			const markdown = new vscode.MarkdownString();

			markdown.appendMarkdown('`' + word + '` is a method on ' + candidates.map((entry) => '`' + entry.type.name + '`').join(', ') + '.\n\n');

			for (const entry of candidates) {
				markdown.appendCodeblock(entry.type.name + '.' + (entry.member.signature || word), 'ghost');
				markdown.appendMarkdown((entry.member.doc || '') + '\n\n');
			}

			return new vscode.Hover(markdown, range);
		}

		return undefined;
	}

	/**
	 * @param {Api} model
	 * @param {vscode.TextDocument} document
	 * @param {vscode.Range} range
	 * @param {string} word
	 * @param {vscode.Position} position
	 * @returns {vscode.Hover | undefined}
	 */
	plainHover(model, document, range, word, position) {
		const module = model.moduleByName.get(word);

		if (module) {
			const markdown = new vscode.MarkdownString();

			markdown.appendCodeblock(word, 'ghost');
			markdown.appendMarkdown(module.doc + '\n\n_' + (module.source === 'lumen' ? 'Lumen' : 'Ghost') + ' module_');

			return new vscode.Hover(markdown, range);
		}

		const fn = api.findFunction(model, word);

		if (fn) {
			return this.render(range, fn.signature, fn, fn.source);
		}

		// A callback only means anything where it is being declared.
		const callback = api.findCallback(model, word);

		if (callback && /\bfunction\s+$/.test(analyzer.strip(document.lineAt(position.line).text).slice(0, range.start.character))) {
			return this.render(range, callback.signature, callback, callback.source);
		}

		const variableType = analyzer.inferTypes(model, document.getText()).get(word);

		if (variableType) {
			const type = model.typeByName.get(variableType);
			const markdown = new vscode.MarkdownString();

			markdown.appendCodeblock(word + ': ' + variableType, 'ghost');

			if (type) {
				markdown.appendMarkdown(type.doc);
			}

			return new vscode.Hover(markdown, range);
		}

		return undefined;
	}

	/**
	 * @param {vscode.Range} range
	 * @param {string} signature
	 * @param {{ doc?: string }} entry
	 * @param {import('../api/types').Source} source
	 * @returns {vscode.Hover}
	 */
	render(range, signature, entry, source) {
		const markdown = new vscode.MarkdownString();

		markdown.appendCodeblock(signature, 'ghost');
		markdown.appendMarkdown(documentationFor(entry, source).value);

		return new vscode.Hover(markdown, range);
	}
}

module.exports = { GhostHoverProvider };

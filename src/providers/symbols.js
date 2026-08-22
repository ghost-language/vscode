// @ts-check
'use strict';

const vscode = require('vscode');
const analyzer = require('../analyzer');

/**
 * The outline, breadcrumbs, and "go to symbol in file".
 */
class GhostDocumentSymbolProvider {
	/**
	 * @param {vscode.TextDocument} document
	 * @returns {vscode.DocumentSymbol[]}
	 */
	provideDocumentSymbols(document) {
		const text = document.getText();

		return convert(analyzer.parseSymbols(text), document);
	}
}

/** @type {Record<import('../analyzer').Symbol['kind'], vscode.SymbolKind>} */
const KINDS = {
	class: vscode.SymbolKind.Class,
	trait: vscode.SymbolKind.Interface,
	function: vscode.SymbolKind.Function,
	method: vscode.SymbolKind.Method,
	field: vscode.SymbolKind.Field,
	variable: vscode.SymbolKind.Variable
};

/**
 * @param {import('../analyzer').Symbol[]} nodes
 * @param {vscode.TextDocument} document
 * @returns {vscode.DocumentSymbol[]}
 */
function convert(nodes, document) {
	return nodes.map((node) => {
		const range = new vscode.Range(document.positionAt(node.start), document.positionAt(node.end));
		const selection = new vscode.Range(
			document.positionAt(node.selectionStart),
			document.positionAt(node.selectionEnd)
		);

		const symbol = new vscode.DocumentSymbol(
			node.name,
			node.detail || '',
			KINDS[node.kind],
			range,
			// VS Code requires the selection range to sit inside the full range;
			// a half-typed declaration can otherwise produce one that does not.
			range.contains(selection) ? selection : range
		);

		symbol.children = convert(node.children, document);

		return symbol;
	});
}

module.exports = { GhostDocumentSymbolProvider };

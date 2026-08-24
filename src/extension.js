// @ts-check
'use strict';

const vscode = require('vscode');
const api = require('./api');
const { GhostCompletionProvider } = require('./providers/completion');
const { GhostHoverProvider } = require('./providers/hover');
const { GhostSignatureHelpProvider } = require('./providers/signature');
const { GhostDocumentSymbolProvider } = require('./providers/symbols');
const { GhostSemanticTokensProvider, LEGEND } = require('./providers/semanticTokens');

const SELECTOR = { language: 'ghost', scheme: '*' };

/** Fires when the API surface changes, so semantic highlighting is redrawn. */
const onDidChangeSemanticTokens = new vscode.EventEmitter();

/**
 * Whether the Lumen surface is in scope.
 *
 * Lumen is a game engine for Ghost rather than a language of its own — a Lumen
 * game is `.ghost` source — so its modules and callbacks are folded into the
 * Ghost surface rather than given a language of their own. A project that is
 * plain Ghost can turn them off, so that a variable named `window` or `image`
 * is not dressed up as something from an engine it does not use.
 *
 * @param {vscode.TextDocument} [document]
 * @returns {boolean}
 */
function lumenEnabled(document) {
	return vscode.workspace
		.getConfiguration('ghost', document ? document.uri : null)
		.get('lumen.enable', true);
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	// Resolved per call rather than captured, so changing the setting takes
	// effect without a reload, and against the document being edited, so a
	// workspace holding both a game and a plain Ghost project can set it per
	// folder.
	const getApi = (document) => api.build(lumenEnabled(document));

	const semanticTokens = new GhostSemanticTokensProvider(getApi);

	// @ts-ignore - the event is supplied here rather than declared on the class.
	semanticTokens.onDidChangeSemanticTokens = onDidChangeSemanticTokens.event;

	context.subscriptions.push(
		onDidChangeSemanticTokens,

		vscode.languages.registerCompletionItemProvider(
			SELECTOR,
			new GhostCompletionProvider(getApi),
			'.', '"', "'", '{', ':'
		),

		vscode.languages.registerHoverProvider(SELECTOR, new GhostHoverProvider(getApi)),

		vscode.languages.registerSignatureHelpProvider(
			SELECTOR,
			new GhostSignatureHelpProvider(getApi),
			'(',
			','
		),

		vscode.languages.registerDocumentSymbolProvider(
			SELECTOR,
			new GhostDocumentSymbolProvider(),
			{ label: 'Ghost' }
		),

		vscode.languages.registerDocumentSemanticTokensProvider(SELECTOR, semanticTokens, LEGEND),

		vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration('ghost.lumen.enable')) {
				onDidChangeSemanticTokens.fire();
			}
		})
	);
}

function deactivate() {
	// Nothing to tear down: every provider is registered through the context's
	// subscriptions and disposed with it.
}

module.exports = { activate, deactivate };

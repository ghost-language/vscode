// @ts-check
'use strict';

const api = require('./api');

/** @typedef {import('./api').Api} Api */

/**
 * Reading Ghost source well enough to be useful in an editor, without building
 * a parser.
 *
 * Everything here works on a "stripped" copy of the document in which comments
 * and the insides of strings have been replaced by spaces. Positions are
 * preserved exactly, so an offset into the stripped text is an offset into the
 * real one — which means the regexes below can be simple without ever matching
 * a keyword inside a string or a brace inside a comment.
 */

/** Words that share the shape of a method declaration but are not one. */
const RESERVED_BEFORE_PAREN = new Set([
	'if', 'else', 'for', 'while', 'switch', 'case', 'default', 'function',
	'class', 'trait', 'return', 'import', 'from', 'as', 'use', 'new', 'in',
	'and', 'or', 'break', 'continue', 'print', 'type'
]);

/**
 * Replaces comments and string bodies with spaces, keeping every other
 * character — and therefore every offset and line break — where it was.
 *
 * @param {string} text
 * @returns {string}
 */
function strip(text) {
	const out = text.split('');
	let index = 0;

	/** Blanks a run, leaving newlines alone so line numbers still line up. */
	const blank = (from, to) => {
		for (let i = from; i < to && i < out.length; i++) {
			if (out[i] !== '\n' && out[i] !== '\r') {
				out[i] = ' ';
			}
		}
	};

	while (index < text.length) {
		const character = text[index];
		const next = text[index + 1];

		if (character === '/' && next === '*') {
			const end = text.indexOf('*/', index + 2);
			const stop = end === -1 ? text.length : end + 2;

			blank(index, stop);
			index = stop;
			continue;
		}

		// Ghost takes both `//` and `#` to the end of the line.
		if ((character === '/' && next === '/') || character === '#') {
			let end = text.indexOf('\n', index);

			if (end === -1) {
				end = text.length;
			}

			blank(index, end);
			index = end;
			continue;
		}

		if (character === '"' || character === "'") {
			let cursor = index + 1;

			while (cursor < text.length) {
				if (text[cursor] === '\\') {
					cursor += 2;
					continue;
				}

				if (text[cursor] === character || text[cursor] === '\n') {
					break;
				}

				cursor++;
			}

			// Keep the quotes themselves so a caller can still tell a string was
			// here; blank only what is between them.
			blank(index + 1, Math.min(cursor, text.length));
			index = Math.min(cursor + 1, text.length);
			continue;
		}

		index++;
	}

	return out.join('');
}

/**
 * From the offset of an opening brace, the offset just past its match.
 * Returns the end of the text when the brace is never closed, which is the
 * common case while someone is still typing.
 *
 * @param {string} stripped
 * @param {number} open
 * @returns {number}
 */
function matchBrace(stripped, open) {
	let depth = 0;

	for (let index = open; index < stripped.length; index++) {
		if (stripped[index] === '{') {
			depth++;
		} else if (stripped[index] === '}') {
			depth--;

			if (depth === 0) {
				return index + 1;
			}
		}
	}

	return stripped.length;
}

/**
 * A declaration found in a document.
 *
 * @typedef {object} Symbol
 * @property {'class'|'trait'|'function'|'method'|'field'|'variable'} kind
 * @property {string} name
 * @property {string} [detail]      Extra text for the outline, such as `extends Animal`.
 * @property {number} start         Offset of the declaration keyword or name.
 * @property {number} end           Offset just past the declaration's body.
 * @property {number} selectionStart Offset of the name itself.
 * @property {number} selectionEnd
 * @property {Symbol[]} children
 */

/**
 * Finds the declarations in a document and nests them by containment.
 *
 * @param {string} text
 * @returns {Symbol[]}
 */
function parseSymbols(text) {
	const stripped = strip(text);
	/** @type {Symbol[]} */
	const flat = [];

	/** @type {(kind: Symbol['kind'], name: string, start: number, end: number, nameAt: number, detail?: string) => void} */
	const add = (kind, name, start, end, nameAt, detail) => {
		flat.push({
			kind,
			name,
			detail,
			start,
			end,
			selectionStart: nameAt,
			selectionEnd: nameAt + name.length,
			children: []
		});
	};

	/** The body of a declaration whose header ends at `after`. */
	const bodyEnd = (after) => {
		const open = stripped.indexOf('{', after);

		return open === -1 ? after : matchBrace(stripped, open);
	};

	// Classes, with an optional superclass.
	const classPattern = /\bclass\s+([A-Za-z_]\w*)(?:\s+extends\s+([A-Za-z_]\w*))?/g;
	let match;

	while ((match = classPattern.exec(stripped)) !== null) {
		add(
			'class',
			match[1],
			match.index,
			bodyEnd(match.index + match[0].length),
			match.index + match[0].indexOf(match[1]),
			match[2] ? 'extends ' + match[2] : undefined
		);
	}

	const traitPattern = /\btrait\s+([A-Za-z_]\w*)/g;

	while ((match = traitPattern.exec(stripped)) !== null) {
		add('trait', match[1], match.index, bodyEnd(match.index + match[0].length), match.index + match[0].indexOf(match[1]));
	}

	// `function name(...)`. Anonymous functions are skipped: they have no name
	// to show, and the value they are assigned to is picked up as a variable.
	const functionPattern = /\bfunction\s+([A-Za-z_]\w*)\s*\(/g;

	while ((match = functionPattern.exec(stripped)) !== null) {
		add('function', match[1], match.index, bodyEnd(match.index + match[0].length), match.index + match[0].indexOf(match[1]));
	}

	// Method shorthand inside a class or trait body: `name(a, b) {`.
	const methodPattern = /^[ \t]*([A-Za-z_]\w*)[ \t]*\([^()]*\)[ \t]*\{/gm;

	while ((match = methodPattern.exec(stripped)) !== null) {
		if (RESERVED_BEFORE_PAREN.has(match[1])) {
			continue;
		}

		const nameAt = match.index + match[0].indexOf(match[1]);

		add('method', match[1], nameAt, bodyEnd(match.index + match[0].length - 1), nameAt);
	}

	// `this.field = ...`, which is how instance state is introduced.
	const fieldPattern = /\bthis\.([A-Za-z_]\w*)[ \t]*=(?!=)/g;

	while ((match = fieldPattern.exec(stripped)) !== null) {
		const nameAt = match.index + match[0].indexOf(match[1]);

		add('field', match[1], match.index, match.index + match[0].length, nameAt);
	}

	// Plain assignments. Ghost has no declaration keyword, so an assignment at
	// the start of a line is what introduces a name.
	const variablePattern = /^[ \t]*([A-Za-z_]\w*)[ \t]*=(?!=)/gm;

	while ((match = variablePattern.exec(stripped)) !== null) {
		const nameAt = match.index + match[0].indexOf(match[1]);

		add('variable', match[1], nameAt, match.index + match[0].length, nameAt);
	}

	return nest(flat);
}

/**
 * Turns a flat list of ranges into a tree by containment. Ranges that start at
 * the same place are ordered widest first so a class wins over anything the
 * regexes also matched at its opening.
 *
 * @param {Symbol[]} flat
 * @returns {Symbol[]}
 */
function nest(flat) {
	flat.sort((a, b) => (a.start - b.start) || (b.end - a.end));

	/** @type {Symbol[]} */
	const roots = [];
	/** @type {Symbol[]} */
	const stack = [];

	for (const symbol of flat) {
		while (stack.length > 0 && symbol.start >= stack[stack.length - 1].end) {
			stack.pop();
		}

		const parent = stack[stack.length - 1];

		if (!parent) {
			roots.push(symbol);
		} else if (!(parent.kind === 'field' || parent.kind === 'variable')) {
			// A field or variable has no body, so nothing nests inside one; a
			// name that merely follows it stays a sibling.
			const duplicate = parent.children.some(
				(child) => child.name === symbol.name && child.kind === symbol.kind
			);

			if (!duplicate) {
				parent.children.push(symbol);
			}
		}

		stack.push(symbol);
	}

	return roots;
}

/**
 * The class or trait whose body contains an offset, if any.
 *
 * @param {Symbol[]} symbols
 * @param {number} offset
 * @returns {Symbol | undefined}
 */
function enclosingType(symbols, offset) {
	for (const symbol of symbols) {
		if (offset < symbol.start || offset >= symbol.end) {
			continue;
		}

		const deeper = enclosingType(symbol.children, offset);

		if (deeper) {
			return deeper;
		}

		if (symbol.kind === 'class' || symbol.kind === 'trait') {
			return symbol;
		}
	}

	return undefined;
}

/**
 * Works out which API type each variable in a document holds.
 *
 * Ghost is dynamically typed, so this is a best effort and deliberately a
 * conservative one: it only records a variable whose value comes from something
 * the API model describes. `sheet = image.newSpritesheet(...)` is recorded
 * because `newSpritesheet` declares what it returns; `x = 3 + y` is not
 * recorded at all, which is better than recording it wrongly.
 *
 * Assignments are resolved repeatedly until nothing new is learned, so a chain
 * like `sheet = image.newSpritesheet(...)` then `walk = sheet.newAnimation(...)`
 * resolves both.
 *
 * @param {Api} model
 * @param {string} text
 * @returns {Map<string, string>} variable name to API type name
 */
function inferTypes(model, text) {
	const stripped = strip(text);
	/** @type {Map<string, string>} */
	const types = new Map();

	/** @type {{ target: string, receiver: string, member: string }[]} */
	const pending = [];

	// `name = receiver.member(...)` or `name = receiver.member`
	const memberAssign = /\b([A-Za-z_]\w*)[ \t]*=[ \t]*([A-Za-z_]\w*)\.([A-Za-z_]\w*)/g;
	let match;

	while ((match = memberAssign.exec(stripped)) !== null) {
		pending.push({ target: match[1], receiver: match[2], member: match[3] });
	}

	// Literals, which need no resolving.
	const literalAssign = /\b([A-Za-z_]\w*)[ \t]*=[ \t]*(["']|\[|\d)/g;

	while ((match = literalAssign.exec(stripped)) !== null) {
		const token = match[2];
		const type = token === '"' || token === "'" ? 'String' : token === '[' ? 'List' : 'Number';

		if (!types.has(match[1])) {
			types.set(match[1], type);
		}
	}

	// Resolve to a fixed point. Each pass can only add, so this terminates; the
	// bound is a guard against a pathological document, not a real limit.
	for (let pass = 0; pass < 8; pass++) {
		let learned = false;

		for (const { target, receiver, member } of pending) {
			if (types.has(target)) {
				continue;
			}

			const returns = returnTypeOf(model, receiver, member, types);

			if (returns) {
				types.set(target, returns);
				learned = true;
			}
		}

		if (!learned) {
			break;
		}
	}

	return types;
}

/**
 * What `receiver.member` evaluates to, when the model says.
 *
 * @param {Api} model
 * @param {string} receiver
 * @param {string} member
 * @param {Map<string, string>} known
 * @returns {string | undefined}
 */
function returnTypeOf(model, receiver, member, known) {
	const onModule = api.findModuleMember(model, receiver, member);

	if (onModule) {
		return onModule.member.returns;
	}

	const receiverType = known.get(receiver);

	if (receiverType) {
		const onType = api.findTypeMethod(model, receiverType, member);

		if (onType) {
			return onType.member.returns;
		}
	}

	return undefined;
}

/**
 * Reads the expression immediately to the left of a `.`, walking back over
 * balanced call and index brackets so that `sheet.getQuad(frame).` resolves.
 *
 * @param {string} strippedLine  the line, with strings and comments blanked
 * @param {number} dotIndex      index of the dot within that line
 * @returns {string[] | undefined} the chain split into segments, left to right
 */
function receiverChain(strippedLine, dotIndex) {
	/** @type {string[]} */
	const segments = [];
	let index = dotIndex;

	while (index > 0) {
		let cursor = index - 1;

		// Skip a trailing call or index, matching brackets backwards.
		while (cursor >= 0 && /\s/.test(strippedLine[cursor])) {
			cursor--;
		}

		if (cursor >= 0 && (strippedLine[cursor] === ')' || strippedLine[cursor] === ']')) {
			const close = strippedLine[cursor];
			const open = close === ')' ? '(' : '[';
			let depth = 0;

			while (cursor >= 0) {
				if (strippedLine[cursor] === close) {
					depth++;
				} else if (strippedLine[cursor] === open) {
					depth--;

					if (depth === 0) {
						cursor--;
						break;
					}
				}

				cursor--;
			}

			if (depth !== 0) {
				return undefined;
			}
		}

		while (cursor >= 0 && /\s/.test(strippedLine[cursor])) {
			cursor--;
		}

		let end = cursor + 1;

		while (cursor >= 0 && /[A-Za-z0-9_]/.test(strippedLine[cursor])) {
			cursor--;
		}

		const name = strippedLine.slice(cursor + 1, end);

		if (!name) {
			return segments.length > 0 ? segments : undefined;
		}

		segments.unshift(name);

		while (cursor >= 0 && /\s/.test(strippedLine[cursor])) {
			cursor--;
		}

		if (cursor < 0 || strippedLine[cursor] !== '.') {
			break;
		}

		index = cursor;
	}

	return segments.length > 0 ? segments : undefined;
}

/**
 * Resolves what a receiver chain refers to.
 *
 * @param {Api} model
 * @param {string[]} chain
 * @param {Map<string, string>} known
 * @returns {{ kind: 'module', name: string } | { kind: 'type', name: string } | undefined}
 */
function resolveChain(model, chain, known) {
	const [head, ...rest] = chain;

	/** @type {{ kind: 'module'|'type', name: string } | undefined} */
	let current;

	if (model.moduleByName.has(head)) {
		current = { kind: 'module', name: head };
	} else if (known.has(head)) {
		current = { kind: 'type', name: /** @type {string} */ (known.get(head)) };
	} else if (model.typeByName.has(head)) {
		current = { kind: 'type', name: head };
	} else {
		return undefined;
	}

	for (const segment of rest) {
		/** @type {string | undefined} */
		let returns;

		if (current.kind === 'module') {
			const found = api.findModuleMember(model, current.name, segment);
			returns = found && found.member.returns;
		} else {
			const found = api.findTypeMethod(model, current.name, segment);
			returns = found && found.member.returns;
		}

		if (!returns) {
			return undefined;
		}

		current = { kind: 'type', name: returns };
	}

	return current;
}

module.exports = {
	strip,
	matchBrace,
	parseSymbols,
	enclosingType,
	inferTypes,
	receiverChain,
	resolveChain,
	RESERVED_BEFORE_PAREN
};

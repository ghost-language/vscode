// @ts-check
'use strict';

const ghost = require('./ghost');
const lumen = require('./lumen');

/** @typedef {import('./types').Member} Member */
/** @typedef {import('./types').Module} Module */
/** @typedef {import('./types').ObjectType} ObjectType */
/** @typedef {import('./types').GlobalFunction} GlobalFunction */
/** @typedef {import('./types').Callback} Callback */

/**
 * A resolved view of everything in scope, built for one setting of
 * `ghost.lumen.enable`.
 *
 * Lumen is not a separate language — a Lumen game is Ghost source — so the two
 * surfaces are merged rather than kept apart. Where they overlap they are
 * genuinely one thing at runtime: Lumen registers its extra maths onto Ghost's
 * own `math` module rather than introducing a second, so the merge here mirrors
 * what the interpreter does.
 *
 * @typedef {object} Api
 * @property {boolean} lumen                    Whether the Lumen surface is included.
 * @property {Module[]} modules
 * @property {GlobalFunction[]} functions
 * @property {ObjectType[]} types
 * @property {Callback[]} callbacks
 * @property {Map<string, Module>} moduleByName
 * @property {Map<string, ObjectType>} typeByName
 * @property {string[]} keywords
 */

/** Cache keyed on whether Lumen is enabled — there are only two possible answers. */
const cache = new Map();

/**
 * Builds (or returns) the API surface.
 *
 * @param {boolean} withLumen
 * @returns {Api}
 */
function build(withLumen) {
	const cached = cache.get(withLumen);

	if (cached) {
		return cached;
	}

	/** @type {Module[]} */
	const modules = ghost.MODULES.map((module) => {
		if (!withLumen || module.name !== 'math') {
			return module;
		}

		// Lumen registers its additions onto Ghost's math module, so a game sees
		// one module with both sets of methods.
		return Object.assign({}, module, {
			members: module.members.concat(lumen.MATH_EXTENSIONS)
		});
	});

	if (withLumen) {
		modules.push(...lumen.MODULES);
	}

	modules.sort((a, b) => a.name.localeCompare(b.name));

	const types = withLumen ? ghost.TYPES.concat(lumen.TYPES) : ghost.TYPES.slice();

	/** @type {Api} */
	const api = {
		lumen: withLumen,
		modules,
		functions: ghost.FUNCTIONS.slice(),
		types,
		callbacks: withLumen ? lumen.CALLBACKS.slice() : [],
		moduleByName: new Map(modules.map((module) => [module.name, module])),
		typeByName: new Map(types.map((type) => [type.name, type])),
		keywords: ghost.KEYWORDS.slice()
	};

	cache.set(withLumen, api);

	return api;
}

/**
 * Finds a member on a module.
 *
 * @param {Api} api
 * @param {string} moduleName
 * @param {string} memberName
 * @returns {{ module: Module, member: Member } | undefined}
 */
function findModuleMember(api, moduleName, memberName) {
	const module = api.moduleByName.get(moduleName);

	if (!module) {
		return undefined;
	}

	const member = module.members.find((candidate) => candidate.name === memberName);

	return member ? { module, member } : undefined;
}

/**
 * Finds a method on a named object type.
 *
 * @param {Api} api
 * @param {string} typeName
 * @param {string} methodName
 * @returns {{ type: ObjectType, member: Member } | undefined}
 */
function findTypeMethod(api, typeName, methodName) {
	const type = api.typeByName.get(typeName);

	if (!type) {
		return undefined;
	}

	const member = type.methods.find((candidate) => candidate.name === methodName);

	return member ? { type, member } : undefined;
}

/**
 * Every method of that name across all object types.
 *
 * Ghost is dynamically typed and a receiver's type often cannot be worked out
 * from the source, so when inference comes up empty this is what member
 * completion and hover fall back to: offer the name, and say which types have
 * it rather than pretending to know which one this is.
 *
 * @param {Api} api
 * @param {string} methodName
 * @returns {{ type: ObjectType, member: Member }[]}
 */
function findMethodEverywhere(api, methodName) {
	const found = [];

	for (const type of api.types) {
		const member = type.methods.find((candidate) => candidate.name === methodName);

		if (member) {
			found.push({ type, member });
		}
	}

	return found;
}

/**
 * The union of every object type's methods, deduplicated by name, each carrying
 * the types that provide it.
 *
 * @param {Api} api
 * @returns {{ name: string, members: { type: ObjectType, member: Member }[] }[]}
 */
function allMethods(api) {
	/** @type {Map<string, { type: ObjectType, member: Member }[]>} */
	const byName = new Map();

	for (const type of api.types) {
		for (const member of type.methods) {
			const existing = byName.get(member.name);

			if (existing) {
				existing.push({ type, member });
			} else {
				byName.set(member.name, [{ type, member }]);
			}
		}
	}

	return [...byName.entries()]
		.map(([name, members]) => ({ name, members }))
		.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Finds a global function by name.
 *
 * @param {Api} api
 * @param {string} name
 * @returns {GlobalFunction | undefined}
 */
function findFunction(api, name) {
	return api.functions.find((candidate) => candidate.name === name);
}

/**
 * Finds an engine callback by name.
 *
 * @param {Api} api
 * @param {string} name
 * @returns {Callback | undefined}
 */
function findCallback(api, name) {
	return api.callbacks.find((candidate) => candidate.name === name);
}

module.exports = {
	build,
	findModuleMember,
	findTypeMethod,
	findMethodEverywhere,
	allMethods,
	findFunction,
	findCallback,
	KEYWORDS: ghost.KEYWORDS,
	DECLARATION_KEYWORDS: ghost.DECLARATION_KEYWORDS
};

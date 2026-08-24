/**
 * Shapes for the API model. These exist so that `// @ts-check` gives the
 * providers real checking over the data files, which are plain JavaScript so
 * the extension needs no build step.
 */

export type Source = 'ghost' | 'lumen';

export interface Member {
	name: string;
	kind: 'method' | 'property';
	/** How the member is written, used for hover and signature help. */
	signature?: string;
	/** Markdown. */
	doc?: string;
	/** The name of an ObjectType this returns, when it returns one. */
	returns?: string;
	/**
	 * Which language surface contributes this member. Omitted means it comes
	 * from whatever owns it — set only where a module gains members from the
	 * other surface, as `math` does under Lumen.
	 */
	source?: Source;
}

export interface Module {
	name: string;
	source: Source;
	doc: string;
	members: Member[];
	/**
	 * Reachable without an `import` at all. True only for `console` — every
	 * other module, in both Ghost and Lumen, has to be pulled in with
	 * `import ... from "ghost:name"` or `"lumen:name"`.
	 */
	global?: boolean;
}

export interface ObjectType {
	name: string;
	source: Source;
	doc: string;
	methods: Member[];
	/**
	 * The module a class is `new`-able from — set only for a type reached via
	 * `import { Name } from "<source>:<module>"` (Lumen's Image, Spritesheet,
	 * Animation, Source, Font, Target, Quad). Unset for a core value type
	 * (String, List, Number, Map, Date), which needs no import at all.
	 */
	module?: string;
}

export interface GlobalFunction {
	name: string;
	source: Source;
	signature: string;
	doc: string;
	returns?: string;
	/** Reachable without an `import`. True only for `type`. */
	global?: boolean;
}

export interface Callback {
	name: string;
	source: Source;
	signature: string;
	doc: string;
}

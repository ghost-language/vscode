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
}

export interface ObjectType {
	name: string;
	source: Source;
	doc: string;
	methods: Member[];
}

export interface GlobalFunction {
	name: string;
	source: Source;
	signature: string;
	doc: string;
	returns?: string;
}

export interface Callback {
	name: string;
	source: Source;
	signature: string;
	doc: string;
}

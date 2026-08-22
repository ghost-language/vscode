// @ts-check
'use strict';

/**
 * The Ghost language surface: keywords, the globals the interpreter registers
 * before a program runs, its standard library modules, and the methods that
 * live on built-in values.
 *
 * Everything here is transcribed from the interpreter itself — `token.go` and
 * `scanner/scanner.go` for the keywords, `library/library.go` for what is
 * registered, and the `Method` switch on each type in `object/` for the rest —
 * so that the editor never offers a name the runtime does not have.
 */

/** @typedef {import('./types').Member} Member */
/** @typedef {import('./types').Module} Module */
/** @typedef {import('./types').ObjectType} ObjectType */
/** @typedef {import('./types').GlobalFunction} GlobalFunction */

/**
 * Reserved words, from the `keywords` map in `scanner/scanner.go`.
 *
 * `print` is deliberately absent: the token package defines a PRINT type, but
 * the scanner never produces one. `print` reaches programs as a registered
 * library function instead, so it is a global, not a keyword.
 */
const KEYWORDS = [
	'and', 'as', 'break', 'case', 'class', 'continue', 'default', 'else',
	'extends', 'false', 'for', 'from', 'function', 'if', 'import', 'in',
	'new', 'null', 'or', 'return', 'super', 'switch', 'this', 'trait',
	'true', 'use', 'while'
];

/** Keywords that read as declarations, used to weight completion ordering. */
const DECLARATION_KEYWORDS = ['class', 'function', 'trait', 'import', 'use'];

/** @type {GlobalFunction[]} */
const FUNCTIONS = [
	{
		name: 'print',
		source: 'ghost',
		signature: 'print(value, ...)',
		doc: 'Writes each argument separated by a space, followed by a newline. Called with no arguments it writes just the newline.'
	},
	{
		name: 'type',
		source: 'ghost',
		signature: 'type(value)',
		returns: 'String',
		doc: 'Returns the name of a value\'s type in lowercase — `"string"`, `"number"`, `"boolean"`, `"list"`, `"map"`, `"null"`, `"function"`, `"class"`, `"instance"`.'
	}
];

/** @type {Module[]} */
const MODULES = [
	{
		name: 'console',
		source: 'ghost',
		doc: 'Reading from and writing to the terminal.',
		members: [
			{ name: 'log', kind: 'method', signature: 'console.log(value, ...)', doc: 'Writes to standard output with a trailing newline.' },
			{ name: 'print', kind: 'method', signature: 'console.print(value, ...)', doc: 'Writes to standard output without a trailing newline.' },
			{ name: 'info', kind: 'method', signature: 'console.info(value, ...)', doc: 'Writes an informational message.' },
			{ name: 'warn', kind: 'method', signature: 'console.warn(value, ...)', doc: 'Writes a warning message.' },
			{ name: 'error', kind: 'method', signature: 'console.error(value, ...)', doc: 'Writes an error message.' },
			{ name: 'read', kind: 'method', signature: 'console.read([prompt])', returns: 'String', doc: 'Reads a line from standard input and returns it as a string.' },
			{ name: 'clear', kind: 'method', signature: 'console.clear()', doc: 'Clears the terminal.' },
			{ name: 'newLine', kind: 'method', signature: 'console.newLine()', doc: 'Writes a single newline.' }
		]
	},
	{
		name: 'ghost',
		source: 'ghost',
		doc: 'The interpreter itself — running code, extending the runtime, and inspecting state.',
		members: [
			{ name: 'version', kind: 'property', signature: 'ghost.version', returns: 'String', doc: 'The running interpreter\'s version string.' },
			{ name: 'abort', kind: 'method', signature: 'ghost.abort(message)', doc: 'Stops execution and reports `message` as a runtime error.' },
			{ name: 'execute', kind: 'method', signature: 'ghost.execute(source)', doc: 'Evaluates a string of Ghost source in the current environment.' },
			{ name: 'extend', kind: 'method', signature: 'ghost.extend(name, value)', doc: 'Registers a value as a global under `name`.' },
			{ name: 'identifiers', kind: 'method', signature: 'ghost.identifiers()', returns: 'List', doc: 'Returns the names currently bound in scope.' }
		]
	},
	{
		name: 'http',
		source: 'ghost',
		doc: 'A small HTTP server.',
		members: [
			{ name: 'handle', kind: 'method', signature: 'http.handle(path, handler)', doc: 'Registers a handler function for a request path.' },
			{ name: 'listen', kind: 'method', signature: 'http.listen(port)', doc: 'Starts serving on `port`. Blocks until the process ends.' }
		]
	},
	{
		name: 'io',
		source: 'ghost',
		doc: 'Reading and writing files, resolved relative to the running source file.\n\nUnder Lumen this is the right module for a game\'s own shipped data and the wrong one for saves — see `filesystem`.',
		members: [
			{ name: 'read', kind: 'method', signature: 'io.read(path)', returns: 'String', doc: 'Reads a file and returns its contents.' },
			{ name: 'write', kind: 'method', signature: 'io.write(path, contents)', doc: 'Writes `contents` to a file, replacing what was there.' },
			{ name: 'append', kind: 'method', signature: 'io.append(path, contents)', doc: 'Appends `contents` to the end of a file.' }
		]
	},
	{
		name: 'json',
		source: 'ghost',
		doc: 'Converting between JSON text and Ghost values.',
		members: [
			{ name: 'decode', kind: 'method', signature: 'json.decode(text)', doc: 'Parses JSON text into maps, lists, strings, numbers, booleans and null.' },
			{ name: 'encode', kind: 'method', signature: 'json.encode(value)', returns: 'String', doc: 'Serialises a Ghost value to JSON text.' }
		]
	},
	{
		name: 'math',
		source: 'ghost',
		doc: 'Numbers and trigonometry.\n\nLumen adds a great deal more to this same module — rounding, roots, angles, interpolation and randomness — rather than introducing a second one.',
		members: [
			{ name: 'pi', kind: 'property', signature: 'math.pi', returns: 'Number', doc: 'π, 3.14159…' },
			{ name: 'tau', kind: 'property', signature: 'math.tau', returns: 'Number', doc: 'τ, a full turn in radians (2π).' },
			{ name: 'e', kind: 'property', signature: 'math.e', returns: 'Number', doc: 'Euler\'s number, 2.71828…' },
			{ name: 'epsilon', kind: 'property', signature: 'math.epsilon', returns: 'Number', doc: 'The smallest difference two numbers can meaningfully have.' },
			{ name: 'abs', kind: 'method', signature: 'math.abs(n)', returns: 'Number', doc: 'The absolute value of `n`.' },
			{ name: 'sin', kind: 'method', signature: 'math.sin(radians)', returns: 'Number', doc: 'The sine of an angle in radians.' },
			{ name: 'cos', kind: 'method', signature: 'math.cos(radians)', returns: 'Number', doc: 'The cosine of an angle in radians.' },
			{ name: 'tan', kind: 'method', signature: 'math.tan(radians)', returns: 'Number', doc: 'The tangent of an angle in radians.' },
			{ name: 'max', kind: 'method', signature: 'math.max(a, b)', returns: 'Number', doc: 'The larger of two numbers.' },
			{ name: 'min', kind: 'method', signature: 'math.min(a, b)', returns: 'Number', doc: 'The smaller of two numbers.' },
			{ name: 'isPositive', kind: 'method', signature: 'math.isPositive(n)', returns: 'Boolean', doc: 'Whether `n` is greater than zero.' },
			{ name: 'isNegative', kind: 'method', signature: 'math.isNegative(n)', returns: 'Boolean', doc: 'Whether `n` is less than zero.' },
			{ name: 'isZero', kind: 'method', signature: 'math.isZero(n)', returns: 'Boolean', doc: 'Whether `n` is zero.' }
		]
	},
	{
		name: 'os',
		source: 'ghost',
		doc: 'The host operating system and process.',
		members: [
			{ name: 'name', kind: 'method', signature: 'os.name()', returns: 'String', doc: 'The name of the host operating system.' },
			{ name: 'args', kind: 'method', signature: 'os.args()', returns: 'List', doc: 'The command line arguments the program was started with.' },
			{ name: 'clock', kind: 'method', signature: 'os.clock()', returns: 'Number', doc: 'Processor time consumed, in seconds.' },
			{ name: 'exit', kind: 'method', signature: 'os.exit([code])', doc: 'Ends the process with an optional exit code.' }
		]
	},
	{
		name: 'random',
		source: 'ghost',
		doc: 'Random numbers.\n\nA game wanting a number in a range, or a repeatable sequence per level, is better served by Lumen\'s `math.random()` and `math.randomSeed()`, which draw on a generator nothing else in the process can disturb.',
		members: [
			{ name: 'random', kind: 'method', signature: 'random.random()', returns: 'Number', doc: 'A random number.' },
			{ name: 'seed', kind: 'method', signature: 'random.seed(n)', doc: 'Seeds the generator, making the sequence that follows repeatable.' }
		]
	},
	{
		name: 'time',
		source: 'ghost',
		doc: 'Clock readings and delays.',
		members: [
			{ name: 'now', kind: 'method', signature: 'time.now()', returns: 'Number', doc: 'The current time.' },
			{ name: 'sleep', kind: 'method', signature: 'time.sleep(duration)', doc: 'Pauses execution.\n\nInside a game loop this stalls the frame — use `timer.sleep()` deliberately, or not at all.' },
			{ name: 'nanosecond', kind: 'property', signature: 'time.nanosecond', returns: 'Number', doc: 'One nanosecond, as a duration.' },
			{ name: 'microsecond', kind: 'property', signature: 'time.microsecond', returns: 'Number', doc: 'One microsecond, as a duration.' },
			{ name: 'millisecond', kind: 'property', signature: 'time.millisecond', returns: 'Number', doc: 'One millisecond, as a duration.' },
			{ name: 'second', kind: 'property', signature: 'time.second', returns: 'Number', doc: 'One second, as a duration.' },
			{ name: 'minute', kind: 'property', signature: 'time.minute', returns: 'Number', doc: 'One minute, as a duration.' },
			{ name: 'hour', kind: 'property', signature: 'time.hour', returns: 'Number', doc: 'One hour, as a duration.' },
			{ name: 'day', kind: 'property', signature: 'time.day', returns: 'Number', doc: 'One day, as a duration.' },
			{ name: 'week', kind: 'property', signature: 'time.week', returns: 'Number', doc: 'One week, as a duration.' },
			{ name: 'month', kind: 'property', signature: 'time.month', returns: 'Number', doc: 'One month, as a duration.' },
			{ name: 'year', kind: 'property', signature: 'time.year', returns: 'Number', doc: 'One year, as a duration.' }
		]
	}
];

/**
 * Methods on built-in values. Maps have none — indexing is how you read them.
 *
 * @type {ObjectType[]}
 */
const TYPES = [
	{
		name: 'String',
		source: 'ghost',
		doc: 'A string of text.',
		methods: [
			{ name: 'length', kind: 'method', signature: 'length()', returns: 'Number', doc: 'The number of characters, counted as runes rather than bytes.' },
			{ name: 'format', kind: 'method', signature: 'format(value, ...)', returns: 'String', doc: 'Treats the string as a format template and fills in the arguments.\n\n```ghost\n"> %s roars.".format(this.breed)\n```' },
			{ name: 'split', kind: 'method', signature: 'split(separator)', returns: 'List', doc: 'Splits the string on `separator` and returns the pieces as a list.' },
			{ name: 'replace', kind: 'method', signature: 'replace(old, new)', returns: 'String', doc: 'Replaces every occurrence of `old` with `new`.' },
			{ name: 'startsWith', kind: 'method', signature: 'startsWith(prefix)', returns: 'Boolean', doc: 'Whether the string begins with `prefix`.' },
			{ name: 'endsWith', kind: 'method', signature: 'endsWith(suffix)', returns: 'Boolean', doc: 'Whether the string ends with `suffix`.' },
			{ name: 'trim', kind: 'method', signature: 'trim()', returns: 'String', doc: 'Removes whitespace from both ends.' },
			{ name: 'trimStart', kind: 'method', signature: 'trimStart()', returns: 'String', doc: 'Removes whitespace from the start.' },
			{ name: 'trimEnd', kind: 'method', signature: 'trimEnd()', returns: 'String', doc: 'Removes whitespace from the end.' },
			{ name: 'toLowerCase', kind: 'method', signature: 'toLowerCase()', returns: 'String', doc: 'The string in lowercase.' },
			{ name: 'toUpperCase', kind: 'method', signature: 'toUpperCase()', returns: 'String', doc: 'The string in uppercase.' },
			{ name: 'toNumber', kind: 'method', signature: 'toNumber()', returns: 'Number', doc: 'Parses the string as a number.' },
			{ name: 'toString', kind: 'method', signature: 'toString()', returns: 'String', doc: 'The string itself.' },
			{ name: 'matches', kind: 'method', signature: 'matches(subject)', returns: 'Boolean', doc: 'Whether `subject` matches this string used as a regular expression.\n\n**The receiver is the pattern, not the subject.** `"^h".matches(name)` tests `name`.' },
			{ name: 'find', kind: 'method', signature: 'find(subject)', returns: 'String', doc: 'The first match of this string, used as a regular expression, within `subject`. Returns an empty string when nothing matches.\n\n**The receiver is the pattern, not the subject.**' },
			{ name: 'findAll', kind: 'method', signature: 'findAll(subject)', returns: 'List', doc: 'The first match and its capture groups, as a list.\n\n**The receiver is the pattern, not the subject.**' }
		]
	},
	{
		name: 'List',
		source: 'ghost',
		doc: 'An ordered sequence of values.',
		methods: [
			{ name: 'length', kind: 'method', signature: 'length()', returns: 'Number', doc: 'The number of elements.' },
			{ name: 'push', kind: 'method', signature: 'push(value)', returns: 'Number', doc: 'Appends a value to the end and returns the new length.' },
			{ name: 'pop', kind: 'method', signature: 'pop()', doc: 'Removes and returns the **first** element, not the last, and returns null when the list is empty.' },
			{ name: 'first', kind: 'method', signature: 'first()', doc: 'The first element, or null when the list is empty.' },
			{ name: 'last', kind: 'method', signature: 'last()', doc: 'The last element, or null when the list is empty.' },
			{ name: 'tail', kind: 'method', signature: 'tail()', returns: 'List', doc: 'A new list holding everything but the first element.' },
			{ name: 'join', kind: 'method', signature: 'join(separator)', returns: 'String', doc: 'Joins the elements into a string, separated by `separator`.' },
			{ name: 'toString', kind: 'method', signature: 'toString()', returns: 'String', doc: 'The list rendered as a string.' }
		]
	},
	{
		name: 'Number',
		source: 'ghost',
		doc: 'A number. Ghost does not separate integers from floats.',
		methods: [
			{ name: 'round', kind: 'method', signature: 'round()', returns: 'Number', doc: 'The number rounded to the nearest whole number.' },
			{ name: 'floor', kind: 'method', signature: 'floor()', returns: 'Number', doc: 'The largest whole number no greater than this one.' },
			{ name: 'toString', kind: 'method', signature: 'toString()', returns: 'String', doc: 'The number rendered as a string.' }
		]
	}
];

module.exports = { KEYWORDS, DECLARATION_KEYWORDS, FUNCTIONS, MODULES, TYPES };

// @ts-check
'use strict';

/**
 * The Ghost language surface: keywords, the two names the interpreter still
 * registers as reachable without an import, the standard library modules
 * (each requiring `import ... from "ghost:name"`), and the methods that live
 * on built-in values.
 *
 * Everything here is transcribed from the interpreter itself — `token.go` and
 * `scanner/scanner.go` for the keywords, `library/library.go` and
 * `library/modules/*.go` for what is registered and under which scheme, and
 * the `Method` switch on each type in `object/` for the rest — so that the
 * editor never offers a name the runtime does not have.
 *
 * Ghost moved to an import-based module system: only `console` and `type`
 * are reachable without an `import` at all (`library/library.go`'s
 * `globalModules`/`globalFunctions`). Every other module — `math`, `date`,
 * `file`, `path`, `os`, `random`, `json`, `http`, `ghost` itself — has to be
 * pulled in first, the same way Lumen's modules do under its own `lumen:`
 * scheme (see `lumen.js`).
 */

/** @typedef {import('./types').Member} Member */
/** @typedef {import('./types').Module} Module */
/** @typedef {import('./types').ObjectType} ObjectType */
/** @typedef {import('./types').GlobalFunction} GlobalFunction */

/**
 * Reserved words, from the `keywords` map in `scanner/scanner.go`.
 *
 * `print` is deliberately absent: the token package defines a PRINT type, but
 * the scanner never produces one, and there is no global `print()` either —
 * `console.log`/`console.write` are what a program actually calls.
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
		name: 'type',
		source: 'ghost',
		global: true,
		signature: 'type(value)',
		returns: 'String',
		doc: 'Returns the name of a value\'s type in lowercase — `"string"`, `"number"`, `"boolean"`, `"list"`, `"map"`, `"null"`, `"function"`, `"class"`, `"instance"`, `"date"`, `"trait"`. Reachable with no import, like `console`.'
	}
];

/** @type {Module[]} */
const MODULES = [
	{
		name: 'console',
		source: 'ghost',
		global: true,
		doc: 'Reading from and writing to the terminal. The one module reachable with no `import` at all, alongside the global `type()` function.',
		members: [
			{ name: 'log', kind: 'method', signature: 'console.log(value, ...)', doc: 'Writes each argument separated by a space, followed by a newline. Called with no arguments it writes just the newline.' },
			{ name: 'write', kind: 'method', signature: 'console.write(value, ...)', doc: 'Writes without a trailing newline — the `write()`/`writeln()` split Symfony\'s Console component draws. This is `console.log` without the newline, not a synonym for it.' },
			{ name: 'newLine', kind: 'method', signature: 'console.newLine()', doc: 'Writes a single newline.' },
			{ name: 'info', kind: 'method', signature: 'console.info(value, ...)', doc: 'Writes an informational line, prefixed `info:` when the output stream supports colour.' },
			{ name: 'warn', kind: 'method', signature: 'console.warn(value, ...)', doc: 'Writes a warning line, prefixed `warning:`.' },
			{ name: 'error', kind: 'method', signature: 'console.error(value, ...)', doc: 'Writes an error line, prefixed `error:`.' },
			{ name: 'read', kind: 'method', signature: 'console.read([prompt])', returns: 'String', doc: 'Reads a line from standard input, printing `prompt` first if given, and returns it as a string — or **null** at end of file.' },
			{ name: 'clear', kind: 'method', signature: 'console.clear()', doc: 'Clears the terminal.' }
		]
	},
	{
		name: 'date',
		source: 'ghost',
		doc: 'Dates, modelled on date-fns: every function takes a `Date` (or two) and returns a new value — nothing mutates. A `Date` is an instant plus the time zone it should be read in, defaulting to UTC.\n\nThe instant is what `<`, `>`, `==` compare, and stays independent of the attached zone, so a comparison is reproducible everywhere the program runs; the zone only governs what reading a *calendar* position back out of that instant answers (`year()`, `format()`, `isWeekend()`, `startOfDay()`, `toString()`, ...). Time zones are always explicit, named IANA identifiers (`America/New_York`) — never read from the host machine\'s configured zone; there is no `date.local()`.\n\nA `Date` compares directly with `<`, `>`, `<=`, `>=`, `==` — there is no separate `isBefore()`/`isAfter()` — and supports no arithmetic operators of its own; use this module\'s functions instead.',
		members: [
			{ name: 'now', kind: 'method', signature: 'date.now()', returns: 'Date', doc: 'The current instant.' },
			{ name: 'today', kind: 'method', signature: 'date.today()', returns: 'Date', doc: 'Today at 00:00:00 UTC.' },
			{ name: 'of', kind: 'method', signature: 'date.of(year, month, day, [hour, minute, second])', returns: 'Date', doc: 'Builds a date from calendar components, read in UTC. **`month` is 1–12**, not 0-based. Errors — rather than rolling over — if the month, hour, minute or second is out of range, or the day does not exist in that month (Feb 30).' },
			{ name: 'ofInZone', kind: 'method', signature: 'date.ofInZone(year, month, day, [hour, minute, second], zone)', returns: 'Date', doc: '`of()` with a required, trailing IANA `zone` — the components are read as civil time *in that zone*, not in UTC and then relabeled. `date.ofInZone(2024, 7, 15, 9, 0, 0, "America/New_York")` is a different instant than `date.inTimeZone(date.of(2024, 7, 15, 9, 0, 0), "America/New_York")`, which keeps the UTC instant and only changes how it is read back.' },
			{ name: 'parseISO', kind: 'method', signature: 'date.parseISO(text)', returns: 'Date', doc: 'Parses `2024-01-15` or a full RFC3339 timestamp (`2024-01-15T09:30:00Z`). An explicit offset in the text is preserved rather than normalized away.' },
			{ name: 'fromUnix', kind: 'method', signature: 'date.fromUnix(seconds)', returns: 'Date', doc: 'From a Unix timestamp.' },
			{ name: 'toUnix', kind: 'method', signature: 'date.toUnix(d)', returns: 'Number', doc: 'Seconds since the epoch.' },
			{ name: 'toUnixNano', kind: 'method', signature: 'date.toUnixNano(d)', returns: 'Number', doc: 'Nanoseconds since the epoch.' },
			{ name: 'format', kind: 'method', signature: 'date.format(d, pattern)', returns: 'String', doc: 'Formats with date-fns-style pattern letters (not Go\'s reference layout): `yyyy`/`yy`, `MMMM`/`MMM`/`MM`/`M`, `dd`/`d`, `EEEE`/`EEE` (weekday name), `HH`/`H` (24h), `hh`/`h` (12h), `mm`, `ss`, `a` (AM/PM). Anything else is copied literally. Reads the date\'s own attached zone.' },
			{ name: 'inTimeZone', kind: 'method', signature: 'date.inTimeZone(d, zone)', returns: 'Date', doc: 'Moves `d` to a named IANA zone without changing the instant it names — only what every zone-aware read (`year()`, `format()`, `isWeekend()`, `toString()`, ...) answers from that point on.' },
			{ name: 'timeZone', kind: 'method', signature: 'date.timeZone(d)', returns: 'String', doc: 'The zone\'s IANA name, or `""` for a `Date` built from a bare numeric offset rather than a named zone (`date.parseISO("...-05:00")`, say), since there is no name to report.' },
			{ name: 'zoneOffset', kind: 'method', signature: 'date.zoneOffset(d)', returns: 'Number', doc: 'The offset from UTC in seconds, east-positive, at that specific instant — daylight-saving-aware, so the same named zone can answer differently for two dates a few months apart.' },
			{ name: 'addDays', kind: 'method', signature: 'date.addDays(d, n)', returns: 'Date', doc: 'Paired with `subDays` rather than taking a negative count.' },
			{ name: 'subDays', kind: 'method', signature: 'date.subDays(d, n)', returns: 'Date' },
			{ name: 'addWeeks', kind: 'method', signature: 'date.addWeeks(d, n)', returns: 'Date' },
			{ name: 'subWeeks', kind: 'method', signature: 'date.subWeeks(d, n)', returns: 'Date' },
			{ name: 'addMonths', kind: 'method', signature: 'date.addMonths(d, n)', returns: 'Date', doc: 'Clamps to the last valid day of the target month rather than rolling over — Jan 31 + 1 month is Feb 28 (or 29), not Mar 2/3 — and keeps the wall-clock reading in the date\'s own zone across a daylight-saving change.' },
			{ name: 'subMonths', kind: 'method', signature: 'date.subMonths(d, n)', returns: 'Date' },
			{ name: 'addYears', kind: 'method', signature: 'date.addYears(d, n)', returns: 'Date', doc: 'Clamps the same way `addMonths` does, for Feb 29 on a non-leap target year.' },
			{ name: 'subYears', kind: 'method', signature: 'date.subYears(d, n)', returns: 'Date' },
			{ name: 'addHours', kind: 'method', signature: 'date.addHours(d, n)', returns: 'Date', doc: 'Shifts by a fixed real duration regardless of zone — "add 3 hours" always means 3 real hours.' },
			{ name: 'subHours', kind: 'method', signature: 'date.subHours(d, n)', returns: 'Date' },
			{ name: 'addMinutes', kind: 'method', signature: 'date.addMinutes(d, n)', returns: 'Date' },
			{ name: 'subMinutes', kind: 'method', signature: 'date.subMinutes(d, n)', returns: 'Date' },
			{ name: 'addSeconds', kind: 'method', signature: 'date.addSeconds(d, n)', returns: 'Date' },
			{ name: 'subSeconds', kind: 'method', signature: 'date.subSeconds(d, n)', returns: 'Date' },
			{ name: 'isSameDay', kind: 'method', signature: 'date.isSameDay(a, b)', returns: 'Boolean', doc: 'Whether two dates fall on the same calendar year, month and day, each read in its own attached zone.' },
			{ name: 'isWeekend', kind: 'method', signature: 'date.isWeekend(d)', returns: 'Boolean', doc: 'Whether `d` falls on a Saturday or Sunday, read in its own attached zone.' },
			{ name: 'isLeapYear', kind: 'method', signature: 'date.isLeapYear(d)', returns: 'Boolean' },
			{ name: 'differenceInDays', kind: 'method', signature: 'date.differenceInDays(a, b)', returns: 'Number', doc: 'Truncated toward zero; `differenceInDays(a, b) == -differenceInDays(b, a)`. Compares instants, so either date\'s attached zone makes no difference.' },
			{ name: 'differenceInHours', kind: 'method', signature: 'date.differenceInHours(a, b)', returns: 'Number' },
			{ name: 'differenceInMinutes', kind: 'method', signature: 'date.differenceInMinutes(a, b)', returns: 'Number' },
			{ name: 'differenceInSeconds', kind: 'method', signature: 'date.differenceInSeconds(a, b)', returns: 'Number' },
			{ name: 'duration', kind: 'method', signature: 'date.duration(years, months, days, [hours, minutes, seconds])', returns: 'Duration', doc: 'Builds a `Duration` directly, mirroring `of()`\'s own shape. Every given component has to point the same direction — all positive or all negative (zero components don\'t count) — or it is a `Value` error.' },
			{ name: 'durationBetween', kind: 'method', signature: 'date.durationBetween(a, b)', returns: 'Duration', doc: 'The calendar breakdown of `a - b` (same sign convention as `differenceInDays`) as whole months, then whole days, then an hours/minutes/seconds remainder — computed in whichever of `a`/`b` is chronologically earlier\'s attached zone, the same zone `addDuration` walks in when reconstructing the later one. Sits alongside, not instead of, `differenceInX` — "how many whole days apart" and "the full calendar breakdown" are different questions.' },
			{ name: 'addDuration', kind: 'method', signature: 'date.addDuration(d, duration)', returns: 'Date', doc: 'Applies a `Duration` to `d`, walking months, then days, then the clock remainder — the order that makes `addDuration(a, durationBetween(b, a))` reconstruct `b` exactly.' },
			{ name: 'subDuration', kind: 'method', signature: 'date.subDuration(d, duration)', returns: 'Date' },
			{ name: 'startOfDay', kind: 'method', signature: 'date.startOfDay(d)', returns: 'Date', doc: 'Computed in `d`\'s own attached zone.' },
			{ name: 'endOfDay', kind: 'method', signature: 'date.endOfDay(d)', returns: 'Date', doc: '23:59:59.999999999 that day, in `d`\'s own attached zone.' },
			{ name: 'startOfWeek', kind: 'method', signature: 'date.startOfWeek(d)', returns: 'Date', doc: 'Treats Sunday as the first day of the week, matching `weekday()`\'s own `0 = Sunday` reading, rather than the ISO 8601 Monday-first week.' },
			{ name: 'endOfWeek', kind: 'method', signature: 'date.endOfWeek(d)', returns: 'Date' },
			{ name: 'startOfMonth', kind: 'method', signature: 'date.startOfMonth(d)', returns: 'Date' },
			{ name: 'endOfMonth', kind: 'method', signature: 'date.endOfMonth(d)', returns: 'Date' },
			{ name: 'startOfYear', kind: 'method', signature: 'date.startOfYear(d)', returns: 'Date' },
			{ name: 'endOfYear', kind: 'method', signature: 'date.endOfYear(d)', returns: 'Date' },
			{ name: 'year', kind: 'method', signature: 'date.year(d)', returns: 'Number', doc: 'Reads `d`\'s own attached zone.' },
			{ name: 'month', kind: 'method', signature: 'date.month(d)', returns: 'Number', doc: '1–12. Reads `d`\'s own attached zone.' },
			{ name: 'day', kind: 'method', signature: 'date.day(d)', returns: 'Number', doc: 'Reads `d`\'s own attached zone.' },
			{ name: 'hour', kind: 'method', signature: 'date.hour(d)', returns: 'Number', doc: 'Reads `d`\'s own attached zone.' },
			{ name: 'minute', kind: 'method', signature: 'date.minute(d)', returns: 'Number', doc: 'Reads `d`\'s own attached zone.' },
			{ name: 'second', kind: 'method', signature: 'date.second(d)', returns: 'Number', doc: 'Reads `d`\'s own attached zone.' },
			{ name: 'weekday', kind: 'method', signature: 'date.weekday(d)', returns: 'Number', doc: '0 (Sunday) through 6 (Saturday), matching date-fns\' `getDay`. Reads `d`\'s own attached zone.' }
		]
	},
	{
		name: 'file',
		source: 'ghost',
		doc: 'Reading and writing files, resolved relative to the running source file\'s own directory. Pure string manipulation on a path — without touching the filesystem — is `path`, not this.\n\nUnder Lumen this is the right module for a game\'s own shipped data and the wrong one for saves — see Lumen\'s `filesystem`.',
		members: [
			{ name: 'read', kind: 'method', signature: 'file.read(path)', returns: 'String', doc: 'Reads a file and returns its contents.' },
			{ name: 'write', kind: 'method', signature: 'file.write(path, contents)', doc: 'Replaces the contents of a file that must already exist, keeping its permissions. Errors, with help, if it does not — use `append` to create one.' },
			{ name: 'append', kind: 'method', signature: 'file.append(path, contents)', doc: 'Appends a line to a file, creating it if it does not exist.' },
			{ name: 'exists', kind: 'method', signature: 'file.exists(path)', returns: 'Boolean' },
			{ name: 'isDirectory', kind: 'method', signature: 'file.isDirectory(path)', returns: 'Boolean', doc: 'Errors if the path does not exist.' },
			{ name: 'size', kind: 'method', signature: 'file.size(path)', returns: 'Number', doc: 'Size in bytes. Errors if the path does not exist.' },
			{ name: 'delete', kind: 'method', signature: 'file.delete(path)', doc: 'Removes a file or an **empty** directory — a non-empty directory is refused rather than wiped.' },
			{ name: 'mkdir', kind: 'method', signature: 'file.mkdir(path)', doc: 'Creates the directory and any missing parents.' },
			{ name: 'list', kind: 'method', signature: 'file.list(path)', returns: 'List', doc: 'Entry names in a directory, not full paths.' },
			{ name: 'copy', kind: 'method', signature: 'file.copy(source, destination)', doc: 'Copies a file, preserving its permissions.' },
			{ name: 'move', kind: 'method', signature: 'file.move(source, destination)', doc: 'Renames or moves a file.' }
		]
	},
	{
		name: 'ghost',
		source: 'ghost',
		doc: 'The interpreter itself — running code, extending the runtime, and inspecting state.',
		members: [
			{ name: 'version', kind: 'property', signature: 'ghost.version', returns: 'String', doc: 'The running interpreter\'s version string.' },
			{ name: 'abort', kind: 'method', signature: 'ghost.abort(message)', doc: 'Stops the program, reporting `message` (or `null`, to abort silently) as a value error.' },
			{ name: 'execute', kind: 'method', signature: 'ghost.execute(source)', doc: 'Parses and evaluates a string of Ghost source in the current scope. A syntax error in it is reported at this call.' },
			{ name: 'extend', kind: 'method', signature: 'ghost.extend(pluginPath)', doc: 'Loads a Go plugin relative to the script\'s directory and calls its exported `Register()`, letting it register new library modules or functions at runtime.' },
			{ name: 'identifiers', kind: 'method', signature: 'ghost.identifiers()', returns: 'List', doc: 'Every identifier currently bound in scope.' }
		]
	},
	{
		name: 'http',
		source: 'ghost',
		doc: 'A small HTTP server, deliberately minimal.',
		members: [
			{ name: 'handle', kind: 'method', signature: 'http.handle(path, callback)', doc: 'Registers `callback(request)` for requests to `path`. `request` is a map with `method`, `host`, `contentLength`, `protocol`, `protocolMajor`, `protocolMinor` and `body`. **The callback\'s own output writer is redirected to the HTTP response** — a handler produces its response body by calling `console.log`/etc. *inside* the callback, not by returning a value. A panic inside the handler answers a 500 rather than crashing the server.' },
			{ name: 'listen', kind: 'method', signature: 'http.listen(port, [ready])', doc: 'Starts serving on `port`, calling `ready()` once, if given, right before blocking. Blocks until interrupted, then shuts down within 30 seconds.' }
		]
	},
	{
		name: 'json',
		source: 'ghost',
		doc: 'Converting between JSON text and Ghost values.',
		members: [
			{ name: 'decode', kind: 'method', signature: 'json.decode(text)', doc: 'Parses JSON text into a list or map. Only an object or array is accepted at the top level — wrap a bare value in `[` and `]` to decode it.' },
			{ name: 'encode', kind: 'method', signature: 'json.encode(value)', returns: 'String', doc: 'Serialises a list or map to JSON text. A map\'s keys have to be a string, number, or boolean.' }
		]
	},
	{
		name: 'math',
		source: 'ghost',
		doc: 'Numbers: arithmetic, trigonometry, linear algebra and statistics. Most of this broadcasts — a scalar operation applied to a list or a list of lists works elementwise, the same mechanism `+`/`*` already use on lists, so `math.add(a, b)` and `a + b` are the same operation reached two ways.',
		members: [
			{ name: 'pi', kind: 'property', signature: 'math.pi', returns: 'Number', doc: 'π, 3.14159…' },
			{ name: 'tau', kind: 'property', signature: 'math.tau', returns: 'Number', doc: 'τ, a full turn in radians (2π).' },
			{ name: 'e', kind: 'property', signature: 'math.e', returns: 'Number', doc: 'Euler\'s number, 2.71828…' },
			{ name: 'phi', kind: 'property', signature: 'math.phi', returns: 'Number', doc: 'The golden ratio.' },
			{ name: 'sqrt2', kind: 'property', signature: 'math.sqrt2', returns: 'Number' },
			{ name: 'sqrtPi', kind: 'property', signature: 'math.sqrtPi', returns: 'Number' },
			{ name: 'ln2', kind: 'property', signature: 'math.ln2', returns: 'Number' },
			{ name: 'ln10', kind: 'property', signature: 'math.ln10', returns: 'Number' },
			{ name: 'log2e', kind: 'property', signature: 'math.log2e', returns: 'Number' },
			{ name: 'log10e', kind: 'property', signature: 'math.log10e', returns: 'Number' },
			{ name: 'epsilon', kind: 'property', signature: 'math.epsilon', returns: 'Number', doc: 'The smallest difference two numbers can meaningfully have.' },
			{ name: 'smallestNumber', kind: 'property', signature: 'math.smallestNumber', returns: 'Number', doc: 'The smallest positive number representable.' },
			{ name: 'largestNumber', kind: 'property', signature: 'math.largestNumber', returns: 'Number' },
			{ name: 'infinity', kind: 'property', signature: 'math.infinity', returns: 'Number' },
			{ name: 'nan', kind: 'property', signature: 'math.nan', returns: 'Number', doc: 'Not-a-number.' },
			{ name: 'largestInteger', kind: 'property', signature: 'math.largestInteger', returns: 'Number' },
			{ name: 'smallestInteger', kind: 'property', signature: 'math.smallestInteger', returns: 'Number' },

			{ name: 'abs', kind: 'method', signature: 'math.abs(n)', returns: 'Number', doc: 'The absolute value of `n`. Broadcasts over a list or matrix.' },
			{ name: 'sign', kind: 'method', signature: 'math.sign(n)', returns: 'Number', doc: '-1, 0 or 1.' },
			{ name: 'floor', kind: 'method', signature: 'math.floor(n)', returns: 'Number' },
			{ name: 'ceil', kind: 'method', signature: 'math.ceil(n)', returns: 'Number' },
			{ name: 'truncate', kind: 'method', signature: 'math.truncate(n)', returns: 'Number', doc: 'Truncates toward zero, unlike `floor`.' },
			{ name: 'round', kind: 'method', signature: 'math.round(n, [places])', returns: 'Number', doc: 'Rounds to the nearest whole number, or to `places` decimal places if given.' },

			{ name: 'sqrt', kind: 'method', signature: 'math.sqrt(n)', returns: 'Number' },
			{ name: 'cbrt', kind: 'method', signature: 'math.cbrt(n)', returns: 'Number', doc: 'Cube root.' },
			{ name: 'square', kind: 'method', signature: 'math.square(n)', returns: 'Number', doc: 'n². Keeps an integer input an integer.' },
			{ name: 'reciprocal', kind: 'method', signature: 'math.reciprocal(n)', returns: 'Number', doc: '1/n. Errors dividing by zero.' },
			{ name: 'exp', kind: 'method', signature: 'math.exp(n)', returns: 'Number', doc: 'eⁿ' },
			{ name: 'exp2', kind: 'method', signature: 'math.exp2(n)', returns: 'Number', doc: '2ⁿ' },
			{ name: 'expm1', kind: 'method', signature: 'math.expm1(n)', returns: 'Number', doc: 'eⁿ − 1, accurately for `n` near zero.' },
			{ name: 'log', kind: 'method', signature: 'math.log(n, [base])', returns: 'Number', doc: 'The natural logarithm, or the logarithm in `base` if given.' },
			{ name: 'log2', kind: 'method', signature: 'math.log2(n)', returns: 'Number' },
			{ name: 'log10', kind: 'method', signature: 'math.log10(n)', returns: 'Number' },
			{ name: 'log1p', kind: 'method', signature: 'math.log1p(n)', returns: 'Number', doc: 'log(1 + n), accurately for `n` near zero.' },
			{ name: 'pow', kind: 'method', signature: 'math.pow(base, exponent)', returns: 'Number', doc: 'An integer base to a non-negative integer exponent stays exact when it fits; otherwise this falls back to a float.' },
			{ name: 'hypot', kind: 'method', signature: 'math.hypot(a, b)', returns: 'Number', doc: '√(a² + b²).' },

			{ name: 'sin', kind: 'method', signature: 'math.sin(radians)', returns: 'Number', doc: 'The sine of an angle in radians.' },
			{ name: 'cos', kind: 'method', signature: 'math.cos(radians)', returns: 'Number', doc: 'The cosine of an angle in radians.' },
			{ name: 'tan', kind: 'method', signature: 'math.tan(radians)', returns: 'Number', doc: 'The tangent of an angle in radians.' },
			{ name: 'asin', kind: 'method', signature: 'math.asin(n)', returns: 'Number', doc: 'The arcsine of `n`, in radians.' },
			{ name: 'acos', kind: 'method', signature: 'math.acos(n)', returns: 'Number', doc: 'The arccosine of `n`, in radians.' },
			{ name: 'atan', kind: 'method', signature: 'math.atan(n)', returns: 'Number', doc: 'The arctangent of `n`, in radians.' },
			{ name: 'atan2', kind: 'method', signature: 'math.atan2(y, x)', returns: 'Number', doc: 'The angle of the vector `(x, y)`, in radians, with the quadrant resolved.' },
			{ name: 'sinh', kind: 'method', signature: 'math.sinh(n)', returns: 'Number' },
			{ name: 'cosh', kind: 'method', signature: 'math.cosh(n)', returns: 'Number' },
			{ name: 'tanh', kind: 'method', signature: 'math.tanh(n)', returns: 'Number' },
			{ name: 'asinh', kind: 'method', signature: 'math.asinh(n)', returns: 'Number' },
			{ name: 'acosh', kind: 'method', signature: 'math.acosh(n)', returns: 'Number' },
			{ name: 'atanh', kind: 'method', signature: 'math.atanh(n)', returns: 'Number' },
			{ name: 'degrees', kind: 'method', signature: 'math.degrees(radians)', returns: 'Number', doc: 'Radians converted to degrees.' },
			{ name: 'radians', kind: 'method', signature: 'math.radians(degrees)', returns: 'Number', doc: 'Degrees converted to radians.' },

			{ name: 'gamma', kind: 'method', signature: 'math.gamma(n)', returns: 'Number' },
			{ name: 'logGamma', kind: 'method', signature: 'math.logGamma(n)', returns: 'Number', doc: 'The natural log of |Γ(n)|.' },
			{ name: 'erf', kind: 'method', signature: 'math.erf(n)', returns: 'Number', doc: 'The error function.' },
			{ name: 'erfc', kind: 'method', signature: 'math.erfc(n)', returns: 'Number', doc: 'The complementary error function.' },

			{ name: 'add', kind: 'method', signature: 'math.add(a, b)', returns: 'Number', doc: 'The same operation `+` performs, callable as a value — useful passed to `reduce`, `map` and the like.' },
			{ name: 'subtract', kind: 'method', signature: 'math.subtract(a, b)', returns: 'Number' },
			{ name: 'multiply', kind: 'method', signature: 'math.multiply(a, b)', returns: 'Number' },
			{ name: 'divide', kind: 'method', signature: 'math.divide(a, b)', returns: 'Number', doc: 'Errors dividing by zero.' },
			{ name: 'mod', kind: 'method', signature: 'math.mod(a, b)', returns: 'Number', doc: 'Errors dividing by zero.' },
			{ name: 'remainder', kind: 'method', signature: 'math.remainder(a, b)', returns: 'Number', doc: 'The IEEE 754 remainder, which can differ in sign from `mod`.' },
			{ name: 'copySign', kind: 'method', signature: 'math.copySign(a, b)', returns: 'Number', doc: 'The magnitude of `a` with the sign of `b`.' },
			{ name: 'maximum', kind: 'method', signature: 'math.maximum(a, b)', returns: 'Number', doc: 'The elementwise pairwise maximum — distinct from the reduction `math.max`, which takes many values and answers one.' },
			{ name: 'minimum', kind: 'method', signature: 'math.minimum(a, b)', returns: 'Number', doc: 'The elementwise pairwise minimum, distinct from the reduction `math.min`.' },

			{ name: 'isNaN', kind: 'method', signature: 'math.isNaN(n)', returns: 'Boolean' },
			{ name: 'isFinite', kind: 'method', signature: 'math.isFinite(n)', returns: 'Boolean' },
			{ name: 'isInfinite', kind: 'method', signature: 'math.isInfinite(n)', returns: 'Boolean' },
			{ name: 'isInteger', kind: 'method', signature: 'math.isInteger(n)', returns: 'Boolean' },
			{ name: 'isEven', kind: 'method', signature: 'math.isEven(n)', returns: 'Boolean' },
			{ name: 'isOdd', kind: 'method', signature: 'math.isOdd(n)', returns: 'Boolean' },
			{ name: 'isPositive', kind: 'method', signature: 'math.isPositive(n)', returns: 'Boolean', doc: 'Whether `n` is greater than zero.' },
			{ name: 'isNegative', kind: 'method', signature: 'math.isNegative(n)', returns: 'Boolean', doc: 'Whether `n` is less than zero.' },
			{ name: 'isZero', kind: 'method', signature: 'math.isZero(n)', returns: 'Boolean', doc: 'Whether `n` is zero.' },
			{ name: 'isClose', kind: 'method', signature: 'math.isClose(a, b, [tolerance])', returns: 'Boolean', doc: 'A combined absolute-and-relative tolerance comparison (default `1e-9`) — the right way to compare floats after arithmetic, where `==` cannot be trusted.' },

			{ name: 'clamp', kind: 'method', signature: 'math.clamp(value, low, high)', returns: 'Number', doc: 'Errors if `low` is greater than `high`.' },
			{ name: 'lerp', kind: 'method', signature: 'math.lerp(from, to, amount)', returns: 'Number', doc: 'A point `amount` of the way from `from` to `to`.' },
			{ name: 'smoothstep', kind: 'method', signature: 'math.smoothstep(low, high, value)', returns: 'Number', doc: 'An eased interpolation, clamped to 0–1 at the edges.' },
			{ name: 'noise', kind: 'method', signature: 'math.noise(x, [y])', returns: 'Number', doc: 'Smoothly varying value noise in [0, 1) — continuous and reproducible for the same input, unlike jittery random numbers. For terrain, clouds and other things that should look organic.' },

			{ name: 'randomInt', kind: 'method', signature: 'math.randomInt(n)', returns: 'Number', doc: 'A random whole number: `[1, n]` with one argument, `[low, high]` with two (`math.randomInt(low, high)`). Draws on the same generator `random.seed()` seeds.' },
			{ name: 'randomSeed', kind: 'method', signature: 'math.randomSeed(n)', doc: 'Seeds the generator `random.seed()` also seeds, making the sequence that follows repeatable.' },

			{ name: 'arange', kind: 'method', signature: 'math.arange(stop)', returns: 'List', doc: 'Counts up, **excluding** `stop`. Also takes `arange(start, stop)` and `arange(start, stop, step)`; errors if `step` is zero.' },
			{ name: 'linspace', kind: 'method', signature: 'math.linspace(start, stop, count)', returns: 'List', doc: '`count` evenly spaced points, **including both endpoints**.' },
			{ name: 'zeros', kind: 'method', signature: 'math.zeros(n)', returns: 'List', doc: 'A list of zeros, or `zeros(rows, cols)` for a matrix of them.' },
			{ name: 'ones', kind: 'method', signature: 'math.ones(n)', returns: 'List', doc: 'A list of ones, or `ones(rows, cols)` for a matrix of them.' },
			{ name: 'full', kind: 'method', signature: 'math.full(n, fill)', returns: 'List', doc: 'A list filled with `fill`, or `full(rows, cols, fill)` for a matrix.' },
			{ name: 'identity', kind: 'method', signature: 'math.identity(size)', returns: 'List', doc: 'The `size` × `size` identity matrix.' },
			{ name: 'reshape', kind: 'method', signature: 'math.reshape(values, dim, ...)', returns: 'List', doc: 'Lays a flat or nested list of numbers into new dimensions. One dimension may be `-1` to infer it.' },
			{ name: 'flatten', kind: 'method', signature: 'math.flatten(values, ...)', returns: 'List', doc: 'Collapses arbitrary nesting into one flat list.' },
			{ name: 'shape', kind: 'method', signature: 'math.shape(list)', returns: 'List', doc: 'The dimensions, outermost first. Stops at the first ragged (non-rectangular) level.' },
			{ name: 'transpose', kind: 'method', signature: 'math.transpose(matrix)', returns: 'List', doc: 'Swaps rows and columns.' },

			{ name: 'dot', kind: 'method', signature: 'math.dot(a, b)', doc: 'Two vectors give a number; a matrix and a vector give a vector; two matrices give a matrix (matrix multiplication). Errors on a shape mismatch.' },
			{ name: 'matmul', kind: 'method', signature: 'math.matmul(a, b)', doc: 'An alias for `dot` — the same operation.' },
			{ name: 'cross', kind: 'method', signature: 'math.cross(a, b)', doc: '2D vectors give the single scalar their cross product yields; 3D vectors give the perpendicular vector.' },
			{ name: 'outer', kind: 'method', signature: 'math.outer(a, b)', returns: 'List', doc: 'The outer product — a matrix as tall as `a` and as wide as `b`.' },
			{ name: 'norm', kind: 'method', signature: 'math.norm(vector, [order])', returns: 'Number', doc: 'Vector length. Default order 2 (Euclidean); order 1 sums `|x|`; `math.infinity` takes the largest `|x|`. Errors if order is not positive.' },
			{ name: 'normalize', kind: 'method', signature: 'math.normalize(vector)', returns: 'List', doc: 'Scaled to unit length, same direction. Errors on a zero-length vector.' },
			{ name: 'distance', kind: 'method', signature: 'math.distance(x1, y1, x2, y2)', returns: 'Number', doc: 'The distance between two points. Also takes two point lists: `math.distance([0, 0], [3, 4])`.' },
			{ name: 'angle', kind: 'method', signature: 'math.angle(x1, y1, x2, y2)', returns: 'Number', doc: 'The angle from one point to another, in radians, all quadrants resolved. Also takes two point lists.' },

			{ name: 'trace', kind: 'method', signature: 'math.trace(matrix)', returns: 'Number', doc: 'The sum of the diagonal.' },
			{ name: 'determinant', kind: 'method', signature: 'math.determinant(matrix)', returns: 'Number', doc: 'Zero for a singular matrix.' },
			{ name: 'inverse', kind: 'method', signature: 'math.inverse(matrix)', returns: 'List', doc: 'Errors if the matrix is singular.' },
			{ name: 'solve', kind: 'method', signature: 'math.solve(a, b)', returns: 'List', doc: 'Solves `a·x = b` directly, without forming the inverse. `b` may be a vector or a matrix of several right-hand sides. Errors on a singular system.' },

			{ name: 'sum', kind: 'method', signature: 'math.sum(value, ...)', returns: 'Number', doc: 'Takes values spread across arguments, as one list, or as nested lists (flattened) — `math.sum(1, 2, 3) == math.sum([1, 2, 3])`. Every reduction below takes values the same three interchangeable ways, and errors on empty input.' },
			{ name: 'product', kind: 'method', signature: 'math.product(value, ...)', returns: 'Number', doc: 'Starts from 1.' },
			{ name: 'mean', kind: 'method', signature: 'math.mean(value, ...)', returns: 'Number' },
			{ name: 'median', kind: 'method', signature: 'math.median(value, ...)', returns: 'Number', doc: 'Averages the two middle values on an even count.' },
			{ name: 'mode', kind: 'method', signature: 'math.mode(value, ...)', returns: 'Number', doc: 'The most frequent value; ties break toward the smallest.' },
			{ name: 'variance', kind: 'method', signature: 'math.variance(value, ...)', returns: 'Number', doc: 'Population variance (divided by N).' },
			{ name: 'sampleVariance', kind: 'method', signature: 'math.sampleVariance(value, ...)', returns: 'Number', doc: 'Sample variance (divided by N − 1). Errors with fewer than two values.' },
			{ name: 'standardDeviation', kind: 'method', signature: 'math.standardDeviation(value, ...)', returns: 'Number', doc: 'The square root of the population variance.' },
			{ name: 'sampleStandardDeviation', kind: 'method', signature: 'math.sampleStandardDeviation(value, ...)', returns: 'Number', doc: 'The square root of the sample variance. Errors with fewer than two values.' },
			{ name: 'min', kind: 'method', signature: 'math.min(value, ...)', returns: 'Number', doc: 'The smallest of any number of values — a reduction, unlike the elementwise `math.minimum`.' },
			{ name: 'max', kind: 'method', signature: 'math.max(value, ...)', returns: 'Number', doc: 'The largest of any number of values — a reduction, unlike the elementwise `math.maximum`.' },
			{ name: 'argmin', kind: 'method', signature: 'math.argmin(value, ...)', returns: 'Number', doc: 'The index of the first-smallest value, in flattened order.' },
			{ name: 'argmax', kind: 'method', signature: 'math.argmax(value, ...)', returns: 'Number', doc: 'The index of the first-largest value.' },
			{ name: 'cumulativeSum', kind: 'method', signature: 'math.cumulativeSum(value, ...)', returns: 'List', doc: 'Running totals, the same length as the input.' },
			{ name: 'cumulativeProduct', kind: 'method', signature: 'math.cumulativeProduct(value, ...)', returns: 'List', doc: 'Running products.' },
			{ name: 'gcd', kind: 'method', signature: 'math.gcd(value, ...)', returns: 'Number' },
			{ name: 'lcm', kind: 'method', signature: 'math.lcm(value, ...)', returns: 'Number', doc: 'Errors on overflow.' },
			{ name: 'percentile', kind: 'method', signature: 'math.percentile(values, p)', returns: 'Number', doc: '`p` on a 0–100 scale, interpolated between neighbours.' },
			{ name: 'quantile', kind: 'method', signature: 'math.quantile(values, q)', returns: 'Number', doc: 'The same as `percentile`, with `q` on a 0–1 scale.' },
			{ name: 'sort', kind: 'method', signature: 'math.sort(values, [descending])', returns: 'List', doc: 'Ascending by default.' },
			{ name: 'unique', kind: 'method', signature: 'math.unique(value, ...)', returns: 'List', doc: 'Duplicates dropped, first-seen order kept.' },
			{ name: 'factorial', kind: 'method', signature: 'math.factorial(n)', returns: 'Number', doc: 'Falls back to a float, via Γ, if the exact result would overflow. Errors if `n` is negative.' },
			{ name: 'isPrime', kind: 'method', signature: 'math.isPrime(n)', returns: 'Boolean', doc: 'False for a non-integer.' },
			{ name: 'combinations', kind: 'method', signature: 'math.combinations(n, k)', returns: 'Number', doc: 'n choose k.' },
			{ name: 'permutations', kind: 'method', signature: 'math.permutations(n, k)', returns: 'Number', doc: 'Like `combinations`, but order matters.' }
		]
	},
	{
		name: 'os',
		source: 'ghost',
		doc: 'The host operating system and process.',
		members: [
			{ name: 'name', kind: 'property', signature: 'os.name', returns: 'String', doc: 'The name of the host operating system.' },
			{ name: 'args', kind: 'method', signature: 'os.args()', returns: 'List', doc: 'The command line arguments the program was started with.' },
			{ name: 'exit', kind: 'method', signature: 'os.exit(status, [message])', doc: 'Ends the process with `status`, printing `message` first if given. Every argument is validated before anything is printed or the process exits.' },
			{ name: 'sleep', kind: 'method', signature: 'os.sleep(milliseconds)', doc: 'Pauses the program. Errors if `milliseconds` is negative.\n\nInside a game loop this stalls the frame — reach for it rarely, or not at all.' }
		]
	},
	{
		name: 'path',
		source: 'ghost',
		doc: 'Path string manipulation — never touches the filesystem, unlike `file`.',
		members: [
			{ name: 'join', kind: 'method', signature: 'path.join(part, ...)', returns: 'String', doc: 'Joins one or more path segments.' },
			{ name: 'basename', kind: 'method', signature: 'path.basename(p)', returns: 'String', doc: 'The last path element.' },
			{ name: 'dirname', kind: 'method', signature: 'path.dirname(p)', returns: 'String', doc: 'Everything but the last element.' },
			{ name: 'extname', kind: 'method', signature: 'path.extname(p)', returns: 'String', doc: 'The extension, including the leading dot — an empty string when there is none.' },
			{ name: 'isAbsolute', kind: 'method', signature: 'path.isAbsolute(p)', returns: 'Boolean' }
		]
	},
	{
		name: 'random',
		source: 'ghost',
		doc: 'Random numbers, from the same generator `math`\'s `randomInt`/`randomSeed` use.',
		members: [
			{ name: 'random', kind: 'method', signature: 'random.random([max]) or random.random(min, max)', returns: 'Number', doc: 'A uniform random number. No arguments: `(0, 1)`. One argument: `(0, max)`. Two: `(min, max)`.' },
			{ name: 'seed', kind: 'method', signature: 'random.seed([n])', doc: 'Seeds the generator. With no argument, reseeds from the current time.' },
			{ name: 'currentSeed', kind: 'property', signature: 'random.currentSeed', returns: 'Number', doc: 'The seed currently driving the generator — a read-only counterpart to `seed()`, deliberately a different name so no getter and setter ever share a word.' }
		]
	}
];

/**
 * Methods on built-in values. Every one of these is always in scope, needing
 * no `import` — they live on the value itself, not on a module.
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
			{ name: 'replace', kind: 'method', signature: 'replace(old, new)', returns: 'String', doc: 'Replaces every literal occurrence of `old` with `new`.' },
			{ name: 'startsWith', kind: 'method', signature: 'startsWith(prefix)', returns: 'Boolean', doc: 'Whether the string begins with `prefix`.' },
			{ name: 'endsWith', kind: 'method', signature: 'endsWith(suffix)', returns: 'Boolean', doc: 'Whether the string ends with `suffix`.' },
			{ name: 'trim', kind: 'method', signature: 'trim()', returns: 'String', doc: 'Removes whitespace from both ends.' },
			{ name: 'trimStart', kind: 'method', signature: 'trimStart()', returns: 'String', doc: 'Removes whitespace from the start.' },
			{ name: 'trimEnd', kind: 'method', signature: 'trimEnd()', returns: 'String', doc: 'Removes whitespace from the end.' },
			{ name: 'toLowerCase', kind: 'method', signature: 'toLowerCase()', returns: 'String', doc: 'The string in lowercase.' },
			{ name: 'toUpperCase', kind: 'method', signature: 'toUpperCase()', returns: 'String', doc: 'The string in uppercase.' },
			{ name: 'toNumber', kind: 'method', signature: 'toNumber()', returns: 'Number', doc: 'Parses the string as a number — an integer first, then a float. Errors, with help, if it parses as neither.' },
			{ name: 'toString', kind: 'method', signature: 'toString()', returns: 'String', doc: 'The string itself.' },
			{ name: 'matches', kind: 'method', signature: 'matches(pattern)', returns: 'Boolean', doc: 'Whether the receiver contains a match for `pattern`, compiled as a regular expression. **The receiver is the subject, `pattern` is the argument** — `subject.matches(pattern)`, matching JS/PHP/Python.' },
			{ name: 'find', kind: 'method', signature: 'find(pattern)', returns: 'String', doc: 'The first match of `pattern` (a regular expression) within the receiver, or `""` if none. **The receiver is the subject, `pattern` is the argument.**' },
			{ name: 'findAll', kind: 'method', signature: 'findAll(pattern)', returns: 'List', doc: 'Every match of `pattern` within the receiver, in order, as a list of the matched text — not, as in earlier releases, only the first match\'s own capture groups. **The receiver is the subject, `pattern` is the argument.**' },
			{ name: 'contains', kind: 'method', signature: 'contains(substring)', returns: 'Boolean', doc: 'Plain substring search — named to match `list.contains()` rather than adding a second `includes` spelling.' },
			{ name: 'indexOf', kind: 'method', signature: 'indexOf(substring)', returns: 'Number', doc: 'The position of the first match, as a rune index (not a byte offset); `-1` if not found.' },
			{ name: 'lastIndexOf', kind: 'method', signature: 'lastIndexOf(substring)', returns: 'Number', doc: 'The position of the last match, as a rune index; `-1` if not found.' },
			{ name: 'repeat', kind: 'method', signature: 'repeat(n)', returns: 'String', doc: '`n` copies concatenated. A `Value` error if `n` is negative.' },
			{ name: 'padStart', kind: 'method', signature: 'padStart(length, [pad])', returns: 'String', doc: 'Grows to `length` runes by repeating `pad` (default a space) at the start, truncated to fit. A receiver already at or past `length`, or an empty `pad`, comes back unchanged.' },
			{ name: 'padEnd', kind: 'method', signature: 'padEnd(length, [pad])', returns: 'String', doc: 'As `padStart`, padding at the end.' },
			{ name: 'charAt', kind: 'method', signature: 'charAt(index)', returns: 'String', doc: 'The single-rune string at a rune position; `""` for a position out of range — a *position* read, so it is lenient rather than erroring (`at` was not added as a second name for this).' },
			{ name: 'slice', kind: 'method', signature: 'slice(start, [end])', returns: 'String', doc: 'A new string of the runes from `start` up to `end` (default the string\'s length). A *range* read: out-of-range bounds raise an `Index` error, matching `list.slice()` (`substring` was not added as a second spelling).' },
			{ name: 'reverse', kind: 'method', signature: 'reverse()', returns: 'String', doc: 'A new string with the runes reversed.' },
			{ name: 'isEmpty', kind: 'method', signature: 'isEmpty()', returns: 'Boolean', doc: '`length() == 0`.' }
		]
	},
	{
		name: 'List',
		source: 'ghost',
		doc: 'An ordered sequence of values.',
		methods: [
			{ name: 'length', kind: 'method', signature: 'length()', returns: 'Number', doc: 'The number of elements.' },
			{ name: 'push', kind: 'method', signature: 'push(value)', returns: 'Number', doc: 'Appends a value to the end and returns the new length.' },
			{ name: 'pop', kind: 'method', signature: 'pop()', doc: 'Removes and returns the **last** element, mirroring `push` — a list used as a stack grows and shrinks from the same end. Returns null when the list is empty.\n\nFor the first element, see `shift`.' },
			{ name: 'shift', kind: 'method', signature: 'shift()', doc: 'Removes and returns the **first** element, sliding everything else down. Returns null when the list is empty. This is what `pop` did before `pop` was made to match `push` and act on the other end.' },
			{ name: 'first', kind: 'method', signature: 'first()', doc: 'The first element, or null when the list is empty. Does not remove it.' },
			{ name: 'last', kind: 'method', signature: 'last()', doc: 'The last element, or null when the list is empty. Does not remove it.' },
			{ name: 'tail', kind: 'method', signature: 'tail()', returns: 'List', doc: 'A new list holding everything but the first element, or null when the list is empty.' },
			{ name: 'join', kind: 'method', signature: 'join(separator)', returns: 'String', doc: 'Joins the elements into a string, separated by `separator`.' },
			{ name: 'toString', kind: 'method', signature: 'toString()', returns: 'String', doc: 'The list rendered as a string.' },
			{ name: 'concat', kind: 'method', signature: 'concat(other)', returns: 'List', doc: 'Joins two lists end to end into a new list, leaving both untouched. Not what `+` does on lists — that is elementwise arithmetic.' },
			{ name: 'contains', kind: 'method', signature: 'contains(value)', returns: 'Boolean', doc: 'Whether `value` appears in the list, comparing contents the way `==` does.' },
			{ name: 'reverse', kind: 'method', signature: 'reverse()', returns: 'List', doc: 'A new, reversed list.' },
			{ name: 'slice', kind: 'method', signature: 'slice(start, [end])', returns: 'List', doc: 'The elements from `start` up to, but not including, `end`, which defaults to the length of the list.' },
			{ name: 'sort', kind: 'method', signature: 'sort([comparator])', returns: 'List', doc: 'A new, sorted list. With no comparator, sorts a list of only numbers or only strings by natural order; anything else needs a comparator `(a, b) -> negative/zero/positive number`.' },
			{ name: 'unique', kind: 'method', signature: 'unique()', returns: 'List', doc: 'A new list with repeats dropped, keeping first-seen order.' },
			{ name: 'each', kind: 'method', signature: 'each(fn)', returns: 'List', doc: 'Calls `fn(element, index)` once per element for the side effect, and returns the list itself so a call can chain.' },
			{ name: 'map', kind: 'method', signature: 'map(fn)', returns: 'List', doc: 'A new list built by calling `fn(element, index)` on every element.' },
			{ name: 'filter', kind: 'method', signature: 'filter(fn)', returns: 'List', doc: 'A new list keeping the elements `fn(element, index)` answers true for.' },
			{ name: 'reduce', kind: 'method', signature: 'reduce(fn, [initial])', doc: 'Folds the list to a single value with `fn(accumulator, element, index)`, left to right. With no `initial`, the first element seeds it — an empty list then needs one.' },
			{ name: 'indexOf', kind: 'method', signature: 'indexOf(value)', returns: 'Number', doc: 'The position of the first element equal to `value` (deep/structural equality, same rule as `contains`), or `-1`. Value-based search, pairing with the predicate-based `find`/`findIndex`.' },
			{ name: 'find', kind: 'method', signature: 'find(fn)', doc: 'The first element `fn(element, index)` answers truthy for, or `null` if none.' },
			{ name: 'findIndex', kind: 'method', signature: 'findIndex(fn)', returns: 'Number', doc: 'The index of the first element `fn(element, index)` answers truthy for, or `-1` if none.' },
			{ name: 'some', kind: 'method', signature: 'some(fn)', returns: 'Boolean', doc: 'Whether `fn(element, index)` answers truthy for any element. Short-circuits, mirroring `||`.' },
			{ name: 'every', kind: 'method', signature: 'every(fn)', returns: 'Boolean', doc: 'Whether `fn(element, index)` answers truthy for every element. Short-circuits, mirroring `&&`.' },
			{ name: 'flatten', kind: 'method', signature: 'flatten()', returns: 'List', doc: 'A new list with every nested list\'s elements spliced in, recursively — to any depth, with no depth argument: one unambiguous behavior rather than a JS-style default depth of 1.' },
			{ name: 'flatMap', kind: 'method', signature: 'flatMap(fn)', returns: 'List', doc: '`fn(element, index)` → a new list, with each result spliced in one level if it is itself a list, else kept as-is.' },
			{ name: 'chunk', kind: 'method', signature: 'chunk(size)', returns: 'List', doc: 'A new list of new lists of at most `size` elements each, in order; the last chunk holds whatever remains. `size` must be positive (`Value` error otherwise).' },
			{ name: 'fill', kind: 'method', signature: 'fill(value, [start], [end])', returns: 'List', doc: 'A new list with `value` in place of every element from `start` up to `end` (default the whole list). A *range* read: out-of-range bounds raise an `Index` error, the same convention `slice()` uses. Does not mutate.' },
			{ name: 'isEmpty', kind: 'method', signature: 'isEmpty()', returns: 'Boolean', doc: '`length() == 0`.' },
			{ name: 'unshift', kind: 'method', signature: 'unshift(value)', returns: 'Number', doc: 'Mutates in place; front-inserts `value` and returns the new length — the front-insert counterpart to `push`.' },
			{ name: 'insertAt', kind: 'method', signature: 'insertAt(index, value)', returns: 'Number', doc: 'Mutates in place; inserts `value` at `index` and returns the new length, like `push`. An out-of-range `index` clamps to the nearest end rather than erroring.' },
			{ name: 'removeAt', kind: 'method', signature: 'removeAt(index)', doc: 'Mutates in place; removes and returns the element at `index`, or `null` for an out-of-range index — the same leniency `pop()`/`shift()` give an empty list.' }
		]
	},
	{
		name: 'Number',
		source: 'ghost',
		doc: 'A number. Ghost does not separate integers from floats.',
		methods: [
			{ name: 'round', kind: 'method', signature: 'round([places])', returns: 'Number', doc: 'Rounded to the nearest whole number, or to `places` decimal places if given. An already-whole number is returned unchanged.' },
			{ name: 'floor', kind: 'method', signature: 'floor()', returns: 'Number', doc: 'The largest whole number no greater than this one. An already-whole number is returned unchanged.' },
			{ name: 'ceil', kind: 'method', signature: 'ceil()', returns: 'Number', doc: 'The smallest whole number no less than this one. An already-whole number is returned unchanged.' },
			{ name: 'abs', kind: 'method', signature: 'abs()', returns: 'Number', doc: 'The absolute value. An already-whole number stays an integer.' },
			{ name: 'pow', kind: 'method', signature: 'pow(exponent)', returns: 'Number', doc: 'Raised to `exponent`. An integer receiver raised to a non-negative integer exponent stays an exact integer (checked for overflow), so the result can index a list; otherwise falls back to a float, matching `math.pow()`. Mirrors `math.pow(n, exponent)` for every input.' },
			{ name: 'clamp', kind: 'method', signature: 'clamp(low, high)', returns: 'Number', doc: 'The receiver, pulled inside `[low, high]` — answers with one of the three values given rather than a computed one, so clamping whole numbers leaves them whole. A `Value` error if `low` is greater than `high`.' },
			{ name: 'isNaN', kind: 'method', signature: 'isNaN()', returns: 'Boolean', doc: 'Only ever true for a float — an integer `Number` can\'t hold NaN.' },
			{ name: 'isFinite', kind: 'method', signature: 'isFinite()', returns: 'Boolean' },
			{ name: 'isInfinite', kind: 'method', signature: 'isInfinite()', returns: 'Boolean' },
			{ name: 'isInteger', kind: 'method', signature: 'isInteger()', returns: 'Boolean', doc: 'True for every non-float `Number`, and for a float only if it is finite with no fractional part.' },
			{ name: 'isEven', kind: 'method', signature: 'isEven()', returns: 'Boolean', doc: 'True only for an integral value of even parity.' },
			{ name: 'isOdd', kind: 'method', signature: 'isOdd()', returns: 'Boolean', doc: 'True only for an integral value of odd parity.' },
			{ name: 'isNegative', kind: 'method', signature: 'isNegative()', returns: 'Boolean' },
			{ name: 'isPositive', kind: 'method', signature: 'isPositive()', returns: 'Boolean' },
			{ name: 'isZero', kind: 'method', signature: 'isZero()', returns: 'Boolean' },
			{ name: 'toString', kind: 'method', signature: 'toString()', returns: 'String', doc: 'The number rendered as a string.' }
		]
	},
	{
		name: 'Map',
		source: 'ghost',
		doc: 'A collection of key/value pairs. A key has to be a string, number, or boolean.',
		methods: [
			{ name: 'get', kind: 'method', signature: 'get(key, [fallback])', doc: 'The value at `key`, or `fallback` if it is absent — or null with no fallback. The same rule `map[key]` indexing follows.' },
			{ name: 'has', kind: 'method', signature: 'has(key)', returns: 'Boolean', doc: 'Whether `key` is present, regardless of its value — the distinction `get` alone cannot make, since a key can map to null on purpose.' },
			{ name: 'set', kind: 'method', signature: 'set(key, value)', returns: 'Map', doc: 'Adds or overwrites a key, and returns the map itself so a call can chain.' },
			{ name: 'keys', kind: 'method', signature: 'keys()', returns: 'List' },
			{ name: 'values', kind: 'method', signature: 'values()', returns: 'List' },
			{ name: 'length', kind: 'method', signature: 'length()', returns: 'Number', doc: 'The number of pairs.' },
			{ name: 'merge', kind: 'method', signature: 'merge(other)', returns: 'Map', doc: 'A new map holding this map\'s pairs, in their own order, followed by `other`\'s. On a key collision `other`\'s value wins, but the key keeps this map\'s position for it.' },
			{ name: 'remove', kind: 'method', signature: 'remove(key)', doc: 'Mutates in place; removes `key` entirely (dropping it from insertion order, leaving no gap) and returns the value that was stored there, or `null` if `key` was not present — the same leniency `pop()`/`shift()` give an empty list. Named to match `list.removeAt()` rather than adding `delete` as a second spelling.' },
			{ name: 'entries', kind: 'method', signature: 'entries()', returns: 'List', doc: 'A new list of `[key, value]` two-element lists, one per entry, in insertion order — for symmetry with `keys()`/`values()`.' }
		]
	},
	{
		name: 'Date',
		source: 'ghost',
		doc: 'An instant in time plus the time zone it should be read in, defaulting to UTC. Returned by the `date` module\'s functions, never constructed directly.\n\n`<`, `>`, `<=`, `>=`, `==` compare the instant — independent of either operand\'s attached zone, so a comparison is reproducible everywhere the program runs — there is no `isBefore()`/`isAfter()` method. Supports no arithmetic operators; use the `date` module\'s functions. A *calendar* read (`year()`, `format()`, `isWeekend()`, `startOfDay()`, `toString()`, ...) answers relative to the date\'s own attached zone, moved with `date.inTimeZone()`.',
		methods: [
			{ name: 'toString', kind: 'method', signature: 'toString()', returns: 'String', doc: 'ISO 8601 / RFC3339 in the date\'s own attached zone — `Z` for the UTC default (`2024-01-15T09:30:00Z`), an explicit offset otherwise (`2024-01-15T09:30:00-05:00`).' }
		]
	},
	{
		name: 'Duration',
		source: 'ghost',
		doc: 'A calendar-and-clock span kept as six separate components (years, months, days, hours, minutes, seconds) rather than one fixed length, since "1 month" has no fixed number of days. Built by `date.duration()`/`date.durationBetween()`; applied back to a `Date` with `date.addDuration()`/`date.subDuration()`.\n\n`==`/`!=` compare all six components directly (structural equality, like `list`). Ordering (`<`, `>`, `<=`, `>=`) and arithmetic operators are unsupported — unlike two instants, "which of two spans is longer" has no single answer without a reference date.',
		methods: [
			{ name: 'years', kind: 'method', signature: 'years()', returns: 'Number' },
			{ name: 'months', kind: 'method', signature: 'months()', returns: 'Number' },
			{ name: 'days', kind: 'method', signature: 'days()', returns: 'Number' },
			{ name: 'hours', kind: 'method', signature: 'hours()', returns: 'Number' },
			{ name: 'minutes', kind: 'method', signature: 'minutes()', returns: 'Number' },
			{ name: 'seconds', kind: 'method', signature: 'seconds()', returns: 'Number' },
			{ name: 'toString', kind: 'method', signature: 'toString()', returns: 'String', doc: 'An ISO 8601 duration, e.g. `P1Y2M3DT4H5M6S`, or `PT0S` for a zero duration.' }
		]
	}
];

module.exports = { KEYWORDS, DECLARATION_KEYWORDS, FUNCTIONS, MODULES, TYPES };

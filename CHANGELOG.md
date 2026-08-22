# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-08-22
### Added
- Support for the [Lumen](https://github.com/ghost-language/lumen) game engine: its modules, object
  types and game-loop callbacks, folded into the Ghost surface because a Lumen game is Ghost source.
  Controlled by `ghost.lumen.enable`.
- Completion for the standard library, the names a file declares, and `this.` members inside a class
  or trait. Receivers are resolved by following assignments through the document, so a variable
  holding a library value gets that value's members; where a receiver cannot be identified, every
  built-in method is offered, labelled with the types that have it.
- Hover documentation for modules, methods, properties, global functions and built-in methods.
- Signature help, with the optional trailing parameters of the drawing calls expanded.
- Outline, breadcrumbs and **Go to Symbol in File** for classes, traits, functions, methods, instance
  fields and top-level variables.
- Semantic highlighting, which resolves what the grammar cannot: a module name the file assigns to is
  treated as that assignment, and members are checked against the module they are reached through.
- Indentation rules, folding, bracket colouring, and block comment continuation on Enter.
- A dependency-free test suite (`npm test`) covering the providers and the grammar.

### Fixed
- Keywords now match the interpreter. `switch`, `case`, `default`, `trait`, `use`, `new`, `extends`,
  `as` and `from` were missing; `foreign`, `is` and `static` were highlighted but are not Ghost
  keywords at all, and inheritance is written `extends`, not `is`.
- `#` line comments are highlighted. The scanner has always accepted them.
- Compound assignment (`+=`, `-=`, `*=`, `/=`), increment and decrement (`++`, `--`), and the ternary
  `?` and `:` are highlighted.
- Number literals match what the scanner reads. Hexadecimal was highlighted but Ghost has no hex
  literals, and forms the scanner never produces (`1.`, `1e+5`) were accepted.
- String escapes match the scanner's set. `\a`, `\b`, `\f`, `\v`, `\0`, `\x`, `\u` and `\U` were
  highlighted as escapes and `%(…)` as interpolation, none of which Ghost has — while `\'`, which it
  does have, was marked an illegal escape.
- Punctuation is highlighted. The rule was stored under a misspelt key and so never applied.
- A class body is no longer cut short at the first `}`, which previously left the rest of a class
  unhighlighted.
- `function` is scoped as a storage type rather than as a control keyword, so themes style it like a
  declaration.

### Changed
- Minimum Visual Studio Code version is now `1.75`, which the language icons and semantic tokens
  need. The manifest previously declared `1.44`.

### Removed
- The snippets. Completion now covers what they did and stays correct as the language moves, whereas
  these had drifted: `write` expanded to a call to a function Ghost does not have — only `print` and
  `type` are registered as globals — and the `while` snippet's description was misspelt, so it never
  showed.

## [0.0.8] - 2021-09-08
### Added
- Class and method highlighting support

## [0.0.1] - 2020-04-19
### Added
- Syntax highlighting support for Ghost (.ghost)

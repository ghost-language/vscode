# Ghost for Visual Studio Code

Visual Studio Code support for the [Ghost](https://ghostlang.org/) programming language, and for
[Lumen](https://github.com/ghost-language/lumen), the 2D game engine games are written against in Ghost.

## Features

### Syntax highlighting

A TextMate grammar covering the whole language as the interpreter actually reads it: every reserved
word, all three comment forms (`//`, `#`, and `/* */`), single- and double-quoted strings with the
escapes the scanner recognises, class and trait declarations with `extends`, both method forms,
`switch`/`case`/`default`, `use`, `new`, the import forms, and the full operator set including the
compound assignments and `..`.

### Completion

Completion knows the standard library, and works out what a receiver is before offering its members:

```ghost
sheet = image.newSpritesheet('characters.png', 16)
walk  = sheet.newAnimation([4, 5, 6, 7], 0.16)

walk.        # offers Animation's methods, not a generic list
```

It follows assignments through the document to do this, so a variable holding a value from a library
call gets the right members even though Ghost is dynamically typed and nothing is annotated. Where a
receiver genuinely cannot be identified it offers every built-in method there is, each labelled with
the types that have it, rather than offering nothing.

Also completed: modules and global functions, the names the file itself declares, `this.` members
inside a class or trait, and — under Lumen — the engine callbacks, inserted as whole function bodies.

### Hover and signature help

Hover documents modules, their methods and properties, global functions, and built-in methods,
resolved through the same inference completion uses. Signature help shows which argument comes next,
which matters most for the drawing calls with long optional tails:

```ghost
sprite.draw(x, y, [rotation, sx, sy, ox, oy])
```

### Outline and navigation

Classes, traits, functions, methods, instance fields and top-level variables appear in the outline,
in breadcrumbs, and in **Go to Symbol in File**, nested the way they are written.

### Semantic highlighting

Layered over the grammar, this resolves what a regular expression cannot. A name the file assigns to
is that assignment — writing `image = 3` shadows the module, and the colouring follows. Members are
checked against the module they are reached through, so a typo stops being highlighted.

### Editor behaviour

Indentation rules, bracket colouring, folding, comment toggling, and continuation of block comments
on Enter.

## Lumen

A Lumen game is written in Ghost — `.lumen` is a packaged archive, not a source format — so there is
no second language here. Lumen's modules, object types and callbacks are folded into the Ghost
surface instead, and can be switched off:

| Setting | Default | |
| --- | --- | --- |
| `ghost.lumen.enable` | `true` | Include Lumen's modules, objects and callbacks in completion, hover and highlighting. |

Turn it off in a project that is plain Ghost, so that a variable named `window`, `image` or `canvas`
is not dressed up as something from an engine the project does not use. Lumen's additions to the
`math` module follow the same switch, matching how the engine registers them onto Ghost's own module
rather than introducing a second.

## Usage

You will need [Visual Studio Code](https://code.visualstudio.com/) >= `1.75`. Install **Ghost** from
the [Marketplace](https://marketplace.visualstudio.com/vscode), or from the command palette
(<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>) with **Install Extension**. Open any `.ghost` file.

## Development

The extension is plain JavaScript with no dependencies and no build step — press <kbd>F5</kbd> to
launch it in an Extension Development Host.

```
npm test
```

The suite stubs the editor API, so it runs on Node alone and needs nothing installed. It covers the
providers and checks the grammar for the failures that are otherwise silent: a pattern that does not
compile, an `#include` that resolves to nothing, and a rule nothing references.

Layout:

| | |
| --- | --- |
| `syntaxes/ghost.tmLanguage.json` | The grammar. |
| `ghost.configuration.json` | Brackets, comments, indentation, folding. |
| `src/api/` | The Ghost and Lumen surfaces, transcribed from the interpreter and the engine. |
| `src/analyzer.js` | Reading a document: symbols, receivers, inference. |
| `src/providers/` | Completion, hover, signature help, outline, semantic tokens. |

When Ghost or Lumen gains a module or method, `src/api/ghost.js` and `src/api/lumen.js` are the files
to edit; everything else reads from them.

## Releasing

A tag is the whole release. Pushing one runs the tests, packages the extension, publishes it, and
cuts the GitHub release carrying the same `.vsix` and the notes already written in the changelog:

```bash
# Add a "## [0.2.0] - YYYY-MM-DD" section to CHANGELOG.md first.
npm version minor
git push --follow-tags
```

`npm version` bumps `package.json`, commits, and tags in one step. The workflow refuses to run if the
tag and the manifest disagree, because the Marketplace treats a version as immutable once taken —
publishing the wrong one under the right name cannot be undone.

A version with a hyphen (`0.2.0-beta.1`) is released as a pre-release to both the Marketplace and
GitHub.

### Tokens

Both are optional. With neither configured a tag still produces a GitHub release with an installable
`.vsix` attached, which is enough to hand the extension to someone.

| Secret | For | |
| --- | --- | --- |
| `VSCE_PAT` | Visual Studio Marketplace | An Azure DevOps token, scoped **Marketplace → Manage** and **all accessible organizations**. Scoping it to one organization produces a token that fails to authenticate. |
| `OVSX_PAT` | [Open VSX](https://open-vsx.org) | What VSCodium, Cursor and the other non-Microsoft builds install from; they cannot reach the Marketplace. |

### By hand

To build a `.vsix` without tagging anything:

```bash
npx @vscode/vsce package
code --install-extension ghost-language-*.vsix
```

## Resources

- https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide
- https://macromates.com/manual/en/language_grammars

## License

[MIT](./LICENSE)

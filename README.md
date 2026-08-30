# Ghost for Visual Studio Code

Visual Studio Code support for the [Ghost](https://ghostlang.org/) programming language, and for
[Lumen](https://github.com/ghost-language/lumen), the 2D game engine games are written against in Ghost.

## Features

### Syntax highlighting

A TextMate grammar covering the whole language as the interpreter actually reads it: every reserved
word, all three comment forms (`//`, `#`, and `/* */`), single- and double-quoted strings with the
escapes the scanner recognises, backtick template literals with `${}` interpolation (nested templates
and nested `{ }` balance correctly), class and trait declarations with `extends`, both method forms,
`switch`/`case`/`default`, `use`, `new`, the import forms, and the full operator set including the
compound assignments, `..`, and `...` spread/rest.

### Completion

Ghost's standard library, and Lumen's, are import-based: only `console` and the global `type()`
function are reachable without one, so completion tracks what a document actually `import`s and offers
members only for that — `math.` before `import "ghost:math"` offers nothing, because at runtime it
would be nothing.

```ghost
import "ghost:math"
import { Spritesheet, Animation } from "lumen:image"

sheet = new Spritesheet('characters.png', 16)
walk  = new Animation(sheet, [4, 5, 6, 7], 0.16)

walk.        # offers Animation's methods, not a generic list
math.        # offers math's members, because this document imported it
```

Writing the `import` itself is completed too: typing `import ca` offers `canvas` and inserts
`"lumen:canvas"`; typing inside an open `"ghost:` or `"lumen:` string completes the module name; and
completing inside `{ }` on a line that already names its module (`import { |} from "lumen:image"`)
offers that module's members and classes, skipping whichever are already listed.

Once imported, a name is completed wherever it is used — `import { sqrt } from "ghost:math"` makes
`sqrt` itself completable as a callable, and an aliased `import "ghost:math" as m` completes `m`, not
`math`. Receivers are also resolved by following assignments through the document, including `new`, so
a variable holding a library value gets the right members even though Ghost is dynamically typed and
nothing is annotated. Where a receiver genuinely cannot be identified it offers every built-in method
there is, each labelled with the types that have it, rather than offering nothing.

Also completed: keywords, the names the file itself declares, `this.` members inside a class or trait,
and — under Lumen — the engine callbacks, inserted as whole function bodies. Callbacks need no import:
they are plain top-level functions the engine finds by name, not module members.

### Hover and signature help

Hover documents modules (under whatever name or alias imported them), their methods and properties,
imported members used bare, global functions, Lumen classes, and built-in methods, resolved through the
same import-aware inference completion uses. A module hovered before it is imported, or after the name
is reassigned to something else, documents nothing — the same thing the interpreter would say. Signature
help shows which argument comes next, which matters most for the drawing calls with long optional tails:

```ghost
sprite.draw(x, y, [rotation, sx, sy, ox, oy])
```

### Outline and navigation

Classes, traits, functions, methods, instance fields and top-level variables appear in the outline,
in breadcrumbs, and in **Go to Symbol in File**, nested the way they are written.

### Semantic highlighting

Layered over the grammar, this resolves what a regular expression cannot. A module access is
highlighted only where the document actually imports it — under its own name, an `as` alias, or through
the combined import form — the same resolution completion and hover use. A name the file assigns to is
that assignment, not an import — writing `image = 3` after `import "lumen:image"` shadows the import,
and the colouring follows. Members are checked against the module they are reached through, so a typo
stops being highlighted.

### Editor behaviour

Indentation rules, bracket colouring, folding, comment toggling, and continuation of block comments
on Enter.

## Lumen

A Lumen game is written in Ghost — `.lumen` is a packaged archive, not a source format — so there is
no second language here. Lumen registers its modules under its own `lumen:` import scheme, the same
mechanism Ghost's own standard library uses under `ghost:`, so a game imports what it needs exactly
the way any other Ghost script does:

```ghost
import "lumen:canvas"
import "lumen:color"
import audio, { Source } from "lumen:audio"
```

Nothing from Lumen is global — not even `canvas` or `window` — so this extension's completion, hover
and highlighting only ever offer a Lumen name where a document actually imported it. That can be
switched off entirely, for a workspace that is plain Ghost with no engine in play:

| Setting | Default | |
| --- | --- | --- |
| `ghost.lumen.enable` | `true` | Include Lumen's modules, classes and callbacks in completion, hover and highlighting. |

Turning it off removes every Lumen module and class from what can be imported and completed, and every
Lumen callback from what is recognised in a top-level `function` declaration. Lumen no longer extends
Ghost's own `math` module the way it once did — everything it used to add there now ships natively in
`ghost:math` itself, imported the same way whether or not Lumen is in play, so this setting has nothing
left to do to `math`.

## Usage

You will need [Visual Studio Code](https://code.visualstudio.com/) >= `1.75`. Install **Ghost** from
the [Marketplace](https://marketplace.visualstudio.com/vscode), or from the command palette
(<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>) with **Install Extension**. Open any `.gs` file.

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

Publishing a GitHub release is the whole release. It runs the tests, packages the extension, pushes
it to the registries, and attaches the `.vsix` to that same release.

1. Bump the version and write the notes:

   ```bash
   # Add a "## [0.2.0] - YYYY-MM-DD" section to CHANGELOG.md.
   npm version minor
   git push --follow-tags
   ```

2. Draft a release on that tag and publish it. Leave the notes blank and the changelog section for
   the version fills them in.

The release is the trigger rather than the tag, because publishing a release creates its tag too —
a workflow listening for tag pushes would fire alongside the release and could only race it.

The run stops before publishing anything if the tag and the manifest disagree, or if the changelog
has no section for the version. The Marketplace treats a version as immutable once taken, so
publishing the wrong one under the right name cannot be undone.

Marking the release a pre-release on GitHub publishes it to the Marketplace's pre-release channel.

To re-run a release that failed partway — a missing token, a registry timeout — use the workflow's
**Run workflow** button with the existing tag. Nothing needs to be retagged, and re-running is safe:
the `.vsix` is replaced rather than added twice, and a version already on the Marketplace fails there
without affecting the rest.

### Tokens

Both are optional. With neither configured a release still gets an installable `.vsix` attached,
which is enough to hand the extension to someone.

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

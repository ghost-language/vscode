const path = require('path');
const Module = require('module');
const HARNESS = __dirname;

// Redirect `require('vscode')` to the stub.
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === 'vscode') return path.join(HARNESS, 'vscode-stub.js');
  return origResolve.call(this, request, ...rest);
};

const vscode = require('./vscode-stub');
const { makeDoc } = require('./document-stub');
const SRC = path.join(__dirname, '..', 'src');

const apiMod = require(SRC + '/api');
const analyzer = require(SRC + '/analyzer');
const { GhostCompletionProvider } = require(SRC + '/providers/completion');
const { GhostHoverProvider } = require(SRC + '/providers/hover');
const { GhostSignatureHelpProvider } = require(SRC + '/providers/signature');
const { GhostDocumentSymbolProvider } = require(SRC + '/providers/symbols');
const { GhostSemanticTokensProvider } = require(SRC + '/providers/semanticTokens');

let pass = 0, fail = 0;
const check = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' :: ' + extra : '')); }
};

const withLumen = () => apiMod.build(true);
const noLumen = () => apiMod.build(false);

// Every module except `console` needs an `import` before it can be used at
// all — Ghost's own standard library and Lumen's modules alike. This fixture
// exercises the bare form, the combined `name, { ... }` form, and a `.gs`
// file import (which the analyzer cannot resolve, and isn't meant to).
const GAME = `import "lumen:canvas"
import "lumen:color"
import "lumen:filesystem"
import image, { Spritesheet, Animation } from "lumen:image"
import Player from 'player'

sheet = new Spritesheet('chars.png', 16)
walk = new Animation(sheet, [4, 5, 6, 7], 0.16)

class Hero extends Actor {
    function constructor(name) {
        this.name = name
        this.hp = 10
    }

    speak() {
        console.log("hi")
    }
}

function load() {
    filesystem.setIdentity('mygame')
}

function update(dt) {
    walk.update(dt)
}

function draw() {
    canvas.setColor(color.white)
    walk.draw(10, 20)
}
`;

console.log('\n== import resolution ==');
{
  const model = withLumen();

  const cases = [
    ['import "ghost:math"', { math: 'module' }],
    ['import "ghost:math" as m', { m: 'module' }],
    ['import { pi, sqrt } from "ghost:math"', { pi: 'member', sqrt: 'member' }],
    ['import pi, sqrt from "ghost:math"', { pi: 'member', sqrt: 'member' }],
    ['import pi as p from "ghost:math"', { p: 'member' }],
    ['import math, { pi } from "ghost:math"', { math: 'module', pi: 'member' }],
    ['import image, { Spritesheet } from "lumen:image"', { image: 'module', Spritesheet: 'class' }],
    ['import { Spritesheet, Animation } from "lumen:image"', { Spritesheet: 'class', Animation: 'class' }],
    ['import * from "ghost:random"', { random: 'member', seed: 'member', currentSeed: 'member' }],
    ['import "helpers"', {}],
    ['import "helpers" as h', {}],
    ['import Player from "player"', {}]
  ];

  for (const [source, expected] of cases) {
    const bindings = analyzer.resolveImports(model, source);

    for (const [name, kind] of Object.entries(expected)) {
      const got = bindings.get(name);
      check(source + ' binds ' + name, Boolean(got) && got.kind === kind, JSON.stringify(got));
    }

    check(source + ' binds exactly the expected names', bindings.size === Object.keys(expected).length, [...bindings.keys()].join(','));
  }
}

console.log('\n== completion: module member ==');
{
  const c = new GhostCompletionProvider(withLumen);
  const doc = makeDoc('import "lumen:canvas"\ncanvas.');
  const items = c.provideCompletionItems(doc, new vscode.Position(1, 7));
  const names = items.map(i => i.label);
  check('offers canvas members', names.includes('filledRectangle') && names.includes('setColor'));
  check('includes canvas properties', names.includes('width'));
  check('excludes other modules\' members', !names.includes('setTitle'));
  const rect = items.find(i => i.label === 'filledRectangle');
  check('signature in detail', rect.detail === 'canvas.filledRectangle(x, y, w, h)', rect.detail);
}

console.log('\n== completion: member access requires import ==');
{
  const c = new GhostCompletionProvider(withLumen);
  const items = c.provideCompletionItems(makeDoc('canvas.'), new vscode.Position(0, 7));
  const names = items.map(i => i.label);
  check('un-imported canvas offers no canvas members', !names.includes('filledRectangle'));
}

console.log('\n== completion: inferred receiver ==');
{
  const c = new GhostCompletionProvider(withLumen);
  const doc = makeDoc(GAME + '\nwalk.');
  const last = GAME.split('\n').length; // line index of 'walk.'
  const items = c.provideCompletionItems(doc, new vscode.Position(last, 5));
  const names = items.map(i => i.label);
  check('walk resolves to Animation', names.includes('isFinished') && names.includes('setSpeed'));
  check('not offering Image methods', !names.includes('drawQuad'));
}

console.log('\n== completion: this. inside class ==');
{
  const c = new GhostCompletionProvider(withLumen);
  const body = GAME.replace('        console.log("hi")', '        this.');
  const doc = makeDoc(body);
  const lineNo = body.split('\n').findIndex(l => l.trim() === 'this.');
  const items = c.provideCompletionItems(doc, new vscode.Position(lineNo, body.split('\n')[lineNo].length));
  const names = items.map(i => i.label);
  check('offers own fields', names.includes('name') && names.includes('hp'), names.join(','));
  check('offers own methods', names.includes('speak'), names.join(','));
}

console.log('\n== completion: unknown receiver falls back ==');
{
  const c = new GhostCompletionProvider(withLumen);
  const doc = makeDoc('mystery.');
  const items = c.provideCompletionItems(doc, new vscode.Position(0, 8));
  const names = items.map(i => i.label);
  check('offers union of methods', names.includes('length') && names.includes('draw'));
  const len = items.find(i => i.label === 'length');
  check('names the owning types', /String/.test(len.detail) && /List/.test(len.detail), len.detail);
}

console.log('\n== completion: globals + callbacks ==');
{
  const c = new GhostCompletionProvider(withLumen);
  const doc = makeDoc('up');
  const items = c.provideCompletionItems(doc, new vscode.Position(0, 2));
  const names = items.map(i => typeof i.label === 'string' ? i.label : i.label.label);
  check('offers keywords', names.includes('function') && names.includes('switch'));
  check('offers the one global module', names.includes('console'));
  check('does not offer modules that need an import', !names.includes('canvas') && !names.includes('math'));
  check('offers the one global function', names.includes('type'));
  check('offers lumen callbacks', names.includes('update') && names.includes('mousepressed'));
  const upd = items.find(i => (typeof i.label === 'object' ? i.label.label : i.label) === 'update' && i.kind === vscode.CompletionItemKind.Event);
  check('callback inserts full body', upd && /function update\(dt\) \{/.test(upd.insertText.value), upd && upd.insertText.value);
}

console.log('\n== completion: names an import already bound ==');
{
  const c = new GhostCompletionProvider(withLumen);
  const doc = makeDoc('import "ghost:math" as m\nimport { sqrt } from "ghost:math"\nx');
  const items = c.provideCompletionItems(doc, new vscode.Position(2, 1));
  const names = items.map(i => i.label);
  check('offers the aliased module', names.includes('m'));
  check('offers the named import as a callable', names.includes('sqrt'));
  const sqrtItem = items.find(i => i.label === 'sqrt');
  check('named import completion documents the real module', /math\.sqrt/.test(sqrtItem.detail), sqrtItem.detail);
}

console.log('\n== completion: import statement ==');
{
  const c = new GhostCompletionProvider(withLumen);

  const doc1 = makeDoc('import ca');
  const items1 = c.provideCompletionItems(doc1, new vscode.Position(0, 9));
  const names1 = items1.map(i => i.label);
  check('offers canvas as an importable module', names1.includes('canvas'));
  const canvasItem = items1.find(i => i.label === 'canvas');
  check('inserts the full scheme path', canvasItem.insertText.value === '"lumen:canvas"', canvasItem.insertText.value);
  check('does not offer the global console module to import', !names1.includes('console'));

  const doc2 = makeDoc('import "ghost:m');
  const items2 = c.provideCompletionItems(doc2, new vscode.Position(0, 15));
  const names2 = items2.map(i => i.label);
  check('offers math inside an open ghost: string', names2.includes('math'));
  check('does not offer lumen modules for the ghost scheme', !names2.includes('canvas'));

  const doc3 = makeDoc('import { pi,  } from "ghost:math"');
  const items3 = c.provideCompletionItems(doc3, new vscode.Position(0, 13));
  const names3 = items3.map(i => i.label);
  check('offers other math members inside the braces', names3.includes('sqrt'));
  check('does not re-offer a name already in the list', !names3.includes('pi'));

  const doc4 = makeDoc('import { Spritesheet,  } from "lumen:image"');
  const items4 = c.provideCompletionItems(doc4, new vscode.Position(0, 22));
  const names4 = items4.map(i => i.label);
  check('offers a sibling class inside the braces', names4.includes('Animation'));
}

console.log('\n== completion: lumen disabled ==');
{
  const c = new GhostCompletionProvider(noLumen);

  const items = c.provideCompletionItems(makeDoc('import ca'), new vscode.Position(0, 9));
  const names = items.map(i => i.label);
  check('no lumen modules to import', !names.includes('canvas') && !names.includes('window'));

  const ghostItems = c.provideCompletionItems(makeDoc('import ma'), new vscode.Position(0, 9)).map(i => i.label);
  check('ghost modules remain importable', ghostItems.includes('math'));

  const upNames = c.provideCompletionItems(makeDoc('x'), new vscode.Position(0, 1))
    .map(i => typeof i.label === 'string' ? i.label : i.label.label);
  check('no lumen callbacks', !upNames.includes('mousepressed'));

  const mathItems = c.provideCompletionItems(makeDoc('import "ghost:math"\nmath.'), new vscode.Position(1, 5)).map(i => i.label);
  check('math keeps its full native surface without lumen', mathItems.includes('abs') && mathItems.includes('clamp') && mathItems.includes('sqrt'));

  const withL = new GhostCompletionProvider(withLumen);
  const mathItemsL = withL.provideCompletionItems(makeDoc('import "ghost:math"\nmath.'), new vscode.Position(1, 5)).map(i => i.label);
  check('math is the same module whether lumen is on or off', mathItemsL.length === mathItems.length, mathItemsL.length + ' vs ' + mathItems.length);
}

console.log('\n== hover ==');
{
  const h = new GhostHoverProvider(withLumen);
  const doc = makeDoc(GAME);
  const lines = GAME.split('\n');

  const ln = lines.findIndex(l => l.includes('canvas.setColor'));
  const hv = h.provideHover(doc, new vscode.Position(ln, lines[ln].indexOf('setColor') + 2));
  check('module method hover', hv && /canvas\.setColor\(color\)/.test(hv.contents.value), hv && hv.contents.value.slice(0, 80));

  const ln2 = lines.findIndex(l => l.includes('walk.draw'));
  const hv2 = h.provideHover(doc, new vscode.Position(ln2, lines[ln2].indexOf('draw') + 1));
  check('inferred receiver hover', hv2 && /Animation\.draw/.test(hv2.contents.value), hv2 && hv2.contents.value.slice(0, 80));

  const ln3 = lines.findIndex(l => l.includes('console.log("hi")'));
  const hv3 = h.provideHover(doc, new vscode.Position(ln3, lines[ln3].indexOf('log') + 1));
  check('global console module method hover', hv3 && /console\.log\(value/.test(hv3.contents.value));

  const hv4 = h.provideHover(makeDoc('import "lumen:canvas"\ncanvas.scale(2)'), new vscode.Position(1, 2));
  check('module name hover', hv4 && /transform stack/.test(hv4.contents.value));

  const hv5 = h.provideHover(makeDoc('x = "a comment print here"'), new vscode.Position(0, 15));
  check('no hover inside a string', !hv5);

  const hv6 = h.provideHover(makeDoc('canvas.scale(2)'), new vscode.Position(0, 2));
  check('un-imported module gives no hover', !hv6);

  const hv7 = h.provideHover(makeDoc('import "ghost:math" as m\nm.pi'), new vscode.Position(1, 0));
  check('aliased module hover resolves the real module', hv7 && /trigonometry/.test(hv7.contents.value), hv7 && hv7.contents.value.slice(0, 140));

  const hv8 = h.provideHover(makeDoc('import { sqrt } from "ghost:math"\nsqrt(4)'), new vscode.Position(1, 1));
  check('imported bare function hover', hv8 && /math\.sqrt/.test(hv8.contents.value), hv8 && hv8.contents.value.slice(0, 80));

  const hv9 = h.provideHover(makeDoc('import { Spritesheet } from "lumen:image"\nSpritesheet'), new vscode.Position(1, 3));
  check('imported bare class hover', hv9 && /grid of equally sized frames/.test(hv9.contents.value), hv9 && hv9.contents.value.slice(0, 80));

  const hv10 = h.provideHover(makeDoc('type(3)'), new vscode.Position(0, 1));
  check('global function hover', hv10 && /type\(value\)/.test(hv10.contents.value));

  const hv11 = h.provideHover(makeDoc('x = "hi"\nx.charAt(0)'), new vscode.Position(1, 3));
  check('inferred string literal hover finds a new core-type method', hv11 && /charAt\(index\)/.test(hv11.contents.value), hv11 && hv11.contents.value.slice(0, 80));

  const hv12 = h.provideHover(makeDoc('import "ghost:date"\nd = date.duration(1, 0, 0)\nd.years()'), new vscode.Position(2, 3));
  check('a value returned by a new date function resolves to the new Duration type', hv12 && /years\(\)/.test(hv12.contents.value), hv12 && hv12.contents.value.slice(0, 80));
}

console.log('\n== signature help ==');
{
  const s = new GhostSignatureHelpProvider(withLumen);

  const doc = makeDoc('import "lumen:canvas"\ncanvas.filledRectangle(1, 2, ');
  const help = s.provideSignatureHelp(doc, new vscode.Position(1, 29));
  check('resolves signature', help && help.signatures[0].label === 'canvas.filledRectangle(x, y, w, h)', help && help.signatures[0].label);
  check('tracks active parameter', help && help.activeParameter === 2, help && String(help.activeParameter));
  check('splits params', help && help.signatures[0].parameters.map(p => p.label).join('|') === 'x|y|w|h');

  const d2 = makeDoc(GAME + '\nwalk.draw(1, 2, 3, ');
  const h2 = s.provideSignatureHelp(d2, new vscode.Position(GAME.split('\n').length, 19));
  check('optional tail expanded', h2 && h2.signatures[0].parameters.map(p => p.label).join('|') === 'x|y|rotation|sx|sy|ox|oy', h2 && h2.signatures[0].parameters.map(p => p.label).join('|'));

  const d3 = makeDoc('import { sqrt } from "ghost:math"\nsqrt(');
  const h3 = s.provideSignatureHelp(d3, new vscode.Position(1, 5));
  check('imported bare function signature help', h3 && h3.signatures[0].label === 'math.sqrt(n)', h3 && h3.signatures[0].label);

  const d4 = makeDoc('canvas.filledRectangle(1, 2, ');
  const h4 = s.provideSignatureHelp(d4, new vscode.Position(0, 29));
  check('no signature help for an un-imported module', !h4);
}

console.log('\n== document symbols ==');
{
  const p = new GhostDocumentSymbolProvider();
  const syms = p.provideDocumentSymbols(makeDoc(GAME));
  const hero = syms.find(s => s.name === 'Hero');
  check('finds class', hero && hero.kind === vscode.SymbolKind.Class);
  check('records superclass', hero && hero.detail === 'extends Actor', hero && hero.detail);
  check('nests methods', hero && hero.children.some(c => c.name === 'speak'));
  check('nests constructor fields', hero && hero.children.some(c => c.children.some(g => g.name === 'hp')));
  check('finds top-level functions', ['load', 'update', 'draw'].every(n => syms.some(s => s.name === n)));
  const inRange = (s) => s.range.contains(s.selectionRange) && s.children.every(inRange);
  check('selection ranges nested in full ranges', syms.every(inRange));
}

console.log('\n== analyzer: template literals & destructuring ==');
{
  // A template literal's own text must not desynchronize brace matching or
  // leak into the rest of the document; its `${ }` interpolation is real
  // code, including a nested map literal's own braces.
  const src = 'x = `count: ${count == 1 ? "one" : `many ${ {a: 1}.a }`}`\ny = 5\n';
  const stripped = analyzer.strip(src);
  const opens = (stripped.match(/\{/g) || []).length;
  const closes = (stripped.match(/\}/g) || []).length;
  check('template literal interpolation braces stay balanced after stripping', opens === closes, opens + ' vs ' + closes);
  check('a template literal does not blank the line after it', /y = 5/.test(stripped));
  check('a quoted string inside an interpolation is still blanked', !stripped.includes('one'));

  const symbols = analyzer.parseSymbols('[a, b] = list\n{x, y} = someMap\n{x: alias} = someMap\n');
  const names = symbols.map((s) => s.name);
  check('list destructuring binds each name', names.includes('a') && names.includes('b'), names.join(','));
  check('map destructuring shorthand binds each key as a name', names.includes('x') && names.includes('y'), names.join(','));
  check('map destructuring with an alias binds the local name, not the key', names.includes('alias') && !names.includes('someMap'), names.join(','));
}

console.log('\n== semantic tokens ==');
{
  const st = new GhostSemanticTokensProvider(withLumen);
  const toks = st.provideDocumentSemanticTokens(makeDoc(GAME)).tokens;
  const kinds = toks.map(t => t.type);
  check('marks module namespaces', kinds.includes('namespace'));
  check('marks module methods', kinds.includes('method'));
  check('marks lumen callbacks', toks.some(t => t.type === 'event'));

  const noImport = st.provideDocumentSemanticTokens(makeDoc('canvas.foo()\n')).tokens;
  check('an un-imported module is not highlighted', noImport.length === 0, JSON.stringify(noImport));

  const shadow = st.provideDocumentSemanticTokens(makeDoc('import "lumen:image"\nimage = 3\nimage.foo()\n')).tokens;
  check('a shadowed import is not a module', shadow.length === 0, JSON.stringify(shadow));

  const bareFn = st.provideDocumentSemanticTokens(makeDoc('import { sqrt } from "ghost:math"\nsqrt(4)\n')).tokens;
  check('marks an imported bare function call', bareFn.some(t => t.type === 'function'), JSON.stringify(bareFn));

  const off = new GhostSemanticTokensProvider(noLumen).provideDocumentSemanticTokens(makeDoc(GAME)).tokens;
  check('no lumen tokens when disabled', !off.some(t => t.type === 'event'));

  const str = st.provideDocumentSemanticTokens(makeDoc('x = "canvas.setColor(1)"\n')).tokens;
  check('nothing marked inside a string', str.length === 0, JSON.stringify(str));
}

console.log('\n== grammar and configuration ==');
{
  const fs = require('fs');
  const root = path.join(__dirname, '..');
  const read = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));

  for (const f of ['package.json', 'ghost.configuration.json', 'syntaxes/ghost.tmLanguage.json']) {
    let ok = true;
    try { read(f); } catch (e) { ok = false; }
    check(f + ' is valid JSON', ok);
  }

  const grammar = read('syntaxes/ghost.tmLanguage.json');

  // Every regex in the grammar must compile, or highlighting silently breaks.
  let invalid = [];
  const patternKeys = ['match', 'begin', 'end'];
  const walkPatterns = (node) => {
    if (Array.isArray(node)) return node.forEach(walkPatterns);
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (patternKeys.includes(k) && typeof v === 'string') {
          try { new RegExp(v); } catch (e) { invalid.push(v); }
        } else walkPatterns(v);
      }
    }
  };
  walkPatterns(grammar);
  check('every grammar pattern compiles', invalid.length === 0, invalid.join(' | '));

  // A mistyped repository key leaves a rule that never fires, which is how the
  // previous grammar lost its punctuation scopes.
  const rules = Object.keys(grammar.repository);
  const missing = new Set();
  const scanIncludes = (node) => {
    if (Array.isArray(node)) return node.forEach(scanIncludes);
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (k === 'include' && typeof v === 'string' && v.startsWith('#') && !rules.includes(v.slice(1))) missing.add(v);
        else scanIncludes(v);
      }
    }
  };
  scanIncludes(grammar);
  check('every #include resolves', missing.size === 0, [...missing].join(', '));

  const serialised = JSON.stringify(grammar);
  const orphans = rules.filter((r) => !serialised.includes('"#' + r + '"'));
  check('no unreferenced grammar rules', orphans.length === 0, orphans.join(', '));

  // Method shorthand and control flow share a shape; only one is a declaration.
  const method = new RegExp(grammar.repository['method-declaration'].begin, 'm');
  check('method shorthand matches', method.test('    speak() {') && method.test('    update(dt) {'));
  check('control flow is not a method', !['if (x) {', 'while (g) {', 'switch (v) {', 'function f() {']
    .some((line) => method.test('    ' + line)));

  // Ghost's scanner has no hex literals, so the grammar must not invent them.
  const number = new RegExp(grammar.repository.numbers.patterns[0].match);
  const whole = (s) => { const m = number.exec(s); return Boolean(m && m[0] === s); };
  check('decimal, fractional and exponent literals', whole('42') && whole('3.14') && whole('1e-5'));
  check('no hex literals', !whole('0x1f'));

  // The keyword list is the interpreter's, not a neighbouring language's.
  const keywords = grammar.repository.keywords.patterns.map((p) => p.match).join(' ');
  check('has Ghost keywords', ['switch', 'trait', 'extends', 'new', 'use', 'from']
    .every((k) => keywords.includes(k) || serialised.includes('\\\\b(' + k + ')')));
  check('no keywords Ghost does not have', !['foreign', '\\\\bis\\\\b', 'static']
    .some((k) => serialised.includes(k)));

  // The scanner takes `#` to end of line as well as `//`.
  const comments = grammar.repository.comments.patterns.map((p) => p.begin);
  check('comment forms', comments.includes('//') && comments.includes('#') && comments.includes('/\\*'));

  // Backtick template literals (§8.10) and `...` spread/rest are real syntax now.
  check('grammar recognises template literals', Boolean(grammar.repository['template-string']) && serialised.includes('string.template.ghost'));
  const spreadOp = grammar.repository.operators.patterns.find((p) => p.name === 'keyword.operator.spread.ghost');
  check('spread/rest is its own operator, not two range dots and a stray accessor', Boolean(spreadOp) && spreadOp.match === '\\.\\.\\.');

  const pkg = read('package.json');
  check('declares an entry point', pkg.main === './src/extension.js');
  check('declares the Lumen setting', Boolean(pkg.contributes.configuration.properties['ghost.lumen.enable']));
  check('registers the .gs extension', pkg.contributes.languages[0].extensions.includes('.gs'));
  check('entry point exists', fs.existsSync(path.join(root, pkg.main)));
  check('grammar path exists', fs.existsSync(path.join(root, pkg.contributes.grammars[0].path)));
  check('language configuration path exists', fs.existsSync(path.join(root, pkg.contributes.languages[0].configuration)));
  for (const icon of Object.values(pkg.contributes.languages[0].icons)) {
    check('icon exists: ' + icon, fs.existsSync(path.join(root, icon)));
  }
}


console.log('\n== release tooling ==');
{
  const fs = require('fs');
  const root = path.join(__dirname, '..');
  const { extract } = require(path.join(root, 'scripts', 'release-notes.js'));
  const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
  const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;

  // The release workflow fails if the version being tagged has no notes. Catch
  // that here instead, while there is still something to do about it.
  const notes = extract(changelog, version);
  check('CHANGELOG has notes for version ' + version, Boolean(notes));
  check('notes stop at the next version', Boolean(notes) && !notes.includes('## ['));

  check('unknown version yields nothing', extract(changelog, '9.9.9') === undefined);
  check('a version is not matched by a prefix of another',
    extract('## [0.1.0] - 2020-01-01\n- a\n', '0.1') === undefined);

  // v0.1.0 shipped with a release-notes.md inside it, because the workflow
  // wrote that file into the workspace and then packaged the workspace.
  // Anything a release step generates has to land outside the checkout.
  const release = fs.readFileSync(path.join(root, '.github', 'workflows', 'release.yml'), 'utf8');

  for (const [what, line] of Object.entries({
    'the packaged .vsix': /vsix=(\S+)/.exec(release) && /vsix=(\S+)/.exec(release)[1],
    'the generated release notes': /release-notes\.js[^\n]*?>\s*(\S+)/.exec(release) && /release-notes\.js[^\n]*?>\s*(\S+)/.exec(release)[1]
  })) {
    check(what + ' is written outside the workspace', Boolean(line) && line.includes('RUNNER_TEMP'), String(line));
  }

  // The release is the trigger. Firing on the tag as well would race the
  // release that created it.
  check('release.yml follows a published release', /^\s*release:\s*$/m.test(release) && release.includes('types: [published]'));
  check('release.yml does not also fire on tags', !/tags:/.test(release));
  check('release.yml attaches to the release rather than creating one',
    release.includes('gh release upload') && !release.includes('gh release create'));

  // A workflow pointing at a file that has moved only fails at release time.
  for (const workflow of ['test.yml', 'release.yml']) {
    const full = path.join(root, '.github', 'workflows', workflow);
    check('workflow exists: ' + workflow, fs.existsSync(full));

    if (!fs.existsSync(full)) continue;

    const body = fs.readFileSync(full, 'utf8');
    for (const referenced of body.match(/\b(?:scripts|src|test)\/[\w./-]+\.js\b/g) || []) {
      check(workflow + ' references an existing file: ' + referenced, fs.existsSync(path.join(root, referenced)));
    }
  }
}


console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

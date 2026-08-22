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

const GAME = `import Player from 'player'

sheet = image.newSpritesheet('chars.png', 16)
walk = sheet.newAnimation([4, 5, 6, 7], 0.16)

class Hero extends Actor {
    function constructor(name) {
        this.name = name
        this.hp = 10
    }

    speak() {
        print("hi")
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

console.log('\n== completion: module member ==');
{
  const c = new GhostCompletionProvider(withLumen);
  const doc = makeDoc('canvas.');
  const items = c.provideCompletionItems(doc, new vscode.Position(0, 7));
  const names = items.map(i => i.label);
  check('offers canvas members', names.includes('filledRectangle') && names.includes('setColor'));
  check('includes canvas properties', names.includes('width'));
  check('excludes other modules\' members', !names.includes('setTitle'));
  const rect = items.find(i => i.label === 'filledRectangle');
  check('signature in detail', rect.detail === 'canvas.filledRectangle(x, y, w, h)', rect.detail);
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
  const body = GAME.replace('        print("hi")', '        this.');
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
  check('offers modules', names.includes('canvas') && names.includes('math'));
  check('offers globals', names.includes('print') && names.includes('type'));
  check('offers lumen callbacks', names.includes('update') && names.includes('mousepressed'));
  const upd = items.find(i => (typeof i.label === 'object' ? i.label.label : i.label) === 'update' && i.kind === vscode.CompletionItemKind.Event);
  check('callback inserts full body', upd && /function update\(dt\) \{/.test(upd.insertText.value), upd && upd.insertText.value);
}

console.log('\n== completion: lumen disabled ==');
{
  const c = new GhostCompletionProvider(noLumen);
  const doc = makeDoc('x');
  const items = c.provideCompletionItems(doc, new vscode.Position(0, 1));
  const names = items.map(i => typeof i.label === 'string' ? i.label : i.label.label);
  check('no lumen modules', !names.includes('canvas') && !names.includes('window'));
  check('ghost modules remain', names.includes('math') && names.includes('console'));
  check('no lumen callbacks', !names.includes('mousepressed'));

  const mathItems = c.provideCompletionItems(makeDoc('math.'), new vscode.Position(0, 5)).map(i => i.label);
  check('math has no lumen extensions', !mathItems.includes('clamp') && !mathItems.includes('lerp'));
  check('math keeps ghost methods', mathItems.includes('abs') && mathItems.includes('pi'));

  const withL = new GhostCompletionProvider(withLumen);
  const mathL = withL.provideCompletionItems(makeDoc('math.'), new vscode.Position(0, 5)).map(i => i.label);
  check('math gains lumen extensions when on', mathL.includes('clamp') && mathL.includes('abs'));
}

console.log('\n== hover ==');
{
  const h = new GhostHoverProvider(withLumen);
  const doc = makeDoc(GAME);
  const lines = GAME.split('\n');

  const ln = lines.findIndex(l => l.includes('canvas.setColor'));
  const hv = h.provideHover(doc, new vscode.Position(ln, lines[ln].indexOf('setColor') + 2));
  check('module method hover', hv && /canvas\.setColor\(color\)/.test(hv.contents.value), hv && hv.contents.value.slice(0,80));

  const ln2 = lines.findIndex(l => l.includes('walk.draw'));
  const hv2 = h.provideHover(doc, new vscode.Position(ln2, lines[ln2].indexOf('draw') + 1));
  check('inferred receiver hover', hv2 && /Animation\.draw/.test(hv2.contents.value), hv2 && hv2.contents.value.slice(0,80));

  const ln3 = lines.findIndex(l => l.includes('print("hi")'));
  const hv3 = h.provideHover(doc, new vscode.Position(ln3, lines[ln3].indexOf('print') + 1));
  check('global function hover', hv3 && /print\(value/.test(hv3.contents.value));

  const hv4 = h.provideHover(makeDoc('canvas.scale(2)'), new vscode.Position(0, 2));
  check('module name hover', hv4 && /transform stack/.test(hv4.contents.value));

  const hv5 = h.provideHover(makeDoc('x = "a comment print here"'), new vscode.Position(0, 15));
  check('no hover inside a string', !hv5);
}

console.log('\n== signature help ==');
{
  const s = new GhostSignatureHelpProvider(withLumen);
  const doc = makeDoc('canvas.filledRectangle(1, 2, ');
  const help = s.provideSignatureHelp(doc, new vscode.Position(0, 29));
  check('resolves signature', help && help.signatures[0].label === 'canvas.filledRectangle(x, y, w, h)', help && help.signatures[0].label);
  check('tracks active parameter', help && help.activeParameter === 2, help && String(help.activeParameter));
  check('splits params', help && help.signatures[0].parameters.map(p=>p.label).join('|') === 'x|y|w|h');

  const d2 = makeDoc(GAME + '\nwalk.draw(1, 2, 3, ');
  const h2 = s.provideSignatureHelp(d2, new vscode.Position(GAME.split('\n').length, 19));
  check('optional tail expanded', h2 && h2.signatures[0].parameters.map(p=>p.label).join('|') === 'x|y|rotation|sx|sy|ox|oy', h2 && h2.signatures[0].parameters.map(p=>p.label).join('|'));
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
  check('finds top-level functions', ['load','update','draw'].every(n => syms.some(s => s.name === n)));
  const inRange = (s) => s.range.contains(s.selectionRange) && s.children.every(inRange);
  check('selection ranges nested in full ranges', syms.every(inRange));
}

console.log('\n== semantic tokens ==');
{
  const st = new GhostSemanticTokensProvider(withLumen);
  const toks = st.provideDocumentSemanticTokens(makeDoc(GAME)).tokens;
  const kinds = toks.map(t => t.type);
  check('marks module namespaces', kinds.includes('namespace'));
  check('marks module methods', kinds.includes('method'));
  check('marks lumen callbacks', toks.some(t => t.type === 'event'));
  check('marks builtin functions', toks.some(t => t.type === 'function'));

  const shadow = st.provideDocumentSemanticTokens(makeDoc('image = 3\nimage.foo()\n')).tokens;
  check('a shadowed module is not a module', shadow.length === 0, JSON.stringify(shadow));

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

  const pkg = read('package.json');
  check('declares an entry point', pkg.main === './src/extension.js');
  check('declares the Lumen setting', Boolean(pkg.contributes.configuration.properties['ghost.lumen.enable']));
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

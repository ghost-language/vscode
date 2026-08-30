const vscode = require('./vscode-stub');
// A TextDocument stand-in with the handful of methods the providers use.
function makeDoc(text) {
  const lines = text.split('\n');
  const starts = []; let acc = 0;
  for (const l of lines) { starts.push(acc); acc += l.length + 1; }
  return {
    getText(range) {
      if (!range) return text;
      return text.slice(this.offsetAt(range.start), this.offsetAt(range.end));
    },
    lineAt: (n) => ({ text: lines[n] }),
    offsetAt: (p) => starts[p.line] + p.character,
    positionAt(off) {
      let line = 0;
      while (line + 1 < starts.length && starts[line + 1] <= off) line++;
      return new vscode.Position(line, off - starts[line]);
    },
    getWordRangeAtPosition(pos, re) {
      const l = lines[pos.line];
      const pattern = re || /[A-Za-z_]\w*/;
      const g = new RegExp(pattern.source, 'g');
      let m;
      while ((m = g.exec(l)) !== null) {
        if (m.index <= pos.character && pos.character <= m.index + m[0].length) {
          return new vscode.Range(pos.line, m.index, pos.line, m.index + m[0].length);
        }
      }
      return undefined;
    },
    uri: { toString: () => 'file:///test.gs' }
  };
}
module.exports = { makeDoc };

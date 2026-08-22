// Minimal stand-in for the VS Code API, enough to exercise the providers.
class Position { constructor(line, character){ this.line=line; this.character=character; } }
class Range {
  constructor(a,b,c,d){
    if (a instanceof Position){ this.start=a; this.end=b; }
    else { this.start=new Position(a,b); this.end=new Position(c,d); }
  }
  contains(o){
    const ge=(p,q)=>p.line>q.line||(p.line===q.line&&p.character>=q.character);
    return ge(o.start,this.start)&&ge(this.end,o.end);
  }
}
class MarkdownString {
  constructor(v){ this.value=v||''; }
  appendMarkdown(v){ this.value+=v; return this; }
  appendCodeblock(v,l){ this.value+='\n```'+(l||'')+'\n'+v+'\n```\n'; return this; }
}
class SnippetString { constructor(v){ this.value=v; } }
class CompletionItem { constructor(label,kind){ this.label=label; this.kind=kind; } }
class SignatureHelp { constructor(){ this.signatures=[]; } }
class SignatureInformation { constructor(label){ this.label=label; this.parameters=[]; } }
class ParameterInformation { constructor(label){ this.label=label; } }
class DocumentSymbol {
  constructor(name,detail,kind,range,selectionRange){
    Object.assign(this,{name,detail,kind,range,selectionRange,children:[]});
  }
}
class Hover { constructor(contents,range){ this.contents=contents; this.range=range; } }
class SemanticTokensLegend {
  constructor(tokenTypes,tokenModifiers){ this.tokenTypes=tokenTypes; this.tokenModifiers=tokenModifiers; }
}
class SemanticTokensBuilder {
  constructor(legend){ this.legend=legend; this.tokens=[]; }
  push(line,char,length,type,mods){ this.tokens.push({line,char,length,type:this.legend.tokenTypes[type],mods}); }
  build(){ return { tokens:this.tokens }; }
}
class EventEmitter { constructor(){ this.event=()=>({dispose(){}}); } fire(){} dispose(){} }

const enumOf = (...names) => Object.fromEntries(names.map((n,i)=>[n,i]));

module.exports = {
  Position, Range, MarkdownString, SnippetString, CompletionItem,
  SignatureHelp, SignatureInformation, ParameterInformation,
  DocumentSymbol, Hover, SemanticTokensLegend, SemanticTokensBuilder, EventEmitter,
  CompletionItemKind: enumOf('Text','Method','Function','Constructor','Field','Variable','Class','Interface','Module','Property','Unit','Value','Enum','Keyword','Snippet','Color','File','Reference','Folder','EnumMember','Constant','Struct','Event','Operator','TypeParameter'),
  SymbolKind: enumOf('File','Module','Namespace','Package','Class','Method','Property','Field','Constructor','Enum','Interface','Function','Variable','Constant','String','Number','Boolean','Array'),
  languages: new Proxy({}, { get: () => () => ({ dispose(){} }) }),
  workspace: {
    getConfiguration: () => ({ get: (_k, d) => d }),
    onDidChangeConfiguration: () => ({ dispose(){} })
  },
  window: { activeTextEditor: undefined }
};

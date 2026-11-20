'use strict';
const {availableApi}=require('./api-catalog');
const {lex,callContext,parameters,compilerArgumentMessage,missingDigitalWrite,advisoryFindings}=require('./authoring-core');
const {compilerEdits,installPreview,textOffset}=require('./edit-preview');
const {explain}=require('./core');
function installAuthoring(vscode,options,selector) {
  const disposables=[],preview=installPreview(vscode);disposables.push(preview);
  const eligible=d=>d?.uri.scheme==='file'&&options.isSketch(d);
  const request=async(d,method,params,token)=>{
    if(!eligible(d)||token?.isCancellationRequested)return;
    const version=d.version;let timer;
    try {
      const result=await Promise.race([options.languageRequest?.(d,method,params,token),new Promise(resolve=>{timer=setTimeout(resolve,5000);timer.unref?.();})]);
      return d.version===version&&!token?.isCancellationRequested?result:undefined;
    } catch(error) {if(method==='textDocument/codeAction')options.log?.('获取修复建议失败：'+(error.stack||error));return;} finally {clearTimeout(timer);}
  };
  const signature=vscode.languages.registerSignatureHelpProvider(selector,{
    async provideSignatureHelp(document,position,token){
      if(!eligible(document))return;
      const version=document.version;
      const ctx=callContext(document.getText(),document.offsetAt(position));if(!ctx)return;
      const native=await request(document,'textDocument/signatureHelp',{position},token);
      if(token?.isCancellationRequested||document.version!==version)return;
      const item=!ctx.member&&availableApi(options.fqbn()).find(x=>x.name===ctx.name);
      if(item){
        // A matching user declaration has its own semantics; use native help.
        if(new RegExp('\\b(?:void|int|bool|float|double|auto)\\s+'+ctx.name+'\\s*\\(').test(lex(document.getText()).mask))return native?.value;
        const info=new vscode.SignatureInformation(item.signature,new vscode.MarkdownString(item.description));
        info.parameters=parameters(item).map(p=>new vscode.ParameterInformation(p.label,new vscode.MarkdownString(p.description)));
        if(native?.value?.signatures?.length) {
          // Core APIs may have optional overloads; retain true signatures.
          for(const s of native.value.signatures){s.documentation=info.documentation;for(let i=0;i<s.parameters.length;i++)if(info.parameters[i])s.parameters[i].documentation=info.parameters[i].documentation;}
          native.value.activeParameter??=Math.min(ctx.argument,Math.max(0,native.value.signatures[native.value.activeSignature||0].parameters.length-1));
          return native.value;
        }
        const help=new vscode.SignatureHelp();help.signatures=[info];help.activeSignature=0;help.activeParameter=Math.min(ctx.argument,Math.max(0,info.parameters.length-1));return help;
      }
      return native?.value;
    }
  },'(',',');disposables.push(signature);
  const completion=vscode.languages.registerCompletionItemProvider(selector,{
    async provideCompletionItems(document,position,token,context){
      if(!eligible(document)||lex(document.getText().slice(0,document.offsetAt(position))).kind)return [];
      const version=document.version;
      const before=document.lineAt(position.line).text.slice(0,position.character);
      if(/^\s*#/.test(before))return []; // Leave include-path completion to the IDE.
      const member=/(?:\.|->)\s*\w*$/.test(before);
      const response=await request(document,'textDocument/completion',{position,context:{triggerKind:context?.triggerKind||1,...(context?.triggerCharacter?{triggerCharacter:context.triggerCharacter}:{})}},token);
      if(document.version!==version||token?.isCancellationRequested)return [];
      const native=Array.isArray(response?.value)?response.value:response?.value?.items||[];
      if(member)return native;
      const ctx=callContext(document.getText(),document.offsetAt(position));
      const item=ctx&&!ctx.member&&availableApi(options.fqbn()).find(x=>x.name===ctx.name);
      const param=item&&parameters(item)[ctx.argument];
      for(const entry of native){
        const name=typeof entry.label==='string'?entry.label:entry.label.label;
        const core=!ctx&&availableApi(options.fqbn()).find(a=>a.name===(entry.filterText||name.trim().replace(/\(.*/,'')));
        if(core)entry.documentation=new vscode.MarkdownString(core.description);
        if(param && /pin|interrupt/i.test(param.label) && [vscode.CompletionItemKind.Variable,vscode.CompletionItemKind.Constant].includes(entry.kind)){
          entry.sortText=(/pin|led|button|key|buzzer|trig|echo/i.test(name)?'00':'01')+name;
          entry.documentation=new vscode.MarkdownString(`当前工程可见变量；填写 ${item.name} 的 ${param.label}。\n\n${param.description}`);
        }
      }
      const choices=ctx?.name==='digitalWrite'&&ctx.argument===1?['HIGH','LOW']:ctx?.name==='pinMode'&&ctx.argument===1?['OUTPUT','INPUT','INPUT_PULLUP']:[];
      const extras=choices.map(name=>{const c=new vscode.CompletionItem(name,vscode.CompletionItemKind.Constant);c.sortText='00'+name;c.detail=param?.description;return c;});
      // Native declarations retain scope and types. Only add curated global APIs
      // that are not already supplied; do not manufacture library methods.
      const labels=new Set(native.map(x=>typeof x.label==='string'?x.label:x.label.label));
      for(const api of availableApi(options.fqbn()))if(!ctx&&!labels.has(api.name)){
        const c=new vscode.CompletionItem(api.name,vscode.CompletionItemKind.Function);
        c.detail=`Arduino 中文说明 · ${api.signature}`;c.documentation=new vscode.MarkdownString(api.description);c.insertText=new vscode.SnippetString(api.snippet);extras.push(c);
      }
      return [...extras,...native.filter(n=>!choices.includes(typeof n.label==='string'?n.label:n.label.label))];
    }
  },'.','>','(',',');disposables.push(completion);
  async function fixes(document,range,token) {
    if(!eligible(document))return [];
    const version=document.version, records=options.diagnostics?.(document)||[];
    const relevant=records.filter(r=>new vscode.Range(r.display.start.line,r.display.start.character,r.display.end.line,r.display.end.character).intersection(range));
    const result=[];
    for(const record of relevant.slice(0,3)){
      const r=await request(document,'textDocument/codeAction',{range:record.protocol.range,context:{diagnostics:[record.protocol],only:['quickfix']}},token);
      if(document.version!==version)return [];
      for(const f of compilerEdits(r?.raw,r?.protocolUri,version))result.push({title:'预览修复：'+f.title,reason:'修改来自当前工程的编译器建议。原始建议：'+f.compilerTitle,edits:f.edits});
      const missing=missingDigitalWrite(document.getText(),textOffset(document.getText(),record.protocol.range.start),compilerArgumentMessage(record.protocol));
      if(missing)for(const level of ['HIGH','LOW'])result.push({title:`预览：补充 ${level}（${level==='HIGH'?'高':'低'}电平）`,reason:'HIGH 是高电平，LOW 是低电平，不能直接等同于开/关。请按接线和模块的有效电平选择。',edits:[{range:{start:document.positionAt(missing.end-1),end:document.positionAt(missing.end-1)},newText:', '+level}]});
    }
    return result.map(f=>{
      const action=new vscode.CodeAction(f.title,vscode.CodeActionKind.QuickFix);
      action.command={title:f.title,command:'arduinoLive.previewFix',arguments:[{...f,uri:document.uri.toString(),version}]};return action;
    });
  }
  disposables.push(vscode.languages.registerCodeActionsProvider(selector,{
    provideCodeActions:(document,range,_context,token)=>fixes(document,range,token)
  },{providedCodeActionKinds:[vscode.CodeActionKind.QuickFix]}));
  const suggestions=vscode.languages.createDiagnosticCollection('arduino-live-learning');
  const timers=new Map();
  function schedule(document){
    clearTimeout(timers.get(document.uri.toString()));
    if(!eligible(document))return;
    const timer=setTimeout(()=>{
      timers.delete(document.uri.toString());
      const enabled=vscode.workspace.getConfiguration('arduinoLive',document.uri).get('learningSuggestions',true);
      suggestions.set(document.uri,enabled?advisoryFindings(document.getText()).map(f=>{
        const d=new vscode.Diagnostic(new vscode.Range(document.positionAt(f.start),document.positionAt(f.start+f.length)),f.message,vscode.DiagnosticSeverity.Information);
        d.code=f.code;d.source='Arduino 学习建议';return d;
      }):[]);
    },300);timer.unref?.();timers.set(document.uri.toString(),timer);
  }
  disposables.push(suggestions,vscode.workspace.onDidChangeTextDocument(e=>schedule(e.document)),vscode.workspace.onDidOpenTextDocument(schedule),vscode.workspace.onDidCloseTextDocument(d=>{clearTimeout(timers.get(d.uri.toString()));timers.delete(d.uri.toString());suggestions.delete(d.uri);}),vscode.workspace.onDidChangeConfiguration(e=>{if(e.affectsConfiguration('arduinoLive.learningSuggestions'))for(const d of vscode.workspace.textDocuments)schedule(d);}));
  for(const document of vscode.workspace.textDocuments)schedule(document);
  disposables.push({dispose(){for(const t of timers.values())clearTimeout(t);timers.clear();}});
  return {preview:preview.preview,async showFixes(){
    const editor=vscode.window.activeTextEditor;
    const document=eligible(editor?.document)?editor.document:options.document?.();
    if(!eligible(document)){await vscode.window.showInformationMessage('请先打开需要修复的 Arduino 代码。');return;}
    let actions=eligible(editor?.document)?await fixes(document,editor.selection):[];
    if(!actions.length){
      const records=options.diagnostics?.(document)||[],version=document.version;
      if(records.length){
        const selected=await vscode.window.showQuickPick(records.map(record=>({label:`第 ${record.display.start.line+1} 行：${explain(compilerArgumentMessage(record.protocol))||record.protocol.message}`,record})),{title:'选择当前文档中要修复的问题'});
        if(!selected)return;
        if(document.version!==version){await vscode.window.showInformationMessage('代码已变化，请重新获取修改建议。');return;}
        const range=selected.record.display;
        actions=await fixes(document,new vscode.Range(range.start.line,range.start.character,range.end.line,range.end.character));
      }
    }
    if(!actions.length){await vscode.window.showInformationMessage('当前位置没有可预览的明确修复。请把光标放在错误红线上，或先修复前面的语法错误。');return;}
    const chosen=await vscode.window.showQuickPick(actions.map(a=>({label:a.title,action:a})),{title:'选择修改并预览差异'});
    if(chosen)await vscode.commands.executeCommand(chosen.action.command.command,...chosen.action.command.arguments);
  },dispose(){disposables.forEach(d=>d.dispose());}};
}
module.exports={installAuthoring};

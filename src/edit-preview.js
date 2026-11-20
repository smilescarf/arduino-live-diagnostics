'use strict';
function applyTextEdits(document, edits) {
  const text=document.getText();
  const changes=edits.map(e=>{
    if(typeof e.newText!=='string')throw Error('无效修改内容');
    const start=document.offsetAt(e.range.start),end=document.offsetAt(e.range.end);
    const valid=p=>{const q=document.positionAt(document.offsetAt(p));return q.line===p.line&&q.character===p.character;};
    if(!valid(e.range.start)||!valid(e.range.end)||end<start)throw Error('修改位置已失效');
    return {start,end,text:e.newText};
  }).sort((a,b)=>b.start-a.start||b.end-a.end);
  let previous=text.length+1,result=text;
  for(const c of changes){if(c.end>previous)throw Error('修改范围相互重叠');result=result.slice(0,c.start)+c.text+result.slice(c.end);previous=c.start;}
  return result;
}
function installPreview(vscode) {
  const previews=new Map(); let id=0;
  const content=vscode.workspace.registerTextDocumentContentProvider('arduino-live-preview',{provideTextDocumentContent:uri=>previews.get(uri.toString())||''});
  async function preview(change) {
    const document=await vscode.workspace.openTextDocument(vscode.Uri.parse(change.uri));
    if(document.version!==change.version){await vscode.window.showInformationMessage('代码已变化，请重新获取修改建议。');return false;}
    const before=document.getText(),after=applyTextEdits(document,change.edits);
    if(before===after)return false;
    const left=vscode.Uri.parse(`arduino-live-preview:/before-${++id}.cpp`),right=vscode.Uri.parse(`arduino-live-preview:/after-${id}.cpp`);
    previews.set(left.toString(),before);previews.set(right.toString(),after);
    while(previews.size>20)previews.delete(previews.keys().next().value);
    await vscode.commands.executeCommand('vscode.diff',left,right,`${change.title} · 左侧原文 / 右侧建议`);
    const choice=await vscode.window.showInformationMessage(`${change.title}：请先查看差异。${change.reason||''}`, '应用修改', '取消');
    if(choice!=='应用修改')return false;
    if(document.version!==change.version||document.getText()!==before){await vscode.window.showInformationMessage('预览期间代码已变化，修改未应用，请重新获取建议。');return false;}
    const edit=new vscode.WorkspaceEdit();edit.replace(document.uri,new vscode.Range(document.positionAt(0),document.positionAt(before.length)),after);
    const applied=await vscode.workspace.applyEdit(edit);
    if(applied)await vscode.window.showTextDocument(document,{preview:false});
    return applied; // No save or upload.
  }
  const command=vscode.commands.registerCommand('arduinoLive.previewFix',preview);
  return {preview,dispose(){command.dispose();content.dispose();previews.clear();}};
}
function compilerEdits(actions, uri, version) {
  const found=[];
  for(const action of actions||[]){
    if(action.disabled)continue;
    const command=action.command;
    const edits=[action.edit,...(command?.command==='clangd.applyFix'?command.arguments||[]:[])].filter(Boolean);
    for(const edit of edits){
      const docs=[...Object.entries(edit.changes||{}).map(([key,edits])=>({textDocument:{uri:key},edits})),...(edit.documentChanges||[])];
      if(!docs.length||docs.some(d=>d.textDocument?.uri!==uri||!Array.isArray(d.edits)||(typeof d.textDocument.version==='number'&&d.textDocument.version!==version)))continue;
      const changes=docs.flatMap(d=>d.edits);
      const rename=/(?:change|replace) ['‘]([^'’]+)['’] (?:to|with) ['‘]([^'’]+)['’]/i.exec(action.title||'');
      const title=changes.length===1&&changes[0].newText.trim()===';'?'补充分号':rename?`将“${rename[1]}”改为“${rename[2]}”`:'按编译器建议修改';
      if(changes.length)found.push({title,compilerTitle:action.title||'',edits:changes});
    }
  }
  return found.filter((f,i,a)=>a.findIndex(x=>JSON.stringify(x.edits)===JSON.stringify(f.edits))===i);
}
module.exports={applyTextEdits,compilerEdits,installPreview};

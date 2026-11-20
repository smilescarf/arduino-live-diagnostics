'use strict';
const {lex}=require('./authoring-core');
const replacements={'（':'(', '）':')', '［':'[', '］':']', '｛':'{', '｝':'}', '；':';', '，':',', '：':':'};
function positionAt(text,offset){const lines=text.slice(0,offset).split(/\r\n|\r|\n/);return {line:lines.length-1,character:lines.at(-1).length};}
function punctuationPlan(text,range){
  if(!Number.isInteger(range?.start?.line))return;
  const mask=lex(text).mask,lines=mask.split(/\r\n|\r|\n/),line=range.start.line;
  let previous=line-1;while(previous>=0&&line-previous<8&&!lines[previous]?.trim())previous--;
  const first=Math.max(0,previous),last=Math.min(lines.length-1,(range.end?.line??line)+1);
  const headerSpans=[...mask.matchAll(/^[ \t]*#[ \t]*include[ \t]*<[^>\r\n]*>/gm)].map(m=>({start:m.index,end:m.index+m[0].length}));
  const edits=[],symbols=[];
  for(const match of mask.matchAll(/[（）［］｛｝；，：]/g)){
    if(headerSpans.some(h=>match.index>=h.start&&match.index<h.end))continue;
    const start=positionAt(text,match.index);if(start.line<first||start.line>last)continue;
    const from=match[0],to=replacements[from];symbols.push({from,to,start});
    edits.push({range:{start,end:{line:start.line,character:start.character+1}},newText:to});
  }
  if(!edits.length)return;
  const mapping=[...new Set(symbols.map(s=>`“${s.from}” → “${s.to}”`))].join('，');
  return {edits,symbols,preferred:true,title:'将代码中的全角语法符号改为半角',reason:`相邻代码中存在全角语法符号：${mapping}。先修正这些符号并重新检查，避免按连带错误增删分号。字符串和注释不做替换。`};
}
module.exports={punctuationPlan};

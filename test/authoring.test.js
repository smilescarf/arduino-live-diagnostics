'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {lex,callContext,parameters,missingDigitalWrite,advisoryFindings}=require('../src/authoring-core');
const {planFragment}=require('../src/code-fragments');
const {textOffset,applyTextEdits,compilerEdits,installPreview}=require('../src/edit-preview');
const {availableApi}=require('../src/api-catalog');
const {installAuthoring}=require('../src/authoring');
class Range {
 constructor(a,b,c,d){this.start=typeof a==='number'?{line:a,character:b}:a;this.end=typeof a==='number'?{line:c,character:d}:b;}
 intersection(){return this;}
}
function document(text){
 return {text,version:1,uri:{scheme:'file',toString:()=> 'file:///probe.ino'},getText(){return this.text;},
 offsetAt(p){const lines=this.text.split('\n');return Math.min(this.text.length,lines.slice(0,Math.max(0,p.line)).reduce((n,l)=>n+l.length+1,0)+Math.max(0,p.character));},
 positionAt(n){const s=this.text.slice(0,n).split('\n');return {line:s.length-1,character:s.at(-1).length};},
 lineAt(n){return {text:this.text.split('\n')[n]||''};}};
}
test('参数索引识别嵌套调用、数组和字符串中的逗号；注释/未闭合字符串不触发',()=>{
 assert.equal(callContext('map(values[call(1, 2)], 0, 4095, 0, ')?.argument,4);
 assert.equal(callContext('digitalWrite(pin, constrain(a, 0, ')?.name,'constrain');
 assert.equal(callContext('digitalWrite(pin, "a,b", ')?.argument,2);
 assert.equal(callContext('// digitalWrite('),undefined);
 assert.equal(callContext('Serial.print("digitalWrite('),undefined);
 assert.equal(callContext('R"HTML(foo(,bar)HTML"; digitalWrite(')?.name,'digitalWrite');
 assert.equal(lex('/* 注释😀 */\nfoo').mask.length,'/* 注释😀 */\nfoo'.length);
 const map=availableApi('arduino:avr:uno').find(a=>a.name==='map');assert.match(parameters(map)[2].description,/1023/);
});
test('缺参解释需要真实编译器诊断，不猜测自定义函数、成员方法或嵌套调用',()=>{
 const code='// 😀 中文\nvoid loop(){ digitalWrite(LED_PIN); }';const p=code.indexOf('digitalWrite');
 assert.match(missingDigitalWrite(code,p,'Too few arguments to function call')?.message,/第 2 个参数/);
 assert.match(missingDigitalWrite(code,p,'No matching function for call to digitalWrite\nCandidate function not viable: requires 2 arguments, but 1 was provided')?.message,/HIGH/);
 assert.equal(missingDigitalWrite(code,p,'undeclared identifier'),undefined);
 assert.equal(missingDigitalWrite('void digitalWrite(int p){}\ndigitalWrite(1);',40,'Too few arguments'),undefined);
 assert.equal(missingDigitalWrite('device.digitalWrite(1);',10,'Too few arguments'),undefined);
 assert.equal(missingDigitalWrite('digitalWrite(foo(1,2),HIGH);',0,'Too few arguments'),undefined);
});
test('片段只合并明确的 setup/loop，重复插入避开已有变量，保留 CRLF 与用户代码',()=>{
 const initial='// 原有代码\r\nvoid setup(){ pinMode(8, OUTPUT); }\r\nvoid loop(){ digitalWrite(8,HIGH); }\r\n';
 const first=planFragment(initial,'Button',4).after;
 assert.match(first,/aldButtonPin = 4/);assert.match(first,/pinMode\(8, OUTPUT\)/);assert.match(first,/digitalWrite\(8,HIGH\)/);
 const second=planFragment(first,'Button',5).after;assert.match(second,/aldButton2Pin = 5/);
 assert.equal(second.replace(/\r\n/g,'').includes('\n'),false);
 assert.throws(()=>planFragment('void setup(){}\nvoid loop(){return;}','Timer'),/return/);
 assert.throws(()=>planFragment('#if X\nvoid setup(){}\nvoid loop(){}\n#endif','Timer'),/条件编译/);
 assert.throws(()=>planFragment('void setup(){}\nvoid loop(){','Timer'),/未闭合/);
});
test('学习提醒跳过注释和原始字符串，仅标记实际 loop 延时、字面量整数除法和中断内串口',()=>{
 const text='const char *html=R"HTML(void loop(){delay(999);})HTML";\nvoid onKey(){Serial.println(1);}\nvoid setup(){attachInterrupt(digitalPinToInterrupt(4),onKey,CHANGE);}\nvoid loop(){// delay(999);\n delay(500);float half=1/2;float real=1.0/2;}';
 assert.deepEqual(advisoryFindings(text).map(x=>x.code),['isr-work','blocking-delay','integer-division']);
 assert.equal(advisoryFindings('void demo(){ delay(999); }').length,0);
});
test('修复拒绝跨文件、资源操作、旧版本和重叠范围；正确处理中文 UTF-16 位置',()=>{
 const d=document('中文😀x');const edits=[{range:{start:{line:0,character:4},end:{line:0,character:5}},newText:'y'}];
 assert.equal(applyTextEdits(d,edits),'中文😀y');assert.throws(()=>applyTextEdits(d,[...edits,...edits]),/重叠/);
 const uri=d.uri.toString();
 assert.equal(compilerEdits([{edit:{changes:{[uri]:edits,'file:///other.h':edits}}}],uri,1).length,0);
 assert.equal(compilerEdits([{edit:{documentChanges:[{kind:'create',uri}]}}],uri,1).length,0);
 assert.equal(compilerEdits([{edit:{documentChanges:[{textDocument:{uri,version:0},edits}]}}],uri,1).length,0);
 assert.equal(compilerEdits([{command:{command:'clangd.applyFix',arguments:[{changes:{[uri]:edits}}]}}],uri,1).length,1);
});
test('预览期间继续输入时不应用旧修改；取消和应用都不保存文档',async()=>{
 const d=document('int x=0'),state={applied:0,choice:'应用修改',changeDuringPreview:true};
 const noop=()=>({dispose(){}});
 const vscode={Uri:{parse:s=>({toString:()=>s})},Range,WorkspaceEdit:class {replace(){}},
 workspace:{registerTextDocumentContentProvider:noop,openTextDocument:async()=>d,applyEdit:async()=>{state.applied++;return true;}},
 commands:{registerCommand:noop,executeCommand:async()=>{if(state.changeDuringPreview){d.text+=';';d.version++;}}},
 window:{showInformationMessage:async()=>state.choice,showTextDocument:async()=>{}}};
 const p=installPreview(vscode);const change=()=>({uri:d.uri.toString(),version:d.version,title:'补分号',edits:[{range:{start:d.positionAt(d.text.length),end:d.positionAt(d.text.length)},newText:';'}]});
 assert.equal(await p.preview(change()),false);assert.equal(state.applied,0);
 state.changeDuringPreview=false;state.choice='取消';assert.equal(await p.preview(change()),false);
 state.choice='应用修改';assert.equal(await p.preview(change()),true);assert.equal(state.applied,1);p.dispose();
});
function authoringHost(response,overrides={}){
 const providers={},noop=()=>({dispose(){}});
 const vscode={Range,CodeActionKind:{QuickFix:'quickfix'},CompletionItemKind:{Variable:5,Constant:20,Function:2},
 CompletionItem:class{constructor(label,kind){this.label=label;this.kind=kind;}},MarkdownString:class{constructor(value){this.value=value;}},SnippetString:class{constructor(value){this.value=value;}},
 CodeAction:class{constructor(title,kind){this.title=title;this.kind=kind;}},
 SignatureInformation:class{constructor(label,documentation){this.label=label;this.documentation=documentation;}},ParameterInformation:class{constructor(label,documentation){this.label=label;this.documentation=documentation;}},SignatureHelp:class{},
 workspace:{textDocuments:[],registerTextDocumentContentProvider:noop,onDidChangeTextDocument:noop,onDidOpenTextDocument:noop,onDidCloseTextDocument:noop,onDidChangeConfiguration:noop},
 commands:{registerCommand:noop},languages:{registerSignatureHelpProvider:(_s,p)=>{providers.signature=p;return noop();},registerCompletionItemProvider:(_s,p)=>{providers.completion=p;return noop();},registerCodeActionsProvider:(_s,p)=>{providers.fixes=p;return noop();},createDiagnosticCollection:noop}};
 const authoring=installAuthoring(vscode,{isSketch:()=>true,fqbn:()=> 'arduino:avr:uno',languageRequest:response,...overrides},[]);
 return {providers,authoring,vscode};
}
test('成员补全保留编译器语义结果，引脚变量优先，切板不返回 ESP32 API，旧版本结果被丢弃',async()=>{
 const h=authoringHost(async()=>({value:[{label:'LED_PIN',kind:5},{label:'counter',kind:5}]}));
 const d=document('digitalWrite(');const c=await h.providers.completion.provideCompletionItems(d,d.positionAt(d.text.length));assert.equal(c.find(x=>x.label==='LED_PIN').sortText,'00LED_PIN');assert.ok(!c.some(x=>x.label==='ledcAttach'));
 const member=document('servo.');const methods=await h.providers.completion.provideCompletionItems(member,member.positionAt(6));assert.equal(methods.length,2,'只返回语义引擎给出的成员，不能混入全局函数');
 const help=await h.providers.signature.provideSignatureHelp(d,d.positionAt(d.text.length));assert.match(help.signatures[0].parameters[1].documentation.value,/HIGH/);
 h.authoring.dispose();
 const stale=authoringHost(async(doc)=>{doc.version++;return {value:[{label:'old'}]};});assert.deepEqual(await stale.providers.completion.provideCompletionItems(d,d.positionAt(d.text.length)),[]);stale.authoring.dispose();
});
module.exports={document};

class StrictPosition {constructor(line,character){this.line=line;this.character=character;}}
function strictDocument(text){
 const d=document(text),offset=d.offsetAt.bind(d),position=d.positionAt.bind(d);
 d.offsetAt=p=>{if(!(p instanceof StrictPosition))throw Error('Invalid argument');return offset(p);};
 d.positionAt=n=>{const p=position(n);return new StrictPosition(p.line,p.character);};return d;
}
test('Theia 严格 Position 校验：JSON 修复位置、中文及 CRLF 不触发 Invalid argument',()=>{
 const d=strictDocument('// 中文😀\r\nint value=0\r\n');
 assert.throws(()=>d.offsetAt({line:1,character:11}),/Invalid argument/);
 const edits=JSON.parse(JSON.stringify([{range:{start:d.positionAt(d.text.indexOf('0')+1),end:d.positionAt(d.text.indexOf('0')+1)},newText:';'}]));
 assert.equal(applyTextEdits(d,edits),'// 中文😀\r\nint value=0;\r\n');
 assert.equal(textOffset(d.text,{line:1,character:0}),d.text.indexOf('int'));
 assert.throws(()=>textOffset(d.text,{line:1,character:12}),/位置已失效/);
});
test('快速修复遵循四参数宿主回调，并且菜单使用同一路径处理纯 JSON 诊断',async()=>{
 const d=strictDocument('digitalWrite(LED_PIN);'),range=new Range(0,0,0,20),token={isCancellationRequested:false};
 const record={display:range,protocol:{message:'Too few arguments to function call, expected 2, have 1',range:{start:{line:0,character:0},end:{line:0,character:12}}}};
 let passedToken,executed;
 const h=authoringHost(async(_d,_method,_params,t)=>{passedToken=t;return {raw:[],protocolUri:d.uri.toString()};},{diagnostics:()=>[record],document:()=>d});
 const actions=await h.providers.fixes.provideCodeActions(d,range,{diagnostics:[]},token);
 assert.equal(passedToken,token);assert.equal(actions.length,2);assert.match(actions[0].title,/HIGH/);
 h.vscode.window={activeTextEditor:{document:d,selection:range},showQuickPick:async choices=>choices[0]};
 h.vscode.commands.executeCommand=async(...args)=>{executed=args;};
 await h.authoring.showFixes();assert.equal(executed[0],'arduinoLive.previewFix');
 const transfer=JSON.parse(JSON.stringify(executed[1]));assert.equal(applyTextEdits(d,transfer.edits),'digitalWrite(LED_PIN, HIGH);');h.authoring.dispose();
});
test('高低电平说明不推断开关状态，预览焦点下仍可从原文选择问题并修复',async()=>{
 const api=availableApi('arduino:avr:uno').find(a=>a.name==='digitalWrite');
 assert.match(parameters(api)[1].description,/LOW.*低电平/);assert.doesNotMatch(parameters(api)[1].description,/HIGH 点亮|LOW 关闭/);
 const d=strictDocument('digitalWrite(LED_PIN);'),range=new Range(0,0,0,20);
 const record={display:range,protocol:{message:'Too few arguments to function call',range:{start:{line:0,character:0},end:{line:0,character:12}}}};
 let picks=0,change;
 const h=authoringHost(async()=>({raw:[],protocolUri:d.uri.toString()}),{diagnostics:()=>[record],document:()=>d});
 h.vscode.window={activeTextEditor:{document:{uri:{scheme:'arduino-live-preview'}}},showQuickPick:async items=>{picks++;return items[0];}};
 h.vscode.commands.executeCommand=async(_name,c)=>{change=c;};
 await h.authoring.showFixes();assert.equal(picks,2);assert.match(change.title,/HIGH（高电平）/);assert.match(change.reason,/不能直接等同于开\/关/);h.authoring.dispose();
});

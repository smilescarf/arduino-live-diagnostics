'use strict';
const {lex}=require('./authoring-core');
const fragments=[
 {id:'Timer',title:'millis 定时执行',description:'每隔一段时间执行代码，不暂停 loop。',pin:false,
 build:(p,pin,ms)=>({globals:`// ${p}：用无符号时间差处理 millis 回绕。\nunsigned long ${p}Previous = 0;\nconst unsigned long ${p}Interval = ${ms};\n`,setup:'',loop:`  if (millis() - ${p}Previous >= ${p}Interval) {\n    ${p}Previous = millis();\n    // 在这里填写需要定时执行的代码。\n  }\n`})},
 {id:'Button',title:'按键消抖与单次按下事件',description:'按键接引脚与 GND，内部上拉；稳定 30ms 后触发，长按不重复。',pin:true,
 build:(p,pin)=>({globals:`// ${p}：按键接 GPIO${pin} 与 GND，按下为 LOW。\nconst int ${p}Pin = ${pin};\nint ${p}Raw = HIGH, ${p}Stable = HIGH;\nunsigned long ${p}ChangedAt = 0;\n`,
 setup:`  pinMode(${p}Pin, INPUT_PULLUP);\n  ${p}Raw = ${p}Stable = digitalRead(${p}Pin);\n`,
 loop:`  const unsigned long ${p}Now = millis();\n  const int ${p}Reading = digitalRead(${p}Pin);\n  if (${p}Reading != ${p}Raw) {\n    ${p}Raw = ${p}Reading;\n    ${p}ChangedAt = ${p}Now;\n  }\n  if (${p}Reading != ${p}Stable && ${p}Now - ${p}ChangedAt >= 30) {\n    ${p}Stable = ${p}Reading;\n    if (${p}Stable == LOW) {\n      // 在这里填写按下按键后要执行的代码。\n    }\n  }\n`})},
 {id:'Analog',title:'定时读取模拟输入',description:'每 100ms 读取一次 ADC；电位器滑动端接模拟输入，不超过板卡允许电压。',pin:true,
 build:(p,pin)=>({globals:`// ${p}：请确认 GPIO${pin} 支持 ADC；电位器滑动端接此引脚。\nconst int ${p}Pin = ${pin};\nunsigned long ${p}Previous = 0;\nint ${p}Value = 0;\n`,setup:'',
 loop:`  if (millis() - ${p}Previous >= 100) {\n    ${p}Previous = millis();\n    ${p}Value = analogRead(${p}Pin);\n    // 在这里使用 ${p}Value；保留当前工程已经设置的 ADC 分辨率。\n  }\n`})}
];
function planFragment(text,id,pin=4,interval=1000) {
  const fragment=fragments.find(f=>f.id===id);if(!fragment)throw Error('未知功能片段');
  const {mask,kind}=lex(text);if(kind)throw Error('请先补全未闭合的注释或字符串。');
  const bodies={};let depth=0;
  // Only merge ordinary top-level setup/loop definitions. Ambiguous preprocessor
  // branches and unmatched braces require the author to resolve structure first.
  if(/^\s*#\s*(?:if|ifdef|ifndef|else|elif|endif)\b/m.test(mask))throw Error('工程有条件编译分支，请先手动整理 setup/loop；本版不会自动合并此类结构。');
  for(let i=0;i<mask.length;i++) {
    if(mask[i]==='{')depth++;else if(mask[i]==='}')depth--;
    if(depth<0)throw Error('花括号不匹配，请先修复语法。');
    if(depth!==0)continue;
    const m=/^void\s+(setup|loop)\s*\(\s*(?:void\s*)?\)\s*\{/.exec(mask.slice(i));if(!m)continue;
    if(bodies[m[1]])throw Error('存在多个 setup/loop 定义，无法安全合并。');
    const open=i+m[0].length-1;let n=1,end=open+1;
    for(;end<mask.length&&n;end++){if(mask[end]==='{')n++;else if(mask[end]==='}')n--;}
    if(n)throw Error('函数花括号未闭合，请先修复语法。');
    bodies[m[1]]={start:i,open,end:end-1};i=end-1;
  }
  if(depth!==0||!bodies.setup||!bodies.loop)throw Error('需要一个完整的顶层 void setup() 和 void loop() 才能合并。');
  for(const b of Object.values(bodies))if(/\breturn\b/.test(mask.slice(b.open,b.end)))throw Error('setup/loop 中有提前 return，请先选择合适的执行位置；本版不会自动合并。');
  let prefix='ald'+id,index=1;while(new RegExp('\\b'+prefix+'\\w*').test(text))prefix='ald'+id+(++index);
  const eol=text.includes('\r\n')?'\r\n':'\n';
  const built=fragment.build(prefix,pin,interval);const newline=s=>s.replace(/\n/g,eol);
  const edits=[{offset:Math.min(bodies.setup.start,bodies.loop.start),text:newline(built.globals+'\n')}];
  if(built.setup)edits.push({offset:bodies.setup.end,text:newline('\n'+built.setup)});
  edits.push({offset:bodies.loop.end,text:newline('\n'+built.loop)});
  let after=text;for(const e of edits.sort((a,b)=>b.offset-a.offset))after=after.slice(0,e.offset)+e.text+after.slice(e.offset);
  return {after,prefix};
}
function installFragments(vscode,options,preview){
  return {async open(){
    const document=vscode.window.activeTextEditor?.document;
    if(!document||document.uri.scheme!=='file'||!options.isSketch(document)){await vscode.window.showInformationMessage('请先打开当前工程的 Arduino 主文件。');return;}
    const selection=await vscode.window.showQuickPick(fragments.map(f=>({label:f.title,detail:f.description,fragment:f})),{title:'插入功能片段 · 应用前预览合并结果'});if(!selection)return;
    let pin=4,interval=1000;
    if(selection.fragment.pin){
      const esp=options.fqbn().startsWith('esp32:');
      const input=await vscode.window.showInputBox({title:'确认引脚',prompt:selection.fragment.id==='Analog'?'填写支持 ADC 的引脚编号或 A0；按你的板卡确认电压与用途。':'填写按键 GPIO 编号；按键另一端接 GND。',value:selection.fragment.id==='Analog'?(esp?'4':'A0'):(esp?'42':'4'),validateInput:value=>/^(?:\d{1,2}|A\d{1,2})$/.test(value)?undefined:'请填写 GPIO 编号或模拟引脚名，如 4、A0。'});
      if(input===undefined)return;pin=/^\d+$/.test(input)?String(Number(input)):input;
    }else{
      const input=await vscode.window.showInputBox({title:'执行间隔（毫秒）',value:'1000',validateInput:value=>/^\d+$/.test(value)&&Number(value)>=1&&Number(value)<=3600000?undefined:'请输入 1～3600000 之间的整数。'});
      if(input===undefined)return;interval=Number(input);
    }
    try {
      const version=document.version,before=document.getText(),plan=planFragment(before,selection.fragment.id,pin,interval);
      await preview({uri:document.uri.toString(),version,title:'插入'+selection.fragment.title,reason:selection.fragment.description,
        edits:[{range:{start:document.positionAt(0),end:document.positionAt(before.length)},newText:plan.after}]});
    }catch(error){await vscode.window.showInformationMessage(error.message);}
  }};
}
module.exports={fragments,planFragment,installFragments};

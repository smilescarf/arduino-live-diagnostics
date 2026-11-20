'use strict';
// Preserve UTF-16 offsets and line breaks while hiding comments and literals.
function lex(text) {
  const out = text.split('');
  let kind = '';
  const hide = (a, b) => { for (let k=a;k<b;k++) if (out[k]!=='\n' && out[k]!=='\r') out[k]=' '; };
  for(let i=0;i<text.length;) {
    const start=i;
    if(text.startsWith('//',i)) { const n=text.indexOf('\n',i); i=n<0?text.length:n; hide(start,i); if(i===text.length)kind='comment'; }
    else if(text.startsWith('/*',i)) { const n=text.indexOf('*/',i+2); i=n<0?text.length:n+2; hide(start,i); if(n<0)kind='comment'; }
    else if(text.startsWith('R"',i) && /^R"[^\s()\\]{0,16}\(/.test(text.slice(i))) {
      const open=text.indexOf('(',i), end=')'+text.slice(i+2,open)+'"', n=text.indexOf(end,open+1);
      i=n<0?text.length:n+end.length; hide(start,i); if(n<0)kind='string';
    } else if(text[i]==='"'||text[i]==="'") {
      const q=text[i++]; let closed=false;
      while(i<text.length) { if(text[i]==='\\')i+=2; else if(text[i++]===q){closed=true;break;} }
      i=Math.min(i,text.length);hide(start,i);if(!closed)kind='string';
    } else i++;
  }
  return { mask:out.join(''), kind };
}
function callContext(text, offset=text.length) {
  const prefix=text.slice(0,offset), {mask,kind}=lex(prefix); if(kind)return;
  const stack=[];
  for(let i=0;i<mask.length;i++) {
    const c=mask[i];
    if('([{'.includes(c)) {
      const m=c==='(' && /(?:(\w+)\s*(\.|->)\s*)?(\w+)\s*$/.exec(mask.slice(0,i));
      stack.push({open:c,offset:i,name:m?.[3],member:!!m?.[2],argument:0});
    } else if(')]}'.includes(c)) { if(stack.at(-1)?.open==='([{'[')]}'.indexOf(c)])stack.pop();else return; }
    else if(c===',' && stack.at(-1)?.open==='(') stack.at(-1).argument++;
  }
  return [...stack].reverse().find(x=>x.open==='(' && x.name && !['if','for','while','switch','sizeof','decltype'].includes(x.name));
}
const parameterHints = {
 pin:'引脚编号或已定义的引脚常量；按当前板卡确认用途和电平。',
 mode:'模式：OUTPUT 输出、INPUT 输入、INPUT_PULLUP 上拉；中断模式用 CHANGE/RISING/FALLING。',
 value:'数字输出选 HIGH/LOW；PWM 数值范围取决于分辨率。',
 fromLow:'输入范围下限，例如 ADC 的 0。',fromHigh:'输入范围上限；Uno 默认 1023，ESP32 12 位为 4095，必须与下限不同。',
 toLow:'输出范围下限，例如亮度 0。',toHigh:'输出范围上限，例如 8 位 PWM 的 255；map 不自动限幅。',
 frequency:'频率，单位 Hz；必须满足当前板型的硬件限制。',resolution:'占空比分辨率位数；10 位对应 0～1023，ESP32-S3 LEDC 最大 14 位。',
 duty:'占空比计数，10 位为 0～1023；先成功初始化 LEDC。',channel:'LEDC 通道编号；共享通道的引脚同步输出。',
 ms:'等待的毫秒数，会阻塞当前 loop；并行任务可用 millis。',us:'等待的微秒数，用于短触发脉冲。',
 duration:'持续时间，单位毫秒；tone 的此参数可省略。',timeout:'等待上限，单位微秒；pulseIn 返回 0 表示超时。',
 bits:'ADC 读数位数；本课程 ESP32 使用 12 位，取值 0～4095。',
 attenuation:'ADC 衰减，例 ADC_11db；实际量程由芯片决定，仍不能超过允许输入电压。',
 timer:'timerBegin 返回的定时器指针，须检查非空。',handler:'回调函数名；中断回调中避免串口、延时和其他耗时操作。',
 interrupt:'使用 digitalPinToInterrupt(引脚)，可用引脚取决于板型。',
 autoreload:'true 周期触发，false 单次触发。',reload_count:'重装次数；0 表示不限制。',note:'音名，如 NOTE_C、NOTE_D。',octave:'八度号，例如 4。',
 low:'允许的下限；参数类型应保持一致。',high:'允许的上限；参数类型应保持一致。'
};
function parameters(item) {
  const labels=/\((.*)\)/.exec(item.signature)?.[1].split(',').map(x=>x.trim()).filter(Boolean)||[];
  return labels.map((label,index)=>({label,description:
    item.name==='digitalWrite'&&index===1?'输出电平：HIGH 点亮高电平输出，LOW 关闭；实际 LED 有效电平取决于接线。':
    item.name==='pinMode'&&index===1?'OUTPUT 输出、INPUT 输入或 INPUT_PULLUP 内部上拉。':
    item.name==='map'&&index===0?'待映射的整数，例如 analogRead 的原始值；使用整数运算。':
    item.name==='timerBegin'?'定时器计数频率，单位 Hz；1000000 表示每微秒一个 tick。':
    item.name==='timerAlarm'&&index===1?'告警计数值；1MHz 下 1000000 tick 为 1 秒。':
    parameterHints[label]||'按函数声明填写相应值；请结合当前板型与核心版本。'}));
}
function callAt(text, name, position) {
  const mask=lex(text).mask;
  const pattern=new RegExp('\\b'+name+'\\s*\\(','g'); let best;
  for(const match of mask.matchAll(pattern)) {
    const start=match.index, open=mask.indexOf('(',start);let depth=1,end=open+1;
    for(;end<mask.length && depth;end++){if(mask[end]==='(')depth++;else if(mask[end]===')')depth--;}
    if(depth || position<start || position>end)continue;
    if(/[.>\w]/.test(mask[start-1]||''))continue;
    best={start,end,open,argumentText:mask.slice(open+1,end-1)};
  }
  return best;
}
function compilerArgumentMessage(diagnostic) {
  return [diagnostic.message,...(diagnostic.relatedInformation||[]).map(r=>r.message)].join('\n');
}
function missingDigitalWrite(text, position, message) {
  if(!/too few arguments|requires? 2 arguments?,? but 1 (?:was|were) provided|expected 2, (?:have|got) 1/i.test(message))return;
  // Do not teach core semantics for a user-defined function with the same name.
  const mask=lex(text).mask;
  if(/\b(?:void|int|bool|auto)\s+digitalWrite\s*\(/.test(mask))return;
  const call=callAt(text,'digitalWrite',position);
  if(!call || !call.argumentText.trim() || callContext(text,call.end-1)?.argument!==0)return;
  return {...call,message:'digitalWrite 缺少第 2 个参数（输出电平）。请根据需要填写 HIGH 或 LOW，例如 digitalWrite(LED_PIN, HIGH)。'};
}
function advisoryFindings(text) {
  const mask=lex(text).mask, result=[];
  // The compiler knows active preprocessor branches; this small teaching pass
  // does not. Suppress its extra suggestions for conditional source files.
  if(/^\s*#\s*(?:if|ifdef|ifndef|else|elif)\b/m.test(mask))return result;
  const functions=[];
  for(const m of mask.matchAll(/\b(?:void|int|bool|auto)\s+(?:(?:ARDUINO_ISR_ATTR|IRAM_ATTR)\s+)?(\w+)\s*\([^{};]*\)\s*\{/g)){
    const open=mask.indexOf('{',m.index);let depth=1,end=open+1;
    for(;end<mask.length&&depth;end++){if(mask[end]==='{')depth++;else if(mask[end]==='}')depth--;}
    if(!depth)functions.push({name:m[1],start:open+1,end:end-1});
  }
  const isrs=new Set();
  for(const m of mask.matchAll(/\b(attachInterrupt|timerAttachInterrupt)\s*\(/g)){
    const call=callAt(text,m[1],m.index);if(!call)continue;
    let depth=0,start=0;const args=[];
    for(let i=0;i<=call.argumentText.length;i++){
      const c=call.argumentText[i];if(c&&'([{'.includes(c))depth++;else if(c&&')]}'.includes(c))depth--;
      if((c===','&&depth===0)||i===call.argumentText.length){args.push(call.argumentText.slice(start,i).trim());start=i+1;}
    }
    const callback=/^&?\s*(\w+)$/.exec(args[1]||'');if(callback)isrs.add(callback[1]);
  }
  for(const fn of functions) {
    const body=mask.slice(fn.start,fn.end);
    if(fn.name==='loop')for(const m of body.matchAll(/\bdelay\s*\(\s*(\d+)\s*\)/g))if(Number(m[1])>=500)result.push({start:fn.start+m.index,length:m[0].length,code:'blocking-delay',message:'学习建议：此处 delay 会暂停当前 loop。若需要同时检测按键或通信，可用 millis 定时片段。这可能是有意的教学演示，无需强制修改。'});
    if(isrs.has(fn.name))for(const m of body.matchAll(/\b(?:delay\s*\(|Serial\s*\.\s*(?:print|println|printf)\s*\()/g))result.push({start:fn.start+m.index,length:m[0].length,code:'isr-work',message:'学习建议：该函数注册为中断回调，此处延时或串口操作可能影响时序。建议回调只记录标志，在 loop 中处理。'});
  }
  for(const m of mask.matchAll(/\b(?:float|double)\s+\w+\s*=\s*(\d+)\s*\/\s*(\d+)\s*;/g))if(Number(m[2])!==0 && Number(m[1])%Number(m[2])!==0)result.push({start:m.index,length:m[0].length,code:'integer-division',message:'学习建议：右侧两个整数先做整数除法，小数部分会丢失，再存入浮点变量。若需要小数，可把一个数写成 1.0 这样的浮点数。'});
  return result.sort((a,b)=>a.start-b.start).slice(0,8);
}
module.exports={lex,callContext,parameters,compilerArgumentMessage,missingDigitalWrite,advisoryFindings};

'use strict';

const fs = require('node:fs');
const path = require('node:path');

function explain(message) {
  const undeclared = /(?:undeclared identifier|was not declared in this scope)\s*['‘]([^'’]+)['’]/i.exec(message);
  if (undeclared) return `名称“${undeclared[1]}”尚未声明，或当前作用域不可见。检查拼写、声明位置和必要的头文件。`;
  const rules = [
    [/array index.*(?:bounds|past)|array bounds|array subscript.*(?:bounds|outside)/i, '数组下标超出有效范围。长度为 N 的数组只能使用 0～N-1，下标等于 N 也会越界。请检查循环条件及数组长度。'],
    [/character <U\+FF0C> not allowed/i, '代码中出现中文逗号 ，。如果这是说明文字，请在前面加 //；如果是函数参数分隔符，请使用英文逗号 ,。'],
    [/unexpected character <U\+FEFF>/i, '代码中含有不可见的 BOM 字符。请检查粘贴内容或将源文件另存为不带 BOM 的 UTF-8。'],
    [/misleading indentation/i, '缩进与实际控制范围不一致。没有花括号的 if、for、while 只控制紧随的一条语句；请对齐缩进，或用 { } 明确范围。'],
    [/expected ['‘]\(['’] after ['‘]if['’]/i, 'if 后缺少括号中的条件。请写成 if (条件) { … }，例如 if (value > 99) { … }。'],
    [/for function-style cast or type construction/i, '此处的函数调用或类型转换语法不成立。如果正在写循环，请检查关键字是否完整拼成 for，例如 fo 不是 for。'],
    [/expected expression/i, '此处需要表达式。请检查条件、赋值或函数参数是否为空，以及当前位置之前是否多写或漏写了符号。'],
    [/expected unqualified-id/i, '此处需要合法的名称或声明。请检查多余的符号，以及函数或变量声明是否完整。'],
    [/extraneous closing brace/i, '此处的右花括号 } 多余，请检查它是否有对应的左花括号 {。'],
    [/expected ['‘];['’]|expected ';'/i, '可能缺少分号，请同时检查当前行和上一行的语句结尾。'],
    [/undeclared identifier|was not declared in this scope/i, '名称尚未声明，或当前作用域不可见。检查拼写、声明位置和必要的头文件。'],
    [/file not found|No such file or directory/i, '找不到头文件或依赖库。检查库是否安装、文件名大小写及当前开发板的兼容性。'],
    [/no matching function|no matching member function/i, '找不到匹配的函数重载。检查参数个数、顺序与类型。'],
    [/too (?:few|many) arguments/i, '函数参数数量不正确，请对照函数声明检查。'],
    [/cannot initialize|invalid conversion|incompatible.*type|cannot convert/i, '类型不匹配。检查赋值两侧或函数实参与形参的类型，避免未经确认的强制转换。'],
    [/redefinition|redeclaration/i, '名称重复定义。检查重复声明、同名文件和头文件保护。'],
    [/expected ['‘]\)['’]/i, '此处缺少右圆括号 )。请检查前面的条件、函数调用或表达式。'],
    [/expected ['‘]\}['’]/i, '此处缺少右花括号 }。请检查前面函数或代码块的左花括号。'],
    [/expected ['‘]\]['’]/i, '此处缺少右方括号 ]。请检查前面的数组下标。'],
    [/expected ['‘]\(['’]/i, '此处缺少左圆括号 (。请检查条件或函数调用的写法。'],
    [/expected ['‘]\{['’]/i, '此处缺少左花括号 {。请检查函数或代码块的写法。'],
    [/unused variable/i, '这个变量尚未使用；如果确实不需要，可以移除。'],
    [/uninitialized/i, '变量可能在赋值前被读取。检查所有执行分支是否都已初始化。']
  ];
  return rules.find(([pattern]) => pattern.test(message))?.[1] || '';
}

function translatedMessage(message) {
  if (message.includes('\n中文提示：')) return message;
  const hint = explain(message);
  return `${message}\n中文提示：${hint || '编译器报告了尚无专门中文解释的诊断。请展开详情查看原始原因；目前无法确定具体修复方法。'}`;
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function uriKey(uri) {
  if (uri.scheme === 'file') {
    const file = path.resolve(uri.fsPath);
    return process.platform === 'win32' ? file.toLowerCase() : file;
  }
  return uri.toString();
}

// Arduino sketches must contain a primary .ino matching the folder name.
function findSketch(file, workspaceRoot) {
  if (!isWithin(workspaceRoot, file)) return undefined;
  let dir = path.dirname(file);
  while (isWithin(workspaceRoot, dir)) {
    if (fs.existsSync(path.join(dir, `${path.basename(dir)}.ino`))) return dir;
    if (dir === workspaceRoot) break;
    const parent = path.dirname(dir);
    if (dir === parent) break;
    dir = parent;
  }
  return undefined;
}

function serverArgs(tools, fqbn) {
  if (!fqbn || fqbn.split(':').length < 3) throw new Error('请先选择有效的开发板 FQBN。');
  const args = ['-cli', tools.cli, '-clangd', tools.clangd, '-fqbn', fqbn];
  if (tools.config) args.push('-cli-config', tools.config);
  // Never add -no-real-time-diagnostics: didChange must publish live diagnostics.
  return args;
}

function parseBoards(value) {
  const rows = Array.isArray(value) ? value : value.boards || [];
  return rows.filter(b => typeof b.fqbn === 'string').map(b => ({ label: b.name || b.fqbn, description: b.fqbn }));
}

function effectiveFqbn(config, ide, file) {
  if (config.followIdeBoard !== false && ide?.fqbn && ide.sketchPath && file && isWithin(ide.sketchPath, file)) return ide.fqbn;
  return config.fqbn;
}

module.exports = { explain, translatedMessage, isWithin, findSketch, serverArgs, parseBoards, effectiveFqbn, uriKey };

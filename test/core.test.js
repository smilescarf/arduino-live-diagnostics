'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { explain, translatedMessage, findSketch, serverArgs, parseBoards, effectiveFqbn } = require('../src/core');
const { discoverTools } = require('../src/tools');

test('保留原始诊断，仅为匹配的错误追加中文解释', () => {
  const original = "Use of undeclared identifier 'missingName'";
  assert.ok(translatedMessage(original).startsWith(original));
  assert.match(translatedMessage(original), /名称“missingName”尚未声明/);
  assert.match(translatedMessage('Unknown target-specific diagnostic'), /尚无专门中文解释/);
  assert.match(explain('Expected expression'), /此处需要表达式/);
  assert.match(explain('Misleading indentation: statement is indented too deeply'), /缩进与实际控制范围不一致/);
  assert.match(explain("Expected ')'"), /右圆括号/);
  assert.equal(explain('Other issue in function call()'), '', '不能因为消息中出现括号就猜测括号不配对');
  assert.match(explain("Expected ';' after expression"), /分号/);
  assert.match(explain("Expected '(' after 'if'"), /if 后缺少括号中的条件/);
});

test('从 src 中定位主 sketch，并拒绝逃出工作区和错误命名', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'arduino-live-test-'));
  try {
    const sketch = path.join(root, 'Demo');
    fs.mkdirSync(path.join(sketch, 'src'), { recursive: true });
    fs.writeFileSync(path.join(sketch, 'Demo.ino'), 'void setup() {}');
    assert.equal(findSketch(path.join(sketch, 'src', 'helper.cpp'), root), sketch);
    assert.equal(findSketch(path.join(root, 'Wrong.ino'), root), undefined);
    assert.equal(findSketch(path.join(root + '-other', 'Demo.ino'), root), undefined);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('启用实时诊断，路径带空格仍作为独立参数传递', () => {
  const args = serverArgs({ cli: 'C:/Arduino IDE/cli.exe', clangd: 'C:/Arduino IDE/clangd.exe', config: 'C:/my config.yaml' }, 'arduino:avr:uno');
  assert.equal(args[1], 'C:/Arduino IDE/cli.exe');
  assert.ok(!args.includes('-no-real-time-diagnostics'));
  assert.deepEqual(args.slice(-2), ['-cli-config', 'C:/my config.yaml']);
  assert.throws(() => serverArgs({}, ''), /开发板/);
});

test('支持 CLI 的对象和旧数组开发板列表', () => {
  const board = { name: 'Uno', fqbn: 'arduino:avr:uno' };
  assert.deepEqual(parseBoards({ boards: [board, {}] }), parseBoards([board]));
  assert.equal(parseBoards({}).length, 0);
});

test('默认跟随当前 IDE 工程的板型，手动选择及其他工程不被覆盖', () => {
  const root = path.join(os.tmpdir(), 'IdeSketch');
  const ide = { sketchPath: root, fqbn: 'esp32:esp32:esp32s3' };
  const file = path.join(root, 'IdeSketch.ino');
  const config = { fqbn: 'arduino:avr:uno', followIdeBoard: true };
  assert.equal(effectiveFqbn(config, ide, file), ide.fqbn);
  assert.equal(effectiveFqbn(config, { ...ide, fqbn: 'esp32:esp32:esp32c3' }, file), 'esp32:esp32:esp32c3');
  assert.equal(effectiveFqbn({ ...config, followIdeBoard: false }, ide, file), config.fqbn);
  assert.equal(effectiveFqbn(config, ide, path.join(root + '-other', 'Other.ino')), config.fqbn);
  assert.equal(effectiveFqbn(config, undefined, file), config.fqbn);
});

test('指定的无效工具路径不会静默回退，复用 IDE 内的三个工具', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'arduino-live-tools-'));
  try {
    const toolsDir = path.join(root, 'resources/app/lib/backend/resources');
    fs.mkdirSync(toolsDir, { recursive: true });
    for (const name of ['arduino-cli', 'arduino-language-server', 'clangd']) fs.writeFileSync(path.join(toolsDir, name + '.exe'), '');
    const tools = discoverTools({ arduinoIdePath: root }, { PATH: '', USERPROFILE: root }, 'win32');
    assert.equal(tools.cli, path.join(toolsDir, 'arduino-cli.exe'));
    assert.equal(tools.server, path.join(toolsDir, 'arduino-language-server.exe'));
    assert.equal(discoverTools({ arduinoIdePath: root, cliPath: path.join(root, 'missing.exe') }, { PATH: '', USERPROFILE: root }, 'win32').cli, undefined);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

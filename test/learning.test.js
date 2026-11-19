'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { includes, libraryHeaders, declarations, installLearning } = require('../src/learning');
const { templates, templateCode, supportsBoard } = require('../src/templates');
const { availableApi } = require('../src/api-catalog');
const { rowData } = require('../src/error-list');
const { DiagnosticModel } = require('../src/dashboard');

test('只匹配当前包含的真实库头文件，拒绝路径逃逸并保留声明行号', () => {
  const root = path.resolve('.tmp/library-test');
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'Demo.h'), 'class Demo {\npublic:\n void begin(int pin);\nprivate:\n void secret();\n};\n');
  const libraries = [{ library: { name: 'Demo', source_dir: root, install_dir: root } }];
  assert.deepEqual(includes('// #include <Wrong.h>\n/*\n#include <Wrong.h>\n*/\n#include <Demo.h>'), ['Demo.h']);
  const headers = libraryHeaders('#include <Demo.h>\n#include <../Escape.h>', libraries);
  assert.equal(headers.length, 1);
  const signatures = declarations(fs.readFileSync(headers[0].file, 'utf8'));
  assert.equal(signatures[0].name, 'begin');
  assert.equal(signatures[0].line, 3);
  assert.ok(!signatures.some(item => item.name === 'secret'));
});

test('每个实验均为独立工程，包含接线说明与可改参数', () => {
  assert.ok(templates.some(template => template.id === 'ButtonDebounce'));
  for (const template of templates) {
    const source = templateCode(template, 'esp32:esp32:esp32s3');
    assert.match(source, /void setup\(/);
    assert.match(source, /void loop\(/);
    assert.match(source, /接线：/);
    assert.match(source, /可改参数/);
    assert.ok(!source.includes('delay('), '模板应允许 loop 持续运行');
  }
});

test('课件板型匹配包含 FQBN 菜单选项，Uno 不混入 ESP32 专用 API', () => {
  const timer = templates.find(t => t.id === 'HardwareTimer');
  assert.equal(supportsBoard(timer, 'esp32:esp32:esp32s3:CDCOnBoot=cdc'), true);
  assert.equal(supportsBoard(timer, 'arduino:avr:uno'), false);
  assert.ok(!availableApi('arduino:avr:uno').some(api => api.name === 'ledcAttach'));
  assert.ok(availableApi('esp32:esp32:esp32s3').some(api => api.name === 'ledcAttach'));
});

function templateHost(board, selected, destination) {
  const state = { dialogs: 0, opened: [], notices: [] };
  const disposable = () => ({ dispose() {} });
  const vscode = {
    window: {
      showQuickPick: async items => items.find(item => item.template.id === selected),
      showOpenDialog: async () => { state.dialogs++; return [{ fsPath: destination }]; },
      showTextDocument: async document => state.opened.push(document),
      showInformationMessage: async text => { state.notices.push(text); },
      showWarningMessage: async text => { state.notices.push(text); }
    },
    languages: { registerCompletionItemProvider: disposable, registerHoverProvider: disposable },
    workspace: { openTextDocument: async uri => uri },
    Uri: { file: fsPath => ({ fsPath }) }
  };
  return { state, learning: installLearning(vscode, { fqbn: () => board }) };
}

test('模板创建附带中文实验说明，重复创建不覆盖已有工程', async () => {
  const parent = path.resolve('.tmp', `template-create-${Date.now()}`);
  fs.mkdirSync(parent, { recursive: true });
  const { state, learning } = templateHost('esp32:esp32:esp32s3', 'UltrasonicRadar', parent);
  await learning.openTemplates();
  const original = path.join(parent, 'UltrasonicRadar', 'UltrasonicRadar.ino');
  fs.appendFileSync(original, '// student edit\n');
  await learning.openTemplates();
  assert.match(fs.readFileSync(original, 'utf8'), /student edit/);
  assert.ok(fs.existsSync(path.join(parent, 'UltrasonicRadar2', 'UltrasonicRadar2.ino')));
  const guide = fs.readFileSync(path.join(parent, 'UltrasonicRadar2', 'README.md'), 'utf8');
  assert.match(guide, /ESP32Servo/);
  assert.match(guide, /Echo/);
  assert.match(guide, /第 8 页/);
  assert.equal(state.opened.length, 2);
  learning.dispose();
});

test('不匹配板型时解释所需开发板并阻止创建专用工程', async () => {
  const { state, learning } = templateHost('arduino:avr:uno', 'HardwareTimer', '.tmp');
  await learning.openTemplates();
  assert.equal(state.dialogs, 0);
  assert.equal(state.opened.length, 0);
  assert.match(state.notices[0], /ESP32-S3/);
  learning.dispose();
});

test('错误列表将说明和文件行列分列，大小写不同的 Windows URI仍对应当前代码', () => {
  const model = new DiagnosticModel();
  const file = path.resolve('.tmp/View.ino');
  const uri = { scheme: 'file', fsPath: file, toString: () => 'file:///encoded-URI' };
  const documentUri = { scheme: 'file', fsPath: file, toString: () => 'file:///different-encoding' };
  model.markPending(documentUri);
  model.update(uri, [{ severity: 0, code: 'expected_expression', message: 'Expected expression', range: { start: { line: 1, character: 3 }, end: { line: 1, character: 4 } } }]);
  const rows = rowData(model, [{ uri: documentUri, lineCount: 3, lineAt: index => ({ text: ['void loop() {', 'if () {}', '}'][index] }) }]);
  assert.equal(model.pending.size, 0);
  assert.equal(rows[0].line, 2);
  assert.equal(rows[0].column, 4);
  assert.equal(rows[0].description, '此处需要表达式');
  assert.match(rows[0].snippet, /2  if \(\) \{\}/);
  assert.equal(rows[0].original, 'Expected expression');
});

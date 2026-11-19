'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { DiagnosticModel, createDashboard } = require('../src/dashboard');
const uri = name => ({ fsPath: name, toString: () => `file:///${name}` });
const diagnostic = (severity, line, message = 'Original error\n中文提示：名称尚未声明') => ({ severity, message, range: { start: { line, character: 3 }, end: { line, character: 6 } } });

test('实时监测按严重程度排序，修复后清除对应文件，切板后清空旧诊断', () => {
  const model = new DiagnosticModel();
  model.update(uri('a.ino'), [diagnostic(1, 0), diagnostic(0, 3)]);
  model.update(uri('b.cpp'), [diagnostic(0, 2)]);
  assert.deepEqual(model.rows().map(r => r.diagnostic.severity), [0, 0, 1]);
  model.update(uri('a.ino'), []);
  assert.equal(model.rows().length, 1);
  assert.equal(model.rows()[0].uri.fsPath, 'b.cpp');
  model.clear();
  assert.equal(model.rows().length, 0);
  assert.equal(model.updated, undefined);
});

test('大面板显示中文提示和精确代码位置，点击条目携带正确 URI 与范围', () => {
  const model = new DiagnosticModel();
  const file = uri('Demo.ino');
  const problem = diagnostic(0, 4);
  model.setStatus('esp32s3 · 已就绪', '状态详情', 'esp32:esp32:esp32s3');
  model.update(file, [problem]);
  const vscode = {
    EventEmitter: class { event() {} fire() {} dispose() {} },
    TreeItem: class { constructor(label) { this.label = label; } },
    TreeItemCollapsibleState: { None: 0 }, ThemeIcon: class { constructor(id) { this.id = id; } }
  };
  const dashboard = createDashboard(vscode, model);
  const rows = dashboard.getChildren();
  assert.match(rows[1].label, /esp32:esp32:esp32s3/);
  assert.match(rows[2].label, /错误 1/);
  assert.equal(rows[3].label, '名称尚未声明');
  assert.equal(rows[3].description, 'Demo.ino:5:4');
  assert.equal(rows[3].command.command, 'arduinoLive.revealDiagnostic');
  assert.deepEqual(rows[3].command.arguments, [file, problem.range]);
  assert.match(rows[3].tooltip, /第 5 行，第 4 列/);
  assert.match(rows[3].tooltip, /编译器原文：Original error/);
  model.update(file, []);
  model.markPending(file);
  const pending = dashboard.getChildren();
  assert.match(pending[2].label, /上次结果/);
  assert.match(pending[2].description, /最新修改正在检查/);
  assert.ok(!pending.some(row => /当前没有诊断问题/.test(row.label)), '修改后的旧零错误结果不能显示为已检查通过');
  model.markPending(uri('Other.ino'));
  model.update(file, [problem]);
  assert.equal(model.pending.size, 1, '一个文件的结果不能冒充另一个文件已完成');
  model.clear();
  assert.equal(model.pending.size, 0);
  model.update(file, [diagnostic(1, 3, 'Unknown warning from compiler')]);
  const unknown = dashboard.getChildren()[3];
  assert.match(unknown.label, /尚无专门中文解释/);
  assert.match(unknown.tooltip, /Unknown warning from compiler/);
});

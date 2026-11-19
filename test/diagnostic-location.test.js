'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { diagnosticRange } = require('../src/diagnostic-location');
const doc = text => { const lines = text.split('\n'); return { lineCount: lines.length, lineAt: line => ({ text: lines[line] }) }; };
const error = { message: "Expected '(' after 'if'", range: { start: { line: 2, character: 0 }, end: { line: 2, character: 1 } } };

test('缺少条件的 if 标在关键字上，跳过中间空行和行注释', () => {
  assert.deepEqual(diagnosticRange(doc('void loop() {\n    if\n    {\n}'), error), { start: { line: 1, character: 4 }, end: { line: 1, character: 6 } });
  const withComment = { ...error, range: { start: { line: 4, character: 2 }, end: { line: 4, character: 3 } } };
  assert.equal(diagnosticRange(doc('void loop() {\n  if // missing condition\n\n  // note\n  {\n}'), withComment).start.line, 1);
});

test('有完整循环头结构但把 for 拼成 fo 时标记关键字本身', () => {
  const bad = { message: "Expected '(' for function-style cast or type construction", range: { start: { line: 0, character: 9 }, end: { line: 0, character: 10 } } };
  assert.deepEqual(diagnosticRange(doc('  fo(int i=0;i<7;i++)'), bad), { start: { line: 0, character: 2 }, end: { line: 0, character: 4 } });
  assert.equal(diagnosticRange(doc('  call(int value)'), bad), bad.range);
});

test('当前代码已修正或其他错误时不猜测并移动编译器位置', () => {
  assert.equal(diagnosticRange(doc('void loop() {\n  if (value > 99)\n  {\n}'), error), error.range);
  const other = { ...error, message: 'Expected expression' };
  assert.equal(diagnosticRange(doc('void loop() {\n  if\n  {\n}'), other), other.range);
  assert.equal(diagnosticRange(doc('// if\n  f();\n{'), error), error.range);
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { insertion, semicolonRange } = require('../src/fix-location');

test('缺分号定位根据编译器插入建议，跨过空白与注释回到语句末尾', () => {
  const range = semicolonRange('count = millis() // 这里缺分号\r\n  value++;', { line: 1, character: 2 });
  assert.deepEqual(range, { start: { line: 0, character: 15 }, end: { line: 0, character: 16 } });
  assert.equal(semicolonRange('String s = "http://example"\n next();', { line: 1, character: 1 }).start.line, 0);
});

test('仅采用同一文件唯一的分号插入修复，不执行编译器命令', () => {
  const uri = 'file:///D:/Demo/Main.cpp';
  const edit = point => ({ range: { start: point, end: point }, newText: ';' });
  const actions = [{ edit: { changes: { [uri]: [edit({ line: 4, character: 8 })] } } }];
  assert.deepEqual(insertion(actions, uri), { line: 4, character: 8 });
  actions.push({ edit: { changes: { [uri]: [edit({ line: 9, character: 2 })] } } });
  assert.equal(insertion(actions, uri), undefined);
});

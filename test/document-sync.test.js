'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { documentSelector, documentSync } = require('../src/document-sync');

test('文档过滤使用 IDE 可匹配的字符串 glob，允许 C++ 配色的 ino 文档', () => {
  assert.deepEqual(documentSelector, [{ scheme: 'file', pattern: '**/*.{ino,cpp,c,h,hpp}' }]);
});

test('打开时先用冻结快照同步，再按顺序发送初始化刷新和后续编辑', async () => {
  const sketch = path.resolve('.tmp/sync/Sketch');
  const order = [];
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  const document = { uri: { scheme: 'file', fsPath: path.join(sketch, 'Sketch.ino'), toString: () => 'file:///Sketch.ino' }, version: 10, getText() { return 'unsaved'; } };
  const sync = documentSync(sketch, undefined, undefined, async (_document, version) => { await blocked; order.push(`refresh:${version}`); });
  const opening = sync.didOpen(document, async snapshot => { assert.equal(snapshot.version, 9); assert.equal(snapshot.getText(), 'unsaved'); order.push('open'); });
  const changing = sync.didChange({ document, contentChanges: [{ text: 'x' }] }, async () => { order.push('change'); });
  await Promise.resolve();
  assert.deepEqual(order, ['open']);
  release();
  await Promise.all([opening, changing]);
  assert.deepEqual(order, ['open', 'refresh:10', 'change']);
});

test('未保存的增量修改原样传递，另一工程的文本不会传入当前服务', async () => {
  const sketch = path.resolve('.tmp/sync/Sketch');
  const doc = file => ({ uri: { scheme: 'file', fsPath: file }, languageId: 'cpp', version: 3 });
  const inside = doc(path.join(sketch, 'Sketch.ino'));
  const nested = doc(path.join(sketch, 'src', 'helper.cpp'));
  const outside = doc(path.resolve('.tmp/sync/SketchOther/SketchOther.ino'));
  const opened = [];
  const changed = [];
  const sync = documentSync(sketch, document => opened.push(document), event => changed.push(event));
  const sent = [];
  const next = value => { sent.push(value); return Promise.resolve(); };
  await sync.didOpen(inside, next);
  await sync.didOpen(nested, next);
  await sync.didOpen(outside, next);
  const change = { document: inside, contentChanges: [{ range: { start: { line: 0, character: 10 }, end: { line: 0, character: 11 } }, text: 'missingName' }] };
  await sync.didChange(change, next);
  await sync.didChange({ ...change, document: outside }, next);
  assert.deepEqual(opened, [inside, nested]);
  assert.deepEqual(sent, [inside, nested, change]);
  assert.deepEqual(changed, [change], '仅真实内容修改标记待检查，不能受其他工程影响');
  assert.equal(sent[2], change, '不能改成磁盘读取或保存后再检查');
  for (const method of ['didClose', 'didSave']) {
    await sync[method](outside, next);
    assert.equal(sent.length, 3);
  }
  await sync.didOpen({ uri: { scheme: 'untitled', fsPath: inside.uri.fsPath } }, next);
  assert.equal(sent.length, 3);
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { prototypes, sourceCommands, splitFlags } = require('../src/source-engine');
const { diagnosticsClientClass } = require('../src/diagnostics-client');

test('源文件诊断使用同目录虚拟 cpp，源码不插行，响应文件中的 GCC 专用参数被准确移除', () => {
  const root = path.resolve('.tmp/source-command-test');
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'Demo.ino'), 'void setup() {}\nvoid loop() {}\n');
  fs.writeFileSync(path.join(root, 'flags'), '-std=gnu++17 -mdisable-hardware-atomics "-IC:/folder with spaces" -DNAME=\\"value\\"');
  const original = path.join(root, 'generated.cpp');
  const commands = sourceCommands([{ file: original.replace('generated.cpp', 'Demo.ino.cpp'), directory: root, arguments: ['compiler', '@flags', original.replace('generated.cpp', 'Demo.ino.cpp'), '-c'] }], root, path.join(root, 'proto.h'));
  const main = commands.find(command => command.file.endsWith('.arduino-live.cpp'));
  assert.equal(main.file, path.join(root, 'Demo.ino.arduino-live.cpp'));
  assert.ok(!main.arguments.includes('-mdisable-hardware-atomics'));
  assert.ok(main.arguments.includes('-IC:/folder with spaces'));
  assert.ok(main.arguments.includes('-DNAME="value"'));
  assert.ok(main.arguments.includes(main.file));
  assert.deepEqual(splitFlags('a "b c" d'), ['a', 'b c', 'd']);
});

test('常用 Arduino 函数生成前置声明，自定义类型和默认参数保留给显式声明处理', () => {
  const header = prototypes(['void setup() {}\nvoid loop() { helper(2); }\nint helper(int value) { return value; }\nMyType other(MyType value) {return value;}\nint choice(int value=1) {return value;}']);
  assert.match(header, /int helper\(int value\);/);
  assert.ok(!header.includes('MyType'));
  assert.ok(!header.includes('choice'));
});

test('直接源文件的旧版本诊断不能覆盖最新编辑', () => {
  class Base { constructor() { this.accepted = []; } handleDiagnostics(params) { this.accepted.push(params); } }
  const Client = diagnosticsClientClass(Base);
  const client = new Client('id', 'name', {}, { currentDocumentVersion: () => 8 });
  client.handleDiagnostics({ uri: 'file:///main.cpp', version: 7, diagnostics: [] });
  assert.equal(client.accepted.length, 0);
  client.handleDiagnostics({ uri: 'file:///main.cpp', version: 8, diagnostics: [] });
  assert.equal(client.accepted.length, 1);
});

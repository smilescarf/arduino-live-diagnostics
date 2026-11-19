'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { diagnosticsClientClass, diagnosticCapabilities } = require('../src/diagnostics-client');

test('与 IDE 共存时不注册全局 clangd 命令，文本实时同步仍正常注册', () => {
  const features = ['workspace/executeCommand', 'textDocument/codeAction', 'textDocument/semanticTokens', 'textDocument/inlayHint', 'textDocument/diagnostic', 'textDocument/completion', 'textDocument/didOpen', 'textDocument/didChange', 'textDocument/didClose', 'workspace/didChangeConfiguration'];
  class Base {
    constructor() {
      this.registered = [];
      for (const method of features) this.registerFeature({ registrationType: { method } });
      this.registerFeature({ name: 'staticFeature' });
    }
    registerFeature(feature) { this.registered.push(feature); }
  }
  const Client = diagnosticsClientClass(Base);
  const client = new Client();
  assert.deepEqual(client.registered.filter(f => f.registrationType).map(f => f.registrationType.method), features.slice(6));
  assert.equal(client.registered.at(-1).name, 'staticFeature');
});

test('不向 clangd 声明会让 ALS 崩溃的 refresh 能力，保留增量同步与推送诊断', () => {
  const capabilities = { workspace: { configuration: true, workspaceFolders: true, semanticTokens: { refreshSupport: true }, inlayHint: { refreshSupport: true }, diagnostics: { refreshSupport: true } },
    textDocument: { synchronization: { didSave: true }, publishDiagnostics: { relatedInformation: true }, semanticTokens: { requests: { full: true } } }, general: { positionEncodings: ['utf-16'] } };
  const actual = diagnosticCapabilities(capabilities);
  assert.equal(actual.workspace.semanticTokens, undefined);
  assert.equal(actual.workspace.inlayHint, undefined);
  assert.equal(actual.workspace.diagnostics, undefined);
  assert.equal(actual.textDocument.semanticTokens, undefined);
  assert.equal(actual.workspace.configuration, true);
  assert.equal(actual.textDocument.synchronization, capabilities.textDocument.synchronization);
  assert.equal(actual.textDocument.publishDiagnostics.relatedInformation, true);
  assert.equal(actual.textDocument.publishDiagnostics.versionSupport, true);
  assert.equal(actual.general, capabilities.general);
  assert.equal(capabilities.workspace.semanticTokens.refreshSupport, true, '不能修改其他客户端对象');
});

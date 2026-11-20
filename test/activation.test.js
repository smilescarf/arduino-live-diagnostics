'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

test('IDE API 迟迟未就绪时，菜单和内置使用说明仍能正常使用', async () => {
  const commands = new Map();
  const disposable = () => ({ dispose() {} });
  const panel = { webview: { html: '' } };
  const status = { show() {}, dispose() {} };
  const values = { fqbn: '', enabled: false };
  const workspaceUri = { fsPath: path.resolve('.tmp/FakeSketch') };
  const vscode = {
    CodeActionKind:{QuickFix:'quickfix'},
    EventEmitter: class { event() {} fire() {} dispose() {} },
    StatusBarAlignment: { Left: 1 }, ViewColumn: { Beside: 2 }, ProgressLocation: { Notification: 15 }, ConfigurationTarget: { WorkspaceFolder: 3 },
    window: {
      createOutputChannel: () => ({ appendLine() {}, show() {}, dispose() {} }),
      createStatusBarItem: () => status,
      registerTreeDataProvider: disposable,
      registerWebviewViewProvider: disposable,
      withProgress: async (_options, action) => action({ report() {} }),
      showQuickPick: async items => items.find(item => item.label.includes('使用说明')) || items[0],
      createWebviewPanel: () => panel
    },
    languages: { registerCompletionItemProvider: disposable, registerHoverProvider: disposable,registerSignatureHelpProvider:disposable,registerCodeActionsProvider:disposable,createDiagnosticCollection:()=>({dispose(){},set(){},delete(){}}) },
    workspace: {
      isTrusted: false,
      textDocuments: [], workspaceFolders: [{ uri: workspaceUri }],
      getWorkspaceFolder: () => ({ uri: workspaceUri }),
      getConfiguration: () => ({ get: key => values[key], update: async (key, value) => { values[key] = value; } }),
      onDidOpenTextDocument: disposable, onDidChangeTextDocument: disposable,
      onDidCloseTextDocument:disposable,registerTextDocumentContentProvider:disposable,
      onDidChangeConfiguration: disposable, onDidChangeWorkspaceFolders: disposable,
      onDidGrantWorkspaceTrust: disposable
    },
    commands: { executeCommand: async () => {}, registerCommand: (name, fn) => { commands.set(name, fn); return disposable(); } },
    extensions: { getExtension: () => ({ exports: undefined, activate: () => new Promise(() => {}) }) }
  };
  const originalLoad = Module._load;
  let extension;
  try {
    Module._load = function (name, ...args) {
      if (name === 'vscode') return vscode;
      if (name === 'vscode-languageclient/node') return { LanguageClient: class {} };
      if (name === './tools' && args[0]?.filename.endsWith('extension.js')) return {
        discoverTools: () => ({ cli: 'fake-cli' }),
        runCli: async () => JSON.stringify({ boards: [{ name: 'ESP32S3 Dev Module', fqbn: 'esp32:esp32:esp32s3' }] })
      };
      return originalLoad.call(this, name, ...args);
    };
    extension = require('../src/extension');
  } finally { Module._load = originalLoad; }
  const result = extension.activate({ subscriptions: [], globalStorageUri: { fsPath: path.resolve('.tmp/activation') }, globalState: { get: () => true } });
  assert.equal(result, undefined, '不能等待另一个插件而阻塞自身激活');
  assert.equal(status.command, 'arduinoLive.showDiagnostics');
  await commands.get('arduinoLive.menu')();
  assert.match(panel.webview.html, /无需保存/);
  assert.match(panel.webview.html, /顶部选择开发板/);
  await commands.get('arduinoLive.selectBoard')();
  assert.equal(values.fqbn, 'esp32:esp32:esp32s3', '同步信任状态为 false 也必须允许选择开发板');
  assert.equal(values.followIdeBoard, false);
  await extension.deactivate();
});

'use strict';
// Real Arduino Language Server test. No didSave notification and no edits to
// the on-disk sketch: both the error and its repair exist only in LSP buffers.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL, fileURLToPath } = require('node:url');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const { discoverTools } = require('../src/tools');
const { serverArgs } = require('../src/core');
const { sessionEnvironment } = require('../src/esp-toolchain');
const { diagnosticCapabilities } = require('../src/diagnostics-client');
const { diagnosticRange } = require('../src/diagnostic-location');
const { documentSync } = require('../src/document-sync');
const { prepareSource } = require('../src/source-engine');
const { fixLocation } = require('../src/fix-location');

async function main() {
  const root = path.resolve(__dirname, '../.tmp/integration/RealtimeProbe');
  fs.mkdirSync(root, { recursive: true });
  const file = path.join(root, 'RealtimeProbe.ino');
  const valid = 'void setup() { int value = 0; (void)value; }\nvoid loop() {\n  int value = 100;\n  int bai = 0; // 百位计数\n  if(value > 99)\n  {\n    value = 0;\n    bai++;\n    if(bai > 9)\n      bai = 0;\n  }\n}\n'.replaceAll('\n', '\r\n');
  fs.writeFileSync(file, valid);
  const tools = discoverTools({ arduinoIdePath: process.env.ARDUINO_IDE_PATH, cliPath: process.env.ARDUINO_CLI_PATH,
    languageServerPath: process.env.ARDUINO_LS_PATH, clangdPath: process.env.CLANGD_PATH, cliConfigPath: process.env.ARDUINO_CLI_CONFIG });
  assert.ok(tools.cli && tools.server && tools.clangd, '需要 Arduino IDE 2 自带的三个工具，或通过环境变量指定路径');
  const fqbn = process.env.ARDUINO_FQBN || 'arduino:avr:uno';
  const session = sessionEnvironment(path.resolve(__dirname, '../.tmp/integration-tools'), fqbn);
  const source = await prepareSource(tools, fqbn, root, session, []);
  const child = spawn(tools.clangd, source.args, { cwd: root, env: session.env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const log = fs.createWriteStream(path.join(root, '../server.log'));
  child.stderr.pipe(log);
  let buffer = Buffer.alloc(0);
  let sequence = 0;
  let diagnosticSequence = 0;
  const requests = new Map();
  const waiters = new Set();
  const uri = pathToFileURL(file + '.arduino-live.cpp').href;
  const rootUri = pathToFileURL(root).href;
  const send = message => {
    const body = Buffer.from(JSON.stringify({ jsonrpc: '2.0', ...message }));
    child.stdin.write(Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`), body]));
  };
  const request = (method, params) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { requests.delete(id); reject(new Error(`Timeout: ${method}`)); }, 120000);
    requests.set(id, { resolve, reject, timer });
    send({ id, method, params });
  });
  const notify = (method, params) => send({ method, params });
  function waitDiagnostics(predicate) {
    const after = diagnosticSequence;
    return new Promise((resolve, reject) => {
      const waiter = { after, predicate, resolve, reject, timer: undefined };
      waiter.timer = setTimeout(() => { waiters.delete(waiter); reject(new Error('未收到预期的实时诊断，请检查 .tmp/integration/server.log')); }, 120000);
      waiters.add(waiter);
    });
  }
  function dispatch(message) {
    if (message.method && message.id !== undefined) {
      const result = message.method === 'workspace/configuration' ? message.params.items.map(() => ({}))
        : message.method === 'workspace/workspaceFolders' ? [{ uri: rootUri, name: 'RealtimeProbe' }] : null;
      send({ id: message.id, result });
    } else if (message.id !== undefined) {
      const pending = requests.get(message.id);
      if (pending) {
        clearTimeout(pending.timer); requests.delete(message.id);
        if (message.error) pending.reject(new Error(JSON.stringify(message.error))); else pending.resolve(message.result);
      }
    } else if (message.method === 'textDocument/publishDiagnostics' && path.resolve(fileURLToPath(message.params.uri)).toLowerCase() === path.resolve(fileURLToPath(uri)).toLowerCase()) {
      diagnosticSequence++;
      for (const waiter of [...waiters]) if (diagnosticSequence > waiter.after && waiter.predicate(message.params)) {
        clearTimeout(waiter.timer); waiters.delete(waiter); waiter.resolve(message.params);
      }
    }
  }
  child.stdout.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const end = buffer.indexOf('\r\n\r\n');
      if (end < 0) return;
      const match = /Content-Length:\s*(\d+)/i.exec(buffer.subarray(0, end).toString());
      if (!match) throw new Error('Invalid LSP frame');
      const size = Number(match[1]);
      if (buffer.length < end + 4 + size) return;
      dispatch(JSON.parse(buffer.subarray(end + 4, end + 4 + size).toString()));
      buffer = buffer.subarray(end + 4 + size);
    }
  });
  const failPending = error => {
    for (const pending of requests.values()) { clearTimeout(pending.timer); pending.reject(error); }
    requests.clear();
    for (const waiter of waiters) { clearTimeout(waiter.timer); waiter.reject(error); }
    waiters.clear();
  };
  child.on('error', failPending);
  child.on('exit', code => failPending(new Error(`Language server exited: ${code}`)));
  try {
    const init = await request('initialize', { processId: process.pid, rootUri, rootPath: root,
      workspaceFolders: [{ uri: rootUri, name: 'RealtimeProbe' }],
      capabilities: diagnosticCapabilities({ workspace: { configuration: true, workspaceFolders: true,
        semanticTokens: { refreshSupport: true }, inlayHint: { refreshSupport: true }, diagnostics: { refreshSupport: true } },
        textDocument: { synchronization: { didSave: true }, publishDiagnostics: { relatedInformation: true, versionSupport: true },
          semanticTokens: { requests: { full: true }, tokenTypes: ['variable'], tokenModifiers: [], formats: ['relative'] } } }) });
    console.log('Initialized:', JSON.stringify(init.capabilities.textDocumentSync));
    notify('initialized', {});
    const initial = waitDiagnostics(p => p.diagnostics.some(d => /missingOnOpen/.test(d.message)));
    const initialText = valid.replace('0', 'missingOnOpen');
    const sync = documentSync(root);
    await sync.didOpen({ uri: { scheme: 'file', fsPath: file, toString: () => uri }, version: 1, getText: () => initialText }, document => {
      notify('textDocument/didOpen', { textDocument: { uri, languageId: 'cpp', version: document.version, text: document.getText() } });
    });
    await initial;
    const initialRepair = waitDiagnostics(p => p.diagnostics.length === 0);
    const valueColumn = valid.indexOf('0');
    notify('textDocument/didChange', { textDocument: { uri, version: 2 }, contentChanges: [{
      range: { start: { line: 0, character: valueColumn }, end: { line: 0, character: valueColumn + 'missingOnOpen'.length } }, text: '0'
    }] });
    await initialRepair;
    const errorResult = waitDiagnostics(p => p.diagnostics.some(d => /missingName/.test(d.message)));
    const errorStart = Date.now();
    notify('textDocument/didChange', { textDocument: { uri, version: 3 }, contentChanges: [{
      range: { start: { line: 0, character: valueColumn }, end: { line: 0, character: valueColumn + 1 } }, text: 'missingName'
    }] });
    const errors = await errorResult;
    const errorLatencyMs = Date.now() - errorStart;
    const repairResult = waitDiagnostics(p => p.diagnostics.length === 0);
    const repairStart = Date.now();
    notify('textDocument/didChange', { textDocument: { uri, version: 4 }, contentChanges: [{
      range: { start: { line: 0, character: valueColumn }, end: { line: 0, character: valueColumn + 'missingName'.length } }, text: '0'
    }] });
    await repairResult;
    const repairLatencyMs = Date.now() - repairStart;
    const syntaxResult = waitDiagnostics(p => p.diagnostics.some(d => d.severity === 1 && /expected|condition/i.test(d.message)));
    const syntaxStart = Date.now();
    notify('textDocument/didChange', { textDocument: { uri, version: 5 }, contentChanges: [{
      range: { start: { line: 4, character: 4 }, end: { line: 4, character: 16 } }, text: ''
    }] });
    const syntaxErrors = await syntaxResult;
    const brokenLines = valid.replace('if(value > 99)', 'if').split('\n');
    const brokenDocument = { lineCount: brokenLines.length, lineAt: line => ({ text: brokenLines[line] }) };
    const missingCondition = syntaxErrors.diagnostics.find(d => /after 'if'/i.test(d.message));
    assert.ok(missingCondition, '应具体诊断缺失的 if 条件');
    const locatedSyntax = diagnosticRange(brokenDocument, missingCondition);
    assert.equal(locatedSyntax.start.line, 4, '红线应定位到 if 本身');
    assert.equal(locatedSyntax.start.character, 2);
    const syntaxLatencyMs = Date.now() - syntaxStart;
    const syntaxRepair = waitDiagnostics(p => p.diagnostics.length === 0);
    notify('textDocument/didChange', { textDocument: { uri, version: 6 }, contentChanges: [{
      range: { start: { line: 4, character: 4 }, end: { line: 4, character: 4 } }, text: '(value > 99)'
    }] });
    await syntaxRepair;
    const semicolonResult = waitDiagnostics(p => p.diagnostics.some(d => String(d.code).startsWith('expected_semi')));
    notify('textDocument/didChange', { textDocument: { uri, version: 7 }, contentChanges: [{ range: { start: { line: 6, character: 13 }, end: { line: 6, character: 14 } }, text: '' }] });
    const semicolonErrors = await semicolonResult;
    const semicolonError = semicolonErrors.diagnostics.find(d => String(d.code).startsWith('expected_semi'));
    const noSemicolon = valid.replace('    value = 0;', '    value = 0');
    const semicolonUnderline = await fixLocation({ getText: () => noSemicolon }, semicolonError, uri, async params => {
      const actions = await request('textDocument/codeAction', params);
      fs.writeFileSync(path.join(root, '../fix-actions.json'), JSON.stringify(actions, null, 2));
      return actions;
    });
    assert.ok(semicolonUnderline, '编译器修复建议应给出分号的真实位置');
    assert.equal(semicolonUnderline.start.line, 6, '应标记缺分号的语句本身');
    const semicolonRepair = waitDiagnostics(p => p.diagnostics.length === 0);
    notify('textDocument/didChange', { textDocument: { uri, version: 8 }, contentChanges: [{ range: { start: { line: 6, character: 13 }, end: { line: 6, character: 13 } }, text: ';' }] });
    await semicolonRepair;
    assert.equal(fs.readFileSync(file, 'utf8'), valid, '磁盘上的文件不能发生变化');
    const result = { passed: true, fqbn, initialUnsavedDetected: true, windowsLineEndings: true, savedDuringTest: false, errorLatencyMs, repairLatencyMs, syntaxLatencyMs,
      syntaxDiagnostics: syntaxErrors.diagnostics.map(d => ({ message: d.message, line: d.range.start.line + 1 })),
      syntaxUnderline: { line: locatedSyntax.start.line + 1, startColumn: locatedSyntax.start.character + 1, endColumn: locatedSyntax.end.character + 1 },
      semicolonUnderline: { line: semicolonUnderline.start.line + 1, column: semicolonUnderline.start.character + 1 },
      diagnostics: errors.diagnostics.map(d => ({ message: d.message, line: d.range.start.line + 1 })) };
    fs.writeFileSync(path.join(root, '../result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    await request('shutdown', null);
    notify('exit');
  } finally {
    child.stderr.unpipe(log);
    child.kill();
    failPending(new Error('Test ended'));
    log.end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

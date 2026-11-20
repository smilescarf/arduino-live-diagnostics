'use strict';

const vscode = require('vscode');
const path = require('node:path');
const { LanguageClient, State } = require('vscode-languageclient/node');
const { diagnosticsClientClass } = require('./diagnostics-client');
const DiagnosticsLanguageClient = diagnosticsClientClass(LanguageClient);
const { findSketch, parseBoards, translatedMessage, isWithin, effectiveFqbn, uriKey } = require('./core');
const { discoverTools, runCli } = require('./tools');
const { isEspBoard, ensureEspClangd, sessionEnvironment } = require('./esp-toolchain');
const fs = require('node:fs');
const { pathToFileURL, fileURLToPath } = require('node:url');
const { createDashboard } = require('./dashboard');
const { createTrustGate } = require('./trust');
const { documentSelector, documentSync } = require('./document-sync');
const { diagnosticRange } = require('./diagnostic-location');
const { createErrorList } = require('./error-list');
const { installLearning, compilerLibraries, includes, includeSignature } = require('./learning');
const { prepareSource, writePrototypes } = require('./source-engine');
const { fixLocation } = require('./fix-location');
const { missingDigitalWrite, compilerArgumentMessage } = require('./authoring-core');
const {punctuationPlan}=require('./punctuation');

const sessions = new Map();
const preparations = new Map();
let output;
let status;
let restarting = Promise.resolve();
let configuring = false;
let disposed = false;
let toolStorage;
let generation = 0;
let arduinoContext;
let configurationUpdates = 0;
let dashboard;
let trustGate;
let learning;
const starting = new Set();
const engineSettings = ['enabled', 'fqbn', 'followIdeBoard', 'arduinoIdePath', 'cliPath', 'languageServerPath', 'clangdPath', 'espClangdPath', 'cliConfigPath', 'chineseExplanations'];

function settings(uri) {
  const c = vscode.workspace.getConfiguration('arduinoLive', uri);
  const config = Object.fromEntries(engineSettings.map(key => [key, c.get(key)]));
  config.fqbn = effectiveFqbn(config, arduinoContext, uri?.fsPath);
  return config;
}

function setStatus(text, detail) {
  status.text = `$(pulse) 实时检查：${text}`;
  status.tooltip = `${detail || '输入时检查代码，不需要保存。'}\n点击打开菜单：配置、选板、使用说明、日志。`;
  if (dashboard) {
    dashboard.model.setStatus(text, detail || '输入时检查代码，不需要保存。', settings(activeUri()).fqbn);
    dashboard.refresh();
  }
}

async function ensureDocument(document) {
  if (disposed || configuring || document.uri.scheme !== 'file') return;
  if (!/\.(ino|cpp|c|h|hpp)$/i.test(document.fileName)) return;
  const folder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!folder) { setStatus('请打开工程文件夹'); return; }
  const sketch = findSketch(document.fileName, folder.uri.fsPath);
  if (!sketch) { if (document.fileName.endsWith('.ino')) setStatus('工程命名待检查', '主 .ino 文件必须与所在文件夹同名。'); return; }
  if (sessions.has(sketch) || preparations.has(sketch) || starting.has(sketch)) return;
  const attemptGeneration = generation;
  starting.add(sketch);
  try { await startDocument(document, folder, sketch); }
  finally {
    starting.delete(sketch);
    if (!disposed && generation !== attemptGeneration) void ensureDocument(document).catch(error => output.appendLine(String(error)));
  }
}

async function startDocument(document, folder, sketch) {
  const currentGeneration = generation;
  const config = settings(document.uri);
  if (!config.enabled) { setStatus('已关闭'); return; }
  const tools = discoverTools(config);
  if (!tools.cli || !tools.clangd || tools.invalidConfig || !config.fqbn) {
    setStatus('点击配置', '需要 Arduino CLI、clangd 和开发板型号。');
    return;
  }
  if (!await trustGate.check()) {
    setStatus('等待工作区信任确认', '开发板可以正常选择；启动检查需要你在 IDE 中确认信任。确认后点击“重启实时检查”。');
    return;
  }
  if (disposed || generation !== currentGeneration) return;
  if (isEspBoard(config.fqbn)) {
    if (config.espClangdPath) {
      if (!fs.existsSync(config.espClangdPath)) throw new Error('espClangdPath 指定的文件不存在。');
      tools.clangd = config.espClangdPath;
    } else {
      setStatus('正在准备 ESP32 工具…');
      const preparation = vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Arduino Live: ESP32 诊断工具' },
        progress => ensureEspClangd(toolStorage, message => progress.report({ message })));
      preparations.set(sketch, preparation);
      try { tools.clangd = await preparation; }
      finally { if (preparations.get(sketch) === preparation) preparations.delete(sketch); }
    }
    if (disposed || currentGeneration !== generation || sessions.has(sketch)) return;
  }
  const environment = sessionEnvironment(toolStorage, config.fqbn);
  setStatus('正在读取开发板编译参数…', '首次准备后直接检查原始 .ino 文件，避免预处理副本的行号偏移。');
  let source;
  const preparation = prepareSource(tools, config.fqbn, sketch, environment, vscode.workspace.textDocuments);
  preparations.set(sketch, preparation);
  try { source = await preparation; }
  catch (error) { cleanupSession(environment.tempDir); setStatus('读取编译参数失败', error.message); throw error; }
  finally { if (preparations.get(sketch) === preparation) preparations.delete(sketch); }
  if (disposed || generation !== currentGeneration) { cleanupSession(environment.tempDir); return; }
  let receivedDiagnostics = false;
  let diagnosticTimer;
  let libraryTimer;
  const client = new DiagnosticsLanguageClient(
    'arduinoLive', `Arduino Live (${path.basename(sketch)})`,
    { command: tools.clangd, args: source.args, options: { cwd: sketch, env: environment.env } },
    {
      documentSelector,
      uriConverters: {
        code2Protocol: uri => uri.scheme === 'file' && /\.ino$/i.test(uri.fsPath) ? pathToFileURL(uri.fsPath + '.arduino-live.cpp').href : uri.toString(),
        protocol2Code: uri => /\.ino\.arduino-live\.cpp$/i.test(uri) ? vscode.Uri.file(fileURLToPath(uri).slice(0, -'.arduino-live.cpp'.length)) : vscode.Uri.parse(uri)
      },
      currentDocumentVersion: uri => {
        if (!uri.startsWith('file:')) return undefined;
        const file = fileURLToPath(uri).replace(/\.arduino-live\.cpp$/i, '');
        return vscode.workspace.textDocuments.find(document => document.uri.scheme === 'file' && uriKey(document.uri) === uriKey(vscode.Uri.file(file)))?.version;
      },
      workspaceFolder: folder,
      outputChannel: output,
      revealOutputChannelOn: 4,
      diagnosticCollectionName: `arduino-live:${sketch}`,
      middleware: {
        ...documentSync(sketch, document => {
          output.appendLine(`同步未保存文档：${document.uri.toString()}（版本 ${document.version}）`);
          sessions.get(sketch)?.includeSignatures.set(uriKey(document.uri), includeSignature(document.getText()));
        }, event => {
          if (sessions.get(sketch)?.client !== client) return;
          dashboard.model.markPending(event.document.uri);
          writePrototypes(source.header, sketch, vscode.workspace.textDocuments);
          const signature = includeSignature(event.document.getText());
          const entry = sessions.get(sketch);
          const key = uriKey(event.document.uri);
          if (entry.includeSignatures.get(key) !== signature) {
            entry.includeSignatures.set(key, signature);
            clearTimeout(libraryTimer);
            libraryTimer = setTimeout(() => { void restart(); }, 700);
          }
          setStatus(`${config.fqbn.split(':')[2]} · 正在检查最新修改…`, '代码已修改，等待诊断引擎返回新结果。列表中的旧结果会明确标记，无需保存。');
        }),
        async handleDiagnostics(uri, diagnostics, next) {
          if (uri.scheme !== 'file' || !isWithin(sketch, uri.fsPath)) return;
          const document = vscode.workspace.textDocuments.find(document => uriKey(document.uri) === uriKey(uri));
          const version = document?.version;
          const originals=diagnostics.map(d=>client.code2ProtocolConverter.asDiagnostic(d));
          for (const diagnostic of diagnostics) {
            let located = diagnosticRange(document, diagnostic);
            const punctuation=document&&punctuationPlan(document.getText(),diagnostic.range);
            if(punctuation&&/expected|unexpected|invalid|extraneous|unicode|U\+FF|[（）［］｛｝；，：]/i.test(String(diagnostic.code)+' '+diagnostic.message)){
              const symbol=punctuation.symbols.filter(s=>s.start.line===diagnostic.range.start.line).sort((a,b)=>Math.abs(a.start.character-diagnostic.range.start.character)-Math.abs(b.start.character-diagnostic.range.start.character))[0]||punctuation.symbols[0];
              located={start:symbol.start,end:{line:symbol.start.line,character:symbol.start.character+1}};
              diagnostic.message+='\n中文提示：'+punctuation.reason;
            }
            const argumentHelp=document&&missingDigitalWrite(document.getText(),document.offsetAt(diagnostic.range.start),compilerArgumentMessage(diagnostic));
            if(argumentHelp){located={start:document.positionAt(argumentHelp.start),end:document.positionAt(argumentHelp.end)};diagnostic.message+='\n中文提示：'+argumentHelp.message;}
            if (document && !punctuation && String(typeof diagnostic.code === 'object' ? diagnostic.code.value : diagnostic.code).startsWith('expected_semi')) {
              try {
                located = await fixLocation(document, diagnostic, client.code2ProtocolConverter.asUri(uri), params => client.sendRequest('textDocument/codeAction', params), client.code2ProtocolConverter.asDiagnostic(diagnostic)) || located;
              } catch (error) { output.appendLine(`保留编译器定位：${error.message}`); }
            }
            if (located !== diagnostic.range) {
              const original = new vscode.DiagnosticRelatedInformation(new vscode.Location(uri, diagnostic.range), '编译器最初发现语法无法继续解析的位置。');
              diagnostic.relatedInformation = [...(diagnostic.relatedInformation || []), original];
              diagnostic.range = new vscode.Range(located.start.line, located.start.character, located.end.line, located.end.character);
            }
          }
          if (sessions.get(sketch)?.client !== client || (document && document.version !== version)) return;
          sessions.get(sketch).diagnosticsCache.set(uriKey(uri), {version,records:diagnostics.map((d,i)=>({protocol:originals[i],display:d.range}))});
          if (settings(uri).chineseExplanations) {
            for (const diagnostic of diagnostics) {
              diagnostic.message = translatedMessage(diagnostic.message);
              diagnostic.source = 'Arduino Live';
            }
          }
          next(uri, diagnostics);
          if (sessions.get(sketch)?.client === client && uri.scheme === 'file' && isWithin(sketch, uri.fsPath)) {
            receivedDiagnostics = true;
            clearTimeout(diagnosticTimer);
            output.appendLine(`收到诊断：${uri.toString()}（${diagnostics.length} 项）`);
            dashboard.model.update(uri, diagnostics);
            const pending = dashboard.model.pending.size > 0;
            setStatus(pending ? `${config.fqbn.split(':')[2]} · 正在检查最新修改…` : `${config.fqbn.split(':')[2]} · 已就绪${diagnostics.length ? ` · ${diagnostics.length} 项问题` : ''}`, `当前诊断板型：${config.fqbn}\n悬停在代码波浪线上查看报错和中文提示。`);
          }
        }
      }
    }
  );
  // Register before awaiting: simultaneous open/change events must share one client.
  const entry = { client, start: undefined, diagnosticsCache:new Map(), tempDir: environment.tempDir, sourceDatabase: source.database, includeSignatures: new Map(), clearTimer: () => { clearTimeout(diagnosticTimer); clearTimeout(libraryTimer); } };
  sessions.set(sketch, entry);
  client.onDidChangeState(event => {
    if (sessions.get(sketch) !== entry) return;
    if (event.newState === State.Stopped) {
      clearTimeout(diagnosticTimer);
      receivedDiagnostics = false;
      dashboard.model.clear();
      setStatus('诊断服务已停止 · 请查看日志', '诊断连接已中断。请打开日志查看原因，或在插件菜单中重启实时检查。');
    }
  });
  setStatus('正在建立索引…', '首次启动需要解析开发板和库，之后会同步未保存的编辑。');
  entry.start = client.start();
  try {
    await entry.start;
    if (!disposed && sessions.get(sketch) === entry && !receivedDiagnostics) {
      setStatus(`${config.fqbn.split(':')[2]} · 正在解析…`, `开发板：${config.fqbn}\n诊断工具：${tools.clangd}\n等待首次解析完成。之后输入时自动检查，无需保存。`);
      diagnosticTimer = setTimeout(() => {
        if (!disposed && sessions.get(sketch) === entry && !receivedDiagnostics) {
          output.appendLine('连接已建立，但 120 秒内未收到首次诊断。请查看以上语言服务日志。');
          setStatus('首次诊断超时 · 请查看日志', '已等待 120 秒，尚不能确认实时检查正常。打开插件菜单 → 查看诊断日志，检查开发板、库或语言服务错误。');
        }
      }, 120000);
      diagnosticTimer.unref?.();
    }
  } catch (error) {
    clearTimeout(diagnosticTimer);
    if (sessions.get(sketch) === entry) sessions.delete(sketch);
    try { await client.dispose(); } catch { /* Startup already failed. */ }
    cleanupSession(environment.tempDir);
    output.appendLine(error.stack||String(error));
    setStatus('启动失败', String(error));
    const choice = await vscode.window.showErrorMessage('Arduino 实时诊断启动失败。请检查工具路径、开发板核心及日志。', '查看日志', '配置');
    if (choice === '查看日志') output.show();
    if (choice === '配置') await setup();
  }
}

function cleanupSession(tempDir) {
  // Only ever remove a directory created below this extension's session root.
  const root = path.resolve(toolStorage, 'sessions');
  const target = path.resolve(tempDir);
  if (target !== root && isWithin(root, target)) {
    try { fs.rmSync(target, { recursive: true, force: true }); }
    catch (error) { output.appendLine(`临时目录稍后清理：${error.message}`); }
  }
}

async function stopAll() {
  const entries = [...sessions.values()];
  sessions.clear();
  dashboard?.model.clear();
  dashboard?.refresh();
  await Promise.all(entries.map(async ({ client, start, tempDir, clearTimer }) => {
    clearTimer?.();
    try { await start; await client.dispose(); } catch (error) { output.appendLine(`停止服务：${error}`); }
    finally { cleanupSession(tempDir); }
  }));
}

function restart() {
  restarting = restarting.then(async () => {
    generation++;
    await stopAll();
    await Promise.allSettled([...preparations.values()]);
    if (disposed || configuring) return;
    for (const document of vscode.workspace.textDocuments) await ensureDocument(document);
  }).catch(error => output.appendLine(String(error)));
  return restarting;
}

function activeUri() {
  return vscode.window.activeTextEditor?.document.uri || vscode.workspace.textDocuments.find(document => document.uri.scheme === 'file' && /\.ino$/i.test(document.fileName))?.uri || vscode.workspace.workspaceFolders?.[0]?.uri;
}

async function pickTool(key, label) {
  const result = await vscode.window.showOpenDialog({ canSelectMany: false, canSelectFiles: true, canSelectFolders: false, openLabel: `选择 ${label}`, title: `选择 ${label} 可执行文件` });
  if (!result?.length) return false;
  await vscode.workspace.getConfiguration('arduinoLive').update(key, result[0].fsPath, vscode.ConfigurationTarget.Global);
  return true;
}

async function selectBoard(uri = activeUri()) {
  if (!uri || !vscode.workspace.getWorkspaceFolder(uri)) {
    await vscode.window.showInformationMessage('请先打开包含 Arduino 工程的文件夹。');
    return;
  }
  const tools = discoverTools(settings(uri));
  if (!tools.cli) throw new Error('尚未找到 Arduino CLI，请先运行配置工具命令。');
  const previous = { status: dashboard.model.status, detail: dashboard.model.detail };
  const restore = () => { if (dashboard.model.status === '正在读取开发板列表…') setStatus(previous.status, previous.detail); };
  setStatus('正在读取开发板列表…');
  const boards = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: '读取本机已安装的开发板…' },
    async () => parseBoards(JSON.parse(await runCli(tools, ['board', 'listall', '--json'])))).catch(error => { restore(); throw error; });
  if (!boards.length) throw new Error('未发现已安装的开发板。请先在 Arduino IDE 开发板管理器中安装对应核心，再重试。');
  if (arduinoContext?.fqbn) boards.unshift({ label: '$(sync) 跟随 IDE 顶部选择的开发板（推荐）', description: arduinoContext.fqbn, follow: true });
  const board = await vscode.window.showQuickPick(boards, { title: '实时检查使用哪个开发板？', matchOnDescription: true, placeHolder: '搜索 Uno、ESP32S3；或选择跟随 IDE 顶部板型' });
  if (board) {
    const config = vscode.workspace.getConfiguration('arduinoLive', uri);
    configurationUpdates++;
    try {
      await config.update('followIdeBoard', Boolean(board.follow), vscode.ConfigurationTarget.WorkspaceFolder);
      if (!board.follow) await config.update('fqbn', board.description, vscode.ConfigurationTarget.WorkspaceFolder);
    } finally { configurationUpdates--; }
    trustGate.retry();
    setStatus(`已选择 ${board.description}`, '开发板已保存，正在准备实时诊断。');
    if (!configuring) await restart();
  } else restore();
}

async function setup() {
  if (configuring) return;
  configuring = true;
  try {
    const uri = activeUri();
    let tools = discoverTools(settings(uri));
    if (!tools.cli || !tools.clangd) {
      const choice = await vscode.window.showQuickPick(['选择 Arduino IDE 2 安装目录（推荐）', '分别选择 CLI 和 clangd'], { title: 'Arduino Live 首次配置' });
      if (!choice) return;
      if (choice.startsWith('选择 Arduino IDE')) {
        const selected = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: false, openLabel: '选择 Arduino IDE 2 目录' });
        if (!selected?.length) return;
        await vscode.workspace.getConfiguration('arduinoLive').update('arduinoIdePath', selected[0].fsPath, vscode.ConfigurationTarget.Global);
      }
      tools = discoverTools(settings(uri));
      for (const [tool, key, name] of [['cli', 'cliPath', 'arduino-cli'], ['clangd', 'clangdPath', 'clangd']]) {
        if (!tools[tool] && !await pickTool(key, name)) return;
      }
    }
    tools = discoverTools(settings(uri));
    if (tools.invalidConfig) throw new Error('cliConfigPath 指定的文件不存在，请先在设置中修正。');
    await runCli(tools, ['version', '--json']);
    await selectBoard(uri);
  } finally {
    configuring = false;
    await restart();
  }
}

function showGuide() {
  const panel = vscode.window.createWebviewPanel('arduinoLiveGuide', 'Arduino 实时检查 · 使用说明', vscode.ViewColumn.Beside, { enableScripts: false });
  panel.webview.html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';"><style>body{font-family:var(--vscode-font-family),sans-serif;line-height:1.8;padding:20px;max-width:760px}h1{font-size:24px}li{margin:12px 0}code{background:var(--vscode-textCodeBlock-background);padding:2px 5px}.tip{border-left:3px solid var(--vscode-focusBorder);padding:8px 16px}</style></head><body>
  <h1>Arduino 实时检查</h1><p>边写边检查代码。发现问题后显示波浪线，鼠标停上去可看原始报错和中文提示。</p>
  <ol><li><strong>打开你的 .ino 工程。</strong>代码仍使用 IDE 原有的 C++ 语法配色。</li>
  <li><strong>在 IDE 顶部选择开发板。</strong>默认自动跟随，无需连接 USB，也不需要上传。</li>
  <li><strong>看底部“实时检查”状态。</strong>首次建立索引需要等待；“正在解析…”时还没完成检查，“已就绪”后开始正常诊断。</li>
  <li><strong>直接修改代码。</strong>无需保存。波浪线出现后，将鼠标停在错误上查看提示；修正后会自动消失。</li></ol>
  <p class="tip">入口一直在底部的“实时检查”按钮，也可以点击代码标签栏右上角的脉冲图标。菜单中有“开始配置”“选择开发板”“查看诊断日志”和“使用说明”。</p>
  <h2>试一下</h2><p>在函数里输入 <code>int value = missingName;</code>。正常应提示 missingName 尚未声明。改成 <code>int value = 0;</code> 后，错误会消失。请在演示工程中试验。</p>
  <h2>如果还没开始检查</h2><p>底部显示“点击配置”时，打开菜单选择“开始配置”。工具通常能从你现有的 Arduino IDE 中自动找到。选择“跟随 IDE 顶部板型”即可；在 VS Code 中则手动选择板型。</p>
  <p>顶部板型跟随模式可在“选择开发板”中恢复；手动选定另一块板子时，诊断会按手动板型工作。静态诊断不能检查接线或所有运行时故障。</p></body></html>`;
}

async function showMenu() {
  const config = settings(activeUri());
  const selected = await vscode.window.showQuickPick([
    { label: '$(layout-panel) 显示在底部（大面板）', description: '类似 Visual Studio 的错误列表', action: () => showDiagnostics('bottom', true) },
    { label: '$(layout-sidebar-left) 显示在左侧', description: '停靠到侧边栏，持续查看诊断', action: () => showDiagnostics('left', true) },
    { label: '$(beaker) 实验模板', description: '课件实验、传感器、显示屏、Wi-Fi、BLE 与综合作业', action: () => learning.openTemplates() },
    { label: '$(book) 函数与库助手', description: '中文函数说明、当前包含库的声明和示例', action: () => learning.openFunctions() },
    { label: '$(code) 插入功能片段', description: '按键消抖、millis 定时、模拟读取；预览后合并到当前代码', action: () => learning.openFragments() },
    { label: '$(lightbulb) 预览当前位置修复', description: '在错误处按 Ctrl+. 也可查看；应用前先预览差异', action: () => learning.showFixes() },
    { label: '$(play) 开始配置 / 重新配置', description: '第一次使用点这里', action: setup },
    { label: '$(circuit-board) 选择开发板', description: config.fqbn || '尚未选择', action: selectBoard },
    { label: '$(book) 使用说明', description: '查看操作步骤和报错示例', action: showGuide },
    { label: '$(refresh) 重启实时检查', description: '重新建立诊断连接', action: () => { trustGate.retry(); return restart(); } },
    { label: '$(output) 查看诊断日志', description: '启动失败或没有提示时查看', action: () => output.show() }
  ], { title: 'Arduino 实时检查', placeHolder: status.text.replace(/\$\([^)]*\)\s*/g, '') });
  if (selected) await selected.action();
}

async function showDiagnostics(location, persist = false) {
  const config = vscode.workspace.getConfiguration('arduinoLive');
  const selected = location || config.get('viewLocation') || 'bottom';
  if (persist) await config.update('viewLocation', selected, vscode.ConfigurationTarget.Global);
  await vscode.commands.executeCommand('setContext', 'arduinoLive.location', selected);
  const id = selected === 'left' ? 'arduinoLive.diagnosticsSidebar' : 'arduinoLive.diagnosticsPanel';
  try { await vscode.commands.executeCommand(`${id}.focus`); }
  catch (error) { output.appendLine(`打开诊断视图：${error.message}`); }
}

function activate(context) {
  toolStorage = context.globalStorageUri?.fsPath || context.globalStoragePath;
  output = vscode.window.createOutputChannel('Arduino Live');
  dashboard = createDashboard(vscode);
  trustGate = createTrustGate(vscode.workspace, () => setStatus('正在确认工作区信任…', '请选择 IDE 中的信任提示；开发板列表不受此状态影响。'));
  status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 40);
  status.command = 'arduinoLive.showDiagnostics';
  setStatus('等待 Arduino 工程');
  status.show();
  const safe = fn => (...args) => Promise.resolve().then(() => fn(...args)).catch(error => {
    output.appendLine(error.stack||String(error));
    void vscode.window.showErrorMessage(`Arduino Live: ${error.message || error}`);
  });
  learning = installLearning(vscode, {
    document: () => {
      const active=vscode.window.activeTextEditor?.document;
      return active?.uri.scheme==='file'?active:vscode.workspace.textDocuments.find(document=>document.uri.scheme==='file'&&/\.ino$/i.test(document.fileName));
    },
    log:message=>output.appendLine(message),
    fqbn: () => settings(activeUri()).fqbn,
    diagnostics: document => {
      const folder=vscode.workspace.getWorkspaceFolder(document.uri),sketch=folder&&findSketch(document.fileName,folder.uri.fsPath);
      const cached=sessions.get(sketch)?.diagnosticsCache.get(uriKey(document.uri));
      return cached?.version===document.version?cached.records:[];
    },
    languageRequest: async (document,method,params,token) => {
      const folder=vscode.workspace.getWorkspaceFolder(document.uri),sketch=folder&&findSketch(document.fileName,folder.uri.fsPath);
      const entry=sessions.get(sketch),client=entry?.client;
      if(!client?.isRunning())return; // A running session has already passed the workspace trust gate.
      const version=document.version,protocolUri=client.code2ProtocolConverter.asUri(document.uri);
      const raw=await client.sendRequest(method,{...params,textDocument:{uri:protocolUri}},token);
      if(sessions.get(sketch)!==entry||document.version!==version)return;
      const value=method==='textDocument/completion'?await client.protocol2CodeConverter.asCompletionResult(raw,undefined,token):
        method==='textDocument/signatureHelp'?await client.protocol2CodeConverter.asSignatureHelp(raw,token):undefined;
      return {raw,value,protocolUri};
    },
    isSketch: document => {
      const folder = vscode.workspace.getWorkspaceFolder(document.uri);
      return Boolean(folder && findSketch(document.fileName, folder.uri.fsPath));
    },
    libraries: async () => {
      const uri = activeUri();
      const installed = JSON.parse(await runCli(discoverTools(settings(uri)), ['lib', 'list', '--json'])).installed_libraries || [];
      const folder = uri && vscode.workspace.getWorkspaceFolder(uri);
      const sketch = folder && findSketch(uri.fsPath, folder.uri.fsPath);
      return [...installed, ...compilerLibraries(sessions.get(sketch)?.tempDir), ...(sketch ? [{ library: { name: '当前工程头文件', source_dir: sketch, install_dir: sketch } }] : [])];
    }
  });
  const errorList = createErrorList(vscode, dashboard, {
    board: safe(() => selectBoard()), functions: safe(() => learning.openFunctions()),
    templates: safe(() => learning.openTemplates()), restart: safe(() => restart()),
    fragments:safe(()=>learning.openFragments()),fixes:safe(()=>learning.showFixes())
  });
  const treeRefresh = dashboard.refresh;
  dashboard.refresh = () => { treeRefresh(); errorList.refresh(); };
  context.subscriptions.push(output, status, dashboard,
    learning, errorList,
    vscode.window.registerWebviewViewProvider('arduinoLive.diagnosticsPanel', errorList),
    vscode.window.registerTreeDataProvider('arduinoLive.diagnosticsSidebar', dashboard),
    vscode.commands.registerCommand('arduinoLive.showDiagnostics', safe(() => showDiagnostics())),
    vscode.commands.registerCommand('arduinoLive.showBottom', safe(() => showDiagnostics('bottom', true))),
    vscode.commands.registerCommand('arduinoLive.showLeft', safe(() => showDiagnostics('left', true))),
    vscode.commands.registerCommand('arduinoLive.revealDiagnostic', safe((uri, range) => vscode.window.showTextDocument(uri, { selection: range, preview: true }))),
    vscode.commands.registerCommand('arduinoLive.menu', safe(showMenu)),
    vscode.commands.registerCommand('arduinoLive.templates', safe(() => learning.openTemplates())),
    vscode.commands.registerCommand('arduinoLive.functions', safe(() => learning.openFunctions())),
    vscode.commands.registerCommand('arduinoLive.fragments', safe(() => learning.openFragments())),
    vscode.commands.registerCommand('arduinoLive.quickFix', safe(() => learning.showFixes())),
    vscode.commands.registerCommand('arduinoLive.guide', showGuide),
    vscode.commands.registerCommand('arduinoLive.setup', safe(setup)),
    vscode.commands.registerCommand('arduinoLive.selectBoard', safe(() => selectBoard())),
    vscode.commands.registerCommand('arduinoLive.restart', safe(() => { trustGate.retry(); return restart(); })),
    vscode.commands.registerCommand('arduinoLive.showOutput', () => output.show()),
    vscode.workspace.onDidOpenTextDocument(safe(ensureDocument)),
    // This starts a client if an existing file has just become a valid sketch.
    // Actual unsaved text synchronization belongs to vscode-languageclient.
    vscode.workspace.onDidChangeTextDocument(safe(event => ensureDocument(event.document))),
    vscode.workspace.onDidChangeConfiguration(event => {
      if (engineSettings.some(key => event.affectsConfiguration(`arduinoLive.${key}`)) && !configuring && !configurationUpdates) void restart();
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => { trustGate.reset(); void restart(); }),
    vscode.workspace.onDidGrantWorkspaceTrust(() => { trustGate.grant(); if (!starting.size) void restart(); })
  );
  try {
    const api = vscode.extensions.getExtension('dankeboy36.vscode-arduino-api');
    const bind = value => {
      if (disposed || !value || arduinoContext === value) return;
      arduinoContext = value;
      if (typeof value.onDidChange === 'function') {
        for (const key of ['fqbn', 'sketchPath']) context.subscriptions.push(value.onDidChange(key)(() => { void restart(); }));
      }
      void restart();
    };
    if (api?.exports) bind(api.exports);
    else if (api) {
      // Theia may initialize its API bridge later. Never block activation of
      // our menu/help while waiting for another extension to activate.
      void api.activate().then(bind).catch(error => output.appendLine(`可手动选择板型：${error.message}`));
    }
  } catch (error) { output.appendLine(`IDE 板型同步不可用，可手动选择：${error.message}`); }
  for (const document of vscode.workspace.textDocuments) void safe(ensureDocument)(document);
  void safe(() => showDiagnostics())();
  if (!context.globalState.get('welcome012')) {
    void context.globalState.update('welcome012', true);
    void vscode.window.showInformationMessage('Arduino 实时检查已更新：恢复 C++ 配色，默认跟随 IDE 顶部板型。点击底部“实时检查”可打开菜单。', '使用说明', '开始配置').then(choice => {
      if (choice === '使用说明') showGuide();
      if (choice === '开始配置') void safe(setup)();
    });
  }
}

async function deactivate() { disposed = true; await restarting; await stopAll(); }
module.exports = { activate, deactivate };

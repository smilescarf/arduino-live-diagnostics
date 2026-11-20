'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { availableApi } = require('./api-catalog');
const { templates, templateCode, templateReadme, supportsBoard } = require('./templates');
const { isWithin } = require('./core');
const { installAuthoring } = require('./authoring');
const { installFragments } = require('./code-fragments');
const { lex } = require('./authoring-core');

function includes(text) {
  return [...lex(text).mask.matchAll(/^[ \t]*#[ \t]*include\b/gm)].flatMap(m=>{
    const header=/^[ \t]*#[ \t]*include\s*[<"]([^>"\r\n]+)[>"]/.exec(text.slice(m.index));return header?[header[1]]:[];
  });
}
function includeSignature(text) {
  const mask=lex(text).mask;let offset=0,preambleEnd=mask.length,continuation=false;
  for(const line of mask.split('\n')){
    if(!continuation&&line.trim()&&!/^\s*#/.test(line)){preambleEnd=offset;break;}
    continuation=/\\\s*$/.test(line);offset+=line.length+1;
  }
  return includes(text).join('\n')+'\n'+[...mask.matchAll(/^[ \t]*#[ \t]*include\b/gm)].map(m=>m.index<preambleEnd?'preamble':'body').join(',');
}

function libraryHeaders(text, libraries) {
  return includes(text).flatMap(include => libraries.flatMap(entry => {
    const library = entry.library || entry;
    return [...new Set([library.source_dir, library.install_dir].filter(Boolean))].flatMap(root => {
      const file = path.resolve(root, include);
      if (!isWithin(root, file) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return [];
      return [{ name: library.name, include, file, examples: library.examples || [], root: library.install_dir || root }];
    });
  })).filter((item, index, all) => all.findIndex(other => process.platform === 'win32' ? other.file.toLowerCase() === item.file.toLowerCase() : other.file === item.file) === index);
}

// Browse declarations with their true source line. This intentionally does not
// pretend to resolve C++ macros, conditional compilation or inherited overloads.
function declarations(text) {
  const lines = text.split(/\r?\n/);
  const result = [];
  let access = true;
  for (let line = 0; line < lines.length; line++) {
    if (/^\s*(?:class|struct)\s+\w+/.test(lines[line])) access = /^\s*struct\b/.test(lines[line]);
    if (/^\s*public\s*:/.test(lines[line])) access = true;
    if (/^\s*(?:private|protected)\s*:/.test(lines[line])) access = false;
    if (/^\s*(?:public|private|protected)\s*:/.test(lines[line]) || !lines[line].includes('(')) continue;
    const declaration = lines.slice(line, line + 5).join(' ').split(';')[0].trim();
    if (!access || /^\s*(?:\/|#|typedef|using|return|if|for|while|switch)\b/.test(declaration)) continue;
    const match = /^(?:[\w:*&<>~]+\s+)*([~\w]+)\s*\(([^{};]*)\)\s*(?:const\s*)?(?:override\s*)?(?:=\s*0\s*)?$/.exec(declaration);
    if (match && !result.some(item => item.signature === declaration)) result.push({ name: match[1], signature: declaration, line: line + 1 });
  }
  return result;
}

function compilerLibraries(tempDir) {
  if (!tempDir || !fs.existsSync(tempDir)) return [];
  const roots = new Set();
  const databases = [path.join(tempDir, 'build', 'compile_commands.json'), ...fs.readdirSync(tempDir, { withFileTypes: true }).filter(item => item.isDirectory() && item.name.startsWith('arduino-language-server')).map(item => path.join(tempDir, item.name, 'build', 'compile_commands.json'))];
  for (const file of databases) {
    if (!fs.existsSync(file)) continue;
    for (const command of JSON.parse(fs.readFileSync(file, 'utf8'))) {
      const args = command.arguments || [];
      for (let i = 0; i < args.length; i++) {
        const root = args[i] === '-I' ? args[++i] : args[i].startsWith('-I') ? args[i].slice(2) : undefined;
        if (root && fs.existsSync(root)) roots.add(root);
      }
    }
  }
  return [...roots].map(source => {
    const root = path.basename(source) === 'src' ? path.dirname(source) : source;
    const examples = path.join(root, 'examples');
    return { library: { name: path.basename(root), source_dir: source, install_dir: root,
      examples: fs.existsSync(examples) ? fs.readdirSync(examples, { withFileTypes: true }).filter(item => item.isDirectory()).map(item => path.join(examples, item.name)) : [] } };
  });
}

function installLearning(vscode, options) {
  let panel;
  const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const showDetails = (title, body) => {
    panel?.dispose();
    panel = vscode.window.createWebviewPanel('arduinoLiveLearning', title, vscode.ViewColumn.Beside, { enableScripts: false });
    panel.webview.html = `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none';style-src 'unsafe-inline'"><style>body{font-family:var(--vscode-font-family);line-height:1.8;padding:24px}pre{white-space:pre-wrap;background:var(--vscode-textCodeBlock-background);padding:16px}h1{font-size:22px}</style><h1>${escape(title)}</h1>${body}`;
  };
  async function openTemplates() {
    const fqbn = options.fqbn() || '';
    const selected = await vscode.window.showQuickPick(templates.map(template => ({
      label: template.title,
      description: `${template.category} · ${template.level} · ${template.boards ? 'ESP32-S3 / 核心3.x' : 'Uno / ESP32-S3'}`,
      detail: `${template.outcome}  库：${template.libraries.join('、') || '无需额外安装'}  ${template.source ? '课件：' + template.source.file : '补充实验'}  ${template.pins.join('；')}`,
      template
    })), { title: `实验模板 · ${templates.length} 个 · 当前板型 ${fqbn || '未选择'}`, matchOnDescription: true, matchOnDetail: true,
      placeHolder: '搜索课次、器件或实验名（LED / 雷达 / TM1637 / Wi-Fi / BLE）；工程附中文说明' });
    if (!selected) return;
    if (fqbn && !supportsBoard(selected.template, fqbn)) {
      await vscode.window.showWarningMessage('此课件模板需要 ESP32-S3 与 Arduino-ESP32 3.x。请先在 IDE 顶部选择对应板型，再创建模板。');
      return;
    }
    const destination = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: false, openLabel: '在此创建实验工程', title: `创建 ${selected.template.title}，将自动新建同名文件夹与 .ino 文件` });
    if (!destination?.length) return;
    let name = selected.template.id;
    let suffix = 1;
    while (fs.existsSync(path.join(destination[0].fsPath, name))) name = `${selected.template.id}${++suffix}`;
    const root = path.join(destination[0].fsPath, name);
    fs.mkdirSync(root);
    const file = path.join(root, `${name}.ino`);
    fs.writeFileSync(file, templateCode(selected.template, options.fqbn()), { flag: 'wx' });
    fs.writeFileSync(path.join(root, 'README.md'), templateReadme(selected.template, options.fqbn()), { flag: 'wx' });
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
    await vscode.window.showTextDocument(document, { preview: false });
    const choice = await vscode.window.showInformationMessage(`实验工程已创建：${root}。${selected.template.libraries.length ? '请先安装库：' + selected.template.libraries.join('、') + '。' : ''}接线与步骤见实验说明。`, '查看实验说明', '在新窗口打开工程');
    if (choice === '在新窗口打开工程') await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(root), true);
    if (choice === '查看实验说明') showDetails(selected.template.title,
      `<h2>实验目标</h2><p>${escape(selected.template.outcome)}</p><h2>接线</h2><p>${escape(selected.template.parts)}</p><h2>所需库</h2><p>${escape(selected.template.libraries.join('、') || '无需额外安装')}</p><pre>${escape(templateReadme(selected.template, options.fqbn()))}</pre>`);
  }
  async function openFunctions() {
    const document = options.document?.() || vscode.window.activeTextEditor?.document;
    const items = availableApi(options.fqbn()).map(item => ({ label: item.name, description: item.signature, detail: item.description, api: item }));
    if (document?.uri.scheme === 'file') {
      try {
        const libraries = await options.libraries();
        const headers = libraryHeaders(document.getText(), libraries);
        for (const header of headers) {
          items.push({ label: `$(file-code) ${header.include}`, description: header.name, detail: '查看当前 #include 对应的真实头文件', header });
          for (const declaration of declarations(fs.readFileSync(header.file, 'utf8'))) {
            items.push({ label: declaration.name, description: `${header.name} · ${declaration.signature}`, detail: `${header.file}:${declaration.line}`, declaration, header });
          }
          for (const example of header.examples.slice(0, 80)) {
            if (isWithin(header.root, example)) items.push({ label: `$(book) 示例：${path.basename(example)}`, description: header.name, example, header });
          }
        }
        if (includes(document.getText()).length && !headers.length) items.push({ label: '没有在本机库列表中匹配到所含头文件', description: '核心库与条件编译信息请使用 IDE 的转到定义 / 自动补全', unavailable: true });
      } catch (error) {
        items.push({ label: '库目录暂时无法读取', detail: String(error.message || error), unavailable: true });
      }
    }
    const selected = await vscode.window.showQuickPick(items, { title: '函数与库助手', matchOnDescription: true, matchOnDetail: true, placeHolder: '搜索 digitalWrite、map 或工程 #include 中的库；签名取自本机头文件' });
    if (!selected || selected.unavailable) return;
    if (selected.api) {
      const item = selected.api;
      showDetails(item.name, `<pre>${escape(item.signature)}</pre><p>${escape(item.description)}</p><p>输入函数名或按 Ctrl+空格可选中文提示和参数占位符。原生签名/类型检查仍按当前开发板处理。</p><pre>${escape(item.snippet.replace(/\$\{\d+:([^}]+)\}/g, '$1'))}</pre>`);
    } else if (selected.example) {
      const files = fs.readdirSync(selected.example).filter(file => /\.ino$/i.test(file));
      if (!files.length) { await vscode.window.showInformationMessage('该示例的主文件位于更深一层目录，请从 IDE 的文件 → 示例中打开。'); return; }
      const file = path.join(selected.example, files[0]);
      const content = `// 来自库 ${selected.header.name} 的示例副本：${file}\n// 原示例可能还包含其他标签页和依赖，请同时查看库的 examples 目录。\n\n${fs.readFileSync(file, 'utf8')}`;
      await vscode.window.showTextDocument(await vscode.workspace.openTextDocument({ language: 'cpp', content }), { preview: false });
    } else {
      const line = (selected.declaration?.line || 1) - 1;
      const file = selected.header.file;
      // Show a read-only preview with source attribution; never insert a method
      // as a global function or write to an installed library.
      showDetails(selected.declaration?.name || selected.header.include, `<p>库：${escape(selected.header.name)}</p><p>来源：${escape(file)}，第 ${line + 1} 行</p><pre>${escape(selected.declaration?.signature || selected.header.include)}</pre><p>这是头文件声明浏览，类方法需通过正确对象调用。宏、继承、重载与当前板型可用性请结合 IDE 的补全和“转到定义”查看。</p><pre>${escape(fs.readFileSync(file, 'utf8').split(/\r?\n/).slice(Math.max(0, line - 8), line + 14).join('\n'))}</pre>`);
    }
  }
  const selector = [{ scheme: 'file', pattern: '**/*.{ino,cpp,h,hpp}' }, { scheme: 'untitled', language: 'cpp' }];
  const authoring = installAuthoring(vscode, options, selector);
  const fragments = installFragments(vscode, options, authoring.preview);
  const hover = vscode.languages.registerHoverProvider(selector, {
    provideHover(document, position) {
      if (document.uri.scheme === 'file' && !options.isSketch(document)) return undefined;
      const range = document.getWordRangeAtPosition(position);
      const item = range && availableApi(options.fqbn()).find(item => item.name === document.getText(range));
      if (!item) return undefined;
      return new vscode.Hover(new vscode.MarkdownString(`**Arduino 中文说明**\n\n${item.description}\n\n\`\`\`cpp\n${item.signature}\n\`\`\``), range);
    }
  });
  return { openTemplates, openFunctions, openFragments: fragments.open, showFixes: authoring.showFixes,
    dispose() { authoring.dispose(); hover.dispose(); panel?.dispose(); } };
}

module.exports = { includes, includeSignature, libraryHeaders, declarations, compilerLibraries, installLearning };

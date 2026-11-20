'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { translatedMessage, uriKey } = require('./core');

function rowData(model, documents) {
  return model.rows().map(({ uri, diagnostic }, id) => {
    const [original, chinese] = translatedMessage(diagnostic.message).split('\n中文提示：');
    const { start, end } = diagnostic.range;
    const document = documents.find(document => uriKey(document.uri) === uriKey(uri));
    const snippet = document ? Array.from({ length: Math.min(document.lineCount - Math.max(0, start.line - 1), 3) }, (_, i) => {
      const line = Math.max(0, start.line - 1) + i;
      return `${line + 1}  ${document.lineAt(line).text}`;
    }).join('\n') : '';
    const code = typeof diagnostic.code === 'object' ? diagnostic.code.value : diagnostic.code || '';
    return { id, level: diagnostic.severity, code: String(code), description: chinese.split('。')[0], explanation: chinese, original,
      file: path.basename(uri.fsPath), path: uri.fsPath, line: start.line + 1, column: start.character + 1, endColumn: end.character + 1,
      pending: model.pending.has(uriKey(uri)), snippet };
  });
}

function createErrorList(vscode, dashboard, actions) {
  let view;
  let listener;
  let selectedRows = [];
  let revision = 0;
  const refresh = () => {
    selectedRows = dashboard.model.rows();
    void view?.webview.postMessage({ type: 'state', revision: ++revision, status: dashboard.model.status, board: dashboard.model.board,
      pending: dashboard.model.pending.size > 0, rows: rowData(dashboard.model, vscode.workspace.textDocuments) });
  };
  return {
    refresh,
    resolveWebviewView(resolved) {
      view = resolved;
      view.webview.options = { enableScripts: true };
      const nonce = crypto.randomBytes(18).toString('base64');
      const js = fs.readFileSync(path.join(__dirname, '../resources/error-list.js'), 'utf8');
      view.webview.html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none';style-src 'unsafe-inline';script-src 'nonce-${nonce}';"><style>
body{font-family:var(--vscode-font-family),sans-serif;color:var(--vscode-foreground);padding:0;margin:0;font-size:13px}header{display:flex;gap:10px;align-items:center;padding:8px;flex-wrap:wrap;border-bottom:1px solid var(--vscode-panel-border)}button,input{font:inherit;color:inherit;background:var(--vscode-input-background);border:1px solid var(--vscode-input-border);padding:5px 8px}button{cursor:pointer}button:hover{background:var(--vscode-list-hoverBackground)}input[type=search]{min-width:180px;flex:1}#status{padding:6px 10px;color:var(--vscode-descriptionForeground)}.tablewrap{overflow:auto;max-height:47vh}table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{text-align:left;padding:7px 9px;border-bottom:1px solid var(--vscode-panel-border);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}th{position:sticky;top:0;background:var(--vscode-editor-background)}tr[data-id]{cursor:pointer}tr[data-id]:hover,tr.selected{background:var(--vscode-list-hoverBackground)}.error{color:var(--vscode-errorForeground)}.warning{color:var(--vscode-editorWarning-foreground)}.pending{opacity:.6}#detail{padding:10px;line-height:1.6;overflow-wrap:anywhere}#detail p{margin:4px 0}pre{white-space:pre-wrap;tab-size:4;background:var(--vscode-textCodeBlock-background);padding:10px;margin:6px 0}summary{cursor:pointer}#empty{padding:14px} @media(max-width:580px){.code{display:none}}
</style></head><body><header><strong>错误列表</strong><label><input type="checkbox" id="errors" checked>错误 <span id="ec">0</span></label><label><input type="checkbox" id="warnings" checked>警告 <span id="wc">0</span></label><input type="search" id="search" placeholder="搜索说明、文件、错误代码"><button id="board">选择板型</button><button id="functions">函数与库</button><button id="templates">实验模板</button><button id="fragments">插入片段</button><button id="fixes">修复建议</button><button id="restart">重新检查</button></header><div id="status" role="status"></div><div class="tablewrap"><table><colgroup><col style="width:64px"><col class="code" style="width:160px"><col><col style="width:180px"><col style="width:55px"><col style="width:55px"></colgroup><thead><tr><th>级别</th><th class="code">代码</th><th>说明</th><th>文件</th><th>行</th><th>列</th></tr></thead><tbody id="rows"></tbody></table></div><div id="empty"></div><section id="detail" aria-live="polite">点击一条问题，查看原因和附近代码，并跳到编辑器对应位置。</section><script nonce="${nonce}">${js}</script></body></html>`;
      listener?.dispose();
      listener = view.webview.onDidReceiveMessage(async message => {
        if (message?.type === 'ready') refresh();
        else if (message?.type === 'reveal' && message.revision === revision && Number.isInteger(message.id) && selectedRows[message.id]) {
          const { uri, diagnostic } = selectedRows[message.id];
          await vscode.window.showTextDocument(uri, { selection: diagnostic.range, preview: true, preserveFocus: true });
        } else if (message?.type === 'action' && Object.hasOwn(actions, message.action)) {
          await actions[message.action]();
        }
      });
      refresh();
    },
    dispose() { listener?.dispose(); }
  };
}
module.exports = { rowData, createErrorList };

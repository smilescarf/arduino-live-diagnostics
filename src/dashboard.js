'use strict';
const path = require('node:path');
const { translatedMessage, uriKey } = require('./core');

class DiagnosticModel {
  constructor() {
    this.files = new Map();
    this.pending = new Set();
    this.status = '等待 Arduino 工程';
    this.detail = '';
    this.board = '';
    this.updated = undefined;
  }
  setStatus(status, detail, board) { Object.assign(this, { status, detail, board }); }
  update(uri, diagnostics) {
    this.pending.delete(uriKey(uri));
    if (diagnostics.length) this.files.set(uriKey(uri), { uri, diagnostics });
    else this.files.delete(uriKey(uri));
    this.updated = new Date();
  }
  markPending(uri) { this.pending.add(uriKey(uri)); }
  clear() { this.files.clear(); this.pending.clear(); this.updated = undefined; }
  rows() {
    return [...this.files.values()].flatMap(({ uri, diagnostics }) => diagnostics.map(diagnostic => ({ uri, diagnostic })))
      .sort((a, b) => a.diagnostic.severity - b.diagnostic.severity || a.uri.toString().localeCompare(b.uri.toString()) || a.diagnostic.range.start.line - b.diagnostic.range.start.line);
  }
}

function createDashboard(vscode, model = new DiagnosticModel()) {
  const changed = new vscode.EventEmitter();
  const item = (label, icon, description, command, tooltip) => {
    const node = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    node.iconPath = new vscode.ThemeIcon(icon);
    node.description = description;
    node.tooltip = tooltip || label;
    if (command) node.command = { command, title: label };
    return node;
  };
  return {
    model,
    onDidChangeTreeData: changed.event,
    refresh() { changed.fire(undefined); },
    getTreeItem(node) { return node; },
    getChildren() {
      const rows = model.rows();
      const errors = rows.filter(row => row.diagnostic.severity === 0).length;
      const warnings = rows.filter(row => row.diagnostic.severity === 1).length;
      const pending = model.pending.size > 0;
      const nodes = [
        item(model.status, 'pulse', '', 'arduinoLive.menu', model.detail),
        item(`开发板：${model.board || '未选择（点击选择）'}`, 'circuit-board', '', 'arduinoLive.selectBoard'),
        item(`${pending ? '上次结果：' : ''}错误 ${errors}    警告 ${warnings}`, pending ? 'sync' : errors ? 'error' : warnings ? 'warning' : 'check', pending ? '最新修改正在检查' : model.updated ? `更新于 ${model.updated.toLocaleTimeString()}` : '等待首次诊断')
      ];
      for (const { uri, diagnostic } of rows) {
        const [original, chinese] = translatedMessage(diagnostic.message).split('\n中文提示：');
        const start = diagnostic.range.start;
        const location = `${path.basename(uri.fsPath)}:${start.line + 1}:${start.character + 1}`;
        const node = item((chinese || original.split('\n')[0]).split('。')[0], diagnostic.severity === 0 ? 'error' : diagnostic.severity === 1 ? 'warning' : 'info', location, undefined,
          `定位：${uri.fsPath}，第 ${start.line + 1} 行，第 ${start.character + 1} 列\n中文说明：${chinese}\n编译器原文：${original}\n${diagnostic.relatedInformation?.map(info => `${info.message}（第 ${info.location.range.start.line + 1} 行）`).join('\n') || ''}\n点击跳到标记处。语法错误可能引发后续报错，请先修复最前面的错误。`);
        node.command = { command: 'arduinoLive.revealDiagnostic', title: '定位错误', arguments: [uri, diagnostic.range] };
        nodes.push(node);
      }
      if (!rows.length) nodes.push(item(pending ? '正在检查最新修改，请等待诊断更新。' : model.updated ? '当前没有诊断问题，继续写代码即可。' : '直接输入代码即可检查，无需保存。', model.updated && !pending ? 'pass' : 'info', '', undefined));
      nodes.push(item('开始配置 / 选择板型 / 使用说明…', 'gear', '点击打开操作菜单', 'arduinoLive.menu'));
      return nodes;
    },
    dispose() { changed.dispose(); }
  };
}
module.exports = { DiagnosticModel, createDashboard };

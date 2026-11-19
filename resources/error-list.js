'use strict';
const host = acquireVsCodeApi();
let state = { rows: [] };
let selected;
const byId = id => document.getElementById(id);
function element(tag, text, parent) {
  const node = document.createElement(tag);
  node.textContent = text;
  parent?.appendChild(node);
  return node;
}
function detail(row) {
  selected = row.id;
  const box = byId('detail');
  box.replaceChildren();
  element('strong', row.explanation, box);
  element('p', `${row.path} · 第 ${row.line} 行，第 ${row.column} 列${row.pending ? ' · 上次结果，最新修改正在检查' : ''}`, box);
  if (row.snippet) element('pre', row.snippet, box);
  const original = element('details', '', box);
  element('summary', '编译器原文', original);
  element('pre', row.original, original);
  element('p', '语法错误可能引出后续错误；请先检查最前面的错误。', box);
}
function render() {
  const rows = state.rows;
  byId('ec').textContent = rows.filter(row => row.level === 0).length;
  byId('wc').textContent = rows.filter(row => row.level === 1).length;
  byId('status').textContent = `${state.status || '等待工程'} · ${state.board || '未选择开发板'}${state.pending ? ' · 列表中的旧诊断已标记，等待最新结果' : ''}`;
  const search = byId('search').value.toLowerCase();
  const visible = rows.filter(row => (row.level === 0 ? byId('errors').checked : byId('warnings').checked) && `${row.description} ${row.file} ${row.code} ${row.original}`.toLowerCase().includes(search));
  const body = byId('rows');
  body.replaceChildren();
  for (const row of visible) {
    const tr = element('tr', '', body);
    tr.dataset.id = row.id;
    tr.tabIndex = 0;
    tr.className = row.pending ? 'pending' : row.id === selected ? 'selected' : '';
    element('td', row.level === 0 ? '● 错误' : '▲ 警告', tr).className = row.level === 0 ? 'error' : 'warning';
    const code = element('td', row.code, tr);
    code.className = 'code';
    code.title = row.code;
    element('td', row.description, tr).title = row.explanation;
    element('td', row.file, tr).title = row.path;
    element('td', String(row.line), tr);
    element('td', String(row.column), tr);
    const reveal = () => { detail(row); host.postMessage({ type: 'reveal', id: row.id, revision: state.revision }); render(); };
    tr.addEventListener('click', reveal);
    tr.addEventListener('keydown', event => { if (event.key === 'Enter') reveal(); });
  }
  byId('empty').textContent = visible.length ? '' : rows.length ? '没有符合筛选条件的问题。' : state.pending ? '正在检查最新修改…' : '当前没有诊断条目；请确认状态已就绪。';
}
window.addEventListener('message', event => {
  if (event.data?.type !== 'state') return;
  state = event.data;
  selected = undefined;
  byId('detail').textContent = '点击问题可跳到代码。说明和行列各占独立列；原文可展开查看。';
  render();
});
for (const id of ['errors', 'warnings', 'search']) byId(id).addEventListener('input', render);
for (const id of ['board', 'functions', 'templates', 'restart']) byId(id).addEventListener('click', () => host.postMessage({ type: 'action', action: id }));
host.postMessage({ type: 'ready' });

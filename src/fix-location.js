'use strict';
const path = require('node:path');
const { fileURLToPath } = require('node:url');

function insertion(actions, uri) {
  const positions = new Map();
  for (const action of actions || []) {
    const command = typeof action.command === 'object' ? action.command : action;
    const workspaceEdits = [action.edit, ...(command.command === 'clangd.applyFix' ? command.arguments || [] : [])].filter(Boolean);
    for (const edit of workspaceEdits) {
      const files = [...Object.entries(edit.changes || {}), ...(edit.documentChanges || []).filter(item => item.textDocument).map(item => [item.textDocument.uri, item.edits])];
      for (const [file, edits] of files) {
        if (!file.startsWith('file:') || path.resolve(fileURLToPath(file)).toLowerCase() !== path.resolve(fileURLToPath(uri)).toLowerCase()) continue;
        for (const candidate of edits) {
          const { start, end } = candidate.range;
          if (candidate.newText.trim() === ';' && start.line === end.line && start.character === end.character) positions.set(`${start.line}:${start.character}`, start);
        }
      }
    }
  }
  return positions.size === 1 ? [...positions.values()][0] : undefined;
}

function semicolonRange(text, position) {
  const lines = text.split('\n');
  const limit = lines.slice(0, position.line).reduce((sum, line) => sum + line.length + 1, 0) + position.character;
  let quote = '', block = false, comment = false, last = -1;
  for (let i = 0; i < Math.min(limit, text.length); i++) {
    const c = text[i], next = text[i + 1];
    if (comment) { if (c === '\n') comment = false; continue; }
    if (block) { if (c === '*' && next === '/') { block = false; i++; } continue; }
    if (quote) {
      last = i;
      if (c === '\\') { i++; last = i; }
      else if (c === quote) quote = '';
    } else if (c === '/' && next === '/') { comment = true; i++; }
    else if (c === '/' && next === '*') { block = true; i++; }
    else if (c === '"' || c === "'") { quote = c; last = i; }
    else if (!/\s/.test(c)) last = i;
  }
  if (last < 0) return undefined;
  const prefix = text.slice(0, last).split('\n');
  const line = prefix.length - 1, character = prefix.at(-1).length;
  return { start: { line, character }, end: { line, character: character + 1 } };
}

async function fixLocation(document, diagnostic, uri, request, protocolDiagnostic = diagnostic) {
  if (!String(typeof diagnostic.code === 'object' ? diagnostic.code.value : diagnostic.code).startsWith('expected_semi')) return undefined;
  const actions = await request({ textDocument: { uri }, range: diagnostic.range,
    context: { diagnostics: [protocolDiagnostic], only: ['quickfix'] } });
  const point = insertion(actions, uri);
  return point && semicolonRange(document.getText(), point);
}
module.exports = { insertion, semicolonRange, fixLocation };

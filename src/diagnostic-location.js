'use strict';

function diagnosticRange(document, diagnostic) {
  const original = diagnostic.range;
  if (document && /for function-style cast or type construction/i.test(diagnostic.message) && original.start.line < document.lineCount) {
    const text = document.lineAt(original.start.line).text;
    const loop = /^(\s*)(fo|fr|fro)\s*\(\s*(?:int|long|unsigned|auto)\b[^;]*;[^;]*;[^)]*\)/.exec(text);
    if (loop) return { start: { line: original.start.line, character: loop[1].length }, end: { line: original.start.line, character: loop[1].length + loop[2].length } };
  }
  if (!document || !/expected ['‘]\(['’] after ['‘]if['’]/i.test(diagnostic.message)) return original;
  const start = Math.min(original.start.line, document.lineCount - 1);
  // Only relocate this specific compiler error when the current buffer still
  // contains an unambiguous bare if. Never guess a location from an old result.
  for (let line = start; line >= Math.max(0, start - 8); line--) {
    const text = document.lineAt(line).text;
    const match = /^(\s*)if\s*(?:\/\/.*)?$/.exec(text);
    if (match) return { start: { line, character: match[1].length }, end: { line, character: match[1].length + 2 } };
    if (line === start && /^\s*\{\s*(?:\/\/.*)?$/.test(text)) continue;
    if (/^\s*(?:\/\/.*)?$/.test(text)) continue;
    break;
  }
  return original;
}

module.exports = { diagnosticRange };

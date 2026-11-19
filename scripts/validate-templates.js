'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { templates, templateCode, supportsBoard } = require('../src/templates');
const { discoverTools } = require('../src/tools');
async function main() {
  const tools = discoverTools({ arduinoIdePath: process.env.ARDUINO_IDE_PATH, cliConfigPath: process.env.ARDUINO_CLI_CONFIG });
  const boards = (process.env.ARDUINO_TEST_BOARDS || 'arduino:avr:uno,esp32:esp32:esp32s3').split(',');
  const ids = process.env.ARDUINO_TEMPLATE_IDS?.split(',');
  const resultsFile = path.resolve(__dirname, '../.tmp/template-validation/results' + (process.env.ARDUINO_VALIDATION_RUN ? '-' + process.env.ARDUINO_VALIDATION_RUN : '') + '.json');
  const previous = process.env.ARDUINO_VALIDATION_RESUME === '1' && fs.existsSync(resultsFile) ? JSON.parse(fs.readFileSync(resultsFile, 'utf8')) : [];
  const results = [];
  const tasks = boards.flatMap(board => templates.filter(t => (!ids || ids.includes(t.id)) && supportsBoard(t, board)).map(template => ({ board, template })));
  let cursor = 0;
  async function worker() {
    while (cursor < tasks.length) {
      const { board, template } = tasks[cursor++];
      const root = path.resolve(__dirname, '../.tmp/template-validation', board.replaceAll(':', '_'), template.id);
      const file = path.join(root, `${template.id}.ino`);
      const code = templateCode(template, board);
      const hash = crypto.createHash('sha256').update(code).digest('hex');
      const old = previous.find(r => r.board === board && r.template === template.id && r.passed);
      if (old && (old.hash === hash || (!old.hash && fs.existsSync(file) && fs.readFileSync(file, 'utf8') === code))) {
        results.push({ ...old, hash }); console.log(JSON.stringify({ ...old, reused: true })); continue;
      }
      fs.mkdirSync(root, { recursive: true }); fs.writeFileSync(file, code);
      const args = [...(tools.config ? ['--config-file', tools.config] : []), 'compile', '--fqbn', board,
        '--jobs', process.env.ARDUINO_COMPILE_JOBS || '6', '--build-path', path.join(root, 'build'), root];
      const start = Date.now();
      const error = await new Promise(resolve => execFile(tools.cli, args, { windowsHide: true, timeout: 600000, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
        fs.writeFileSync(path.join(root, 'compile.log'), stdout + stderr);
        resolve(error ? `${error.code || 'compile error'}; see ${path.join(root, 'compile.log')}` : undefined);
      }));
      const result = { board, template: template.id, passed: !error, error, hash, elapsedMs: Date.now() - start };
      results.push(result); console.log(JSON.stringify(result)); fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, Number(process.env.ARDUINO_VALIDATION_WORKERS) || 1) }, worker));
  fs.mkdirSync(path.dirname(resultsFile), { recursive: true }); fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  if (results.some(result => !result.passed)) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });

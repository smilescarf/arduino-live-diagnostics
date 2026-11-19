'use strict';
const path = require('node:path');
const fs = require('node:fs');
const esbuild = require('esbuild');
const vsce = require('@vscode/vsce');
const root = path.resolve(__dirname, '..');
async function main() {
  esbuild.buildSync({ entryPoints: [path.join(root, 'src/extension.js')], bundle: true,
    platform: 'node', target: 'node18', external: ['vscode'], outfile: path.join(root, 'dist/extension.js') });
  fs.mkdirSync(path.join(root, 'releases'), { recursive: true });
  const version = require('../package.json').version;
  await vsce.createVSIX({ cwd: root, packagePath: path.join(root, 'releases', `arduino-live-diagnostics-${version}.vsix`), dependencies: false, allowMissingRepository: true });
}
main().catch(error => { console.error(error); process.exitCode = 1; });

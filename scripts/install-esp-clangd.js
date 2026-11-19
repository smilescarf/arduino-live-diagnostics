'use strict';
const path = require('node:path');
const { ensureEspClangd } = require('../src/esp-toolchain');
ensureEspClangd(path.resolve(__dirname, '../.tools'), console.log)
  .then(console.log).catch(error => { console.error(error); process.exitCode = 1; });

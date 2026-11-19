'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');

function exists(file) {
  try { return fs.statSync(file).isFile(); } catch { return false; }
}

function discoverTools(config, env = process.env, platform = process.platform) {
  const home = env.USERPROFILE || env.HOME || os.homedir();
  const exe = platform === 'win32' ? '.exe' : '';
  const ideRoots = [config.arduinoIdePath,
    path.join(env.ProgramFiles || 'C:\\Program Files', 'Arduino IDE'),
    path.join(env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'Programs', 'Arduino IDE'),
    '/Applications/Arduino IDE.app/Contents', '/opt/arduino-ide', '/usr/lib/arduino-ide'
  ].filter(Boolean);
  const toolDirs = ideRoots.flatMap(root => [root,
    path.join(root, 'resources', 'app', 'lib', 'backend', 'resources'),
    path.join(root, 'Resources', 'app', 'lib', 'backend', 'resources'),
    path.join(root, 'lib', 'backend', 'resources')
  ]);
  const searchDirs = [...toolDirs, ...(env.PATH || env.Path || '').split(path.delimiter)];
  const getTool = (key, name) => config[key] ? (exists(config[key]) ? config[key] : undefined)
    : searchDirs.map(dir => path.join(dir, name + exe)).find(exists);
  const configCandidates = [config.cliConfigPath,
    path.join(env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'arduino-ide', 'arduino-cli.yaml'),
    path.join(home, '.arduinoIDE', 'arduino-cli.yaml')].filter(Boolean);
  return {
    cli: getTool('cliPath', 'arduino-cli'),
    server: getTool('languageServerPath', 'arduino-language-server'),
    clangd: getTool('clangdPath', 'clangd'),
    config: config.cliConfigPath ? (exists(config.cliConfigPath) ? config.cliConfigPath : undefined) : configCandidates.find(exists),
    invalidConfig: Boolean(config.cliConfigPath && !exists(config.cliConfigPath))
  };
}

function runCli(tools, args) {
  return new Promise((resolve, reject) => {
    const commandArgs = tools.config ? ['--config-file', tools.config, ...args] : args;
    execFile(tools.cli, commandArgs, { windowsHide: true, timeout: 60000, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr.trim() || stdout.trim() || error.message));
      else resolve(stdout);
    });
  });
}

module.exports = { discoverTools, runCli };

'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { isWithin } = require('./core');

function splitFlags(text) {
  const result = [];
  let token = '', quote = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '\\' && text[i + 1] === '"') { token += '"'; i++; }
    else if (char === '"' || char === "'") {
      if (!quote) quote = char;
      else if (quote === char) quote = '';
      else token += char;
    } else if (/\s/.test(char) && !quote) { if (token) { result.push(token); token = ''; } }
    else token += char;
  }
  if (token) result.push(token);
  return result;
}

function expandedFlags(args, directory, depth = 0) {
  if (depth > 5) throw new Error('编译参数响应文件嵌套过深。');
  return args.flatMap(argument => argument.startsWith('@') ? expandedFlags(splitFlags(fs.readFileSync(path.resolve(directory, argument.slice(1)), 'utf8')), directory, depth + 1) : [argument]);
}

function prototypes(texts) {
  const result = new Set();
  for (const source of texts) {
    const text = source.replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\n]/g, ' ')).replace(/\/\/[^\r\n]*/g, '');
    for (const match of text.matchAll(/^\s*((?:(?:static|inline|const|unsigned|signed|long|short)\s+)*(?:void|bool|int|char|float|double|byte|word|size_t|String|u?int\d+_t)\s*[*&]?\s+\w+\s*\(([^{};]*)\))\s*\{/gm)) {
      // Restrict auto declarations to plain Arduino types. User-defined types
      // should use an explicit declaration after the corresponding type.
      if (match[2].includes('=') || match[2].split(',').some(parameter => parameter.trim() && !/^(?:const\s+)?(?:unsigned\s+|signed\s+)?(?:long\s+)?(?:void|bool|int|char|float|double|byte|word|size_t|String|u?int\d+_t)\b/.test(parameter.trim()))) continue;
      result.add(match[1].replace(/\s+/g, ' ').trim() + ';');
    }
  }
  return '#pragma once\n#include <Arduino.h>\n' + [...result].join('\n') + '\n';
}

function writePrototypes(header, sketch, documents) {
  const files = fs.readdirSync(sketch).filter(file => /\.ino$/i.test(file)).map(file => path.join(sketch, file));
  const texts = files.map(file => documents.find(document => path.resolve(document.fileName).toLowerCase() === path.resolve(file).toLowerCase())?.getText() ?? fs.readFileSync(file, 'utf8'));
  const content = prototypes(texts);
  if (!fs.existsSync(header) || fs.readFileSync(header, 'utf8') !== content) fs.writeFileSync(header, content);
}

function sourceCommands(commands, sketch, header) {
  const primary = commands.find(command => /\.ino\.cpp$/i.test(command.file));
  if (!primary?.arguments) throw new Error('编译数据库缺少 Arduino 主文件的参数，请查看诊断日志。');
  const result = commands.filter(command => !/\.ino\.cpp$/i.test(command.file));
  for (const file of fs.readdirSync(sketch).filter(file => /\.ino$/i.test(file))) {
    const target = path.join(sketch, file) + '.arduino-live.cpp';
    const ignored = new Set(['-w', '-mdisable-hardware-atomics', '-fstrict-volatile-bitfields', '-fno-tree-switch-conversion', '-freorder-blocks']);
    const args = expandedFlags(primary.arguments, primary.directory).filter(argument => !ignored.has(argument)).map(argument => path.resolve(argument).toLowerCase() === path.resolve(primary.file).toLowerCase() ? target : argument);
    result.push({ ...primary, file: target, arguments: [args[0], '-x', 'c++', '-Wall', '-include', 'Arduino.h', '-include', header, ...args.slice(1)] });
  }
  return result;
}

async function prepareSource(tools, fqbn, sketch, environment, documents) {
  const build = path.join(environment.tempDir, 'build');
  const database = path.join(environment.tempDir, 'source-db');
  fs.mkdirSync(database, { recursive: true });
  const overrideFile = path.join(environment.tempDir, 'source-overrides.json');
  const overrides = Object.fromEntries(documents.filter(document => document.uri?.scheme === 'file' && isWithin(sketch, document.fileName)).map(document => [path.relative(sketch, document.fileName), document.getText()]));
  fs.writeFileSync(overrideFile, JSON.stringify({ overrides }));
  const args = [...(tools.config ? ['--config-file', tools.config] : []), 'compile', '--fqbn', fqbn, '--only-compilation-database', '--source-override', overrideFile, '--build-path', build, '--format', 'json', sketch];
  await new Promise((resolve, reject) => execFile(tools.cli, args, { env: environment.env, windowsHide: true, timeout: 180000, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
    fs.writeFileSync(path.join(environment.tempDir, 'prepare.log'), stdout + stderr);
    error ? reject(new Error(`读取开发板编译参数失败：${stderr || error.message}`)) : resolve();
  }));
  const header = path.join(database, 'arduino-prototypes.h');
  writePrototypes(header, sketch, documents);
  const commands = sourceCommands(JSON.parse(fs.readFileSync(path.join(build, 'compile_commands.json'), 'utf8')), sketch, header);
  fs.writeFileSync(path.join(database, 'compile_commands.json'), JSON.stringify(commands));
  // Query only compilers already supplied by this board's generated database.
  const drivers = [...new Set(commands.map(command => command.arguments?.[0]).filter(Boolean))].join(',');
  return { database, header, args: [`--compile-commands-dir=${database}`, '--background-index=false', '--pch-storage=memory', `--log=${process.env.ARDUINO_TRACE ? 'verbose' : 'error'}`, ...(drivers ? [`--query-driver=${drivers}`] : [])] };
}
module.exports = { prototypes, writePrototypes, sourceCommands, prepareSource, splitFlags, expandedFlags };

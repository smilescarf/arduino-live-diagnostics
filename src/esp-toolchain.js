'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const VERSION = '22.1.4_20260825';
const ASSETS = {
  'win32-x64': ['x86_64-w64-mingw32', 'b97a556c4c9db48bfa12c3822df97f3ebab1a595eaeb074e58b05b74e6d1a691'],
  'linux-x64': ['x86_64-linux-gnu', 'b467908e16c367d6ea7da824a539cb3d5b3edafb94b15a26e7fb1246e3f9dca5'],
  'linux-arm64': ['aarch64-linux-gnu', '1b859fb02713a455ee1f914d930dfa11022a7e4909be768cc9081104c3203e55'],
  'darwin-x64': ['x86_64-apple-darwin', 'a486f23b3ab5f39c86287f8a76c252ae397a306f42a31f95c04632a65b454d20'],
  'darwin-arm64': ['aarch64-apple-darwin', '71c8cb58f3937784802c4f88d5c3dbc944932db7cf3988f1648ddad6c2077aa0']
};
const pending = new Map();

function isEspBoard(fqbn) { return /^esp32:esp32:/.test(fqbn); }
function assetFor(platform = process.platform, arch = process.arch) {
  const asset = ASSETS[`${platform}-${arch}`];
  if (!asset) throw new Error(`尚未提供 ${platform}/${arch} 的 ESP clangd 自动安装，请设置 arduinoLive.espClangdPath。`);
  const name = `clangd-esp-${VERSION}-${asset[0]}.tar.xz`;
  return { name, sha256: asset[1], url: `https://github.com/espressif/llvm-project/releases/download/esp-${VERSION}/${name}` };
}
function verifyDigest(bytes, expected) {
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error('ESP clangd 下载文件的 SHA-256 校验失败，未解压或运行。');
}
function archivePathSafe(entry) {
  return !path.posix.isAbsolute(entry) && !path.win32.isAbsolute(entry) && !entry.replaceAll('\\', '/').split('/').includes('..');
}
function run(file, args) {
  return new Promise((resolve, reject) => execFile(file, args, { windowsHide: true, timeout: 120000, maxBuffer: 8 * 1024 * 1024 },
    (error, stdout, stderr) => error ? reject(new Error(`${file}: ${stderr || error.message}`)) : resolve(stdout)));
}
function findBinary(root) {
  for (const item of fs.readdirSync(root, { withFileTypes: true })) {
    const file = path.join(root, item.name);
    if (item.isFile() && item.name === (process.platform === 'win32' ? 'clangd.exe' : 'clangd')) return file;
    if (item.isDirectory()) { const nested = findBinary(file); if (nested) return nested; }
  }
  return undefined;
}
function installedPath(storage) {
  const root = path.join(storage, `esp-clangd-${VERSION}-${process.platform}-${process.arch}`);
  const marker = path.join(root, 'installed.json');
  try {
    const metadata = JSON.parse(fs.readFileSync(marker, 'utf8'));
    const exe = path.resolve(root, metadata.executable);
    if (!path.relative(root, exe).startsWith('..') && fs.statSync(exe).isFile()) return exe;
  } catch { /* Not installed yet. */ }
  return undefined;
}
async function install(storage, report = () => {}) {
  const existing = installedPath(storage);
  if (existing) return existing;
  const asset = assetFor();
  const root = path.join(storage, `esp-clangd-${VERSION}-${process.platform}-${process.arch}`);
  fs.mkdirSync(root, { recursive: true });
  report('正在下载 Espressif 官方 clangd（约 12–18 MB）…');
  const response = await fetch(asset.url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`ESP clangd 下载失败：HTTP ${response.status}。可手动设置 espClangdPath。`);
  const bytes = Buffer.from(await response.arrayBuffer());
  verifyDigest(bytes, asset.sha256);
  const archive = path.join(root, asset.name);
  fs.writeFileSync(archive, bytes);
  const entries = (await run('tar', ['-tJf', archive])).split(/\r?\n/).filter(Boolean);
  if (!entries.length || !entries.every(archivePathSafe)) throw new Error('ESP clangd 压缩包包含无效路径，已停止安装。');
  report('校验通过，正在解压 ESP clangd…');
  await run('tar', ['-xJf', archive, '-C', root]);
  const executable = findBinary(root);
  if (!executable) throw new Error('解压完成但未找到 clangd，请手动配置 espClangdPath。');
  // Fail before persisting an unusable installation (for example missing DLLs).
  await run(executable, ['--version']);
  fs.writeFileSync(path.join(root, 'installed.json'), JSON.stringify({ executable: path.relative(root, executable), sha256: asset.sha256, source: asset.url }, null, 2));
  return executable;
}
function ensureEspClangd(storage, report) {
  if (!pending.has(storage)) pending.set(storage, install(storage, report).finally(() => pending.delete(storage)));
  return pending.get(storage);
}

function sessionEnvironment(storage, fqbn) {
  const sessionRoot = path.join(storage, 'sessions');
  fs.mkdirSync(sessionRoot, { recursive: true });
  const tempDir = fs.mkdtempSync(path.join(sessionRoot, 'diagnostics-'));
  if (isEspBoard(fqbn)) {
    // ALS generates .cpp files under its temp directory. clangd merges this
    // parent config with ALS's generated build/.clangd, without touching sketches.
    // These GCC code-generation switches do not affect C++ semantic analysis.
    fs.writeFileSync(path.join(tempDir, '.clangd'), 'CompileFlags:\n  Remove: [-mdisable-hardware-atomics, -fstrict-volatile-bitfields, -fno-tree-switch-conversion, -freorder-blocks]\n');
  }
  return { tempDir, env: { ...process.env, TEMP: tempDir, TMP: tempDir, TMPDIR: tempDir } };
}
module.exports = { isEspBoard, assetFor, verifyDigest, archivePathSafe, installedPath, ensureEspClangd, sessionEnvironment };

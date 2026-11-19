'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { isEspBoard, assetFor, verifyDigest, archivePathSafe, sessionEnvironment } = require('../src/esp-toolchain');

test('根据选择的 FQBN 路由 ESP32 工具，Uno 不受影响', () => {
  assert.equal(isEspBoard('esp32:esp32:esp32s3:USBMode=hwcdc'), true);
  assert.equal(isEspBoard('esp32:esp32:esp32c3'), true);
  assert.equal(isEspBoard('arduino:avr:uno'), false);
});
test('仅使用固定版本官方资源，每个平台都绑定 SHA-256', () => {
  for (const [platform, arch] of [['win32', 'x64'], ['linux', 'x64'], ['linux', 'arm64'], ['darwin', 'arm64']]) {
    const asset = assetFor(platform, arch);
    assert.match(asset.url, /^https:\/\/github\.com\/espressif\/llvm-project\/releases\/download\/esp-22\.1\.4_20260825\//);
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);
  }
  assert.throws(() => assetFor('win32', 'ia32'), /espClangdPath/);
});
test('损坏的下载不能通过校验，压缩包路径不能逃出安装目录', () => {
  const content = Buffer.from('test');
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  verifyDigest(content, hash);
  assert.throws(() => verifyDigest(Buffer.from('changed'), hash), /SHA-256/);
  for (const entry of ['../escape', '/absolute', 'C:\\escape', 'a/../../escape', 'a\\..\\escape']) assert.equal(archivePathSafe(entry), false, entry);
  assert.equal(archivePathSafe('esp-clangd/bin/clangd.exe'), true);
});
test('ESP32 适配只写入独立缓存，Uno 不继承 GCC 过滤配置', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'arduino-live-session-'));
  try {
    const esp = sessionEnvironment(root, 'esp32:esp32:esp32s3');
    const uno = sessionEnvironment(root, 'arduino:avr:uno');
    assert.notEqual(esp.tempDir, uno.tempDir);
    assert.equal(esp.env.TEMP, esp.tempDir);
    const config = fs.readFileSync(path.join(esp.tempDir, '.clangd'), 'utf8');
    assert.match(config, /Remove:/);
    assert.doesNotMatch(config, /Suppress|target=|__float128/);
    assert.equal(fs.existsSync(path.join(uno.tempDir, '.clangd')), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

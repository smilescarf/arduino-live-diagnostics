'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTrustGate } = require('../src/trust');

test('Theia 同步状态一直为 false 时仍使用用户确认的异步结果', async () => {
  let requests = 0;
  const gate = createTrustGate({ isTrusted: false, requestWorkspaceTrust: async () => { requests++; return true; } });
  assert.equal(await gate.check(), true);
  assert.equal(await gate.check(), true);
  assert.equal(requests, 1);
});
test('并发启动只发起一次请求，拒绝与缺失 API 不能当成同意', async () => {
  let resolve;
  let requests = 0;
  const gate = createTrustGate({ requestWorkspaceTrust: () => { requests++; return new Promise(r => { resolve = r; }); } });
  const a = gate.check(); const b = gate.check();
  assert.equal(requests, 1);
  resolve(false);
  assert.deepEqual(await Promise.all([a,b]), [false,false]);
  assert.equal(await gate.check(), false);
  assert.equal(requests, 1);
  assert.equal(await createTrustGate({}).check(), false);
});
test('切换工作区后旧请求的确认不能授权新工作区', async () => {
  let resolve;
  const gate = createTrustGate({ requestWorkspaceTrust: () => new Promise(r => { resolve = r; }) });
  const old = gate.check();
  gate.reset();
  resolve(true);
  assert.equal(await old, false);
});

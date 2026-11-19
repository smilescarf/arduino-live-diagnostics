'use strict';

// Theia's synchronous isTrusted getter can return false while asynchronously
// prompting, and some hosts don't emit the grant event. Await the public API's
// result instead. No decision is inferred from elapsed time or a missing API.
function createTrustGate(workspace, waiting = () => {}) {
  let decision;
  let pending;
  let epoch = 0;
  return {
    async check() {
      if (decision !== undefined) return decision;
      if (pending) return pending;
      const current = epoch;
      pending = (async () => {
        waiting();
        const result = typeof workspace.requestWorkspaceTrust === 'function'
          ? await workspace.requestWorkspaceTrust()
          : workspace.isTrusted;
        const granted = result === true;
        if (current === epoch) decision = granted;
        return current === epoch && granted;
      })();
      try { return await pending; }
      finally { if (current === epoch) pending = undefined; }
    },
    retry() { if (decision === false) decision = undefined; },
    reset() { epoch++; decision = undefined; pending = undefined; },
    grant() { decision = true; }
  };
}
module.exports = { createTrustGate };

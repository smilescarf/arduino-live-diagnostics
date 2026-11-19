'use strict';

const syncMethods = new Set([
  'textDocument/didOpen', 'textDocument/didChange', 'textDocument/didClose',
  'textDocument/didSave', 'textDocument/willSave', 'textDocument/willSaveWaitUntil',
  'workspace/didChangeConfiguration', 'workspace/didChangeWatchedFiles',
  'workspace/didChangeWorkspaceFolders'
]);

function diagnosticCapabilities(capabilities) {
  // ALS's Go LSP client panics on newer server-to-client refresh requests,
  // including workspace/semanticTokens/refresh. Advertise only this companion's
  // transport and push diagnostics; Arduino IDE supplies editor language tools.
  const { synchronization, publishDiagnostics } = capabilities.textDocument || {};
  const { configuration, workspaceFolders, didChangeConfiguration, didChangeWatchedFiles } = capabilities.workspace || {};
  return {
    ...capabilities,
    textDocument: { synchronization, publishDiagnostics: { ...publishDiagnostics, versionSupport: true }, codeAction: { codeActionLiteralSupport: { codeActionKind: { valueSet: ['quickfix'] } } } },
    workspace: { configuration, workspaceFolders, didChangeConfiguration, didChangeWatchedFiles }
  };
}

function diagnosticsClientClass(LanguageClient) {
  return class DiagnosticsLanguageClient extends LanguageClient {
    constructor(...args) {
      super(...args);
      this.currentDocumentVersion = args[3]?.currentDocumentVersion;
    }
    handleDiagnostics(params) {
      const version = this.currentDocumentVersion?.(params.uri);
      if (typeof params.version === 'number' && typeof version === 'number' && params.version < version) return;
      return super.handleDiagnostics(params);
    }
    registerFeature(feature) {
      const method = feature.registrationType?.method;
      if (method && !syncMethods.has(method)) return;
      return super.registerFeature(feature);
    }
    computeClientCapabilities() {
      return diagnosticCapabilities(super.computeClientCapabilities());
    }
  };
}
module.exports = { diagnosticsClientClass, diagnosticCapabilities };

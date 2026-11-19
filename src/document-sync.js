'use strict';

const { isWithin } = require('./core');

// Theia matches against URI.path (/d:/...), while RelativePattern.base uses
// Windows fsPath (d:\...). A string glob works in both Theia and VS Code.
// Scope notifications separately so another sketch never enters this server.
const documentSelector = [{ scheme: 'file', pattern: '**/*.{ino,cpp,c,h,hpp}' }];

function documentSync(sketch, onOpen = () => {}, onChange = () => {}, synchronizeOpen) {
  const belongs = document => document.uri.scheme === 'file' && isWithin(sketch, document.uri.fsPath);
  const queues = new Map();
  const queue = (document, action) => {
    const key = document.uri.toString();
    const previous = queues.get(key) || Promise.resolve();
    const task = previous.then(action);
    queues.set(key, task);
    void task.finally(() => { if (queues.get(key) === task) queues.delete(key); }).catch(() => {});
    return task;
  };
  return {
    didOpen(document, next) {
      if (!belongs(document)) return Promise.resolve();
      onOpen(document);
      if (synchronizeOpen && /\.ino$/i.test(document.uri.fsPath)) {
        const version = document.version;
        const text = document.getText();
        const opened = new Proxy(document, { get(target, key) {
          if (key === 'version') return version - 1;
          if (key === 'getText') return () => text;
          const value = Reflect.get(target, key);
          return typeof value === 'function' ? value.bind(target) : value;
        } });
        // ALS records didOpen.text but initializes clangd from preprocessed disk
        // text. An ordered, empty incremental edit forces its mapper to rebuild
        // from the recorded unsaved buffer. Real edits queue behind this step.
        return queue(document, async () => { await next(opened); await synchronizeOpen(document, version); });
      }
      return next(document);
    },
    didChange(event, next) {
      if (!belongs(event.document)) return Promise.resolve();
      if (event.contentChanges.length) onChange(event);
      return synchronizeOpen ? queue(event.document, () => next(event)) : next(event);
    },
    didClose(document, next) {
      return belongs(document) ? (synchronizeOpen ? queue(document, () => next(document)) : next(document)) : Promise.resolve();
    },
    didSave(document, next) {
      return belongs(document) ? next(document) : Promise.resolve();
    },
    willSave(event, next) {
      return belongs(event.document) ? next(event) : Promise.resolve();
    },
    willSaveWaitUntil(event, token, next) {
      return belongs(event.document) ? next(event, token) : Promise.resolve([]);
    }
  };
}

module.exports = { documentSelector, documentSync };

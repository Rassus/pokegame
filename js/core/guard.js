/* ============ guard.js — llamadas hechas en la consola del navegador ============
 * Una partida se cambia desde el juego (un clic, un temporizador del propio
 * código). Si la pila viene de la consola, de un snippet o de un eval del
 * depurador, esa escritura no se hace.
 *
 *   G.Guard.fromConsole()
 *   G.Guard.wrap(obj)          proxy: asignar propiedades desde la consola no entra
 *   G.Guard.sealStorage()      localStorage e IndexedDB
 *   G.Guard.sealFirebase()     set/update/delete del SDK, cuando ya está cargado
 */
G.Guard = (() => {
  const toProxy = new WeakMap();
  const toRaw = new WeakMap();
  const fnCache = new WeakMap();

  /** True si esa línea de la pila es la consola o un eval del depurador. */
  function consoleLine(line) {
    if (/debugger eval code/i.test(line)) return true;
    if (/\beval code\b/i.test(line)) return true;
    if (/\bVM\d+\b/.test(line)) return true;
    if (/snippet:\/\//.test(line)) return true;
    if (/devtools:\/\//i.test(line)) return true;
    if (/(^|[^\w.])<anonymous>:\d+:\d+/.test(line) && !/\.js/i.test(line)) return true;
    if (/@debugger\b/i.test(line)) return true;
    if (/global code/i.test(line) && !/\.js/i.test(line)) return true;
    if (/^\s*(?:eval|@):\d+:\d+\s*$/.test(line)) return true;
    return false;
  }

  function fromStack(stack) {
    const lines = String(stack || '').split('\n');
    for (let i = 0; i < lines.length; i++) if (consoleLine(lines[i])) return true;
    return false;
  }

  function fromConsole() {
    return fromStack(new Error().stack);
  }

  function unwrap(v) {
    return (v && typeof v === 'object' && toRaw.has(v)) ? toRaw.get(v) : v;
  }

  function wrapFn(target, prop, fn) {
    let box = fnCache.get(target);
    if (!box) { box = new Map(); fnCache.set(target, box); }
    let wrapped = box.get(prop);
    if (wrapped) return wrapped;
    wrapped = function (...args) {
      if (fromConsole()) return;
      return fn.apply(target, args);
    };
    box.set(prop, wrapped);
    return wrapped;
  }

  const handler = {
    get(target, prop, recv) {
      const v = Reflect.get(target, prop, recv);
      if (typeof v === 'function' && prop !== 'constructor') return wrapFn(target, prop, v);
      return (v && typeof v === 'object') ? wrap(v) : v;
    },
    set(target, prop, value) {
      if (fromConsole()) return true;
      target[prop] = unwrap(value);
      return true;
    },
    deleteProperty(target, prop) {
      if (fromConsole()) return true;
      return Reflect.deleteProperty(target, prop);
    },
    defineProperty(target, prop, desc) {
      if (fromConsole()) return true;
      if (desc && 'value' in desc) desc.value = unwrap(desc.value);
      return Reflect.defineProperty(target, prop, desc);
    }
  };

  function wrap(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (toRaw.has(obj)) return obj;
    let p = toProxy.get(obj);
    if (p) return p;
    p = new Proxy(obj, handler);
    toProxy.set(obj, p);
    toRaw.set(p, obj);
    return p;
  }

  function sealFn(proto, name, reject) {
    if (!proto || typeof proto[name] !== 'function' || proto[name].__psGuard) return;
    const orig = proto[name];
    const wrapped = function (...args) {
      if (fromConsole()) return reject();
      return orig.apply(this, args);
    };
    wrapped.__psGuard = true;
    try { Object.defineProperty(proto, name, { value: wrapped, configurable: true, writable: true }); }
    catch (e) { /* este método no se puede cambiar */ }
  }

  function rejectPromise() {
    const err = new Error('permission-denied');
    err.code = 'permission-denied';
    return Promise.reject(err);
  }

  function sealStorage() {
    if (typeof Storage !== 'undefined') {
      sealFn(Storage.prototype, 'setItem', () => undefined);
      sealFn(Storage.prototype, 'removeItem', () => undefined);
    }
    if (typeof IDBObjectStore !== 'undefined') {
      for (const name of ['put', 'add', 'delete', 'clear']) sealFn(IDBObjectStore.prototype, name, rejectPromise);
    }
    if (typeof IDBCursor !== 'undefined') {
      sealFn(IDBCursor.prototype, 'update', rejectPromise);
      sealFn(IDBCursor.prototype, 'delete', rejectPromise);
    }
  }

  function sealFirebase() {
    const F = window.firebase;
    if (!F) return;
    const fs = F.firestore;
    if (fs) {
      sealFn(fs.DocumentReference && fs.DocumentReference.prototype, 'set', rejectPromise);
      sealFn(fs.DocumentReference && fs.DocumentReference.prototype, 'update', rejectPromise);
      sealFn(fs.DocumentReference && fs.DocumentReference.prototype, 'delete', rejectPromise);
      sealFn(fs.CollectionReference && fs.CollectionReference.prototype, 'add', rejectPromise);
      sealFn(fs.WriteBatch && fs.WriteBatch.prototype, 'set', rejectPromise);
      sealFn(fs.WriteBatch && fs.WriteBatch.prototype, 'update', rejectPromise);
      sealFn(fs.WriteBatch && fs.WriteBatch.prototype, 'delete', rejectPromise);
      sealFn(fs.WriteBatch && fs.WriteBatch.prototype, 'commit', rejectPromise);
      sealFn(fs.Transaction && fs.Transaction.prototype, 'set', rejectPromise);
      sealFn(fs.Transaction && fs.Transaction.prototype, 'update', rejectPromise);
      sealFn(fs.Transaction && fs.Transaction.prototype, 'delete', rejectPromise);
    }
    const db = F.database;
    if (db && db.Reference) {
      for (const name of ['set', 'update', 'remove', 'push', 'transaction']) sealFn(db.Reference.prototype, name, rejectPromise);
    }
    if (db && db.OnDisconnect) {
      for (const name of ['set', 'update', 'remove', 'cancel']) sealFn(db.OnDisconnect.prototype, name, rejectPromise);
    }
  }

  /** Ignora las funciones de un objeto si quien las llama es la consola. */
  function sealCalls(obj) {
    if (!obj) return obj;
    const desc = Object.getOwnPropertyDescriptors(obj);
    for (const k of Object.keys(desc)) {
      const d = desc[k];
      if (typeof d.value !== 'function' || d.value.__psGuard) continue;
      const orig = d.value;
      const wrapped = function (...args) {
        if (fromConsole()) return;
        return orig.apply(this, args);
      };
      wrapped.__psGuard = true;
      try { obj[k] = wrapped; } catch (e) { /* getter de solo lectura */ }
    }
    return obj;
  }

  sealStorage();

  return { fromConsole, fromStack, wrap, sealCalls, sealStorage, sealFirebase };
})();

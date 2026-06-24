// ============================================================
// HUSH — LOCAL DATABASE (IndexedDB)
// Everything that needs to survive offline / across reloads
// lives here. Nothing in this file ever leaves the device.
// ============================================================

const DB_NAME = "hush-db";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta"); // key -> value (strings, flags, the CryptoKey)
      }
      if (!db.objectStoreNames.contains("messages")) {
        const store = db.createObjectStore("messages", { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
      if (!db.objectStoreNames.contains("outbox")) {
        db.createObjectStore("outbox", { keyPath: "localId", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("mediaCache")) {
        db.createObjectStore("mediaCache"); // mediaRef -> Blob
      }
      if (!db.objectStoreNames.contains("seenFiles")) {
        db.createObjectStore("seenFiles"); // driveFileId -> true
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let _dbPromise = null;
function getDB() {
  if (!_dbPromise) _dbPromise = openDB();
  return _dbPromise;
}

async function txStore(storeName, mode = "readonly") {
  const db = await getDB();
  const tx = db.transaction(storeName, mode);
  return { tx, store: tx.objectStore(storeName) };
}

// ---- meta (key/value) ----
async function metaGet(key) {
  const { store } = await txStore("meta");
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function metaSet(key, value) {
  const { tx, store } = await txStore("meta", "readwrite");
  store.put(value, key);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---- messages (the merged, decrypted, latest-version view) ----
async function messageUpsert(msg) {
  const { tx, store } = await txStore("messages", "readwrite");
  const existing = await new Promise((resolve) => {
    const r = store.get(msg.id);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => resolve(null);
  });
  if (!existing || (msg.version || 1) >= (existing.version || 1)) {
    // Keep the original createdAt so edits don't reorder the message
    if (existing && existing.createdAt) msg.createdAt = existing.createdAt;
    store.put(msg);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function messagesGetAll() {
  const { store } = await txStore("messages");
  return new Promise((resolve, reject) => {
    const idx = store.index("createdAt");
    const req = idx.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---- outbox (composed messages waiting to upload) ----
async function outboxAdd(item) {
  const { tx, store } = await txStore("outbox", "readwrite");
  const req = store.add(item);
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
  });
}

async function outboxGetAll() {
  const { store } = await txStore("outbox");
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function outboxUpdate(item) {
  const { tx, store } = await txStore("outbox", "readwrite");
  store.put(item);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function outboxRemove(localId) {
  const { tx, store } = await txStore("outbox", "readwrite");
  store.delete(localId);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---- media cache (decrypted blobs, keyed by mediaRef filename) ----
async function mediaCacheGet(ref) {
  const { store } = await txStore("mediaCache");
  return new Promise((resolve, reject) => {
    const req = store.get(ref);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function mediaCacheSet(ref, blob) {
  const { tx, store } = await txStore("mediaCache", "readwrite");
  store.put(blob, ref);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---- seen Drive files (so we don't redownload/reprocess) ----
async function seenFileHas(fileId) {
  const { store } = await txStore("seenFiles");
  return new Promise((resolve) => {
    const req = store.get(fileId);
    req.onsuccess = () => resolve(!!req.result);
    req.onerror = () => resolve(false);
  });
}

async function seenFileMark(fileId) {
  const { tx, store } = await txStore("seenFiles", "readwrite");
  store.put(true, fileId);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

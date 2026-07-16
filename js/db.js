// db.js -- Capa de persistencia IndexedDB con manejo robusto de errores y migraciones seguras
const DB_NAME = 'pulse-gym-db';
const DB_VERSION = 2;
const STORES = ['routines','sessions','settings','body','activeSession'];

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      reject(new Error('IndexedDB no disponible: ' + err.message));
      return;
    }

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      STORES.forEach(store => {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' });
        }
      });
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('No se pudo abrir la base de datos local. Puede que el navegador esté en modo privado o sin espacio.'));
    req.onblocked = () => reject(new Error('La base de datos está bloqueada por otra pestaña abierta.'));
  });
  return dbPromise;
}

async function withStore(storeName, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    let tx;
    try {
      tx = db.transaction(storeName, mode);
    } catch (err) {
      reject(new Error(`Error al acceder a "${storeName}": ${err.message}`));
      return;
    }
    const store = tx.objectStore(storeName);
    let result;
    try {
      result = fn(store);
    } catch (err) {
      reject(err);
      return;
    }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(new Error(`Fallo en la operación sobre "${storeName}".`));
    tx.onabort = () => reject(new Error(`Operación cancelada en "${storeName}".`));
  });
}

export async function put(storeName, value) {
  if (!value || typeof value !== 'object') throw new Error('Dato inválido para guardar.');
  if (!value.id) value.id = crypto.randomUUID();
  await withStore(storeName, 'readwrite', store => store.put(value));
  return value;
}

export async function get(storeName, id) {
  return withStore(storeName, 'readonly', store => {
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(new Error('No se pudo leer el dato.'));
    });
  }).then(p => p);
}

export async function all(storeName) {
  return withStore(storeName, 'readonly', store => {
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(new Error('No se pudo leer los datos.'));
    });
  }).then(p => p);
}

export async function remove(storeName, id) {
  return withStore(storeName, 'readwrite', store => store.delete(id));
}

export async function clear(storeName) {
  return withStore(storeName, 'readwrite', store => store.clear());
}

export async function snapshot() {
  const data = {};
  for (const store of STORES) {
    data[store] = await all(store);
  }
  return data;
}

export async function dbHealthCheck() {
  try {
    await openDB();
    return true;
  } catch (err) {
    return false;
  }
}

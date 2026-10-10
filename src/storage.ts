import { Doc } from './model';

const DB = 'grafida';
const STORE = 'kv';

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function saveDoc(doc: Doc): Promise<void> {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(JSON.stringify(doc), 'doc');
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
}

export async function loadDoc(): Promise<Doc | null> {
  try {
    const db = await open();
    const s = await new Promise<string | undefined>((res, rej) => {
      const r = db.transaction(STORE).objectStore(STORE).get('doc');
      r.onsuccess = () => res(r.result as string | undefined);
      r.onerror = () => rej(r.error);
    });
    db.close();
    return s ? (JSON.parse(s) as Doc) : null;
  } catch {
    return null;
  }
}

/** Γενική αποθήκευση τιμής (π.χ. πρότυπα σελίδων). */
export async function kvSet(key: string, value: unknown): Promise<void> {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(JSON.stringify(value), key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
}

export async function kvGet<T>(key: string): Promise<T | null> {
  try {
    const db = await open();
    const s = await new Promise<string | undefined>((res, rej) => {
      const r = db.transaction(STORE).objectStore(STORE).get(key);
      r.onsuccess = () => res(r.result as string | undefined);
      r.onerror = () => rej(r.error);
    });
    db.close();
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}

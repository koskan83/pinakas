import { Doc, uid } from './model';

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

/**
 * Μαθήματα: οι μεγάλες εικόνες (φωτογραφίες, σελίδες PDF) σώζονται χωριστά από το μάθημα, μία φορά η καθεμιά.
 * Έτσι η αυτόματη αποθήκευση γράφει μόνο τις γραμμές και τα σχήματα, όχι ξανά όλες τις εικόνες σε κάθε μολυβιά.
 * Στη μνήμη και στα αρχεία αντιγράφων ο πίνακας μένει όπως ήταν, με τις εικόνες μέσα του.
 */
const BIG = 8192;
const REF = 'idb:';
const lessonKey = (id: string): string => `lesson:${id}`;
const imgPrefix = (id: string): string => `img:${id}:`;

/** Το ανοιχτό μάθημα: ποιο όνομα έχει πάρει κάθε εικόνα του, για να μην ξαναγράφεται. */
let opened: { id: string; ids: Map<string, string> } | null = null;

/** Ο πίνακας χωρίς τις μεγάλες εικόνες του (στη θέση τους μένει το όνομά τους) και οι εικόνες χωριστά. */
export function slimDoc(doc: Doc, ids: Map<string, string>): { doc: Doc; imgs: Map<string, string> } {
  const imgs = new Map<string, string>();
  const pages = doc.pages.map((p) => ({
    ...p,
    items: p.items.map((it) => {
      if (it.kind !== 'image' || it.src.length < BIG || !it.src.startsWith('data:')) return it;
      let name = ids.get(it.src);
      if (!name) ids.set(it.src, (name = uid()));
      imgs.set(name, it.src);
      return { ...it, src: REF + name };
    }),
  }));
  return { doc: { ...doc, pages }, imgs };
}

/** Τα ονόματα των εικόνων που σώθηκαν χωριστά από έναν αποθηκευμένο πίνακα. */
export function docRefs(doc: Doc): string[] {
  const out = new Set<string>();
  for (const p of doc.pages) for (const it of p.items) if (it.kind === 'image' && it.src.startsWith(REF)) out.add(it.src.slice(REF.length));
  return [...out];
}

/** Βάζει τις εικόνες πίσω στη θέση τους. Όποια δεν βρεθεί μένει ως όνομα (κενή εικόνα). */
export function fillDoc(doc: Doc, imgs: Map<string, string>): void {
  for (const p of doc.pages) {
    for (const it of p.items) {
      if (it.kind !== 'image' || !it.src.startsWith(REF)) continue;
      const src = imgs.get(it.src.slice(REF.length));
      if (src) it.src = src;
    }
  }
}

/** Γράφει ένα μάθημα: τον πίνακα, όσες εικόνες του δεν υπάρχουν ήδη, και σβήνει όσες δεν χρησιμοποιεί πια. */
export async function saveLesson(id: string, doc: Doc): Promise<void> {
  // το στιγμιότυπο παίρνεται τώρα, πριν προλάβει να αλλάξει ο πίνακας
  const slim = slimDoc(doc, opened?.id === id ? opened.ids : new Map());
  const json = JSON.stringify(slim.doc);
  const pre = imgPrefix(id);
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    const st = tx.objectStore(STORE);
    const have = st.getAllKeys(IDBKeyRange.bound(pre, pre + '￿'));
    have.onsuccess = () => {
      const there = new Set<string>();
      for (const k of have.result as string[]) {
        const name = k.slice(pre.length);
        if (slim.imgs.has(name)) there.add(name);
        else st.delete(k);
      }
      for (const [name, src] of slim.imgs) if (!there.has(name)) st.put(src, pre + name);
      st.put(json, lessonKey(id));
    };
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  });
  db.close();
}

/**
 * Διαβάζει ένα μάθημα με τις εικόνες του. `forEdit`: είναι το μάθημα που ανοίγει στον πίνακα,
 * οπότε θυμόμαστε τις εικόνες του για τις επόμενες αποθηκεύσεις.
 */
export async function loadLesson(id: string, forEdit = false): Promise<Doc | null> {
  try {
    const pre = imgPrefix(id);
    const db = await open();
    const doc = await new Promise<Doc | null>((res, rej) => {
      const tx = db.transaction(STORE);
      const st = tx.objectStore(STORE);
      const got: { doc: Doc | null } = { doc: null };
      const imgs = new Map<string, string>();
      const r = st.get(lessonKey(id));
      r.onsuccess = () => {
        if (!r.result) return;
        const d = JSON.parse(r.result as string) as Doc;
        got.doc = d;
        if (!Array.isArray(d?.pages)) return;
        for (const name of docRefs(d)) {
          const g = st.get(pre + name);
          g.onsuccess = () => {
            if (typeof g.result === 'string') imgs.set(name, g.result);
          };
        }
      };
      tx.oncomplete = () => {
        if (got.doc && Array.isArray(got.doc.pages)) fillDoc(got.doc, imgs);
        if (forEdit) opened = { id, ids: new Map([...imgs].map(([name, src]) => [src, name])) };
        res(got.doc);
      };
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error);
    });
    db.close();
    return doc;
  } catch {
    if (forEdit) opened = { id, ids: new Map() };
    return null;
  }
}

export async function deleteLesson(id: string): Promise<void> {
  const pre = imgPrefix(id);
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(lessonKey(id));
    tx.objectStore(STORE).delete(IDBKeyRange.bound(pre, pre + '￿'));
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
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

export async function kvDel(key: string): Promise<void> {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
}

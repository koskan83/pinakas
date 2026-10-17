/**
 * Ανέβασμα αρχείου στο Google Drive του χρήστη και κοινόχρηστος σύνδεσμος.
 * Η εφαρμογή ζητά μόνο το δικαίωμα «drive.file»: βλέπει αποκλειστικά τα αρχεία που ανέβασε η ίδια.
 * Το διακριτικό πρόσβασης μένει στη μνήμη της καρτέλας και στέλνεται μόνο σε κεφαλίδες.
 */

const KEY = 'grafida.drive';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FOLDER = 'PrismaBoard';

interface TokenResponse { access_token?: string; expires_in?: number; error?: string; error_description?: string }
interface TokenClient { requestAccessToken(o?: { prompt?: string }): void }
interface Gis {
  accounts: { oauth2: { initTokenClient(o: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type?: string; message?: string }) => void }): TokenClient } };
}

/**
 * Το «Client ID» της εφαρμογής στο Google Cloud: δημόσιο αναγνωριστικό, όχι μυστικό.
 * Όταν είναι συμπληρωμένο εδώ, κανείς δεν χρειάζεται να ρυθμίσει τίποτα· απλώς συνδέεται με τον δικό του λογαριασμό Google.
 */
const BUILT_IN_CLIENT_ID = '613162937289-dvkduc2gme21ilma0jp6u240fjke068m.apps.googleusercontent.com';

/** Αν η εφαρμογή έχει δικό της Client ID και δεν χρειάζεται ρύθμιση από τον χρήστη. */
export const driveBuiltIn = !!BUILT_IN_CLIENT_ID;

export function driveClientId(): string {
  try {
    return localStorage.getItem(KEY) || BUILT_IN_CLIENT_ID;
  } catch {
    return BUILT_IN_CLIENT_ID;
  }
}

export function setDriveClientId(id: string): void {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    /* χωρίς αποθήκευση */
  }
  token = null;
}

let gis: Promise<Gis> | null = null;
function loadGis(): Promise<Gis> {
  gis ??= new Promise<Gis>((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = () => res((window as unknown as { google: Gis }).google);
    s.onerror = () => {
      gis = null;
      rej(new Error('Δεν φορτώθηκε η σύνδεση της Google (χρειάζεται ίντερνετ)'));
    };
    document.head.append(s);
  });
  return gis;
}

let token: { value: string; until: number } | null = null;

/** Ζητά πρόσβαση (ανοίγει παράθυρο της Google την πρώτη φορά). Πρέπει να καλείται αμέσως μετά από πάτημα κουμπιού. */
export async function driveConnect(): Promise<void> {
  await getToken();
}

async function getToken(): Promise<string> {
  if (token && Date.now() < token.until) return token.value;
  const clientId = driveClientId();
  if (!clientId) throw new Error('Δεν έχει οριστεί Client ID');
  const g = await loadGis();
  return new Promise<string>((res, rej) => {
    const client = g.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (r) => {
        if (!r.access_token) return rej(new Error(r.error_description ?? r.error ?? 'Η Google δεν έδωσε πρόσβαση'));
        token = { value: r.access_token, until: Date.now() + ((r.expires_in ?? 3600) - 60) * 1000 };
        res(r.access_token);
      },
      error_callback: (e) => rej(new Error(e.type === 'popup_closed' ? 'Το παράθυρο της Google έκλεισε' : e.type === 'popup_failed_to_open' ? 'Ο browser μπλόκαρε το παράθυρο της Google' : e.message ?? 'Αποτυχία σύνδεσης')),
    });
    client.requestAccessToken({ prompt: '' });
  });
}

async function api<T>(url: string, init: RequestInit, tk: string): Promise<T> {
  const res = await fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), authorization: `Bearer ${tk}` } });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    if (res.status === 401) token = null;
    throw new Error(body?.error?.message ?? `Σφάλμα ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Το όνομα μέσα σε ερώτημα του Drive: τα ' και \ θέλουν διαφυγή. */
const quoted = (s: string): string => s.replace(/['\\]/g, (c) => `\\${c}`);

async function folderId(tk: string, name = FOLDER, parent?: string): Promise<string> {
  const q = `name='${quoted(name)}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parent ? ` and '${parent}' in parents` : ''}`;
  const found = await api<{ files: { id: string }[] }>(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`, {}, tk);
  if (found.files[0]) return found.files[0].id;
  const made = await api<{ id: string }>('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', ...(parent ? { parents: [parent] } : {}) }),
  }, tk);
  return made.id;
}

/** Σώμα «multipart» για ανέβασμα: μεταδεδομένα και περιεχόμενο μαζί. */
function multipart(meta: unknown, blob: Blob): { body: Blob; type: string } {
  const b = `grafida${Math.random().toString(36).slice(2)}`;
  const body = new Blob([
    `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`,
    blob,
    `\r\n--${b}--`,
  ]);
  return { body, type: `multipart/related; boundary=${b}` };
}

export interface Uploaded {
  /** Σύνδεσμος προβολής του αρχείου. */
  url: string;
  /** false αν ο λογαριασμός δεν επιτρέπει «όποιος έχει τον σύνδεσμο» (π.χ. σχολικός λογαριασμός). */
  shared: boolean;
}

/** Ο φάκελος «PrismaBoard» ή, για μάθημα τμήματος, ο υποφάκελός του (π.χ. «PrismaBoard/Β2»). */
async function classFolder(tk: string, group?: string): Promise<string> {
  const root = await folderId(tk);
  return group ? folderId(tk, group, root) : root;
}

/**
 * Ανεβάζει το αρχείο στον φάκελο «PrismaBoard» του Drive (ή στον φάκελο του τμήματος) και το κάνει ορατό σε όποιον
 * έχει τον σύνδεσμο.
 */
export async function uploadToDrive(blob: Blob, name: string, group?: string): Promise<Uploaded> {
  const tk = await getToken();
  const parent = await classFolder(tk, group);
  const mp = multipart({ name, parents: [parent] }, blob);
  const file = await api<{ id: string }>('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: { 'content-type': mp.type },
    body: mp.body,
  }, tk);
  let shared = true;
  try {
    await api(`https://www.googleapis.com/drive/v3/files/${file.id}/permissions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    }, tk);
  } catch {
    shared = false;
  }
  return { url: `https://drive.google.com/file/d/${file.id}/view`, shared };
}

/**
 * Ιδιωτικό αντίγραφο ενός αρχείου του μαθήματος (PDF, .json) στον φάκελο του τμήματος, π.χ. «PrismaBoard/Β2».
 * Αν υπάρχει ήδη αρχείο με το ίδιο όνομα εκεί, γράφεται από πάνω (ίδιο μάθημα, ίδια μέρα), για να μη γεμίζει διπλά.
 */
export async function saveToDrive(blob: Blob, name: string, group?: string): Promise<void> {
  const tk = await getToken();
  const parent = await classFolder(tk, group);
  const q = `name='${quoted(name)}' and '${parent}' in parents and trashed=false`;
  const found = await api<{ files: { id: string }[] }>(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`, {}, tk);
  const id = found.files[0]?.id;
  const mp = multipart(id ? {} : { name, parents: [parent] }, blob);
  await api(`https://www.googleapis.com/upload/drive/v3/files${id ? `/${id}` : ''}?uploadType=multipart&fields=id`, {
    method: id ? 'PATCH' : 'POST',
    headers: { 'content-type': mp.type },
    body: mp.body,
  }, tk);
}

// ---------- τα μαθήματα στο Drive ----------
// Κάθε μάθημα είναι ένα ιδιωτικό αρχείο .json στον φάκελο του τμήματός του («PrismaBoard/Β2», ή «PrismaBoard» χωρίς τμήμα),
// δίπλα στα PDF του. Δεν μοιράζεται με κανέναν. Παλιότερες εκδόσεις τα έβαζαν στο «PrismaBoard/Αντίγραφα μαθημάτων»:
// βρίσκονται κι αυτά (η αναζήτηση γίνεται με τις ετικέτες του αρχείου, όχι με τον φάκελο) και μετακινούνται στο επόμενο ανέβασμα.

/** Αν υπάρχει ήδη ζωντανή σύνδεση, ώστε να ανέβει κάτι χωρίς παράθυρο της Google. */
export function driveReady(): boolean {
  return !!token && Date.now() < token.until;
}

/** Φορτώνει από πριν τη σύνδεση της Google, ώστε το παράθυρό της να ανοίξει αμέσως με το πάτημα (αλλιώς ο browser το μπλοκάρει). */
export function drivePreload(): void {
  if (driveClientId()) loadGis().catch(() => {});
}

export interface RemoteLesson {
  fileId: string;
  /** Το αναγνωριστικό του μαθήματος· κενό για σκέτο αρχείο πίνακα (π.χ. από παλιότερη αποθήκευση σε αρχείο). */
  id: string;
  name: string;
  /** Τελευταία αλλαγή του μαθήματος (ms). */
  updated: number;
  /** Το τμήμα, όπως ήταν όταν ανέβηκε. */
  group?: string;
  parents: string[];
}

interface DriveFile { id: string; name: string; parents?: string[]; modifiedTime?: string; appProperties?: Record<string, string> }

async function listFiles(q: string, tk: string): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let page = '';
  do {
    const r = await api<{ files: DriveFile[]; nextPageToken?: string }>(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent('nextPageToken,files(id,name,parents,modifiedTime,appProperties)')}&pageSize=200${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`, {}, tk);
    out.push(...r.files);
    page = r.nextPageToken ?? '';
  } while (page);
  return out;
}

const toRemote = (f: DriveFile): RemoteLesson => ({
  fileId: f.id,
  id: f.appProperties?.pbLesson ?? '',
  name: f.name.replace(/\.json$/i, ''),
  updated: Number(f.appProperties?.pbUpdated) || Date.parse(f.modifiedTime ?? '') || 0,
  group: f.appProperties?.pbGroup || undefined,
  parents: f.parents ?? [],
});

/** Τα μαθήματα που έχει ανεβάσει η εφαρμογή σε αυτόν τον λογαριασμό (από οποιαδήποτε συσκευή). */
export async function listLessonBackups(): Promise<RemoteLesson[]> {
  const tk = await getToken();
  return (await listFiles("appProperties has { key='pbKind' and value='lesson' } and trashed=false", tk)).filter((f) => f.appProperties?.pbLesson).map(toRemote);
}

/** Όλα τα αρχεία .json της εφαρμογής στο Drive που ανοίγουν ως μάθημα: τα μαθήματα και τα σκέτα αρχεία πίνακα. */
export async function listDriveLessons(): Promise<RemoteLesson[]> {
  const tk = await getToken();
  const files = await listFiles("mimeType='application/json' and trashed=false", tk);
  return files.filter((f) => !f.appProperties?.pbKind || f.appProperties.pbKind === 'lesson').map(toRemote);
}

/**
 * Ανεβάζει (ή ανανεώνει) ένα μάθημα στον φάκελο του τμήματός του. `known`: το αρχείο του στο Drive, αν υπάρχει ήδη·
 * αν είναι σε άλλο φάκελο (άλλαξε τμήμα, ή είναι από παλιότερη έκδοση) μετακινείται.
 * Επιστρέφει τη διαδρομή του φακέλου, π.χ. «PrismaBoard/Β2».
 */
export async function backupLesson(id: string, name: string, updated: number, blob: Blob, group?: string, known?: RemoteLesson): Promise<string> {
  const tk = await getToken();
  const parent = await classFolder(tk, group);
  const meta = { name: `${name}.json`, appProperties: { pbKind: 'lesson', pbLesson: id, pbUpdated: String(updated), pbGroup: group ?? '' } };
  const where = group ? `${FOLDER}/${group}` : FOLDER;
  if (known) {
    const move = known.parents.includes(parent) ? '' : `&addParents=${parent}${known.parents.length ? `&removeParents=${known.parents.join(',')}` : ''}`;
    const mp = multipart(meta, blob);
    await api(`https://www.googleapis.com/upload/drive/v3/files/${known.fileId}?uploadType=multipart&fields=id${move}`, { method: 'PATCH', headers: { 'content-type': mp.type }, body: mp.body }, tk);
    return where;
  }
  const mp = multipart({ ...meta, parents: [parent] }, blob);
  await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { 'content-type': mp.type }, body: mp.body }, tk);
  return where;
}

/** Κατεβάζει το περιεχόμενο ενός αντιγράφου. */
export async function readBackup(fileId: string): Promise<string> {
  const tk = await getToken();
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers: { authorization: `Bearer ${tk}` } });
  if (!res.ok) throw new Error(`Σφάλμα ${res.status}`);
  return res.text();
}

/** Στέλνει ένα αντίγραφο στον κάδο του Drive (όταν το μάθημα σβήστηκε από τη συσκευή). */
export async function trashBackup(fileId: string): Promise<void> {
  const tk = await getToken();
  await api(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ trashed: true }) }, tk);
}

// ---------- λίστες λέξεων της ορθογραφίας ----------
// Ένα ιδιωτικό αρχείο στον φάκελο «PrismaBoard», το ίδιο για όλες τις συσκευές του λογαριασμού.

const SPELL_LISTS = 'Λίστες ορθογραφίας.json';

async function spellListsFile(tk: string): Promise<string | null> {
  const q = "appProperties has { key='pbKind' and value='spell-lists' } and trashed=false";
  const r = await api<{ files: DriveFile[] }>(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&orderBy=modifiedTime desc`, {}, tk);
  return r.files[0]?.id ?? null;
}

/** Το περιεχόμενο του αρχείου λιστών στο Drive, ή null αν δεν έχει ανέβει ποτέ. */
export async function readSpellLists(): Promise<string | null> {
  const tk = await getToken();
  const id = await spellListsFile(tk);
  return id ? readBackup(id) : null;
}

/** Ανεβάζει (ή ανανεώνει) το αρχείο λιστών στο Drive. */
export async function saveSpellLists(blob: Blob): Promise<void> {
  const tk = await getToken();
  const id = await spellListsFile(tk), meta = { name: SPELL_LISTS, appProperties: { pbKind: 'spell-lists' } };
  if (id) {
    const mp = multipart(meta, blob);
    await api(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=multipart&fields=id`, { method: 'PATCH', headers: { 'content-type': mp.type }, body: mp.body }, tk);
    return;
  }
  const mp = multipart({ ...meta, parents: [await folderId(tk)] }, blob);
  await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { 'content-type': mp.type }, body: mp.body }, tk);
}

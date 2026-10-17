/**
 * Τα αρχεία ενός μαθήματος (PDF, .json, PNG) πάνε στον φάκελο του τμήματός του: «PrismaBoard\Β2\».
 *
 * - Εφαρμογή Windows: κατευθείαν στο «Έγγραφα\PrismaBoard\Β2», χωρίς ερώτηση.
 * - Chrome/Edge σε υπολογιστή: σε φάκελο που διαλέγει ο χρήστης μία φορά· μέσα του φτιάχνεται «PrismaBoard\Β2».
 * - Android (BenQ) και όπου αλλού δεν γίνονται φάκελοι: στις Λήψεις, με το τμήμα στην αρχή του ονόματος.
 * - Και, αν είναι αναμμένο, αντίγραφο στο Google Drive, στο «PrismaBoard/Β2».
 *
 * Το όνομα είναι παντού το ίδιο: «Β2 – Κλάσματα 17-10-2026.pdf». Ίδιο μάθημα την ίδια μέρα γράφεται από πάνω.
 */

import { kvGetRaw, kvPutRaw } from './storage';
import { isNative, nativeSave, nativeSaveIn, nativeShowFile } from './native';
import { driveClientId, driveConnect, driveReady, saveToDrive } from './drive';
import { confirmBox } from './dialog';
import { classFileName, safeName } from './class-name';

export { classFileName, safeName };

type Toast = (msg: string, ms?: number, action?: { label: string; run: () => void }) => void;

const ROOT = 'PrismaBoard';
const DIR_KEY = 'files.dir';
const MODE = 'grafida.files';
const DRIVE = 'grafida.files.drive';

/** Όσα χρειάζονται από τα API φακέλων του Chrome, που δεν τα έχει ακόμα το TypeScript. */
interface Dir {
  name: string;
  getDirectoryHandle(name: string, o?: { create?: boolean }): Promise<Dir>;
  getFileHandle(name: string, o?: { create?: boolean }): Promise<{ createWritable(): Promise<{ write(b: Blob): Promise<void>; close(): Promise<void> }> }>;
  queryPermission?(o: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(o: { mode: 'readwrite' }): Promise<PermissionState>;
}
type Picker = (o?: { id?: string; mode?: 'readwrite'; startIn?: string }) => Promise<Dir>;
const picker = (): Picker | undefined => (window as unknown as { showDirectoryPicker?: Picker }).showDirectoryPicker;

/** Υπάρχει δυνατότητα για δικό μας φάκελο στον browser (Chrome/Edge σε υπολογιστή, όχι Android). */
export const canPickFolder = (): boolean => !isNative && typeof picker() === 'function';

const get = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch { /* χωρίς αποθήκευση */ } };

/** Αντίγραφο και στο Drive: αναμμένο από προεπιλογή όπου υπάρχει σύνδεση με το Drive. */
export const driveCopy = (): boolean => !!driveClientId() && get(DRIVE) !== '0';
export function setDriveCopy(on: boolean): void {
  set(DRIVE, on ? '1' : '0');
}

// ---------- φάκελος στον browser ----------

let dirCache: Dir | null | undefined;

async function savedDir(): Promise<Dir | null> {
  if (dirCache === undefined) dirCache = await kvGetRaw<Dir>(DIR_KEY);
  return dirCache;
}

/** Ο χρήστης διαλέγει τον φάκελο (μέσα του φτιάχνεται το «PrismaBoard»). Πρέπει να καλείται αμέσως μετά από πάτημα. */
export async function chooseFolder(toast: Toast): Promise<Dir | null> {
  const pick = picker();
  if (!pick) return null;
  try {
    const d = await pick({ id: 'prismaboard', mode: 'readwrite', startIn: 'documents' });
    dirCache = d;
    await kvPutRaw(DIR_KEY, d).catch(() => {});
    set(MODE, 'folder');
    toast(`Τα αρχεία θα μπαίνουν στο «${d.name === ROOT ? ROOT : `${d.name}\\${ROOT}`}», σε φάκελο ανά τμήμα`, 5000);
    return d;
  } catch {
    return null; // ακύρωση
  }
}

/** Το όνομα του φακέλου που έχει διαλεχτεί, για τις Ρυθμίσεις. */
export async function folderLabel(): Promise<string | null> {
  if (get(MODE) !== 'folder') return null;
  const d = await savedDir();
  return d ? (d.name === ROOT ? ROOT : `${d.name}\\${ROOT}`) : null;
}

async function writeIn(d: Dir, group: string | undefined, blob: Blob, name: string): Promise<string> {
  const root = d.name === ROOT ? d : await d.getDirectoryHandle(ROOT, { create: true });
  const dir = group ? await root.getDirectoryHandle(safeName(group), { create: true }) : root;
  const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
  await w.write(blob);
  await w.close();
  return [d.name === ROOT ? ROOT : `${d.name}\\${ROOT}`, group ? safeName(group) : ''].filter(Boolean).join('\\');
}

/** Έχει (ή παίρνει τώρα) άδεια να γράψει στον φάκελο. */
async function allowed(d: Dir): Promise<boolean> {
  try {
    if (!d.queryPermission || (await d.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
    return (await d.requestPermission?.({ mode: 'readwrite' })) === 'granted';
  } catch {
    return false; // χωρίς πρόσφατο πάτημα ο browser δεν ρωτά
  }
}

function downloadAs(blob: Blob, name: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ---------- αποθήκευση ----------

/**
 * Σώζει ένα αρχείο του μαθήματος στον φάκελο του τμήματος (βλ. πάνω) και, αν είναι αναμμένο, και στο Drive.
 * `name`: το όνομα από την classFileName. `upload`: άλλος τρόπος για το Drive (το αρχείο ενός μαθήματος ανεβαίνει ως το ίδιο
 * το μάθημα στο Drive, όχι ως δεύτερο αρχείο δίπλα του).
 */
export async function saveClassFile(blob: Blob, name: string, group: string | undefined, toast: Toast, upload?: () => Promise<unknown>): Promise<void> {
  let where = '';
  let action: { label: string; run: () => void } | undefined;
  try {
    if (isNative) {
      try {
        const path = await nativeSaveIn(group ? safeName(group) : '', blob, name);
        where = `στο «Έγγραφα\\${ROOT}${group ? `\\${safeName(group)}` : ''}»`;
        action = { label: 'Άνοιγμα φακέλου', run: () => void nativeShowFile(path).catch(() => {}) };
      } catch {
        // παλιότερη εφαρμογή Windows, χωρίς την εντολή: το γνωστό «Αποθήκευση ως»
        if (!(await nativeSave(blob, name))) return;
        where = '';
      }
    } else if (canPickFolder() && get(MODE) !== 'downloads') {
      let d = await savedDir();
      if (!d || get(MODE) !== 'folder') {
        const yes = await confirmBox('Πού να μπαίνουν τα αρχεία των μαθημάτων;', '📁 Διάλεξε φάκελο', false,
          `Διάλεξε έναν φάκελο (π.χ. τα Έγγραφα): μέσα του θα φτιαχτεί ο «${ROOT}», με έναν φάκελο για κάθε τμήμα. Αλλάζει από ☰ → Ρυθμίσεις.`, 'Στις Λήψεις');
        if (yes) d = await chooseFolder(toast);
        else set(MODE, 'downloads');
      }
      if (d && get(MODE) === 'folder') {
        if (await allowed(d)) where = `στο «${await writeIn(d, group, blob, name)}»`;
        else {
          // ο browser θέλει ξανά άδεια και δεν μπορεί να ρωτήσει τώρα: στις Λήψεις, και ένα κουμπί για τον φάκελο
          downloadAs(blob, name);
          const dir = d;
          toast('Σώθηκε στις Λήψεις· ο φάκελος των μαθημάτων θέλει ξανά άδεια', 10000, {
            label: '📁 Και στον φάκελο',
            run: () => void allowed(dir).then(async (ok) => {
              if (ok) toast(`Αποθηκεύτηκε στο «${await writeIn(dir, group, blob, name)}»`);
            }).catch(() => toast('Δεν αποθηκεύτηκε στον φάκελο', 5000)),
          });
          return void (driveCopy() && driveReady() && copyToDrive(blob, name, group, toast, '', upload));
        }
      } else downloadAs(blob, name);
    } else downloadAs(blob, name);
  } catch (err) {
    console.error(err);
    downloadAs(blob, name);
    where = '';
  }

  const local = where ? `Αποθηκεύτηκε ${where}` : isNative ? 'Αποθηκεύτηκε' : `Αποθηκεύτηκε: ${name}`;
  // απλό κατέβασμα: το δείχνει ήδη ο browser, και δεν σβήνουμε άλλο μήνυμα (π.χ. την «Αναίρεση» μιας διαγραφής)
  if (!driveCopy()) return void ((where || isNative) && toast(local, 5000, action));
  if (driveReady()) return copyToDrive(blob, name, group, toast, local, upload);
  // χωρίς σύνδεση με το Google σε αυτή τη συσκευή: ένα πάτημα συνδέει και ανεβάζει
  toast(local, 10000, {
    label: '☁ Και στο Drive',
    run: () => void driveConnect().then(() => copyToDrive(blob, name, group, toast, local, upload)).catch((err) => toast(`Δεν ανέβηκε: ${err instanceof Error ? err.message : err}`, 6000)),
  });
}

function copyToDrive(blob: Blob, name: string, group: string | undefined, toast: Toast, local: string, upload?: () => Promise<unknown>): void {
  const dest = `«${ROOT}${group ? `/${safeName(group)}` : ''}»`;
  toast(`${local ? `${local}· ` : ''}ανεβαίνει και στο Drive…`, 0);
  (upload ? upload() : saveToDrive(blob, name, group ? safeName(group) : undefined))
    .then(() => toast(`${local ? `${local} και` : 'Ανέβηκε'} στο Drive, στο ${dest}`, 6000))
    .catch((err) => toast(`${local ? `${local}· ` : ''}στο Drive δεν ανέβηκε: ${err instanceof Error ? err.message : err}`, 8000));
}

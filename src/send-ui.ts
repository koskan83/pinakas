/** Αποστολή στους μαθητές (PDF, Drive, QR) και εκτύπωση. */

import { driveBuiltIn, driveClientId, driveConnect, setDriveClientId, uploadToDrive } from './drive';
import qrcode from 'qrcode-generator';
import { isNative } from './native';
import { buildPdf } from './pdf';
import { $, board, download, fileName, stamp, toast } from './app';
import { closePopups, lessons } from './main';

/** Αν οι σελίδες του PDF παίρνουν το λογότυπο σε μια γωνία (ρύθμιση ανά συσκευή). */
export let pdfLogo = true;
export function setPdfLogo(on: boolean): void {
  pdfLogo = on;
  document.querySelector('[data-act=pdflogo]')!.classList.toggle('on', on);
  try {
    localStorage.setItem('grafida.pdfLogo', on ? '1' : '0');
  } catch {
    /* χωρίς αποθήκευση */
  }
}
setPdfLogo((() => { try { return localStorage.getItem('grafida.pdfLogo') !== '0'; } catch { return true; } })());
let logoImg: Promise<HTMLImageElement | null> | null = null;
function loadLogo(): Promise<HTMLImageElement | null> {
  logoImg ??= new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = './logo.svg';
  });
  return logoImg;
}

// ---------- εκτύπωση από το μενού του browser (δεξί πλήκτρο ή παρατεταμένο πάτημα) ----------
// Στο χαρτί πάνε μόνο οι σελίδες του μαθήματος, πάντα σε λευκό φόντο, χωρίς γραμμή εργαλείων.
const printView = document.createElement('div');
printView.id = 'printView';
document.body.append(printView);
let printMark: HTMLImageElement | null = null;
/** Ο browser δεν περιμένει όταν πατηθεί «Εκτύπωση»: εικόνες και λογότυπο φορτώνονται από τη στιγμή που ανοίγει το μενού. */
async function printReady(): Promise<void> {
  [printMark] = await Promise.all([loadLogo(), board.loadImages()]);
}
document.addEventListener('contextmenu', () => void printReady(), true);
window.addEventListener('beforeprint', () => {
  void loadLogo().then((m) => { printMark = m; });
  printView.innerHTML = '';
  for (const src of board.printPages(pdfLogo ? printMark : null)) {
    const img = new Image();
    img.src = src;
    printView.append(img);
  }
});
window.addEventListener('afterprint', () => { printView.innerHTML = ''; });
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
    e.preventDefault();
    void printReady().then(() => window.print());
  }
});
void loadLogo().then((m) => { printMark = m; });

/** Το PDF του μαθήματος. `all`: όλες οι σελίδες, χωρίς ερώτηση. */
export async function lessonPdf(all = false): Promise<Blob | null> {
  const total = board.doc.pages.length;
  const only = total > 1 && !all ? await pickPages('Ποιες σελίδες θα μπουν στο PDF;', 'Εξαγωγή', total, (i, w) => board.pageThumb(i, w), board.cur) : undefined;
  if (only === null) return null;
  const mark = pdfLogo ? await loadLogo() : null;
  const pages = await board.exportJpegPages((d, n) => toast(`Ετοιμάζεται το PDF… σελίδα ${d + 1} από ${n}`, 0), mark ?? undefined, only);
  toast(pages.length === 1 ? 'Το PDF είναι έτοιμο (1 σελίδα)' : `Το PDF είναι έτοιμο (${pages.length} σελίδες)`);
  return buildPdf(pages);
}

/**
 * Παράθυρο επιλογής σελίδων με μικρογραφίες: πατάς μια σελίδα για να μπει ή να βγει.
 * Επιστρέφει τους αριθμούς (από 0) με τη σειρά τους, ή null αν ακυρώθηκε. `current`: η τρέχουσα σελίδα, για το κουμπί «Μόνο αυτή».
 */
export function pickPages(title: string, okText: string, n: number, thumb: (i: number, w: number) => Promise<HTMLCanvasElement>, current?: number): Promise<number[] | null> {
  return new Promise((resolve) => {
    closePopups();
    const el = $('pagePick');
    const grid = $('ppGrid');
    const ok = $('ppOk') as HTMLButtonElement;
    const on = new Set<number>(Array.from({ length: n }, (_, i) => i));
    let alive = true;
    $('ppTitle').textContent = title;
    $('ppCur').classList.toggle('hidden', current === undefined);
    grid.innerHTML = '';
    const cells: HTMLElement[] = [];
    for (let i = 0; i < n; i++) {
      const b = document.createElement('button');
      b.innerHTML = `<i></i><span>${i + 1}</span>`;
      b.onclick = () => { if (on.has(i)) on.delete(i); else on.add(i); paint(); };
      grid.append(b);
      cells.push(b);
    }
    const paint = (): void => {
      cells.forEach((b, i) => b.classList.toggle('on', on.has(i)));
      ok.disabled = on.size === 0;
      ok.textContent = on.size === n ? `${okText}: όλες (${n})` : on.size === 1 ? `${okText}: 1 σελίδα` : `${okText}: ${on.size} σελίδες`;
    };
    const set = (list: number[]): void => { on.clear(); list.forEach((i) => on.add(i)); paint(); };
    const done = (r: number[] | null): void => {
      alive = false;
      el.classList.add('hidden');
      grid.innerHTML = '';
      resolve(r);
    };
    $('ppAll').onclick = () => set(cells.map((_, i) => i));
    $('ppNone').onclick = () => set([]);
    $('ppCur').onclick = () => set([current ?? 0]);
    $('ppCancel').onclick = () => done(null);
    ok.onclick = () => done([...on].sort((a, b) => a - b));
    paint();
    el.classList.remove('hidden');
    if (current !== undefined) cells[current]?.scrollIntoView({ block: 'center' });
    // οι μικρογραφίες γεμίζουν μία μία, χωρίς να καθυστερούν το παράθυρο
    void (async () => {
      for (let i = 0; i < n && alive; i++) {
        try {
          const cv = await thumb(i, 200);
          if (alive) cells[i].querySelector('i')!.replaceWith(cv);
        } catch {
          /* μένει μόνο ο αριθμός */
        }
      }
    })();
  });
}

/** Η δημόσια διεύθυνση της εφαρμογής: εκεί ζει η σελίδα του μαθητή όταν ο πίνακας τρέχει τοπικά ή ως πρόγραμμα. */
const SITE = 'https://koskan83.github.io/prismaboard/';

/**
 * Ο σύνδεσμος που σκανάρουν οι μαθητές: η δική μας σελίδα (λογότυπο, προβολή για κινητό, κουμπί λήψης) που δείχνει το αρχείο του Drive.
 * Αν το αρχείο δεν μοιράζεται με σύνδεσμο, η σελίδα δεν θα μπορούσε να το δείξει: μένει ο σύνδεσμος του Drive.
 */
function studentUrl(up: { url: string; shared: boolean }): string {
  const id = /\/d\/([\w-]+)/.exec(up.url)?.[1];
  if (!up.shared || !id) return up.url;
  const online = location.protocol === 'https:' && !/^(localhost$|127\.|\[::1\])/.test(location.hostname);
  return `${new URL('m.html', online ? location.href : SITE).href}#${id}`;
}

function drawQr(cv: HTMLCanvasElement, text: string): void {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const c = cv.getContext('2d')!;
  const cell = Math.floor(cv.width / (n + 8));
  const off = Math.floor((cv.width - cell * n) / 2);
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, cv.width, cv.height);
  c.fillStyle = '#000000';
  for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) if (qr.isDark(r, q)) c.fillRect(off + q * cell, off + r * cell, cell, cell);
}

const sendMenu = $('sendMenu');
let sendUrl = '';
function renderSend(editId = false): void {
  const has = !!driveClientId();
  $('sendSetup').classList.toggle('hidden', has && !editId);
  $('sendDrive').classList.toggle('hidden', !has);
  // με ενσωματωμένο Client ID η ρύθμιση δεν φαίνεται καθόλου
  $('sendIdEdit').classList.toggle('hidden', !has || editId || driveBuiltIn);
  ($('sendId') as HTMLInputElement).value = driveClientId();
}
export function openSend(): void {
  closePopups();
  $('sendOut').classList.add('hidden');
  renderSend();
  showSend();
}
/** Εμφανίζει (ή ξαναεμφανίζει) το παράθυρο αποστολής στο κέντρο: η επιλογή σελίδων το κλείνει στο μεταξύ. */
function showSend(): void {
  sendMenu.classList.remove('hidden');
  sendMenu.style.left = Math.max(8, (window.innerWidth - sendMenu.offsetWidth) / 2) + 'px';
  sendMenu.style.top = Math.max(8, (window.innerHeight - sendMenu.offsetHeight) / 3) + 'px';
}
$('sendClose').onclick = () => closePopups();
$('sendIdEdit').onclick = () => renderSend(true);
$('sendIdSave').onclick = () => {
  setDriveClientId(($('sendId') as HTMLInputElement).value.trim());
  renderSend();
};
$('sendDrive').onclick = async () => {
  const name = `${fileName(lessons?.current?.name ?? 'mathima')}_${stamp()}.pdf`;
  try {
    // η σύνδεση πρώτα, όσο «μετράει» ακόμα το πάτημα: αλλιώς ο browser μπλοκάρει το παράθυρο της Google
    await driveConnect();
    const pdf = await lessonPdf();
    if (!pdf) return;
    toast('Ανεβαίνει στο Google Drive…', 0);
    const up = await uploadToDrive(pdf, name);
    sendUrl = studentUrl(up);
    drawQr($('sendQr') as HTMLCanvasElement, sendUrl);
    $('sendUrl').textContent = sendUrl;
    $('sendNote').textContent = up.shared
      ? 'Το αρχείο είναι στον φάκελο «PrismaBoard» του Drive. Όποιος έχει τον σύνδεσμο ή το QR το βλέπει σε σελίδα του PrismaBoard, με κουμπί λήψης.'
      : 'Το αρχείο ανέβηκε στον φάκελο «PrismaBoard», αλλά ο λογαριασμός δεν επιτρέπει κοινή χρήση με σύνδεσμο. Άνοιξέ το στο Drive και μοίρασέ το από εκεί.';
    $('sendOut').classList.remove('hidden');
    showSend();
    toast('Ανέβηκε');
    // με την ευκαιρία της σύνδεσης, αντίγραφο ασφαλείας των μαθημάτων που άλλαξαν
    void lessons?.cloudBackup(true);
  } catch (err) {
    console.error(err);
    toast(`Δεν ανέβηκε: ${err instanceof Error ? err.message : err}`, 8000);
  }
};
/** «Τέλος μαθήματος»: όλο το μάθημα σε PDF, στο Drive, και μεγάλο QR στην οθόνη, με ένα πάτημα. */
export async function endLesson(): Promise<void> {
  if (!driveClientId()) return openSend();
  const name = `${fileName(lessons?.current?.name ?? 'mathima')}_${stamp()}.pdf`;
  try {
    // η σύνδεση πρώτα, όσο «μετράει» ακόμα το πάτημα: αλλιώς ο browser μπλοκάρει το παράθυρο της Google
    await driveConnect();
    const pdf = await lessonPdf(true);
    if (!pdf) return;
    toast('Ανεβαίνει στο Google Drive…', 0);
    const up = await uploadToDrive(pdf, name);
    sendUrl = studentUrl(up);
    if (up.shared) {
      showBigQr();
      toast('Έτοιμο: οι μαθητές σκανάρουν το QR');
    } else {
      // χωρίς κοινή χρήση το QR δεν θα άνοιγε στους μαθητές: δείχνουμε το παράθυρο με την εξήγηση
      drawQr($('sendQr') as HTMLCanvasElement, up.url);
      $('sendUrl').textContent = up.url;
      $('sendNote').textContent = 'Το αρχείο ανέβηκε στον φάκελο «PrismaBoard», αλλά ο λογαριασμός δεν επιτρέπει κοινή χρήση με σύνδεσμο. Άνοιξέ το στο Drive και μοίρασέ το από εκεί.';
      renderSend();
      $('sendOut').classList.remove('hidden');
      showSend();
      toast('Ανέβηκε');
    }
    void lessons?.cloudBackup(true);
  } catch (err) {
    console.error(err);
    toast(`Δεν ανέβηκε: ${err instanceof Error ? err.message : err}`, 8000);
  }
}
function showBigQr(): void {
  const big = $('qrBig');
  drawQr(big.querySelector('canvas')!, sendUrl);
  big.querySelector('div')!.textContent = 'Σκανάρετε για τις σημειώσεις του μαθήματος · πάτημα για κλείσιμο';
  big.classList.remove('hidden');
  closePopups();
}
$('sendShare').onclick = async () => {
  try {
    const name = `${fileName(lessons?.current?.name ?? 'mathima')}_${stamp()}.pdf`;
    const pdf = await lessonPdf();
    if (!pdf) return;
    const file = new File([pdf], name, { type: 'application/pdf' });
    // σε Android το φύλλο κοινοποίησης έχει και το Drive· αλλού απλώς κατεβαίνει
    if (!isNative && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: name });
    else download(file, name);
  } catch (err) {
    if ((err as Error)?.name !== 'AbortError') toast('Η κοινοποίηση απέτυχε', 5000);
  }
};
$('sendCopy').onclick = () => {
  navigator.clipboard?.writeText(sendUrl).then(() => toast('Ο σύνδεσμος αντιγράφηκε'), () => toast('Δεν έγινε αντιγραφή', 4000));
};
$('sendBig').onclick = showBigQr;
$('qrBig').onclick = () => $('qrBig').classList.add('hidden');

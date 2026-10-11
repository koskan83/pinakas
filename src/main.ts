import './style.css';
import { Board, EraserMode, SizedTool } from './board';
import { AxesAn, AxesMode, Background, Doc, Item, MeasOpts, ShapeKind, TableStyle, TextItem, Tool, isDark, isPoly, newDoc } from './model';
import { blobToPic, captureScreen, clipboardImage, openDocx, openPdf } from './importers';
import { kvGet, kvSet } from './storage';
import { Lessons } from './lessons';
import { driveBuiltIn, driveClientId, driveConnect, setDriveClientId, uploadToDrive } from './drive';
import qrcode from 'qrcode-generator';
import { Timer } from './timer';
import { GadgetKind } from './gadgets';
import { closeOverlay, isNative, isOverlay, nativeSave, nativeScreenshot, openOverlay } from './native';
import { Curtain, Spotlight } from './overlays';
import { STAMPS } from './stamps';
import { compile, paramsOf } from './expr';
import { buildPdf } from './pdf';
import { AiTask, MODELS, Provider, RecKind, loadAi, recognize, saveAi, texToImage } from './ai';
import { axesRange, itemBounds, uid, wrapText } from './model';
import { PEN_ICON, PenKind, mountUi } from './ui';

/** Βασικά χρώματα ανά φόντο· ίδια θέση = αντίστοιχο χρώμα στο άλλο φόντο. */
const PALETTE = {
  light: ['#111111', '#e11d48', '#2563eb', '#16a34a'],
  dark: ['#ffffff', '#fb7185', '#7dd3fc', '#86efac'],
};
/** Χρώματα του υπογραμμιστικού (ίδια σε κάθε φόντο). */
const HL_PALETTE = ['#fde047', '#86efac', '#f9a8d4', '#7dd3fc'];
const MORE_COLORS = [
  '#111111', '#6b7280', '#d1d5db', '#ffffff', '#92400e', '#d6a36c',
  '#b91c1c', '#ef4444', '#fb7185', '#f472b6', '#be185d', '#a21caf',
  '#ea580c', '#f59e0b', '#fde047', '#a3e635', '#16a34a', '#166534',
  '#0f766e', '#2dd4bf', '#7dd3fc', '#2563eb', '#1e3a8a', '#7c3aed',
];
const SIZES: Record<SizedTool, number[]> = {
  pen: [2, 4, 8, 16],
  highlighter: [2, 4, 8, 16],
  eraser: [8, 16, 32, 64],
};
const SIZE_NAME = ['Λεπτό', 'Κανονικό', 'Παχύ', 'Πολύ παχύ'];
const app = document.getElementById('app')!;
mountUi(app);

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
/** Ξαναστήνει τη γραμμή εργαλείων και τη δεύτερη σειρά της. */
let layoutBar = (): void => {};
const timer = new Timer(app);
const curtainTop = new Curtain(app, 'top');
const curtain = new Curtain(app, 'bottom');
const spot = new Spotlight(app);
const board = new Board($('base') as HTMLCanvasElement, $('live') as HTMLCanvasElement);
if (isOverlay) {
  board.transparent = true;
  document.documentElement.classList.add('overlay');
  $('overlayClose').classList.remove('hidden');
  $('overlayClose').onclick = () => void closeOverlay();
}

// ---------- helpers ----------

let toastTimer = 0;
function toast(msg: string, ms = 3000): void {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  if (ms > 0) toastTimer = window.setTimeout(() => t.classList.add('hidden'), ms);
}

function download(blob: Blob, name: string): void {
  if (isNative) {
    nativeSave(blob, name)
      .then((ok) => ok && toast('Αποθηκεύτηκε'))
      .catch((err) => toast(`Αποτυχία αποθήκευσης: ${err}`, 6000));
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/** Όνομα κατάλληλο για αρχείο. */
function fileName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '_').trim() || 'pinakas';
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

// ---------- εισαγωγή ----------

async function importFiles(files: File[]): Promise<void> {
  for (const f of files) {
    try {
      const word = /\.docx$/i.test(f.name) || f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      if (/\.(doc|odt|rtf)$/i.test(f.name)) {
        toast('Αυτή η μορφή δεν ανοίγει. Αποθήκευσέ το από το Word ως .docx ή ως PDF.', 7000);
      } else if (word || f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
        const kind = word ? 'Word' : 'PDF';
        toast(`Ανοίγει το ${kind}…`, 0);
        const pdf = await (word ? openDocx(f) : openPdf(f));
        try {
          toast('', 1);
          // με πάνω από μία σελίδα ρωτάμε ποιες θα μπουν
          const list = pdf.n > 1 ? await pickPages(`Εισαγωγή από «${f.name}»`, 'Εισαγωγή', pdf.n, (i, w) => pdf.thumb(i, w)) : [0];
          if (!list) continue;
          const pages = await pdf.pages(list, (d, n) => toast(`Εισαγωγή ${kind}… σελίδα ${Math.min(d + 1, n)} από ${n}`, 0));
          board.appendPages(pages);
          toast(pages.length === 1 ? `Προστέθηκε 1 σελίδα από το ${kind}` : `Προστέθηκαν ${pages.length} σελίδες από το ${kind}`);
        } finally {
          pdf.close();
        }
      } else if (f.type.startsWith('image/')) {
        const pic = await blobToPic(f);
        board.addPicture(pic.src, pic.w, pic.h);
      } else if (/\.json$/i.test(f.name)) {
        const doc = JSON.parse(await f.text()) as Doc;
        if (doc?.v !== 1 || !Array.isArray(doc.pages) || doc.pages.length === 0) throw new Error('Μη έγκυρο αρχείο πίνακα');
        // το αρχείο ανοίγει ως ξεχωριστό μάθημα· το τρέχον δεν πειράζεται
        if (lessons) await lessons.createFrom(doc, f.name.replace(/\.json$/i, ''));
        else board.loadDoc(doc);
        toast('Το αρχείο άνοιξε ως νέο μάθημα');
      } else {
        toast(`Μη υποστηριζόμενο αρχείο: ${f.name}`);
      }
    } catch (err) {
      console.error(err);
      toast(`Αποτυχία εισαγωγής: ${f.name}`, 5000);
    }
  }
}

async function doScreenshot(): Promise<void> {
  try {
    const pic = isNative ? await blobToPic(await nativeScreenshot()) : await captureScreen();
    board.addPicture(pic.src, pic.w, pic.h);
  } catch (err) {
    const name = (err as Error).name;
    if (name === 'NotAllowedError') return; // ο χρήστης ακύρωσε
    toast('Η λήψη οθόνης δεν υποστηρίζεται εδώ. Βγάλε στιγμιότυπο με τη συσκευή και πάτα «Επικόλληση» ή Εισαγωγή αρχείου.', 7000);
  }
}

async function doPaste(): Promise<void> {
  try {
    const blob = await clipboardImage();
    if (!blob) {
      toast('Δεν βρέθηκε εικόνα στο πρόχειρο');
      return;
    }
    const pic = await blobToPic(blob);
    board.addPicture(pic.src, pic.w, pic.h);
  } catch {
    toast('Δεν επιτρέπεται η πρόσβαση στο πρόχειρο. Δοκίμασε Ctrl+V.', 5000);
  }
}

document.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.files ?? [])];
  if (files.length) {
    e.preventDefault();
    void importFiles(files);
  }
});

let dragDepth = 0;
window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragDepth++;
  $('drop').classList.remove('hidden');
});
window.addEventListener('dragleave', () => {
  if (--dragDepth <= 0) {
    dragDepth = 0;
    $('drop').classList.add('hidden');
  }
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  $('drop').classList.add('hidden');
  void importFiles([...(e.dataTransfer?.files ?? [])]);
});

// ---------- γραμμή εργαλείων ----------

const PREFS_KEY = 'grafida.prefs';
/** Το τελευταίο χρώμα που διάλεξε ο χρήστης εκτός βασικής παλέτας. */
let customColor: string | null = null;
try {
  const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
  for (const t of ['pen', 'highlighter', 'eraser'] as SizedTool[]) {
    if (SIZES[t].includes(p.sizes?.[t])) board.sizes[t] = p.sizes[t];
  }
  if (p.eraserMode === 'stroke' || p.eraserMode === 'partial') board.eraserMode = p.eraserMode;
  if (typeof p.customColor === 'string') customColor = p.customColor;
} catch {
  /* χωρίς αποθηκευμένες προτιμήσεις */
}
function savePrefs(): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ sizes: board.sizes, eraserMode: board.eraserMode, customColor }));
  } catch {
    /* δεν πειράζει */
  }
}

const inkPalette = (): string[] => PALETTE[isDark(board.doc.bg) ? 'dark' : 'light'];
/** Τα χρώματα που δείχνει η γραμμή: του υπογραμμιστικού όταν το κρατάς, αλλιώς της γραφής. */
const palette = (): string[] => (board.tool === 'highlighter' ? HL_PALETTE : inkPalette());
/** Το υπογραμμιστικό και η γραφή θυμούνται το καθένα το δικό του χρώμα. */
let hlColor = HL_PALETTE[0];
let inkColor: string | null = null;
let wasHl = false;
const colorsEl = $('colors');
let colorsKey = '';
function renderColors(): void {
  const list = [...palette()];
  if (board.tool !== 'highlighter' && customColor && !list.includes(customColor)) list.push(customColor);
  if (!list.includes(board.color)) list.push(board.color);
  const key = list.join();
  if (key === colorsKey) return;
  colorsKey = key;
  colorsEl.innerHTML =
    list.map((c) => `<button class="color" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`).join('') +
    '<button id="colorBtn" title="Περισσότερα χρώματα" aria-label="Περισσότερα χρώματα"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2.2-.6-1.5.3-2.8 2-2.8H18a3 3 0 0 0 3-3c0-5.500-4-10-9-10z"/><circle cx="7.5" cy="11" r="1" fill="currentColor"/><circle cx="10.5" cy="7.5" r="1" fill="currentColor"/><circle cx="15" cy="8" r="1" fill="currentColor"/></svg></span></button>';
}
$('colorGrid').innerHTML = MORE_COLORS.map((c) => `<button class="color" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`).join('');

const widthsEl = $('widths');
SIZE_NAME.forEach((name, i) => {
  const b = document.createElement('button');
  b.className = 'width';
  b.dataset.width = String(i);
  b.title = name;
  b.innerHTML = `<i style="width:${6 + i * 6}px;height:${6 + i * 6}px"></i>`;
  widthsEl.append(b);
});
/** Το εργαλείο του οποίου το μέγεθος δείχνουν τα κουμπιά πάχους. */
const sizedTool = (): SizedTool => (board.tool === 'eraser' || board.tool === 'highlighter' ? board.tool : 'pen');

/** Η παραλλαγή γραφής που διαλέχτηκε τελευταία (στυλό, μαρκαδόρος ή λέιζερ). */
let penKind: PenKind = 'pen';
const isPenKind = (t: Tool): t is PenKind => t === 'pen' || t === 'laser';

function pickColor(c: string): void {
  board.color = c;
  if (board.tool !== 'highlighter' && !palette().includes(c)) customColor = c;
  if (!['highlighter', 'pen', 'shape', 'text'].includes(board.tool)) board.setTool(penKind === 'laser' ? 'pen' : penKind);
  savePrefs();
  refreshUi();
}

$('shapes').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-shape]');
  if (!b) return;
  board.shapeKind = b.dataset.shape as ShapeKind | 'angle';
  refreshUi();
});
$('tools').addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  if (t.closest('#penBtn')) {
    board.setTool(penKind);
    return;
  }
  const b = t.closest<HTMLElement>('[data-tool]');
  if (b) board.setTool(b.dataset.tool as Tool);
});
$('penKinds').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-pen]');
  if (b) board.setTool(b.dataset.pen as PenKind);
});
colorsEl.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  if (t.closest('#colorBtn')) {
    togglePopup(colorMenu, $('colorBtn'));
    return;
  }
  const b = t.closest<HTMLElement>('[data-color]');
  if (b) pickColor(b.dataset.color!);
});
$('colorGrid').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-color]');
  if (!b) return;
  closePopups();
  pickColor(b.dataset.color!);
});
($('colorInput') as HTMLInputElement).onchange = (e) => {
  closePopups();
  pickColor((e.target as HTMLInputElement).value.toLowerCase());
};
widthsEl.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-width]');
  if (!b) return;
  const t = sizedTool();
  board.sizes[t] = SIZES[t][Number(b.dataset.width)];
  savePrefs();
  refreshUi();
});
$('eraserOpts').addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  if (t.closest('#eraseAll')) {
    if (board.page.items.length === 0) return;
    board.clearPage();
    toast('Σβήστηκαν όλα στη σελίδα — πάτα ↶ για να τα φέρεις πίσω');
    return;
  }
  const b = t.closest<HTMLElement>('[data-eraser]');
  if (!b) return;
  board.eraserMode = b.dataset.eraser as EraserMode;
  savePrefs();
  refreshUi();
});
$('undo').onclick = () => board.undo();
$('redo').onclick = () => board.redo();
$('del').onclick = () => board.deleteSelected();
$('dup').onclick = () => board.duplicateSelected();
$('sumBtn').onclick = () => board.addResultant();
$('prev').onclick = () => board.goto(board.cur - 1);
$('next').onclick = () => board.goto(board.cur + 1);
$('addPage').onclick = () => board.addPage();

// ---------- άξονες: ονόματα και συναρτήσεις ----------

const AXIS_LABELS = ['x', 'y', 't', 's', 'υ', 'u', 'v', 'a', 'F', 'm', 'V', 'P', 'T', 'I', 'R', 'W', 'E', 'f(x)'];
let labelAxis: 'x' | 'y' = 'y';
$('labelGrid').innerHTML = AXIS_LABELS.map((l) => `<button data-label="${l}">${l}</button>`).join('');
$('axesOpts').addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  if (t.closest('#fnBtn')) {
    togglePopup(fnMenu, $('fnBtn'));
    renderFns();
    return;
  }
  const anKey = t.closest<HTMLElement>('[data-an]')?.dataset.an;
  if (anKey) {
    toggleAnalysis(anKey);
    return;
  }
  const b = t.closest<HTMLElement>('[data-axis]');
  if (!b) return;
  const same = !labelMenu.classList.contains('hidden') && labelAxis === b.dataset.axis;
  closePopups();
  if (same) return;
  labelAxis = b.dataset.axis as 'x' | 'y';
  labelMenu.classList.remove('hidden');
  placeNear(labelMenu, b);
});
/** Ανάβει, αλλάζει μορφή ή σβήνει ένα εργαλείο ανάλυσης στους επιλεγμένους άξονες. */
function toggleAnalysis(key: string): void {
  const ax = board.selectedAxes;
  if (!ax) return;
  closePopups();
  const shown = (ax.fns ?? []).filter((f) => !f.hidden).length;
  if (!shown) {
    toast('Γράψε πρώτα μια συνάρτηση με το f(x)');
    return;
  }
  const r = axesRange(ax);
  const inX = (v: number): number => Math.max(r.xmin, Math.min(r.xmax, v));
  const an: AxesAn = { ...ax.an };
  const newInt = { a: inX(1), b: inX(3) };
  if (key === 'int') {
    if (!an.int) an.int = newInt;
    else if (!an.int.between && shown >= 2) an.int = { ...an.int, between: true };
    else delete an.int;
  } else if (key === 'sum') {
    const n = an.int?.n;
    const next = !n ? 4 : n >= 32 ? undefined : n * 2;
    an.int = { ...(an.int ?? newInt), n: next };
  } else if (key === 'lim') {
    if (an.lim) delete an.lim;
    else an.lim = { x0: inX(0), x: inX(1.5) };
  } else if (key === 'tan') {
    if (!an.tan) an.tan = { x: inX(1) };
    else if (!an.tan.h) an.tan = { ...an.tan, h: 1 };
    else delete an.tan;
  } else if (key === 'asym') an.asym = !an.asym;
  board.updateAxes({ an });
}
$('labelMenu').addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  let label = t.closest<HTMLElement>('[data-label]')?.dataset.label;
  if (t.closest('#labelOther')) label = prompt('Όνομα άξονα:')?.trim().slice(0, 12) || undefined;
  closePopups();
  if (label) board.setAxisLabel(labelAxis, label);
});

const fnInput = $('fnInput') as HTMLInputElement;
const FN_KEYS = [
  '7', '8', '9', '÷', 'x', 'x²', '^', '√',
  '4', '5', '6', '×', '(', ')', '|', 'π',
  '1', '2', '3', '−', 'ημ(', 'συν(', 'εφ(', 'ln(',
  '0', ',', '+', 'e', 'a', 'b', '⌫', 'C',
  'σφ(', 'log(', 'c', 'k', 'λ', 'ω', '←', '→',
];
const FN_INSERT: Record<string, string> = { 'x²': '²', '÷': '/', '×': '·', '−': '-' };
$('fnKeys').innerHTML = FN_KEYS.map((k) => `<button data-key="${k}"${/^[0-9,]$/.test(k) ? ' class="num"' : ''}>${k}</button>`).join('');
const esc = (t: string): string => t.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
/** Ποια συνάρτηση της λίστας διορθώνεται (null = γράφεται καινούργια). */
let fnEdit: number | null = null;
/** Ο χρήστης έσυρε το πλαίσιο: δεν το ξανατοποθετούμε μόνοι μας. */
let fnMoved = false;
let fnParamKey = '';

function nextFnColor(): string {
  const pal = [...inkPalette(), '#ea580c', '#7c3aed'];
  return pal[1 + ((board.selectedAxes?.fns?.length ?? 0) % (pal.length - 1))];
}
/** Βάζει το πλαίσιο δίπλα στους άξονες, ώστε η καμπύλη να φαίνεται όσο γράφεις. */
function placeFnMenu(): void {
  const ax = board.selectedAxes;
  if (fnMoved || !ax || fnMenu.classList.contains('hidden')) return;
  const b = itemBounds(ax);
  const [l, t] = board.toScreen(b.x0, b.y0);
  const [r, bt] = board.toScreen(b.x1, b.y1);
  const w = fnMenu.offsetWidth, h = fnMenu.offsetHeight;
  const roomR = window.innerWidth - r, roomL = l;
  fnMenu.style.left = (roomR >= roomL ? Math.min(r + 12, window.innerWidth - w - 8) : Math.max(8, l - w - 12)) + 'px';
  fnMenu.style.top = Math.max(8, Math.min((t + bt) / 2 - h / 2, window.innerHeight - h - 8)) + 'px';
}
function renderFnParams(): void {
  const ax = board.selectedAxes;
  const exprs = [...(ax?.fns ?? []).map((f) => f.expr), fnInput.value];
  const names = [...new Set(exprs.flatMap(paramsOf))];
  const val = (n: string): number => board.paramPreview?.[n] ?? ax?.params?.[n] ?? 1;
  const box = $('fnParams');
  if (names.join() !== fnParamKey) {
    fnParamKey = names.join();
    box.innerHTML = names
      .map((n) => `<label class="fnPar"><b>${esc(n)} = <output></output></b><input type="range" min="-5" max="5" step="0.1" data-par="${esc(n)}" /></label>`)
      .join('');
  }
  box.querySelectorAll<HTMLInputElement>('[data-par]').forEach((sl) => {
    const v = val(sl.dataset.par!);
    sl.value = String(v);
    sl.parentElement!.querySelector('output')!.textContent = String(+v.toFixed(1));
  });
}
function renderFns(): void {
  const ax = board.selectedAxes;
  const fns = ax?.fns ?? [];
  $('fnList').innerHTML = fns
    .map(
      (f, i) =>
        `<div class="fnItem${f.hidden ? ' off' : ''}${i === fnEdit ? ' ed' : ''}"><button data-fnvis="${i}" class="vis" style="--c:${f.color}" title="Εμφάνιση / απόκρυψη"></button>` +
        `<span data-fnedit="${i}" title="Πάτα για διόρθωση">${esc(f.expr)}</span><button data-fndel="${i}" title="Αφαίρεση">✕</button></div>`,
    )
    .join('');
  $('fnPts').classList.toggle('on', !!ax?.points);
  renderFnParams();
  if (!fnInput.value) $('fnErr').textContent = fns.length ? '' : 'Γράψε π.χ. x²-3x+2, ημ(x), 1/x, ή με παραμέτρους: ax²+b';
  placeFnMenu();
}
/** Σχεδιάζει ζωντανά αυτό που γράφεται, χωρίς να το αποθηκεύει. */
function previewFn(): void {
  const expr = fnInput.value.trim();
  if (!expr) {
    board.fnPreview = null;
    $('fnErr').textContent = '';
  } else {
    try {
      compile(expr);
      board.fnPreview = { index: fnEdit, expr, color: nextFnColor() };
      $('fnErr').textContent = '';
    } catch (err) {
      // κρατάμε την τελευταία έγκυρη μορφή στην οθόνη
      $('fnErr').textContent = `… ${(err as Error).message}`;
    }
  }
  renderFnParams();
  board.redraw();
}
function resetFnDraft(): void {
  const dirty = !!board.fnPreview || !!board.paramPreview;
  board.fnPreview = null;
  board.paramPreview = null;
  fnEdit = null;
  fnInput.value = '';
  if (dirty) board.redraw();
}
function addFn(): void {
  const ax = board.selectedAxes;
  const expr = fnInput.value.trim();
  if (!ax || !expr) return;
  try {
    compile(expr);
  } catch (err) {
    $('fnErr').textContent = `Δεν το κατάλαβα: ${(err as Error).message}`;
    return;
  }
  const fns = ax.fns ?? [];
  const next = fnEdit === null ? [...fns, { expr, color: nextFnColor() }] : fns.map((f, i) => (i === fnEdit ? { ...f, expr } : f));
  const params = { ...ax.params, ...board.paramPreview };
  for (const n of paramsOf(expr)) params[n] ??= 1;
  board.fnPreview = null;
  board.paramPreview = null;
  fnEdit = null;
  fnInput.value = '';
  board.updateAxes({ fns: next, params });
  renderFns();
}
$('fnAdd').onclick = addFn;
$('spMarks').onclick = () => board.updateSpring({ marks: !board.selectedSpring?.marks });
$('spDamp').onclick = () => board.updateSpring({ damp: !board.selectedSpring?.damp });
$('spStop').onclick = () => board.stopSpring();
fnInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addFn();
});
fnInput.addEventListener('input', previewFn);
$('fnKeys').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-key]');
  if (!b) return;
  const key = b.dataset.key!;
  const from = fnInput.selectionStart ?? fnInput.value.length;
  const to = fnInput.selectionEnd ?? from;
  let at = from;
  if (key === 'C') {
    fnInput.value = '';
    at = 0;
  } else if (key === '←' || key === '→') {
    at = Math.max(0, Math.min(fnInput.value.length, (key === '←' ? from : to) + (key === '←' ? -1 : 1)));
  } else if (key === '⌫') {
    const cut = from === to ? Math.max(0, from - 1) : from;
    fnInput.value = fnInput.value.slice(0, cut) + fnInput.value.slice(to);
    at = cut;
  } else {
    const k = FN_INSERT[key] ?? key;
    fnInput.value = fnInput.value.slice(0, from) + k + fnInput.value.slice(to);
    at = from + k.length;
  }
  fnInput.focus();
  fnInput.setSelectionRange(at, at);
  previewFn();
});
$('fnList').addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const ax = board.selectedAxes;
  if (!ax) return;
  const fns = ax.fns ?? [];
  const idx = (k: string): number | null => {
    const el = t.closest<HTMLElement>(`[data-${k}]`);
    return el ? Number(el.dataset[k]) : null;
  };
  const del = idx('fndel'), vis = idx('fnvis'), ed = idx('fnedit');
  if (del !== null) {
    resetFnDraft();
    board.updateAxes({ fns: fns.filter((_, i) => i !== del) });
  } else if (vis !== null) {
    board.updateAxes({ fns: fns.map((f, i) => (i === vis ? { ...f, hidden: !f.hidden } : f)) });
  } else if (ed !== null) {
    fnEdit = fnEdit === ed ? null : ed;
    fnInput.value = fnEdit === null ? '' : fns[ed].expr;
    fnInput.focus();
    previewFn();
  }
  renderFns();
});
$('fnParams').addEventListener('input', (e) => {
  const sl = e.target as HTMLInputElement;
  if (!sl.dataset.par) return;
  board.paramPreview = { ...board.paramPreview, [sl.dataset.par]: Number(sl.value) };
  sl.parentElement!.querySelector('output')!.textContent = String(+Number(sl.value).toFixed(1));
  board.redraw();
});
$('fnParams').addEventListener('change', () => {
  const ax = board.selectedAxes;
  if (!ax || !board.paramPreview) return;
  const params = { ...ax.params, ...board.paramPreview };
  board.paramPreview = null;
  board.updateAxes({ params });
});
$('fnPts').onclick = () => {
  const ax = board.selectedAxes;
  if (ax) board.updateAxes({ points: !ax.points });
  renderFns();
};
$('fnClose').onclick = () => closePopups();
{
  // το πλαίσιο σέρνεται από την κεφαλίδα του
  const head = $('fnHead');
  let off: { x: number; y: number } | null = null;
  head.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const r = fnMenu.getBoundingClientRect();
    off = { x: e.clientX - r.left, y: e.clientY - r.top };
    head.setPointerCapture(e.pointerId);
  });
  head.addEventListener('pointermove', (e) => {
    if (!off) return;
    fnMoved = true;
    fnMenu.style.left = Math.max(0, Math.min(e.clientX - off.x, window.innerWidth - 80)) + 'px';
    fnMenu.style.top = Math.max(0, Math.min(e.clientY - off.y, window.innerHeight - 50)) + 'px';
  });
  const end = (): void => { off = null; };
  head.addEventListener('pointerup', end);
  head.addEventListener('pointercancel', end);
}

// ---------- αλλαγή μέτρησης πλευράς ----------

const measMenu = $('measMenu');
const measInput = $('measInput') as HTMLInputElement;
const MEAS_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', ',', '⌫', 'α', 'β', 'γ', 'x', 'm', 'cm', 'θ', 'φ', 'ω', '°', 'Α', 'Β'];
$('measKeys').innerHTML = MEAS_KEYS.map((k) => `<button data-key="${k}"${/^[0-9,]$/.test(k) ? ' class="num"' : ''}>${k}</button>`).join('');
let measTarget: { id: string; side: number } | null = null;
const measOpts = $('measOpts');
/** Το σχήμα του οποίου οι επιλογές μετρήσεων είναι ανοιχτές. */
let measShape: string | null = null;
function renderMeasOpts(): void {
  const sh = board.page.items.find((x) => x.id === measShape);
  if (!sh || (sh.kind !== 'shape' && sh.kind !== 'angle')) {
    measOpts.classList.add('hidden');
    return;
  }
  // ευθεία, βέλος και γωνία έχουν μόνο μήκη
  const line = sh.kind === 'angle' || sh.shape === 'line' || sh.shape === 'arrow';
  const avail: Record<string, boolean> = { len: true, ang: sh.kind === 'shape' && (sh.shape === 'rect' || isPoly(sh.shape)), area: !line, per: !line };
  measOpts.querySelectorAll<HTMLButtonElement>('[data-meas]').forEach((b) => {
    const k = b.dataset.meas as keyof MeasOpts;
    b.classList.toggle('on', !!sh.meas?.[k]);
    b.classList.toggle('hidden', !avail[k]);
  });
}
measOpts.addEventListener('click', (e) => {
  const k = (e.target as HTMLElement).closest<HTMLElement>('[data-meas]')?.dataset.meas as keyof MeasOpts | undefined;
  const sh = board.page.items.find((x) => x.id === measShape);
  if (!k || !sh || (sh.kind !== 'shape' && sh.kind !== 'angle')) return;
  board.setMeas(sh.id, { ...sh.meas, [k]: !sh.meas?.[k] });
  renderMeasOpts();
});
/** Μόλις άνοιξε: το πρώτο πλήκτρο αντικαθιστά την παλιά τιμή (χωρίς να ανοίγει το πληκτρολόγιο της συσκευής). */
let measFresh = false;
measInput.addEventListener('pointerdown', () => { measFresh = false; });
// με την Επιλογή, πάτημα πάνω σε μια μέτρηση ανοίγει την αλλαγή της (πριν το δει ο πίνακας)
document.addEventListener(
  'pointerdown',
  (e) => {
    if (e.target !== $('live') || (board.tool !== 'select' && board.tool !== 'measure')) return;
    const hit = board.measureAt(e.clientX, e.clientY);
    if (!hit) {
      // με το εργαλείο «Μετρήσεις», πάτημα σε σχήμα ανοίγει από πάνω του τις επιλογές
      const sh = board.tool === 'measure' ? board.shapeAt(e.clientX, e.clientY) : null;
      if (!sh) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      closePopups();
      measShape = sh.id;
      // πρώτο πάτημα σε σχήμα χωρίς μετρήσεις: ξεκινά με τα μήκη
      if (!sh.meas.len && !sh.meas.ang && !sh.meas.area && !sh.meas.per) board.setMeas(sh.id, { len: true });
      renderMeasOpts();
      measOpts.classList.remove('hidden');
      const w = measOpts.offsetWidth, h = measOpts.offsetHeight;
      measOpts.style.left = Math.max(8, Math.min(sh.x - w / 2, window.innerWidth - w - 8)) + 'px';
      measOpts.style.top = Math.max(8, sh.y - h - 34) + 'px';
      return;
    }
    e.stopImmediatePropagation();
    e.preventDefault();
    closePopups();
    measTarget = { id: hit.id, side: hit.side };
    measInput.value = hit.text;
    measMenu.classList.remove('hidden');
    const w = measMenu.offsetWidth, h = measMenu.offsetHeight;
    measMenu.style.left = Math.max(8, Math.min(hit.x - w / 2, window.innerWidth - w - 8)) + 'px';
    measMenu.style.top = (hit.y + 30 + h < window.innerHeight ? hit.y + 30 : Math.max(8, hit.y - h - 30)) + 'px';
    measFresh = true;
  },
  true,
);
function applyMeasure(): void {
  if (measTarget) board.setMeasure(measTarget.id, measTarget.side, measInput.value);
  measTarget = null;
  closePopups();
}
$('measOk').onclick = applyMeasure;
measInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') applyMeasure();
});
$('measKeys').addEventListener('click', (e) => {
  const key = (e.target as HTMLElement).closest<HTMLElement>('[data-key]')?.dataset.key;
  if (!key) return;
  if (measFresh) measInput.value = '';
  measFresh = false;
  const from = document.activeElement === measInput ? measInput.selectionStart ?? measInput.value.length : measInput.value.length;
  const to = document.activeElement === measInput ? measInput.selectionEnd ?? from : from;
  const cut = key === '⌫' ? (from === to ? Math.max(0, from - 1) : from) : from;
  const ins = key === '⌫' ? '' : key === 'm' || key === 'cm' ? ` ${key}` : key;
  measInput.value = measInput.value.slice(0, cut) + ins + measInput.value.slice(to);
});

// ---------- αναγνώριση γραφής ----------

const ai = loadAi();
const aiMenu = $('aiMenu');
const aiKey = $('aiKey') as HTMLInputElement;
const aiModel = $('aiModel') as HTMLInputElement;
const AI_HINT: Record<Provider, string> = {
  gemini: 'Δωρεάν κλειδί από το Google AI Studio (aistudio.google.com), με ημερήσιο όριο. Στη δωρεάν βαθμίδα η Google χρησιμοποιεί ό,τι στέλνεις για να βελτιώνει τα προϊόντα της.',
  claude: 'Κλειδί από το console.anthropic.com. Χρεώνεται ανά χρήση.',
};
function renderAi(): void {
  document.querySelectorAll<HTMLElement>('[data-prov]').forEach((b) => b.classList.toggle('on', b.dataset.prov === ai.provider));
  $('aiModels').innerHTML = MODELS[ai.provider].map((m) => `<option value="${m}"></option>`).join('');
  aiModel.value = ai.models[ai.provider];
  aiKey.value = '';
  aiKey.placeholder = ai.keys[ai.provider] ? '•••••••• (αποθηκευμένο σε αυτή τη συσκευή)' : 'επικόλλησε εδώ το κλειδί σου';
  $('aiHint').textContent = `${AI_HINT[ai.provider]} Το κλειδί μένει μόνο σε αυτή τη συσκευή. Η εικόνα όσων αναγνωρίζεις στέλνεται στην υπηρεσία.`;
}
function openAi(): void {
  closePopups();
  renderAi();
  aiMenu.classList.remove('hidden');
}
aiMenu.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const prov = t.closest<HTMLElement>('[data-prov]')?.dataset.prov as Provider | undefined;
  if (prov) {
    ai.provider = prov;
    saveAi(ai);
    renderAi();
  } else if (t.closest('#aiSave')) {
    if (aiKey.value.trim()) ai.keys[ai.provider] = aiKey.value.trim();
    if (aiModel.value.trim()) ai.models[ai.provider] = aiModel.value.trim();
    saveAi(ai);
    closePopups();
    toast(ai.keys[ai.provider] ? 'Οι ρυθμίσεις αποθηκεύτηκαν' : 'Αποθηκεύτηκαν, αλλά λείπει το κλειδί');
  } else if (t.closest('#aiForget')) {
    ai.keys[ai.provider] = '';
    saveAi(ai);
    renderAi();
    toast('Το κλειδί διαγράφηκε από αυτή τη συσκευή');
  }
});

const AI_NOTE_COLORS = { ok: ['#059669', '#34d399'], bad: ['#dc2626', '#f87171'], info: ['#2563eb', '#7dd3fc'] };
/**
 * Γράφει την απάντηση του AI κάτω από την περιοχή: σε μέγεθος που διαβάζεται στο τρέχον zoom
 * και σπασμένη σε γραμμές, ώστε να μην απλώνεται έξω από την οθόνη.
 */
function aiNote(box: { x0: number; y0: number; x1: number; y1: number }, text: string, tone: keyof typeof AI_NOTE_COLORS): void {
  const k = board.page.view.k;
  const size = Math.max(22, Math.min(160, 26 / k));
  const maxW = Math.min(Math.max(box.x1 - box.x0, 560 / k), (window.innerWidth - 60) / k);
  board.addItem({ kind: 'text', id: uid(), x: box.x0, y: box.y1 + 20 / k, text: wrapText(text, size, maxW), size, color: AI_NOTE_COLORS[tone][isDark(board.doc.bg) ? 1 : 0] });
}

let aiBusy = 0;
/** Στέλνει τα στοιχεία για αναγνώριση και τα αντικαθιστά με κείμενο ή τυπωμένο τύπο. */
async function runRecognition(ids: string[], kind: AiTask): Promise<void> {
  if (!ai.keys[ai.provider]) {
    openAi();
    toast('Βάλε πρώτα το κλειδί της υπηρεσίας');
    return;
  }
  const page = board.cur;
  // λύση και έλεγχος βλέπουν ό,τι υπάρχει στην κυκλωμένη περιοχή (και κομμάτι εικόνας από Word ή PDF)· η αναγνώριση μόνο τα επιλεγμένα χειρόγραφα
  const img = (kind === 'solve' || kind === 'check') && board.hasRegion ? await board.regionImage() : await board.inkImage(ids);
  if (!img) return;
  aiBusy++;
  toast(kind === 'solve' ? '✨ Λύνεται…' : kind === 'check' ? '✨ Ελέγχεται…' : '✨ Αναγνώριση…', 0);
  try {
    const out = await recognize(img.blob, kind, ai);
    if (!out) {
      toast(kind === 'solve' ? 'Δεν βρήκα κάτι να λύσω' : kind === 'check' ? 'Δεν βρήκα λύση να ελέγξω' : 'Δεν μπόρεσα να το διαβάσω');
      return;
    }
    if (board.cur !== page) {
      toast(kind === 'solve' ? 'Άλλαξες σελίδα· η λύση δεν μπήκε' : kind === 'check' ? 'Άλλαξες σελίδα· ο έλεγχος δεν μπήκε' : 'Άλλαξες σελίδα· η αναγνώριση δεν εφαρμόστηκε');
      return;
    }
    const { box, color } = img;
    const bh = box.y1 - box.y0;
    if (kind === 'check') {
      // η κρίση μπαίνει κάτω από τη λύση του μαθητή: πράσινη αν είναι σωστή, κόκκινη αν έχει λάθος
      const ok = out.startsWith('✓');
      aiNote(box, out, ok ? 'ok' : 'bad');
      toast(ok ? 'Δεν βρέθηκε λάθος. Ρίξε κι εσύ μια ματιά.' : 'Βρέθηκε πιθανό λάθος. Έλεγξέ το πριν το πεις στον μαθητή.', 5000);
      return;
    }
    if (kind === 'solve') {
      if (/^TEXT\b/.test(out)) {
        // ερώτηση θεωρίας ή πολλαπλής επιλογής: η απάντηση είναι σκέτο κείμενο
        aiNote(box, out.replace(/^TEXT\s*/, ''), 'info');
        toast('Η απάντηση μπήκε κάτω από την ερώτηση. Έλεγξέ την πριν τη δείξεις.', 5000);
        return;
      }
      // η λύση μπαίνει κάτω από την άσκηση, χωρίς να πειράξει το χειρόγραφο
      const lines = out.split('\\\\').length;
      // το μέγεθος ακολουθεί το zoom, για να διαβάζεται και σε σμικρυμένη σελίδα
      const zk = board.page.view.k;
      const pic = await texToImage(out, board.ink(color), Math.max(26, Math.min(160, Math.max(Math.min(bh * 0.4, 60), 30 / zk))));
      board.addItem({ kind: 'image', id: uid(), x: box.x0, y: box.y1 + 20 / zk, w: pic.w, h: pic.h, src: pic.src });
      toast(lines > 1 ? 'Η λύση μπήκε κάτω από την άσκηση. Έλεγξέ την πριν τη δείξεις.' : 'Η απάντηση μπήκε κάτω από την άσκηση. Έλεγξέ την.', 5000);
      return;
    }
    if (kind === 'text') {
      const lines = out.split('\n').length;
      const size = Math.max(22, Math.min(96, (bh / lines) * 0.75));
      board.replaceItems(ids, { kind: 'text', id: uid(), x: box.x0, y: box.y0, text: out, size, color });
    } else {
      let pic = await texToImage(out, board.ink(color), Math.max(24, Math.min(90, bh * 0.45)));
      // ο τύπος να μην βγει πολύ ψηλότερος από το χειρόγραφο
      const f = Math.min(1, (Math.max(bh, 50) * 1.15) / pic.h);
      pic = { ...pic, w: pic.w * f, h: pic.h * f };
      board.replaceItems(ids, { kind: 'image', id: uid(), x: box.x0, y: box.y0 + (bh - pic.h) / 2, w: pic.w, h: pic.h, src: pic.src });
    }
    $('toast').classList.add('hidden');
  } catch (err) {
    toast(`${kind === 'solve' ? 'Η λύση' : kind === 'check' ? 'Ο έλεγχος' : 'Η αναγνώριση'} απέτυχε: ${(err as Error).message}`, 6000);
  } finally {
    aiBusy--;
  }
}
$('selOpts').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-rec]');
  if (b) void runRecognition(board.selectionIds, b.dataset.rec as AiTask);
});

// αυτόματη αναγνώριση: ό,τι γράφεται στέλνεται μόλις η γραφίδα μείνει σηκωμένη για λίγο
let autoKind: RecKind | null = null;
let autoBatch: string[] = [];
let autoTimer = 0;
const AUTO_IDLE_MS = 1600;
function autoFlush(): void {
  clearTimeout(autoTimer);
  const ids = autoBatch;
  autoBatch = [];
  if (autoKind && ids.length) void runRecognition(ids, autoKind);
}
board.onStroke = (s) => {
  if (!autoKind) return;
  autoBatch.push(s.id);
  clearTimeout(autoTimer);
  autoTimer = window.setTimeout(autoFlush, AUTO_IDLE_MS);
};
$('live').addEventListener('pointerdown', () => clearTimeout(autoTimer));
const autoRearm = (): void => {
  if (!autoKind || autoBatch.length === 0) return;
  clearTimeout(autoTimer);
  autoTimer = window.setTimeout(autoFlush, AUTO_IDLE_MS);
};
$('live').addEventListener('pointerup', autoRearm);
$('live').addEventListener('pointercancel', autoRearm);
$('penKinds').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-auto]');
  if (!b) return;
  const k = b.dataset.auto as RecKind;
  if (autoKind === k) {
    autoKind = null;
  } else if (!ai.keys[ai.provider]) {
    openAi();
    toast('Βάλε πρώτα το κλειδί της υπηρεσίας');
    return;
  } else {
    autoKind = k;
    if (board.tool !== 'pen') board.setTool('pen');
    toast(k === 'text' ? 'Αυτόματη αναγνώριση κειμένου: γράψε και σταμάτα για λίγο' : 'Αυτόματη αναγνώριση τύπων: γράψε και σταμάτα για λίγο', 4000);
  }
  clearTimeout(autoTimer);
  autoBatch = [];
  refreshUi();
});

// ---------- κατάσταση κουμπιών ----------

function refreshUi(): void {
  const tool = board.tool;
  // μπαίνοντας στο υπογραμμιστικό (ή βγαίνοντας) αλλάζει και το χρώμα που κρατάς
  if ((tool === 'highlighter') !== wasHl) {
    wasHl = tool === 'highlighter';
    if (wasHl) {
      inkColor = board.color;
      board.color = hlColor;
    } else {
      hlColor = board.color;
      board.color = inkColor ?? inkPalette()[0];
    }
  }
  if (isPenKind(tool)) penKind = tool;
  const show = (id: string, on: boolean): void => { $(id).classList.toggle('hidden', !on); };
  document.querySelectorAll<HTMLElement>('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === tool));
  $('penBtn').classList.toggle('on', isPenKind(tool));
  $('gadgetBtn').classList.toggle('on', tool === 'shape');
  $('penBtn').querySelector('span')!.innerHTML = PEN_ICON[penKind];
  document.querySelectorAll<HTMLElement>('[data-pen]').forEach((b) => b.classList.toggle('on', b.dataset.pen === tool));
  document.querySelectorAll<HTMLElement>('[data-auto]').forEach((b) => b.classList.toggle('on', b.dataset.auto === autoKind));
  renderColors();
  document.querySelectorAll<HTMLElement>('[data-color]').forEach((b) => b.classList.toggle('on', b.dataset.color === board.color));
  const st = sizedTool();
  document.querySelectorAll<HTMLElement>('[data-width]').forEach((b) => b.classList.toggle('on', SIZES[st][Number(b.dataset.width)] === board.sizes[st]));
  document.querySelectorAll<HTMLElement>('[data-eraser]').forEach((b) => b.classList.toggle('on', b.dataset.eraser === board.eraserMode));
  document.querySelectorAll<HTMLElement>('[data-shape]').forEach((b) => b.classList.toggle('on', tool === 'shape' && b.dataset.shape === board.shapeKind));

  // η δεύτερη σειρά δείχνει μόνο ό,τι αφορά το εργαλείο που κρατάς
  const ax = tool === 'select' ? board.selectedAxes : null;
  show('penKinds', isPenKind(tool));
  show('shapes', tool === 'shape');
  show('eraserOpts', tool === 'eraser');
  const region = tool === 'select' && board.hasRegion;
  show('selOpts', tool === 'select' && (board.hasSelection || region));
  show('del', board.hasSelection);
  show('dup', board.hasSelection);
  // η αναγνώριση έχει νόημα μόνο όταν στην επιλογή υπάρχει χειρόγραφο
  const ink = board.selectionHasInk;
  const writing = board.selectionHasWriting;
  document.querySelectorAll<HTMLElement>('#selOpts .rec').forEach((b) => b.classList.toggle('hidden', b.dataset.rec === 'solve' || b.dataset.rec === 'check' ? !(writing || region) : !ink));
  $('selOpts').querySelector('.recSep')!.classList.toggle('hidden', !(writing || region) || !board.hasSelection);
  show('sumBtn', !!board.resultantSource);
  show('axesOpts', !!ax);
  const sp = tool === 'select' ? board.selectedSpring : null;
  show('springOpts', !!sp);
  $('spMarks').classList.toggle('on', !!sp?.marks);
  $('spDamp').classList.toggle('on', !!sp?.damp);
  ($('spStop') as HTMLButtonElement).disabled = !board.springMoving;
  show('widths', tool === 'pen' || tool === 'highlighter' || tool === 'shape' || tool === 'text' || tool === 'eraser');
  show('subbar', [...$('subbar').children].some((g) => !g.classList.contains('hidden')));
  const anOn: Record<string, boolean> = { int: !!ax?.an?.int, sum: !!ax?.an?.int?.n, lim: !!ax?.an?.lim, tan: !!ax?.an?.tan, asym: !!ax?.an?.asym };
  document.querySelectorAll<HTMLElement>('[data-an]').forEach((b) => b.classList.toggle('on', anOn[b.dataset.an!]));
  $('axesOpts').querySelector('[data-an=sum] span')!.textContent = ax?.an?.int?.n ? `Σ${ax.an.int.n}` : 'Σ';
  $('axesOpts').querySelector('[data-axis=x] span')!.textContent = ax?.lx ?? 'x';
  $('axesOpts').querySelector('[data-axis=y] span')!.textContent = ax?.ly ?? 'y';
  if (!ax && !fnMenu.classList.contains('hidden')) {
    fnMenu.classList.add('hidden');
    resetFnDraft();
  } else if (ax && !fnMenu.classList.contains('hidden')) renderFns();

  ($('undo') as HTMLButtonElement).disabled = !board.canUndo;
  ($('redo') as HTMLButtonElement).disabled = !board.canRedo;
  ($('prev') as HTMLButtonElement).disabled = board.cur === 0;
  ($('next') as HTMLButtonElement).disabled = board.cur >= board.doc.pages.length - 1;
  $('pageLabel').textContent = `${board.cur + 1} / ${board.doc.pages.length}`;
  document.querySelectorAll<HTMLElement>('[data-gadget]').forEach((b) => {
    const g = b.dataset.gadget!;
    b.classList.toggle('on', g === 'timer' ? timer.visible : board.gadgets.has(g as GadgetKind));
  });
  const viewOn: Record<string, boolean> = { curtain: curtain.visible, curtainTop: curtainTop.visible, spot: spot.visible, replay: board.replaying };
  document.querySelectorAll<HTMLElement>('[data-view]').forEach((b) => b.classList.toggle('on', viewOn[b.dataset.view!]));
  document.querySelectorAll<HTMLElement>('.bgSw').forEach((b) => b.classList.toggle('on', b.dataset.act === `bg-${board.doc.bg}`));
  document.body.classList.toggle('dark', isDark(board.doc.bg));
  show('replayBar', board.replaying);
  $('replayBar').querySelector('[data-rp=pause]')!.textContent = board.replayPaused ? '▶' : '⏸';
  document.body.dataset.bg = board.doc.bg;
  layoutBar();
  placeSelBar();
}
/** Η μπάρα ενεργειών στέκεται κάτω από την επιλογή· αν δεν χωρά εκεί, από πάνω της. */
function placeSelBar(): void {
  const el = $('selOpts');
  if (el.classList.contains('hidden')) return;
  const b = board.selectionScreenBox();
  if (!b) return;
  const w = el.offsetWidth, h = el.offsetHeight;
  const W = window.innerWidth, H = window.innerHeight;
  const x = Math.max(8, Math.min((b.x0 + b.x1) / 2 - w / 2, W - w - 8));
  const bar = $('toolbar').getBoundingClientRect();
  const clear = (y: number): boolean => y >= 64 && y + h <= H - 8 && !(x < bar.right + 8 && x + w > bar.left - 8 && y < bar.bottom + 8 && y + h > bar.top - 70);
  // κάτω από το πλαίσιο (μετά τη λαβή μεγέθους), αλλιώς πάνω από τη λαβή περιστροφής, αλλιώς στην κορυφή της οθόνης
  const y = [b.y1 + 34, b.y0 - h - 64].find(clear) ?? 70;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}
board.onUi = refreshUi;
curtain.onChange = curtainTop.onChange = refreshUi;
curtain.ink = curtainTop.ink = () => ({ tool: board.tool, color: board.color, width: board.width, eraser: board.sizes.eraser });
spot.onChange = refreshUi;

$('replayBar').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-rp]');
  if (!b) return;
  if (b.dataset.rp === 'pause') board.toggleReplayPause();
  else if (b.dataset.rp === 'step') board.replayStep();
  else board.stopReplay();
});

// ---------- θέση, μέγεθος και σύμπτυξη της γραμμής εργαλείων ----------

interface BarState {
  scale: number;
  folded: boolean;
  /** Θέση πάνω-αριστερά όταν ο χρήστης την έχει μετακινήσει· αλλιώς κάτω στο κέντρο. */
  pos: { x: number; y: number } | null;
  /** Κάθετη διάταξη, όταν έχει αφεθεί στην αριστερή ή δεξιά άκρη. */
  vertical: boolean;
}

function initToolbar(): void {
  const wrap = $('toolbarWrap');
  const bar = $('toolbar');
  const tab = $('barTab');
  const hint = $('dockHint');
  const KEY = 'grafida.toolbar';
  const st: BarState = { scale: 1, folded: false, pos: null, vertical: false };
  try {
    Object.assign(st, JSON.parse(localStorage.getItem(KEY) ?? '{}'));
  } catch {
    /* χωρίς αποθηκευμένες ρυθμίσεις */
  }

  // τα κείμενα των κουμπιών γίνονται tooltips· στη γραμμή φαίνονται μόνο τα εικονίδια
  bar.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
    const label = [...b.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('').trim();
    if (label) {
      b.title = label;
      b.setAttribute('aria-label', label);
    }
  });

  const apply = (): void => {
    bar.style.setProperty('--ts', String(st.scale));
    bar.classList.toggle('folded', st.folded);
    $('barFold').querySelector('span')!.textContent = st.folded ? '▸' : '▾';
    wrap.classList.toggle('moved', !!st.pos);
    bar.classList.toggle('vertical', !!st.pos && st.vertical);
    if (st.pos) {
      // κρατάμε τη γραμμή (και τη λαβή πάνω της) μέσα στην οθόνη
      const r = bar.getBoundingClientRect();
      const th = tab.getBoundingClientRect().height;
      st.pos.x = Math.max(0, Math.min(st.pos.x, window.innerWidth - r.width));
      // πάνω αριστερά βρίσκεται το κουμπί του μενού: δεν το σκεπάζουμε
      const minY = (st.pos.x < 80 && r.height < window.innerHeight - 120 ? 78 : 0) + th;
      st.pos.y = Math.max(minY, Math.min(st.pos.y, window.innerHeight - r.height));
      wrap.style.left = st.pos.x + 'px';
      wrap.style.top = st.pos.y + 'px';
    } else {
      wrap.style.left = '';
      wrap.style.top = '';
    }
    // η δεύτερη σειρά ανοίγει προς την πλευρά που έχει χώρο
    const r = bar.getBoundingClientRect();
    bar.classList.toggle('sub-below', r.top < 70 * st.scale + 30);
    bar.classList.toggle('sub-right', r.left + r.width / 2 < window.innerWidth / 2);
    // ...και στέκεται πάνω από (ή δίπλα σε) το εργαλείο που αφορά
    const sub = $('subbar');
    const anchor = bar.querySelector<HTMLElement>('#tools button.on, #gadgetBtn.on');
    sub.style.left = sub.style.right = sub.style.top = '';
    bar.classList.remove('sub-lift');
    if (anchor && !sub.classList.contains('hidden') && !st.folded) {
      const k = r.width / bar.offsetWidth || 1;
      const a = anchor.getBoundingClientRect();
      const s = sub.getBoundingClientRect();
      if (bar.classList.contains('vertical')) {
        const first = sub.querySelector<HTMLElement>('.group:not(.hidden) button');
        const pad = first ? first.getBoundingClientRect().top - s.top : 0;
        const top = Math.max(8, Math.min(a.top - pad, window.innerHeight - s.height - 8));
        sub.style.setProperty('--caret', (a.top + a.height / 2 - top) / k + 'px');
        sub.style.top = (top - r.top) / k + 'px';
      } else {
        // το πρώτο εικονίδιο της σειράς κάθεται ακριβώς πάνω από το εργαλείο
        const first = sub.querySelector<HTMLElement>('.group:not(.hidden) button');
        const pad = first ? first.getBoundingClientRect().left - s.left : 0;
        const left = Math.max(8, Math.min(a.left - pad, window.innerWidth - s.width - 8));
        sub.style.setProperty('--caret', (a.left + a.width / 2 - left) / k + 'px');
        sub.style.left = (left - r.left) / k + 'px';
        sub.style.right = 'auto';
        // αν πέφτει πάνω στη λαβή της γραμμής, ανεβαίνει πάνω από αυτήν
        const t = tab.getBoundingClientRect();
        bar.classList.toggle('sub-lift', !bar.classList.contains('sub-below') && left + s.width > t.left - 4 && left < t.right + 4);
      }
    }
    board.bottomInset = st.pos ? 0 : r.height + 24 + 56 * st.scale;
  };
  const save = (): void => {
    try {
      localStorage.setItem(KEY, JSON.stringify(st));
    } catch {
      /* δεν πειράζει */
    }
  };

  $('barSmaller').onclick = () => { st.scale = Math.max(0.6, +(st.scale - 0.15).toFixed(2)); apply(); save(); };
  $('barBigger').onclick = () => { st.scale = Math.min(2, +(st.scale + 0.15).toFixed(2)); apply(); save(); };
  $('barFold').onclick = () => { st.folded = !st.folded; apply(); save(); };

  const grip = $('barDrag');
  const EDGE = 70;
  let off: { x: number; y: number } | null = null;
  let dragged = false;
  /** Σε ποια άκρη θα «κουμπώσει» κατακόρυφα αν αφεθεί τώρα. */
  let dock: 'left' | 'right' | null = null;
  grip.addEventListener('pointerdown', (e) => {
    const r = bar.getBoundingClientRect();
    off = { x: e.clientX - r.left, y: e.clientY - r.top };
    dragged = false;
    dock = null;
    grip.setPointerCapture(e.pointerId);
  });
  grip.addEventListener('pointermove', (e) => {
    if (!off) return;
    dragged = true;
    st.pos = { x: e.clientX - off.x, y: e.clientY - off.y };
    // κουμπώνει όταν το δάχτυλο φτάσει κοντά στην άκρη ή όταν η γραμμή σπρωχτεί πάνω της
    const w = bar.getBoundingClientRect().width;
    if (e.clientX < EDGE || st.pos.x < 6) dock = 'left';
    else if (e.clientX > window.innerWidth - EDGE || st.pos.x + w > window.innerWidth - 6) dock = 'right';
    else dock = null;
    hint.classList.toggle('hidden', !dock);
    hint.classList.toggle('right', dock === 'right');
    apply();
  });
  const end = (): void => {
    if (!off) return;
    off = null;
    hint.classList.add('hidden');
    if (!dragged) return;
    // κοντά στο κάτω-κεντρικό σημείο επιστρέφει στην αρχική της θέση
    const r = bar.getBoundingClientRect();
    const centered = Math.abs(r.left + r.width / 2 - window.innerWidth / 2) < 60;
    st.vertical = !!dock;
    if (!dock && centered && r.bottom > window.innerHeight - 40) st.pos = null;
    if (dock && st.pos) st.pos.x = dock === 'left' ? 0 : window.innerWidth;
    apply();
    // η κατακόρυφη γραμμή έχει άλλο ύψος: ξαναελέγχουμε ότι χωρά
    apply();
    save();
  };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
  grip.addEventListener('lostpointercapture', end);
  grip.addEventListener('dblclick', () => { st.pos = null; st.vertical = false; apply(); save(); });
  window.addEventListener('resize', apply);
  new MutationObserver(apply).observe($('subbar'), { attributes: true, attributeFilter: ['class'] });

  // όσο γράφεις, η γραμμή ξεθωριάζει και δεν εμποδίζει τη γραφίδα
  const inking = new Set<number>();
  const live = $('live');
  live.addEventListener('pointerdown', (e) => { inking.add(e.pointerId); document.body.classList.add('inking'); });
  const lift = (e: PointerEvent): void => {
    inking.delete(e.pointerId);
    if (inking.size === 0) document.body.classList.remove('inking');
  };
  live.addEventListener('pointerup', lift);
  live.addEventListener('pointercancel', lift);

  layoutBar = apply;
  apply();
}

// ---------- αναδυόμενα μενού ----------

const menu = $('menu');
const impMenu = $('importMenu');
const gadgetMenu = $('gadgetMenu');
const colorMenu = $('colorMenu');
const labelMenu = $('labelMenu');
const fnMenu = $('fnMenu');
const stampMenu = $('stampMenu');
const tplMenu = $('tplMenu');
function closePopups(): void {
  document.querySelectorAll('.popup').forEach((p) => p.classList.add('hidden'));
  measShape = null;
  resetFnDraft();
  fnMoved = false;
}
/** Τοποθετεί ένα αναδυόμενο μενού δίπλα στο κουμπί του, μέσα στα όρια της οθόνης. */
function placeNear(popup: HTMLElement, anchor: HTMLElement): void {
  const a = anchor.getBoundingClientRect();
  const w = popup.offsetWidth;
  const h = popup.offsetHeight;
  const bar = $('toolbar');
  if (bar.classList.contains('vertical') && bar.contains(anchor)) {
    // κατακόρυφη γραμμή: το μενού ανοίγει δίπλα στο κουμπί, προς το κέντρο της οθόνης
    const b = (anchor.closest<HTMLElement>('#subbar') ?? bar).getBoundingClientRect();
    const left = b.left + b.width / 2 > window.innerWidth / 2 ? b.left - w - 10 : b.right + 10;
    popup.style.left = Math.max(8, Math.min(left, window.innerWidth - w - 8)) + 'px';
    popup.style.top = Math.max(8, Math.min(a.top + a.height / 2 - h / 2, window.innerHeight - h - 8)) + 'px';
    return;
  }
  const left = Math.max(8, Math.min(a.left + a.width / 2 - w / 2, window.innerWidth - w - 8));
  let top = a.top - h - 10;
  if (top < 8) top = Math.min(a.bottom + 10, window.innerHeight - h - 8);
  popup.style.left = left + 'px';
  popup.style.top = Math.max(8, top) + 'px';
}
function togglePopup(popup: HTMLElement, anchor: HTMLElement): void {
  const open = popup.classList.contains('hidden');
  closePopups();
  if (!open) return;
  popup.classList.remove('hidden');
  placeNear(popup, anchor);
}
// ό,τι χρησιμοποιήθηκε τελευταία από τα Όργανα μένει πρώτο στη λίστα
const RECENT = 'grafida.recent';
const TILE_ATTRS = ['shape', 'axes', 'ins', 'anq', 'gadget', 'view'];
const tileKey = (b: HTMLElement): string => {
  const a = TILE_ATTRS.find((k) => b.dataset[k] !== undefined);
  return a ? `${a}=${b.dataset[a]}` : '';
};
let recent: string[] = (() => { try { return JSON.parse(localStorage.getItem(RECENT) ?? '[]') as string[]; } catch { return []; } })();
function renderRecent(): void {
  const box = $('recentTiles');
  box.innerHTML = '';
  for (const k of recent) {
    const [a, v] = k.split('=');
    const src = gadgetMenu.querySelector<HTMLElement>(`.tiles:not(#recentTiles) [data-${a}="${v}"]`);
    if (src) box.append(src.cloneNode(true));
  }
  const empty = box.children.length === 0;
  box.classList.toggle('hidden', empty);
  $('recentHead').classList.toggle('hidden', empty);
}
gadgetMenu.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('.tile');
  const k = b && tileKey(b);
  if (!k) return;
  recent = [k, ...recent.filter((x) => x !== k)].slice(0, 6);
  try { localStorage.setItem(RECENT, JSON.stringify(recent)); } catch { /* χωρίς αποθήκευση */ }
}, true);
$('gadgetBtn').onclick = () => {
  renderRecent();
  refreshUi();
  togglePopup(gadgetMenu, $('gadgetBtn'));
};
$('importBtn').onclick = () => togglePopup(impMenu, $('importBtn'));
$('menuBtn').onclick = () => {
  const open = menu.classList.contains('hidden');
  closePopups();
  menu.classList.toggle('hidden', !open);
};
document.addEventListener('pointerdown', (e) => {
  if (!(e.target as HTMLElement).closest('.popup, #menuBtn, #importBtn, #gadgetBtn, #colorBtn, #axesOpts')) closePopups();
});

gadgetMenu.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const anq = t.closest<HTMLElement>('[data-anq]')?.dataset.anq;
  if (anq) {
    // τα εργαλεία ανάλυσης δουλεύουν πάνω σε άξονες με συνάρτηση: διαλέγουμε (ή φτιάχνουμε) άξονες και, αν λείπει, ζητάμε συνάρτηση
    closePopups();
    board.setTool('select');
    if (!board.selectedAxes && !board.selectAxes()) board.addAxes('full');
    refreshUi();
    const ax = board.selectedAxes;
    if (ax && (ax.fns ?? []).some((f) => !f.hidden)) {
      const on: Record<string, boolean> = { int: !!ax.an?.int, sum: false, lim: !!ax.an?.lim, tan: !!ax.an?.tan, asym: !!ax.an?.asym };
      if (!on[anq]) toggleAnalysis(anq);
    } else {
      togglePopup(fnMenu, $('fnBtn'));
      renderFns();
      toast('Γράψε πρώτα τη συνάρτηση. Μετά, τα ∫, Σ, lim, f′ είναι στη σειρά πάνω από τη μπάρα.', 6000);
    }
    return;
  }
  const shape = t.closest<HTMLElement>('[data-shape]')?.dataset.shape;
  const ax = t.closest<HTMLElement>('[data-axes]')?.dataset.axes;
  const ins = t.closest<HTMLElement>('[data-ins]')?.dataset.ins;
  if (shape || ax || ins) {
    closePopups();
    if (shape) {
      board.shapeKind = shape as ShapeKind | 'angle';
      board.setTool('shape');
    } else if (ax) board.addAxes(ax as AxesMode);
    else if (ins === 'trig') board.addTrig();
    else if (ins === 'table') openTableMenu();
    else {
      stampMenu.classList.remove('hidden');
      placeNear(stampMenu, $('gadgetBtn'));
    }
    refreshUi();
    return;
  }
  const view = t.closest<HTMLElement>('[data-view]')?.dataset.view;
  if (view) {
    closePopups();
    // η καθεμιά ανοίγει αφήνοντας ορατό ένα κομμάτι του πίνακα, και δίπλα στην άλλη αν είναι ήδη ανοιχτή
    if (view === 'curtain') curtain.toggle(curtainTop.visible ? Math.min(0.9, curtainTop.edge + 0.3) : 0.3);
    else if (view === 'curtainTop') curtainTop.toggle(curtain.visible ? Math.max(0.1, curtain.edge - 0.3) : 0.3);
    else if (view === 'spot') spot.toggle();
    else if (board.replaying) board.stopReplay();
    else if (board.page.items.length === 0) toast('Η σελίδα είναι κενή');
    else board.startReplay();
    refreshUi();
    return;
  }
  const b = t.closest<HTMLElement>('[data-gadget]');
  if (!b) return;
  const g = b.dataset.gadget!;
  if (g === 'timer') timer.toggle();
  else board.toggleGadget(g as GadgetKind);
  refreshUi();
});

impMenu.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const ins = t.closest<HTMLElement>('[data-ins]')?.dataset.ins;
  const b = t.closest<HTMLElement>('[data-imp]');
  if (!ins && !b) return;
  closePopups();
  if (ins === 'tpl') {
    renderTemplates();
    tplMenu.classList.remove('hidden');
    placeNear(tplMenu, $('importBtn'));
  } else if (b!.dataset.imp === 'file') ($('fileImport') as HTMLInputElement).click();
  else if (b!.dataset.imp === 'shot') void doScreenshot();
  else void doPaste();
});
($('fileImport') as HTMLInputElement).onchange = (e) => {
  const input = e.target as HTMLInputElement;
  void importFiles([...(input.files ?? [])]);
  input.value = '';
};
($('fileOpen') as HTMLInputElement).onchange = (e) => {
  const input = e.target as HTMLInputElement;
  void importFiles([...(input.files ?? [])]);
  input.value = '';
};

// ---------- σχήματα φυσικής ----------

for (const [name, d] of Object.entries(STAMPS)) {
  const b = document.createElement('button');
  b.dataset.stamp = name;
  b.title = d.label;
  const cv = document.createElement('canvas');
  cv.width = 144;
  cv.height = 112;
  const c = cv.getContext('2d')!;
  const k = Math.min(128 / d.w, 96 / d.h);
  c.translate((144 - d.w * k) / 2, (112 - d.h * k) / 2);
  c.scale(k, k);
  c.strokeStyle = c.fillStyle = '#f9fafb';
  c.lineWidth = 2.2 / k;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  d.draw(c, d.w, d.h);
  b.append(cv, document.createTextNode(d.label));
  $('stampGrid').append(b);
}
// ---------- πίνακας / ορίζουσα / μήτρα ----------
const tableMenu = $('tableMenu');
const TBL_MAX = 6;
let tblStyle: TableStyle = 'grid';
/** Οι γραμμές και οι στήλες που δείχνει τώρα το πλέγμα επιλογής (κάτω από το δάχτυλο ή η τελευταία επιλογή). */
let tblPick = { r: 3, c: 3 };
$('tblGrid').innerHTML = Array.from({ length: TBL_MAX * TBL_MAX }, (_, i) => `<button data-r="${Math.floor(i / TBL_MAX) + 1}" data-c="${(i % TBL_MAX) + 1}"></button>`).join('');
function paintTableMenu(): void {
  tableMenu.querySelectorAll<HTMLElement>('[data-tbl]').forEach((b) => b.classList.toggle('on', b.dataset.tbl === tblStyle));
  tableMenu.querySelectorAll<HTMLElement>('#tblGrid button').forEach((b) => b.classList.toggle('on', +b.dataset.r! <= tblPick.r && +b.dataset.c! <= tblPick.c));
  $('tblHint').textContent = `Πάτα το κελί που θες: τώρα ${tblPick.r} × ${tblPick.c} (γραμμές × στήλες)`;
}
function openTableMenu(): void {
  paintTableMenu();
  tableMenu.classList.remove('hidden');
  placeNear(tableMenu, $('gadgetBtn'));
}
tableMenu.addEventListener('pointerover', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('#tblGrid button');
  if (!b || e.pointerType !== 'mouse') return;
  tblPick = { r: +b.dataset.r!, c: +b.dataset.c! };
  paintTableMenu();
});
tableMenu.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const st = t.closest<HTMLElement>('[data-tbl]')?.dataset.tbl as TableStyle | undefined;
  if (st) {
    tblStyle = st;
    paintTableMenu();
    return;
  }
  const b = t.closest<HTMLElement>('#tblGrid button');
  if (!b) return;
  tblPick = { r: +b.dataset.r!, c: +b.dataset.c! };
  closePopups();
  board.addTable(tblPick.r, tblPick.c, tblStyle);
  refreshUi();
});

stampMenu.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-stamp]');
  if (!b) return;
  closePopups();
  board.addStamp(b.dataset.stamp!);
});

// ---------- πρότυπα σελίδων ----------

interface Template { name: string; items: Item[] }
const text = (x: number, y: number, t: string, size = 34): Item => ({ kind: 'text', id: '', x, y, text: t, size, color: '#111111' });
const rule = (x0: number, y0: number, x1: number, y1: number): Item =>
  ({ kind: 'shape', id: '', shape: 'line', x0, y0, x1, y1, color: '#111111', width: 2 });
const BUILTIN: Template[] = [
  {
    name: 'Δεδομένα – Ζητούμενα – Λύση',
    items: [text(60, 90, 'Δεδομένα'), rule(60, 140, 420, 140), text(60, 380, 'Ζητούμενα'), rule(60, 430, 420, 430),
      rule(470, 80, 470, 660), text(520, 90, 'Λύση'), rule(520, 140, 1180, 140)],
  },
  {
    name: 'Δύο στήλες',
    items: [rule(640, 80, 640, 660)],
  },
];
let templates: Template[] = [];
void kvGet<Template[]>('templates').then((t) => { templates = t ?? []; });
function renderTemplates(): void {
  $('tplList').innerHTML =
    BUILTIN.map((t, i) => `<div class="tplItem"><button data-tpl="b${i}">📄 ${esc(t.name)}</button></div>`).join('') +
    templates.map((t, i) => `<div class="tplItem"><button data-tpl="u${i}">📄 ${esc(t.name)}</button><button data-tpldel="${i}" title="Διαγραφή προτύπου">✕</button></div>`).join('');
}
tplMenu.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const del = t.closest<HTMLElement>('[data-tpldel]');
  if (del) {
    templates.splice(Number(del.dataset.tpldel), 1);
    void kvSet('templates', templates);
    renderTemplates();
    return;
  }
  if (t.closest('#tplSave')) {
    if (board.page.items.length === 0) {
      toast('Η σελίδα είναι κενή');
      return;
    }
    const name = prompt('Όνομα προτύπου:', `Πρότυπο ${templates.length + 1}`)?.trim();
    if (!name) return;
    templates.push({ name, items: JSON.parse(JSON.stringify(board.page.items)) as Item[] });
    void kvSet('templates', templates);
    renderTemplates();
    toast('Το πρότυπο αποθηκεύτηκε');
    return;
  }
  const b = t.closest<HTMLElement>('[data-tpl]');
  if (!b) return;
  closePopups();
  const id = b.dataset.tpl!;
  const tpl = (id[0] === 'b' ? BUILTIN : templates)[Number(id.slice(1))];
  if (tpl) board.addPageWith(tpl.items);
});

// ---------- κύριο μενού ----------

if (isNative && !isOverlay) $('overlayAct').classList.remove('hidden');
const onMenu = async (e: Event): Promise<void> => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!b) return;
  const act = b.dataset.act!;
  if (!act.startsWith('bg-')) closePopups();
  if (act === 'pdflogo') {
    setPdfLogo(!pdfLogo);
  } else if (act === 'labels') {
    setLabels(!$('toolbar').classList.contains('labels'));
  } else if (act === 'lib') {
    void lessons?.open();
  } else if (act === 'help') {
    openWelcome();
  } else if (act === 'test') {
    window.open('./dokimi.html', '_blank');
  } else if (act === 'open') {
    ($('fileOpen') as HTMLInputElement).click();
  } else if (act === 'save') {
    download(new Blob([JSON.stringify(board.doc)], { type: 'application/json' }), `${fileName(lessons?.current?.name ?? 'pinakas')}_${stamp()}.json`);
  } else if (act === 'png') {
    download(await board.exportPng(), `selida_${board.cur + 1}_${stamp()}.png`);
  } else if (act === 'send') {
    openSend();
  } else if (act === 'pdf') {
    try {
      const pdf = await lessonPdf();
      if (pdf) download(pdf, `${fileName(lessons?.current?.name ?? 'mathima')}_${stamp()}.pdf`);
    } catch (err) {
      console.error(err);
      toast('Η εξαγωγή σε PDF απέτυχε', 5000);
    }
  } else if (act.startsWith('bg-')) {
    // το τρέχον χρώμα περνά στο αντίστοιχο της παλέτας του νέου φόντου
    const i = palette().indexOf(board.color);
    board.setBackground(act.slice(3) as Background);
    if (i >= 0) board.color = palette()[i];
    refreshUi();
  } else if (act === 'fit') {
    board.fitView();
  } else if (act === 'clear') {
    board.clearPage();
  } else if (act === 'delpage') {
    if (confirm('Να διαγραφεί η σελίδα;')) board.deletePage();
  } else if (act === 'full') {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen().catch(() => {});
  } else if (act === 'overlay') {
    openOverlay().catch((err) => toast(`Δεν άνοιξε: ${err}`, 6000));
  } else if (act === 'ai') {
    openAi();
  } else if (act === 'diag') {
    $('diag').classList.toggle('hidden');
  } else if (act === 'end') {
    void endLesson();
  } else if (act === 'more') {
    const m = $('setMenu');
    m.classList.remove('hidden');
    m.style.left = '14px';
    m.style.top = '80px';
  }
};
menu.addEventListener('click', (e) => void onMenu(e));
$('setMenu').addEventListener('click', (e) => void onMenu(e));

// ---------- διάγνωση ----------

const diag = $('diag');
diag.innerHTML = `
  <b>Διάγνωση εισόδου</b>
  <pre id="diagText">Άγγιξε ή γράψε στον πίνακα…</pre>
  <label>Όριο παλάμης (px): <span id="palmV"></span>
    <input id="palm" type="range" min="10" max="120" step="1" /></label>
  <small>Αν η γραφίδα του BenQ εμφανίζεται ως «touch», το μέγεθος επαφής ξεχωρίζει στυλό από παλάμη.
  Επαφές μεγαλύτερες από το όριο λειτουργούν ως γόμα.</small>`;
const palm = diag.querySelector<HTMLInputElement>('#palm')!;
palm.value = String(board.palmThreshold);
const palmV = diag.querySelector<HTMLElement>('#palmV')!;
palmV.textContent = palm.value;
palm.oninput = () => {
  board.palmThreshold = Number(palm.value);
  palmV.textContent = palm.value;
};
const diagText = diag.querySelector<HTMLElement>('#diagText')!;
let maxContact = 0;
board.onPointerInfo = (e, n) => {
  if (diag.classList.contains('hidden')) return;
  const size = Math.max(e.width, e.height);
  if (e.type === 'pointerdown') maxContact = size;
  else maxContact = Math.max(maxContact, size);
  diagText.textContent =
    `τύπος:        ${e.pointerType}\n` +
    `επαφή:        ${e.width.toFixed(1)} × ${e.height.toFixed(1)} px\n` +
    `μέγιστη επαφή:${maxContact.toFixed(1)} px\n` +
    `πίεση:        ${e.pressure.toFixed(2)}\n` +
    `κουμπιά:      ${e.buttons}\n` +
    `ταυτόχρονοι δείκτες: ${n}\n` +
    `pointerId:    ${e.pointerId}`;
};

// ---------- κείμενο ----------

const TEXT_SIZES = [20, 28, 44, 72];
const textEd = $('textEd');
const textArea = textEd.querySelector('textarea')!;
let textCtx: { x: number; y: number; existing?: TextItem } | null = null;

function openText(x: number, y: number, existing?: TextItem): void {
  if (textCtx) closeText(true);
  textCtx = { x, y, existing };
  const size = existing?.size ?? TEXT_SIZES[Math.max(0, SIZES.pen.indexOf(board.sizes.pen))];
  const [sx, sy] = board.toScreen(x, y);
  const fs = Math.max(14, size * board.zoom);
  textEd.style.left = Math.max(8, Math.min(sx, window.innerWidth - 340)) + 'px';
  textEd.style.top = Math.max(8, Math.min(sy, window.innerHeight - 220)) + 'px';
  textArea.style.fontSize = fs + 'px';
  textArea.style.color = board.ink(existing?.color ?? board.color);
  textArea.style.background = isDark(board.doc.bg) ? '#14201b' : '#fff';
  textArea.value = existing?.text ?? '';
  textEd.classList.remove('hidden');
  textArea.focus();
}

function closeText(save: boolean): void {
  if (!textCtx) return;
  const c = textCtx;
  textCtx = null;
  textEd.classList.add('hidden');
  if (save) {
    const size = c.existing?.size ?? TEXT_SIZES[Math.max(0, SIZES.pen.indexOf(board.sizes.pen))];
    board.commitText(c.x, c.y, textArea.value, size, c.existing);
  }
}
board.onTextRequest = openText;
$('textOk').onclick = () => closeText(true);
$('textCancel').onclick = () => closeText(false);
textArea.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Escape') closeText(false);
  else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) closeText(true);
});
document.addEventListener(
  'pointerdown',
  (e) => {
    if (textCtx && !(e.target as HTMLElement).closest('#textEd')) closeText(true);
  },
  true
);

// ---------- πληκτρολόγιο ----------

window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).closest('textarea, input')) return;
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) board.redo();
    else board.undo();
  } else if (ctrl && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    board.redo();
  } else if (ctrl && e.key.toLowerCase() === 'd') {
    e.preventDefault();
    board.duplicateSelected();
  } else if (e.key === 'Escape') {
    board.stopReplay();
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    board.deleteSelected();
  } else if (!ctrl) {
    const map: Record<string, Tool> = { v: 'select', p: 'pen', h: 'highlighter', l: 'laser', e: 'eraser', m: 'hand', s: 'shape', t: 'text', d: 'measure' };
    const t = map[e.key.toLowerCase()];
    if (t) board.setTool(t);
    else if (e.key === 'PageDown') board.goto(board.cur + 1);
    else if (e.key === 'PageUp') board.goto(board.cur - 1);
  }
});

// ---------- αυτόματη αποθήκευση ----------

// ---------- αποστολή στους μαθητές ----------

/** Αν οι σελίδες του PDF παίρνουν το λογότυπο σε μια γωνία (ρύθμιση ανά συσκευή). */
let pdfLogo = true;
function setPdfLogo(on: boolean): void {
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

/** Το PDF του μαθήματος· με πάνω από μία σελίδα ρωτά ποιες θα μπουν. null αν ο χρήστης ακύρωσε. */
/** Το PDF του μαθήματος. `all`: όλες οι σελίδες, χωρίς ερώτηση. */
async function lessonPdf(all = false): Promise<Blob | null> {
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
function pickPages(title: string, okText: string, n: number, thumb: (i: number, w: number) => Promise<HTMLCanvasElement>, current?: number): Promise<number[] | null> {
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
function openSend(): void {
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
    sendUrl = up.url;
    drawQr($('sendQr') as HTMLCanvasElement, up.url);
    $('sendUrl').textContent = up.url;
    $('sendNote').textContent = up.shared
      ? 'Το αρχείο είναι στον φάκελο «PrismaBoard» του Drive. Όποιος έχει τον σύνδεσμο ή το QR μπορεί να το δει.'
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
async function endLesson(): Promise<void> {
  if (!driveClientId()) return openSend();
  const name = `${fileName(lessons?.current?.name ?? 'mathima')}_${stamp()}.pdf`;
  try {
    // η σύνδεση πρώτα, όσο «μετράει» ακόμα το πάτημα: αλλιώς ο browser μπλοκάρει το παράθυρο της Google
    await driveConnect();
    const pdf = await lessonPdf(true);
    if (!pdf) return;
    toast('Ανεβαίνει στο Google Drive…', 0);
    const up = await uploadToDrive(pdf, name);
    sendUrl = up.url;
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

// ---------- οθόνη πρώτης χρήσης ----------

const WELCOME = 'grafida.welcome';
function openWelcome(): void {
  closePopups();
  $('welcome').classList.remove('hidden');
}
function closeWelcome(): void {
  $('welcome').classList.add('hidden');
  try { localStorage.setItem(WELCOME, '1'); } catch { /* χωρίς αποθήκευση */ }
}
$('wGo').onclick = closeWelcome;
$('wHelp').onclick = () => window.open('./odigies.pdf', '_blank');
$('welcome').addEventListener('pointerdown', (e) => {
  if (e.target === $('welcome')) closeWelcome();
});

// ---------- zoom και ονόματα εικονιδίων ----------

$('zoomOut').onclick = () => board.zoomBy(1 / 1.25);
$('zoomIn').onclick = () => board.zoomBy(1.25);
$('zoomFit').onclick = () => board.fitView();
board.onView = () => {
  placeSelBar();
  const t = `${Math.round(board.zoom * 100)}%`;
  if ($('zoomFit').textContent !== t) $('zoomFit').textContent = t;
};
/** Μικρά ονόματα κάτω από τα εικονίδια της μπάρας· ανοιχτά μέχρι να τα κλείσει ο χρήστης. */
function setLabels(on: boolean): void {
  $('toolbar').classList.toggle('labels', on);
  document.querySelector('[data-act=labels]')!.classList.toggle('on', on);
  try {
    localStorage.setItem('grafida.labels', on ? '1' : '0');
  } catch {
    /* χωρίς αποθήκευση */
  }
  layoutBar();
}
setLabels((() => { try { return localStorage.getItem('grafida.labels') !== '0'; } catch { return true; } })());

// το διαφανές παράθυρο δεν έχει μαθήματα και δεν πειράζει ό,τι είναι αποθηκευμένο
const lessons = isOverlay
  ? null
  : new Lessons({ getDoc: () => board.doc, setDoc: (d) => board.loadDoc(d), thumb: () => board.thumb(), download, toast }, app);
board.onChange = () => lessons?.touch();

void (async () => {
  await lessons?.init().catch((err) => console.error(err));
  refreshUi();
  initToolbar();
  // την πρώτη φορά σε κάθε συσκευή, μια σύντομη γνωριμία
  let seen = true;
  try { seen = localStorage.getItem(WELCOME) === '1'; } catch { /* χωρίς αποθήκευση: δεν ενοχλούμε */ }
  if (!seen && !isOverlay) openWelcome();
})();

if (import.meta.env.PROD && !isNative && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

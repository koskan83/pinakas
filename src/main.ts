import { Board, EraserMode, SizedTool } from './board';
import { AxesItem, AxesMode, Background, Doc, Item, ShapeKind, TableStyle, TextItem, Tool, isDark } from './model';
import { blobToPic, captureScreen, clipboardImage, openDocx, openPdf } from './importers';
import { kvGet, kvSet } from './storage';
import { Lessons } from './lessons';
import { GadgetKind } from './gadgets';
import { isNative, isOverlay, nativeScreenshot, openOverlay } from './native';
import { STAMPS, STAMP_CATS, type StampDef } from './stamps';
import { PEN_ICON, PenKind } from './ui';
import { ask, notice } from './dialog';
import { openBuildView } from './build-view';
import { confetti, loadFx, playFx, saveFx, say } from './fx';
import { NEWS, VERSION, newsPending } from './news';
import { BUILTIN, type Template } from './pages';
import { $, HL_PALETTE, MORE_COLORS, PALETTE, SIZES, SIZE_NAME, app, board, curtain, curtainTop, download, fileName, layoutBar, spot, stamp, timer, toast } from './app';
import { esc, fitY, renderFns, resetFnDraft, resetFnMoved, scaleText, toggleAnalysis } from './axes-ui';
import { clearMeasShape } from './measure-ui';
import { ai, autoKind, openAi } from './recognize-ui';
import { endLesson, lessonPdf, openSend, pdfLogo, pickPages, setPdfLogo } from './send-ui';
import { initToolbar } from './toolbar-pos';
import { trackUsage, usageReport } from './usage';
import { askSpellWords } from './spell-lists';

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
      } else if (f.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(f.name)) {
        // σε κάποιες συσκευές (Android, πίνακες) ο επιλογέας αρχείων δεν δίνει τύπο: τότε μετρά η κατάληξη
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
  if (p.axesNums === false) board.axesNums = false;
} catch {
  /* χωρίς αποθηκευμένες προτιμήσεις */
}
export function savePrefs(): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ sizes: board.sizes, eraserMode: board.eraserMode, customColor, axesNums: board.axesNums }));
  } catch {
    /* δεν πειράζει */
  }
}

export const inkPalette = (): string[] => PALETTE[isDark(board.doc.bg) ? 'dark' : 'light'];
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
    '<button id="colorBtn" title="Περισσότερα χρώματα" aria-label="Περισσότερα χρώματα"><span data-em="🎨"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2.2-.6-1.5.3-2.8 2-2.8H18a3 3 0 0 0 3-3c0-5.500-4-10-9-10z"/><circle cx="7.5" cy="11" r="1" fill="currentColor"/><circle cx="10.5" cy="7.5" r="1" fill="currentColor"/><circle cx="15" cy="8" r="1" fill="currentColor"/></svg></span></button>';
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

/**
 * Το μαύρο και το λευκό της γραμμής ακολουθούν το φόντο (βλ. Board.ink). Όταν όμως διαλέγεις από την παλέτα το «αντίθετο» του φόντου,
 * το θέλεις όπως το βλέπεις: π.χ. μαύρο για να γράψεις πάνω σε λευκή σελίδα που έβαλες σε σκούρο πίνακα.
 */
function literal(c: string): string {
  const dark = isDark(board.doc.bg);
  const v = c.toLowerCase();
  if (dark && v === '#111111') return '#000000';
  if (!dark && v === '#ffffff') return '#fefefe';
  return c;
}

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
  pickColor(literal(b.dataset.color!));
});
($('colorInput') as HTMLInputElement).onchange = (e) => {
  closePopups();
  pickColor(literal((e.target as HTMLInputElement).value.toLowerCase()));
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
/** Η μπάρα μένει εκεί που είναι, για να πατηθεί το ίδιο κουμπί ξανά και ξανά. */
const keepBar = (fn: () => void) => (): void => {
  const el = $('selOpts');
  const { left, top } = el.style;
  fn();
  el.style.left = left;
  el.style.top = top;
};
$('bigger').onclick = keepBar(() => board.scaleSelected(1.25));
$('smaller').onclick = keepBar(() => board.scaleSelected(0.8));
$('flipH').onclick = keepBar(() => board.flipSelected(false));
$('flipV').onclick = keepBar(() => board.flipSelected(true));
$('sumBtn').onclick = () => board.addResultant();
$('prev').onclick = () => board.goto(board.cur - 1);
$('next').onclick = () => board.goto(board.cur + 1);
$('addPage').onclick = () => board.addPage();

// ---------- κατάσταση κουμπιών ----------

export function refreshUi(): void {
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
  $('penBtn').querySelector('span')!.dataset.em = penKind === 'laser' ? '🔦' : '✏️';
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
  for (const id of ['bigger', 'smaller']) show(id, board.hasSelection);
  // σκέτο κείμενο, άξονες ή τριγωνομετρικός κύκλος δεν καθρεφτίζονται (μένουν αναγνώσιμα)
  for (const id of ['flipH', 'flipV']) show(id, board.selectionFlippable);
  // η αναγνώριση έχει νόημα μόνο όταν στην επιλογή υπάρχει χειρόγραφο
  const ink = board.selectionHasInk;
  const writing = board.selectionHasWriting;
  document.querySelectorAll<HTMLElement>('#selOpts .rec').forEach((b) => b.classList.toggle('hidden', b.dataset.speak || b.dataset.spellwords ? !(writing || region) : b.dataset.rec === 'text' || b.dataset.rec === 'math' ? !ink : !(writing || region)));
  $('selOpts').querySelector('.recSep')!.classList.toggle('hidden', !(writing || region) || !board.hasSelection);
  show('sumBtn', !!board.resultantSource);
  show('axesOpts', !!ax);
  const sp = tool === 'select' ? board.selectedSpring : null;
  show('springOpts', !!sp);
  $('spMarks').classList.toggle('on', !!sp?.marks);
  // στο εκκρεμές δεν υπάρχει φυσικό μήκος: οι θέσεις είναι η ισορροπία και οι ακραίες
  $('spMarks').querySelector('span')!.textContent = sp?.name === 'pendulum' ? '±A' : 'ΘΦΜ';
  $('spDamp').classList.toggle('on', !!sp?.damp);
  ($('spStop') as HTMLButtonElement).disabled = !board.springMoving;
  // σχήματα με κίνηση (κύματα, κρούση): μόνο ▶/⏸· τα ελατήρια και το εκκρεμές: θέσεις, απόσβεση, στοπ
  const playable = !!sp && !!STAMPS[sp.name]?.play;
  show('spPlay', playable);
  for (const id of ['spMarks', 'spDamp', 'spStop']) show(id, !!sp && !playable);
  $('spPlay').querySelector('span')!.textContent = board.springMoving ? '⏸' : '▶';
  show('widths', tool === 'pen' || tool === 'highlighter' || tool === 'shape' || tool === 'text' || tool === 'eraser');
  show('subbar', [...$('subbar').children].some((g) => !g.classList.contains('hidden')));
  const anOn: Record<string, boolean> = { int: !!ax?.an?.int, sum: !!ax?.an?.int?.n, lim: !!ax?.an?.lim, tan: !!ax?.an?.tan, asym: !!ax?.an?.asym };
  document.querySelectorAll<HTMLElement>('[data-an]').forEach((b) => b.classList.toggle('on', anOn[b.dataset.an!]));
  $('axesOpts').querySelector('[data-an=sum] span')!.textContent = ax?.an?.int?.n ? `Σ${ax.an.int.n}` : 'Σ';
  $('axNums').classList.toggle('on', ax?.nums !== false);
  $('axScale').querySelector('span')!.textContent = scaleText(ax?.sx ?? 1);
  $('axScale').classList.toggle('on', (ax?.sx ?? 1) !== 1);
  if (!ax) $('scaleMenu').classList.add('hidden');
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
board.onKidFull = (it) => openBuildView(board, it.id, (ev) => kidFx(ev), it.name);
board.onAsk = (q) => (q.lists ? askSpellWords({ title: q.title, voice: q.voice ?? 'el-GR', download }) : ask(q.title, { hint: q.hint, secret: q.secret, max: q.max ?? 24, voice: q.voice, value: q.value, picks: q.picks }));
board.onMergeAxes = (target, dropped) => {
  const pal = [...inkPalette().slice(1), '#ea580c', '#7c3aed'];
  const fns = [...(target.fns ?? [])];
  // κάθε συνάρτηση που έρχεται παίρνει χρώμα που δεν υπάρχει ήδη· οι κλάδοι της ίδιας (ίδιο χρώμα πριν) μένουν ομόχρωμοι
  const recolor = new Map<string, string>();
  for (const f of dropped.fns ?? []) {
    let c = recolor.get(f.color);
    if (!c) {
      const used = new Set([...fns.map((g) => g.color), ...recolor.values()]);
      c = pal.find((p) => !used.has(p)) ?? pal[(fns.length + recolor.size) % pal.length];
      recolor.set(f.color, c);
    }
    fns.push({ ...f, color: c });
  }
  const params = { ...dropped.params, ...target.params };
  // οι άξονες ανοίγουν όσο χρειάζεται για να χωρέσουν και τα δύο σχήματα
  const mode: AxesMode = target.mode === 'full' || dropped.mode === 'full' ? 'full' : target.mode === 'q14' || dropped.mode === 'q14' ? 'q14' : 'q1';
  const sx = Math.max(target.sx ?? 1, dropped.sx ?? 1);
  const next: AxesItem = { ...target, fns, mode, ...(Object.keys(params).length ? { params } : {}), sx: sx === 1 ? undefined : sx };
  toast('Οι δύο γραφικές παραστάσεις ενώθηκαν στους ίδιους άξονες. Με αναίρεση χωρίζουν ξανά.', 5000);
  return { ...next, sy: fitY(next, fns, params) };
};
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

// ---------- αναδυόμενα μενού ----------

const menu = $('menu');
const impMenu = $('importMenu');
const gadgetMenu = $('gadgetMenu');
const colorMenu = $('colorMenu');
const labelMenu = $('labelMenu');
const fnMenu = $('fnMenu');
const stampMenu = $('stampMenu');
const tplMenu = $('tplMenu');
export function closePopups(): void {
  document.querySelectorAll('.popup').forEach((p) => p.classList.add('hidden'));
  clearMeasShape();
  resetFnDraft();
  resetFnMoved();
}
/** Τοποθετεί ένα αναδυόμενο μενού δίπλα στο κουμπί του, μέσα στα όρια της οθόνης. */
export function placeNear(popup: HTMLElement, anchor: HTMLElement): void {
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
export function togglePopup(popup: HTMLElement, anchor: HTMLElement): void {
  const open = popup.classList.contains('hidden');
  closePopups();
  if (!open) return;
  popup.classList.remove('hidden');
  placeNear(popup, anchor);
}
// ό,τι χρησιμοποιήθηκε τελευταία από τα Όργανα μένει πρώτο στη λίστα
const RECENT = 'grafida.recent';
const TILE_ATTRS = ['shape', 'axes', 'ins', 'anq', 'gadget', 'view', 'kid'];
const tileKey = (b: HTMLElement): string => {
  const a = TILE_ATTRS.find((k) => b.dataset[k] !== undefined);
  return a ? `${a}=${b.dataset[a]}` : '';
};
let recent: string[] = (() => { try { return JSON.parse(localStorage.getItem(RECENT) ?? '[]') as string[]; } catch { return []; } })();
function renderRecent(): void {
  const box = $('recentTiles');
  const lv = document.body.classList.contains('primary') ? 'pri' : 'sec';
  box.innerHTML = '';
  for (const k of recent) {
    const [a, v] = k.split('=');
    // μόνο ό,τι υπάρχει στη βαθμίδα που είναι ανοιχτή (η Κλήρωση έχει πλακίδιο και στις δύο)
    const src = [...gadgetMenu.querySelectorAll<HTMLElement>(`.tiles:not(#recentTiles) [data-${a}="${v}"]`)]
      .find((el) => (el.closest<HTMLElement>('[data-lv]')?.dataset.lv ?? lv) === lv);
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
// στο Δημοτικό τα Όργανα χωρίζονται σε καρτέλες, για να χωράνε χωρίς κύλιση· η τελευταία μένει ανοιχτή
const GTAB = 'grafida.gtab';
function setGadgetTab(tab: string): void {
  const tabs = [...gadgetMenu.querySelectorAll<HTMLElement>('[data-gtab]')];
  if (!tabs.some((b) => b.dataset.gtab === tab)) tab = 'num';
  for (const b of tabs) b.classList.toggle('on', b.dataset.gtab === tab);
  for (const el of gadgetMenu.querySelectorAll<HTMLElement>('[data-tab]')) el.classList.toggle('tabOff', el.dataset.tab !== tab);
  try { localStorage.setItem(GTAB, tab); } catch { /* χωρίς αποθήκευση */ }
}
setGadgetTab((() => { try { return localStorage.getItem(GTAB) ?? 'num'; } catch { return 'num'; } })());
gadgetMenu.addEventListener('click', (e) => {
  const tab = (e.target as HTMLElement).closest<HTMLElement>('[data-gtab]')?.dataset.gtab;
  if (!tab) return;
  setGadgetTab(tab);
  placeNear(gadgetMenu, $('gadgetBtn'));
});
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
  const kidTool = t.closest<HTMLElement>('[data-kid]')?.dataset.kid;
  if (kidTool) {
    closePopups();
    board.addStamp(kidTool);
    refreshUi();
    // τα κυβάκια ανοίγουν κατευθείαν σε όλη την οθόνη· η πόρτα στο τέλος των υλικών γυρίζει στον πίνακα
    if (kidTool === 'build' && board.selectionIds[0]) openBuildView(board, board.selectionIds[0], (ev) => kidFx(ev));
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

for (const [cat, title] of Object.entries(STAMP_CATS)) {
  const head = document.createElement('div');
  head.className = 'stHead';
  head.textContent = title;
  $('stampGrid').append(head);
  for (const [name, d] of Object.entries(STAMPS)) if (!d.kid && !d.hidden && d.cat === cat) addStampTile(name, d);
}
function addStampTile(name: string, d: StampDef): void {
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

let templates: Template[] = [];
void kvGet<Template[]>('templates').then((t) => { templates = t ?? []; });
function renderTemplates(): void {
  $('tplList').innerHTML =
    BUILTIN.map((t, i) => `<div class="tplItem"${t.lv ? ` data-lv="${t.lv}"` : ''}><button data-tpl="b${i}">📄 ${esc(t.name)}</button></div>`).join('') +
    templates.map((t, i) => `<div class="tplItem"><button data-tpl="u${i}">📄 ${esc(t.name)}</button><button data-tpldel="${i}" title="Διαγραφή προτύπου">✕</button></div>`).join('');
}
tplMenu.addEventListener('click', async (e) => {
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
    const name = (await ask('Όνομα προτύπου', { value: `Πρότυπο ${templates.length + 1}` }))?.trim();
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
  } else if (act === 'startscr') {
    setStartScr(!startScr);
  } else if (act === 'labels') {
    setLabels(!$('toolbar').classList.contains('labels'));
  } else if (act === 'fxsound' || act === 'fxclick') {
    if (act === 'fxsound') fxPrefs.sound = !fxPrefs.sound;
    else fxPrefs.click = !fxPrefs.click;
    saveFx(fxPrefs);
    showFxPrefs();
    kidFx(act === 'fxsound' ? 'new' : 'click');
    return;
  } else if (act === 'level') {
    setLevel(!primary);
    toast(primary ? 'Δημοτικό: απλή γραμμή εργαλείων. Τα εργαλεία του είναι στα Όργανα.' : 'Γυμνάσιο – Λύκειο: όλα τα εργαλεία.', 4000);
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
    // χωρίς ερώτηση: η σελίδα σβήνει αμέσως και το μήνυμα έχει «Αναίρεση» για λίγα δευτερόλεπτα
    const gone = board.deletePage();
    if (gone.page.items.length) toast('Η σελίδα διαγράφηκε', 9000, { label: 'Αναίρεση', run: () => board.restorePage(gone) });
  } else if (act === 'full') {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen().catch(() => {});
  } else if (act === 'overlay') {
    openOverlay().catch((err) => toast(`Δεν άνοιξε: ${err}`, 6000));
  } else if (act === 'ai') {
    openAi();
  } else if (act === 'usage') {
    download(new Blob([usageReport()], { type: 'text/plain;charset=utf-8' }), `prismaboard_xrisi_${stamp()}.txt`);
  } else if (act === 'diag') {
    $('diag').classList.toggle('hidden');
  } else if (act === 'end') {
    void endLesson();
  } else if (act === 'news') {
    void showNews();
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
    closePopups();
    lessons?.dismiss();
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

// ---------- οθόνη πρώτης χρήσης ----------

// ---------- Δημοτικό ή Γυμνάσιο–Λύκειο: ποια εργαλεία φαίνονται ----------
const LEVEL = 'grafida.level';
let primary = false;

// ήχοι, κίνηση και πανηγυρισμοί: μόνο στο Δημοτικό
const fxPrefs = loadFx();
function showFxPrefs(): void {
  const mark = (act: string, on: boolean, name: string): void => {
    const b = document.querySelector<HTMLElement>(`#menu [data-act="${act}"]`);
    if (!b) return;
    b.classList.toggle('on', on);
    b.lastChild!.textContent = `${name}: ${on ? 'ναι' : 'όχι'}`;
  };
  mark('fxsound', fxPrefs.sound, 'Ήχοι');
  mark('fxclick', fxPrefs.sound && fxPrefs.click, 'Ήχος «κλικ» στα κουμπιά των εργαλείων');
}
showFxPrefs();
/** Ήχος για κάτι που έγινε σε εργαλείο του Δημοτικού· στις επιτυχίες και κομφετί από το σημείο (x, y) της οθόνης. */
const noVoice = new Set<string>();
function kidFx(ev: string, x?: number, y?: number): void {
  if (!primary) return;
  if (ev.startsWith('say|')) {
    // ορθογραφία: η λέξη λέγεται δυνατά· αν δεν ακουστεί, το λέμε μία φορά ανά γλώσσα
    const [, lang, text] = ev.split('|');
    void say(text, lang).then((heard) => {
      if (heard || noVoice.has(lang)) return;
      noVoice.add(lang);
      toast(`Δεν μπόρεσα να πω τη λέξη: η συσκευή δεν έχει ${lang.startsWith('el') ? 'ελληνική' : 'αγγλική'} φωνή και δεν βρήκα φωνή στο ίντερνετ. Πες τη εσύ, ή δείξε τη με το 👁.`, 8000);
    });
    return;
  }
  const num = /^num\|(\w*)\|(\d+)$/.exec(ev);
  if (num) {
    // αριθμοκυβάκια: μόνο ήχος, χωρίς φωνή
    if (num[1]) playFx(num[1], fxPrefs);
    return;
  }
  playFx(ev, fxPrefs);
  if (ev === 'win') confetti(x, y, 180);
  else if (ev === 'cheer') confetti(x, y, 70);
}
board.onKidFx = (ev, it) => {
  const [x, y] = board.toScreen(it.x + it.w / 2, it.y + it.h / 2);
  kidFx(ev, x, y);
};
function setLevel(pri: boolean, save = true): void {
  primary = pri;
  board.kidMotion = pri;
  document.body.classList.toggle('primary', pri);
  // εργαλείο που δεν υπάρχει στο Δημοτικό δεν μένει ενεργό
  if (pri && board.tool === 'measure') board.setTool('select');
  const label = document.querySelector('#menu [data-act="level"]')?.lastChild;
  if (label) label.textContent = pri ? 'Αλλαγή σε Γυμνάσιο – Λύκειο' : 'Αλλαγή σε Δημοτικό';
  document.querySelectorAll<HTMLElement>('#wLevel [data-level]').forEach((b) => b.classList.toggle('on', (b.dataset.level === 'primary') === pri));
  if (save) { try { localStorage.setItem(LEVEL, pri ? 'primary' : 'secondary'); } catch { /* χωρίς αποθήκευση */ } }
  renderColors();
  refreshUi();
}
setLevel((() => { try { return localStorage.getItem(LEVEL) === 'primary'; } catch { return false; } })(), false);
$('wLevel').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-level]');
  if (b) setLevel(b.dataset.level === 'primary');
});

// στο Δημοτικό τα εικονίδια της γραμμής εργαλείων γίνονται emoji (το CSS τα δείχνει αντί για τα γραμμικά)
const EMOJI: Record<string, string> = {
  '#tools [data-tool="select"]': '👆', '#penBtn': '✏️', '#tools [data-tool="highlighter"]': '🖍️', '#tools [data-tool="text"]': '🔤',
  '#tools [data-tool="eraser"]': '🧽', '#tools [data-tool="hand"]': '✋', '#undo': '↩️', '#redo': '↪️', '#importBtn': '🖼️',
  '#gadgetBtn': '🧰', '#prev': '◀️', '#next': '▶️', '#addPage': '📄',
  '#penKinds [data-pen="pen"]': '✏️', '#penKinds [data-pen="laser"]': '🔦',
};
for (const [sel, em] of Object.entries(EMOJI)) {
  const span = document.querySelector<HTMLElement>(`${sel} > span`);
  if (span) span.dataset.em = em;
}

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
const showNews = (): Promise<void> => notice('Τι νέο στο PrismaBoard', NEWS, `Έκδοση ${VERSION}`);
$('verLine').textContent = `Έκδοση ${VERSION}`;
$('wHelp').onclick = () => window.open('./odigies.pdf', '_blank');
$('welcome').addEventListener('pointerdown', (e) => {
  if (e.target === $('welcome')) closeWelcome();
});

// ---------- zoom και ονόματα εικονιδίων ----------

$('zoomOut').onclick = () => board.zoomBy(1 / 1.25);
$('zoomIn').onclick = () => board.zoomBy(1.25);
$('zoomFit').onclick = () => board.fitView();
// σε πλήρη οθόνη ο browser λέει «πάτα Esc»· ο πίνακας δεν έχει πλήκτρα, άρα η έξοδος θέλει δικό της κουμπί
$('fsExit').onclick = () => void document.exitFullscreen().catch(() => {});
document.addEventListener('fullscreenchange', () => {
  const on = !!document.fullscreenElement;
  $('fsExit').classList.toggle('hidden', !on);
  const label = document.querySelector('#menu [data-act="full"]')?.lastChild;
  if (label) label.textContent = on ? 'Έξοδος από πλήρη οθόνη' : 'Πλήρης οθόνη';
});
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
/** Η οθόνη «Τι κάνουμε σήμερα;» στο πρώτο άνοιγμα της μέρας· ανοιχτή μέχρι να την κλείσει ο χρήστης. */
let startScr = true;
function setStartScr(on: boolean): void {
  startScr = on;
  document.querySelector('[data-act=startscr]')!.classList.toggle('on', on);
  try {
    localStorage.setItem('grafida.startscr', on ? '1' : '0');
  } catch {
    /* χωρίς αποθήκευση */
  }
}
setStartScr((() => { try { return localStorage.getItem('grafida.startscr') !== '0'; } catch { return true; } })());

// το διαφανές παράθυρο δεν έχει μαθήματα και δεν πειράζει ό,τι είναι αποθηκευμένο
export const lessons = isOverlay
  ? null
  : new Lessons({ getDoc: () => board.doc, setDoc: (d) => board.loadDoc(d), thumb: () => board.thumb(), redraw: () => board.redraw(), download, toast }, app);
board.onChange = () => lessons?.touch();
board.kidNames = () => lessons?.names() ?? [];

/** Τα αρχεία που έστειλε άλλη εφαρμογή με «Κοινοποίηση» (τα φύλαξε το sw.js)· διαβάζονται μία φορά. */
async function sharedFiles(): Promise<File[]> {
  if (!new URLSearchParams(location.search).has('shared')) return [];
  history.replaceState(null, '', location.pathname);
  try {
    const c = await caches.open('grafida-shared'), out: File[] = [];
    for (const req of await c.keys()) {
      const res = await c.match(req);
      if (res) out.push(new File([await res.blob()], decodeURIComponent(res.headers.get('x-name') ?? ''), { type: res.headers.get('content-type') ?? '' }));
    }
    await caches.delete('grafida-shared');
    return out;
  } catch {
    return [];
  }
}

void (async () => {
  await lessons?.init().catch((err) => console.error(err));
  refreshUi();
  initToolbar();
  // την πρώτη φορά σε κάθε συσκευή, μια σύντομη γνωριμία
  let seen = true;
  try { seen = localStorage.getItem(WELCOME) === '1'; } catch { /* χωρίς αποθήκευση: δεν ενοχλούμε */ }
  // η εφαρμογή άνοιξε από «Κοινοποίηση» άλλης εφαρμογής: ό,τι στάλθηκε μπαίνει στο μάθημα που ήταν ανοιχτό
  const shared = await sharedFiles();
  if (shared.length) void importFiles(shared);
  else if (!seen && !isOverlay) openWelcome();
  // στο πρώτο άνοιγμα της μέρας: συνέχισε το τελευταίο μάθημα ή ξεκίνα νέο για το τμήμα σου
  else if (startScr) lessons?.start();
  // μετά από ενημέρωση, μία φορά σε κάθε συσκευή: τι άλλαξε
  if (newsPending(seen) && !isOverlay) void showNews();
})();

if (!isOverlay) trackUsage();

if (import.meta.env.PROD && !isNative && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// Πίνακας που μένει ανοιχτός για μέρες δεν παίρνει ποτέ τη νέα έκδοση: όταν ανέβει καινούρια, ένα μήνυμα προτείνει ανανέωση.
if (import.meta.env.PROD && !isNative) {
  // η λίστα αρχείων της έκδοσης αλλάζει σε κάθε δημοσίευση
  const buildId = (): Promise<string | null> => fetch('./precache.json', { cache: 'no-store' }).then((r) => (r.ok ? r.text() : null)).catch(() => null);
  let mine: string | null = null, told = false, last = Date.now();
  void buildId().then((s) => { mine = s; });
  const check = async (): Promise<void> => {
    if (told || !mine || document.visibilityState !== 'visible' || Date.now() - last < 30 * 60000) return;
    last = Date.now();
    const now = await buildId();
    if (!now || now === mine) return;
    told = true;
    toast('Υπάρχει νέα έκδοση του PrismaBoard', 0, { label: 'Ανανέωση', run: () => void (lessons?.flush(true) ?? Promise.resolve()).then(() => location.reload()) });
  };
  document.addEventListener('visibilitychange', () => void check());
  setInterval(() => void check(), 10 * 60000);
}

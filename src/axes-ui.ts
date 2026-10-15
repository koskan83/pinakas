/** Άξονες: ονόματα, κλίμακα, συναρτήσεις και εργαλεία ανάλυσης. */

import { AxesAn, AxesItem, FnDef } from './model';
import { Params, compile, fnOf, paramsOf } from './expr';
import { crossings, enclosing, fitScaleY } from './analysis';
import { axesRange, itemBounds } from './model';
import { ask } from './dialog';
import { $, board, toast } from './app';
// κυκλική αναφορά με το main: μόνο συναρτήσεις, που καλούνται αφού στηθεί όλη η εφαρμογή
import { closePopups, inkPalette, placeNear, savePrefs, togglePopup } from './main';

const labelMenu = $('labelMenu');
const fnMenu = $('fnMenu');
const scaleMenu = $('scaleMenu');

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
  if (t.closest('#axScale')) {
    if (!board.selectedAxes) return;
    togglePopup(scaleMenu, $('axScale'));
    markScale();
    return;
  }
  if (t.closest('#axNums')) {
    const ax = board.selectedAxes;
    if (!ax) return;
    board.axesNums = ax.nums === false;
    board.updateAxes({ nums: board.axesNums });
    savePrefs();
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
/** Πώς γράφεται μια κλίμακα: ×5 όταν η γραμμή αξίζει 5, ÷5 όταν αξίζει ένα πέμπτο. */
export function scaleText(sx: number): string {
  const inv = Math.round(1 / sx);
  if (sx < 1 && Math.abs(1 / sx - inv) < 1e-6) return `÷${inv}`;
  return `×${String(+sx.toPrecision(6)).replace('.', ',')}`;
}
const SCALE_N = [2, 5, 10, 50, 100];
// πάνω ο πολλαπλασιασμός, κάτω οι υποδιαιρέσεις· το ×1 μόνο του στην αρχή
$('scaleGrid').innerHTML = [1, ...SCALE_N, 0, ...SCALE_N.map((n) => 1 / n)].map((s) => (s ? `<button data-sx="${s}">${scaleText(s)}</button>` : '<i></i>')).join('');
function markScale(): void {
  const cur = board.selectedAxes?.sx ?? 1;
  scaleMenu.querySelectorAll<HTMLElement>('[data-sx]').forEach((b) => b.classList.toggle('on', Math.abs(Number(b.dataset.sx) - cur) < 1e-9));
}
scaleMenu.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-sx]');
  const ax = board.selectedAxes;
  if (!b || !ax) return;
  const sx = Number(b.dataset.sx);
  const old = ax.sx ?? 1;
  closePopups();
  if (Math.abs(sx - old) < 1e-9) return;
  // οι λαβές της ανάλυσης μένουν στις ίδιες γραμμές του άξονα
  const f = sx / old;
  const an: AxesAn | undefined = ax.an && {
    ...ax.an,
    ...(ax.an.int ? { int: { ...ax.an.int, a: ax.an.int.a * f, b: ax.an.int.b * f } } : {}),
    ...(ax.an.lim ? { lim: { x0: ax.an.lim.x0 * f, x: ax.an.lim.x * f } } : {}),
    ...(ax.an.tan ? { tan: { ...ax.an.tan, x: ax.an.tan.x * f, ...(ax.an.tan.h ? { h: ax.an.tan.h * f } : {}) } } : {}),
  };
  const next: AxesItem = { ...ax, sx: sx === 1 ? undefined : sx };
  board.updateAxes({ sx: next.sx, sy: fitY(next, ax.fns ?? [], ax.params), ...(an ? { an } : {}) });
});
/** Ανάβει, αλλάζει μορφή ή σβήνει ένα εργαλείο ανάλυσης στους επιλεγμένους άξονες. */
export function toggleAnalysis(key: string): void {
  const ax = board.selectedAxes;
  if (!ax) return;
  closePopups();
  const shown = (ax.fns ?? []).filter((f) => !f.hidden).length;
  if (!shown) {
    toast('Γράψε πρώτα μια συνάρτηση με το f(x)');
    return;
  }
  const r = axesRange(ax);
  const sx = ax.sx ?? 1;
  // οι αρχικές θέσεις μετριούνται σε γραμμές του άξονα, όποια κι αν είναι η κλίμακά του
  const inX = (v: number): number => Math.max(r.xmin, Math.min(r.xmax, v)) * sx;
  const an: AxesAn = { ...ax.an };
  const newInt = { a: inX(1), b: inX(3) };
  if (key === 'int') {
    if (!an.int) an.int = newInt;
    else if (!an.int.between && shown >= 2) {
      an.int = { ...an.int, between: true };
      // το χωρίο ανάμεσα στις δύο καμπύλες ορίζεται από τα σημεία τομής τους: τα άκρα πάνε μόνα τους εκεί
      const two = (ax.fns ?? []).filter((d) => !d.hidden).map((d) => fnOf(d)).filter((d) => !!d).map((d) => (x: number) => d!(x, ax.params ?? {}));
      const pair = two.length >= 2 ? enclosing(crossings(two[0], two[1], r.xmin * sx, r.xmax * sx), (an.int.a + an.int.b) / 2) : null;
      if (pair) {
        an.int = { ...an.int, a: pair[0], b: pair[1] };
        toast('Τα άκρα μπήκαν στα σημεία τομής των δύο καμπυλών. Σύρε τα για άλλο χωρίο.', 4500);
      } else toast('Οι δύο καμπύλες δεν τέμνονται δύο φορές μέσα στους άξονες. Όρισε τα άκρα σέρνοντάς τα.', 4500);
    }
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
    else if (!an.tan.h) an.tan = { ...an.tan, h: sx };
    else delete an.tan;
  } else if (key === 'asym') an.asym = !an.asym;
  board.updateAxes({ an });
}
$('labelMenu').addEventListener('click', async (e) => {
  const t = e.target as HTMLElement;
  let label = t.closest<HTMLElement>('[data-label]')?.dataset.label;
  const other = !!t.closest('#labelOther');
  closePopups();
  if (other) label = (await ask('Όνομα άξονα', { max: 12 }))?.trim() || undefined;
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
export const esc = (t: string): string => t.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
/** Ποια συνάρτηση της λίστας διορθώνεται (null = γράφεται καινούργια). */
let fnEdit: number | null = null;
/** Ο χρήστης έσυρε το πλαίσιο: δεν το ξανατοποθετούμε μόνοι μας. */
let fnMoved = false;
/** Το παράθυρο των συναρτήσεων ξαναπαίρνει τη θέση του δίπλα στους άξονες. */
export function resetFnMoved(): void {
  fnMoved = false;
}
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
export function renderFns(): void {
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
export function resetFnDraft(): void {
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
  board.updateAxes({ fns: next, params, sy: fitY(ax, next, params) });
  renderFns();
}
/** Η κλίμακα του κατακόρυφου άξονα που ταιριάζει στις ορατές συναρτήσεις (undefined = 1 ανά γραμμή). */
export function fitY(ax: AxesItem, fns: FnDef[], params: Params | undefined): number | undefined {
  const r = axesRange(ax);
  const ok = fns.filter((f) => !f.hidden).map((f) => fnOf(f)).filter((f) => !!f).map((f) => (x: number) => f!(x, params ?? {}));
  const sx = ax.sx ?? 1;
  const sy = fitScaleY(ok, r.xmin * sx, r.xmax * sx, r.ymax, -r.ymin);
  return sy === 1 ? undefined : sy;
}
$('fnAdd').onclick = addFn;
$('spMarks').onclick = () => board.updateSpring({ marks: !board.selectedSpring?.marks });
$('spDamp').onclick = () => board.updateSpring({ damp: !board.selectedSpring?.damp });
$('spStop').onclick = () => board.stopSpring();
$('spPlay').onclick = () => board.togglePlay();
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
    const left = fns.filter((_, i) => i !== del);
    board.updateAxes({ fns: left, sy: fitY(ax, left, ax.params) });
  } else if (vis !== null) {
    const seen = fns.map((f, i) => (i === vis ? { ...f, hidden: !f.hidden } : f));
    board.updateAxes({ fns: seen, sy: fitY(ax, seen, ax.params) });
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
  board.updateAxes({ params, sy: fitY(ax, ax.fns ?? [], params) });
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

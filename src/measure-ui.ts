/** Αλλαγή μήκους ή γωνίας ενός σχήματος από το πληκτρολόγιο. */

import { MeasOpts, isPoly } from './model';
import { $, board } from './app';
import { closePopups } from './main';

const measMenu = $('measMenu');
const measInput = $('measInput') as HTMLInputElement;
const MEAS_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', ',', '⌫', 'α', 'β', 'γ', 'x', 'm', 'cm', 'θ', 'φ', 'ω', '°', 'Α', 'Β'];
$('measKeys').innerHTML = MEAS_KEYS.map((k) => `<button data-key="${k}"${/^[0-9,]$/.test(k) ? ' class="num"' : ''}>${k}</button>`).join('');
let measTarget: { id: string; side: number } | null = null;
const measOpts = $('measOpts');
/** Το σχήμα του οποίου οι επιλογές μετρήσεων είναι ανοιχτές. */
let measShape: string | null = null;
export function clearMeasShape(): void {
  measShape = null;
}
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

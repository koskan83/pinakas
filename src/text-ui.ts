/** Το πλαίσιο που γράφεις κείμενο πάνω στον πίνακα (και η διάγνωση εισόδου για γραφίδα και παλάμη). */

import { TextItem, isDark } from './model';
import { $, SIZES, board } from './app';

const TEXT_SIZES = [20, 28, 44, 72];
let textCtx: { x: number; y: number; existing?: TextItem } | null = null;

function openText(x: number, y: number, existing?: TextItem): void {
  const textEd = $('textEd'), textArea = textEd.querySelector('textarea')!;
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
  const textEd = $('textEd');
  textEd.classList.add('hidden');
  if (save) {
    const size = c.existing?.size ?? TEXT_SIZES[Math.max(0, SIZES.pen.indexOf(board.sizes.pen))];
    board.commitText(c.x, c.y, textEd.querySelector('textarea')!.value, size, c.existing);
  }
}

export function initText(): void {
  board.onTextRequest = openText;
  $('textOk').onclick = () => closeText(true);
  $('textCancel').onclick = () => closeText(false);
  $('textEd').querySelector('textarea')!.addEventListener('keydown', (e) => {
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
}

/** Διάγνωση εισόδου: τι δείκτης αγγίζει, πόσο μεγάλη επαφή, και το όριο που ξεχωρίζει γραφίδα από παλάμη. */
export function initDiag(): void {
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
}

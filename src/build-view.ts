/**
 * Κυβάκια σε όλη την οθόνη: ο καμβάς του χτισίματος γεμίζει την οθόνη, η γραμμή εργαλείων φεύγει και μένει μόνο η σειρά
 * με τα υλικά. Στο τέλος της υπάρχει μια πόρτα που γυρίζει πίσω στον πίνακα.
 */

import type { Board } from './board';
import { STAMPS } from './stamps';

const COLS = 24, ROWS = 14;

export function openBuildView(board: Board, id: string, onFx: (ev: string) => void = () => {}): void {
  const d = STAMPS.build;
  let v = board.kidState(id);
  if (!v || !d.drawKid || !d.paint || document.getElementById('buildView')) return;

  const root = document.createElement('div');
  root.id = 'buildView';
  const cv = document.createElement('canvas');
  root.append(cv);
  document.body.append(root);
  document.body.classList.add('building');
  const c = cv.getContext('2d')!;

  /** Το πλέγμα πιάνει όσο πιο πολύ χωράει και μένει στη μέση· κάτω του μια σειρά για τα υλικά. */
  let W = 0, H = 0, gw = 0, ox = 0;
  const layout = (): void => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = root.clientWidth;
    H = root.clientHeight;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    const bar = Math.max(64, Math.min(120, H * 0.12));
    const s = Math.min(W / COLS, (H - bar) / ROWS);
    gw = s * COLS;
    ox = (W - gw) / 2;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  };
  const draw = (): void => {
    const gh = (gw / COLS) * ROWS;
    c.fillStyle = '#e0f2fe';
    c.fillRect(0, 0, W, gh);
    c.fillStyle = '#ffffff';
    c.fillRect(0, gh, W, H - gh);
    c.save();
    c.translate(ox, 0);
    c.fillStyle = '#111111';
    c.strokeStyle = '#111111';
    d.drawKid!(c, gw, H, v!, { ink: '#111111', bg: '#ffffff', full: true });
    c.restore();
  };

  const ptrs = new Map<number, Record<string, number>>();
  let dirty = false;
  const commit = (): void => {
    if (dirty) board.setKidState(id, v!);
    dirty = false;
  };
  const close = (): void => {
    commit();
    removeEventListener('resize', layout);
    removeEventListener('keydown', key, true);
    document.body.classList.remove('building');
    root.remove();
  };
  const key = (e: KeyboardEvent): void => {
    e.stopPropagation();
    if (e.key === 'Escape') close();
  };
  const at = (e: PointerEvent): [number, number] => {
    const r = cv.getBoundingClientRect();
    return [e.clientX - r.left - ox, e.clientY - r.top];
  };
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const [x, y] = at(e);
    if (d.fullAt?.(x, y, gw, H)) return close();
    cv.setPointerCapture(e.pointerId);
    const st: Record<string, number> = {};
    ptrs.set(e.pointerId, st);
    const next = d.paint!(v!, x, y, gw, H, st, true);
    if (next) {
      onFx(d.fx?.(v!, next) ?? 'click');
      v = next;
      dirty = true;
      draw();
    }
  });
  cv.addEventListener('pointermove', (e) => {
    const st = ptrs.get(e.pointerId);
    if (!st) return;
    const [x, y] = at(e);
    const next = d.paint!(v!, x, y, gw, H, st, false);
    if (next) {
      onFx(d.fx?.(v!, next) ?? 'click');
      v = next;
      dirty = true;
      draw();
    }
  });
  const up = (e: PointerEvent): void => {
    if (!ptrs.delete(e.pointerId)) return;
    // κάθε «πινελιά» αποθηκεύεται στη σελίδα μόλις σηκωθούν όλα τα δάχτυλα: έτσι αναιρείται και δεν χάνεται
    if (ptrs.size === 0) commit();
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  addEventListener('resize', layout);
  addEventListener('keydown', key, true);
  layout();
}

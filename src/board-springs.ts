/** Ταλάντωση ελατηρίων (μέθοδοι της Board, σε δικό τους αρχείο). */

import { StampItem, unrot } from './model';
import { STAMPS, SpringState } from './stamps';
import type { Board } from './board';

/** Περίοδος της ταλάντωσης των ελατηρίων και χρόνος απόσβεσης. */
const OSC_PERIOD_MS = 1600;
const OSC_FADE_MS = 5000;

export function springState(bd: Board, s: StampItem): SpringState {
  const marks = !!s.marks;
  if (bd.oscDrag?.id === s.id) return { d: bd.oscDrag.d, amp: Math.abs(bd.oscDrag.d), marks };
  const o = bd.osc.get(s.id);
  if (!o) return { d: 0, amp: 0, marks };
  const t = performance.now() - o.t0;
  // σχήματα με κίνηση (κύματα, κρούση): μόνο ο χρόνος
  if (STAMPS[s.name]?.play) return { d: 0, amp: 0, marks, t };
  const fade = s.damp ? Math.exp(-t / OSC_FADE_MS) : 1;
  return { d: o.amp * fade * Math.cos((2 * Math.PI * t) / OSC_PERIOD_MS), amp: Math.abs(o.amp), marks };
}

/** Το ελατήριο του οποίου το σώμα βρίσκεται κάτω από το σημείο. */
export function springAt(bd: Board, wx: number, wy: number): StampItem | null {
  const items = bd.page.items;
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.kind !== 'stamp') continue;
    const g = STAMPS[it.name]?.spring?.(it.w, it.h);
    if (!g) continue;
    const st = bd.springState(it);
    const [bx, by] = g.bob ? g.bob(st.d, !st.amp && !st.d) : [g.cx + g.ux * st.d, g.cy + g.uy * st.d];
    const [ux, uy] = unrot(it, wx, wy);
    if (Math.hypot(ux - (it.x + bx), uy - (it.y + by)) < g.r) return it;
  }
  return null;
}

export function runOsc(bd: Board): void {
  if (bd.oscRaf) return;
  const loop = (): void => {
    const now = performance.now();
    for (const [id, o] of bd.osc) {
      const it = bd.page.items.find((x) => x.id === id);
      // σβήνει όταν το πλάτος γίνει αμελητέο ή το ελατήριο διαγραφεί
      if (!it || it.kind !== 'stamp' || (it.damp && Math.abs(o.amp) * Math.exp(-(now - o.t0) / OSC_FADE_MS) < 0.7)) bd.osc.delete(id);
    }
    if (bd.osc.size) {
      bd.renderLive();
      bd.oscRaf = requestAnimationFrame(loop);
    } else {
      bd.oscRaf = 0;
      bd.redraw();
    }
  };
  bd.oscRaf = requestAnimationFrame(loop);
}

/** Το επιλεγμένο ελατήριο, αν η επιλογή είναι ελατήριο. */
export function selectedSpring(bd: Board): StampItem | null {
  const it = bd.selected ? bd.page.items.find((x) => x.id === bd.selected) : undefined;
  return it && it.kind === 'stamp' && (STAMPS[it.name]?.spring || STAMPS[it.name]?.play) ? it : null;
}

/** ▶/⏸ για το επιλεγμένο σχήμα με κίνηση (κύματα, κρούση, κυκλική κίνηση). */
export function togglePlay(bd: Board): void {
  const it = bd.selectedSpring;
  if (!it || !STAMPS[it.name]?.play) return;
  if (bd.osc.has(it.id)) bd.osc.delete(it.id);
  else {
    bd.osc.set(it.id, { amp: 1, t0: performance.now() });
    bd.runOsc();
  }
  bd.redraw();
  bd.onUi();
}

export function springMoving(bd: Board): boolean {
  return !!bd.selected && bd.osc.has(bd.selected);
}

/** Αλλάζει ιδιότητα του επιλεγμένου ελατηρίου (σημάνσεις, απόσβεση). */
export function updateSpring(bd: Board, patch: Partial<StampItem>): void {
  const before = bd.selectedSpring;
  if (!before) return;
  const after = { ...before, ...patch } as StampItem;
  bd.page.items[bd.page.items.indexOf(before)] = after;
  bd.push({ t: 'mod', p: bd.cur, before, after });
  bd.redraw();
}

/** Σταματά την ταλάντωση του επιλεγμένου ελατηρίου· το σώμα γυρίζει στη θέση ισορροπίας. */
export function stopSpring(bd: Board): void {
  if (bd.selected) bd.osc.delete(bd.selected);
  bd.redraw();
  bd.onUi();
}

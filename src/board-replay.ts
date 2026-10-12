/** Αναπαραγωγή της σελίδας βήμα βήμα (μέθοδοι της Board, σε δικό τους αρχείο). */


import type { Board } from './board';

/** Ξαναπαίζει τη σελίδα με τη σειρά που γράφτηκε. */
export function startReplay(bd: Board): void {
  if (bd.replay || bd.page.items.length === 0) return;
  bd.selected = null;
  bd.multi = [];
  bd.replay = { i: 0, prog: 0, wait: 0, paused: false };
  bd.onUi();
  const loop = (): void => {
    if (!bd.replay) return;
    if (!bd.replay.paused) bd.replayAdvance();
    if (!bd.replay) return;
    bd.redraw();
    bd.replayRaf = requestAnimationFrame(loop);
  };
  loop();
}

export function replayNext(bd: Board): void {
  const rp = bd.replay!;
  rp.i++;
  rp.prog = 0;
  rp.wait = 0;
  const items = bd.page.items;
  // οι εικόνες εμφανίζονται αμέσως
  while (rp.i < items.length && items[rp.i].kind === 'image') rp.i++;
  if (rp.i >= items.length) bd.stopReplay();
}

export function replayAdvance(bd: Board): void {
  const rp = bd.replay!;
  const it = bd.page.items[rp.i];
  if (!it) {
    bd.stopReplay();
    return;
  }
  if (it.kind === 'image') {
    bd.replayNext();
  } else if (it.kind === 'stroke' && rp.prog < it.pts.length) {
    let d = 0;
    while (rp.prog < it.pts.length && d < 16) {
      if (rp.prog > 0) d += Math.hypot(it.pts[rp.prog][0] - it.pts[rp.prog - 1][0], it.pts[rp.prog][1] - it.pts[rp.prog - 1][1]);
      rp.prog++;
    }
  } else if (++rp.wait > (it.kind === 'stroke' ? 5 : 22)) {
    bd.replayNext();
  }
}

export function toggleReplayPause(bd: Board): void {
  if (!bd.replay) return;
  bd.replay.paused = !bd.replay.paused;
  bd.onUi();
}

/** Ολοκληρώνει το τρέχον βήμα, πάει στο επόμενο και σταματά εκεί. */
export function replayStep(bd: Board): void {
  if (!bd.replay) return;
  bd.replay.paused = true;
  const it = bd.page.items[bd.replay.i];
  if (it && it.kind === 'stroke' && bd.replay.prog < it.pts.length) bd.replay.prog = it.pts.length;
  else bd.replayNext();
  if (bd.replay) {
    const nx = bd.page.items[bd.replay.i];
    if (nx && nx.kind === 'stroke') bd.replay.prog = nx.pts.length;
  }
  bd.onUi();
}

export function stopReplay(bd: Board): void {
  if (!bd.replay) return;
  cancelAnimationFrame(bd.replayRaf);
  bd.replay = null;
  bd.redraw();
  bd.onUi();
}

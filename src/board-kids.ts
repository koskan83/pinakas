/** Εργαλεία του Δημοτικού πάνω στον πίνακα: πάτημα, ζωγραφική και αλλαγή κατάστασης (μέθοδοι της Board, σε δικό τους αρχείο). */

import { Item, Pt, StampItem, unrot } from './model';
import { STAMPS, stampTexts, type KidArea } from './stamps';
import type { Board, PState } from './board';

/** Η κατάσταση ενός εργαλείου άλλαξε (ή μια επιβράβευση μόλις μπήκε): ήχος, και κίνηση για όσο κρατά. */
export function kidChanged(bd: Board, it: StampItem, prev: number[], ev?: string): void {
  const d = STAMPS[it.name];
  const what = ev ?? (d?.fx ? d.fx(prev, it.v ?? []) : 'click');
  if (what) bd.onKidFx(what, it);
  if (!bd.kidMotion) return;
  const idle = bd.kidAnim.size === 0;
  bd.kidAnim.set(it.id, { t0: performance.now(), prev, ms: d?.animMs ?? 1500 });
  if (!idle) return;
  const tick = (): void => {
    const now = performance.now();
    for (const [id, a] of bd.kidAnim) if (now - a.t0 > a.ms) bd.kidAnim.delete(id);
    bd.redraw();
    if (bd.kidAnim.size) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Η κατάσταση ενός εργαλείου του Δημοτικού, ή null αν δεν υπάρχει στη σελίδα. */
export function kidState(bd: Board, id: string): number[] | null {
  const it = bd.page.items.find((x) => x.id === id);
  return it && it.kind === 'stamp' ? it.v ?? STAMPS[it.name]?.init ?? [] : null;
}

/** Αλλάζει την κατάσταση ενός εργαλείου του Δημοτικού (με αναίρεση). */
export function setKidState(bd: Board, id: string, v: number[]): void {
  const i = bd.page.items.findIndex((x) => x.id === id);
  const before = bd.page.items[i];
  if (!before || before.kind !== 'stamp') return;
  const after: StampItem = { ...before, v };
  bd.page.items[i] = after;
  bd.push({ t: 'mod', p: bd.cur, before, after });
  bd.redraw();
}

/** Σύρσιμο πάνω σε εργαλείο του Δημοτικού που «ζωγραφίζεται» (κυβάκια, δείκτες ρολογιού). false αν το σημείο δεν το αφορά. */
export function kidPaint(bd: Board, ps: PState, it: StampItem, wx: number, wy: number, first: boolean): boolean {
  const d = STAMPS[it.name];
  if (!d?.paint) return false;
  if (first) ps.kid = {};
  const [lx, ly] = unrot(it, wx, wy);
  if (first && d.fullAt?.(lx - it.x, ly - it.y, it.w, it.h)) {
    bd.onKidFull(it);
    return true;
  }
  const v = d.paint(it.v ?? d.init ?? [], lx - it.x, ly - it.y, it.w, it.h, ps.kid!, first);
  if (!v) return false;
  const next = { ...it, v };
  bd.page.items[bd.page.items.indexOf(it)] = next;
  // εργαλείο με δική του κίνηση (αριθμοκυβάκια: αξεσουάρ που πέφτει): κινείται από το πάτημα
  if (first && d.animMs) {
    bd.kidChanged(next, it.v ?? d.init ?? []);
    return true;
  }
  const ev = d.fx ? d.fx(it.v ?? d.init ?? [], v) : null;
  if (ev) bd.onKidFx(ev, it);
  return true;
}

/**
 * Πάτημα στο σημείο `at` ενός εργαλείου του Δημοτικού. true αν έπεσε σε κουμπί του (και έγινε ό,τι κάνει το κουμπί).
 */
export function pressKid(bd: Board, it: StampItem, at: Pt): boolean {
  const d = STAMPS[it.name];
  if (!d?.kid) return false;
  const [lx, ly] = unrot(it, at[0], at[1]);
  const cur = it.v ?? d.init ?? [];
  const apply = (v: number[]): void => {
    const before = bd.page.items.find((x) => x.id === it.id);
    if (!before || before.kind !== 'stamp') return;
    const next: StampItem = { ...before, v };
    bd.page.items[bd.page.items.indexOf(before)] = next;
    bd.push({ t: 'mod', p: bd.cur, before, after: next });
    bd.kidChanged(next, before.v ?? d.init ?? []);
    bd.redraw();
  };
  const q = d.ask?.(cur, lx - it.x, ly - it.y, it.w, it.h);
  if (q) {
    const page = bd.cur;
    const inArea = (a: KidArea): string[] => bd.strokesIn({ x0: it.x + a.x, y0: it.y + a.y, x1: it.x + a.x + a.w, y1: it.y + a.y + a.h });
    if (q.area && q.mode === 'clear') {
      bd.deleteItems(inArea(q.area));
      const v = q.apply('');
      if (v) apply(v);
    } else {
      void (q.area ? bd.onRead(inArea(q.area)) : bd.onAsk(q)).then((text) => {
        const v = text == null || page !== bd.cur ? null : q.apply(text);
        if (!v) return;
        if (q.then) bd.deleteItems(inArea(q.then.area));
        apply(v);
      });
    }
  } else {
    const v = d.tap?.(cur, lx - it.x, ly - it.y, it.w, it.h, { names: bd.kidNames() });
    if (!v) return false;
    apply(v);
  }
  // πάτημα σε κουμπί του εργαλείου (γράμμα, +, κομμάτι κλάσματος) δεν το επιλέγει: αλλιώς η μπάρα «Διαγραφή / ×2» πέφτει πάνω στο παιχνίδι
  bd.selected = null;
  bd.onUi();
  return true;
}

/** true αν ήταν πάτημα πάνω σε εργαλείο του Δημοτικού (και όχι μετακίνησή του)· τότε εφαρμόζει ό,τι κάνει το πάτημα. */
export function tapKid(bd: Board, before: StampItem, after: Item, at: Pt): boolean {
  const d = STAMPS[before.name];
  if (!d?.kid || (!d.tap && !d.ask) || after.kind !== 'stamp') return false;
  if (Math.hypot(after.x - before.x, after.y - before.y) > 8 / bd.page.view.k) return false;
  // ακόμα κι αν το πάτημα δεν έπεσε σε κουμπί, το εργαλείο δεν μετακινείται από ένα απλό άγγιγμα
  bd.pressKid(before, at);
  return true;
}

/**
 * Δεύτερο πάτημα (χωρίς σύρσιμο) πάνω σε γράμμα ενός σχήματος Φυσικής (φ, m, θ…): ρωτά τι να γράφει στη θέση του,
 * π.χ. μοίρες αντί για φ· κενό το σβήνει. true αν το πάτημα έπεσε σε γράμμα.
 */
export function tapStampText(bd: Board, before: StampItem, after: Item, at: Pt): boolean {
  const d = STAMPS[before.name];
  if (!d || d.kid || after.kind !== 'stamp') return false;
  const k = bd.page.view.k;
  if (Math.hypot(after.x - before.x, after.y - before.y) > 8 / k) return false;
  const [lx, ly] = unrot(before, at[0], at[1]);
  const x = lx - before.x, y = ly - before.y;
  const lab = stampTexts(d, before.w, before.h).find((l) => Math.hypot(l.x - x, l.y - y) < Math.max(l.size * 0.8, 26 / k));
  if (!lab) return false;
  const angle = /^[φθωα-δ]$/.test(lab.t);
  const page = bd.cur, id = before.id;
  const now = before.txt?.[lab.t] ?? lab.t;
  void bd.onAsk({
    title: `Τι να γράφει στη θέση του «${lab.t}»;`,
    hint: angle ? 'Γράψε τις μοίρες (το ° μπαίνει μόνο του)· άδειο, για να σβηστεί.' : 'Άδειο, για να σβηστεί.',
    value: now,
    picks: angle ? [lab.t, '30°', '37°', '45°', '53°', '60°'] : [lab.t],
    max: 12,
    apply: () => null,
  }).then((text) => {
    if (text == null || page !== bd.cur) return;
    const cur = bd.page.items.find((x) => x.id === id);
    if (!cur || cur.kind !== 'stamp') return;
    let t = text.trim();
    if (angle && /^\d+([.,]\d+)?$/.test(t)) t += '°';
    const txt = { ...cur.txt };
    if (t === lab.t) delete txt[lab.t];
    else txt[lab.t] = t;
    const next: StampItem = { ...cur, txt: Object.keys(txt).length ? txt : undefined };
    bd.page.items[bd.page.items.indexOf(cur)] = next;
    bd.push({ t: 'mod', p: bd.cur, before: cur, after: next });
    bd.redraw();
    bd.onUi();
  });
  return true;
}

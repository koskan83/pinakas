/** Πράξεις πάνω στην επιλογή: εικόνα περιοχής, μέγεθος, καθρέφτης, συνισταμένη, διαγραφή (μέθοδοι της Board, σε δικό τους αρχείο). */

import { Item, Pt, Shape, angleEnds, cloneItem, flipItem, isDark, itemBounds, scaleItem, translateItem, uid } from './model';
import type { Board, Box } from './board';

/** Εικόνα PNG όλων όσων φαίνονται μέσα στην κυκλωμένη περιοχή, για αποστολή στο AI. */
export async function regionImage(bd: Board): Promise<{ blob: Blob; box: Box; color: string } | null> {
  const b = bd.region;
  if (!b) return null;
  const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
  const s = Math.min(3, 1600 / Math.max(bw, bh));
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(bw * s));
  cv.height = Math.max(1, Math.round(bh * s));
  const c = cv.getContext('2d')!;
  c.fillStyle = isDark(bd.doc.bg) ? '#14201b' : '#ffffff';
  c.fillRect(0, 0, cv.width, cv.height);
  c.setTransform(s, 0, 0, s, -b.x0 * s, -b.y0 * s);
  for (const it of bd.page.items) {
    const ib = itemBounds(it);
    if (ib.x0 < b.x1 && ib.x1 > b.x0 && ib.y0 < b.y1 && ib.y1 > b.y0) bd.r.drawItem(c, it);
  }
  const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, 'image/png'));
  return blob ? { blob, box: b, color: bd.color } : null;
}

/** Εικόνα PNG των στοιχείων με τα δοσμένα id, για αποστολή σε αναγνώριση. */
export async function inkImage(bd: Board, ids: string[]): Promise<{ blob: Blob; box: Box; color: string } | null> {
  const set = new Set(ids);
  const items = bd.page.items.filter((it) => set.has(it.id));
  if (items.length === 0) return null;
  let box: Box | null = null;
  for (const it of items) {
    const b = itemBounds(it);
    box = box ? { x0: Math.min(box.x0, b.x0), y0: Math.min(box.y0, b.y0), x1: Math.max(box.x1, b.x1), y1: Math.max(box.y1, b.y1) } : b;
  }
  const b = box!;
  const pad = 18;
  const bw = b.x1 - b.x0 + pad * 2, bh = b.y1 - b.y0 + pad * 2;
  const s = Math.min(3, 1400 / Math.max(bw, bh));
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(bw * s));
  cv.height = Math.max(1, Math.round(bh * s));
  const c = cv.getContext('2d')!;
  c.fillStyle = isDark(bd.doc.bg) ? '#14201b' : '#ffffff';
  c.fillRect(0, 0, cv.width, cv.height);
  c.setTransform(s, 0, 0, s, (pad - b.x0) * s, (pad - b.y0) * s);
  for (const it of items) bd.r.drawItem(c, it);
  const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, 'image/png'));
  const first = items[0];
  return blob ? { blob, box: b, color: 'color' in first ? first.color : bd.color } : null;
}

/** Αντικαθιστά τα στοιχεία με τα δοσμένα id από ένα νέο (αναιρείται με ένα ↶). */
export function replaceItems(bd: Board, ids: string[], item: Item): boolean {
  const set = new Set(ids);
  const before = bd.page.items.slice();
  const rest = before.filter((it) => !set.has(it.id));
  if (rest.length === before.length) return false;
  rest.push(item);
  bd.page.items = rest;
  bd.selected = null;
  bd.multi = [];
  bd.push({ t: 'set', p: bd.cur, before, after: rest.slice() });
  bd.redraw();
  return true;
}

export function groupBounds(bd: Board): Box | null {
  const ids = new Set(bd.multi);
  let b: Box | null = null;
  for (const it of bd.page.items) {
    if (!ids.has(it.id)) continue;
    const ib = itemBounds(it);
    b = b ? { x0: Math.min(b.x0, ib.x0), y0: Math.min(b.y0, ib.y0), x1: Math.max(b.x1, ib.x1), y1: Math.max(b.y1, ib.y1) } : ib;
  }
  return b;
}

/** Αντίγραφο της επιλογής, λίγο πιο κάτω-δεξιά. */
export function duplicateSelected(bd: Board): void {
  const ids = bd.selectedIds();
  if (ids.size === 0) return;
  const before = bd.page.items.slice();
  const copies = before.filter((it) => ids.has(it.id)).map((it) => translateItem(cloneItem(it), 30, 30));
  bd.page.items.push(...copies);
  bd.selected = copies.length === 1 ? copies[0].id : null;
  bd.multi = copies.length > 1 ? copies.map((c) => c.id) : [];
  bd.push({ t: 'set', p: bd.cur, before, after: bd.page.items.slice() });
  bd.redraw();
}

/** Το πλαίσιο όλων των επιλεγμένων στοιχείων (ένα ή πολλά). */
function selBounds(bd: Board, ids: Set<string>): Box | null {
  let b: Box | null = null;
  for (const it of bd.page.items) {
    if (!ids.has(it.id)) continue;
    const ib = itemBounds(it);
    b = b ? { x0: Math.min(b.x0, ib.x0), y0: Math.min(b.y0, ib.y0), x1: Math.max(b.x1, ib.x1), y1: Math.max(b.y1, ib.y1) } : ib;
  }
  return b;
}

/** Εφαρμόζει μια αλλαγή σε όλα τα επιλεγμένα στοιχεία (αναιρείται με ένα ↶). */
function mapSelected(bd: Board, f: (it: Item, b: Box) => Item): void {
  const ids = bd.selectedIds();
  const b = selBounds(bd, ids);
  if (!b) return;
  const before = bd.page.items.slice();
  bd.page.items = before.map((it) => (ids.has(it.id) ? f(it, b) : it));
  bd.pivot = null;
  bd.push({ t: 'set', p: bd.cur, before, after: bd.page.items.slice() });
  bd.redraw();
  bd.onUi();
}

/** Μεγαλώνει (f > 1) ή μικραίνει την επιλογή γύρω από το κέντρο της· και τα γράμματα των κειμένων. */
export function scaleSelected(bd: Board, f: number): void {
  const b = selBounds(bd, bd.selectedIds());
  if (!b) return;
  const size = Math.max(b.x1 - b.x0, b.y1 - b.y0);
  // ούτε να χαθεί ούτε να γίνει τεράστια
  if ((f < 1 && size * f < 16) || (f > 1 && size * f > 20000)) return;
  mapSelected(bd, (it) => scaleItem(it, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, f));
}

/** Κατοπτρική εικόνα της επιλογής, αριστερά–δεξιά ή (vertical) πάνω–κάτω, στη θέση της. */
export function flipSelected(bd: Board, vertical: boolean): void {
  mapSelected(bd, (it, b) => flipItem(it, vertical, vertical ? (b.y0 + b.y1) / 2 : (b.x0 + b.x1) / 2));
}

/** Κοινή αρχή O και άκρα A, B των δύο πλευρών από τις οποίες βγαίνει μια συνισταμένη. */
function linkGeom(bd: Board, aId: string, bId: string): { o: Pt; a: Pt; b: Pt; color: string; width: number } | null {
  const items = bd.page.items;
  const a = items.find((x) => x.id === aId), b = items.find((x) => x.id === bId);
  if (a && a.kind === 'angle') {
    const [p1, p2] = angleEnds(a);
    return { o: [a.x, a.y], a: p1, b: p2, color: a.color, width: a.width };
  }
  const ok = (q: Item | undefined): q is Shape => !!q && q.kind === 'shape' && (q.shape === 'arrow' || q.shape === 'line');
  if (!ok(a) || !ok(b)) return null;
  // ένα βέλος ξεκινά πάντα από την αρχή του· μια ευθεία μπορεί να «γυρίσει», όποιο άκρο της είναι πιο κοντά στο άλλο
  const ends = (q: Shape): [Pt, Pt][] => (q.shape === 'line' ? [[[q.x0, q.y0], [q.x1, q.y1]], [[q.x1, q.y1], [q.x0, q.y0]]] : [[[q.x0, q.y0], [q.x1, q.y1]]]);
  let best: { d: number; p: [Pt, Pt]; q: [Pt, Pt] } | null = null;
  for (const p of ends(a)) for (const q of ends(b)) {
    const d = Math.hypot(p[0][0] - q[0][0], p[0][1] - q[0][1]);
    if (!best || d < best.d) best = { d, p, q };
  }
  const { p, q } = best!;
  // το δεύτερο μεταφέρεται παράλληλα ώστε να ξεκινά από την αρχή του πρώτου
  return { o: p[0], a: p[1], b: [q[1][0] + p[0][0] - q[0][0], q[1][1] + p[0][1] - q[0][1]], color: a.color, width: a.width };
}

/**
 * Από τι μπορεί να βγει συνισταμένη με την τωρινή επιλογή: μια γωνία, δύο βέλη/ευθείες με κοινή κορυφή,
 * ή ένα βέλος/ευθεία που «κούμπωσε» στην αρχή άλλου. Επιστρέφει τα id των δύο πλευρών.
 */
export function resultantSource(bd: Board): [string, string] | null {
  const items = bd.page.items;
  const ok = (q: Item | undefined): q is Shape => !!q && q.kind === 'shape' && (q.shape === 'arrow' || q.shape === 'line') && !q.dash && !q.link;
  if (bd.multi.length === 2) {
    const [a, b] = bd.multi.map((id) => items.find((x) => x.id === id));
    if (!ok(a) || !ok(b)) return null;
    const pts = (q: Shape): Pt[] => (q.shape === 'line' ? [[q.x0, q.y0], [q.x1, q.y1]] : [[q.x0, q.y0]]);
    const common = pts(a).some((p) => pts(b).some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 16));
    return common ? [a.id, b.id] : null;
  }
  const sel = bd.selected ? items.find((x) => x.id === bd.selected) : undefined;
  if (!sel) return null;
  if (sel.kind === 'angle') return [sel.id, sel.id];
  if (!ok(sel)) return null;
  const mate = items.find((x) => x.id === sel.angleWith) ?? items.find((x) => ok(x) && x.angleWith === sel.id);
  return ok(mate) ? [mate.id, sel.id] : null;
}

/** Σχεδιάζει το παραλληλόγραμμο και τη συνισταμένη· και τα τρία μένουν δεμένα με τις δύο πλευρές. */
export function addResultant(bd: Board): void {
  const src = bd.resultantSource;
  const g = src && linkGeom(bd, src[0], src[1]);
  if (!src || !g) return;
  const [a, b] = src;
  // υπάρχει ήδη συνισταμένη για αυτές τις πλευρές: απλώς την επιλέγουμε
  const have = bd.page.items.find((x) => x.kind === 'shape' && x.link?.role === 'sum' && [x.link.a, x.link.b].sort().join() === [a, b].sort().join());
  if (have) {
    bd.selected = have.id;
    bd.multi = [];
    bd.redraw();
    bd.onUi();
    return;
  }
  const before = bd.page.items.slice();
  const base = { kind: 'shape' as const, x0: 0, y0: 0, x1: 0, y1: 0 };
  const side = (role: 'sideA' | 'sideB'): Shape => ({
    ...base, id: uid(), shape: 'line', color: g.color, width: Math.max(1.5, g.width / 2), dash: true, link: { a, b, role },
  });
  const color = g.color === '#e11d48' || g.color === '#fb7185' ? '#2563eb' : isDark(bd.doc.bg) ? '#fb7185' : '#e11d48';
  const sum: Shape = {
    ...base, id: uid(), shape: 'arrow', color, width: g.width, link: { a, b, role: 'sum' },
    angleWith: bd.page.items.find((x) => x.id === a)?.kind === 'shape' ? a : undefined,
  };
  bd.page.items.push(side('sideA'), side('sideB'), sum);
  bd.selected = sum.id;
  bd.multi = [];
  bd.push({ t: 'set', p: bd.cur, before, after: bd.page.items.slice() });
  bd.redraw();
}

/**
 * Φέρνει τις συνισταμένες και τα παραλληλόγραμμά τους στη θέση που ορίζουν οι πλευρές τους.
 * Αν μια πλευρά έχει σβηστεί, η συνισταμένη μένει όπως είναι, ελεύθερη.
 */
export function syncLinks(bd: Board): boolean {
  const items = bd.page.items;
  let changed = false;
  items.forEach((it, i) => {
    if (it.kind !== 'shape' || !it.link) return;
    const g = linkGeom(bd, it.link.a, it.link.b);
    if (!g) {
      const { link: _drop, ...free } = it;
      items[i] = free;
      changed = true;
      return;
    }
    const r: Pt = [g.a[0] + g.b[0] - g.o[0], g.a[1] + g.b[1] - g.o[1]];
    const from = it.link.role === 'sum' ? g.o : it.link.role === 'sideA' ? g.a : g.b;
    if (Math.hypot(it.x0 - from[0], it.y0 - from[1]) + Math.hypot(it.x1 - r[0], it.y1 - r[1]) < 1e-6) return;
    items[i] = { ...it, x0: from[0], y0: from[1], x1: r[0], y1: r[1] };
    changed = true;
  });
  return changed;
}

export function deleteSelected(bd: Board): void {
  if (bd.multi.length) {
    const ids = new Set(bd.multi);
    const before = bd.page.items.slice();
    bd.page.items = before.filter((it) => !ids.has(it.id));
    bd.multi = [];
    bd.push({ t: 'set', p: bd.cur, before, after: bd.page.items.slice() });
    bd.redraw();
    return;
  }
  if (!bd.selected) return;
  const items = bd.page.items;
  const i = items.findIndex((x) => x.id === bd.selected);
  if (i < 0) return;
  const [item] = items.splice(i, 1);
  bd.selected = null;
  bd.multi = [];
  bd.push({ t: 'del', p: bd.cur, items: [{ item, i }] });
  bd.redraw();
}

/** Μετρήσεις πάνω στα σχήματα: μήκη, γωνίες, εμβαδόν, περίμετρος (μέθοδοι της Board, σε δικό τους αρχείο). */

import { AngleItem, MeasOpts, Pt, Shape, ShapeKind, angleEnds, distToSeg, hitItem, isPoly, itemBounds, pointInPolygon, trianglePts, uid, unrot } from './model';
import { CM } from './gadgets';
import { ANGLE_KEY, angleSides, fmt, measureAngles, measureSides, sideLen, sideText, unitsFor } from './measure';
import type { Board } from './board';

/** Η μέτρηση πλευράς που βρίσκεται κάτω από το σημείο της οθόνης, αν φαίνονται οι μετρήσεις. */
export function measureAt(bd: Board, sx: number, sy: number): { id: string; side: number; text: string; x: number; y: number } | null {
  const [px, py] = bd.toWorld(sx, sy);
  const k = bd.page.view.k;
  const items = bd.page.items;
  for (let n = items.length - 1; n >= 0; n--) {
    const it = items[n];
    if (it.kind === 'angle' && it.meas?.len) {
      for (const m of angleSides(it)) {
        if (Math.abs(px - m.pos[0]) < Math.max(34, 26 / k) && Math.abs(py - m.pos[1]) < Math.max(18, 20 / k)) {
          return { id: it.id, side: m.i, text: it.labels?.[m.i] ?? fmt(m.len / CM), x: sx, y: sy };
        }
      }
    }
    if (it.kind !== 'shape' || !it.meas) continue;
    const [wx, wy] = unrot(it, px, py);
    const near = (p: Pt): boolean => Math.abs(wx - p[0]) < Math.max(34, 26 / k) && Math.abs(wy - p[1]) < Math.max(18, 20 / k);
    if (it.meas.len) for (const m of measureSides(it)) {
      if (near(m.pos)) return { id: it.id, side: m.i, text: it.labels?.[m.i] ?? sideText(m, unitsFor(items, it), it.shape === 'line' || it.shape === 'arrow').split('   ')[0], x: sx, y: sy };
    }
    if (it.meas.ang) for (const m of measureAngles(it)) {
      if (near(m.pos)) return { id: it.id, side: ANGLE_KEY + m.i, text: it.labels?.[ANGLE_KEY + m.i] ?? String(m.deg), x: sx, y: sy };
    }
  }
  return null;
}

/** Όλα τα ευθύγραμμα τμήματα της σελίδας: ευθείες, βέλη, πλευρές τριγώνων, ορθογωνίων και γωνιών. */
export function segments(bd: Board): [Pt, Pt][] {
  const out: [Pt, Pt][] = [];
  const ring = (p: Pt[]): void => p.forEach((q, i) => out.push([q, p[(i + 1) % p.length]]));
  for (const it of bd.page.items) {
    if (it.kind === 'angle' && !it.arc) {
      const [p1, p2] = angleEnds(it);
      out.push([[it.x, it.y], p1], [[it.x, it.y], p2]);
    } else if (it.kind === 'shape') {
      if (it.shape === 'line' || it.shape === 'arrow') out.push([[it.x0, it.y0], [it.x1, it.y1]]);
      else if (isPoly(it.shape)) ring(trianglePts(it));
      else if (it.shape === 'rect') {
        const mx = (it.x0 + it.x1) / 2, my = (it.y0 + it.y1) / 2, cs = Math.cos(it.rot ?? 0), sn = Math.sin(it.rot ?? 0);
        ring(([[it.x0, it.y0], [it.x1, it.y0], [it.x1, it.y1], [it.x0, it.y1]] as Pt[]).map(([x, y]) => [mx + (x - mx) * cs - (y - my) * sn, my + (x - mx) * sn + (y - my) * cs]));
      }
    }
  }
  return out;
}

/**
 * Η γωνία μέσα στην οποία βρίσκεται το σημείο: ανάμεσα σε δύο γειτονικά τμήματα που ξεκινούν από κοινή κορυφή
 * (ή τέμνονται εκεί). Επιστρέφει έτοιμο «τόξο με μοίρες», ή null αν το σημείο δεν είναι μέσα σε γωνία.
 */
export function angleAround(bd: Board, wx: number, wy: number): AngleItem | null {
  const segs = bd.segments().filter(([p, q]) => Math.hypot(q[0] - p[0], q[1] - p[1]) > 10);
  // ανοχή: γραμμές τραβηγμένες με το χέρι σπάνια ακουμπάνε ακριβώς στην κορυφή
  const SNAP = Math.max(26, 26 / bd.page.view.k);
  // υποψήφιες κορυφές: τα σημεία όπου δύο τμήματα συναντιούνται ή διασταυρώνονται (και λίγο έξω από τα άκρα τους)
  const verts: Pt[] = [];
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const [p, q] = segs[i], [r, t] = segs[j];
    const d1x = q[0] - p[0], d1y = q[1] - p[1], d2x = t[0] - r[0], d2y = t[1] - r[1];
    const l1 = Math.hypot(d1x, d1y), l2 = Math.hypot(d2x, d2y);
    const cross = d1x * d2y - d1y * d2x;
    if (Math.abs(cross) < 0.03 * l1 * l2) continue;
    // δύο άκρα πολύ κοντά το ένα στο άλλο μετράνε ως κοινή κορυφή, ακόμα κι αν οι προεκτάσεις τέμνονται πιο μακριά
    let joined = false;
    for (const e1 of [p, q]) for (const e2 of [r, t]) {
      if (!joined && Math.hypot(e1[0] - e2[0], e1[1] - e2[1]) < SNAP * 1.5) {
        const mid: Pt = [(e1[0] + e2[0]) / 2, (e1[1] + e2[1]) / 2];
        if (!verts.some((v) => Math.hypot(v[0] - mid[0], v[1] - mid[1]) < 3)) verts.push(mid);
        joined = true;
      }
    }
    if (joined) continue;
    const u = ((r[0] - p[0]) * d2y - (r[1] - p[1]) * d2x) / cross;
    const w = ((r[0] - p[0]) * d1y - (r[1] - p[1]) * d1x) / cross;
    if (u * l1 < -SNAP || u * l1 > l1 + SNAP || w * l2 < -SNAP || w * l2 > l2 + SNAP) continue;
    const x: Pt = [p[0] + d1x * u, p[1] + d1y * u];
    if (!verts.some((v) => Math.hypot(v[0] - x[0], v[1] - x[1]) < 3)) verts.push(x);
  }
  let best: { d: number; v: Pt; a1: number; a2: number; len: number } | null = null;
  for (const v of verts) {
    const d = Math.hypot(wx - v[0], wy - v[1]);
    if (d < 6 || (best && d >= best.d)) continue;
    // ακτίνες που φεύγουν από την κορυφή v: προς κάθε άκρο τμήματος που περνά από εκεί
    const rays: { a: number; len: number }[] = [];
    const add = (to: Pt): void => {
      const len = Math.hypot(to[0] - v[0], to[1] - v[1]);
      if (len < SNAP * 1.2) return;
      const a = Math.atan2(to[1] - v[1], to[0] - v[0]);
      const same = rays.find((r) => Math.abs(Math.atan2(Math.sin(r.a - a), Math.cos(r.a - a))) < 0.03);
      if (same) same.len = Math.max(same.len, len);
      else rays.push({ a, len });
    };
    for (const [p, q] of segs) {
      if (distToSeg(v[0], v[1], p, q) > SNAP) continue;
      add(p);
      add(q);
    }
    if (rays.length < 2) continue;
    rays.sort((r, s) => r.a - s.a);
    const th = Math.atan2(wy - v[1], wx - v[0]);
    // το ζευγάρι γειτονικών ακτίνων που έχει ανάμεσά του την κατεύθυνση προς το σημείο
    let i = rays.findIndex((r) => r.a > th);
    if (i < 0) i = 0;
    const hi = rays[i], lo = rays[(i + rays.length - 1) % rays.length];
    const span = (((hi.a - lo.a) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    if (span < 0.02 || span > Math.PI + 1e-6) continue;
    if (d > Math.max(lo.len, hi.len) + 20) continue;
    best = { d, v, a1: lo.a, a2: hi.a, len: Math.min(lo.len, hi.len) };
  }
  if (!best) return null;
  // το μήκος ορίζει μόνο την ακτίνα του τόξου (βλ. drawAngleMark)
  // κάθε επόμενη γωνία στην ίδια κορυφή παίρνει μεγαλύτερο τόξο, για να μην πέφτουν οι μοίρες η μία πάνω στην άλλη
  const v = best.v;
  const mid = best.a1 + ((((best.a2 - best.a1) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / 2;
  const here = bd.page.items.filter((x) => {
    if (x.kind !== 'angle' || Math.hypot(x.x - v[0], x.y - v[1]) >= SNAP) return false;
    // μόνο όσες γωνίες «πατάνε» στο ίδιο άνοιγμα (π.χ. η μεγάλη γωνία γύρω από μια μικρότερη)
    const half = Math.abs(Math.atan2(Math.sin(x.a2 - x.a1), Math.cos(x.a2 - x.a1))) / 2;
    const xm = x.a1 + Math.atan2(Math.sin(x.a2 - x.a1), Math.cos(x.a2 - x.a1)) / 2;
    return Math.abs(Math.atan2(Math.sin(mid - xm), Math.cos(mid - xm))) < half + 0.02;
  }).length;
  const len = (Math.max(18, Math.min(46, best.len * 0.4)) + 34 * here) / 0.4;
  return { kind: 'angle', id: uid(), x: best.v[0], y: best.v[1], a1: best.a1, a2: best.a2, len1: len, len2: len, color: bd.color, width: 3, arc: true };
}

/** Το σχήμα κάτω από το σημείο της οθόνης (και το εσωτερικό του μετράει), με τη θέση της πάνω άκρης του. */
export function shapeAt(bd: Board, sx: number, sy: number): { id: string; shape: ShapeKind | 'angle'; meas: MeasOpts; x: number; y: number } | null {
  const [px, py] = bd.toWorld(sx, sy);
  const r = 14 / bd.page.view.k;
  const items = bd.page.items;
  for (let n = items.length - 1; n >= 0; n--) {
    const it = items[n];
    if (it.kind === 'angle' && !it.arc && hitItem(it, px, py, r)) {
      const ab = itemBounds(it);
      const [x, y] = bd.toScreen((ab.x0 + ab.x1) / 2, ab.y0);
      return { id: it.id, shape: 'angle', meas: it.meas ?? {}, x, y };
    }
    if (it.kind !== 'shape' || it.dash || it.shape === 'table') continue;
    const [wx, wy] = unrot(it, px, py);
    const b = { x0: Math.min(it.x0, it.x1), y0: Math.min(it.y0, it.y1), x1: Math.max(it.x0, it.x1), y1: Math.max(it.y0, it.y1) };
    let hit = hitItem(it, px, py, r);
    if (!hit && it.shape === 'rect') hit = wx >= b.x0 && wx <= b.x1 && wy >= b.y0 && wy <= b.y1;
    if (!hit && isPoly(it.shape)) hit = pointInPolygon(wx, wy, trianglePts(it));
    if (!hit && it.shape === 'ellipse') {
      const a = Math.max((b.x1 - b.x0) / 2, 0.5), h = Math.max((b.y1 - b.y0) / 2, 0.5);
      hit = Math.hypot((wx - (b.x0 + b.x1) / 2) / a, (wy - (b.y0 + b.y1) / 2) / h) <= 1;
    }
    if (!hit) continue;
    const ib = itemBounds(it);
    const [x, y] = bd.toScreen((ib.x0 + ib.x1) / 2, ib.y0);
    return { id: it.id, shape: it.shape, meas: it.meas ?? {}, x, y };
  }
  return null;
}

/** Ορίζει ποιες μετρήσεις φαίνονται σε ένα σχήμα· όταν δεν μένει καμία, το σχήμα μένει σκέτο. */
export function setMeas(bd: Board, id: string, meas: MeasOpts): void {
  const i = bd.page.items.findIndex((x) => x.id === id);
  const before = bd.page.items[i];
  if (!before || (before.kind !== 'shape' && before.kind !== 'angle')) return;
  const after: Shape | AngleItem = { ...before, meas };
  if (!meas.len && !meas.ang && !meas.area && !meas.per) delete after.meas;
  bd.page.items[i] = after;
  bd.push({ t: 'mod', p: bd.cur, before, after });
  bd.redraw();
}

/**
 * Ορίζει τη μέτρηση μιας πλευράς: σκέτος αριθμός αλλάζει το μήκος της (σε cm),
 * οτιδήποτε άλλο γίνεται ετικέτα, και το κενό επαναφέρει την πραγματική μέτρηση.
 */
export function setMeasure(bd: Board, id: string, sideIndex: number, value: string): void {
  const idx = bd.page.items.findIndex((x) => x.id === id);
  const ang = bd.page.items[idx];
  if (ang && ang.kind === 'angle') {
    // πλευρά γωνίας: αριθμός = νέο μήκος σε cm, κείμενο = ετικέτα, κενό = η πραγματική μέτρηση
    const labels = { ...ang.labels };
    delete labels[sideIndex];
    const next: AngleItem = { ...ang, labels };
    const t = value.trim();
    if (/^\d+([.,]\d+)?$/.test(t)) {
      const len = parseFloat(t.replace(',', '.')) * CM;
      if (!(len > 0)) return;
      if (sideIndex) next.len2 = len; else next.len1 = len;
    } else if (t) labels[sideIndex] = t.slice(0, 16);
    if (Object.keys(labels).length === 0) delete next.labels;
    bd.page.items[idx] = next;
    bd.push({ t: 'mod', p: bd.cur, before: ang, after: next });
    bd.redraw();
    return;
  }
  const before = bd.page.items[idx];
  if (!before || before.kind !== 'shape') return;
  const labels = { ...before.labels };
  delete labels[sideIndex];
  let after: Shape = { ...before, labels };
  const v = value.trim();
  if (sideIndex >= ANGLE_KEY) {
    // γωνία τριγώνου: η κορυφή και η μία πλευρά μένουν, η άλλη πλευρά στρέφεται γύρω από την κορυφή
    const i = sideIndex - ANGLE_KEY;
    const num = /^(\d+([.,]\d+)?)\s*°?$/.exec(v);
    if (!isPoly(before.shape)) return;
    if (num && before.shape !== 'triangle') {
      // ρόμβος ή παραλληλόγραμμο: οι πλευρές κρατούν το μήκος τους, αλλάζει η κλίση (και μαζί οι άλλες τρεις γωνίες)
      const want = (parseFloat(num[1].replace(',', '.')) * Math.PI) / 180;
      if (!(want > 0.02 && want < Math.PI - 0.02)) return;
      const pts = trianglePts(before).map((q): Pt => [q[0], q[1]]);
      const p = pts[i], q = pts[(i + 1) % 4], o = pts[(i + 3) % 4];
      const aq = Math.atan2(q[1] - p[1], q[0] - p[0]);
      let d = Math.atan2(o[1] - p[1], o[0] - p[0]) - aq;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      const na = aq + (d < 0 ? -want : want);
      const lo = Math.hypot(o[0] - p[0], o[1] - p[1]);
      const no: Pt = [p[0] + lo * Math.cos(na), p[1] + lo * Math.sin(na)];
      pts[(i + 3) % 4] = no;
      pts[(i + 2) % 4] = [q[0] + no[0] - p[0], q[1] + no[1] - p[1]];
      const xs = pts.map((c) => c[0]), ys = pts.map((c) => c[1]);
      after = { ...after, pts, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
    } else if (num) {
      const want = (parseFloat(num[1].replace(',', '.')) * Math.PI) / 180;
      if (!(want > 0.02 && want < Math.PI - 0.02)) return;
      const pts = trianglePts(before).map((q): Pt => [q[0], q[1]]);
      const p = pts[i], q = pts[(i + 1) % 3], o = pts[(i + 2) % 3];
      const aq = Math.atan2(q[1] - p[1], q[0] - p[0]);
      let d = Math.atan2(o[1] - p[1], o[0] - p[0]) - aq;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      const na = aq + (d < 0 ? -want : want);
      const lo = Math.hypot(o[0] - p[0], o[1] - p[1]);
      pts[(i + 2) % 3] = [p[0] + lo * Math.cos(na), p[1] + lo * Math.sin(na)];
      const xs = pts.map((c) => c[0]), ys = pts.map((c) => c[1]);
      after = { ...after, pts, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
    } else if (v) labels[sideIndex] = v.slice(0, 16);
    if (Object.keys(labels).length === 0) delete after.labels;
    bd.page.items[idx] = after;
    bd.push({ t: 'mod', p: bd.cur, before, after });
    bd.redraw();
    return;
  }
  const m = measureSides(before).find((x) => x.i === sideIndex);
  if (!m) return;
  if (/^\d+([.,]\d+)?$/.test(v)) {
    // πάνω σε άξονες ο αριθμός είναι στις μονάδες τους· πλάγια πλευρά σε άξονες με άλλη κλίμακα ο καθένας δεν έχει μήκος να οριστεί
    const cur = sideLen(m, unitsFor(bd.page.items, before));
    if (cur === null) return;
    const f = parseFloat(v.replace(',', '.')) / cur;
    if (!(f > 0) || !Number.isFinite(f)) return;
    // το άκρο a μένει στη θέση του, το b μετακινείται πάνω στην ίδια ευθεία
    const b: Pt = [m.a[0] + (m.b[0] - m.a[0]) * f, m.a[1] + (m.b[1] - m.a[1]) * f];
    if (before.shape === 'line' || before.shape === 'arrow') after = { ...after, x1: b[0], y1: b[1] };
    else if (before.shape === 'rect') after = sideIndex === 0 ? { ...after, x1: b[0] } : { ...after, y1: b[1] };
    else if (before.shape === 'rhombus') {
      // ρόμβος: όλες οι πλευρές ίσες, άρα μεγαλώνει ολόκληρος γύρω από την κορυφή a
      const pts = trianglePts(before).map((q): Pt => [m.a[0] + (q[0] - m.a[0]) * f, m.a[1] + (q[1] - m.a[1]) * f]);
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
      after = { ...after, pts, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
    } else if (before.shape === 'para') {
      // παραλληλόγραμμο: μαζί με την πλευρά αλλάζει και η απέναντί της
      const pts = trianglePts(before).map((q): Pt => [q[0], q[1]]);
      const dx = b[0] - m.b[0], dy = b[1] - m.b[1];
      for (const k of [(sideIndex + 1) % 4, (sideIndex + 2) % 4]) pts[k] = [pts[k][0] + dx, pts[k][1] + dy];
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
      after = { ...after, pts, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
    } else {
      const pts = trianglePts(before).map((q): Pt => [q[0], q[1]]);
      pts[(sideIndex + 1) % 3] = b;
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
      after = { ...after, pts, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
    }
  } else if (v) labels[sideIndex] = v.slice(0, 16);
  if (Object.keys(labels).length === 0) delete after.labels;
  bd.page.items[idx] = after;
  bd.push({ t: 'mod', p: bd.cur, before, after });
  bd.redraw();
}

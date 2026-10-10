export type Pt = [number, number];

export interface Stroke {
  kind: 'stroke';
  id: string;
  pts: Pt[];
  color: string;
  width: number;
  hl: boolean;
}

export interface Pic {
  kind: 'image';
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  src: string;
}

export type ShapeKind = 'line' | 'arrow' | 'rect' | 'ellipse' | 'triangle';

export interface Shape {
  kind: 'shape';
  id: string;
  shape: ShapeKind;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  width: number;
  hl?: boolean;
  /** Κορυφές (μόνο για τρίγωνο). Τα x0..y1 είναι τότε το περιβάλλον ορθογώνιο. */
  pts?: Pt[];
}

export interface TextItem {
  kind: 'text';
  id: string;
  x: number;
  y: number;
  text: string;
  size: number;
  color: string;
}

/** Γωνία: κορυφή (x, y) και δύο πλευρές με γωνίες a1, a2 (rad, άξονας y προς τα κάτω). */
export interface AngleItem {
  kind: 'angle';
  id: string;
  x: number;
  y: number;
  a1: number;
  a2: number;
  len1: number;
  len2: number;
  color: string;
  width: number;
}

export type AxesMode = 'full' | 'q1' | 'q14';

/** Καρτεσιανοί άξονες με αρχή στο (x, y)· `unit` μονάδες πίνακα ανά 1. */
export interface AxesItem {
  kind: 'axes';
  id: string;
  x: number;
  y: number;
  unit: number;
  mode: AxesMode;
  nx: number;
  ny: number;
  color: string;
}

export type Item = Stroke | Pic | Shape | TextItem | AngleItem | AxesItem;

export interface View {
  x: number;
  y: number;
  k: number;
}

export interface Page {
  items: Item[];
  view: View;
}

export type Background = 'white' | 'dark' | 'grid';

export interface Doc {
  v: 1;
  bg: Background;
  pages: Page[];
}

export type Tool = 'select' | 'pen' | 'highlighter' | 'eraser' | 'hand' | 'shape' | 'text';

let counter = 0;
export function uid(): string {
  return Date.now().toString(36) + (counter++).toString(36) + Math.random().toString(36).slice(2, 6);
}

export function newPage(): Page {
  return { items: [], view: { x: 0, y: 0, k: 1 } };
}

export function newDoc(): Doc {
  return { v: 1, bg: 'white', pages: [newPage()] };
}

/** Αναστρέψιμες πράξεις για undo/redo. */
export type Op =
  | { t: 'add'; p: number; item: Item }
  | { t: 'del'; p: number; items: { item: Item; i: number }[] }
  | { t: 'mod'; p: number; before: Item; after: Item };

export function distToSeg(px: number, py: number, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - a[0]) * dx + (py - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}

export function strokeHit(s: Stroke, x: number, y: number, r: number): boolean {
  const rr = r + s.width / 2;
  if (s.pts.length === 1) return Math.hypot(x - s.pts[0][0], y - s.pts[0][1]) <= rr;
  for (let i = 1; i < s.pts.length; i++) {
    if (distToSeg(x, y, s.pts[i - 1], s.pts[i]) <= rr) return true;
  }
  return false;
}

let measureCtx: CanvasRenderingContext2D | null = null;

export function textFont(size: number): string {
  return `${size}px system-ui, "Segoe UI", Roboto, sans-serif`;
}

export function textLines(t: TextItem): string[] {
  return t.text.split('\n');
}

export function textSize(t: TextItem): { w: number; h: number } {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d')!;
  measureCtx.font = textFont(t.size);
  const lines = textLines(t);
  const w = Math.max(...lines.map((l) => measureCtx!.measureText(l).width), t.size * 0.5);
  return { w, h: lines.length * t.size * 1.25 };
}

export function itemBounds(it: Item): { x0: number; y0: number; x1: number; y1: number } {
  if (it.kind === 'image') return { x0: it.x, y0: it.y, x1: it.x + it.w, y1: it.y + it.h };
  if (it.kind === 'text') {
    const { w, h } = textSize(it);
    return { x0: it.x, y0: it.y, x1: it.x + w, y1: it.y + h };
  }
  if (it.kind === 'axes') {
    const r = axesRange(it);
    const u = it.unit;
    return {
      x0: it.x + (r.xmin - 0.7) * u, y0: it.y - (r.ymax + 0.9) * u,
      x1: it.x + (r.xmax + 0.9) * u, y1: it.y - (r.ymin - 0.7) * u,
    };
  }
  if (it.kind === 'angle') {
    const [p1, p2] = angleEnds(it);
    const pad = 30;
    return {
      x0: Math.min(it.x, p1[0], p2[0]) - pad, y0: Math.min(it.y, p1[1], p2[1]) - pad,
      x1: Math.max(it.x, p1[0], p2[0]) + pad, y1: Math.max(it.y, p1[1], p2[1]) + pad,
    };
  }
  if (it.kind === 'shape') {
    const h = it.width / 2;
    return {
      x0: Math.min(it.x0, it.x1) - h, y0: Math.min(it.y0, it.y1) - h,
      x1: Math.max(it.x0, it.x1) + h, y1: Math.max(it.y0, it.y1) + h,
    };
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of it.pts) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  const h = it.width / 2;
  return { x0: x0 - h, y0: y0 - h, x1: x1 + h, y1: y1 + h };
}

/** Αν το σημείο (x,y) «πιάνει» το στοιχείο, με ανοχή r. */
export function hitItem(it: Item, x: number, y: number, r: number): boolean {
  switch (it.kind) {
    case 'stroke':
      return strokeHit(it, x, y, r);
    case 'image':
    case 'axes':
    case 'text': {
      const b = itemBounds(it);
      return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
    }
    case 'angle': {
      const rr = r + it.width / 2;
      const [p1, p2] = angleEnds(it);
      return distToSeg(x, y, [it.x, it.y], p1) <= rr || distToSeg(x, y, [it.x, it.y], p2) <= rr;
    }
    case 'shape': {
      const rr = r + it.width / 2;
      const { x0, y0, x1, y1 } = it;
      if (it.shape === 'triangle') {
        const c = trianglePts(it);
        for (let i = 0; i < 3; i++) if (distToSeg(x, y, c[i], c[(i + 1) % 3]) <= rr) return true;
        return false;
      }
      if (it.shape === 'line' || it.shape === 'arrow') return distToSeg(x, y, [x0, y0], [x1, y1]) <= rr;
      if (it.shape === 'rect') {
        const c: Pt[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
        for (let i = 0; i < 4; i++) if (distToSeg(x, y, c[i], c[(i + 1) % 4]) <= rr) return true;
        return false;
      }
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const a = Math.max(Math.abs(x1 - x0) / 2, 0.5), b = Math.max(Math.abs(y1 - y0) / 2, 0.5);
      const d = Math.hypot((x - cx) / a, (y - cy) / b);
      return Math.abs(d - 1) * Math.min(a, b) <= rr;
    }
  }
}

export function translateItem(it: Item, dx: number, dy: number): Item {
  switch (it.kind) {
    case 'image':
    case 'text':
    case 'angle':
    case 'axes':
      return { ...it, x: it.x + dx, y: it.y + dy };
    case 'shape':
      return {
        ...it, x0: it.x0 + dx, y0: it.y0 + dy, x1: it.x1 + dx, y1: it.y1 + dy,
        pts: it.pts?.map(([x, y]) => [x + dx, y + dy] as Pt),
      };
    case 'stroke':
      return { ...it, pts: it.pts.map(([x, y]) => [x + dx, y + dy] as Pt) };
  }
}

export function angleEnds(a: AngleItem): [Pt, Pt] {
  return [
    [a.x + a.len1 * Math.cos(a.a1), a.y + a.len1 * Math.sin(a.a1)],
    [a.x + a.len2 * Math.cos(a.a2), a.y + a.len2 * Math.sin(a.a2)],
  ];
}

/** Άνοιγμα γωνίας σε μοίρες (0–180). */
export function angleDegrees(a: AngleItem): number {
  let d = Math.abs(a.a1 - a.a2) % (2 * Math.PI);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return Math.round((d * 180) / Math.PI);
}

/** Στρογγυλοποίηση γωνίας σε ακέραιες μοίρες. */
export function roundAngle(a: number): number {
  const step = Math.PI / 180;
  return Math.round(a / step) * step;
}

export function axesRange(a: AxesItem): { xmin: number; xmax: number; ymin: number; ymax: number } {
  return {
    xmin: a.mode === 'full' ? -a.nx : 0,
    xmax: a.nx,
    ymin: a.mode === 'q1' ? 0 : -a.ny,
    ymax: a.ny,
  };
}

/** Κορυφές τριγώνου· αν δεν έχουν οριστεί, ισοσκελές μέσα στο ορθογώνιο. */
export function trianglePts(s: Shape): Pt[] {
  return s.pts ?? [[(s.x0 + s.x1) / 2, s.y0], [s.x0, s.y1], [s.x1, s.y1]];
}

/** Αλλάζει το περιβάλλον ορθογώνιο ενός σχήματος, μεταφέροντας αναλογικά και τις κορυφές του. */
export function reboxShape(s: Shape, x0: number, y0: number, x1: number, y1: number): Shape {
  const out: Shape = { ...s, x0, y0, x1, y1 };
  if (s.pts) {
    const w = s.x1 - s.x0;
    const h = s.y1 - s.y0;
    out.pts = s.pts.map(([x, y]) => [
      x0 + (w === 0 ? 0.5 : (x - s.x0) / w) * (x1 - x0),
      y0 + (h === 0 ? 0.5 : (y - s.y0) / h) * (y1 - y0),
    ] as Pt);
  }
  return out;
}

export type Recognized =
  | { t: 'shape'; shape: ShapeKind; x0: number; y0: number; x1: number; y1: number; pts?: Pt[] }
  | { t: 'angle'; x: number; y: number; a1: number; a2: number; len1: number; len2: number };

function maxDev(pts: Pt[], from: number, to: number): number {
  let m = 0;
  for (let i = from; i <= to; i++) m = Math.max(m, distToSeg(pts[i][0], pts[i][1], pts[from], pts[to]));
  return m;
}

/** Αναγνώριση σχήματος από ελεύθερο χειρόγραφο. Επιστρέφει null αν δεν μοιάζει με τίποτα. */
export function recognizeShape(pts: Pt[]): Recognized | null {
  if (pts.length < 6) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  let len = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    if (i) len += Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1]);
  }
  const w = x1 - x0, h = y1 - y0;
  const diag = Math.hypot(w, h);
  if (diag < 1) return null;
  const n = pts.length;
  const a = pts[0], b = pts[n - 1];
  const chord = Math.hypot(b[0] - a[0], b[1] - a[1]);

  // ανοιχτή γραμμή: ευθεία ή γωνία
  if (chord > 0.25 * len) {
    if (maxDev(pts, 0, n - 1) <= Math.max(chord * 0.06, 2)) {
      return { t: 'shape', shape: 'line', x0: a[0], y0: a[1], x1: b[0], y1: b[1] };
    }
    // γωνία: μία κορυφή και δύο ευθύγραμμα σκέλη
    let ci = 0, cd = 0;
    for (let i = 1; i < n - 1; i++) {
      const d = distToSeg(pts[i][0], pts[i][1], a, b);
      if (d > cd) { cd = d; ci = i; }
    }
    const c = pts[ci];
    const l1 = Math.hypot(a[0] - c[0], a[1] - c[1]);
    const l2 = Math.hypot(b[0] - c[0], b[1] - c[1]);
    if (Math.min(l1, l2) > 0.25 * Math.max(l1, l2)
      && maxDev(pts, 0, ci) <= Math.max(l1 * 0.08, 2)
      && maxDev(pts, ci, n - 1) <= Math.max(l2 * 0.08, 2)) {
      return {
        t: 'angle', x: c[0], y: c[1],
        a1: roundAngle(Math.atan2(a[1] - c[1], a[0] - c[0])),
        a2: roundAngle(Math.atan2(b[1] - c[1], b[0] - c[0])),
        len1: l1, len2: l2,
      };
    }
    return null;
  }

  // κλειστό σχήμα: ορθογώνιο, έλλειψη ή τρίγωνο — κερδίζει όποιο ταιριάζει καλύτερα
  if (w < 4 || h < 4) return null;
  const m = Math.min(w, h);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;

  // κορυφές τριγώνου: πιο μακρινό από το κέντρο βάρους, πιο μακρινό από αυτό, πιο μακρινό από την ευθεία τους
  let gx = 0, gy = 0;
  for (const [x, y] of pts) { gx += x; gy += y; }
  gx /= n; gy /= n;
  const far = (f: (p: Pt) => number): Pt => pts.reduce((best, p) => (f(p) > f(best) ? p : best), pts[0]);
  const A = far((p) => Math.hypot(p[0] - gx, p[1] - gy));
  const B = far((p) => Math.hypot(p[0] - A[0], p[1] - A[1]));
  const abLen = Math.max(Math.hypot(B[0] - A[0], B[1] - A[1]), 1e-6);
  const C = far((p) => Math.abs((B[0] - A[0]) * (A[1] - p[1]) - (A[0] - p[0]) * (B[1] - A[1])) / abLen);

  let rectD = 0, ellD = 0, triD = 0;
  for (const [x, y] of pts) {
    rectD += Math.min(Math.abs(x - x0), Math.abs(x - x1), Math.abs(y - y0), Math.abs(y - y1));
    ellD += Math.abs(Math.hypot((x - cx) / (w / 2), (y - cy) / (h / 2)) - 1) * (m / 2);
    triD += Math.min(distToSeg(x, y, A, B), distToSeg(x, y, B, C), distToSeg(x, y, C, A));
  }
  const cand: [number, Recognized][] = [
    [rectD / n / m / 0.07, { t: 'shape', shape: 'rect', x0, y0, x1, y1 }],
    [ellD / n / m / 0.06, { t: 'shape', shape: 'ellipse', x0, y0, x1, y1 }],
    [triD / n / m / 0.05, { t: 'shape', shape: 'triangle', x0, y0, x1, y1, pts: [A, B, C] }],
  ];
  cand.sort((p, q) => p[0] - q[0]);
  return cand[0][0] < 1 ? cand[0][1] : null;
}

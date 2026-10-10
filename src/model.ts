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

export type ShapeKind = 'line' | 'arrow' | 'rect' | 'ellipse';

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

export type Item = Stroke | Pic | Shape | TextItem;

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
    case 'text': {
      const b = itemBounds(it);
      return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
    }
    case 'shape': {
      const rr = r + it.width / 2;
      const { x0, y0, x1, y1 } = it;
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
      return { ...it, x: it.x + dx, y: it.y + dy };
    case 'shape':
      return { ...it, x0: it.x0 + dx, y0: it.y0 + dy, x1: it.x1 + dx, y1: it.y1 + dy };
    case 'stroke':
      return { ...it, pts: it.pts.map(([x, y]) => [x + dx, y + dy] as Pt) };
  }
}

/** Αναγνώριση σχήματος από ελεύθερο χειρόγραφο. Επιστρέφει null αν δεν μοιάζει με τίποτα. */
export function recognizeShape(pts: Pt[]): { shape: ShapeKind; x0: number; y0: number; x1: number; y1: number } | null {
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
  const a = pts[0], b = pts[pts.length - 1];
  const chord = Math.hypot(b[0] - a[0], b[1] - a[1]);

  // ευθεία: όλα τα σημεία κοντά στη χορδή
  if (chord > 0.8 * len || chord > diag * 0.9) {
    let maxD = 0;
    for (const p of pts) maxD = Math.max(maxD, distToSeg(p[0], p[1], a, b));
    if (maxD <= Math.max(chord * 0.06, 2)) return { shape: 'line', x0: a[0], y0: a[1], x1: b[0], y1: b[1] };
    return null;
  }
  // κλειστό σχήμα
  if (chord > 0.25 * len) return null;
  if (w < 4 || h < 4) return null;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let edgeDev = 0, ellDev = 0;
  for (const [x, y] of pts) {
    const dEdge = Math.min(Math.abs(x - x0), Math.abs(x - x1), Math.abs(y - y0), Math.abs(y - y1));
    edgeDev += dEdge / Math.min(w, h);
    const n = Math.hypot((x - cx) / (w / 2), (y - cy) / (h / 2));
    ellDev += Math.abs(n - 1);
  }
  edgeDev /= pts.length;
  ellDev /= pts.length;
  if (edgeDev < 0.07 && edgeDev <= ellDev) return { shape: 'rect', x0, y0, x1, y1 };
  if (ellDev < 0.12) return { shape: 'ellipse', x0, y0, x1, y1 };
  return null;
}

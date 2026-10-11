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
  /** Περιστροφή γύρω από το κέντρο (rad, κατά τη φορά του ρολογιού). */
  rot?: number;
}

export type ShapeKind = 'line' | 'arrow' | 'rect' | 'ellipse' | 'triangle' | 'rhombus' | 'para' | 'table';

/** Μορφή πίνακα: πλέγμα με όλες τις γραμμές, ορίζουσα (δύο κατακόρυφες), ή μήτρα (αγκύλες). */
export type TableStyle = 'grid' | 'det' | 'matrix';

/** Σχήματα που ορίζονται από τις κορυφές τους (τρίγωνο, ρόμβος, παραλληλόγραμμο). */
export function isPoly(shape: ShapeKind): boolean {
  return shape === 'triangle' || shape === 'rhombus' || shape === 'para';
}

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
  /** Ευθεία/βέλος με κοινή αρχή: id του άλλου σχήματος, για να δείχνεται η μεταξύ τους γωνία. */
  angleWith?: string;
  /** Διακεκομμένη γραμμή. */
  dash?: boolean;
  /** Περιστροφή γύρω από το κέντρο (rad)· μόνο για ορθογώνιο και έλλειψη, τα άλλα σχήματα στρέφουν τα σημεία τους. */
  rot?: number;
  /** Ετικέτες πλευρών που έγραψε ο χρήστης στη θέση της μέτρησης (αριθμός πλευράς → κείμενο). */
  labels?: Record<number, string>;
  /**
   * Συνισταμένη (sum) ή βοηθητική πλευρά του παραλληλογράμμου (sideA, sideB) που ακολουθεί τα δύο στοιχεία a και b:
   * δύο βέλη/ευθείες, ή μία γωνία (τότε a === b).
   */
  link?: { a: string; b: string; role: 'sum' | 'sideA' | 'sideB' };
  /** Ποιες μετρήσεις φαίνονται πάνω στο σχήμα (εργαλείο «Μετρήσεις»). */
  meas?: MeasOpts;
  /** Πίνακας (shape 'table'): γραμμές, στήλες και μορφή. Τα κελιά είναι κενά, γράφεις μέσα με το στυλό. */
  grid?: { r: number; c: number; style: TableStyle };
}

/** Τα ευθύγραμμα τμήματα που ζωγραφίζουν έναν πίνακα, χωρίς την περιστροφή του. */
export function tableLines(s: Shape): [Pt, Pt][] {
  const x0 = Math.min(s.x0, s.x1), x1 = Math.max(s.x0, s.x1), y0 = Math.min(s.y0, s.y1), y1 = Math.max(s.y0, s.y1);
  const g = s.grid ?? { r: 2, c: 2, style: 'grid' as TableStyle };
  const out: [Pt, Pt][] = [];
  if (g.style === 'grid') {
    for (let i = 0; i <= g.r; i++) out.push([[x0, y0 + ((y1 - y0) * i) / g.r], [x1, y0 + ((y1 - y0) * i) / g.r]]);
    for (let j = 0; j <= g.c; j++) out.push([[x0 + ((x1 - x0) * j) / g.c, y0], [x0 + ((x1 - x0) * j) / g.c, y1]]);
    return out;
  }
  out.push([[x0, y0], [x0, y1]], [[x1, y0], [x1, y1]]);
  if (g.style === 'matrix') {
    // αγκύλες: μικρά «ποδαράκια» πάνω και κάτω, προς τα μέσα
    const t = Math.min(16, (x1 - x0) * 0.12);
    out.push([[x0, y0], [x0 + t, y0]], [[x0, y1], [x0 + t, y1]], [[x1, y0], [x1 - t, y0]], [[x1, y1], [x1 - t, y1]]);
  }
  return out;
}

export interface MeasOpts {
  len?: boolean;
  ang?: boolean;
  area?: boolean;
  per?: boolean;
}

export interface TextItem {
  kind: 'text';
  id: string;
  x: number;
  y: number;
  text: string;
  size: number;
  color: string;
  rot?: number;
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
  /** Μόνο το τόξο και οι μοίρες, χωρίς πλευρές: γωνία που μετρήθηκε ανάμεσα σε γραμμές που υπάρχουν ήδη. */
  arc?: boolean;
  /** Εμφάνιση των μηκών των δύο πλευρών (meas.len). */
  meas?: MeasOpts;
  /** Ετικέτες στη θέση των μηκών (0, 1). */
  labels?: Record<number, string>;
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
  /** Ονόματα αξόνων· αν λείπουν, x και y. */
  lx?: string;
  ly?: string;
  /** Συναρτήσεις που σχεδιάζονται πάνω στους άξονες. */
  fns?: FnDef[];
  /** Τιμές των παραμέτρων (a, b, …) που ρυθμίζονται με δρομείς. */
  params?: Record<string, number>;
  /** Εμφάνιση ριζών, ακροτάτων και σημείων τομής. */
  points?: boolean;
  /** Εργαλεία ανάλυσης πάνω στην πρώτη ορατή συνάρτηση. */
  an?: AxesAn;
}

export interface AxesAn {
  /** Ορισμένο ολοκλήρωμα από a έως b· between: χωρίο ανάμεσα στις δύο πρώτες συναρτήσεις· n: ορθογώνια Riemann. */
  int?: { a: number; b: number; between?: boolean; n?: number };
  /** Όριο στο x0, με σημείο που κινείται πάνω στην καμπύλη στη θέση x. */
  lim?: { x0: number; x: number };
  /** Εφαπτομένη στο x· με h, και η τέμνουσα από το x στο x + h. */
  tan?: { x: number; h?: number };
  /** Ασύμπτωτες όλων των ορατών συναρτήσεων. */
  asym?: boolean;
}

export interface FnDef {
  expr: string;
  color: string;
  hidden?: boolean;
}

/** Έτοιμο σχήμα φυσικής (βλ. stamps.ts). */
export interface StampItem {
  kind: 'stamp';
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  width: number;
  /** Ελατήρια: εμφάνιση Θ.Φ.Μ., Θ.Ι. και ±A. */
  marks?: boolean;
  /** Ελατήρια: η ταλάντωση σβήνει σιγά σιγά. */
  damp?: boolean;
  rot?: number;
}

/** Τριγωνομετρικός κύκλος με κέντρο (x, y), ακτίνα r και γωνία a (rad, αντίθετα από το ρολόι). */
export interface TrigItem {
  kind: 'trig';
  id: string;
  x: number;
  y: number;
  r: number;
  a: number;
  color: string;
}

export type Item = Stroke | Pic | Shape | TextItem | AngleItem | AxesItem | StampItem | TrigItem;

export interface View {
  x: number;
  y: number;
  k: number;
}

export interface Page {
  items: Item[];
  view: View;
}

export type Background = 'white' | 'grid' | 'lines' | 'dark' | 'dark-grid' | 'dark-lines';

export function isDark(bg: Background): boolean {
  return bg.startsWith('dark');
}

export interface Doc {
  v: 1;
  bg: Background;
  pages: Page[];
}

export type Tool = 'select' | 'pen' | 'highlighter' | 'eraser' | 'hand' | 'shape' | 'text' | 'laser' | 'measure';

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
  | { t: 'mod'; p: number; before: Item; after: Item }
  /** Ολόκληρη η λίστα της σελίδας πριν και μετά (σβήσιμο με γόμα). */
  | { t: 'set'; p: number; before: Item[]; after: Item[] };

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

/** Η περιστροφή ενός στοιχείου που σχεδιάζεται στραμμένο γύρω από το κέντρο του (0 για τα υπόλοιπα). */
export function itemRot(it: Item): number {
  return (it.kind === 'image' || it.kind === 'text' || it.kind === 'stamp' || it.kind === 'shape') && it.rot ? it.rot : 0;
}

function rotPt(x: number, y: number, cx: number, cy: number, ang: number): Pt {
  const c = Math.cos(ang), s = Math.sin(ang);
  return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c];
}

/** Φέρνει ένα σημείο του πίνακα στο σύστημα του (στραμμένου) στοιχείου, όπου αυτό είναι όρθιο. */
export function unrot(it: Item, x: number, y: number): Pt {
  const r = itemRot(it);
  if (!r) return [x, y];
  const b = rawBounds(it);
  return rotPt(x, y, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, -r);
}

/** Το ορθογώνιο που περικλείει το στοιχείο όπως φαίνεται (μαζί με την περιστροφή του). */
export function itemBounds(it: Item): { x0: number; y0: number; x1: number; y1: number } {
  const b = rawBounds(it);
  const r = itemRot(it);
  if (!r) return b;
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const p = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]].map(([x, y]) => rotPt(x, y, cx, cy, r));
  const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** Στρέφει ένα στοιχείο κατά ang (rad) γύρω από το σημείο (cx, cy). */
export function rotateItem(it: Item, cx: number, cy: number, ang: number): Item {
  const R = (x: number, y: number): Pt => rotPt(x, y, cx, cy, ang);
  switch (it.kind) {
    case 'stroke':
      return { ...it, pts: it.pts.map(([x, y]) => R(x, y)) };
    case 'angle': {
      const [x, y] = R(it.x, it.y);
      return { ...it, x, y, a1: it.a1 + ang, a2: it.a2 + ang };
    }
    case 'axes':
    case 'trig': {
      // δεν στρέφονται· μέσα σε ομάδα απλώς ακολουθούν τη θέση τους
      const b = rawBounds(it);
      const mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2;
      const [nx, ny] = R(mx, my);
      return { ...it, x: it.x + nx - mx, y: it.y + ny - my };
    }
    case 'shape':
      if (it.shape === 'line' || it.shape === 'arrow') {
        const [x0, y0] = R(it.x0, it.y0), [x1, y1] = R(it.x1, it.y1);
        return { ...it, x0, y0, x1, y1 };
      }
      if (isPoly(it.shape)) {
        const pts = trianglePts(it).map(([x, y]) => R(x, y));
        const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
        return { ...it, pts, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
      }
    // ορθογώνιο και έλλειψη: όπως τα υπόλοιπα «κουτιά»
    // eslint-disable-next-line no-fallthrough
    default: {
      const b = rawBounds(it);
      const mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2;
      const [nx, ny] = R(mx, my);
      return { ...translateItem(it, nx - mx, ny - my), rot: itemRot(it) + ang } as Item;
    }
  }
}

function rawBounds(it: Item): { x0: number; y0: number; x1: number; y1: number } {
  if (it.kind === 'image' || it.kind === 'stamp') return { x0: it.x, y0: it.y, x1: it.x + it.w, y1: it.y + it.h };
  if (it.kind === 'trig') {
    const m = it.r * 1.28;
    return { x0: it.x - it.r * 1.6, y0: it.y - m, x1: it.x + it.r * 1.6, y1: it.y + m + it.r * 0.26 };
  }
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
export function hitItem(it: Item, px: number, py: number, r: number): boolean {
  const [x, y] = unrot(it, px, py);
  switch (it.kind) {
    case 'stroke':
      return strokeHit(it, x, y, r);
    case 'image':
    case 'axes':
    case 'stamp':
    case 'trig':
    case 'text': {
      const b = rawBounds(it);
      return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
    }
    case 'angle': {
      const rr = r + it.width / 2;
      if (it.arc) {
        // μετρημένη γωνία: πιάνεται από το τόξο και τις μοίρες της, όχι από τις γραμμές που μετράει
        const ar = it.len1 * 0.4;
        const diff = Math.atan2(Math.sin(it.a2 - it.a1), Math.cos(it.a2 - it.a1));
        const mid = it.a1 + diff / 2;
        if (Math.hypot(x - it.x - (ar + 26) * Math.cos(mid), y - it.y - (ar + 26) * Math.sin(mid)) <= rr + 22) return true;
        const d = Math.hypot(x - it.x, y - it.y);
        if (d > ar + rr) return false;
        if (d <= rr) return true;
        const off = Math.atan2(Math.sin(Math.atan2(y - it.y, x - it.x) - mid), Math.cos(Math.atan2(y - it.y, x - it.x) - mid));
        return Math.abs(off) <= Math.abs(diff) / 2 + Math.asin(Math.min(1, rr / d));
      }
      const [p1, p2] = angleEnds(it);
      return distToSeg(x, y, [it.x, it.y], p1) <= rr || distToSeg(x, y, [it.x, it.y], p2) <= rr;
    }
    case 'shape': {
      const rr = r + it.width / 2;
      const { x0, y0, x1, y1 } = it;
      if (isPoly(it.shape)) {
        const c = trianglePts(it);
        for (let i = 0; i < c.length; i++) if (distToSeg(x, y, c[i], c[(i + 1) % c.length]) <= rr) return true;
        return false;
      }
      if (it.shape === 'line' || it.shape === 'arrow') return distToSeg(x, y, [x0, y0], [x1, y1]) <= rr;
      if (it.shape === 'table') return tableLines(it).some(([p, q]) => distToSeg(x, y, p, q) <= rr);
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
    case 'stamp':
    case 'trig':
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

/**
 * Κορυφές τριγώνου, ρόμβου ή παραλληλογράμμου. Αν δεν έχουν οριστεί, βγαίνουν από το περιβάλλον ορθογώνιο:
 * ισοσκελές τρίγωνο, ρόμβος με τις κορυφές στα μέσα των πλευρών, παραλληλόγραμμο γερμένο κατά το 1/4 του πλάτους.
 */
export function trianglePts(s: Shape): Pt[] {
  if (s.pts) return s.pts;
  const { x0, y0, x1, y1 } = s;
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  if (s.shape === 'rhombus') return [[mx, y0], [x1, my], [mx, y1], [x0, my]];
  if (s.shape === 'para') {
    const sk = (x1 - x0) * 0.25;
    return [[x0 + sk, y0], [x1, y0], [x1 - sk, y1], [x0, y1]];
  }
  return [[mx, y0], [x0, y1], [x1, y1]];
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

  // τετράπλευρο: A και C τα άκρα μιας διαγωνίου, B και D τα πιο μακρινά σημεία εκατέρωθεν της
  const Cq = far((p) => Math.hypot(p[0] - A[0], p[1] - A[1]));
  const side = (p: Pt): number => ((Cq[0] - A[0]) * (p[1] - A[1]) - (Cq[1] - A[1]) * (p[0] - A[0])) / Math.max(Math.hypot(Cq[0] - A[0], Cq[1] - A[1]), 1e-6);
  const Bq = far((p) => side(p)), Dq = far((p) => -side(p));
  const quad = parallelogramFrom(A, Bq, Cq, Dq, side(Bq), -side(Dq));

  let rectD = 0, ellD = 0, triD = 0, quadD = 0;
  for (const [x, y] of pts) {
    if (quad) quadD += Math.min(...quad.pts.map((q, i) => distToSeg(x, y, q, quad.pts[(i + 1) % 4])));
    rectD += Math.min(Math.abs(x - x0), Math.abs(x - x1), Math.abs(y - y0), Math.abs(y - y1));
    ellD += Math.abs(Math.hypot((x - cx) / (w / 2), (y - cy) / (h / 2)) - 1) * (m / 2);
    triD += Math.min(distToSeg(x, y, A, B), distToSeg(x, y, B, C), distToSeg(x, y, C, A));
  }
  const cand: [number, Recognized][] = [
    [rectD / n / m / 0.07, { t: 'shape', shape: 'rect', x0, y0, x1, y1 }],
    [ellD / n / m / 0.06, { t: 'shape', shape: 'ellipse', x0, y0, x1, y1 }],
    [triD / n / m / 0.05, { t: 'shape', shape: 'triangle', x0, y0, x1, y1, pts: [A, B, C] }],
  ];
  if (quad) {
    const xs = quad.pts.map((q) => q[0]), ys = quad.pts.map((q) => q[1]);
    cand.push([quadD / n / m / 0.06, { t: 'shape', shape: quad.shape, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), pts: quad.pts }]);
  }
  cand.sort((p, q) => p[0] - q[0]);
  return cand[0][0] < 1 ? cand[0][1] : null;
}

/**
 * Από τέσσερις πρόχειρες κορυφές (A, C αντικριστές) φτιάχνει ακριβές παραλληλόγραμμο ή ρόμβο.
 * null αν δεν μοιάζει με παραλληλόγραμμο, ή αν είναι ουσιαστικά όρθιο ορθογώνιο (αυτό το πιάνει το «ορθογώνιο»).
 */
function parallelogramFrom(A: Pt, B: Pt, C: Pt, D: Pt, hB: number, hD: number): { shape: ShapeKind; pts: Pt[] } | null {
  const diag = Math.hypot(C[0] - A[0], C[1] - A[1]);
  if (diag < 8 || hB < diag * 0.12 || hD < diag * 0.12) return null;
  // απέναντι πλευρές σχεδόν ίσες και παράλληλες
  const ab: Pt = [B[0] - A[0], B[1] - A[1]], dc: Pt = [C[0] - D[0], C[1] - D[1]];
  const avg = (Math.hypot(ab[0], ab[1]) + Math.hypot(dc[0], dc[1]) + Math.hypot(C[0] - B[0], C[1] - B[1]) + Math.hypot(D[0] - A[0], D[1] - A[1])) / 4;
  if (Math.hypot(ab[0] - dc[0], ab[1] - dc[1]) > avg * 0.3) return null;
  const c: Pt = [(A[0] + B[0] + C[0] + D[0]) / 4, (A[1] + B[1] + C[1] + D[1]) / 4];
  let d1: Pt = [(C[0] - A[0]) / 2, (C[1] - A[1]) / 2], d2: Pt = [(D[0] - B[0]) / 2, (D[1] - B[1]) / 2];
  const l1 = Math.hypot(d1[0], d1[1]), l2 = Math.hypot(d2[0], d2[1]);
  /** Διάνυσμα που «κουμπώνει» σε οριζόντιο ή κατακόρυφο όταν απέχει λίγες μοίρες. */
  const snap = (v: Pt): Pt => {
    const l = Math.hypot(v[0], v[1]);
    if (Math.abs(v[1]) < l * 0.14) return [Math.sign(v[0]) * l, 0];
    if (Math.abs(v[0]) < l * 0.14) return [0, Math.sign(v[1]) * l];
    return v;
  };
  const axis = (v: Pt): boolean => v[0] === 0 || v[1] === 0;
  const s1 = snap([d1[0] - d2[0], d1[1] - d2[1]]), s2 = snap([d1[0] + d2[0], d1[1] + d2[1]]);
  const n1 = Math.hypot(s1[0], s1[1]), n2 = Math.hypot(s2[0], s2[1]);
  const perpDiag = Math.abs(d1[0] * d2[0] + d1[1] * d2[1]) / (l1 * l2) < 0.22;
  let shape: ShapeKind = 'para';
  if (perpDiag && Math.abs(n1 - n2) < Math.max(n1, n2) * 0.25) {
    // ρόμβος: ίσες πλευρές, διαγώνιες ακριβώς κάθετες
    shape = 'rhombus';
    d1 = snap(d1);
    const sgn = d1[0] * d2[1] - d1[1] * d2[0] >= 0 ? 1 : -1;
    d2 = [(-d1[1] / Math.hypot(d1[0], d1[1])) * l2 * sgn, (d1[0] / Math.hypot(d1[0], d1[1])) * l2 * sgn];
    // ρόμβος με οριζόντιες και κατακόρυφες πλευρές είναι τετράγωνο: το αφήνουμε στο «ορθογώνιο»
    if (axis(s1) && axis(s2)) return null;
  } else {
    if (axis(s1) && axis(s2)) return null;
    d1 = [(s1[0] + s2[0]) / 2, (s1[1] + s2[1]) / 2];
    d2 = [(s2[0] - s1[0]) / 2, (s2[1] - s1[1]) / 2];
  }
  return { shape, pts: [[c[0] - d1[0], c[1] - d1[1]], [c[0] - d2[0], c[1] - d2[1]], [c[0] + d1[0], c[1] + d1[1]], [c[0] + d2[0], c[1] + d2[1]]] };
}

// ---------- μερικό σβήσιμο ----------

/** Κόβει από μια τεθλασμένη ό,τι πέφτει μέσα στον κύκλο. null αν ο κύκλος δεν την αγγίζει. */
function clipPolyline(pts: Pt[], cx: number, cy: number, r: number): Pt[][] | null {
  if (pts.length === 1) return Math.hypot(pts[0][0] - cx, pts[0][1] - cy) <= r ? [] : null;
  const out: Pt[][] = [];
  let cur: Pt[] = [];
  let touched = false;
  const flush = () => {
    if (cur.length >= 2) {
      let len = 0;
      for (let i = 1; i < cur.length; i++) len += Math.hypot(cur[i][0] - cur[i - 1][0], cur[i][1] - cur[i - 1][1]);
      if (len >= 1.5) out.push(cur);
    }
    cur = [];
  };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const fx = a[0] - cx, fy = a[1] - cy;
    const A = dx * dx + dy * dy;
    if (A === 0) continue;
    const B = 2 * (fx * dx + fy * dy);
    const C = fx * fx + fy * fy - r * r;
    const disc = B * B - 4 * A * C;
    let t1 = 2, t2 = -1;
    if (disc > 0) {
      const q = Math.sqrt(disc);
      t1 = (-B - q) / (2 * A);
      t2 = (-B + q) / (2 * A);
    }
    if (t2 <= 0 || t1 >= 1) {
      if (cur.length === 0) cur.push(a);
      cur.push(b);
      continue;
    }
    touched = true;
    if (t1 > 0) {
      if (cur.length === 0) cur.push(a);
      cur.push([a[0] + dx * t1, a[1] + dy * t1]);
    }
    flush();
    if (t2 < 1) cur = [[a[0] + dx * t2, a[1] + dy * t2], b];
  }
  flush();
  return touched ? out : null;
}

/** Πυκνώνει μια τεθλασμένη ώστε οι γωνίες της να μένουν αιχμηρές όταν σχεδιαστεί ως γραμμή. */
function densify(pts: Pt[], step: number): Pt[] {
  if (pts.length <= 2) return pts;
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let j = 1; j <= n; j++) out.push([a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n]);
  }
  return out;
}

/** Το περίγραμμα ενός σχήματος ως τεθλασμένες γραμμές. */
function shapePolylines(s: Shape): Pt[][] {
  const { x0, y0, x1, y1 } = s;
  if (s.shape === 'line') return [[[x0, y0], [x1, y1]]];
  if (s.shape === 'arrow') {
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const L = Math.max(s.width * 4, 16);
    const head: Pt[] = [-0.45, 0, 0.45].map((d) => (d === 0 ? [x1, y1] : [x1 - L * Math.cos(ang + d), y1 - L * Math.sin(ang + d)]) as Pt);
    return [[[x0, y0], [x1, y1]], densify(head, 2)];
  }
  if (s.shape === 'rect') return [densify([[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]], 3)];
  if (s.shape === 'table') return tableLines(s).map(([p, q]) => densify([p, q], 3));
  if (isPoly(s.shape)) {
    const t = trianglePts(s);
    return [densify([...t, t[0]], 3)];
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const a = Math.max(Math.abs(x1 - x0) / 2, 0.5), b = Math.max(Math.abs(y1 - y0) / 2, 0.5);
  const n = Math.max(48, Math.min(360, Math.round((a + b) / 2)));
  const ell: Pt[] = [];
  for (let i = 0; i <= n; i++) ell.push([cx + a * Math.cos((i / n) * 2 * Math.PI), cy + b * Math.sin((i / n) * 2 * Math.PI)]);
  return [ell];
}

/**
 * Σβήνει από ένα στοιχείο μόνο ό,τι βρίσκεται μέσα στον κύκλο.
 * Επιστρέφει τα κομμάτια που απομένουν, ή null αν το στοιχείο δεν αγγίχτηκε.
 */
export function erasePartial(it: Item, x: number, y: number, r: number): Item[] | null {
  if (it.kind === 'image' || it.kind === 'axes' || it.kind === 'trig' || it.kind === 'stamp' || (it.kind === 'shape' && it.shape === 'table')) return null;
  if (it.kind === 'text' || it.kind === 'angle') return hitItem(it, x, y, r) ? [] : null;
  const b = itemBounds(it);
  if (x < b.x0 - r || x > b.x1 + r || y < b.y0 - r || y > b.y1 + r) return null;
  let lines = it.kind === 'stroke' ? [it.pts] : shapePolylines(it);
  if (itemRot(it)) {
    const rb = rawBounds(it);
    lines = lines.map((l) => l.map(([px, py]) => rotPt(px, py, (rb.x0 + rb.x1) / 2, (rb.y0 + rb.y1) / 2, itemRot(it))));
  }
  const clipped = lines.map((l) => clipPolyline(l, x, y, r));
  if (clipped.every((c) => c === null)) return null;
  const out: Item[] = [];
  lines.forEach((l, i) => {
    for (const pts of clipped[i] ?? [l]) {
      out.push({ kind: 'stroke', id: uid(), pts, color: it.color, width: it.width, hl: !!it.hl });
    }
  });
  return out;
}

// ---------- ομαδικές πράξεις ----------

/** Αντίγραφο με νέο id. */
export function cloneItem(it: Item): Item {
  // το αντίγραφο μιας συνισταμένης είναι ελεύθερο βέλος, δεν ακολουθεί τις πλευρές της αρχικής
  if (it.kind === 'shape' && it.link) {
    const { link: _drop, ...free } = it;
    return { ...free, id: uid() };
  }
  return { ...it, id: uid() };
}

/** Ομοιόμορφη κλιμάκωση γύρω από το σημείο (ox, oy). */
export function scaleItem(it: Item, ox: number, oy: number, f: number): Item {
  const X = (x: number) => ox + (x - ox) * f;
  const Y = (y: number) => oy + (y - oy) * f;
  switch (it.kind) {
    case 'stroke':
      return { ...it, pts: it.pts.map(([x, y]) => [X(x), Y(y)] as Pt), width: it.width * f };
    case 'shape':
      return {
        ...it, x0: X(it.x0), y0: Y(it.y0), x1: X(it.x1), y1: Y(it.y1), width: it.width * f,
        pts: it.pts?.map(([x, y]) => [X(x), Y(y)] as Pt),
      };
    case 'image':
    case 'stamp':
      return { ...it, x: X(it.x), y: Y(it.y), w: it.w * f, h: it.h * f };
    case 'text':
      return { ...it, x: X(it.x), y: Y(it.y), size: it.size * f };
    case 'angle':
      return { ...it, x: X(it.x), y: Y(it.y), len1: it.len1 * f, len2: it.len2 * f };
    case 'axes':
      return { ...it, x: X(it.x), y: Y(it.y), unit: it.unit * f };
    case 'trig':
      return { ...it, x: X(it.x), y: Y(it.y), r: it.r * f };
  }
}

export function pointInPolygon(x: number, y: number, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Αν το στοιχείο βρίσκεται (κατά το μεγαλύτερο μέρος του) μέσα στο λάσο. */
export function inLasso(it: Item, poly: Pt[]): boolean {
  if (it.kind === 'stroke') {
    const step = Math.max(1, Math.floor(it.pts.length / 24));
    let n = 0, inside = 0;
    for (let i = 0; i < it.pts.length; i += step) {
      n++;
      if (pointInPolygon(it.pts[i][0], it.pts[i][1], poly)) inside++;
    }
    return inside >= n * 0.6;
  }
  const b = itemBounds(it);
  return pointInPolygon((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, poly);
}

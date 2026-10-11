/** Καθαροί υπολογισμοί για μετρήσεις και ετικέτες: πλευρές, γωνίες, μορφοποίηση αριθμών. Δεν αγγίζουν τον καμβά. */

import { AngleItem, Item, MeasOpts, Pt, Shape, TrigItem, angleEnds, isPoly, trianglePts, unrot } from './model';

export function trigPoint(t: TrigItem): Pt {
  return [t.x + t.r * Math.cos(t.a), t.y - t.r * Math.sin(t.a)];
}


/** Ακέραιες μοίρες ως κλάσμα του π: 30 → «π/6», 135 → «3π/4». */
export function radText(deg: number): string {
  if (deg === 0) return '0';
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const g = gcd(deg, 180);
  const n = deg / g, d = 180 / g;
  return `${n === 1 ? '' : n}π${d === 1 ? '' : `/${d}`}`;
}

export const HL_ALPHA = 0.35;
/** Το χρώμα του υπογραμμιστικού όπως φαίνεται πάνω στο φόντο `bg`, χωρίς διαφάνεια. null αν το χρώμα δεν είναι #rrggbb. */
export function hlFlat(color: string, bg: [number, number, number]): string | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!m) return null;
  const ch = bg.map((b, i) => Math.round(b + (parseInt(m[i + 1], 16) - b) * HL_ALPHA));
  return `rgb(${ch.join(',')})`;
}

export function fmt(n: number): string {
  return n.toLocaleString('el', { maximumFractionDigits: 1 });
}

/** Μια πλευρά σχήματος που μετριέται: τα άκρα της, το μήκος της και η θέση της ετικέτας. */
export interface MSide {
  i: number;
  a: Pt;
  b: Pt;
  len: number;
  pos: Pt;
}
export function measureSides(s: Shape): MSide[] {
  const out: MSide[] = [];
  /** Ετικέτα στο μέσο του τμήματος ab, από την πλευρά που δεν είναι το σημείο `away`. */
  const side = (i: number, a: Pt, b: Pt, away?: Pt): void => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 30) return;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    let nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;
    if (away ? (away[0] - mx) * nx + (away[1] - my) * ny > 0 : ny > 0) { nx = -nx; ny = -ny; }
    out.push({ i, a, b, len, pos: [mx + nx * 18, my + ny * 18] });
  };
  const { x0, y0, x1, y1 } = s;
  if (s.dash) return out;
  if (s.shape === 'line' || s.shape === 'arrow') side(0, [x0, y0], [x1, y1]);
  else if (s.shape === 'rect') {
    const ctr: Pt = [(x0 + x1) / 2, (y0 + y1) / 2];
    side(0, [x0, y0], [x1, y0], ctr);
    side(1, [x0, y0], [x0, y1], ctr);
  } else if (isPoly(s.shape)) {
    const t = trianglePts(s);
    const g: Pt = [t.reduce((a, p) => a + p[0], 0) / t.length, t.reduce((a, p) => a + p[1], 0) / t.length];
    for (let i = 0; i < t.length; i++) side(i, t[i], t[(i + 1) % t.length], g);
  }
  return out;
}

/** Οι γωνίες τριγώνου, ρόμβου ή παραλληλογράμμου σε ακέραιες μοίρες με άθροισμα ακριβώς 180 (ή 360), και η θέση της ετικέτας καθεμιάς. */
export function measureAngles(s: Shape): { i: number; deg: number; pos: Pt }[] {
  if (!isPoly(s.shape) || s.dash) return [];
  const t = trianglePts(s);
  const n = t.length;
  const g: Pt = [t.reduce((a, p) => a + p[0], 0) / n, t.reduce((a, p) => a + p[1], 0) / n];
  const raw = t.map((p, i) => {
    const q = t[(i + 1) % n], o = t[(i + n - 1) % n];
    let d = Math.abs(Math.atan2(q[1] - p[1], q[0] - p[0]) - Math.atan2(o[1] - p[1], o[0] - p[0])) % (2 * Math.PI);
    if (d > Math.PI) d = 2 * Math.PI - d;
    return (d * 180) / Math.PI;
  });
  // στρογγύλεμα «μεγαλύτερου υπολοίπου»: αλλιώς οι στρογγυλεμένες γωνίες μπορεί να δώσουν 179 ή 181
  const deg = raw.map(Math.floor);
  const order = raw.map((_, i) => i).sort((a, b) => raw[b] - deg[b] - (raw[a] - deg[a]));
  const need = Math.max(0, Math.min(n, (n - 2) * 180 - deg.reduce((a, v) => a + v, 0)));
  for (let k = 0; k < need; k++) deg[order[k]]++;
  return t.map((p, i) => {
    const gl = Math.max(Math.hypot(g[0] - p[0], g[1] - p[1]), 1);
    const off = Math.min(42, gl * 0.45);
    return { i, deg: deg[i], pos: [p[0] + ((g[0] - p[0]) / gl) * off, p[1] + ((g[1] - p[1]) / gl) * off] as Pt };
  });
}
/**
 * Η γόμα πάνω σε μετρήσεις: σβήνει όσες ετικέτες (μήκη, γωνίες, εμβαδόν/περίμετρος) ακουμπά ο κύκλος της.
 * Επιστρέφει το στοιχείο χωρίς αυτές, ή null αν δεν ακούμπησε καμία. Το ίδιο το σχήμα μένει.
 */
export function eraseMeasures(it: Item, x: number, y: number, r: number): Item | null {
  if ((it.kind !== 'shape' && it.kind !== 'angle') || !it.meas) return null;
  const o = it.meas;
  const [wx, wy] = it.kind === 'shape' ? unrot(it, x, y) : [x, y];
  const near = (p: Pt, hw = 26, hh = 13): boolean => Math.abs(wx - p[0]) < hw + r && Math.abs(wy - p[1]) < hh + r;
  const m: MeasOpts = { ...o };
  if (it.kind === 'angle') {
    if (o.len && angleSides(it).some((q) => near(q.pos))) m.len = false;
  } else {
    if (o.len && measureSides(it).some((q) => near(q.pos))) m.len = false;
    const { x0, y0, x1, y1 } = it;
    let ctr: Pt = [(x0 + x1) / 2, (y0 + y1) / 2];
    if (o.ang && isPoly(it.shape) && measureAngles(it).some((q) => near(q.pos))) m.ang = false;
    if (o.ang && it.shape === 'rect') {
      const hit = ([[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as Pt[]).some((p) => {
        const gl = Math.max(Math.hypot(ctr[0] - p[0], ctr[1] - p[1]), 1);
        const off = Math.min(42, gl * 0.45);
        return near([p[0] + ((ctr[0] - p[0]) / gl) * off, p[1] + ((ctr[1] - p[1]) / gl) * off]);
      });
      if (hit) m.ang = false;
    }
    if (isPoly(it.shape)) {
      const t = trianglePts(it);
      ctr = [t.reduce((a, p) => a + p[0], 0) / t.length, t.reduce((a, p) => a + p[1], 0) / t.length];
    }
    // οι γραμμές στο κέντρο (r/a/b της έλλειψης, Ε, Π) με τη σειρά που ζωγραφίζονται
    const mid: (keyof MeasOpts)[] = [];
    if (it.shape === 'ellipse' && o.len) mid.push('len');
    if (it.shape !== 'line' && it.shape !== 'arrow') {
      if (o.area) mid.push('area');
      if (o.per) mid.push('per');
    }
    mid.forEach((key, i) => {
      if (near([ctr[0], ctr[1] + (i - (mid.length - 1) / 2) * 24], 60, 11)) m[key] = false;
    });
  }
  if (m.len === o.len && m.ang === o.ang && m.area === o.area && m.per === o.per) return null;
  return { ...it, meas: m };
}

/** Στις ετικέτες του σχήματος οι γωνίες έχουν αριθμό 10 + κορυφή (οι πλευρές 0, 1, 2). */
export const ANGLE_KEY = 10;

export function angleSides(a: AngleItem): MSide[] {
  if (a.arc) return [];
  const [p1, p2] = angleEnds(a);
  const o: Pt = [a.x, a.y];
  return [p1, p2].map((p, i) => {
    const len = i ? a.len2 : a.len1;
    const away = i ? p1 : p2;
    const mx = (o[0] + p[0]) / 2, my = (o[1] + p[1]) / 2;
    let nx = -(p[1] - o[1]) / Math.max(len, 1), ny = (p[0] - o[0]) / Math.max(len, 1);
    if ((away[0] - mx) * nx + (away[1] - my) * ny > 0) { nx = -nx; ny = -ny; }
    return { i, a: o, b: p, len, pos: [mx + nx * 20, my + ny * 20] as Pt };
  });
}

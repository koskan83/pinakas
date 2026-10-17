/** Καθαροί υπολογισμοί για μετρήσεις και ετικέτες: πλευρές, γωνίες, μορφοποίηση αριθμών. Δεν αγγίζουν τον καμβά. */

import { AngleItem, Item, MeasOpts, Pt, Shape, TrigItem, angleEnds, axesRange, isPoly, trianglePts, unrot } from './model';

export function trigPoint(t: TrigItem): Pt {
  return [t.x + t.r * Math.cos(t.a), t.y - t.r * Math.sin(t.a)];
}


/**
 * Η γωνία που δείχνει μια ευθεία/βέλος με `angleWith`: με το πιο κοντινό (σε άνοιγμα) προηγούμενο βέλος/ευθεία που ξεκινά από το ίδιο σημείο.
 * `r`: η ακτίνα του τόξου· `lx, ly`: πού γράφονται οι μοίρες. null όταν δεν δείχνεται γωνία.
 */
export function lineAngleMark(items: Item[], s: Shape): { a1: number; a2: number; len: number; deg: number; r: number; lx: number; ly: number } | null {
  const l2 = Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
  if (!s.angleWith || s.noAng || l2 <= 20) return null;
  const a2 = Math.atan2(s.y1 - s.y0, s.x1 - s.x0);
  let best: { a1: number; d: number; len: number } | null = null;
  for (const o of items) {
    if (o.id === s.id) break;
    if (o.kind !== 'shape' || (o.shape !== 'arrow' && o.shape !== 'line') || Math.hypot(o.x0 - s.x0, o.y0 - s.y0) >= 1) continue;
    const l1 = Math.hypot(o.x1 - o.x0, o.y1 - o.y0);
    if (l1 <= 20) continue;
    const a1 = Math.atan2(o.y1 - o.y0, o.x1 - o.x0);
    let d = Math.abs(a1 - a2) % (2 * Math.PI);
    if (d > Math.PI) d = 2 * Math.PI - d;
    if (!best || d < best.d) best = { a1, d, len: Math.min(l1, l2) };
  }
  if (!best) return null;
  const r = Math.max(18, Math.min(46, best.len * 0.4));
  const mid = best.a1 + Math.atan2(Math.sin(a2 - best.a1), Math.cos(a2 - best.a1)) / 2;
  return { a1: best.a1, a2, len: best.len, deg: Math.round((best.d * 180) / Math.PI), r, lx: s.x0 + (r + 26) * Math.cos(mid), ly: s.y0 + (r + 26) * Math.sin(mid) };
}

/** Η γόμα στο (x, y) με ακτίνα `rad` περνά πάνω από τις μοίρες ή το τόξο της γωνίας ανάμεσα σε δύο ευθείες. */
export function hitsLineAngle(items: Item[], s: Shape, x: number, y: number, rad: number): boolean {
  const m = lineAngleMark(items, s);
  if (!m) return false;
  if (Math.abs(x - m.lx) < 26 + rad && Math.abs(y - m.ly) < 13 + rad) return true;
  // πάνω στο τόξο, ανάμεσα στις δύο πλευρές
  const d = Math.hypot(x - s.x0, y - s.y0);
  if (Math.abs(d - m.r) > rad + 4) return false;
  const span = Math.atan2(Math.sin(m.a2 - m.a1), Math.cos(m.a2 - m.a1));
  const at = Math.atan2(Math.sin(Math.atan2(y - s.y0, x - s.x0) - m.a1), Math.cos(Math.atan2(y - s.y0, x - s.x0) - m.a1));
  return span >= 0 ? at >= 0 && at <= span : at <= 0 && at >= span;
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

// ---------- μονάδες μέτρησης: εκατοστά του πίνακα, ή οι μονάδες των αξόνων όταν το σχήμα είναι πάνω σε άξονες ----------

/** Πόσο αξίζει μία μονάδα του πίνακα οριζόντια (kx) και κατακόρυφα (ky). `axes`: αν μετράμε στις μονάδες αξόνων. */
export interface Units { kx: number; ky: number; axes: boolean }

/** Χωρίς άξονες: 40 μονάδες του πίνακα = 1 cm (ίδιο με το CM των οργάνων). */
export const CM_UNITS: Units = { kx: 1 / 40, ky: 1 / 40, axes: false };

/**
 * Οι μονάδες στις οποίες μετριέται ένα σχήμα: αν το κέντρο του είναι μέσα στο πλέγμα κάποιων αξόνων, οι δικές τους
 * (με την κλίμακα κάθε άξονα)· αλλιώς εκατοστά. Στραμμένα σχήματα μετριούνται πάντα σε εκατοστά.
 */
export function unitsFor(items: Item[], s: Shape): Units {
  if (s.rot) return CM_UNITS;
  const cx = (s.x0 + s.x1) / 2, cy = (s.y0 + s.y1) / 2;
  for (let i = items.length - 1; i >= 0; i--) {
    const a = items[i];
    if (a.kind !== 'axes') continue;
    const r = axesRange(a);
    if (cx < a.x + r.xmin * a.unit || cx > a.x + r.xmax * a.unit || cy < a.y - r.ymax * a.unit || cy > a.y - r.ymin * a.unit) continue;
    return { kx: (a.sx ?? 1) / a.unit, ky: (a.sy ?? 1) / a.unit, axes: true };
  }
  return CM_UNITS;
}

const sameScale = (u: Units): boolean => Math.abs(u.kx - u.ky) <= 1e-9 * Math.max(u.kx, u.ky);

/**
 * Το μήκος μιας πλευράς στις μονάδες της. Όταν οι δύο άξονες έχουν άλλη κλίμακα, μήκος έχουν μόνο οι οριζόντιες
 * και οι κατακόρυφες πλευρές (π.χ. χρόνος και ταχύτητα)· για τις πλάγιες επιστρέφει null.
 */
export function sideLen(m: { a: Pt; b: Pt }, u: Units): number | null {
  const dx = Math.abs(m.b[0] - m.a[0]), dy = Math.abs(m.b[1] - m.a[1]);
  if (sameScale(u)) return Math.hypot(dx, dy) * u.kx;
  const len = Math.hypot(dx, dy);
  if (dy <= len * 0.02) return dx * u.kx;
  if (dx <= len * 0.02) return dy * u.ky;
  return null;
}

/** Η κλίση μιας πλευράς στις μονάδες των αξόνων (ο άξονας y προς τα πάνω)· null αν είναι κατακόρυφη. */
export function sideSlope(m: { a: Pt; b: Pt }, u: Units): number | null {
  const dx = (m.b[0] - m.a[0]) * u.kx, dy = -(m.b[1] - m.a[1]) * u.ky;
  return Math.abs(m.b[0] - m.a[0]) < 1e-6 ? null : dy / dx;
}

/** Αριθμός μέτρησης: ένα δεκαδικό για συνηθισμένες τιμές, περισσότερα για πολύ μικρές. */
export function fmtU(n: number): string {
  const a = Math.abs(n);
  const d = a === 0 || a >= 10 ? 1 : a >= 1 ? 2 : a >= 0.1 ? 2 : 3;
  return (+n.toFixed(d) || 0).toLocaleString('el', { maximumFractionDigits: d }).replace('-', '−');
}

/**
 * Η ετικέτα μιας πλευράς. Σε εκατοστά: το μήκος. Πάνω σε άξονες: το μήκος στις μονάδες τους, και για ευθεία ή βέλος
 * και η κλίση λ· πλάγια πλευρά σε άξονες με διαφορετικές κλίμακες δείχνει μόνο την κλίση.
 */
export function sideText(m: { a: Pt; b: Pt; len: number }, u: Units, line: boolean): string {
  if (!u.axes) return fmt(m.len * u.kx);
  const len = sideLen(m, u), slope = sideSlope(m, u);
  const flat = slope !== null && Math.abs(m.b[1] - m.a[1]) <= m.len * 0.02;
  const sl = slope === null || flat ? '' : `λ = ${fmtU(slope)}`;
  if (len === null) return sl;
  return line && sl ? `${fmtU(len)}   ${sl}` : fmtU(len);
}

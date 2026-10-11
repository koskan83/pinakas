/** Αριθμητική ανάλυση για τις γραφικές παραστάσεις: ολοκληρώματα, όρια, ασύμπτωτες (όλα κατά προσέγγιση). */

type G = (x: number) => number;

/** Αριθμός για εμφάνιση: έως 2 δεκαδικά, ελληνική υποδιαστολή, κανονικό μείον. */
export function nf(v: number): string {
  if (!Number.isFinite(v)) return Number.isNaN(v) ? '—' : v > 0 ? '+∞' : '−∞';
  return (+v.toFixed(2) || 0).toLocaleString('el', { maximumFractionDigits: 2 }).replace('-', '−');
}

/** Εξίσωση ευθείας «y = 2x − 1». */
export function lineEq(m: number, b: number): string {
  const mr = +m.toFixed(2) || 0, br = +b.toFixed(2) || 0;
  if (mr === 0) return `y = ${nf(br)}`;
  const mx = mr === 1 ? 'x' : mr === -1 ? '−x' : `${nf(mr)}x`;
  return br === 0 ? `y = ${mx}` : `y = ${mx} ${br < 0 ? '−' : '+'} ${nf(Math.abs(br))}`;
}

/** Ορισμένο ολοκλήρωμα με τον κανόνα του Simpson. NaN αν η συνάρτηση δεν ορίζεται κάπου στο διάστημα. */
export function integrate(g: G, a: number, b: number): number {
  if (a === b) return 0;
  const n = 400;
  const h = (b - a) / n;
  let s = g(a) + g(b);
  for (let i = 1; i < n; i++) s += g(a + i * h) * (i % 2 ? 4 : 2);
  return Number.isFinite(s) ? (s * h) / 3 : NaN;
}

/** Άθροισμα Riemann με n ίσα διαστήματα και τιμή στο αριστερό άκρο καθενός. */
export function riemann(g: G, a: number, b: number, n: number): number {
  const h = (b - a) / n;
  let s = 0;
  for (let i = 0; i < n; i++) s += g(a + i * h) * h;
  return Number.isFinite(s) ? s : NaN;
}

/** Πλευρικό όριο στο x0 (dir = −1 από αριστερά, +1 από δεξιά): αριθμός, ±Infinity, ή null αν δεν υπάρχει. */
export function oneSided(g: G, x0: number, dir: number): number | null {
  const v = [1e-2, 1e-3, 1e-4, 1e-5].map((h) => g(x0 + dir * h));
  if (v.some((y) => Number.isNaN(y))) return null;
  if (!Number.isFinite(v[3])) return v[3];
  const d = [Math.abs(v[1] - v[0]), Math.abs(v[2] - v[1]), Math.abs(v[3] - v[2])];
  if (d[2] < 1e-9 || (d[2] < d[1] * 0.5 && d[1] < d[0] * 0.9)) {
    // προέκταση προς το h → 0 και στρογγύλεμα όταν είναι πρακτικά «στρογγυλός» αριθμός
    const lim = v[3] + (v[3] - v[2]) / 9;
    const r = Math.round(lim * 100) / 100;
    return Math.abs(lim - r) < 2e-3 ? r : lim;
  }
  const sameSign = v[1] > 0 === v[3] > 0 && v[2] > 0 === v[3] > 0;
  if (sameSign && Math.abs(v[3]) > Math.abs(v[2]) && Math.abs(v[2]) > Math.abs(v[1]) && d[2] >= d[1] * 0.9 && Math.abs(v[3]) > 5) {
    return v[3] > 0 ? Infinity : -Infinity;
  }
  return null;
}

/** Παράγωγος στο x με κεντρική διαφορά. */
export function slope(g: G, x: number): number {
  const h = 1e-5;
  return (g(x + h) - g(x - h)) / (2 * h);
}

export interface Asymptotes {
  /** Κατακόρυφες: x = τιμή. */
  vx: number[];
  /** Οριζόντιες (m = 0) και πλάγιες: y = m·x + b. */
  lines: { m: number; b: number }[];
}

export function asymptotes(g: G, xmin: number, xmax: number): Asymptotes {
  const N = 600;
  const h = (xmax - xmin) / N;
  const cand: number[] = [];
  const fin = (x: number): boolean => Number.isFinite(g(x));
  const bisect = (a: number, b: number, same: (x: number) => boolean): number => {
    for (let i = 0; i < 46; i++) {
      const m = (a + b) / 2;
      if (same(m)) a = m; else b = m;
    }
    return (a + b) / 2;
  };
  let px = xmin, py = g(px);
  for (let i = 1; i <= N; i++) {
    const x = xmin + i * h, y = g(x);
    const pf = Number.isFinite(py), yf = Number.isFinite(y);
    if (pf !== yf) {
      // άκρο του πεδίου ορισμού ή μεμονωμένο σημείο όπου δεν ορίζεται
      cand.push(pf ? x : px, bisect(px, x, (m) => fin(m) === pf));
    } else if (pf && yf && py !== 0 && y !== 0 && py < 0 !== y < 0 && Math.abs(y - py) > 2) {
      // αλλαγή προσήμου με άλμα: πόλος (ή απότομη ρίζα, που απορρίπτεται πιο κάτω)
      cand.push(bisect(px, x, (m) => g(m) < 0 === py < 0));
    } else if (pf && yf && i >= 2) {
      // κορυφή του |f| χωρίς αλλαγή προσήμου (π.χ. 1/x²)
      const pp = Math.abs(g(x - 2 * h));
      if (Math.abs(py) > 20 && Math.abs(py) >= pp && Math.abs(py) >= Math.abs(y)) {
        let a = x - 2 * h, b = x;
        for (let k = 0; k < 60; k++) {
          const m1 = a + (b - a) / 3, m2 = b - (b - a) / 3;
          if (Math.abs(g(m1)) < Math.abs(g(m2)) || !fin(m1)) a = m1; else b = m2;
        }
        cand.push((a + b) / 2);
      }
    }
    px = x;
    py = y;
  }
  const vx: number[] = [];
  for (const c0 of cand) {
    const c = Math.abs(c0 - Math.round(c0 * 1e4) / 1e4) < 1e-7 ? Math.round(c0 * 1e4) / 1e4 : c0;
    if (c < xmin - 1e-9 || c > xmax + 1e-9 || vx.some((v) => Math.abs(v - c) < 1e-3) || vx.length >= 12) continue;
    const l = oneSided(g, c, -1), r = oneSided(g, c, 1);
    if ((l !== null && !Number.isFinite(l)) || (r !== null && !Number.isFinite(r))) vx.push(c);
  }

  const lines: { m: number; b: number }[] = [];
  for (const dir of [-1, 1]) {
    const [x1, x2, x3] = [1e3 * dir, 1e4 * dir, 1e5 * dir];
    const [y1, y2, y3] = [g(x1), g(x2), g(x3)];
    if (![y1, y2, y3].every(Number.isFinite)) continue;
    const m12 = (y2 - y1) / (x2 - x1), m = (y3 - y2) / (x3 - x2);
    if (Math.abs(m12 - m) > 1e-4 * (1 + Math.abs(m))) continue;
    const b = y3 - m * x3;
    if (Math.abs(b - (y2 - m * x2)) > 2e-2 * (1 + Math.abs(b))) continue;
    const mr = Math.round(m * 1e3) / 1e3 || 0, br = Math.round(b * 1e2) / 1e2 || 0;
    // η ίδια η ευθεία (ή σταθερή συνάρτηση) δεν είναι ασύμπτωτη του εαυτού της
    if ([0.37, 1.91, -2.3].every((x) => Math.abs(g(x) - (m * x + b)) < 1e-7)) continue;
    if (!lines.some((l) => l.m === mr && l.b === br)) lines.push({ m: mr, b: br });
  }
  return { vx, lines };
}

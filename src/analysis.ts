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
  // επτά δείγματα που πλησιάζουν το x0· τα τέσσερα πιο κοντινά πρέπει πρακτικά να συμφωνούν
  const v = [1e-3, 5e-4, 2e-4, 1e-4, 5e-5, 2e-5, 1e-5].map((h) => g(x0 + dir * h));
  if (v.some((y) => Number.isNaN(y))) return null;
  const last = v[v.length - 1];
  if (!Number.isFinite(last)) return last;
  const range = (a: number[]): number => Math.max(...a) - Math.min(...a);
  const far = range(v.slice(0, 4)), near = range(v.slice(3));
  if (near < 1e-9 || (near < 0.05 * (1 + Math.abs(last)) && near <= far * 0.6)) {
    // στρογγύλεμα όταν είναι πρακτικά «στρογγυλός» αριθμός
    const r = Math.round(last * 100) / 100;
    return Math.abs(last - r) < 4e-3 ? r : last;
  }
  // απειρίζεται: ίδιο πρόσημο και μέτρο που μεγαλώνει συνεχώς όσο πλησιάζουμε
  const growing = v.every((y, i) => y > 0 === last > 0 && (i === 0 || Math.abs(y) > Math.abs(v[i - 1])));
  if (growing && Math.abs(last) > 5 && Math.abs(last) > Math.abs(v[0]) * 1.3) return last > 0 ? Infinity : -Infinity;
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

/**
 * Κλίμακα του κατακόρυφου άξονα (τιμή ανά γραμμή) ώστε να φαίνονται οι συναρτήσεις: π.χ. η y = −200x θέλει 200 ανά γραμμή.
 * Μένει 1 όταν οι καμπύλες φαίνονται ήδη αρκετά (π.χ. x², 1/x, ημx), για να μην αλλάζει η γνώριμη εικόνα τους.
 * `up`, `down`: πόσες γραμμές έχει ο άξονας πάνω και κάτω από το μηδέν.
 */
export function fitScaleY(fns: G[], xmin: number, xmax: number, up: number, down: number): number {
  const N = 400;
  // πόσες γραμμές θα χρειαζόταν κάθε σημείο με κλίμακα 1· όσα πέφτουν σε πλευρά που δεν υπάρχει (π.χ. αρνητικά στο 1ο τεταρτημόριο) δεν μετράνε
  const need: number[] = [];
  let worst = 1;
  for (const g of fns) {
    const mine: number[] = [];
    for (let i = 0; i <= N; i++) {
      const y = g(xmin + ((xmax - xmin) * i) / N);
      if (!Number.isFinite(y)) continue;
      if (y >= 0) mine.push(y / up);
      else if (down > 0) mine.push(-y / down);
    }
    if (!mine.length) continue;
    need.push(...mine);
    worst = Math.min(worst, mine.filter((v) => v <= 1).length / mine.length);
  }
  if (!need.length) return 1;
  need.sort((a, b) => a - b);
  const p95 = need[Math.min(need.length - 1, Math.floor(need.length * 0.95))];
  // φαίνεται ήδη αρκετό κομμάτι κάθε καμπύλης και καμία δεν είναι «πλακωμένη» πάνω στον άξονα
  if (worst >= 0.25 && p95 >= 0.08) return 1;
  if (!(p95 > 0)) return 1;
  return niceStep(p95);
}

/** Το μικρότερο «στρογγυλό» βήμα (1, 2, 5 × δύναμη του 10) που δεν είναι κάτω από το v. */
export function niceStep(v: number): number {
  const e = Math.floor(Math.log10(v));
  for (const m of [1, 2, 5, 10]) {
    const s = m * 10 ** e;
    if (s >= v * 0.999) return +s.toPrecision(6);
  }
  return +(10 ** (e + 1)).toPrecision(6);
}

/**
 * Ποιοι άξονες ταιριάζουν σε συναρτήσεις με περιορισμένο πεδίο ορισμού: αν καμία δεν ορίζεται για x < 0 αρκεί το δεξί μισό («q14»),
 * κι αν επιπλέον καμία δεν παίρνει αρνητικές τιμές, μόνο το 1ο τεταρτημόριο («q1»). `nx`: ως πού φτάνει ο άξονας x.
 */
export function pickAxesMode(fns: G[], nx: number): 'full' | 'q1' | 'q14' {
  const N = 400;
  let any = false, left = false, below = false;
  for (const g of fns) {
    for (let i = 0; i <= N; i++) {
      const x = -nx + (2 * nx * i) / N;
      const y = g(x);
      if (!Number.isFinite(y)) continue;
      any = true;
      if (x < -1e-9) left = true;
      else if (y < -1e-9) below = true;
    }
  }
  if (!any || left) return 'full';
  return below ? 'q14' : 'q1';
}

/**
 * Κλίμακα του οριζόντιου άξονα (τιμή ανά γραμμή) από τα πεδία ορισμού: αν φτάνουν πέρα από τις `nx` γραμμές (π.χ. 0 ≤ t ≤ 50)
 * ή πιάνουν πολύ μικρό κομμάτι τους (π.χ. 0 ≤ x ≤ 0,5), ο άξονας απλώνεται ή μαζεύεται. Χωρίς φραγμένο πεδίο ορισμού μένει 1.
 */
export function fitScaleX(doms: ([number | null, number | null] | undefined)[], nx: number): number {
  let m = 0;
  for (const d of doms) {
    // συνάρτηση χωρίς περιορισμό: η γνώριμη εικόνα της είναι με 1 ανά γραμμή
    if (!d) return 1;
    const [lo, hi] = d;
    const far = Math.max(Math.abs(lo ?? 0), Math.abs(hi ?? 0));
    // ανοιχτό προς το άπειρο (π.χ. x ≥ 20): αφήνουμε άλλο τόσο χώρο πέρα από το άκρο
    m = Math.max(m, lo === null || hi === null ? far * 2 : far);
  }
  if (!(m > 0)) return 1;
  if (m <= nx && m > nx / 5) return 1;
  return niceStep(m / nx);
}

/** Οι τετμημένες όπου τέμνονται δύο καμπύλες (ή, με g = 0, οι ρίζες της f) μέσα στο [xmin, xmax], από αριστερά προς τα δεξιά. */
export function crossings(f: G, g: G | null, xmin: number, xmax: number): number[] {
  const d = (x: number): number => f(x) - (g ? g(x) : 0);
  const N = 800;
  const out: number[] = [];
  const add = (x: number): void => {
    // «στρογγυλές» τετμημένες (π.χ. 2 αντί για 1,9999999) και χωρίς διπλές
    const r = Math.round(x * 1e6) / 1e6;
    const v = Math.abs(r - Math.round(r * 100) / 100) < 1e-5 ? Math.round(r * 100) / 100 : r;
    if (!out.some((o) => Math.abs(o - v) < (xmax - xmin) * 1e-4)) out.push(v);
  };
  let px = xmin, py = d(px);
  for (let i = 1; i <= N; i++) {
    const x = xmin + ((xmax - xmin) * i) / N, y = d(x);
    if (Number.isFinite(py) && Number.isFinite(y)) {
      if (py === 0) add(px);
      else if (py < 0 !== y < 0 && y !== 0) {
        let a = px, b = x, fa = py;
        for (let k = 0; k < 50; k++) {
          const m = (a + b) / 2, fm = d(m);
          if (!Number.isFinite(fm)) break;
          if (fm < 0 === fa < 0) { a = m; fa = fm; } else b = m;
        }
        // άλμα προσήμου χωρίς μηδενισμό (ασύμπτωτη) δεν είναι σημείο τομής
        if (Math.abs(d((a + b) / 2)) < 1e-6 * (1 + Math.abs(py) + Math.abs(y))) add((a + b) / 2);
      }
    }
    px = x;
    py = y;
  }
  if (Number.isFinite(py) && py === 0) add(px);
  return out.sort((a, b) => a - b);
}

/**
 * Τα δύο διαδοχικά σημεία τομής που ορίζουν το χωρίο πιο κοντά στο `near`· null αν δεν υπάρχουν δύο.
 */
export function enclosing(xs: number[], near: number): [number, number] | null {
  if (xs.length < 2) return null;
  let best = 0;
  for (let i = 1; i < xs.length - 1; i++) {
    if (Math.abs((xs[i] + xs[i + 1]) / 2 - near) < Math.abs((xs[best] + xs[best + 1]) / 2 - near)) best = i;
  }
  return [xs[best], xs[best + 1]];
}

import { describe, expect, it } from 'vitest';
import { eraseMeasures, hlFlat, measureAngles, measureSides, radText } from '../src/board';
import { Pt, Shape } from '../src/model';

const tri = (pts: Pt[]): Shape => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { kind: 'shape', id: 't', shape: 'triangle', pts, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), color: '#111111', width: 4 };
};

describe('μετρήσεις τριγώνου', () => {
  it('οι γωνίες έχουν πάντα άθροισμα 180', () => {
    // ψευδοτυχαία τρίγωνα, ίδια σε κάθε εκτέλεση
    let seed = 7;
    const rnd = (): number => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) * 600;
    for (let i = 0; i < 500; i++) {
      const t = tri([[rnd(), rnd()], [rnd(), rnd()], [rnd(), rnd()]]);
      const a = measureAngles(t);
      expect(a.reduce((s, m) => s + m.deg, 0)).toBe(180);
    }
  });
  it('ορθογώνιο τρίγωνο 3-4-5', () => {
    const t = tri([[0, 0], [120, 0], [0, 160]]);
    expect(measureAngles(t).map((m) => m.deg)).toEqual([90, 53, 37]);
    expect(measureSides(t).map((m) => Math.round(m.len))).toEqual([120, 200, 160]);
  });
  it('οι διακεκομμένες βοηθητικές γραμμές δεν μετριούνται', () => {
    expect(measureSides({ ...tri([[0, 0], [120, 0], [0, 160]]), dash: true })).toEqual([]);
  });
});

describe('ακτίνια και χρώμα υπογραμμιστικού', () => {
  it('μοίρες ως κλάσμα του π', () => {
    expect(radText(0)).toBe('0');
    expect(radText(30)).toBe('π/6');
    expect(radText(135)).toBe('3π/4');
    expect(radText(180)).toBe('π');
    expect(radText(270)).toBe('3π/2');
    expect(radText(37)).toBe('37π/180');
  });
  it('το υπογραμμιστικό γίνεται αδιαφανές χρώμα πάνω στο φόντο', () => {
    expect(hlFlat('#fde047', [255, 255, 255])).toBe('rgb(254,244,191)');
    expect(hlFlat('yellow', [255, 255, 255])).toBeNull();
  });
});

describe('γόμα πάνω σε μετρήσεις', () => {
  const tri: Shape = { kind: 'shape', id: 't', shape: 'triangle', x0: 0, y0: 0, x1: 400, y1: 300, pts: [[0, 300], [400, 300], [0, 0]], color: '#111111', width: 3, meas: { len: true, ang: true, area: true } };
  it('πάνω σε μήκος σβήνει μόνο τα μήκη', () => {
    const p = measureSides(tri)[0].pos;
    const r = eraseMeasures(tri, p[0], p[1], 10) as Shape;
    expect(r.meas).toEqual({ len: false, ang: true, area: true });
  });
  it('πάνω σε γωνία σβήνει μόνο τις γωνίες', () => {
    const p = measureAngles(tri)[1].pos;
    expect((eraseMeasures(tri, p[0], p[1], 10) as Shape).meas?.ang).toBe(false);
  });
  it('στο κέντρο σβήνει το εμβαδόν', () => {
    expect((eraseMeasures(tri, 400 / 3, 200, 10) as Shape).meas?.area).toBe(false);
  });
  it('μακριά από ετικέτες ή χωρίς μετρήσεις δεν κάνει τίποτα', () => {
    expect(eraseMeasures(tri, 900, 900, 10)).toBeNull();
    expect(eraseMeasures({ ...tri, meas: undefined }, 200, 318, 10)).toBeNull();
  });
});

describe('ρόμβος και παραλληλόγραμμο', () => {
  const para: Shape = { kind: 'shape', id: 'p', shape: 'para', x0: 0, y0: 0, x1: 400, y1: 200, color: '#111111', width: 3 };
  const rh: Shape = { kind: 'shape', id: 'h', shape: 'rhombus', x0: 0, y0: 0, x1: 300, y1: 200, color: '#111111', width: 3 };
  it('τέσσερις πλευρές και γωνίες με άθροισμα 360', () => {
    expect(measureSides(para)).toHaveLength(4);
    for (const s of [para, rh]) {
      const a = measureAngles(s);
      expect(a).toHaveLength(4);
      expect(a.reduce((t, x) => t + x.deg, 0)).toBe(360);
      expect(a[0].deg).toBe(a[2].deg);
    }
  });
  it('ο ρόμβος έχει ίσες πλευρές', () => {
    const L = measureSides(rh).map((m) => m.len);
    expect(Math.max(...L) - Math.min(...L)).toBeLessThan(1e-9);
  });
});

import { CM_UNITS, sideLen, sideSlope, sideText, unitsFor } from '../src/measure';
import type { AxesItem, Shape as Sh } from '../src/model';

describe('μέτρηση μέσα σε άξονες', () => {
  // άξονες στο (400, 400), 40 μονάδες πίνακα ανά γραμμή, x: 5 ανά γραμμή, y: 10 ανά γραμμή
  const ax: AxesItem = { kind: 'axes', id: 'a', x: 400, y: 400, unit: 40, mode: 'q1', nx: 10, ny: 10, color: '#111111', sx: 5, sy: 10 };
  const line = (x0: number, y0: number, x1: number, y1: number): Sh => ({ kind: 'shape', id: 's', shape: 'line', x0, y0, x1, y1, color: '#111111', width: 3 });
  it('σχήμα πάνω στους άξονες μετριέται στις μονάδες τους, αλλιώς σε εκατοστά', () => {
    expect(unitsFor([ax], line(440, 360, 520, 360))).toEqual({ kx: 5 / 40, ky: 10 / 40, axes: true });
    expect(unitsFor([ax], line(40, 40, 120, 40))).toBe(CM_UNITS);
    expect(unitsFor([ax], { ...line(440, 360, 520, 360), rot: 0.3 })).toBe(CM_UNITS);
  });
  it('οριζόντια και κατακόρυφα μήκη, κλίση για τα πλάγια', () => {
    const u = unitsFor([ax], line(440, 360, 520, 360));
    expect(sideLen({ a: [440, 360], b: [520, 360] }, u)).toBeCloseTo(10);
    expect(sideLen({ a: [440, 360], b: [440, 240] }, u)).toBeCloseTo(30);
    expect(sideLen({ a: [440, 360], b: [520, 240] }, u)).toBeNull();
    // 2 γραμμές δεξιά (10) και 3 γραμμές πάνω (30): κλίση 3
    expect(sideSlope({ a: [440, 360], b: [520, 240] }, u)).toBeCloseTo(3);
    expect(sideText({ a: [440, 360], b: [520, 240], len: 144 }, u, true)).toBe('λ = 3');
    expect(sideText({ a: [440, 360], b: [520, 360], len: 80 }, u, true)).toBe('10');
  });
  it('σε άξονες με ίδια κλίμακα η ευθεία δείχνει μήκος και κλίση', () => {
    const u = unitsFor([{ ...ax, sx: undefined, sy: undefined }], line(440, 360, 560, 200));
    expect(sideText({ a: [440, 360], b: [560, 200], len: 200 }, u, true)).toBe('5   λ = 1,33');
    expect(sideText({ a: [440, 360], b: [560, 200], len: 200 }, u, false)).toBe('5');
  });
  it('χωρίς άξονες μένουν τα εκατοστά', () => expect(sideText({ a: [0, 0], b: [120, 0], len: 120 }, CM_UNITS, true)).toBe('3'));
});

import { KIDS } from '../src/kids';

describe('άσκηση με το 🎯 στα εργαλεία του Δημοτικού', () => {
  const at = (name: string, v: number[], fx: number, fy: number): number[] | null => {
    const d = KIDS[name];
    return d.tap!(v, fx * d.w, fy * d.h, d.w, d.h);
  };
  it('κλάσμα: το 🎯 ζητά γνήσιο κλάσμα σε άδειο σχήμα και κρατά την όψη', () => {
    for (let i = 0; i < 30; i++) {
      const v = at('fracbar', [4, 5, 1], 0.32, 0.75)!;
      expect(v[1]).toBe(0);
      expect(v[2]).toBe(1);
      expect(v[3]).toBeGreaterThanOrEqual(1);
      expect(v[3]).toBeLessThan(v[0]);
    }
  });
  it('κλάσμα: ο στόχος μένει όσο χρωματίζεις, πανηγυρισμός μόλις γίνουν όσα ζητούνται, και φεύγει αν αλλάξει ο παρονομαστής', () => {
    const d = KIDS.fracbar;
    const one = at('fracbar', [4, 0, 0, 2], 0.1, 0.2)!;
    expect(one).toEqual([4, 1, 0, 2]);
    expect(d.fx!([4, 0, 0, 2], one)).toBe('click');
    const two = at('fracbar', one, 0.9, 0.2)!;
    expect(two).toEqual([4, 9, 0, 2]);
    expect(d.fx!(one, two)).toBe('win');
    expect(at('fracbar', two, 0.68, 0.75)).toEqual([4, 9, 1, 2]);
    expect(at('fracbar', two, 0.86, 0.75)).toEqual([5, 0]);
    expect(d.fx!([4, 0], [4, 1])).toBe('click');
  });
  it('ρολόι: το 🎯 ζητά άλλη ώρα ανά 5 λεπτά και κρύβει την ψηφιακή· σωστό μόνο όταν αφήσεις τους δείκτες εκεί', () => {
    const d = KIDS.clock;
    const v = d.tap!([185, 1], d.w * 0.92, d.w * 0.08, d.w, d.h)!;
    expect(v[0]).toBe(185);
    expect(v[1]).toBe(0);
    expect((v[2] - 1) % 5).toBe(0);
    expect(v[2] - 1).not.toBe(185);
    expect(d.drop!([185, 0, 186])).toEqual({ v: [185, 0, 186, 1], ev: 'win' });
    expect(d.drop!([180, 0, 186])).toBeNull();
    expect(d.drop!([185, 0, 186, 1])).toBeNull();
    expect(d.drop!([185, 1])).toBeNull();
    // οι δείκτες κρατούν τον στόχο όσο σέρνονται, και το πλαίσιο της ώρας τελειώνει την άσκηση
    const c = d.w / 2, r = d.w * 0.47;
    expect(d.paint!([185, 0, 186, 1], c, c - r * 0.8, d.w, d.h, {}, true)).toEqual([180, 0, 186, 0]);
    expect(d.tap!([185, 0, 186, 1], d.w / 2, d.w + 10, d.w, d.h)).toEqual([185, 1]);
  });
  it('προπαίδεια: η γωνία ζητά γινόμενο, το σωστό κουτάκι πανηγυρίζει, και δεύτερο πάτημα στη γωνία σταματά την άσκηση', () => {
    const d = KIDS.times;
    const cell = (v: number[], q: number, r: number): number[] => at('times', v, (q + 1.5) / 11, (r + 1.5) / 11)!;
    for (let i = 0; i < 30; i++) {
      const v = at('times', [0, 0, 0, 0], 0.04, 0.04)!;
      expect(v.length).toBe(6);
      expect(v[4]).toBeGreaterThanOrEqual(4);
      expect(v[5]).toBe(0);
    }
    // ζητείται το 12: το 3×5 απλώς ανοίγει, το 3×4 (ή το 2×6) το βρίσκει
    const wrong = cell([0, 0, 0, 0, 12, 0], 2, 4);
    expect(wrong.slice(4)).toEqual([12, 0]);
    expect(d.fx!([0, 0, 0, 0, 12, 0], wrong)).toBe('click');
    const right = cell(wrong, 5, 1);
    expect(right.slice(4)).toEqual([12, 1]);
    expect(d.fx!(wrong, right)).toBe('win');
    expect(at('times', wrong, 0.04, 0.04)!.length).toBe(4);
    const next = at('times', right, 0.04, 0.04)!;
    expect(next[5]).toBe(0);
    expect(next[4]).not.toBe(12);
  });
  it('ψηφοφορία: κάθε πάτημα μετράει μία ψήφο, το 📊 δείχνει το αποτέλεσμα, το ⟳ μηδενίζει', () => {
    const d = KIDS.poll;
    let v = d.init!.slice();
    // 4 επιλογές: Β, Β, Δ
    v = at('poll', v, 0.38, 0.4)!;
    v = at('poll', v, 0.38, 0.4)!;
    v = at('poll', v, 0.88, 0.4)!;
    expect(v).toEqual([4, 0, 0, 2, 0, 1]);
    const shown = at('poll', v, 0.9, 0.89)!;
    expect(shown).toEqual([4, 1, 0, 2, 0, 1]);
    expect(d.fx!(v, shown)).toBe('drum');
    // με ψήφους το αριστερό κουμπί είναι ⟳· χωρίς ψήφους τα −/+ αλλάζουν πόσες είναι οι επιλογές
    expect(at('poll', shown, 0.08, 0.89)).toEqual([4, 0]);
    expect(at('poll', [4, 0], 0.08, 0.89)).toEqual([3, 0]);
    expect(at('poll', [5, 0], 0.2, 0.89)).toBeNull();
    expect(at('poll', [2, 0], 0.75, 0.4)).toEqual([2, 0, 0, 1]);
  });
  it('ζυγαριά: το 🎯 βάζει βαρίδια αριστερά που δεν αλλάζουν, και η ισορροπία από τα δεξιά πανηγυρίζει', () => {
    const d = KIDS.balance;
    const v = at('balance', [1, 0], 0.07, 0.1)!;
    expect(v[0]).toBe(3);
    expect(v[1]).toBe(2);
    expect(v.length).toBe(4);
    expect(v[2] + v[3]).toBeGreaterThan(10);
    expect(d.fx!([3, 2, 6, 7, 10], [3, 2, 6, 7, 10, 3])).toBe('win');
    expect(d.fx!([1, 2, 6, 7, 10], [1, 2, 6, 7, 10, 3])).toBe('equal');
    // άλυτη άσκηση: το 🎯 τη σταματά· λυμένη: δίνει καινούργια
    expect(at('balance', [3, 2, 6, 7, 10], 0.07, 0.1)).toEqual([1, 2, 6, 7, 10]);
    expect(at('balance', [3, 2, 6, 7, 10, 3], 0.07, 0.1)!.length).toBe(4);
  });
});

describe('εργαλεία Δημοτικού', () => {
  const tap = (name: string, v: number[], x: number, y: number): number[] | null => {
    const d = KIDS[name];
    return d.tap!(v, x * d.w, y * d.h, d.w, d.h);
  };
  it('ζυγαριά: τα βαρίδια μπαίνουν στη σωστή πλευρά και βγαίνουν με πάτημα', () => {
    // κουμπιά κάτω, για κάθε πλευρά δύο σειρές: 1–5 και 6–10. Αριστερά το 1 είναι πρώτο στην πάνω σειρά, δεξιά το 10 τελευταίο στην κάτω
    let v = tap('balance', [1, 0], 0.07, 0.8)!;
    expect(v).toEqual([1, 1, 1]);
    v = tap('balance', v, 0.642 + 0.072 * 4, 0.92)!;
    expect(v).toEqual([1, 1, 1, 10]);
    // όλα τα νούμερα από το 1 ως το 10 υπάρχουν και στις δύο πλευρές
    for (let n = 1; n <= 10; n++) {
      const y = n <= 5 ? 0.8 : 0.92, col = (n - 1) % 5;
      expect(tap('balance', [1, 0], 0.07 + 0.072 * col, y)).toEqual([1, 1, n]);
      expect(tap('balance', [1, 0], 0.642 + 0.072 * col, y)).toEqual([1, 0, n]);
    }
    // κρύψιμο της σύγκρισης στη μέση
    expect(tap('balance', v, 0.5, 0.86)).toEqual([0, 1, 1, 10]);
    expect(tap('balance', v, 0.5, 0.5)).toBeNull();
  });
  it('Ε Δ Μ: προστίθενται χιλιάδες και δεκάδες χιλιάδες, με κρατούμενο ως το 99.999', () => {
    // κουμπί «＋ Χιλιάδες» κάτω αριστερά· «− στήλη» κάτω δεξιά
    let v = tap('blocks', [234, 1], 0.12, 0.92)!;
    expect(v).toEqual([234, 1, 4]);
    v = tap('blocks', v, 0.12, 0.92)!;
    expect(v).toEqual([234, 1, 5]);
    expect(tap('blocks', v, 0.12, 0.92)).toEqual([234, 0, 5]);
    // + στις δεκάδες χιλιάδες (πρώτη στήλη, ως το 0,19 του πλάτους)
    const r = Math.min(0.24 * 400 * 0.2, 0.19 * 620 * 0.15) / 620;
    expect(tap('blocks', v, 0.19 - r * 1.5, 0.24 * 0.68)).toEqual([10234, 1, 5]);
    // κρατούμενο από τις μονάδες ως επάνω, και όριο στο 99.999
    expect(tap('blocks', [9999, 1, 5], 1 - (Math.min(19.2, 0.2 * 620 * 0.15) / 620) * 1.5, 0.24 * 0.68)).toEqual([10000, 1, 5]);
    expect(tap('blocks', [99999, 1, 5], 1 - (Math.min(19.2, 0.2 * 620 * 0.15) / 620) * 1.5, 0.24 * 0.68)).toBeNull();
    // αφαίρεση στήλης: ό,τι δεν χωρά πια φεύγει· στις τρεις στήλες η κατάσταση γυρίζει στην παλιά της μορφή
    expect(tap('blocks', [45678, 1, 5], 0.88, 0.92)).toEqual([5678, 1, 4]);
    expect(tap('blocks', [5678, 1, 4], 0.88, 0.92)).toEqual([678, 1]);
  });
  it('κλάσμα: πάτημα χρωματίζει κομμάτι, + και − αλλάζουν τον παρονομαστή', () => {
    expect(tap('fracbar', [4, 0], 0.1, 0.2)).toEqual([4, 1]);
    expect(tap('fracbar', [4, 1], 0.9, 0.2)).toEqual([4, 9]);
    expect(tap('fracbar', [4, 3], 0.86, 0.75)).toEqual([5, 0]);
    expect(tap('fracbar', [1, 0], 0.14, 0.75)).toBeNull();
    // όψη σοκολάτας / πίτσας: ανάβει από το κουμπί της και μένει όταν αλλάζουν τα κομμάτια ή ο παρονομαστής
    expect(tap('fracbar', [4, 1], 0.68, 0.75)).toEqual([4, 1, 1]);
    expect(tap('fracbar', [4, 1, 1], 0.68, 0.75)).toEqual([4, 1, 0]);
    expect(tap('fracbar', [4, 1, 1], 0.9, 0.2)).toEqual([4, 9, 1]);
    expect(tap('fracbar', [4, 3, 1], 0.86, 0.75)).toEqual([5, 0, 1]);
    expect(tap('fracpie', [4, 0], 0.9, 0.1 * 280 / 370)).toEqual([4, 0, 1]);
    expect(KIDS.fracpizza.init).toEqual([4, 0, 1]);
    expect(KIDS.fracchoc.init).toEqual([4, 0, 1]);
  });
  it('ρολόι: έξω τα λεπτά, μέσα η ώρα, κάτω η ψηφιακή ένδειξη', () => {
    const d = KIDS.clock, c = d.w / 2, r = d.w * 0.47;
    // λεπτοδείκτης στο «6» (30 λεπτά), με ώρα 3
    expect(d.paint!([180, 1], c, c + r * 0.8, d.w, d.h, {}, true)).toEqual([210, 1]);
    // ο λεπτοδείκτης πηγαίνει ανά λεπτό: 7 λεπτά, με ώρα 3
    const a7 = (7 / 60) * 2 * Math.PI;
    expect(d.paint!([180, 1], c + r * 0.8 * Math.sin(a7), c - r * 0.8 * Math.cos(a7), d.w, d.h, {}, true)).toEqual([187, 1]);
    // ωροδείκτης στο «9»
    expect(d.paint!([180, 1], c - r * 0.4, c, d.w, d.h, {}, true)).toEqual([540, 1]);
    // σύρσιμο του λεπτοδείκτη: μένει λεπτοδείκτης ακόμα κι αν το δάχτυλο περάσει πιο μέσα
    const st = {};
    d.paint!([180, 1], c, c + r * 0.8, d.w, d.h, st, true);
    expect(d.paint!([180, 1], c + r * 0.3, c, d.w, d.h, st, false)).toEqual([195, 1]);
    // έξω από το καντράν το σύρσιμο μετακινεί το ρολόι
    expect(d.paint!([180, 1], c, d.h - 10, d.w, d.h, {}, true)).toBeNull();
    expect(d.tap!([180, 1], c, d.h - 10, d.w, d.h)).toEqual([180, 0]);
  });
  it('υλικό δεκάδων: πάνω από 9 μηδενίζει και περνά ένα στην επόμενη στήλη', () => {
    const d = KIDS.blocks, head = d.h * 0.24, r = head * 0.2, ky = head * 0.68;
    const plus = (k: number): [number, number] => [[0.44, 0.72, 1][k] * d.w - r * 1.5, ky];
    const minus = (k: number): [number, number] => [[0, 0.44, 0.72][k] * d.w + r * 1.5, ky];
    expect(d.tap!([234, 1], ...plus(0), d.w, d.h)).toEqual([334, 1]);
    // 9 μονάδες + 1: οι μονάδες μηδενίζουν και οι δεκάδες γίνονται 4
    expect(d.tap!([239, 1], ...plus(2), d.w, d.h)).toEqual([240, 1]);
    // 9 δεκάδες + 1: περνά στις εκατοντάδες
    expect(d.tap!([294, 1], ...plus(1), d.w, d.h)).toEqual([304, 1]);
    // 0 μονάδες − 1: δανείζεται από τις δεκάδες
    expect(d.tap!([240, 1], ...minus(2), d.w, d.h)).toEqual([239, 1]);
    expect(d.tap!([999, 1], ...plus(2), d.w, d.h)).toBeNull();
    expect(d.tap!([0, 1], ...minus(2), d.w, d.h)).toBeNull();
  });
  it('πίνακας του 100 και προπαίδεια: το πάτημα σημειώνει το σωστό κουτί', () => {
    expect(tap('hundred', [0, 0, 0, 0], 0.05, 0.05)).toEqual([1, 0, 0, 0]);
    expect(tap('hundred', [0, 0, 0, 0], 0.95, 0.95)).toEqual([0, 0, 0, 1 << 24]);
    // 3 × 4: στήλη 4, γραμμή 3 → θέση 23
    expect(tap('times', [0, 0, 0, 0], 4.5 / 11, 3.5 / 11)).toEqual([1 << 23, 0, 0, 0]);
    expect(tap('times', [0, 0, 0, 0], 0.02, 0.5)).toBeNull();
  });
  it('χρήματα: πάτημα στην τράπεζα προσθέτει', () => {
    expect(tap('money', [1, 0, 0, 0, 0, 0, 0, 0, 0], 0.5 / 8, 0.1)).toEqual([1, 1, 0, 0, 0, 0, 0, 0, 0]);
  });
});

describe('χτίσιμο με κυβάκια', () => {
  const d = KIDS.build, s = d.w / 24, slots = 19;
  it('σύρσιμο χτίζει με το επιλεγμένο υλικό· σβήνει μόνο το σφουγγάρι', () => {
    const st = {};
    let v = d.paint!([2], s * 0.5, s * 0.5, d.w, d.h, st, true)!;
    expect(v[1]).toBe(3);
    v = d.paint!(v, s * 1.5, s * 0.5, d.w, d.h, st, false)!;
    expect(v.slice(1, 4)).toEqual([3, 3, 0]);
    // το ίδιο κουτί ξανά στην ίδια κίνηση: καμία αλλαγή
    expect(d.paint!(v, s * 1.5, s * 0.5, d.w, d.h, st, false)).toBeNull();
    // νέα κίνηση πάνω σε κυβάκι του ίδιου υλικού: μένει, δεν σβήνει
    expect(d.paint!(v, s * 0.5, s * 0.5, d.w, d.h, {}, true)![1]).toBe(3);
    // άλλο υλικό πάνω του: το αντικαθιστά
    expect(d.paint!([6, ...v.slice(1)], s * 0.5, s * 0.5, d.w, d.h, {}, true)![1]).toBe(7);
    // σφουγγάρι (η θέση αμέσως μετά τα υλικά): σβήνει
    expect(d.paint!([slots - 2, ...v.slice(1)], s * 0.5, s * 0.5, d.w, d.h, {}, true)![1]).toBe(0);
  });
  it('η σειρά υλικών διαλέγει υλικό, και ο κάδος αδειάζει το χτίσιμο', () => {
    // στη σειρά υπάρχει και μια τελευταία θέση: «όλη η οθόνη» (ή η πόρτα επιστροφής)
    const y = s * 14 + (d.h - s * 14) / 2, sw = d.w / (slots + 1);
    expect(d.paint!([0, 1, 1], sw * 5.5, y, d.w, d.h, {}, true)![0]).toBe(5);
    expect(d.paint!([4, 1, 1], sw * (slots - 0.5), y, d.w, d.h, {}, true)).toEqual([4]);
    expect(d.fullAt!(sw * (slots + 0.5), y, d.w, d.h)).toBe(true);
    expect(d.fullAt!(sw * (slots - 0.5), y, d.w, d.h)).toBe(false);
    expect(d.paint!([4, 1, 1], sw * (slots + 0.5), y, d.w, d.h, {}, true)).toBeNull();
    // σύρσιμο που ξεκίνησε από τα υλικά δεν χτίζει
    const st = {};
    d.paint!([0], sw * 5.5, y, d.w, d.h, st, true);
    expect(d.paint!([5], s * 0.5, s * 0.5, d.w, d.h, st, false)).toBeNull();
  });
  it('χτίσιμο από το παλιό, μικρότερο πλέγμα δεν χάνεται', () => {
    const old = [0, ...new Array(160).fill(0)];
    old[1 + 9 * 16] = 2; // κάτω αριστερά στο 16 × 10
    const v = d.paint!(old, s * 5.5, s * 0.5, d.w, d.h, {}, true)!;
    expect(v[1 + 13 * 24]).toBe(2);
  });
});

import { hangNorm, hangStart, hangState } from '../src/kids';

describe('κρεμάλα', () => {
  const ABC = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ';
  const bitOf = (ch: string): number => 1 << ABC.indexOf(ch);
  it('η λέξη γίνεται κεφαλαία χωρίς τόνους', () => {
    expect(hangNorm('Σχολείο')).toBe('ΣΧΟΛΕΙΟ');
    expect(hangNorm('γαϊδούρι!')).toBe('ΓΑΙΔΟΥΡΙ');
    expect(hangNorm('λύκος')).toBe('ΛΥΚΟΣ');
  });
  it('το πρώτο και το τελευταίο γράμμα φαίνονται από την αρχή', () => {
    const v = hangStart('μπανάνα');
    const st = hangState(v);
    expect(st.word).toBe('ΜΠΑΝΑΝΑ');
    expect(st.mask).toBe(bitOf('Μ') | bitOf('Α'));
    expect(st.wrong).toBe(0);
    expect(st.won).toBe(false);
    expect(hangStart('α')).toEqual([0]);
  });
  it('πάτημα σε γράμμα: σωστό το ανοίγει, λάθος μετράει, και στα 6 λάθη χάνεται', () => {
    const d = KIDS.hangman;
    const key = (v: number[], ch: string): number[] | null => {
      const i = ABC.indexOf(ch), kw = (d.w * 0.62) / 8;
      return d.tap!(v, d.w * 0.36 + (i % 8 + 0.5) * kw, d.h * 0.4 + (Math.floor(i / 8) + 0.5) * d.h * 0.13, d.w, d.h);
    };
    let v = hangStart('ΒΙΒΛΙΟ');
    v = key(v, 'Ι')!;
    expect(hangState(v).wrong).toBe(0);
    // το ίδιο γράμμα δεύτερη φορά δεν κάνει τίποτα
    expect(key(v, 'Ι')).toBeNull();
    v = key(v, 'Λ')!;
    expect(hangState(v).won).toBe(true);
    expect(key(v, 'Ω')).toBeNull();
    let w = hangStart('ΒΙΒΛΙΟ');
    for (const ch of 'ΑΓΔΕΖ') w = key(w, ch)!;
    expect(hangState(w).wrong).toBe(5);
    expect(hangState(w).lost).toBe(false);
    w = key(w, 'Η')!;
    expect(hangState(w).lost).toBe(true);
    expect(key(w, 'Ι')).toBeNull();
  });
});

import { randomWords } from '../src/spell-lists';
import { spellDiff, spellGame, spellKeyboard, spellList, spellNorm, spellPack, spellState, type Spell } from '../src/kids';

describe('ορθογραφία με το τερατάκι', () => {
  const d = KIDS.spell;
  const game = (words: string[], more: Partial<Spell> = {}): number[] =>
    spellPack({ phase: 0, hand: false, peek: false, ready: false, en: false, said: false, acc: 0, idx: 0, sel: 0, words, hints: words.map(() => ''), res: words.map(() => 0), typed: '', marks: [], ...more });
  const EL = false, EN = true;
  /** Ένα πλήκτρο· τα τονισμένα γράφονται όπως σε κανονικό πληκτρολόγιο, με τον τόνο πρώτα. */
  const press1 = (v: number[], ch: string, en: boolean): number[] | null => {
    const k = spellKeyboard({ kx: d.w * 0.02, ky: d.h * 0.475, kw: d.w * 0.096, kh: d.h * 0.0975 }, en).find((q) => q.key === ch)!;
    return d.tap!(v, k.x + k.w / 2, k.y + k.h / 2, d.w, d.h);
  };
  const DEAD: Record<string, string> = { ά: '΄α', έ: '΄ε', ή: '΄η', ί: '΄ι', ό: '΄ο', ύ: '΄υ', ώ: '΄ω', ϊ: '΄΄ι', ϋ: '΄΄υ', ΐ: '΄΄΄ι', ΰ: '΄΄΄υ' };
  const key = (v: number[], ch: string, en = EL): number[] | null => [...(DEAD[ch] ?? ch)].reduce<number[] | null>((acc, c) => acc && press1(acc, c, en), v);
  const type = (v: number[], s: string, en = EL): number[] => [...s].reduce((acc, ch) => key(acc, ch, en)!, v);
  /** Τα κουμπιά κάτω: Λέξεις, 👁, τρόπος γραφής, Έλεγχος / Επόμενη, και (4) το 🔊. */
  const button = (k: number): [number, number] => [d.w * [0.0875, 0.2025, 0.4225, 0.75, 0.2875][k], d.h * 0.93];
  const press = (v: number[], k: number): number[] | null => d.tap!(v, ...button(k), d.w, d.h);
  it('κρατά τόνους και πεζά, χωρίς στίξη, σε ελληνικά και αγγλικά', () => {
    expect(spellNorm('  Το Σχολείο!  ')).toBe('το σχολείο');
    expect(spellNorm('ΠΑΪΔΆΚΙΑ')).toBe('παϊδάκια');
    expect(spellNorm('Don’t  Stop.')).toBe("don't stop");
    expect(spellList('μήλο, Καλή μέρα;  , apple\nσχολείο').words).toEqual(['μήλο', 'καλή μέρα', 'apple', 'σχολείο']);
    // μετά το «=» αυτό που βλέπει ο μαθητής· ανάποδα γραμμένο, ζητείται πάλι η αγγλική
    expect(spellList('Apple = μήλο, σκύλος=dog, φως')).toEqual({ words: ['apple', 'dog', 'φως'], hints: ['μήλο', 'σκύλος', ''] });
    // αγγλική από τις έτοιμες χωρίς «=»: παίρνει τη σημασία της· άγνωστη μένει χωρίς
    expect(spellList('school, spaceship').hints).toEqual(['σχολείο', '']);
    // χωρίς κόμμα: κάθε λέξη χωριστά· σημασία και με « - », «:» ή δύο στήλες από Excel· αρίθμηση και κουκκίδες φεύγουν
    expect(spellList('μήλο  σχολείο φως').words).toEqual(['μήλο', 'σχολείο', 'φως']);
    expect(spellList('apple - μήλο\r\ndog: σκύλος\ncat\tγάτα\nsun')).toEqual({ words: ['apple', 'dog', 'cat', 'sun'], hints: ['μήλο', 'σκύλος', 'γάτα', 'ήλιος'] });
    expect(spellList('1. μήλο\n• καλή μέρα').words).toEqual(['μήλο', 'καλή μέρα']);
    // νέο παιχνίδι από κείμενο: τα αγγλικά αναγνωρίζονται μόνα τους
    expect(spellState(spellGame('apple = μήλο, dog')!)).toMatchObject({ words: ['apple', 'dog'], hints: ['μήλο', 'σκύλος'], en: true, idx: 0, ready: false });
    expect(spellState(spellGame('μήλο')!).en).toBe(false);
    expect(spellGame(' , ')).toBeNull();
  });
  it('🎲: δέκα λέξεις στην τύχη από μία ή πολλές λίστες, με τη σημασία τους και χωρίς διπλές', () => {
    const a = 'α1 β1 γ1 δ1 ε1 ζ1 η1 θ1'.replace(/1/g, 'α').split(' ').join(', '), b = 'apple - μήλο\ndog = σκύλος\nαα\nμήλο σχολείο';
    const r = randomWords([a, b], 10);
    expect(r.count).toBe(11);
    const got = spellList(r.text);
    expect(got.words.length).toBe(10);
    expect(new Set(got.words).size).toBe(10);
    got.words.forEach((w, i) => w === 'apple' && expect(got.hints[i]).toBe('μήλο'));
    expect(randomWords(['μήλο, φως'], 10).count).toBe(2);
    expect(randomWords([], 10).text).toBe('');
  });
  it('αντιστοιχίζει λάθος, περιττό και γράμμα που λείπει', () => {
    const bad = (a: string, b: string): string => spellDiff(a, b).map((c) => (c.a === c.b ? '.' : c.a && c.b ? 's' : c.a ? 'x' : '+')).join('');
    expect(bad('σχολείο', 'σχολείο')).toBe('.......');
    expect(bad('σχολίο', 'σχολείο')).toBe('....+..');
    expect(bad('σχωλειο', 'σχολείο')).toBe('..s..s.');
    expect(bad('σχολλείο', 'σχολείο')).toMatch(/^\.{3,4}x\.{3,4}$/);
    expect(bad('οδοσ', 'οδός')).toBe('..ss');
  });
  it('η κατάσταση γράφεται και διαβάζεται ίδια· η παλιά (μία λέξη) ξεκινά από την αρχή', () => {
    const s: Spell = { phase: 1, hand: true, peek: true, ready: true, en: true, said: true, acc: 3, idx: 1, sel: 2, words: ['μήλο', 'good morning'], hints: ['', 'καλημέρα'], res: [12, 0], typed: 'go_d', marks: [false, false, true, false] };
    expect(spellState(spellPack(s))).toEqual(s);
    expect(spellState([1, 4, 956, 942, 955, 959, 956]).words).toEqual([]);
    expect(spellState(d.init!).words).toEqual([]);
  });
  it('αρχή: έτοιμες λέξεις ανά τάξη (η πρώτη φαίνεται), αγγλικά, ή δικές σου με κόμμα', () => {
    const ready = spellState(d.tap!(d.init!, d.w * 0.12, d.h * 0.57, d.w, d.h)!);
    expect(ready.words.length).toBe(8);
    expect(new Set(ready.words).size).toBe(8);
    expect(ready).toMatchObject({ ready: true, peek: true, idx: 0, en: false });
    const en = d.tap!(d.init!, d.w * 0.6, d.h * 0.42, d.w, d.h)!;
    expect(spellState(en).en).toBe(true);
    expect(d.tap!(en, d.w * 0.6, d.h * 0.42, d.w, d.h)).toBeNull();
    // οι έτοιμες αγγλικές δεν φαίνονται: ο μαθητής βλέπει τη σημασία τους στα ελληνικά
    const ready2 = d.tap!(en, d.w * 0.12, d.h * 0.57, d.w, d.h)!, r2 = spellState(ready2);
    expect(r2.words.every((x) => /^[a-z]+$/.test(x))).toBe(true);
    expect(r2.hints.every((x) => /^[α-ωά-ώ]+$/i.test(x))).toBe(true);
    expect(r2.peek).toBe(false);
    expect(d.fx!(en, ready2)).toBe(`say|en-GB|${r2.words[0]}`);
    const own = d.ask!(d.init!, d.w / 2, d.h * 0.79, d.w, d.h)!;
    expect(own).toMatchObject({ secret: true, voice: 'el-GR', lists: true });
    expect(d.ask!(en, d.w / 2, d.h * 0.79, d.w, d.h)!.voice).toBe('en-GB');
    expect(own.apply(' , ')).toBeNull();
    expect(spellState(own.apply('Μήλο, καλή μέρα')!)).toMatchObject({ words: ['μήλο', 'καλή μέρα'], res: [0, 0], ready: false, peek: false });
  });
  it('πλήκτρα όπως σε κανονικό πληκτρολόγιο: ο τόνος πριν από το φωνήεν, διαλυτικά με δεύτερο πάτημα', () => {
    const g = game(['προϊόν']);
    const acc = press1(g, '΄', EL)!;
    expect(spellState(acc).acc).toBe(1);
    expect(spellState(press1(acc, 'ο', EL)!)).toMatchObject({ typed: 'ό', acc: 0 });
    // σύμφωνο μετά τον τόνο: γράφεται σκέτο· το ⌫ ακυρώνει τον τόνο χωρίς να σβήσει γράμμα
    expect(spellState(press1(acc, 'π', EL)!).typed).toBe('π');
    expect(spellState(press1(type(g, 'π'), '΄', EL)!).typed).toBe('π');
    expect(spellState(press1(press1(type(g, 'π'), '΄', EL)!, '⌫', EL)!)).toMatchObject({ typed: 'π', acc: 0 });
    expect(spellState(type(g, 'προϊόν')).typed).toBe('προϊόν');
    expect(spellState(type(g, 'ϋΐΰ')).typed).toBe('ϋΐΰ');
    // το «;» κρατά μόνο τη θέση
    expect(press1(g, ';', EL)).toBeNull();
  });
  it('πλήκτρα: σβήσιμο, αλλαγή γράμματος στη μέση', () => {
    let v = type(game(['μήλο']), 'μιλω');
    expect(spellState(v).typed).toBe('μιλω');
    expect(spellState(key(v, '⌫')!).typed).toBe('μιλ');
    // πάτημα στο δεύτερο γράμμα το πιάνει· το επόμενο πλήκτρο το αλλάζει και η γραφή γυρίζει στο τέλος
    const cw = d.w * 0.08, x0 = (d.w - 4 * cw) / 2;
    v = d.tap!(v, x0 + cw * 1.5, d.h * 0.345 - cw * 0.6, d.w, d.h)!;
    expect(spellState(v).sel).toBe(2);
    v = key(v, 'ή')!;
    expect(spellState(v)).toMatchObject({ typed: 'μήλω', sel: 0 });
    expect(spellState(key(v, 'ς')!).typed).toBe('μήλως');
  });
  it('πρώτος έλεγχος: το τερατάκι τρώει τα λάθη και αφήνει κενές θέσεις· ο δεύτερος τρώει ό,τι έμεινε', () => {
    const typed = type(game(['καλημέρα', 'μήλο']), 'καλιμερα');
    const hint = press(typed, 3)!;
    expect(spellState(hint)).toMatchObject({ phase: 1, typed: 'καλ_μ_ρα', sel: 4, res: [12, 0] });
    expect(spellState(hint).marks).toEqual([false, false, false, true, false, true, false, false]);
    expect(d.fx!(typed, hint)).toBe('sniff2');
    // γεμίζει την πρώτη κενή θέση: πιάνεται μόνη της η επόμενη
    const one = key(hint, 'η')!;
    expect(spellState(one)).toMatchObject({ typed: 'καλημ_ρα', sel: 6 });
    // λάθος και στη δεύτερη προσπάθεια: το τρώει κι αυτό και φαίνεται το σωστό
    const again = key(one, 'ε')!, eaten = press(again, 3)!;
    expect(spellState(eaten)).toMatchObject({ phase: 2, typed: 'καλημερα', res: [13, 0] });
    expect(d.fx!(again, eaten)).toBe('munch1');
    expect(key(eaten, 'α')).toBeNull();
    // γεμίζει σωστά και τη δεύτερη: σωστή με τη δεύτερη, και τα δύο φαγωμένα μένουν στο τερατάκι
    const both = press(key(one, 'έ')!, 3)!;
    expect(spellState(both)).toMatchObject({ phase: 2, typed: 'καλημέρα', res: [102, 0] });
    expect(d.fx!(one, both)).toBe('cheer');
    // γράμμα που λείπει γίνεται κενή θέση· γράμμα που περισσεύει τρώγεται και φεύγει
    const gap = spellState(press(type(game(['σχολείο']), 'σχολίο'), 3)!);
    expect(gap).toMatchObject({ typed: 'σχολ_ίο', sel: 5 });
    expect(spellState(press(key(spellPack(gap), 'ε')!, 3)!)).toMatchObject({ phase: 2, res: [101] });
    const extra = press(type(game(['μήλο']), 'μήλοο'), 3)!;
    expect(spellState(extra)).toMatchObject({ phase: 1, typed: 'μήλο', sel: 0, res: [11] });
    expect(spellState(press(extra, 3)!)).toMatchObject({ phase: 2, res: [101] });
  });
  it('στο δέκατο λάθος το τερατάκι τρώει κι εσένα (ο ήχος έχει το «x») και η λίστα ξαναρχίζει', () => {
    const typed = type(game(['μήλο', 'φως'], { idx: 1, res: [18, 0] }), 'φοσ');
    expect(d.fx!(typed, press(typed, 3)!)).toBe('sniff2x');
    // μετά τη σκηνή, η ίδια λίστα από την αρχή: το επόμενο πάτημα παίζει την πρώτη λέξη, με το τερατάκι μικρό
    const fed = press(typed, 3)!;
    expect(spellState(fed).res).toEqual([18, 12]);
    expect(spellState(key(fed, 'μ')!)).toMatchObject({ idx: 0, phase: 0, typed: 'μ', res: [0, 0], words: ['μήλο', 'φως'] });
    expect(d.fx!(fed, key(fed, 'μ')!)).toBe('click');
    const before = type(game(['μήλο', 'φως'], { idx: 1, res: [14, 0] }), 'φοσ');
    expect(d.fx!(before, press(before, 3)!)).toBe('sniff2');
  });
  it('σωστή με την πρώτη, επόμενη λέξη, αποτελέσματα και ξανά', () => {
    let v = type(game(['μήλο', 'φως']), 'μήλο');
    const right = press(v, 3)!;
    expect(spellState(right)).toMatchObject({ phase: 2, res: [1, 0] });
    expect(d.fx!(v, right)).toBe('win');
    v = press(right, 3)!;
    expect(spellState(v)).toMatchObject({ phase: 0, idx: 1, typed: '' });
    // κάθε νέα λέξη λέγεται δυνατά· το 🔊 την ξαναλέει
    expect(d.fx!(right, v)).toBe('say|el-GR|φως');
    expect(d.fx!(v, press(v, 4)!)).toBe('say|el-GR|φως');
    v = press(press(press(type(v, 'φος'), 3)!, 3)!, 3)!;
    expect(spellState(v)).toMatchObject({ idx: 2, res: [1, 12] });
    // στα αποτελέσματα: «Ξανά οι ίδιες» και «Νέες λέξεις»
    expect(spellState(d.tap!(v, d.w * 0.25, d.h * 0.93, d.w, d.h)!)).toMatchObject({ idx: 0, res: [0, 0], words: ['μήλο', 'φως'] });
    expect(spellState(d.tap!(v, d.w * 0.75, d.h * 0.93, d.w, d.h)!).words).toEqual([]);
  });
  it('το 👁 δείχνει τη λέξη και το πρώτο πλήκτρο την κρύβει', () => {
    const shown = press(game(['μήλο']), 1)!;
    expect(spellState(shown).peek).toBe(true);
    expect(spellState(key(shown, 'μ')!)).toMatchObject({ peek: false, typed: 'μ' });
    expect(spellState(press(shown, 1)!).peek).toBe(false);
  });
  it('αγγλική λέξη: αγγλικά πλήκτρα QWERTY', () => {
    const v = type(game(["don't"]), "dont'", EN);
    expect(spellState(v).typed).toBe("dont'");
    expect(spellState(press(press(v, 3)!, 3)!)).toMatchObject({ phase: 2, res: [14] });
    expect(spellState(press(type(game(['cat']), 'cat', EN), 3)!).res).toEqual([1]);
  });
  it('με το χέρι: ο «Έλεγχος» διαβάζει το πλαίσιο· χωρίς ανάγνωση η τάξη κρίνει μόνη της', () => {
    const hand = press(game(['μήλο', 'φως']), 2)!;
    expect(spellState(hand).hand).toBe(true);
    // το πλαίσιο δεν είναι κουμπί, και τα κουμπιά του τα χειρίζεται το ask
    expect(d.tap!(hand, d.w / 2, d.h * 0.6, d.w, d.h)).toBeNull();
    expect(press(hand, 3)).toBeNull();
    const read = d.ask!(hand, ...button(3), d.w, d.h)!;
    expect(read.mode).toBe('read');
    expect(read.area!.y).toBeCloseTo(d.h * 0.475);
    const hint = read.apply('Μίλο')!;
    expect(spellState(hint)).toMatchObject({ phase: 1, typed: 'μ_λο', sel: 0, res: [11, 0] });
    expect(spellState(d.ask!(hint, ...button(3), d.w, d.h)!.apply('μήλο')!)).toMatchObject({ phase: 2, res: [101, 0] });
    // κενή ανάγνωση (χωρίς κλειδί ή ίντερνετ): φαίνεται η σωστή και πατιέται «Σωστά» ή «Λάθος»
    const manual = read.apply('')!;
    expect(spellState(manual).phase).toBe(3);
    expect(d.ask!(manual, ...button(3), d.w, d.h)).toBeNull();
    expect(spellState(d.tap!(manual, d.w * 0.61, d.h * 0.93, d.w, d.h)!)).toMatchObject({ phase: 2, res: [1, 0] });
    const wrong = d.tap!(manual, d.w * 0.86, d.h * 0.93, d.w, d.h)!;
    expect(spellState(wrong)).toMatchObject({ phase: 2, res: [11, 0], typed: '' });
    // η «Επόμενη», οι «Λέξεις» και η αλλαγή σε πλήκτρα σβήνουν ό,τι γράφτηκε στο πλαίσιο
    const next = d.ask!(wrong, ...button(3), d.w, d.h)!;
    expect(next.mode).toBe('clear');
    expect(spellState(next.apply('')!)).toMatchObject({ phase: 0, idx: 1, hand: true });
    expect(d.ask!(hand, ...button(0), d.w, d.h)!.mode).toBe('clear');
    expect(spellState(d.ask!(hand, ...button(2), d.w, d.h)!.apply('')!).hand).toBe(false);
    expect(d.ask!(game(['μήλο']), ...button(3), d.w, d.h)).toBeNull();
  });
});

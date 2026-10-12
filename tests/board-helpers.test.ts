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

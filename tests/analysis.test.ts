import { describe, expect, it } from 'vitest';
import { asymptotes, integrate, lineEq, nf, oneSided, riemann, slope } from '../src/analysis';

describe('ολοκλήρωμα και Riemann', () => {
  it('∫ x²/2−1 από 1 έως 3 = 7/3', () => {
    expect(integrate((x) => x * x / 2 - 1, 1, 3)).toBeCloseTo(7 / 3, 6);
  });
  it('αντίστροφα άκρα αλλάζουν πρόσημο και ίδια άκρα δίνουν 0', () => {
    expect(integrate(Math.sin, Math.PI, 0)).toBeCloseTo(-2, 6);
    expect(integrate(Math.sin, 2, 2)).toBe(0);
  });
  it('NaN όταν η συνάρτηση δεν ορίζεται μέσα στο διάστημα', () => {
    expect(integrate((x) => Math.sqrt(x), -1, 1)).toBeNaN();
  });
  it('το άθροισμα Riemann πλησιάζει το ολοκλήρωμα όσο μεγαλώνει το ν', () => {
    const f = (x: number) => x * x;
    const exact = 9;
    const e4 = Math.abs(riemann(f, 0, 3, 4) - exact), e32 = Math.abs(riemann(f, 0, 3, 32) - exact);
    expect(e32).toBeLessThan(e4);
  });
});

describe('όρια', () => {
  it('ημx/x → 1 στο 0, από δύο πλευρές', () => {
    const f = (x: number) => Math.sin(x) / x;
    expect(oneSided(f, 0, -1)).toBe(1);
    expect(oneSided(f, 0, 1)).toBe(1);
  });
  it('1/x → ∓∞ στο 0', () => {
    const f = (x: number) => 1 / x;
    expect(oneSided(f, 0, -1)).toBe(-Infinity);
    expect(oneSided(f, 0, 1)).toBe(Infinity);
  });
  it('ln x → −∞ στο 0⁺ και δεν ορίζεται από αριστερά', () => {
    expect(oneSided(Math.log, 0, 1)).toBe(-Infinity);
    expect(oneSided(Math.log, 0, -1)).toBeNull();
  });
  it('√x → 0 στο 0⁺', () => {
    expect(oneSided(Math.sqrt, 0, 1)).toBeCloseTo(0, 1);
  });
  it('ημ(1/x) δεν έχει όριο στο 0', () => {
    expect(oneSided((x) => Math.sin(1 / x), 0, 1)).toBeNull();
  });
  it('πλευρικά όρια με άλμα', () => {
    const f = (x: number) => (x < 2 ? 1 : 3);
    expect(oneSided(f, 2, -1)).toBe(1);
    expect(oneSided(f, 2, 1)).toBe(3);
  });
});

describe('παράγωγος και ασύμπτωτες', () => {
  it('κλίση της x² στο 1,5 είναι 3', () => {
    expect(slope((x) => x * x, 1.5)).toBeCloseTo(3, 4);
  });
  it('1/(x−2)+x/2: κατακόρυφη x=2 και πλάγια y=0,5x', () => {
    const a = asymptotes((x) => 1 / (x - 2) + x / 2, -10, 10);
    expect(a.vx).toHaveLength(1);
    expect(a.vx[0]).toBeCloseTo(2, 3);
    expect(a.lines).toEqual([{ m: 0.5, b: 0 }]);
  });
  it('1/x²: κατακόρυφη στο 0 χωρίς αλλαγή προσήμου, οριζόντια y=0', () => {
    const a = asymptotes((x) => 1 / (x * x), -10, 10);
    expect(a.vx).toHaveLength(1);
    expect(a.vx[0]).toBeCloseTo(0, 3);
    expect(a.lines).toEqual([{ m: 0, b: 0 }]);
  });
  it('ln(x+4): κατακόρυφη στο −4', () => {
    const a = asymptotes((x) => Math.log(x + 4), -10, 10);
    expect(a.vx.map((v) => Math.round(v * 100) / 100)).toEqual([-4]);
  });
  it('πολυώνυμα, ευθείες και ημίτονο δεν έχουν ασύμπτωτες', () => {
    for (const f of [(x: number) => x * x, (x: number) => 2 * x + 1, Math.sin, () => 3]) {
      const a = asymptotes(f, -10, 10);
      expect(a.vx).toEqual([]);
      expect(a.lines).toEqual([]);
    }
  });
  it('εφ x: ασύμπτωτες στα π/2 + kπ', () => {
    const a = asymptotes(Math.tan, -5, 5);
    expect(a.vx.map((v) => +(v / Math.PI).toFixed(3)).sort((p, q) => p - q)).toEqual([-1.5, -0.5, 0.5, 1.5]);
  });
});

describe('μορφοποίηση', () => {
  it('αριθμοί με ελληνική υποδιαστολή και κανονικό μείον', () => {
    expect(nf(2.333)).toBe('2,33');
    expect(nf(-0.5)).toBe('−0,5');
    expect(nf(-0.001)).toBe('0');
    expect(nf(Infinity)).toBe('+∞');
    expect(nf(NaN)).toBe('—');
  });
  it('εξισώσεις ευθειών', () => {
    expect(lineEq(2, -1)).toBe('y = 2x − 1');
    expect(lineEq(1, 0)).toBe('y = x');
    expect(lineEq(-1, 2.5)).toBe('y = −x + 2,5');
    expect(lineEq(0, 3)).toBe('y = 3');
  });
});

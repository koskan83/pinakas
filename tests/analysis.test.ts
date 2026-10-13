import { describe, expect, it } from 'vitest';
import { asymptotes, integrate, lineEq, nf, oneSided, riemann, slope, crossings, enclosing, fitScaleX, fitScaleY, pickAxesMode } from '../src/analysis';
import { parseFigureReply, parseGraphReply } from '../src/ai';
import { domText, fnOf } from '../src/expr';

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

describe('fitScaleY', () => {
  const fit = (g: (x: number) => number, up = 10, down = 10, xmin = -10): number => fitScaleY([g], xmin, 10, up, down);
  it('η y = −200x θέλει 200 ανά γραμμή', () => expect(fit((x) => -200 * x)).toBe(200));
  it('γνώριμες καμπύλες μένουν στο 1', () => {
    expect(fit((x) => x * x)).toBe(1);
    expect(fit((x) => 1 / x)).toBe(1);
    expect(fit(Math.sin)).toBe(1);
    expect(fit((x) => 2 * x - 1)).toBe(1);
  });
  it('πολύ μικρές τιμές μεγεθύνονται', () => expect(fit((x) => 0.001 * x)).toBe(0.001));
  it('στο 1ο τεταρτημόριο τα αρνητικά δεν μετράνε', () => expect(fit((x) => 50 * x, 10, 0, 0)).toBe(50));
  it('χωρίς συναρτήσεις, 1', () => expect(fitScaleY([], -10, 10, 10, 10)).toBe(1));
  it('με δύο συναρτήσεις χωράνε και οι δύο', () => expect(fitScaleY([(x) => x, (x) => -200 * x], -10, 10, 10, 10)).toBe(200));
});

describe('γραφική παράσταση από το AI', () => {
  it('διαβάζει τύπο, πεδίο ορισμού και ονόματα', () => {
    expect(parseGraphReply('F: 10-2x\nD: 0 ; 5\nX: t\nY: υ')).toEqual({ fns: [{ expr: '10-2x', dom: [0, 5] }], lx: 't', ly: 'υ' });
    expect(parseGraphReply('F: y = -200x\nX: x\nY: y')).toEqual({ fns: [{ expr: '-200x' }] });
    expect(parseGraphReply('F: √(x)\nD: 0 ; inf')).toEqual({ fns: [{ expr: '√(x)', dom: [0, null] }] });
    expect(parseGraphReply('').fns).toEqual([]);
  });
  it('κλάδοι: κάθε F με το δικό του D', () => {
    const r = parseGraphReply('F: x²\nD: -inf ; 0\nF: 2x\nD: 0 ; inf');
    expect(r.fns).toEqual([{ expr: 'x²', dom: [null, 0] }, { expr: '2x', dom: [0, null] }]);
  });
  it('η fnOf δεν ορίζεται έξω από το πεδίο', () => {
    const f = fnOf({ expr: '2x', dom: [0, 5] })!;
    expect(f(-1)).toBeNaN();
    expect(f(3)).toBe(6);
    expect(f(6)).toBeNaN();
    expect(domText([0, 5], 't')).toBe('0 ≤ t ≤ 5');
    expect(domText([0, null])).toBe('x ≥ 0');
  });
  it('διαλέγει άξονες από το πεδίο ορισμού και τις τιμές', () => {
    const g = (expr: string, dom?: [number | null, number | null]) => { const f = fnOf({ expr, dom })!; return (x: number) => f(x); };
    expect(pickAxesMode([g('10-2x', [0, 5])], 10)).toBe('q1');
    expect(pickAxesMode([g('10-2x', [0, null])], 10)).toBe('q14');
    expect(pickAxesMode([g('-200x')], 10)).toBe('full');
    expect(pickAxesMode([g('√(x)')], 10)).toBe('q1');
    expect(pickAxesMode([g('ln(x)')], 10)).toBe('q14');
    expect(pickAxesMode([], 10)).toBe('full');
  });
});

describe('fitScaleX', () => {
  it('το πεδίο ορισμού ορίζει την κλίμακα του x', () => {
    expect(fitScaleX([[0, 50]], 10)).toBe(5);
    expect(fitScaleX([[0, 5]], 10)).toBe(1);
    expect(fitScaleX([[-30, 100]], 10)).toBe(10);
    expect(fitScaleX([[0, 0.5]], 10)).toBe(0.05);
    expect(fitScaleX([[0, null]], 10)).toBe(1);
    expect(fitScaleX([[20, null]], 10)).toBe(5);
    expect(fitScaleX([undefined], 10)).toBe(1);
    expect(fitScaleX([[0, 50], undefined], 10)).toBe(1);
  });
});

describe('σημεία τομής', () => {
  it('παραβολή και ευθεία τέμνονται σε δύο σημεία', () => {
    expect(crossings((x) => x * x, (x) => x + 2, -10, 10)).toEqual([-1, 2]);
    expect(integrate((x) => x + 2 - x * x, -1, 2)).toBeCloseTo(4.5, 3);
  });
  it('ρίζες, όταν δεν υπάρχει δεύτερη συνάρτηση', () => {
    const xs = crossings((x) => x * x - 2, null, -10, 10);
    expect(xs).toHaveLength(2);
    expect(xs[1]).toBeCloseTo(Math.SQRT2, 5);
  });
  it('η ασύμπτωτη δεν είναι σημείο τομής', () => expect(crossings((x) => 1 / x, null, -10, 10)).toEqual([]));
  it('χωρίς τομή, κενό', () => expect(crossings((x) => x * x + 1, (x) => 0 * x, -10, 10)).toEqual([]));
  it('διαλέγει το χωρίο πιο κοντά στο σημείο που δίνεται', () => {
    expect(enclosing([-3, 0, 3], 2)).toEqual([0, 3]);
    expect(enclosing([-3, 0, 3], -1)).toEqual([-3, 0]);
    expect(enclosing([1], 0)).toBeNull();
  });
});

describe('σχήμα από εκφώνηση (απάντηση του AI)', () => {
  it('«NONE» σημαίνει ότι δεν χρειάζεται σχήμα· κενή ή άσχετη απάντηση δεν δίνει κομμάτια', () => {
    expect(parseFigureReply('NONE')).toBeNull();
    expect(parseFigureReply(' none.')).toBeNull();
    expect(parseFigureReply('')).toEqual([]);
    expect(parseFigureReply('Το σχήμα είναι:')).toEqual([]);
  });
  it('διαβάζει γραμμές, βέλη με χρώμα, ορθογώνια, κύκλους, τεθλασμένες και ετικέτες', () => {
    expect(parseFigureReply('L 5 50 95 50\nD 20 50 20 20\nR 35 34 59 50\nA 59 42 85 42 blue\nC 50 20 6\nP 10 50 40 20 40 50 10 50\nT 74 36 F = 10 N')).toEqual([
      { k: 'line', pts: [5, 50, 95, 50] },
      { k: 'line', pts: [20, 50, 20, 20], dash: true },
      { k: 'rect', pts: [35, 34, 59, 50] },
      { k: 'arrow', pts: [59, 42, 85, 42], color: 'blue' },
      { k: 'circle', x: 50, y: 20, r: 6 },
      { k: 'poly', pts: [[10, 50], [40, 20], [40, 50], [10, 50]] },
      { k: 'text', x: 74, y: 36, text: 'F = 10 N' },
    ]);
  });
  it('αντέχει περιτύλιγμα και αφήνει ό,τι δεν βγάζει νόημα', () => {
    const r = parseFigureReply('```\nA: 10 10 30 10\nT 20 5 "υ₀"\nL 1 2 3\nA 5 5 5 5 red\nC 50 50 900\nL 0 0 5000 0\nX 1 2 3 4\n```')!;
    expect(r).toEqual([{ k: 'arrow', pts: [10, 10, 30, 10], color: 'red' }, { k: 'text', x: 20, y: 5, text: 'υ₀' }]);
  });
});

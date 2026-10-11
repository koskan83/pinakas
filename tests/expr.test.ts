import { describe, expect, it } from 'vitest';
import { compile, compileCached, keyPoints, paramsOf } from '../src/expr';

describe('μεταγλωττιστής εκφράσεων', () => {
  it('πολυώνυμα με ², ^ και υπονοούμενο πολλαπλασιασμό', () => {
    expect(compile('x²-3x+2')(1)).toBeCloseTo(0);
    expect(compile('f(x)=2x^3')(2)).toBeCloseTo(16);
    expect(compile('2(x+1)(x-1)')(3)).toBeCloseTo(16);
    expect(compile('-x²')(3)).toBeCloseTo(-9);
  });

  it('ελληνικές συναρτήσεις, π και δεκαδικά με κόμμα', () => {
    expect(compile('ημ(π/2)')(0)).toBeCloseTo(1);
    expect(compile('συν x')(0)).toBeCloseTo(1);
    expect(compile('εφ(π/4)')(0)).toBeCloseTo(1);
    expect(compile('√x')(9)).toBeCloseTo(3);
    expect(compile('|x|')(-4)).toBeCloseTo(4);
    expect(compile('0,5x')(4)).toBeCloseTo(2);
    expect(compile('ln(e)')(0)).toBeCloseTo(1);
  });

  it('ημ(x)^2 είναι (ημ x)², ενώ ημ x^2 είναι ημ(x²)', () => {
    expect(compile('ημ(x)^2')(1)).toBeCloseTo(Math.sin(1) ** 2);
    expect(compile('ημ x^2')(2)).toBeCloseTo(Math.sin(4));
  });

  it('τα αγγλικά ονόματα απορρίπτονται με υπόδειξη', () => {
    expect(() => compile('sin(x)')).toThrow(/ημ/);
    expect(() => compile('sqrt(x)')).toThrow();
  });

  it('λάθος εκφράσεις πετάνε σφάλμα και η compileCached δίνει null', () => {
    expect(() => compile('')).toThrow();
    expect(() => compile('2+')).toThrow();
    expect(() => compile('(x+1')).toThrow();
    expect(compileCached('x+*')).toBeNull();
  });

  it('τα άγνωστα γράμματα είναι παράμετροι με προεπιλογή 1', () => {
    expect(paramsOf('a x² + b x + c')).toEqual(['a', 'b', 'c']);
    expect(paramsOf('ημ(ωx)')).toEqual(['ω']);
    const f = compile('a x + b');
    expect(f(2)).toBeCloseTo(3);
    expect(f(2, { a: 3, b: -1 })).toBeCloseTo(5);
  });
});

describe('ρίζες, ακρότατα, τομές', () => {
  const pts = (exprs: string[]) => keyPoints(exprs.map((e) => compile(e)), {}, -10, 10, -10, 10);

  it('ρίζες και ελάχιστο της x²-4', () => {
    const k = pts(['x²-4']);
    const roots = k.filter((p) => p.kind === 'root').map((p) => p.x).sort((a, b) => a - b);
    expect(roots).toHaveLength(2);
    expect(roots[0]).toBeCloseTo(-2, 3);
    expect(roots[1]).toBeCloseTo(2, 3);
    const ext = k.filter((p) => p.kind === 'ext');
    expect(ext).toHaveLength(1);
    expect(ext[0].x).toBeCloseTo(0, 2);
    expect(ext[0].y).toBeCloseTo(-4, 3);
  });

  it('η 1/x δεν έχει ρίζα στην ασύμπτωτη', () => {
    expect(pts(['1/x']).filter((p) => p.kind === 'root')).toHaveLength(0);
  });

  it('σημεία τομής x² και x+2', () => {
    const cross = pts(['x²', 'x+2']).filter((p) => p.kind === 'cross').map((p) => p.x).sort((a, b) => a - b);
    expect(cross[0]).toBeCloseTo(-1, 3);
    expect(cross[1]).toBeCloseTo(2, 3);
  });
});

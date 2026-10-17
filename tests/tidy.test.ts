import { describe, expect, it } from 'vitest';
import type { Pt, Stroke } from '../src/model';
import { tidyStrokes } from '../src/tidy';

/** Ένα «γράμμα»: κατακόρυφη γραμμή ύψους h με κέντρο (x, y) και πλάτος 10. */
const glyph = (id: string, x: number, y: number, h = 30): Stroke => ({
  kind: 'stroke', id, color: '#000', width: 3, hl: false,
  pts: [[x - 5, y - h / 2], [x, y + h / 2], [x + 5, y - h / 2]] as Pt[],
});
const cy = (s: Stroke): number => (Math.min(...s.pts.map((p) => p[1])) + Math.max(...s.pts.map((p) => p[1]))) / 2;
const x0 = (s: Stroke): number => Math.min(...s.pts.map((p) => p[0]));
const x1 = (s: Stroke): number => Math.max(...s.pts.map((p) => p[0]));

describe('Τακτοποίηση', () => {
  it('ισιώνει σειρά που ανεβαίνει (8°)', () => {
    const t = Math.tan((8 * Math.PI) / 180);
    const row = [0, 1, 2, 3, 4, 5].map((i) => glyph(`g${i}`, 100 + i * 40, 200 - i * 40 * t));
    const out = tidyStrokes(row).map(cy);
    expect(Math.max(...out) - Math.min(...out)).toBeLessThan(3);
  });
  it('διορθώνει το «κύμα», αλλά ο εκθέτης μένει ψηλότερα από τους γείτονές του', () => {
    const ys = [200, 208, 200, 192, 200, 208, 200];
    const row = ys.map((y, i) => glyph(`g${i}`, 100 + i * 25, y));
    // εκθέτης: μικρό σύμβολο πάνω δεξιά από το τρίτο
    row.push(glyph('sup', 100 + 2 * 25 + 14, 200 - 18, 12));
    const out = tidyStrokes(row);
    const main = out.filter((s) => s.id !== 'sup').map(cy);
    expect(Math.max(...main) - Math.min(...main)).toBeLessThan(ys.reduce((a, b) => Math.max(a, b)) - ys.reduce((a, b) => Math.min(a, b)));
    const sup = out.find((s) => s.id === 'sup')!;
    expect(cy(out[2]) - cy(sup)).toBeGreaterThan(12);
  });
  it('κάνει ίσα τα κενά ανάμεσα στις λέξεις, όχι ανάμεσα στα γράμματα', () => {
    // τρεις «λέξεις» των δύο γραμμάτων, με κενά 25 και 70 ανάμεσά τους
    const xs = [100, 113, 160, 173, 265, 278];
    const out = tidyStrokes(xs.map((x, i) => glyph(`g${i}`, x, 200)));
    const gapA = x0(out[2]) - x1(out[1]), gapB = x0(out[4]) - x1(out[3]);
    expect(Math.abs(gapA - gapB)).toBeLessThan(1);
    expect(x0(out[1]) - x1(out[0])).toBeCloseTo(3);
  });
  it('δύο σειρές μένουν χωριστές, η καθεμιά στο ύψος της', () => {
    const a = [0, 1, 2].map((i) => glyph(`a${i}`, 100 + i * 40, 200));
    const b = [0, 1, 2].map((i) => glyph(`b${i}`, 100 + i * 40, 300));
    const out = tidyStrokes([...a, ...b]);
    expect(cy(out[0])).toBeCloseTo(200);
    expect(cy(out[3])).toBeCloseTo(300);
  });
});

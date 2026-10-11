import { describe, expect, it } from 'vitest';
import { hlFlat, measureAngles, measureSides, radText } from '../src/board';
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

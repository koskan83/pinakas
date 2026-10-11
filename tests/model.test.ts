import { describe, expect, it } from 'vitest';
import {
  AngleItem, Item, Pt, Shape, Stroke, angleDegrees, cloneItem, erasePartial, hitItem, itemBounds, newDoc, pointInPolygon,
  recognizeShape, rotateItem, scaleItem, translateItem, trianglePts, unrot,
} from '../src/model';

const rect = (o: Partial<Shape> = {}): Shape => ({ kind: 'shape', id: 'r', shape: 'rect', x0: 0, y0: 0, x1: 200, y1: 100, color: '#111111', width: 4, ...o });
const line = (o: Partial<Shape> = {}): Shape => ({ kind: 'shape', id: 'l', shape: 'line', x0: 0, y0: 0, x1: 100, y1: 0, color: '#111111', width: 4, ...o });
const stroke = (pts: Pt[]): Stroke => ({ kind: 'stroke', id: 's', pts, color: '#111111', width: 4, hl: false });

describe('όρια και άγγιγμα', () => {
  it('το ορθογώνιο πιάνεται στο περίγραμμα, όχι στο εσωτερικό', () => {
    expect(hitItem(rect(), 100, 0, 6)).toBe(true);
    expect(hitItem(rect(), 100, 50, 6)).toBe(false);
  });
  it('η ευθεία πιάνεται κοντά της', () => {
    expect(hitItem(line(), 50, 5, 6)).toBe(true);
    expect(hitItem(line(), 50, 30, 6)).toBe(false);
  });
  it('τα όρια περιλαμβάνουν το πάχος της γραμμής', () => {
    expect(itemBounds(rect())).toEqual({ x0: -2, y0: -2, x1: 202, y1: 102 });
  });
  it('σημείο μέσα και έξω από πολύγωνο', () => {
    const tri: Pt[] = [[0, 0], [10, 0], [0, 10]];
    expect(pointInPolygon(2, 2, tri)).toBe(true);
    expect(pointInPolygon(8, 8, tri)).toBe(false);
  });
});

describe('μετακίνηση, κλίμακα, αντίγραφο', () => {
  it('η μετακίνηση μεταφέρει και τις κορυφές του τριγώνου', () => {
    const t = rect({ shape: 'triangle', pts: [[0, 100], [200, 100], [50, 0]] });
    const m = translateItem(t, 10, -5) as Shape;
    expect(m.pts).toEqual([[10, 95], [210, 95], [60, -5]]);
    expect([m.x0, m.y0]).toEqual([10, -5]);
  });
  it('η κλίμακα γύρω από σημείο διπλασιάζει αποστάσεις και πάχος', () => {
    const s = scaleItem(line({ x0: 10, y0: 10, x1: 20, y1: 10 }), 10, 10, 2) as Shape;
    expect([s.x0, s.y0, s.x1, s.y1, s.width]).toEqual([10, 10, 30, 10, 8]);
  });
  it('το αντίγραφο έχει νέο id και δεν κρατά τον δεσμό της συνισταμένης', () => {
    const sum = line({ link: { a: 'a', b: 'b', role: 'sum' } });
    const c = cloneItem(sum) as Shape;
    expect(c.id).not.toBe(sum.id);
    expect(c.link).toBeUndefined();
  });
});

describe('περιστροφή', () => {
  it('ευθεία κατά 90° γύρω από την αρχή της', () => {
    const r = rotateItem(line(), 0, 0, Math.PI / 2) as Shape;
    expect(r.x1).toBeCloseTo(0);
    expect(r.y1).toBeCloseTo(100);
  });
  it('το ορθογώνιο κρατά διαστάσεις και αποκτά γωνία· τα όρια του μεγαλώνουν', () => {
    const r = rotateItem(rect(), 100, 50, Math.PI / 2) as Shape;
    expect(r.rot).toBeCloseTo(Math.PI / 2);
    expect(r.x1 - r.x0).toBeCloseTo(200);
    const b = itemBounds(r);
    expect(b.x1 - b.x0).toBeCloseTo(104);
    expect(b.y1 - b.y0).toBeCloseTo(204);
  });
  it('το άγγιγμα ακολουθεί το στραμμένο σχήμα', () => {
    const r = rotateItem(rect(), 100, 50, Math.PI / 2);
    // η πάνω πλευρά (y = 0) βρίσκεται πλέον στα δεξιά, στο x = 150
    expect(hitItem(r, 150, 50, 6)).toBe(true);
    expect(hitItem(r, 100, 0, 6)).toBe(false);
  });
  it('unrot αναιρεί την περιστροφή', () => {
    const r = rotateItem(rect(), 100, 50, 0.7);
    const [x, y] = unrot(r, 100, 50);
    expect(x).toBeCloseTo(100);
    expect(y).toBeCloseTo(50);
  });
  it('το τρίγωνο στρέφει τις κορυφές του και κρατά τα μήκη των πλευρών', () => {
    const t = rect({ shape: 'triangle', pts: [[0, 0], [30, 0], [0, 40]] });
    const p = trianglePts(rotateItem(t, 5, 5, 1.1) as Shape);
    const d = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    expect(d(p[0], p[1])).toBeCloseTo(30);
    expect(d(p[1], p[2])).toBeCloseTo(50);
  });
  it('η γωνία στρέφει και τις δύο πλευρές της και κρατά το άνοιγμα', () => {
    const a: AngleItem = { kind: 'angle', id: 'a', x: 0, y: 0, a1: 0, a2: -Math.PI / 3, len1: 100, len2: 100, color: '#111111', width: 4 };
    const r = rotateItem(a, 0, 0, 0.5) as AngleItem;
    expect(angleDegrees(r)).toBe(60);
  });
});

describe('γόμα', () => {
  it('σβήνει τη μέση μιας γραμμής και αφήνει δύο κομμάτια', () => {
    const pts: Pt[] = Array.from({ length: 101 }, (_, i) => [i * 2, 0] as Pt);
    const out = erasePartial(stroke(pts), 100, 0, 10);
    expect(out).toHaveLength(2);
    for (const it of out as Item[]) expect(it.kind).toBe('stroke');
  });
  it('μακριά από τη γραμμή δεν αλλάζει τίποτα', () => {
    expect(erasePartial(stroke([[0, 0], [100, 0]]), 50, 80, 10)).toBeNull();
  });
  it('δεν σβήνει εικόνες και άξονες', () => {
    expect(erasePartial({ kind: 'image', id: 'i', x: 0, y: 0, w: 100, h: 100, src: '' }, 50, 50, 10)).toBeNull();
  });
});

describe('αναγνώριση σχήματος από χειρόγραφο', () => {
  it('σχεδόν ευθεία γραμμή γίνεται ευθεία', () => {
    const pts: Pt[] = Array.from({ length: 40 }, (_, i) => [i * 10, 200 + Math.sin(i) * 2] as Pt);
    const r = recognizeShape(pts);
    expect(r?.t).toBe('shape');
    if (r?.t === 'shape') expect(r.shape).toBe('line');
  });
  it('κύκλος γίνεται έλλειψη', () => {
    const pts: Pt[] = Array.from({ length: 73 }, (_, i) => [300 + 100 * Math.cos((i * 5 * Math.PI) / 180), 300 + 100 * Math.sin((i * 5 * Math.PI) / 180)] as Pt);
    const r = recognizeShape(pts);
    if (r?.t === 'shape') expect(r.shape).toBe('ellipse');
    else expect(r).not.toBeNull();
  });
  it('λίγα σημεία δεν αναγνωρίζονται', () => {
    expect(recognizeShape([[0, 0], [1, 1]])).toBeNull();
  });
});

describe('έγγραφο', () => {
  it('νέο έγγραφο: έκδοση 1 και μία κενή σελίδα', () => {
    const d = newDoc();
    expect(d.v).toBe(1);
    expect(d.pages).toHaveLength(1);
    expect(d.pages[0].items).toEqual([]);
  });
});

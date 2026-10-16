import { describe, expect, it } from 'vitest';
import {
  AngleItem, Item, Pic, Pt, Shape, Stroke, angleDegrees, cloneItem, erasePartial, flipItem, hitItem, itemBounds, itemFlip, newDoc, pointInPolygon,
  recognizeShape, rotateItem, scaleItem, translateItem, trianglePts, unrot, wrapText, readDoc, DOC_V } from '../src/model';

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
  /** Κλειστό περίγραμμα από κορυφές, με λίγο «τρέμουλο» σαν του χεριού. */
  const outline = (v: Pt[], wob = 2): Pt[] => {
    const out: Pt[] = [];
    v.forEach((a, i) => {
      const b = v[(i + 1) % v.length];
      for (let k = 0; k < 20; k++) out.push([a[0] + ((b[0] - a[0]) * k) / 20 + Math.sin(i * 7 + k) * wob, a[1] + ((b[1] - a[1]) * k) / 20 + Math.cos(i * 5 + k * 2) * wob]);
    });
    out.push([v[0][0] + 3, v[0][1] - 2]);
    return out;
  };
  const kind = (v: Pt[]): string | undefined => {
    const r = recognizeShape(outline(v));
    return r?.t === 'shape' ? r.shape : r?.t;
  };
  it('ρόμβος: ίσες πλευρές και κάθετες διαγώνιες', () => {
    const r = recognizeShape(outline([[200, 100], [320, 205], [195, 300], [80, 198]]));
    expect(r?.t === 'shape' && r.shape).toBe('rhombus');
    if (r?.t !== 'shape' || !r.pts) return;
    const p = r.pts;
    const L = p.map((a, i) => Math.hypot(p[(i + 1) % 4][0] - a[0], p[(i + 1) % 4][1] - a[1]));
    expect(Math.max(...L) - Math.min(...L)).toBeLessThan(1e-6);
    // η κατακόρυφη διαγώνιος «κούμπωσε» ακριβώς
    expect(Math.min(Math.abs(p[0][0] - p[2][0]), Math.abs(p[1][0] - p[3][0]))).toBeLessThan(1e-6);
  });
  it('παραλληλόγραμμο: απέναντι πλευρές ίσες, η βάση οριζόντια', () => {
    const r = recognizeShape(outline([[150, 100], [420, 104], [360, 250], [92, 247]]));
    expect(r?.t === 'shape' && r.shape).toBe('para');
    if (r?.t !== 'shape' || !r.pts) return;
    const p = r.pts;
    expect(Math.hypot(p[1][0] - p[0][0] - (p[2][0] - p[3][0]), p[1][1] - p[0][1] - (p[2][1] - p[3][1]))).toBeLessThan(1e-6);
    expect(p.some((a, i) => Math.abs(a[1] - p[(i + 1) % 4][1]) < 1e-6)).toBe(true);
  });
  it('τα παλιά σχήματα μένουν όπως ήταν', () => {
    expect(kind([[100, 100], [400, 104], [397, 250], [103, 247]])).toBe('rect');
    expect(kind([[100, 100], [250, 97], [252, 251], [98, 248]])).toBe('rect');
    expect(kind([[250, 80], [420, 300], [90, 310]])).toBe('triangle');
    expect(kind([[250, 80], [300, 300], [90, 200]])).toBe('triangle');
    const circle: Pt[] = Array.from({ length: 73 }, (_, i) => [300 + 100 * Math.cos((i * 5 * Math.PI) / 180), 300 + 70 * Math.sin((i * 5 * Math.PI) / 180)] as Pt);
    const c = recognizeShape(circle);
    expect(c?.t === 'shape' && c.shape).toBe('ellipse');
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

describe('μετρημένη γωνία (τόξο)', () => {
  const a: AngleItem = { kind: 'angle', id: 'm', x: 0, y: 0, a1: 0, a2: Math.PI / 2, len1: 100, len2: 100, color: '#111111', width: 3, arc: true };
  it('πιάνεται μέσα στο άνοιγμα και πάνω στις μοίρες', () => {
    expect(hitItem(a, 20, 20, 8)).toBe(true);
    expect(hitItem(a, 66 * Math.SQRT1_2, 66 * Math.SQRT1_2, 8)).toBe(true);
  });
  it('δεν πιάνεται έξω από το άνοιγμα ή μακριά πάνω στις πλευρές', () => {
    expect(hitItem(a, -25, -25, 8)).toBe(false);
    expect(hitItem(a, 90, 0, 8)).toBe(false);
  });
  it('η γόμα τμημάτων τη σβήνει ολόκληρη', () => {
    expect(erasePartial(a, 20, 20, 8)).toEqual([]);
    expect(erasePartial(a, 90, 0, 8)).toBeNull();
  });
});

describe('wrapText', () => {
  // κάθε χαρακτήρας «πιάνει» 10 μονάδες
  const m = (t: string): number => t.length * 10;
  it('σπάει μια μακριά γραμμή σε γραμμές που χωράνε', () => {
    const out = wrapText('ένα δύο τρία τέσσερα πέντε', 20, 100, m);
    expect(out.split('\n').every((l) => m(l) <= 100)).toBe(true);
    expect(out.replace(/\n/g, ' ')).toBe('ένα δύο τρία τέσσερα πέντε');
  });
  it('κρατά τις αλλαγές γραμμής που υπάρχουν ήδη', () => {
    expect(wrapText('α β\nγ', 20, 1000, m)).toBe('α β\nγ');
  });
  it('μια λέξη μεγαλύτερη από το πλάτος μένει ολόκληρη σε δική της γραμμή', () => {
    expect(wrapText('μικρή τεράστιαλέξηχωρίςκενά τέλος', 20, 80, m)).toBe('μικρή\nτεράστιαλέξηχωρίςκενά\nτέλος');
  });
});

describe('καθρέφτης', () => {
  const pic = (o: Partial<Pic> = {}): Pic => ({ kind: 'image', id: 'p', x: 0, y: 0, w: 100, h: 50, src: '', ...o });
  it('η γραμμή αλλάζει πλευρά ως προς τον άξονα', () => {
    const s = flipItem(stroke([[10, 0], [40, 20]]), false, 50) as Stroke;
    expect(s.pts).toEqual([[90, 0], [60, 20]]);
    const v = flipItem(stroke([[10, 0], [40, 20]]), true, 10) as Stroke;
    expect(v.pts).toEqual([[10, 20], [40, 0]]);
  });
  it('η εικόνα γίνεται κατοπτρική στη θέση της και ξαναγυρνά με δεύτερο πάτημα', () => {
    const once = flipItem(pic(), false, 50) as Pic;
    expect(once.fx).toBe(true);
    expect(once.x).toBe(0);
    expect(itemFlip(once)).toBe(true);
    // το σημείο δεξιά φαίνεται αριστερά
    expect(unrot(once, 90, 10)).toEqual([10, 10]);
    const twice = flipItem(once, false, 50) as Pic;
    expect(twice.fx).toBeUndefined();
  });
  it('πάνω–κάτω σε εικόνα: καθρέφτης και μισή στροφή', () => {
    const v = flipItem(pic(), true, 25) as Pic;
    expect(v.fx).toBe(true);
    expect(Math.abs(v.rot!)).toBeCloseTo(Math.PI);
    // το πάνω αριστερά σημείο της εικόνας φαίνεται κάτω αριστερά
    const [x, y] = unrot(v, 0, 50);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
  });
  it('το τρίγωνο καθρεφτίζει τις κορυφές του', () => {
    const t: Shape = { kind: 'shape', id: 't', shape: 'triangle', x0: 0, y0: 0, x1: 100, y1: 100, pts: [[0, 0], [0, 100], [100, 100]], color: '#111111', width: 4 };
    const f = flipItem(t, false, 50) as Shape;
    expect(f.pts).toEqual([[100, 0], [100, 100], [0, 100]]);
  });
  it('ο τριγωνομετρικός κύκλος μένει αναγνώσιμος: αλλάζει μόνο θέση', () => {
    const t: Item = { kind: 'trig', id: 'x', x: 0, y: 0, r: 100, a: 0.5, color: '#111111' };
    const f = flipItem(t, false, 1000);
    expect(f).toEqual({ ...t, x: 2000 });
    expect('fx' in f).toBe(false);
  });
});

describe('γράμματα των σχημάτων Φυσικής', () => {
  it('βρίσκει το φ του κεκλιμένου και τα m₁, m₂ της τροχαλίας', async () => {
    const { STAMPS, stampTexts } = await import('../src/stamps');
    const inc = stampTexts(STAMPS.incline, 320, 180);
    expect(inc.map((l) => l.t)).toEqual(['φ']);
    expect(inc[0].x).toBeCloseTo(320 * 0.21);
    expect(inc[0].size).toBeCloseTo(180 * 0.14);
    expect(stampTexts(STAMPS.pulley, 200, 300).map((l) => l.t)).toEqual(['m₁', 'm₂']);
  });
});

describe('ανάγνωση αποθηκευμένου πίνακα', () => {
  it('δέχεται σημερινό πίνακα χωρίς να πετάει δουλειά', () => {
    const d = readDoc({ v: 1, bg: 'grid', pages: [{ items: [rect()], view: { x: 5, y: 6, k: 2 } }] });
    expect(d.bg).toBe('grid');
    expect(d.pages[0].items).toHaveLength(1);
    expect(d.pages[0].view).toEqual({ x: 5, y: 6, k: 2 });
  });
  it('διορθώνει ό,τι λείπει ή είναι χαλασμένο', () => {
    const d = readDoc({ v: 1, bg: 'μωβ', pages: [{ items: [null, { kind: 'άγνωστο' }, { ...rect(), id: '' }] }] });
    expect(d.bg).toBe('white');
    expect(d.pages[0].items).toHaveLength(1);
    expect(d.pages[0].items[0].id).not.toBe('');
    expect(d.pages[0].view).toEqual({ x: 0, y: 0, k: 1 });
    expect(readDoc({ v: 1, pages: [] }).pages).toHaveLength(1);
  });
  it('απορρίπτει ό,τι δεν είναι πίνακας ή είναι από νεότερη έκδοση', () => {
    expect(() => readDoc(null)).toThrow('Μη έγκυρο');
    expect(() => readDoc({ pages: [] })).toThrow('Μη έγκυρο');
    expect(() => readDoc({ v: DOC_V + 1, pages: [] })).toThrow('νεότερη');
  });
});

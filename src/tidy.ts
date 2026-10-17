/**
 * «Τακτοποίηση» χειρόγραφου, χωρίς αναγνώριση: η γραφή μένει χειρόγραφη, μόνο μπαίνει σε τάξη.
 * Για κάθε σειρά: ισιώνει την κλίση της, διορθώνει το «κύμα» (λέξεις που ανεβαίνουν ή κατεβαίνουν)
 * και κάνει ίσα τα κενά ανάμεσα στις λέξεις. Εκθέτες, δείκτες (H₂O) και κλάσματα κρατούν τη θέση τους
 * ως προς τους γείτονές τους, γιατί κάθε σύμβολο μετακινείται μαζί με τα διπλανά του.
 */

import type { Pt, Stroke } from './model';

interface Box { x0: number; y0: number; x1: number; y1: number }

const boxOf = (pts: Pt[]): Box => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
};
const union = (a: Box, b: Box): Box => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) });
const median = (v: number[]): number => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};

/** Ένα «σύμβολο»: γραμμές που επικαλύπτονται οριζόντια (π.χ. οι δύο του «=», η τελεία του «i», ένα κλάσμα). */
interface Glyph { ids: number[]; box: Box }

/** Ομάδες από στοιχεία με διαστήματα [a, b] που ακουμπούν (μέσα σε `gap`): ό,τι επικαλύπτεται γίνεται ένα. */
function clusters(n: number, lo: (i: number) => number, hi: (i: number) => number, gap: number): number[][] {
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => lo(a) - lo(b));
  const out: number[][] = [];
  let end = -Infinity;
  for (const i of order) {
    if (out.length && lo(i) <= end + gap) {
      out[out.length - 1].push(i);
      end = Math.max(end, hi(i));
    } else {
      out.push([i]);
      end = hi(i);
    }
  }
  return out;
}

const movePts = (pts: Pt[], f: (p: Pt) => Pt): Pt[] => pts.map(f);

/**
 * Τακτοποιεί τις γραμμές του χεριού (ίδια id, νέα σημεία). Ό,τι δεν είναι γραφή (λιγότερα από 2 σύμβολα σε μια σειρά)
 * μένει όπως είναι.
 */
export function tidyStrokes(strokes: Stroke[]): Stroke[] {
  if (strokes.length < 2) return strokes;
  const pts = strokes.map((s) => s.pts.map((p): Pt => [p[0], p[1]]));
  const boxes = () => pts.map(boxOf);
  let bx = boxes();
  const hs = bx.map((b) => b.y1 - b.y0).filter((h) => h > 2);
  const H = Math.max(median(hs), 8);

  // 1. σειρές: ό,τι χωρίζεται κάθετα με κενό πάνω από μισό ύψος γραμμάτων είναι άλλη σειρά (το κλάσμα μένει ενωμένο)
  const rows = clusters(strokes.length, (i) => bx[i].y0, (i) => bx[i].y1, H * 0.5);
  for (const row of rows) {
    const glyphsOf = (): Glyph[] => {
      bx = boxes();
      return clusters(row.length, (k) => bx[row[k]].x0, (k) => bx[row[k]].x1, 0)
        .map((g) => ({ ids: g.map((k) => row[k]), box: g.map((k) => bx[row[k]]).reduce(union) }))
        .sort((a, b) => a.box.x0 - b.box.x0);
    };
    let gl = glyphsOf();
    if (gl.length < 2) continue;
    const cy = (g: Glyph): number => (g.box.y0 + g.box.y1) / 2;
    const cx = (g: Glyph): number => (g.box.x0 + g.box.x1) / 2;

    // 2. κλίση: ευθεία ελαχίστων τετραγώνων από τα κέντρα των συμβόλων· μόνο για μικρές κλίσεις (ως 12°)
    if (gl.length >= 3) {
      const mx = gl.reduce((a, g) => a + cx(g), 0) / gl.length, my = gl.reduce((a, g) => a + cy(g), 0) / gl.length;
      let sxx = 0, sxy = 0;
      for (const g of gl) {
        sxx += (cx(g) - mx) ** 2;
        sxy += (cx(g) - mx) * (cy(g) - my);
      }
      const ang = sxx > 0 ? Math.atan(sxy / sxx) : 0;
      if (Math.abs(ang) > 0.01 && Math.abs(ang) < (12 * Math.PI) / 180) {
        const c = Math.cos(-ang), s = Math.sin(-ang);
        for (const i of row) pts[i] = movePts(pts[i], ([x, y]) => [mx + (x - mx) * c - (y - my) * s, my + (x - mx) * s + (y - my) * c]);
        gl = glyphsOf();
      }
    }

    // 3. «κύμα»: κάθε σύμβολο πάει εκεί που θα ήταν αν η τοπική μέση γραμμή (διάμεσος των 5 γειτόνων) ήταν ίσια
    if (gl.length >= 3) {
      const line = median(gl.map(cy));
      const trend = gl.map((_, i) => median(gl.slice(Math.max(0, i - 2), i + 3).map(cy)));
      gl.forEach((g, i) => {
        const dy = line - trend[i];
        if (Math.abs(dy) > 0.5) for (const k of g.ids) pts[k] = movePts(pts[k], ([x, y]) => [x, y + dy]);
      });
      gl = glyphsOf();
    }

    // 4. κενά ανάμεσα στις λέξεις: όσα είναι πάνω από 0,4 του ύψους γίνονται ίσα (ο διάμεσός τους)· τα γράμματα μέσα στη λέξη δεν αλλάζουν
    const gaps = gl.slice(1).map((g, i) => g.box.x0 - gl[i].box.x1);
    const rowH = Math.max(median(gl.map((g) => g.box.y1 - g.box.y0)), 8);
    const wordGaps = gaps.filter((d) => d > rowH * 0.4);
    if (wordGaps.length >= 2) {
      const want = median(wordGaps);
      let shift = 0;
      gl.forEach((g, i) => {
        if (i > 0 && gaps[i - 1] > rowH * 0.4) shift += want - gaps[i - 1];
        if (Math.abs(shift) > 0.5) for (const k of g.ids) pts[k] = movePts(pts[k], ([x, y]) => [x + shift, y]);
      });
    }
  }
  return strokes.map((s, i) => ({ ...s, pts: pts[i] }));
}

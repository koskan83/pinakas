/** Χτίσιμο με κυβάκια. */
import type { StampDef } from '../stamps';
import { type C, FONT, fullIcon, kid, rrect, text } from './common';

const BCOLS = 24, BROWS = 14;
/** Τα κουτιά του πλέγματος (0 = κενό). Χτισίματα από την πρώτη, μικρότερη έκδοση (16 × 10) μεταφέρονται κάτω αριστερά. */
function bcells(v: number[]): number[] {
  const out = new Array<number>(BCOLS * BROWS).fill(0);
  if (v.length === 161) {
    for (let i = 0; i < 160; i++) out[(Math.floor(i / 16) + BROWS - 10) * BCOLS + (i % 16)] = v[1 + i] ?? 0;
    return out;
  }
  for (let i = 0; i < out.length; i++) out[i] = v[1 + i] ?? 0;
  return out;
}
/** Τα υλικά: βασικό χρώμα, σκούρα και ανοιχτή απόχρωση για την «υφή». */
const BLOCKS: { name: string; base: string; dark: string; light: string; top?: string; px?: string[]; pal?: Record<string, string> }[] = [
  { name: 'Γρασίδι', base: '#8b5a2b', dark: '#6b4423', light: '#a9713a', top: '#4caf50' },
  { name: 'Χώμα', base: '#8b5a2b', dark: '#6b4423', light: '#a9713a' },
  { name: 'Πέτρα', base: '#9ca3af', dark: '#6b7280', light: '#d1d5db' },
  { name: 'Ξύλο', base: '#b98146', dark: '#8a5a2b', light: '#d9a066' },
  { name: 'Κορμός', base: '#6b4423', dark: '#4a2f17', light: '#8b5a2b' },
  { name: 'Φύλλα', base: '#2e7d32', dark: '#1b5e20', light: '#66bb6a' },
  { name: 'Τούβλα', base: '#c0392b', dark: '#8e2a20', light: '#e57368' },
  { name: 'Άμμος', base: '#f4d58d', dark: '#d9b45f', light: '#fbe7b5' },
  { name: 'Νερό', base: '#3b82f6', dark: '#1d4ed8', light: '#93c5fd' },
  { name: 'Γυαλί', base: '#bae6fd', dark: '#7dd3fc', light: '#f0f9ff' },
  { name: 'Χρυσός', base: '#facc15', dark: '#ca8a04', light: '#fef08a' },
  // χαρακτήρες και στολίδια: ζωγραφιές 8 × 8 «ψηφίδων» πάνω στον ουρανό, δεν μετράνε στα κυβάκια
  { name: 'Αγόρι', base: '', dark: '', light: '', pal: { H: '#5b3a1e', S: '#f2c29b', e: '#1f2937', B: '#2563eb', P: '#1e3a8a' },
    px: ['..HHHH..', '..SSSS..', '..eSSe..', '.BBBBBB.', '.SBBBBS.', '..BBBB..', '..PPPP..', '..P..P..'] },
  { name: 'Κορίτσι', base: '', dark: '', light: '', pal: { H: '#7c2d12', S: '#f2c29b', e: '#1f2937', R: '#ec4899' },
    px: ['.HHHHHH.', 'HHSSSSHH', 'HHeSSeHH', 'H.SSSS.H', '.RRRRRR.', '.SRRRRS.', '.RRRRRR.', '..S..S..'] },
  { name: 'Γουρουνάκι', base: '', dark: '', light: '', pal: { P: '#f9a8d4', e: '#1f2937', n: '#db2777' },
    px: ['........', 'P......P', '.PPPPPP.', 'PPePPePP', 'PPPnnPPP', 'PPPPPPPP', '.PPPPPP.', '.P.PP.P.'] },
  { name: 'Τερατάκι', base: '', dark: '', light: '', pal: { G: '#4ade80', e: '#14532d', d: '#166534' },
    px: ['.GGGGGG.', 'GGGGGGGG', 'GeeGGeeG', 'GeeGGeeG', 'GGGddGGG', 'GGddddGG', 'GGdGGdGG', '.GG..GG.'] },
  { name: 'Λουλούδι', base: '', dark: '', light: '', pal: { R: '#f43f5e', Y: '#facc15', g: '#16a34a' },
    px: ['...RR...', '..RYYR..', '..RYYR..', '...RR...', '...g....', '..gg.g..', '...ggg..', '...g....'] },
  { name: 'Πόρτα', base: '', dark: '', light: '', pal: { W: '#5b3a1e', d: '#b98146', y: '#facc15' },
    px: ['.WWWWWW.', '.WddddW.', '.WddddW.', '.WddddW.', '.WdddyW.', '.WddddW.', '.WddddW.', '.WddddW.'] },
];
/** Ένα κυβάκι σε στιλ pixel: βασικό χρώμα, λίγες «ψηφίδες» για υφή, σκούρο περίγραμμα. */
function drawBlock(c: C, type: number, x: number, y: number, s: number): void {
  const b = BLOCKS[type];
  if (!b) return;
  if (b.px) {
    const q = s / 8;
    b.px.forEach((row, j) => {
      for (let i = 0; i < 8; i++) {
        const col = b.pal?.[row[i]];
        if (!col) continue;
        c.fillStyle = col;
        // μισό pixel επικάλυψη, για να μη φαίνονται ραφές ανάμεσα στις ψηφίδες
        c.fillRect(x + i * q, y + j * q, q + 0.5, q + 0.5);
      }
    });
    return;
  }
  c.fillStyle = b.base;
  c.fillRect(x, y, s, s);
  const q = s / 4;
  // σταθερές θέσεις ανά υλικό, ώστε το ίδιο κυβάκι να φαίνεται πάντα ίδιο
  const spots: [number, number, boolean][] = [[0, 1, true], [2, 0, false], [3, 2, true], [1, 3, false], [2, 2, true], [0, 3, false]];
  for (const [i, j, dk] of spots) {
    c.fillStyle = dk ? b.dark : b.light;
    c.fillRect(x + ((i + type) % 4) * q, y + j * q, q, q);
  }
  if (b.top) {
    c.fillStyle = b.top;
    c.fillRect(x, y, s, q * 1.2);
    c.fillStyle = '#2e7d32';
    c.fillRect(x + q, y + q * 1.2, q * 0.5, q * 0.5);
    c.fillRect(x + q * 2.6, y + q * 1.2, q * 0.5, q * 0.7);
  }
  c.strokeStyle = 'rgba(0,0,0,0.45)';
  c.lineWidth = Math.max(1, s * 0.04);
  c.strokeRect(x, y, s, s);
}
/** Διάταξη του εργαλείου: πλέγμα επάνω, σειρά υλικών κάτω (υλικά, γόμα, καθάρισμα, και στο τέλος «όλη η οθόνη» ή πόρτα επιστροφής). */
function buildGeom(w: number, h: number): { s: number; gh: number; slots: number; sw: number; py: number; ps: number } {
  const s = w / BCOLS, gh = s * BROWS;
  const slots = BLOCKS.length + 3, sw = w / slots;
  return { s, gh, slots, sw, py: gh + (h - gh) / 2, ps: Math.min(sw * 0.74, (h - gh) * 0.7) };
}

export const BUILD_KIDS: Record<string, StampDef> = {
  build: kid({
    label: 'Χτίσιμο με κυβάκια', w: 960, h: 640, init: [0],
    drawKid(c, w, h, v, env) {
      const g = buildGeom(w, h);
      // ουρανός και αχνό πλέγμα, για να φαίνεται πού μπαίνει κάθε κυβάκι
      c.save();
      c.fillStyle = '#e0f2fe';
      c.fillRect(0, 0, w, g.gh);
      c.strokeStyle = 'rgba(30,64,175,0.14)';
      c.lineWidth = 1;
      c.beginPath();
      for (let i = 0; i <= BCOLS; i++) { c.moveTo(i * g.s, 0); c.lineTo(i * g.s, g.gh); }
      for (let j = 0; j <= BROWS; j++) { c.moveTo(0, j * g.s); c.lineTo(w, j * g.s); }
      c.stroke();
      let count = 0;
      const cells = bcells(v);
      for (let i = 0; i < BCOLS * BROWS; i++) {
        const t = cells[i];
        if (!t) continue;
        if (!BLOCKS[t - 1]?.px) count++;
        drawBlock(c, t - 1, (i % BCOLS) * g.s, Math.floor(i / BCOLS) * g.s, g.s);
      }
      c.restore();
      c.lineWidth = 2;
      c.strokeRect(0, 0, w, g.gh);
      // σειρά υλικών: το επιλεγμένο έχει πλαίσιο
      const sel = v[0] ?? 0;
      for (let k = 0; k < g.slots; k++) {
        const cx = g.sw * (k + 0.5), x = cx - g.ps / 2, y = g.py - g.ps / 2;
        if (k < BLOCKS.length) drawBlock(c, k, x, y, g.ps);
        else if (k < BLOCKS.length + 2) text(c, k === BLOCKS.length ? '🧽' : '🗑️', cx, g.py + 1, g.ps * 0.8);
        // πόρτα επιστροφής (σε όλη την οθόνη) ή «όλη η οθόνη»
        else fullIcon(c, cx, g.py, g.ps, env);
        if (k === sel) {
          c.save();
          c.strokeStyle = env.ink;
          c.lineWidth = Math.max(3, g.ps * 0.09);
          rrect(c, x - g.ps * 0.14, y - g.ps * 0.14, g.ps * 1.28, g.ps * 1.28, g.ps * 0.16);
          c.stroke();
          c.restore();
        }
      }
      c.save();
      c.font = `700 ${g.s * 0.42}px ${FONT}`;
      c.textAlign = 'right';
      c.textBaseline = 'top';
      c.fillStyle = '#1e3a8a';
      c.fillText(`${count} κυβάκια`, w - g.s * 0.2, g.s * 0.14);
      c.restore();
    },
    fullAt(x, y, w, h) {
      const g = buildGeom(w, h);
      return y >= g.gh && y <= h && Math.floor(x / g.sw) === g.slots - 1;
    },
    paint(v, x, y, w, h, st, first) {
      const g = buildGeom(w, h);
      const out = [v[0] ?? 0, ...bcells(v)];
      const sel = out[0];
      if (y >= 0 && y < g.gh && x >= 0 && x < w) {
        if (st.pal) return null;
        const i = Math.floor(y / g.s) * BCOLS + Math.floor(x / g.s);
        // το επιλεγμένο υλικό μπαίνει πάντα (και πάνω σε άλλο κυβάκι)· σβήνει μόνο το σφουγγάρι
        const val = sel >= BLOCKS.length ? 0 : sel + 1;
        if (out[1 + i] === val) return first ? out : null;
        out[1 + i] = val;
        return out;
      }
      if (!first || y < g.gh || y > h) return null;
      st.pal = 1;
      const k = Math.max(0, Math.min(g.slots - 1, Math.floor(x / g.sw)));
      if (k > BLOCKS.length + 1) return null;
      if (k === BLOCKS.length + 1) return [sel >= BLOCKS.length ? 0 : sel];
      out[0] = k;
      return out;
    },
    fx(prev, next) {
      const a = bcells(prev), b = bcells(next);
      let put = 0, gone = 0;
      for (let i = 0; i < b.length; i++) {
        if (a[i] === b[i]) continue;
        if (b[i]) put++;
        else gone++;
      }
      return put ? 'tok' : gone ? 'wipe' : 'click';
    },
  }),
};

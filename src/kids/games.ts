/** Παιχνίδια της τάξης: ζάρι, κλήρωση, ψηφοφορία και ζυγαριά. */
import type { StampDef } from '../stamps';
import { bit, BLUE, fitText, flip, GOOD, GREEN, inR, kid, knob, ORANGE, PURPLE, RED, rrect, skinBtn, sum, text } from './common';

const POLL_COLORS = [BLUE, ORANGE, GREEN, PURPLE, RED];
/** Με δύο επιλογές η ψηφοφορία είναι ναι/όχι (ή σωστό/λάθος)· με περισσότερες, Α Β Γ Δ Ε. */
const pollName = (n: number, i: number): string => (n === 2 ? '✓✗'[i] : 'ΑΒΓΔΕ'[i]);
function pollGeom(v: number[], w: number, h: number): { n: number; top: number; gap: number; cw: number; lab: number; r: number } {
  const n = Math.max(2, Math.min(5, v[0] || 4)), top = h * 0.78, gap = w * 0.03;
  return { n, top, gap, cw: (w - gap * (n + 1)) / n, lab: h * 0.13, r: (h - top) * 0.36 };
}
// ---------- ζυγαριά ----------
const CHIPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
/** Τα βαρίδια προς επιλογή κάτω από τη ζυγαριά: για κάθε πλευρά δύο σειρές των πέντε (1–5 και 6–10), και στη μέση η σύγκριση. */
function chipGeom(w: number, h: number): { cr: number; my: number; at(i: number, side: number): [number, number] } {
  const step = w * 0.072;
  return {
    cr: w * 0.031,
    my: h * 0.86,
    at: (i, side) => [(side ? w * 0.642 : w * 0.07) + (i % 5) * step, h * (i < 5 ? 0.8 : 0.92)],
  };
}
interface Scale { left: number[]; right: number[]; show: boolean; goal?: boolean }
const readScale = (v: number[]): Scale => {
  const n = v[1] ?? 0;
  // το πρώτο στοιχείο: 1 = φαίνεται η σύγκριση, 2 = άσκηση «ισορρόπησε» (τα βαρίδια αριστερά είναι δοσμένα)
  return { show: !!((v[0] ?? 0) & 1), goal: !!((v[0] ?? 0) & 2), left: v.slice(2, 2 + n), right: v.slice(2 + n) };
};
const writeScale = (s: Scale): number[] => [(s.show ? 1 : 0) + (s.goal ? 2 : 0), s.left.length, ...s.left, ...s.right];
const scaleEq = (s: Scale): boolean => sum(s.left) === sum(s.right) && sum(s.left) > 0;
/** Νέα άσκηση ζυγαριάς: δύο βαρίδια αριστερά με άθροισμα πάνω από 10, ώστε δεξιά να χρειάζονται τουλάχιστον δύο. */
function scaleGoal(s: Scale): Scale {
  let a = 0, b = 0;
  while (a + b <= 10 || a + b === sum(s.left)) {
    a = 2 + Math.floor(Math.random() * 9);
    b = 2 + Math.floor(Math.random() * 9);
  }
  return { show: s.show, goal: true, left: [a, b], right: [] };
}
/** Γεωμετρία της ζυγαριάς για την τρέχουσα κλίση: θέσεις δίσκων και βαριδιών. */
/** Η κλίση του ζυγού: προς το μεγαλύτερο άθροισμα, ως ένα όριο. */
const scaleTilt = (s: Scale): number => Math.max(-0.2, Math.min(0.2, (sum(s.right) - sum(s.left)) * 0.035));
function scaleGeom(s: Scale, w: number, h: number, tilt?: number): { th: number; px: number; py: number; ends: [number, number][]; pans: [number, number][]; half: number; box: number; spots: { side: 0 | 1; k: number; x: number; y: number }[] } {
  const L = sum(s.left), R = sum(s.right);
  // γέρνει προς το μεγαλύτερο άθροισμα· η κλίση μεγαλώνει με τη διαφορά ως ένα όριο
  const th = tilt ?? scaleTilt(s);
  const px = w / 2, py = h * 0.2, arm = w * 0.33;
  const ends: [number, number][] = [[px - arm * Math.cos(th), py - arm * Math.sin(th)], [px + arm * Math.cos(th), py + arm * Math.sin(th)]];
  const drop = h * 0.3;
  const pans: [number, number][] = [[ends[0][0], ends[0][1] + drop], [ends[1][0], ends[1][1] + drop]];
  const half = w * 0.15, box = w * 0.062;
  const spots: { side: 0 | 1; k: number; x: number; y: number }[] = [];
  ([s.left, s.right] as number[][]).forEach((list, side) => {
    list.forEach((_, k) => {
      const col = k % 4, row = Math.floor(k / 4);
      spots.push({ side: side as 0 | 1, k, x: pans[side][0] + (col - 1.5) * box * 1.08, y: pans[side][1] - box * 0.56 - row * box * 1.08 });
    });
  });
  return { th, px, py, ends, pans, half, box, spots };
}

export const GAME_KIDS: Record<string, StampDef> = {
  dice: kid({
    label: 'Ζάρι', w: 150, h: 150, init: [5],
    drawKid(c, w, h, v, env) {
      rrect(c, 2, 2, w - 4, h - 4, w * 0.16);
      c.fillStyle = '#ffffff';
      c.fill();
      c.lineWidth = Math.max(3, w * 0.03);
      c.stroke();
      const p = [0.27, 0.5, 0.73];
      const dots: Record<number, [number, number][]> = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]] };
      c.fillStyle = '#1e293b';
      // «κυλάει» για μισό δευτερόλεπτο πριν δείξει τον αριθμό
      const rolling = env.anim && env.anim.t < 520;
      const face = rolling ? 1 + ((Math.floor(env.anim!.t / 65) * 5 + (v[0] ?? 1)) % 6) : Math.max(1, Math.min(6, v[0] ?? 1));
      for (const [i, j] of dots[face]) {
        c.beginPath();
        c.arc(w * p[i], h * p[j], w * 0.085, 0, Math.PI * 2);
        c.fill();
      }
      void env;
    },
    tap: (v) => { let n = 1 + Math.floor(Math.random() * 6); if (n === v[0]) n = 1 + (n % 6); return [n]; },
    fx: () => 'dice',
  }),

  lottery: kid({
    label: 'Κλήρωση', w: 240, h: 270, init: [0, 25],
    drawKid(c, w, h, v, env) {
      const names = env.names?.length ? env.names : null;
      const n = names ? names.length : v[1] || 25, top = h * 0.74;
      rrect(c, 2, 2, w - 4, top - 4, w * 0.12);
      c.save();
      c.fillStyle = PURPLE;
      c.globalAlpha = 0.18;
      c.fill();
      c.restore();
      c.lineWidth = Math.max(2.5, w * 0.014);
      c.stroke();
      // οι αριθμοί γυρίζουν γρήγορα πριν σταματήσει
      const spin = env.anim && env.anim.t < 780 && v[0] > 0 && env.anim.prev[1] === v[1];
      const shown = spin ? 1 + ((Math.floor(env.anim!.t / 55) * 7 + v[0]) % n) : v[0];
      c.save();
      if (spin) c.globalAlpha = 0.55;
      if (names) fitText(c, names[shown - 1] ?? '?', w / 2, top * 0.52, top * 0.3, w * 0.86, env.ink, 800);
      else text(c, shown ? String(shown) : '?', w / 2, top * 0.52, top * 0.52, env.ink, 800);
      c.restore();
      const r = (h - top) * 0.36, y = top + (h - top) / 2;
      if (names) {
        // με ονόματα: περνούν όλοι πριν ξαναβγεί κάποιος· το ⟳ ξεκινά νέο γύρο
        let left = 0;
        for (let i = 0; i < n; i++) if (!bit(v, 2, i)) left++;
        knob(c, w * 0.16, y, r, '⟳', env);
        fitText(c, `έμειναν ${left} από ${n}`, w * 0.62, y + 1, (h - top) * 0.3, w * 0.6, env.ink, 600);
        return;
      }
      knob(c, w * 0.16, y, r, '−', env);
      knob(c, w * 0.84, y, r, '+', env);
      text(c, `1 έως ${n}`, w / 2, y + 1, (h - top) * 0.36, env.ink, 600);
    },
    tap(v, x, y, w, h, env) {
      const n = v[1] || 25, top = h * 0.74, r = (h - top) * 0.36, sy = top + (h - top) / 2;
      const names = env?.names?.length ? env.names : null;
      if (names) {
        if (inR(x, y, w * 0.16, sy, r)) return [0, n];
        if (y < 0 || y >= top) return null;
        const N = names.length;
        let from = v;
        const free: number[] = [];
        for (let i = 0; i < N; i++) if (!bit(v, 2, i)) free.push(i);
        if (free.length === 0) {
          // βγήκαν όλοι: νέος γύρος, που δεν αρχίζει με τον ίδιο μαθητή
          from = [v[0], n];
          for (let i = 0; i < N; i++) if (i !== v[0] - 1 || N === 1) free.push(i);
        }
        const i = free[Math.floor(Math.random() * free.length)];
        const out = flip(from, 2, i);
        out[0] = i + 1;
        out[1] = n;
        return out;
      }
      if (y >= 0 && y < top) {
        let k = 1 + Math.floor(Math.random() * n);
        if (k === v[0] && n > 1) k = 1 + (k % n);
        return [k, n];
      }
      if (inR(x, y, w * 0.16, sy, r)) return n > 2 ? [0, n - 1] : null;
      if (inR(x, y, w * 0.84, sy, r)) return n < 99 ? [0, n + 1] : null;
      return null;
    },
    fx: (prev, next) => (next[0] > 0 && prev[1] === next[1] ? 'drum' : 'click'),
  }),

  // ψηφοφορία της τάξης πάνω στον πίνακα: [πόσες επιλογές, φαίνεται το αποτέλεσμα, ψήφοι κάθε επιλογής…]
  poll: kid({
    label: 'Ψηφοφορία', w: 560, h: 380, init: [4, 0, 0, 0, 0, 0, 0],
    drawKid(c, w, h, v, env) {
      const g = pollGeom(v, w, h);
      const votes = Array.from({ length: g.n }, (_, i) => v[2 + i] ?? 0);
      const total = sum(votes), most = Math.max(1, ...votes);
      const an = env.anim && env.anim.t < 350 ? env.anim : null;
      for (let i = 0; i < g.n; i++) {
        const x = g.gap + i * (g.cw + g.gap), name = pollName(g.n, i);
        c.save();
        c.fillStyle = POLL_COLORS[i];
        if (v[1]) {
          // αποτέλεσμα: ράβδος ανάλογη με τις ψήφους, ο αριθμός από πάνω και το ποσοστό μέσα
          const full = g.top - g.lab - h * 0.14, bh = Math.max(4, (full * votes[i]) / most), by = g.top - g.lab - bh;
          rrect(c, x, by, g.cw, bh, Math.min(10, g.cw * 0.08));
          c.fill();
          text(c, String(votes[i]), x + g.cw / 2, by - h * 0.055, h * 0.085, env.ink, 800);
          if (total && bh > h * 0.1) text(c, `${Math.round((100 * votes[i]) / total)}%`, x + g.cw / 2, by + bh / 2 + 1, Math.min(h * 0.06, g.cw * 0.24), '#ffffff', 700);
          text(c, name, x + g.cw / 2, g.top - g.lab / 2 + 1, g.lab * 0.72, env.ink, 800);
        } else {
          // ψηφοφορία: μεγάλο κουμπί για κάθε επιλογή· οι ψήφοι δεν φαίνονται, για να μην επηρεάζεται κανείς
          const hit = an && (an.prev[2 + i] ?? 0) < votes[i];
          rrect(c, x, h * 0.04, g.cw, g.top - h * 0.08, g.cw * 0.14);
          c.globalAlpha = hit ? 1 : 0.82;
          c.fill();
          c.globalAlpha = 1;
          text(c, name, x + g.cw / 2, g.top / 2 + 1, Math.min(g.cw * 0.6, g.top * 0.5) * (hit ? 1.12 : 1), '#ffffff', 800);
        }
        c.restore();
      }
      const y = g.top + (h - g.top) / 2;
      if (!total) {
        knob(c, w * 0.08, y, g.r, '−', env);
        knob(c, w * 0.2, y, g.r, '+', env);
      } else knob(c, w * 0.08, y, g.r, '⟳', env);
      text(c, total === 1 ? 'Ψήφισε 1' : `Ψήφισαν ${total}`, w * 0.5, y + 1, (h - g.top) * 0.36, env.ink, 600);
      skinBtn(c, w * 0.9, y, g.r, '📊', !!v[1], env);
    },
    tap(v, x, y, w, h) {
      const g = pollGeom(v, w, h), sy = g.top + (h - g.top) / 2;
      const votes = Array.from({ length: g.n }, (_, i) => v[2 + i] ?? 0);
      const total = sum(votes);
      if (inR(x, y, w * 0.9, sy, g.r)) return [g.n, v[1] ? 0 : 1, ...votes];
      if (!total) {
        if (inR(x, y, w * 0.08, sy, g.r)) return g.n > 2 ? [g.n - 1, 0] : null;
        if (inR(x, y, w * 0.2, sy, g.r)) return g.n < 5 ? [g.n + 1, 0] : null;
      } else if (inR(x, y, w * 0.08, sy, g.r)) return [g.n, 0];
      if (y < 0 || y >= g.top) return null;
      const i = Math.floor((x - g.gap / 2) / (g.cw + g.gap));
      if (i < 0 || i >= g.n) return null;
      votes[i]++;
      return [g.n, v[1] ? 1 : 0, ...votes];
    },
    fx: (prev, next) => (next[1] && !prev[1] ? 'drum' : 'click'),
  }),

  balance: kid({
    label: 'Ζυγαριά', w: 660, h: 430, init: [1, 0],
    drawKid(c, w, h, v, env) {
      const s = readScale(v);
      // μόλις αλλάξουν τα βάρη ο ζυγός πηγαίνει στη νέα θέση ταλαντευόμενος, όπως μια αληθινή ζυγαριά
      let tilt = scaleTilt(s);
      const an = env.anim && env.anim.t < 1400 ? env.anim : null;
      if (an) {
        const p = an.t / 1000;
        tilt += (scaleTilt(readScale(an.prev)) - tilt) * Math.exp(-4.2 * p) * Math.cos(9 * p);
      }
      const g = scaleGeom(s, w, h, tilt);
      const L = sum(s.left), R = sum(s.right);
      c.lineCap = 'round';
      c.lineJoin = 'round';
      // βάση και στύλος
      c.lineWidth = Math.max(5, w * 0.012);
      c.beginPath();
      c.moveTo(g.px, g.py);
      c.lineTo(g.px, h * 0.66);
      c.moveTo(g.px - w * 0.1, h * 0.66);
      c.lineTo(g.px + w * 0.1, h * 0.66);
      c.stroke();
      // ζυγός
      c.beginPath();
      c.moveTo(g.ends[0][0], g.ends[0][1]);
      c.lineTo(g.ends[1][0], g.ends[1][1]);
      c.stroke();
      c.beginPath();
      c.arc(g.px, g.py, w * 0.014, 0, Math.PI * 2);
      c.fill();
      // δίσκοι με τα σχοινιά τους
      c.lineWidth = Math.max(2, w * 0.004);
      for (let k = 0; k < 2; k++) {
        const [ex, ey] = g.ends[k], [px, py] = g.pans[k];
        c.beginPath();
        c.moveTo(ex, ey); c.lineTo(px - g.half, py);
        c.moveTo(ex, ey); c.lineTo(px + g.half, py);
        c.stroke();
        c.save();
        c.lineWidth = Math.max(4, w * 0.009);
        c.beginPath();
        c.moveTo(px - g.half, py);
        c.quadraticCurveTo(px, py + h * 0.07, px + g.half, py);
        c.closePath();
        c.globalAlpha = 0.18;
        c.fill();
        c.globalAlpha = 1;
        c.stroke();
        c.restore();
      }
      // βαρίδια: κουτάκια με τον αριθμό τους
      for (const p of g.spots) {
        const val = (p.side ? s.right : s.left)[p.k];
        rrect(c, p.x - g.box / 2, p.y - g.box / 2, g.box, g.box, g.box * 0.18);
        c.fillStyle = p.side ? ORANGE : BLUE;
        c.fill();
        c.save();
        c.strokeStyle = '#1e293b';
        c.lineWidth = 1.2;
        c.stroke();
        c.restore();
        text(c, String(val), p.x, p.y + 1, g.box * 0.56, '#ffffff', 700);
      }
      c.fillStyle = env.ink;
      // κάτω: τα βαρίδια που μπορείς να προσθέσεις σε κάθε πλευρά, και στη μέση η σύγκριση
      const cg = chipGeom(w, h), cr = cg.cr;
      CHIPS.forEach((n, i) => {
        for (const side of [0, 1]) {
          const [x, cy] = cg.at(i, side);
          c.beginPath();
          c.arc(x, cy, cr, 0, Math.PI * 2);
          c.save();
          c.fillStyle = side ? ORANGE : BLUE;
          c.globalAlpha = 0.85;
          c.fill();
          c.restore();
          text(c, String(n), x, cy + 1, cr * 1.05, '#ffffff', 700);
        }
      });
      // άσκηση: τα αριστερά βαρίδια είναι δοσμένα και ζητείται να ισορροπήσει η ζυγαριά από τα δεξιά
      skinBtn(c, w * 0.07, h * 0.1, w * 0.045, '🎯', !!s.goal, env);
      if (s.goal) fitText(c, L === R ? '✓ Ισορρόπησε!' : 'Ισορρόπησε τη ζυγαριά', w / 2, h * 0.06, h * 0.06, w * 0.6, L === R ? GOOD : env.ink, 700);
      c.fillStyle = env.ink;
      // όταν ισορροπήσει με βαρίδια και στις δύο πλευρές, η ισότητα «ανάβει» πράσινη για λίγο
      const glow = an && s.show && L === R && L > 0 && an.t < 1200 ? Math.sin((an.t / 1200) * Math.PI) : 0;
      text(c, s.show ? `${L} ${L === R ? '=' : L > R ? '>' : '<'} ${R}` : '?', w / 2, cg.my + 1, w * 0.04 * (1 + glow * 0.5), glow > 0.05 ? GREEN : env.ink, 800);
    },
    tap(v, x, y, w, h) {
      const s = readScale(v), g = scaleGeom(s, w, h);
      // 🎯: νέα άσκηση· αν η τρέχουσα δεν λύθηκε, τη σταματά
      if (inR(x, y, w * 0.07, h * 0.1, w * 0.045)) return writeScale(s.goal && !scaleEq(s) ? { ...s, goal: false } : scaleGoal(s));
      const hit = [...g.spots].reverse().find((p) => Math.abs(x - p.x) < g.box * 0.6 && Math.abs(y - p.y) < g.box * 0.6);
      if (hit) {
        if (s.goal && !hit.side) return null;
        (hit.side ? s.right : s.left).splice(hit.k, 1);
        return writeScale(s);
      }
      const cg = chipGeom(w, h);
      for (let i = 0; i < CHIPS.length; i++) {
        for (const side of [0, 1]) {
          const [cx, cy] = cg.at(i, side);
          if (!inR(x, y, cx, cy, cg.cr * 1.12)) continue;
          if (s.goal && !side) return null;
          const list = side ? s.right : s.left;
          if (list.length >= 12) return null;
          list.push(CHIPS[i]);
          return writeScale(s);
        }
      }
      if (Math.abs(x - w / 2) < w * 0.1 && Math.abs(y - cg.my) < h * 0.08) return writeScale({ ...s, show: !s.show });
      return null;
    },
    fx(prev, next) {
      const p = readScale(prev), n = readScale(next);
      return scaleEq(n) && !scaleEq(p) ? (n.goal ? 'win' : 'equal') : 'click';
    },
  }),
};

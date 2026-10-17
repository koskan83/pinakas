/** Κλάσματα: πίτα και μπάρα, με όψη πίτσας και σοκολάτας. */
import type { StampDef } from '../stamps';
import { BLUE, type C, GOOD, inR, kid, type KidEnv, knob, ORANGE, skinBtn, text } from './common';

/** Κάτω λωρίδα με − [κλάσμα] + : κοινή σε πίτα και μπάρα. */
function fracStrip(c: C, w: number, y: number, hh: number, n: number, k: number, env: KidEnv, goal = 0): void {
  const r = hh * 0.3;
  knob(c, w * 0.14, y, r, '−', env);
  knob(c, w * 0.86, y, r, '+', env);
  // το κλάσμα γραμμένο κατακόρυφα: αριθμητής, γραμμή, παρονομαστής
  const fs = hh * 0.32;
  // άσκηση: γράφεται το κλάσμα που ζητείται· γίνεται πράσινο με ✓ όταν χρωματιστούν τόσα κομμάτια
  const done = goal > 0 && k === goal, ink = done ? GOOD : env.ink;
  if (done) text(c, '✓', w / 2 + fs * 1.5, y, fs * 1.5, GOOD, 800);
  text(c, String(goal || k), w / 2, y - fs * 0.56, fs, ink, 700);
  text(c, String(n), w / 2, y + fs * 0.62, fs, ink, 700);
  c.save();
  c.strokeStyle = ink;
  c.lineWidth = Math.max(2, fs * 0.09);
  c.beginPath();
  c.moveTo(w / 2 - fs * 0.5, y);
  c.lineTo(w / 2 + fs * 0.5, y);
  c.stroke();
  c.restore();
}
/** Η όψη «πίτσα / σοκολάτα» (τρίτο στοιχείο της κατάστασης) μένει όταν αλλάζουν τα κομμάτια. */
const skinKeep = (v: number[], next: number[] | null): number[] | null => {
  if (!next) return next;
  // η άσκηση (τέταρτο στοιχείο: πόσα κομμάτια ζητούνται) μένει όσο δεν αλλάζει ο παρονομαστής
  const goal = next[0] === (v[0] || 4) ? v[3] ?? 0 : 0;
  if (goal) return [next[0], next[1], v[2] ? 1 : 0, goal];
  return v[2] ? [next[0], next[1], 1] : next;
};
/** Νέα άσκηση κλάσματος: τυχαίος παρονομαστής και αριθμητής, άδειο σχήμα. */
function fracGoal(v: number[]): number[] {
  const ns = [2, 3, 4, 5, 6, 8, 10];
  let n = v[0] || 4, k = v[3] ?? 0;
  while (n === (v[0] || 4) && k === (v[3] ?? 0)) {
    n = ns[Math.floor(Math.random() * ns.length)];
    k = 1 + Math.floor(Math.random() * (n - 1));
  }
  return [n, 0, v[2] ? 1 : 0, k];
}
/** Πανηγυρισμός όταν τα χρωματισμένα κομμάτια γίνουν όσα ζητά η άσκηση. */
const fracFx = (prev: number[], next: number[]): string => (next[3] && ones(next[1] ?? 0) === next[3] && ones(prev[1] ?? 0) !== next[3] ? 'win' : 'click');
/** Ολόκληρη πίτσα με κέντρο (cx, cy): κόρα, τυρί, σαλάμι και λίγη πιπεριά. Ο καλών την «κόβει» με clip σε κομμάτια. */
function drawPizza(c: C, cx: number, cy: number, r: number): void {
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fillStyle = '#d18b47';
  c.fill();
  c.beginPath();
  c.arc(cx, cy, r * 0.87, 0, Math.PI * 2);
  c.fillStyle = '#fcd34d';
  c.fill();
  // σταθερές θέσεις, για να μη «χορεύουν» τα υλικά σε κάθε ζωγράφισμα
  for (let i = 0; i < 14; i++) {
    const a = i * 2.399963 + 0.4, d = r * (0.2 + 0.6 * ((i * 0.618034) % 1));
    c.beginPath();
    c.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * 0.085, 0, Math.PI * 2);
    c.fillStyle = '#dc2626';
    c.fill();
    c.beginPath();
    c.arc(cx + Math.cos(a) * d - r * 0.02, cy + Math.sin(a) * d - r * 0.02, r * 0.03, 0, Math.PI * 2);
    c.fillStyle = '#f87171';
    c.fill();
  }
  c.fillStyle = '#16a34a';
  for (let i = 0; i < 11; i++) {
    const a = i * 1.7 + 1.1, d = r * (0.15 + 0.62 * ((i * 0.381966 + 0.3) % 1));
    c.save();
    c.translate(cx + Math.cos(a) * d, cy + Math.sin(a) * d);
    c.rotate(a * 2);
    c.fillRect(-r * 0.045, -r * 0.014, r * 0.09, r * 0.028);
    c.restore();
  }
}
/** Ένα κομμάτι σοκολάτας μέσα στο κουτί (x, y, w, h): σκούρη βάση και ανάγλυφο «μαξιλαράκι». */
function drawChoc(c: C, x: number, y: number, w: number, h: number): void {
  c.fillStyle = '#5b3417';
  c.fillRect(x, y, w, h);
  const m = Math.min(w, h) * 0.12;
  c.fillStyle = '#7a4a22';
  c.fillRect(x + m, y + m, w - 2 * m, h - 2 * m);
  // φως πάνω αριστερά, σκιά κάτω δεξιά
  c.fillStyle = '#9a6535';
  c.beginPath();
  c.moveTo(x + m, y + m); c.lineTo(x + w - m, y + m); c.lineTo(x + w - 2 * m, y + 2 * m); c.lineTo(x + 2 * m, y + 2 * m); c.lineTo(x + 2 * m, y + h - 2 * m); c.lineTo(x + m, y + h - m);
  c.closePath();
  c.fill();
  c.fillStyle = '#4a2a12';
  c.beginPath();
  c.moveTo(x + w - m, y + h - m); c.lineTo(x + m, y + h - m); c.lineTo(x + 2 * m, y + h - 2 * m); c.lineTo(x + w - 2 * m, y + h - 2 * m); c.lineTo(x + w - 2 * m, y + 2 * m); c.lineTo(x + w - m, y + m);
  c.closePath();
  c.fill();
}

function fracTap(v: number[], x: number, y: number, w: number, sy: number, hh: number): number[] | null {
  const r = hh * 0.3;
  const n = v[0] || 4;
  if (inR(x, y, w * 0.14, sy, r)) return n > 1 ? [n - 1, 0] : null;
  if (inR(x, y, w * 0.86, sy, r)) return n < 12 ? [n + 1, 0] : null;
  return null;
}
const ones = (m: number): number => { let k = 0; for (let i = 0; i < 25; i++) if (m & (1 << i)) k++; return k; };

export const FRACTION_KIDS: Record<string, StampDef> = {
  fracpie: kid({
    label: 'Κλάσμα: πίτα', w: 280, h: 370, init: [4, 0],
    drawKid(c, w, h, v, env) {
      const n = v[0] || 4, cx = w / 2, cy = w / 2, r = w * 0.46;
      for (let i = 0; i < n; i++) {
        const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / n, a1 = a0 + (2 * Math.PI) / n;
        const wedge = (): void => {
          c.beginPath();
          c.moveTo(cx, cy);
          c.arc(cx, cy, r, a0, a1);
          c.closePath();
        };
        const on = (v[1] & (1 << i)) !== 0;
        if (v[2]) {
          // πίτσα: τα κομμάτια που πήρες φαίνονται ολόκληρα, τα υπόλοιπα αχνά
          c.save();
          wedge();
          c.clip();
          c.fillStyle = env.bg;
          c.fillRect(0, 0, w, w);
          c.globalAlpha = on ? 1 : 0.22;
          drawPizza(c, cx, cy, r);
          c.restore();
          wedge();
          c.save();
          c.strokeStyle = '#7c2d12';
          c.lineWidth = Math.max(2, w * 0.009);
          c.stroke();
          c.restore();
        } else {
          wedge();
          c.fillStyle = on ? ORANGE : env.bg;
          c.fill();
          c.stroke();
        }
      }
      if (n === 1 && !v[2]) { c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke(); }
      skinBtn(c, w * 0.9, w * 0.1, w * 0.085, '🍕', !!v[2], env);
      skinBtn(c, w * 0.1, w * 0.1, w * 0.085, '🎯', !!v[3], env);
      c.fillStyle = env.ink;
      fracStrip(c, w, w + (h - w) / 2, h - w, n, ones(v[1] ?? 0), env, v[3] ?? 0);
    },
    tap(v, x, y, w, h) {
      const n = v[0] || 4, cx = w / 2, cy = w / 2;
      if (inR(x, y, w * 0.9, w * 0.1, w * 0.1)) return [n, v[1] ?? 0, v[2] ? 0 : 1, ...(v[3] ? [v[3]] : [])];
      if (inR(x, y, w * 0.1, w * 0.1, w * 0.1)) return fracGoal(v);
      if (Math.hypot(x - cx, y - cy) <= w * 0.46) {
        let a = Math.atan2(y - cy, x - cx) + Math.PI / 2;
        if (a < 0) a += 2 * Math.PI;
        return skinKeep(v, [n, (v[1] ?? 0) ^ (1 << Math.min(n - 1, Math.floor((a / (2 * Math.PI)) * n)))]);
      }
      return skinKeep(v, fracTap(v, x, y, w, w + (h - w) / 2, h - w));
    },
    fx: fracFx,
  }),

  fracbar: kid({
    label: 'Κλάσμα: μπάρα', w: 560, h: 170, init: [4, 0],
    drawKid(c, w, h, v, env) {
      const n = v[0] || 4, bh = h * 0.5;
      for (let i = 0; i < n; i++) {
        const on = (v[1] & (1 << i)) !== 0, x = (w * i) / n, pw = w / n;
        if (v[2]) {
          // σοκολάτα: κάθε κομμάτι έχει το «μαξιλαράκι» του· όσα δεν πήρες φαίνονται αχνά
          c.save();
          c.fillStyle = env.bg;
          c.fillRect(x, 0, pw, bh);
          c.globalAlpha = on ? 1 : 0.2;
          drawChoc(c, x, 0, pw, bh);
          c.restore();
          c.save();
          c.strokeStyle = '#3b1f0b';
          c.strokeRect(x, 0, pw, bh);
          c.restore();
        } else {
          c.fillStyle = on ? BLUE : env.bg;
          c.fillRect(x, 0, pw, bh);
          c.strokeRect(x, 0, pw, bh);
        }
      }
      const sy = bh + (h - bh) / 2;
      skinBtn(c, w * 0.68, sy, (h - bh) * 0.24, '🍫', !!v[2], env);
      skinBtn(c, w * 0.32, sy, (h - bh) * 0.24, '🎯', !!v[3], env);
      c.fillStyle = env.ink;
      fracStrip(c, w, sy, h - bh, n, ones(v[1] ?? 0), env, v[3] ?? 0);
    },
    tap(v, x, y, w, h) {
      const n = v[0] || 4, bh = h * 0.5, sy = bh + (h - bh) / 2;
      if (y >= 0 && y <= bh && x >= 0 && x <= w) return skinKeep(v, [n, (v[1] ?? 0) ^ (1 << Math.min(n - 1, Math.floor((x / w) * n)))]);
      if (inR(x, y, w * 0.68, sy, (h - bh) * 0.3)) return [n, v[1] ?? 0, v[2] ? 0 : 1, ...(v[3] ? [v[3]] : [])];
      if (inR(x, y, w * 0.32, sy, (h - bh) * 0.3)) return fracGoal(v);
      return skinKeep(v, fracTap(v, x, y, w, sy, h - bh));
    },
    fx: fracFx,
  }),
};

// τα ίδια κλάσματα, που ξεκινούν κατευθείαν ως πίτσα και ως σοκολάτα
FRACTION_KIDS.fracpizza = { ...FRACTION_KIDS.fracpie, label: 'Κλάσμα: πίτσα', init: [4, 0, 1] };
FRACTION_KIDS.fracchoc = { ...FRACTION_KIDS.fracbar, label: 'Κλάσμα: σοκολάτα', init: [4, 0, 1] };

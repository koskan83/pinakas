/** Αριθμοί: αριθμογραμμή, ρολόι, υλικό δεκάδων, χρήματα, πίνακας του 100, προπαίδεια και κάθετες πράξεις. */
import type { StampDef } from '../stamps';
import { bit, BLUE, type C, el, fitText, flip, GOOD, GREEN, inR, kid, type KidEnv, knob, ORANGE, PURPLE, RED, rrect, skinBtn, text, YELLOW } from './common';

const LINES: [from: number, to: number, step: number][] = [[0, 10, 1], [0, 20, 1], [0, 100, 10], [-10, 10, 1], [0, 1, 0.1]];

/**
 * Η γωνία της προπαίδειας: χωρίς άσκηση ή με λυμένη άσκηση ζητά νέο γινόμενο από κουτάκι που είναι ακόμα κρυμμένο
 * (αν άνοιξαν όλα, τα ξανακρύβει)· με άσκηση που δεν λύθηκε, τη σταματά.
 */
function timesGoal(v: number[]): number[] {
  if (v[4] && !v[5]) return v.slice(0, 4);
  let from = v.slice(0, 4);
  while (from.length < 4) from.push(0);
  let free: number[] = [];
  for (let i = 0; i < 100; i++) if (!bit(from, 0, i)) free.push(i);
  if (!free.length) {
    from = [0, 0, 0, 0];
    free = Array.from({ length: 100 }, (_, i) => i);
  }
  // όχι ×1 και όχι το ίδιο με πριν, όσο υπάρχει άλλη επιλογή
  const prod = (i: number): number => (Math.floor(i / 10) + 1) * ((i % 10) + 1);
  const good = free.filter((i) => i >= 10 && i % 10 > 0 && prod(i) !== v[4]);
  const pool = good.length ? good : free;
  return [...from, prod(pool[Math.floor(Math.random() * pool.length)]), 0];
}
/** Ώρα σε μορφή 7:45 από λεπτά μετά τις 12. */
const clockText = (mins: number): string => `${Math.floor(mins / 60) || 12}:${String(mins % 60).padStart(2, '0')}`;
/** Υλικό δεκάδων: όρια των τριών στηλών (ως κλάσμα του πλάτους) και ύψος της κεφαλίδας. */
const BHEAD = 0.24;
/** Όρια των στηλών ανά πλήθος στηλών: 3 (Ε Δ Μ), 4 (και χιλιάδες), 5 (και δεκάδες χιλιάδες). */
const BCOLS_BY: Record<number, number[]> = { 3: [0, 0.44, 0.72, 1], 4: [0, 0.26, 0.56, 0.79, 1], 5: [0, 0.19, 0.38, 0.61, 0.8, 1] };
/** Όνομα και χρώμα κάθε θέσης, από τις μονάδες προς τα πάνω. */
const BNAMES = ['Μονάδες', 'Δεκάδες', 'Εκατοντάδες', 'Χιλιάδες', 'Δεκάδες χιλιάδες'];
const BFILLS = [YELLOW, BLUE, GREEN, RED, PURPLE];
/** Πόσες στήλες δείχνει το υλικό (τρίτο στοιχείο της κατάστασης· αν λείπει, οι τρεις κλασικές). */
const blockCols = (v: number[]): number => (v[2] === 4 || v[2] === 5 ? v[2] : 3);
/** Τα δύο κουμπιά κάτω αριστερά: «μία στήλη ακόμα» και «μία λιγότερη». */
const blockBtns = (w: number, h: number): { add: number; del: number; y: number; pw: number; ph: number } =>
  ({ add: w * 0.12, del: w * 0.88, y: h * 0.92, pw: w * 0.21, ph: h * 0.085 });
/** Μικρό κουμπί-ετικέτα. */
function pill(c: C, cx: number, cy: number, pw: number, ph: number, label: string, env: KidEnv): void {
  rrect(c, cx - pw / 2, cy - ph / 2, pw, ph, ph / 2);
  c.save();
  c.fillStyle = env.ink;
  c.globalAlpha = 0.12;
  c.fill();
  c.restore();
  text(c, label, cx, cy + 1, Math.min(ph * 0.5, (pw * 1.7) / label.length), env.ink, 700);
}

// ---------- χρήματα ----------
/** Αξία σε λεπτά και όψη κάθε χαρτονομίσματος ή κέρματος. */
const MONEY: { c: number; label: string; note?: boolean; fill: string; rim?: string }[] = [
  { c: 1000, label: '10', note: true, fill: '#fca5a5' },
  { c: 500, label: '5', note: true, fill: '#cbd5e1' },
  { c: 200, label: '2€', fill: '#fde68a', rim: '#cbd5e1' },
  { c: 100, label: '1€', fill: '#e2e8f0', rim: '#fcd34d' },
  { c: 50, label: '50', fill: '#fcd34d' },
  { c: 20, label: '20', fill: '#fcd34d' },
  { c: 10, label: '10', fill: '#fcd34d' },
  { c: 5, label: '5', fill: '#fdba74' },
];
function drawMoney(c: C, i: number, x: number, y: number, s: number): void {
  const m = MONEY[i];
  c.save();
  c.lineWidth = Math.max(1.2, s * 0.05);
  c.strokeStyle = '#475569';
  if (m.note) {
    rrect(c, x - s * 0.95, y - s * 0.55, s * 1.9, s * 1.1, s * 0.12);
    c.fillStyle = m.fill;
    c.fill();
    c.stroke();
    text(c, `${m.label} €`, x, y + s * 0.03, s * 0.55, '#1e293b', 700);
  } else {
    const r = s * (m.c >= 100 ? 0.62 : m.c >= 50 ? 0.56 : m.c >= 20 ? 0.5 : m.c >= 10 ? 0.44 : 0.4);
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = m.rim ?? m.fill;
    c.fill();
    c.stroke();
    if (m.rim) {
      c.beginPath();
      c.arc(x, y, r * 0.68, 0, Math.PI * 2);
      c.fillStyle = m.fill;
      c.fill();
    }
    text(c, m.label, x, y + r * 0.05, r * (m.c >= 100 ? 0.7 : 0.8), '#1e293b', 700);
  }
  c.restore();
}
/** Πού ζωγραφίζεται κάθε χρήμα του σωρού: ίδια διάταξη για τη σχεδίαση και για το πάτημα. */
function moneyPile(v: number[], w: number, h: number): { i: number; x: number; y: number; s: number }[] {
  const s = w * 0.06;
  const out: { i: number; x: number; y: number; s: number }[] = [];
  let x = s * 1.3, y = h * 0.36 + s * 0.9;
  for (let i = 0; i < MONEY.length; i++) {
    for (let k = 0; k < (v[1 + i] ?? 0); k++) {
      const step = MONEY[i].note ? s * 2.1 : s * 1.35;
      if (x + step * 0.5 > w - s * 0.4) { x = s * 1.3; y += s * 1.4; }
      out.push({ i, x: MONEY[i].note ? x + s * 0.35 : x, y, s });
      x += step;
    }
  }
  return out;
}

export const NUMBER_KIDS: Record<string, StampDef> = {
  numline: kid({
    label: 'Αριθμογραμμή', w: 760, h: 120, init: [0],
    drawKid(c, w, h, v, env) {
      const [from, to, step] = LINES[v[0] % LINES.length] ?? LINES[0];
      const n = Math.round((to - from) / step);
      const x0 = w * 0.05, x1 = w * 0.9, y = h * 0.42;
      c.lineWidth = Math.max(2.5, h * 0.03);
      c.beginPath();
      c.moveTo(x0 - w * 0.03, y);
      c.lineTo(x1 + w * 0.035, y);
      // βέλη στα δύο άκρα: η γραμμή συνεχίζεται
      for (const [x, d] of [[x0 - w * 0.03, 1], [x1 + w * 0.035, -1]]) {
        c.moveTo(x + d * h * 0.1, y - h * 0.07);
        c.lineTo(x, y);
        c.lineTo(x + d * h * 0.1, y + h * 0.07);
      }
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        const big = n <= 10 || i % 5 === 0;
        c.moveTo(x, y - h * (big ? 0.13 : 0.08));
        c.lineTo(x, y + h * (big ? 0.13 : 0.08));
      }
      c.stroke();
      const fs = Math.min(h * 0.24, ((x1 - x0) / n) * 0.62);
      for (let i = 0; i <= n; i++) text(c, el(from + i * step, 1), x0 + ((x1 - x0) * i) / n, y + h * 0.33, fs, env.ink, 600);
      knob(c, w * 0.965, h * 0.22, h * 0.16, '⟳', env);
    },
    tap: (v, x, y, w, h) => (inR(x, y, w * 0.965, h * 0.22, h * 0.2) ? [((v[0] ?? 0) + 1) % LINES.length] : null),
  }),

  clock: kid({
    label: 'Ρολόι', w: 320, h: 390, init: [185, 1],
    drawKid(c, w, h, v, env) {
      const cx = w / 2, cy = w / 2, r = w * 0.47;
      const mins = ((v[0] ?? 0) % 720 + 720) % 720;
      c.lineWidth = Math.max(3, w * 0.014);
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.fillStyle = env.bg;
      c.fill();
      c.stroke();
      c.fillStyle = env.ink;
      c.lineWidth = Math.max(1.5, w * 0.006);
      c.beginPath();
      for (let i = 0; i < 60; i++) {
        const a = (i * Math.PI) / 30, q = i % 5 ? 0.95 : 0.9;
        c.moveTo(cx + r * q * Math.sin(a), cy - r * q * Math.cos(a));
        c.lineTo(cx + r * Math.sin(a), cy - r * Math.cos(a));
      }
      c.stroke();
      for (let i = 1; i <= 12; i++) {
        const a = (i * Math.PI) / 6;
        text(c, String(i), cx + r * 0.76 * Math.sin(a), cy - r * 0.76 * Math.cos(a), r * 0.2, env.ink, 700);
      }
      const hand = (a: number, len: number, wd: number, col: string): void => {
        c.save();
        c.strokeStyle = col;
        c.lineWidth = wd;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(cx - r * 0.08 * Math.sin(a), cy + r * 0.08 * Math.cos(a));
        c.lineTo(cx + r * len * Math.sin(a), cy - r * len * Math.cos(a));
        c.stroke();
        c.restore();
      };
      // ωροδείκτης κοντός και κόκκινος, λεπτοδείκτης μακρύς και μπλε: έτσι τους ξεχωρίζουν τα παιδιά
      hand((mins / 720) * 2 * Math.PI, 0.5, Math.max(6, w * 0.03), RED);
      hand(((mins % 60) / 60) * 2 * Math.PI, 0.82, Math.max(4, w * 0.02), BLUE);
      c.beginPath();
      c.arc(cx, cy, r * 0.05, 0, Math.PI * 2);
      c.fill();
      const hr = Math.floor(mins / 60) || 12;
      const sy = w + (h - w) / 2;
      rrect(c, w * 0.22, sy - (h - w) * 0.36, w * 0.56, (h - w) * 0.72, (h - w) * 0.16);
      c.save();
      c.globalAlpha = 0.12;
      c.fill();
      c.restore();
      c.lineWidth = Math.max(1.5, w * 0.006);
      c.stroke();
      // άσκηση (τρίτο στοιχείο: η ώρα που ζητείται, +1· τέταρτο: βρέθηκε): «Δείξε 7:45» και ✓ όταν αφήσεις τους δείκτες εκεί
      if (v[2]) fitText(c, v[3] ? `✓ ${clockText(v[2] - 1)}` : `Δείξε ${clockText(v[2] - 1)}`, w / 2, sy + 1, (h - w) * 0.4, w * 0.5, v[3] ? GOOD : env.ink, 700);
      else text(c, v[1] ? `${hr}:${String(mins % 60).padStart(2, '0')}` : '? : ??', w / 2, sy + 1, (h - w) * 0.46, env.ink, 700);
      skinBtn(c, w * 0.92, w * 0.08, w * 0.07, '🎯', !!v[2], env);
    },
    // οι δείκτες σέρνονται: έξω κοντά στους αριθμούς ο λεπτοδείκτης (ανά λεπτό), πιο μέσα ο ωροδείκτης
    paint(v, x, y, w, _h, st, first) {
      const cx = w / 2, cy = w / 2, r = w * 0.47;
      const mins = ((v[0] ?? 0) % 720 + 720) % 720;
      const d = Math.hypot(x - cx, y - cy);
      if (first) {
        if (d > r * 1.05) return null;
        st.hand = d > r * 0.56 ? 1 : 2;
      }
      let a = Math.atan2(x - cx, cy - y);
      if (a < 0) a += 2 * Math.PI;
      const goal = v[2] ? [v[2], 0] : [];
      if (st.hand === 1) return [Math.floor(mins / 60) * 60 + (Math.round((a / (2 * Math.PI)) * 60) % 60), v[1] ?? 1, ...goal];
      return [(Math.round((a / (2 * Math.PI)) * 12 - (mins % 60) / 60 + 12) % 12) * 60 + (mins % 60), v[1] ?? 1, ...goal];
    },
    // όταν αφήσεις τους δείκτες πάνω στην ώρα της άσκησης: σωστό (όχι όσο απλώς περνάς από εκεί)
    drop: (v) => (v[2] && !v[3] && v[0] === v[2] - 1 ? { v: [v[0], v[1] ?? 0, v[2], 1], ev: 'win' } : null),
    tap(v, x, y, w, h) {
      const mins = ((v[0] ?? 0) % 720 + 720) % 720;
      if (inR(x, y, w * 0.92, w * 0.08, w * 0.08)) {
        // νέα άσκηση: τυχαία ώρα ανά 5 λεπτά, διαφορετική από αυτή που δείχνει το ρολόι· η ψηφιακή ώρα κρύβεται
        let t = mins;
        while (t === mins || t === (v[2] ?? 0) - 1) t = Math.floor(Math.random() * 144) * 5;
        return [mins, 0, t + 1, 0];
      }
      // πάτημα στο πλαίσιο της ώρας: κρύβει ή δείχνει την ψηφιακή ώρα· μέσα σε άσκηση, την τελειώνει
      return y > w && y <= h ? [mins, v[2] ? 1 : v[1] ? 0 : 1] : null;
    },
  }),

  blocks: kid({
    label: 'Εκατοντάδες, δεκάδες, μονάδες', w: 620, h: 400, init: [234, 1],
    drawKid(c, w, h, v, env) {
      const nc = blockCols(v), n = Math.max(0, Math.min(10 ** nc - 1, v[0] ?? 0));
      const cols = BCOLS_BY[nc].map((q) => q * w);
      const head = h * BHEAD, foot = h * 0.16;
      c.lineWidth = 1.5;
      for (let k = 0; k < nc; k++) {
        // θέση της στήλης: 0 = μονάδες, 1 = δεκάδες, … 4 = δεκάδες χιλιάδες
        const place = nc - 1 - k, digit = Math.floor(n / 10 ** place) % 10;
        const x0 = cols[k], x1 = cols[k + 1], mid = (x0 + x1) / 2, cw = x1 - x0;
        c.save();
        c.globalAlpha = 0.35;
        c.strokeRect(x0, 0, cw, h - foot);
        c.restore();
        // επάνω το όνομα της στήλης (σε δύο γραμμές αν είναι δύο λέξεις)· από κάτω − και +, με το ψηφίο της ανάμεσα
        const r = Math.min(head * 0.2, cw * 0.15), ky = head * 0.68;
        const lines = BNAMES[place].split(' ');
        const fs = Math.min(head * (lines.length > 1 ? 0.2 : 0.3), (cw * 1.5) / Math.max(...lines.map((l) => l.length)));
        lines.forEach((l, i) => text(c, l, mid, head * 0.22 + (i - (lines.length - 1) / 2) * fs * 1.05, fs, env.ink, 700));
        knob(c, x0 + r * 1.5, ky, r, '−', env);
        knob(c, x1 - r * 1.5, ky, r, '+', env);
        // όταν ο αριθμός είναι κρυμμένος («Ποιος αριθμός είναι;») κρύβονται και τα ψηφία
        text(c, v[1] ? String(digit) : '?', mid, ky + 1, Math.min(head * 0.36, cw * 0.24), env.ink, 800);
        const top = head + 6, room = h - foot - top - 6;
        c.save();
        c.fillStyle = BFILLS[place];
        c.strokeStyle = '#334155';
        c.lineWidth = 1;
        if (place === 4 || place === 1) {
          // ράβδοι: δέκα κυβάκια (δεκάδες) ή δέκα κύβοι των χιλίων (δεκάδες χιλιάδες), όρθιες
          const bw = Math.min((cw - 12) / 9 - 4, room / 10);
          for (let i = 0; i < digit; i++) {
            const x = x0 + 8 + i * (bw + 4), bh = Math.min(room, bw * 10);
            c.fillRect(x, top, bw, bh);
            c.beginPath();
            c.rect(x, top, bw, bh);
            for (let g = 1; g < 10; g++) { c.moveTo(x, top + (bh * g) / 10); c.lineTo(x + bw, top + (bh * g) / 10); }
            if (place === 4) { c.moveTo(x + bw / 2, top); c.lineTo(x + bw / 2, top + bh); }
            c.stroke();
          }
        } else if (place === 3) {
          // κύβοι των 1000: τετράγωνο με «βάθος» πάνω και δεξιά, τρεις σε κάθε σειρά
          const s = Math.min((cw - 16) / 3 - 6, room / 3 - 6), d = s * 0.22, f = s - d;
          for (let i = 0; i < digit; i++) {
            const x = x0 + 10 + (i % 3) * (s + 6), y = top + Math.floor(i / 3) * (s + 6) + d;
            c.beginPath();
            c.moveTo(x, y); c.lineTo(x + d, y - d); c.lineTo(x + f + d, y - d); c.lineTo(x + f + d, y + f - d); c.lineTo(x + f, y + f); c.lineTo(x, y + f);
            c.closePath();
            c.fill();
            c.stroke();
            c.beginPath();
            c.rect(x, y, f, f);
            c.moveTo(x + f, y); c.lineTo(x + f + d, y - d);
            c.stroke();
            text(c, '1000', x + f / 2, y + f / 2 + 1, f * 0.3, '#ffffff', 700);
          }
        } else if (place === 2) {
          // πλάκες των 100: τετράγωνα 10 × 10, τρεις σε κάθε σειρά
          const s = Math.min((cw - 16) / 3 - 6, room / 3 - 6);
          for (let i = 0; i < digit; i++) {
            const x = x0 + 10 + (i % 3) * (s + 6), y = top + Math.floor(i / 3) * (s + 6);
            c.fillRect(x, y, s, s);
            c.beginPath();
            for (let g = 0; g <= 10; g++) {
              c.moveTo(x + (s * g) / 10, y); c.lineTo(x + (s * g) / 10, y + s);
              c.moveTo(x, y + (s * g) / 10); c.lineTo(x + s, y + (s * g) / 10);
            }
            c.stroke();
          }
        } else {
          const s = Math.min((cw - 16) / 3 - 6, room / 3 - 6, w * 0.045);
          for (let i = 0; i < digit; i++) {
            const x = x0 + 10 + (i % 3) * (s + 6), y = top + Math.floor(i / 3) * (s + 6);
            c.fillRect(x, y, s, s);
            c.strokeRect(x, y, s, s);
          }
        }
        c.restore();
      }
      text(c, v[1] ? el(n, 0) : 'Ποιος αριθμός είναι;', w / 2, h - foot / 2 + 2, foot * (v[1] ? 0.7 : 0.42), env.ink, 700);
      // κάτω αριστερά: μία στήλη ακόμα προς τα αριστερά (χιλιάδες, δεκάδες χιλιάδες) ή μία λιγότερη
      const g = blockBtns(w, h);
      if (nc < 5) pill(c, g.add, g.y, g.pw, g.ph, `＋ ${nc === 3 ? 'Χιλιάδες' : 'Δεκ. χιλιάδες'}`, env);
      if (nc > 3) pill(c, g.del, g.y, g.pw, g.ph, '− στήλη', env);
    },
    tap(v, x, y, w, h) {
      const nc = blockCols(v), max = 10 ** nc - 1, n = Math.max(0, Math.min(max, v[0] ?? 0));
      const cols = BCOLS_BY[nc].map((q) => q * w), head = h * BHEAD, foot = h * 0.16, ky = head * 0.68;
      const out = (num: number, show: number, k = nc): number[] => (k > 3 ? [num, show, k] : [num, show]);
      const g = blockBtns(w, h);
      if (Math.abs(y - g.y) <= g.ph * 0.7) {
        if (nc < 5 && Math.abs(x - g.add) <= g.pw / 2) return out(n, v[1] ?? 1, nc + 1);
        if (nc > 3 && Math.abs(x - g.del) <= g.pw / 2) return out(n % 10 ** (nc - 1), v[1] ?? 1, nc - 1);
      }
      if (y > h - foot && y <= h) return out(n, v[1] ? 0 : 1);
      for (let k = 0; k < nc; k++) {
        // πάνω από 9 η στήλη μηδενίζει και περνά ένα στην αριστερή της (κρατούμενο)· κάτω από 0 «δανείζεται» από εκεί
        const unit = 10 ** (nc - 1 - k), r = Math.min(head * 0.2, (cols[k + 1] - cols[k]) * 0.15);
        if (inR(x, y, cols[k] + r * 1.5, ky, r * 1.2)) return n - unit >= 0 ? out(n - unit, v[1] ?? 1) : null;
        if (inR(x, y, cols[k + 1] - r * 1.5, ky, r * 1.2)) return n + unit <= max ? out(n + unit, v[1] ?? 1) : null;
      }
      return null;
    },
  }),

  money: kid({
    label: 'Χρήματα', w: 640, h: 360, init: [1, 0, 0, 0, 0, 0, 0, 0, 0],
    drawKid(c, w, h, v, env) {
      const s = w * 0.06;
      // επάνω η «τράπεζα»: πατάς ένα και μπαίνει στον σωρό
      c.save();
      c.globalAlpha = 0.1;
      rrect(c, 0, 0, w, h * 0.3, s * 0.4);
      c.fill();
      c.restore();
      MONEY.forEach((_, i) => drawMoney(c, i, (w * (i + 0.5)) / MONEY.length, h * 0.15, s));
      for (const p of moneyPile(v, w, h)) drawMoney(c, p.i, p.x, p.y, p.s);
      const total = MONEY.reduce((a, m, i) => a + m.c * (v[1 + i] ?? 0), 0);
      c.save();
      c.globalAlpha = 0.4;
      c.lineWidth = 1.5;
      rrect(c, 0, 0, w, h, s * 0.4);
      c.stroke();
      c.restore();
      text(c, v[0] ? `Σύνολο: ${(total / 100).toLocaleString('el', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : 'Πόσα χρήματα είναι;', w / 2, h * 0.92, h * 0.085, env.ink, 700);
    },
    tap(v, x, y, w, h) {
      const out = [...v];
      while (out.length < 1 + MONEY.length) out.push(0);
      if (y >= 0 && y < h * 0.3) {
        const i = Math.max(0, Math.min(MONEY.length - 1, Math.floor((x / w) * MONEY.length)));
        if (moneyPile(out, w, h).length >= 30) return null;
        out[1 + i]++;
        return out;
      }
      if (y > h * 0.84 && y <= h) { out[0] = out[0] ? 0 : 1; return out; }
      const hit = moneyPile(out, w, h).reverse().find((p) => Math.hypot(x - p.x, y - p.y) < p.s * 0.95);
      if (!hit) return null;
      out[1 + hit.i]--;
      return out;
    },
  }),

  hundred: kid({
    label: 'Πίνακας του 100', w: 500, h: 500, init: [0, 0, 0, 0],
    drawKid(c, w, h, v, env) {
      const s = w / 10;
      for (let i = 0; i < 100; i++) {
        const x = (i % 10) * s, y = Math.floor(i / 10) * (h / 10);
        if (bit(v, 0, i)) { c.fillStyle = YELLOW; c.fillRect(x, y, s, h / 10); }
        text(c, String(i + 1), x + s / 2, y + h / 20 + 1, s * 0.42, bit(v, 0, i) ? '#1e293b' : env.ink, 600);
      }
      c.lineWidth = 1.5;
      c.beginPath();
      for (let g = 0; g <= 10; g++) {
        c.moveTo(g * s, 0); c.lineTo(g * s, h);
        c.moveTo(0, (g * h) / 10); c.lineTo(w, (g * h) / 10);
      }
      c.stroke();
    },
    tap: (v, x, y, w, h) => (x < 0 || y < 0 || x >= w || y >= h ? null : flip(v, 0, Math.floor((y / h) * 10) * 10 + Math.floor((x / w) * 10))),
  }),

  times: kid({
    label: 'Προπαίδεια', w: 520, h: 520, init: [0, 0, 0, 0],
    drawKid(c, w, h, v, env) {
      const s = w / 11, t = h / 11;
      c.save();
      c.globalAlpha = 0.14;
      c.fillRect(0, 0, w, t);
      c.fillRect(0, t, s, h - t);
      c.restore();
      // άσκηση (πέμπτο στοιχείο: το γινόμενο που ζητείται, έκτο: βρέθηκε): «Βρες 42» στη γωνία και ✓ όταν πατηθεί κουτάκι που το δίνει
      if (v[4]) {
        text(c, v[5] ? '✓' : 'Βρες', s / 2, t * 0.27, s * 0.24, v[5] ? GOOD : env.ink, 700);
        text(c, String(v[4]), s / 2, t * 0.66, s * 0.4, v[5] ? GOOD : ORANGE, 800);
      } else skinBtn(c, s / 2, t / 2, s * 0.4, '🎯', false, env);
      c.fillStyle = env.ink;
      for (let i = 1; i <= 10; i++) {
        text(c, String(i), s * (i + 0.5), t / 2 + 1, s * 0.44, env.ink, 700);
        text(c, String(i), s / 2, t * (i + 0.5) + 1, s * 0.44, env.ink, 700);
      }
      // τα γινόμενα είναι κρυμμένα· κάθε πάτημα αποκαλύπτει (ή ξανακρύβει) ένα
      for (let r = 0; r < 10; r++) for (let q = 0; q < 10; q++) {
        if (!bit(v, 0, r * 10 + q)) continue;
        c.fillStyle = v[5] && (r + 1) * (q + 1) === v[4] ? GOOD : GREEN;
        c.globalAlpha = v[5] && (r + 1) * (q + 1) === v[4] ? 0.6 : 0.35;
        c.fillRect(s * (q + 1), t * (r + 1), s, t);
        c.globalAlpha = 1;
        text(c, String((r + 1) * (q + 1)), s * (q + 1.5), t * (r + 1.5) + 1, s * 0.4, env.ink, 600);
      }
      c.fillStyle = env.ink;
      c.lineWidth = 1.5;
      c.beginPath();
      for (let g = 0; g <= 11; g++) {
        c.moveTo(g * s, 0); c.lineTo(g * s, h);
        c.moveTo(0, g * t); c.lineTo(w, g * t);
      }
      c.stroke();
    },
    tap(v, x, y, w, h) {
      const q = Math.floor((x / w) * 11) - 1, r = Math.floor((y / h) * 11) - 1;
      if (q === -1 && r === -1) return timesGoal(v);
      if (q < 0 || r < 0 || q > 9 || r > 9) return null;
      const out = flip(v, 0, r * 10 + q);
      if (!v[4]) return out;
      while (out.length < 4) out.push(0);
      out[4] = v[4];
      // σωστό κουτάκι: μένει ανοιχτό και η άσκηση σημειώνεται λυμένη
      const hit = !v[5] && (r + 1) * (q + 1) === v[4];
      out[5] = v[5] || hit ? 1 : 0;
      return hit && !bit(out, 0, r * 10 + q) ? flip(out, 0, r * 10 + q) : out;
    },
    fx: (prev, next) => (next[5] && !prev[5] ? 'win' : 'click'),
  }),

  colops: kid({
    label: 'Κάθετη πράξη', w: 320, h: 300,
    drawKid(c, w, h, _v, env) {
      const cw = w / 5, rh = h / 6;
      ['', 'Χ', 'Ε', 'Δ', 'Μ'].forEach((n, i) => text(c, n, cw * (i + 0.5), rh * 0.5, rh * 0.5, env.ink, 700));
      c.save();
      c.globalAlpha = 0.3;
      c.lineWidth = 1.2;
      c.beginPath();
      for (let i = 1; i <= 5; i++) { c.moveTo(cw * i, rh); c.lineTo(cw * i, h); }
      for (let j = 1; j <= 6; j++) { c.moveTo(cw, rh * j); c.lineTo(w, rh * j); }
      c.stroke();
      c.restore();
      // η πρώτη σειρά είναι για τα κρατούμενα, η γραμμή της πράξης πριν από το αποτέλεσμα
      text(c, 'κρατ.', cw * 0.5, rh * 1.5, rh * 0.26, env.ink, 500);
      c.lineWidth = 3.5;
      c.beginPath();
      c.moveTo(cw * 0.3, rh * 4);
      c.lineTo(w, rh * 4);
      c.stroke();
    },
  }),
};

/**
 * Εργαλεία για το Δημοτικό: αριθμογραμμή, κλάσματα, ρολόι, υλικό δεκάδων, χρήματα, πίνακας του 100, προπαίδεια,
 * ζάρι, κλήρωση, ζυγαριά και σφραγίδες επιβράβευσης. Κάθε εργαλείο ζωγραφίζεται μέσα σε κουτί w × h από την κατάστασή του
 * (λίστα αριθμών `v`) και αλλάζει με πάτημα: η `tap` επιστρέφει τη νέα κατάσταση, ή null αν το πάτημα δεν έπεσε πουθενά.
 */
import type { StampDef } from './stamps';

type C = CanvasRenderingContext2D;

/** Χρώματα που δεν εξαρτώνται από το χρώμα της γραφής. */
const BLUE = '#3b82f6', ORANGE = '#f97316', GREEN = '#22c55e', YELLOW = '#facc15', RED = '#ef4444', PURPLE = '#a855f7';
const FONT = 'system-ui, "Segoe UI", Roboto, sans-serif';

export interface KidEnv {
  /** Το χρώμα της γραφής όπως φαίνεται στο φόντο. */
  ink: string;
  /** Το χρώμα του φόντου, για «κενά» γεμίσματα. */
  bg: string;
}

const el = (n: number, d = 2): string => (+n.toFixed(d) || 0).toLocaleString('el', { maximumFractionDigits: d }).replace('-', '−');

function text(c: C, t: string, x: number, y: number, size: number, color?: string, weight = 600): void {
  c.save();
  c.font = `${weight} ${size}px ${FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  if (color) c.fillStyle = color;
  c.fillText(t, x, y);
  c.restore();
}

/** Στρογγυλό κουμπί με σύμβολο (−, +, ⟳). */
function knob(c: C, x: number, y: number, r: number, label: string, env: KidEnv): void {
  c.save();
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.globalAlpha = 0.14;
  c.fillStyle = env.ink;
  c.fill();
  c.globalAlpha = 1;
  c.lineWidth = Math.max(1.5, r * 0.09);
  c.stroke();
  text(c, label, x, y + r * 0.04, r * 1.25, env.ink, 700);
  c.restore();
}
const inR = (x: number, y: number, cx: number, cy: number, r: number): boolean => Math.hypot(x - cx, y - cy) <= r * 1.25;

function rrect(c: C, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// ---------- δυαδικές «σημαίες» σε λίστα αριθμών (25 ανά αριθμό, για να μένουν ακέραιοι στο JSON) ----------
const bit = (v: number[], from: number, i: number): boolean => ((v[from + Math.floor(i / 25)] ?? 0) & (1 << i % 25)) !== 0;
function flip(v: number[], from: number, i: number): number[] {
  const out = [...v];
  const k = from + Math.floor(i / 25);
  while (out.length <= k) out.push(0);
  out[k] ^= 1 << i % 25;
  return out;
}

// ---------- αριθμογραμμή ----------
const LINES: [from: number, to: number, step: number][] = [[0, 10, 1], [0, 20, 1], [0, 100, 10], [-10, 10, 1], [0, 1, 0.1]];

// ---------- κλάσματα ----------
/** Κάτω λωρίδα με − [κλάσμα] + : κοινή σε πίτα και μπάρα. */
function fracStrip(c: C, w: number, y: number, hh: number, n: number, k: number, env: KidEnv): void {
  const r = hh * 0.3;
  knob(c, w * 0.14, y, r, '−', env);
  knob(c, w * 0.86, y, r, '+', env);
  // το κλάσμα γραμμένο κατακόρυφα: αριθμητής, γραμμή, παρονομαστής
  const fs = hh * 0.32;
  text(c, String(k), w / 2, y - fs * 0.56, fs, env.ink, 700);
  text(c, String(n), w / 2, y + fs * 0.62, fs, env.ink, 700);
  c.save();
  c.lineWidth = Math.max(2, fs * 0.09);
  c.beginPath();
  c.moveTo(w / 2 - fs * 0.5, y);
  c.lineTo(w / 2 + fs * 0.5, y);
  c.stroke();
  c.restore();
}
function fracTap(v: number[], x: number, y: number, w: number, sy: number, hh: number): number[] | null {
  const r = hh * 0.3;
  const n = v[0] || 4;
  if (inR(x, y, w * 0.14, sy, r)) return n > 1 ? [n - 1, 0] : null;
  if (inR(x, y, w * 0.86, sy, r)) return n < 12 ? [n + 1, 0] : null;
  return null;
}
const ones = (m: number): number => { let k = 0; for (let i = 0; i < 25; i++) if (m & (1 << i)) k++; return k; };

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

// ---------- ζυγαριά ----------
const CHIPS = [1, 2, 5, 10];
interface Scale { left: number[]; right: number[]; show: boolean }
const readScale = (v: number[]): Scale => {
  const n = v[1] ?? 0;
  return { show: !!v[0], left: v.slice(2, 2 + n), right: v.slice(2 + n) };
};
const writeScale = (s: Scale): number[] => [s.show ? 1 : 0, s.left.length, ...s.left, ...s.right];
const sum = (a: number[]): number => a.reduce((p, q) => p + q, 0);
/** Γεωμετρία της ζυγαριάς για την τρέχουσα κλίση: θέσεις δίσκων και βαριδιών. */
function scaleGeom(s: Scale, w: number, h: number): { th: number; px: number; py: number; ends: [number, number][]; pans: [number, number][]; half: number; box: number; spots: { side: 0 | 1; k: number; x: number; y: number }[] } {
  const L = sum(s.left), R = sum(s.right);
  // γέρνει προς το μεγαλύτερο άθροισμα· η κλίση μεγαλώνει με τη διαφορά ως ένα όριο
  const th = Math.max(-0.2, Math.min(0.2, (R - L) * 0.035));
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

function star(c: C, cx: number, cy: number, r: number): void {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, q = i % 2 ? r * 0.42 : r;
    c.lineTo(cx + q * Math.cos(a), cy + q * Math.sin(a));
  }
  c.closePath();
}

const kid = (d: Omit<StampDef, 'draw' | 'kid'>): StampDef => ({ ...d, kid: true, draw: () => {} });

export const KIDS: Record<string, StampDef> = {
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

  fracpie: kid({
    label: 'Κλάσμα: πίτα', w: 280, h: 370, init: [4, 0],
    drawKid(c, w, h, v, env) {
      const n = v[0] || 4, cx = w / 2, cy = w / 2, r = w * 0.46;
      for (let i = 0; i < n; i++) {
        const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / n, a1 = a0 + (2 * Math.PI) / n;
        c.beginPath();
        c.moveTo(cx, cy);
        c.arc(cx, cy, r, a0, a1);
        c.closePath();
        c.fillStyle = v[1] & (1 << i) ? ORANGE : env.bg;
        c.fill();
        c.stroke();
      }
      if (n === 1) { c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke(); }
      c.fillStyle = env.ink;
      fracStrip(c, w, w + (h - w) / 2, h - w, n, ones(v[1] ?? 0), env);
    },
    tap(v, x, y, w, h) {
      const n = v[0] || 4, cx = w / 2, cy = w / 2;
      if (Math.hypot(x - cx, y - cy) <= w * 0.46) {
        let a = Math.atan2(y - cy, x - cx) + Math.PI / 2;
        if (a < 0) a += 2 * Math.PI;
        return [n, (v[1] ?? 0) ^ (1 << Math.min(n - 1, Math.floor((a / (2 * Math.PI)) * n)))];
      }
      return fracTap(v, x, y, w, w + (h - w) / 2, h - w);
    },
  }),

  fracbar: kid({
    label: 'Κλάσμα: μπάρα', w: 560, h: 170, init: [4, 0],
    drawKid(c, w, h, v, env) {
      const n = v[0] || 4, bh = h * 0.5;
      for (let i = 0; i < n; i++) {
        c.fillStyle = v[1] & (1 << i) ? BLUE : env.bg;
        c.fillRect((w * i) / n, 0, w / n, bh);
        c.strokeRect((w * i) / n, 0, w / n, bh);
      }
      c.fillStyle = env.ink;
      fracStrip(c, w, bh + (h - bh) / 2, h - bh, n, ones(v[1] ?? 0), env);
    },
    tap(v, x, y, w, h) {
      const n = v[0] || 4, bh = h * 0.5;
      if (y >= 0 && y <= bh && x >= 0 && x <= w) return [n, (v[1] ?? 0) ^ (1 << Math.min(n - 1, Math.floor((x / w) * n)))];
      return fracTap(v, x, y, w, bh + (h - bh) / 2, h - bh);
    },
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
      text(c, v[1] ? `${hr}:${String(mins % 60).padStart(2, '0')}` : '? : ??', w / 2, sy + 1, (h - w) * 0.46, env.ink, 700);
    },
    tap(v, x, y, w, h) {
      const cx = w / 2, cy = w / 2, r = w * 0.47;
      const mins = ((v[0] ?? 0) % 720 + 720) % 720;
      const d = Math.hypot(x - cx, y - cy);
      if (d <= r * 1.05) {
        let a = Math.atan2(x - cx, cy - y);
        if (a < 0) a += 2 * Math.PI;
        // έξω κοντά στους αριθμούς: ο λεπτοδείκτης (ανά 5 λεπτά)· πιο μέσα: ο ωροδείκτης
        if (d > r * 0.56) return [Math.floor(mins / 60) * 60 + (Math.round((a / (2 * Math.PI)) * 12) % 12) * 5, v[1] ?? 1];
        return [(Math.round((a / (2 * Math.PI)) * 12 - (mins % 60) / 60 + 12) % 12) * 60 + (mins % 60), v[1] ?? 1];
      }
      if (y > w && y <= h) return [mins, v[1] ? 0 : 1];
      return null;
    },
  }),

  blocks: kid({
    label: 'Εκατοντάδες, δεκάδες, μονάδες', w: 600, h: 360, init: [234, 1],
    drawKid(c, w, h, v, env) {
      const n = Math.max(0, Math.min(999, v[0] ?? 0));
      const digits = [Math.floor(n / 100), Math.floor(n / 10) % 10, n % 10];
      const cols = [0, w * 0.5, w * 0.8, w];
      const head = h * 0.15, foot = h * 0.16;
      const names = ['Ε', 'Δ', 'Μ'], fills = [GREEN, BLUE, YELLOW];
      c.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        const x0 = cols[k], x1 = cols[k + 1], mid = (x0 + x1) / 2;
        c.save();
        c.globalAlpha = 0.35;
        c.strokeRect(x0, 0, x1 - x0, h - foot);
        c.restore();
        const r = head * 0.3;
        knob(c, x0 + r * 1.6, head / 2, r, '−', env);
        knob(c, x1 - r * 1.6, head / 2, r, '+', env);
        text(c, names[k], mid, head / 2, head * 0.6, env.ink, 700);
        const top = head + 6, room = h - foot - top - 6;
        c.save();
        c.fillStyle = fills[k];
        c.strokeStyle = '#334155';
        c.lineWidth = 1;
        if (k === 0) {
          // πλάκες των 100: τετράγωνα 10 × 10, τρεις σε κάθε σειρά
          const s = Math.min((x1 - x0 - 16) / 3 - 6, room / 3 - 6);
          for (let i = 0; i < digits[0]; i++) {
            const x = x0 + 10 + (i % 3) * (s + 6), y = top + Math.floor(i / 3) * (s + 6);
            c.fillRect(x, y, s, s);
            c.beginPath();
            for (let g = 0; g <= 10; g++) {
              c.moveTo(x + (s * g) / 10, y); c.lineTo(x + (s * g) / 10, y + s);
              c.moveTo(x, y + (s * g) / 10); c.lineTo(x + s, y + (s * g) / 10);
            }
            c.stroke();
          }
        } else if (k === 1) {
          // ράβδοι των 10: όρθιες, με δέκα κυβάκια
          const bw = Math.min((x1 - x0 - 12) / 9 - 4, room / 10);
          for (let i = 0; i < digits[1]; i++) {
            const x = x0 + 8 + i * (bw + 4), bh = Math.min(room, bw * 10);
            c.fillRect(x, top, bw, bh);
            c.beginPath();
            c.rect(x, top, bw, bh);
            for (let g = 1; g < 10; g++) { c.moveTo(x, top + (bh * g) / 10); c.lineTo(x + bw, top + (bh * g) / 10); }
            c.stroke();
          }
        } else {
          const s = Math.min((x1 - x0 - 16) / 3 - 6, room / 3 - 6, w * 0.045);
          for (let i = 0; i < digits[2]; i++) {
            const x = x0 + 10 + (i % 3) * (s + 6), y = top + Math.floor(i / 3) * (s + 6);
            c.fillRect(x, y, s, s);
            c.strokeRect(x, y, s, s);
          }
        }
        c.restore();
      }
      text(c, v[1] ? String(n) : 'Ποιος αριθμός είναι;', w / 2, h - foot / 2 + 2, foot * (v[1] ? 0.7 : 0.42), env.ink, 700);
    },
    tap(v, x, y, w, h) {
      const n = Math.max(0, Math.min(999, v[0] ?? 0));
      const cols = [0, w * 0.5, w * 0.8, w], head = h * 0.15, foot = h * 0.16, r = head * 0.3;
      if (y > h - foot && y <= h) return [n, v[1] ? 0 : 1];
      for (let k = 0; k < 3; k++) {
        const unit = [100, 10, 1][k], digit = Math.floor(n / unit) % 10;
        if (inR(x, y, cols[k] + r * 1.6, head / 2, r * 1.2)) return digit > 0 ? [n - unit, v[1] ?? 1] : null;
        if (inR(x, y, cols[k + 1] - r * 1.6, head / 2, r * 1.2)) return digit < 9 ? [n + unit, v[1] ?? 1] : null;
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
      text(c, '×', s / 2, t / 2, s * 0.5, env.ink, 700);
      for (let i = 1; i <= 10; i++) {
        text(c, String(i), s * (i + 0.5), t / 2 + 1, s * 0.44, env.ink, 700);
        text(c, String(i), s / 2, t * (i + 0.5) + 1, s * 0.44, env.ink, 700);
      }
      // τα γινόμενα είναι κρυμμένα· κάθε πάτημα αποκαλύπτει (ή ξανακρύβει) ένα
      for (let r = 0; r < 10; r++) for (let q = 0; q < 10; q++) {
        if (!bit(v, 0, r * 10 + q)) continue;
        c.fillStyle = GREEN;
        c.globalAlpha = 0.35;
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
      if (q < 0 || r < 0 || q > 9 || r > 9) return null;
      return flip(v, 0, r * 10 + q);
    },
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
      for (const [i, j] of dots[Math.max(1, Math.min(6, v[0] ?? 1))]) {
        c.beginPath();
        c.arc(w * p[i], h * p[j], w * 0.085, 0, Math.PI * 2);
        c.fill();
      }
      void env;
    },
    tap: (v) => { let n = 1 + Math.floor(Math.random() * 6); if (n === v[0]) n = 1 + (n % 6); return [n]; },
  }),

  lottery: kid({
    label: 'Κλήρωση αριθμού', w: 240, h: 270, init: [0, 25],
    drawKid(c, w, h, v, env) {
      const n = v[1] || 25, top = h * 0.74;
      rrect(c, 2, 2, w - 4, top - 4, w * 0.12);
      c.save();
      c.fillStyle = PURPLE;
      c.globalAlpha = 0.18;
      c.fill();
      c.restore();
      c.lineWidth = Math.max(2.5, w * 0.014);
      c.stroke();
      text(c, v[0] ? String(v[0]) : '?', w / 2, top * 0.52, top * 0.52, env.ink, 800);
      const r = (h - top) * 0.36, y = top + (h - top) / 2;
      knob(c, w * 0.16, y, r, '−', env);
      knob(c, w * 0.84, y, r, '+', env);
      text(c, `1 έως ${n}`, w / 2, y + 1, (h - top) * 0.36, env.ink, 600);
    },
    tap(v, x, y, w, h) {
      const n = v[1] || 25, top = h * 0.74, r = (h - top) * 0.36, sy = top + (h - top) / 2;
      if (y >= 0 && y < top) {
        let k = 1 + Math.floor(Math.random() * n);
        if (k === v[0] && n > 1) k = 1 + (k % n);
        return [k, n];
      }
      if (inR(x, y, w * 0.16, sy, r)) return n > 2 ? [0, n - 1] : null;
      if (inR(x, y, w * 0.84, sy, r)) return n < 99 ? [0, n + 1] : null;
      return null;
    },
  }),

  balance: kid({
    label: 'Ζυγαριά', w: 660, h: 430, init: [1, 0],
    drawKid(c, w, h, v, env) {
      const s = readScale(v), g = scaleGeom(s, w, h);
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
      const cy = h * 0.88, cr = w * 0.036;
      CHIPS.forEach((n, i) => {
        for (const side of [0, 1]) {
          const x = side ? w * 0.62 + i * cr * 2.5 + cr : w * 0.38 - i * cr * 2.5 - cr;
          c.beginPath();
          c.arc(x, cy, cr, 0, Math.PI * 2);
          c.save();
          c.fillStyle = side ? ORANGE : BLUE;
          c.globalAlpha = 0.85;
          c.fill();
          c.restore();
          text(c, `+${n}`, x, cy + 1, cr * 0.8, '#ffffff', 700);
        }
      });
      text(c, s.show ? `${L} ${L === R ? '=' : L > R ? '>' : '<'} ${R}` : '?', w / 2, cy + 1, cr * 1.05, env.ink, 800);
    },
    tap(v, x, y, w, h) {
      const s = readScale(v), g = scaleGeom(s, w, h);
      const hit = [...g.spots].reverse().find((p) => Math.abs(x - p.x) < g.box * 0.6 && Math.abs(y - p.y) < g.box * 0.6);
      if (hit) {
        (hit.side ? s.right : s.left).splice(hit.k, 1);
        return writeScale(s);
      }
      const cy = h * 0.88, cr = w * 0.036;
      for (let i = 0; i < CHIPS.length; i++) {
        for (const side of [0, 1]) {
          const cx = side ? w * 0.62 + i * cr * 2.5 + cr : w * 0.38 - i * cr * 2.5 - cr;
          if (!inR(x, y, cx, cy, cr)) continue;
          const list = side ? s.right : s.left;
          if (list.length >= 12) return null;
          list.push(CHIPS[i]);
          return writeScale(s);
        }
      }
      if (Math.abs(x - w / 2) < w * 0.1 && Math.abs(y - cy) < cr * 1.4) return writeScale({ ...s, show: !s.show });
      return null;
    },
  }),

  star: kid({
    label: 'Αστέρι', w: 140, h: 140,
    drawKid(c, w, h) {
      star(c, w / 2, h * 0.53, w * 0.48);
      c.fillStyle = YELLOW;
      c.fill();
      c.strokeStyle = '#b45309';
      c.lineWidth = Math.max(2.5, w * 0.03);
      c.lineJoin = 'round';
      c.stroke();
    },
  }),

  smile: kid({
    label: 'Φατσούλα', w: 140, h: 140,
    drawKid(c, w, h) {
      const r = w * 0.46;
      c.beginPath();
      c.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      c.fillStyle = YELLOW;
      c.fill();
      c.strokeStyle = '#92400e';
      c.lineWidth = Math.max(2.5, w * 0.03);
      c.stroke();
      c.fillStyle = '#92400e';
      for (const dx of [-0.32, 0.32]) {
        c.beginPath();
        c.arc(w / 2 + r * dx, h / 2 - r * 0.22, r * 0.1, 0, Math.PI * 2);
        c.fill();
      }
      c.lineCap = 'round';
      c.beginPath();
      c.arc(w / 2, h / 2 + r * 0.05, r * 0.55, Math.PI * 0.15, Math.PI * 0.85);
      c.stroke();
    },
  }),

  bravo: kid({
    label: 'Μπράβο!', w: 300, h: 120,
    drawKid(c, w, h) {
      rrect(c, 3, 3, w - 6, h - 6, h * 0.3);
      c.fillStyle = GREEN;
      c.fill();
      c.strokeStyle = '#166534';
      c.lineWidth = Math.max(3, h * 0.04);
      c.stroke();
      star(c, h * 0.52, h * 0.52, h * 0.3);
      c.fillStyle = YELLOW;
      c.fill();
      text(c, 'Μπράβο!', w * 0.6, h * 0.53, h * 0.42, '#ffffff', 800);
    },
  }),
};

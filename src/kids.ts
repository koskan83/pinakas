/**
 * Εργαλεία για το Δημοτικό: αριθμογραμμή, κλάσματα, ρολόι, υλικό δεκάδων, χρήματα, πίνακας του 100, προπαίδεια,
 * ζάρι, κλήρωση, ζυγαριά και σφραγίδες επιβράβευσης. Κάθε εργαλείο ζωγραφίζεται μέσα σε κουτί w × h από την κατάστασή του
 * (λίστα αριθμών `v`) και αλλάζει με πάτημα: η `tap` επιστρέφει τη νέα κατάσταση, ή null αν το πάτημα δεν έπεσε πουθενά.
 */
import type { KidAsk, StampDef } from './stamps';

type C = CanvasRenderingContext2D;

/** Χρώματα που δεν εξαρτώνται από το χρώμα της γραφής. */
const BLUE = '#3b82f6', ORANGE = '#f97316', GREEN = '#22c55e', YELLOW = '#facc15', RED = '#ef4444', PURPLE = '#a855f7';
const FONT = 'system-ui, "Segoe UI", Roboto, sans-serif';

export interface KidEnv {
  /** Το χρώμα της γραφής όπως φαίνεται στο φόντο. */
  ink: string;
  /** Το χρώμα του φόντου, για «κενά» γεμίσματα. */
  bg: string;
  /** Το εργαλείο γεμίζει όλη την οθόνη (κυβάκια): το τελευταίο κουμπί του γίνεται «πόρτα» επιστροφής. */
  full?: boolean;
  /** Η κατάσταση μόλις άλλαξε: πριν από πόσα ms και ποια ήταν, για να κινηθεί ομαλά (ζυγαριά, ζάρι, κλήρωση, κρεμάλα). */
  anim?: { t: number; prev: number[] };
  /** Τα ονόματα των μαθητών του τμήματος, αν το μάθημα ανήκει σε τμήμα με λίστα (κλήρωση με ονόματα). */
  names?: string[];
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

/** Κείμενο που μικραίνει όσο χρειάζεται για να χωρέσει σε πλάτος maxW. */
function fitText(c: C, t: string, x: number, y: number, size: number, maxW: number, color?: string, weight = 600): void {
  c.save();
  c.font = `${weight} ${size}px ${FONT}`;
  const m = c.measureText(t).width;
  c.restore();
  text(c, t, x, y, m > maxW ? (size * maxW) / m : size, color, weight);
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
/** Το πράσινο του «σωστό». */
const GOOD = '#16a34a';
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
const POLL_COLORS = [BLUE, ORANGE, GREEN, PURPLE, RED];
/** Με δύο επιλογές η ψηφοφορία είναι ναι/όχι (ή σωστό/λάθος)· με περισσότερες, Α Β Γ Δ Ε. */
const pollName = (n: number, i: number): string => (n === 2 ? '✓✗'[i] : 'ΑΒΓΔΕ'[i]);
function pollGeom(v: number[], w: number, h: number): { n: number; top: number; gap: number; cw: number; lab: number; r: number } {
  const n = Math.max(2, Math.min(5, v[0] || 4)), top = h * 0.78, gap = w * 0.03;
  return { n, top, gap, cw: (w - gap * (n + 1)) / n, lab: h * 0.13, r: (h - top) * 0.36 };
}
/** Ώρα σε μορφή 7:45 από λεπτά μετά τις 12. */
const clockText = (mins: number): string => `${Math.floor(mins / 60) || 12}:${String(mins % 60).padStart(2, '0')}`;
/** Μικρό κουμπί που αλλάζει την όψη του κλάσματος· με περίγραμμα όταν είναι αναμμένο. */
function skinBtn(c: C, x: number, y: number, r: number, emoji: string, on: boolean, env: KidEnv): void {
  c.save();
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = env.ink;
  c.globalAlpha = on ? 0.22 : 0.08;
  c.fill();
  c.globalAlpha = 1;
  if (on) {
    c.strokeStyle = env.ink;
    c.lineWidth = Math.max(2, r * 0.12);
    c.stroke();
  }
  c.restore();
  text(c, emoji, x, y + r * 0.06, r * 1.15);
}
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
const sum = (a: number[]): number => a.reduce((p, q) => p + q, 0);
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

// ---------- ορθογραφία με το τερατάκι ----------
/**
 * Τα πλήκτρα όπως σε κανονικό πληκτρολόγιο (ελληνικό ή QWERTY), για να μαθαίνουν τα παιδιά και τη διάταξη:
 * κάθε σειρά με την εσοχή της (σε πλάτη πλήκτρου), το ⌫ στο τέλος της τρίτης και το κενό από κάτω.
 * Ο τόνος είναι νεκρό πλήκτρο, όπως στο αληθινό: πρώτα ΄ και μετά το φωνήεν (ξανά ΄ για διαλυτικά, και τρίτη φορά για ΐ, ΰ).
 * Το «;» της πρώτης θέσης δεν γράφει τίποτα· είναι εκεί μόνο για να μένουν τα γράμματα στη θέση τους.
 */
const SPELL_ROWS: [number, string][] = [[0, ';ςερτυθιοπ'], [0.25, 'ασδφγηξκλ΄'], [0.75, 'ζχψωβνμ⌫']];
const SPELL_ROWS_EN: [number, string][] = [[0, 'qwertyuiop'], [0.25, "asdfghjkl'"], [0.75, 'zxcvbnm⌫']];
/** Πόσα πλάτη πλήκτρου πιάνει όλο το πληκτρολόγιο, και το ⌫. */
const SPELL_KB_UNITS = 10.25, SPELL_BS = 2.5;
/** Τι γίνεται ένα φωνήεν μετά το νεκρό πλήκτρο: 1 τόνος, 2 διαλυτικά, 3 και τα δύο. */
const SPELL_ACC = ['', 'άέήίόύώ', 'αεηϊοϋω', 'αεηΐοΰω'].map((to) => new Map([...'αεηιουω'].map((ch, i) => [ch, to[i]])));
const SPELL_ACC_KEY = ['΄', '΄', '¨', '΅'];
/** Τα πλήκτρα ακολουθούν τη γλώσσα της λέξης που ζητείται. */
const spellIsEn = (target: string): boolean => /[a-z]/.test(target);
/** Πού είναι κάθε πλήκτρο, μέσα στην περιοχή των πλήκτρων (`kx`, `ky`, πλάτος `kw`·10, ύψος `kh`·4). */
export function spellKeyboard(g: { kx: number; ky: number; kw: number; kh: number }, en: boolean): { key: string; x: number; y: number; w: number; h: number }[] {
  const u = (g.kw * 10) / SPELL_KB_UNITS, out: { key: string; x: number; y: number; w: number; h: number }[] = [];
  (en ? SPELL_ROWS_EN : SPELL_ROWS).forEach(([off, keys], row) => [...keys].forEach((key, i) => {
    out.push({ key, x: g.kx + (off + i) * u, y: g.ky + row * g.kh, w: key === '⌫' ? SPELL_BS * u : u, h: g.kh });
  }));
  out.push({ key: ' ', x: g.kx + 2.5 * u, y: g.ky + 3 * g.kh, w: 5.5 * u, h: g.kh });
  return out;
}
/** Πόσα γράμματα χωρά μια λέξη ή πρόταση, και πόσα μπορεί να γράψει ο μαθητής (λίγα παραπάνω, για τα περιττά). */
const SPELL_LEN = 40, SPELL_MAX = 42, SPELL_WORDS = 20, SPELL_PICK = 8;
/** Πόσο κρατά το φάγωμα ενός λάθους (ms) και πότε αρχίζει το πρώτο. */
const SPELL_STEP = 800, SPELL_T0 = 350, SPELL_SNIFF = 300;
const SPELL_GRADES = ['Α΄', 'Β΄', 'Γ΄', 'Δ΄', 'Ε΄', 'ΣΤ΄'];
/** Έτοιμες λέξεις ανά τάξη· κάθε παιχνίδι παίρνει στην τύχη SPELL_PICK από αυτές. */
const SPELL_READY = [
  'μαμά νερό παιδί γάτα σπίτι ήλιος μήλο καλός τόπι φως χέρι πόδι λεμόνι ψωμί γάλα',
  'σχολείο δάσκαλος βιβλίο θάλασσα παιχνίδι καλημέρα οικογένεια μολύβι τετράδιο ποδήλατο ουρανός λουλούδι κήπος αυτοκίνητο',
  'άνθρωπος γειτονιά ταξίδι χειμώνας καλοκαίρι άνοιξη φθινόπωρο εικόνα ζωγραφιά μαθητής παράθυρο κουζίνα ειρήνη αεροπλάνο',
  'συγγραφέας εφημερίδα υπολογιστής περιβάλλον θερμοκρασία εγγονός άγγελος συννεφιά αγκαλιά ευχαριστώ πρωινό βιβλιοθήκη γυμναστική',
  'δημοκρατία επανάσταση πολιτισμός εκπαίδευση συνάντηση αλληλεγγύη ανακύκλωση εμπιστοσύνη πληροφορία ειλικρίνεια υποχρέωση εξαίρεση',
  'κοινοβούλιο συνείδηση αξιοπρέπεια ευαισθησία παρεξήγηση επιχείρηση συμπεριφορά διεύθυνση ατμόσφαιρα δικαιοσύνη ευθύνη αποτέλεσμα σύγκρουση εξυπηρέτηση',
].map((s) => s.split(' '));
/** Οι αγγλικές έχουν δίπλα τους τη σημασία στα ελληνικά: αυτή βλέπει ο μαθητής, και γράφει την αγγλική λέξη. */
const SPELL_READY_EN = [
  'cat=γάτα dog=σκύλος sun=ήλιος red=κόκκινο blue=μπλε one=ένα two=δύο book=βιβλίο pen=στιλό mum=μαμά dad=μπαμπάς ball=μπάλα',
  'apple=μήλο school=σχολείο green=πράσινο yellow=κίτρινο three=τρία happy=χαρούμενος water=νερό house=σπίτι mother=μητέρα father=πατέρας sister=αδελφή brother=αδελφός',
  'teacher=δάσκαλος friend=φίλος family=οικογένεια window=παράθυρο orange=πορτοκάλι monday=Δευτέρα pencil=μολύβι number=αριθμός garden=κήπος rabbit=κουνέλι summer=καλοκαίρι winter=χειμώνας',
  'breakfast=πρωινό birthday=γενέθλια tomorrow=αύριο elephant=ελέφαντας football=ποδόσφαιρο saturday=Σάββατο beautiful=όμορφος kitchen=κουζίνα morning=πρωί thursday=Πέμπτη because=επειδή children=παιδιά',
  'different=διαφορετικός favourite=αγαπημένος wednesday=Τετάρτη mountain=βουνό language=γλώσσα question=ερώτηση february=Φεβρουάριος together=μαζί vegetable=λαχανικό computer=υπολογιστής yesterday=χθες dangerous=επικίνδυνος',
  'environment=περιβάλλον necessary=απαραίτητος restaurant=εστιατόριο temperature=θερμοκρασία government=κυβέρνηση interesting=ενδιαφέρων neighbour=γείτονας knowledge=γνώση dictionary=λεξικό experience=εμπειρία invitation=πρόσκληση comfortable=άνετος',
].map((s) => s.split(' '));
const SPELL_MEANING = new Map(SPELL_READY_EN.flat().map((e) => e.split('=') as [string, string]));
/** Λέξη ή πρόταση όπως συγκρίνεται, ελληνική ή αγγλική: πεζά με τους τόνους τους, χωρίς στίξη (μένει η απόστροφος) και διπλά κενά. */
export function spellNorm(text: string, max = SPELL_LEN): string {
  return text.toLocaleLowerCase('el').replace(/[’`´]/g, "'").replace(/[^α-ωάέήίόύώϊϋΐΰa-z' ]/g, '').replace(/ +/g, ' ').trim().slice(0, max).trim();
}
/**
 * Η λίστα του δασκάλου: λέξεις ή μικρές προτάσεις χωρισμένες με κόμμα (ή ερωτηματικό, ή αλλαγή γραμμής).
 * Κάθε μία μπορεί να έχει μετά από «=» αυτό που θα βλέπει ο μαθητής (π.χ. τη σημασία στα ελληνικά: apple=μήλο)·
 * αν γραφτούν ανάποδα (μήλο=apple), η αγγλική είναι αυτή που ζητείται. Αντί για «=» πιάνουν και « - », «:» και το tab
 * (δύο στήλες επικολλημένες από Excel). Χωρίς κανένα κόμμα ή αλλαγή γραμμής, κάθε λέξη χωριστά (π.χ. «μήλο σχολείο φως»).
 */
export function spellList(text: string): { words: string[]; hints: string[] } {
  const words: string[] = [], hints: string[] = [];
  const flat = text.replace(/[ \t]*(?:=|:|\t| [-–—] )[ \t]*/g, '=').replace(/\r/g, '');
  for (const entry of flat.split(/[,;·\n]/.test(flat) ? /[,;·\n]+/ : /\s+/)) {
    const [a, b = ''] = entry.split('='), swap = !!b && !/[a-z]/i.test(a) && /[a-z]/i.test(b);
    const word = spellNorm(swap ? b : a);
    if (!word || words.length >= SPELL_WORDS) continue;
    words.push(word);
    // αγγλική λέξη χωρίς σημασία: αν είναι από τις έτοιμες, μπαίνει η δική τους
    hints.push((swap ? a : b).replace(/\s+/g, ' ').trim().slice(0, SPELL_LEN) || (SPELL_MEANING.get(word) ?? ''));
  }
  return { words, hints };
}
/**
 * Η κατάσταση του παιχνιδιού.
 * `phase`: 0 ο μαθητής γράφει · 1 πρώτος έλεγχος, το τερατάκι έφαγε τα λάθη και ο μαθητής γράφει το σωστό στα κενά · 2 τέλος της λέξης ·
 * 3 γραφή με το χέρι χωρίς ανάγνωση: φαίνεται η σωστή και η τάξη λέει αν γράφτηκε σωστά.
 * `res` ανά λέξη: 0 δεν παίχτηκε · 1 σωστή με την πρώτη · 10 + όσα λάθη έφαγε το τερατάκι (και όσο διορθώνεται, και αν έμεινε λάθος) ·
 * 100 + όσα έφαγε, αν γράφτηκε σωστά στη δεύτερη προσπάθεια (2 σε παλιότερες καταστάσεις).
 * `sel`: το γράμμα που έχει πιαστεί για αλλαγή (θέση + 1), 0 αν γράφει στο τέλος. `marks`: ποιες θέσεις άδειασε ο πρώτος έλεγχος
 * (το «_» είναι κενή θέση που περιμένει γράμμα). `peek`: η σωστή λέξη φαίνεται· `ready`: έτοιμες λέξεις, άρα κάθε νέα λέξη δείχνεται πρώτα.
 * `hints`: ανά λέξη, αυτό που βλέπει ο μαθητής αντί να την ακούσει (η σημασία της στα ελληνικά), ή κενό. `said`: αλλάζει σε κάθε πάτημα του 🔊.
 * `en`: στην αρχική οθόνη έχουν διαλεχτεί τα Αγγλικά (έτοιμες αγγλικές λέξεις, υπαγόρευση στα αγγλικά).
 * `acc`: πατήθηκε το νεκρό πλήκτρο του τόνου και περιμένει φωνήεν (1 τόνος, 2 διαλυτικά, 3 και τα δύο).
 */
export interface Spell {
  phase: number; hand: boolean; peek: boolean; ready: boolean; en: boolean; said: boolean; acc: number; idx: number; sel: number;
  words: string[]; hints: string[]; res: number[]; typed: string; marks: boolean[];
}
const SPELL_NEW = 1024, SPELL_MARK = 0x10000;
const SPELL_EMPTY: Spell = { phase: 0, hand: false, peek: false, ready: false, en: false, said: false, acc: 0, idx: 0, sel: 0, words: [], hints: [], res: [], typed: '', marks: [] };
/** [σημαίες, ποια λέξη, πιασμένο γράμμα, μήκος λίστας, η λίστα…, αποτέλεσμα ανά λέξη…, ό,τι έχει γραφτεί…]. */
export function spellState(v: number[]): Spell {
  const f = v[0] ?? 0;
  // καταστάσεις της πρώτης έκδοσης (μία λέξη) δεν έχουν τη σημαία: ξεκινούν από την αρχή
  if (!(f & SPELL_NEW)) return SPELL_EMPTY;
  const n = v[3] ?? 0, list = String.fromCharCode(...v.slice(4, 4 + n)), entries = list ? list.split('\n').map((e) => e.split('=')) : [], words = entries.map((e) => e[0]);
  const rest = v.slice(4 + n + words.length);
  return {
    phase: f & 3, hand: (f & 4) !== 0, peek: (f & 8) !== 0, ready: (f & 16) !== 0, en: (f & 32) !== 0, said: (f & 64) !== 0, acc: (f >> 7) & 3, idx: v[1] ?? 0, sel: v[2] ?? 0, words, hints: entries.map((e) => e[1] ?? ''),
    res: words.map((_, i) => v[4 + n + i] ?? 0), typed: rest.map((code) => String.fromCharCode(code % SPELL_MARK)).join(''), marks: rest.map((code) => code >= SPELL_MARK),
  };
}
export function spellPack(s: Spell): number[] {
  const list = s.words.map((word, i) => (s.hints[i] ? `${word}=${s.hints[i]}` : word)).join('\n');
  return [
    SPELL_NEW + s.phase + (s.hand ? 4 : 0) + (s.peek ? 8 : 0) + (s.ready ? 16 : 0) + (s.en ? 32 : 0) + (s.said ? 64 : 0) + (s.acc << 7), s.idx, s.sel, list.length,
    ...[...list].map((ch) => ch.charCodeAt(0)), ...s.words.map((_, i) => s.res[i] ?? 0),
    ...[...s.typed].map((ch, i) => ch.charCodeAt(0) + (s.marks[i] ? SPELL_MARK : 0)),
  ];
}
/**
 * Αντιστοιχίζει ό,τι γράφτηκε με το σωστό, γράμμα προς γράμμα: `a` αυτό που έγραψε ο μαθητής, `b` το σωστό.
 * Λάθος γράμμα έχει και τα δύο διαφορετικά· γράμμα που περισσεύει δεν έχει `b`· γράμμα που λείπει δεν έχει `a`.
 */
export function spellDiff(typed: string, target: string): { a: string | null; b: string | null }[] {
  const n = typed.length, m = target.length;
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) d[i][j] = Math.min(d[i - 1][j - 1] + (typed[i - 1] === target[j - 1] ? 0 : 1), d[i - 1][j] + 1, d[i][j - 1] + 1);
  const out: { a: string | null; b: string | null }[] = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (typed[i - 1] === target[j - 1] ? 0 : 1)) out.push({ a: typed[--i], b: target[--j] });
    else if (i > 0 && d[i][j] === d[i - 1][j] + 1) out.push({ a: typed[--i], b: null });
    else out.push({ a: null, b: target[--j] });
  }
  return out.reverse();
}
/** Πόσα λάθη έχει φάει το τερατάκι σε όλες τις λέξεις μέχρι τώρα. */
const spellAte = (r: number): number => (r >= 100 ? r - 100 : r >= 10 ? r - 10 : 0);
const spellEaten = (res: number[]): number => res.reduce((sum, r) => sum + spellAte(r), 0);
/** Η λέξη γράφτηκε σωστά στη δεύτερη προσπάθεια, αφού το τερατάκι έφαγε τα λάθη της πρώτης. */
const spellFixed = (r: number): boolean => r === 2 || r >= 100;
/**
 * Το τερατάκι μεγαλώνει πολύ με κάθε λάθος που τρώει (`k` από 0 έως 9, σχεδόν τριπλάσιο στο ένατο). Στο δέκατο γίνεται
 * τεράστιο, γεμίζει την οθόνη και τρώει τον μαθητή (SPELL_FEAST)· μετά ρεύεται και ξαναγίνεται μικρό, για τα επόμενα δέκα.
 */
const spellR = (w: number, k: number): number => w * 0.042 * (1 + 0.17 * k);
const SPELL_FEAST = 10;
/** Πόσο κρατά η σκηνή του δέκατου λάθους (ms): μεγαλώνει, χαμ, σκοτάδι μέσα στο στόμα, ρέψιμο. */
const SPELL_FIN = 3600;
/** Κάθε πόσα ms κλείνει το στόμα μέσα στη σκηνή (ένα «ΧΑΜ!» τη φορά). */
const SPELL_CHOMP = 600;
/**
 * Ο έλεγχος αυτού που γράφτηκε. Την πρώτη φορά το τερατάκι τρώει τα λάθη και αφήνει τη θέση τους κενή («_»), για να γράψει
 * ο μαθητής το σωστό· ό,τι περίσσευε φεύγει. Τη δεύτερη, τρώει όσα έμειναν και φαίνεται το σωστό.
 */
function spellCheck(s: Spell, written: string): Spell | null {
  const target = s.words[s.idx], t = spellNorm(written, SPELL_MAX);
  if (!target || !t) return null;
  const diff = spellDiff(t, target), bad = diff.filter((cell) => cell.a !== cell.b).length;
  const res = [...s.res], ate = spellAte(res[s.idx] ?? 0);
  s = { ...s, acc: 0 };
  if (bad && s.phase === 0) {
    const kept = diff.filter((cell) => cell.b !== null), marks = kept.map((cell) => cell.a !== cell.b);
    res[s.idx] = 10 + bad;
    return { ...s, phase: 1, peek: false, typed: kept.map((cell) => (cell.a === cell.b ? cell.a : '_')).join(''), marks, sel: s.hand ? 0 : marks.indexOf(true) + 1, res };
  }
  res[s.idx] = bad ? 10 + ate + bad : ate ? 100 + ate : 1;
  return { ...s, phase: 2, peek: false, typed: t, marks: [], sel: 0, res };
}
/**
 * Πόσα ms έχουν περάσει από την αρχή της σκηνής του δέκατου λάθους (βλ. spellFeast)· αρχίζει όταν τελειώσει το φάγωμα των
 * γραμμάτων, όπως και ο ήχος της (fx.ts): μετά το μύρισμα (στον πρώτο έλεγχο), ένα δάγκωμα για καθένα, και η επιστροφή.
 */
function spellFin(s: Spell, prev: Spell, at: number): number {
  return at - (s.phase === 1 && prev.phase === 0 ? SPELL_SNIFF : 0) - SPELL_T0 - (s.typed ? spellEaten(s.res) - spellEaten(prev.res) : 0) * SPELL_STEP - 400;
}
/** Το τερατάκι έφαγε δέκα λάθη, άρα κι εσένα: μετά τη σκηνή η λίστα ξεκινά από την αρχή, με το τερατάκι μικρό. */
const spellFed = (s: Spell): boolean => spellEaten(s.res) >= SPELL_FEAST;
/** Η κατάσταση όπως παίζεται: αν το τερατάκι σε έχει φάει, η ίδια λίστα από την αρχή. */
function spellLive(v: number[]): Spell {
  const s = spellState(v);
  return spellFed(s) ? spellStart(s, s.words, s.ready, s.hints) : s;
}
/** Η επόμενη λέξη (ή, μετά την τελευταία, τα αποτελέσματα). */
const spellNext = (s: Spell): Spell => ({ ...s, acc: 0, phase: 0, idx: s.idx + 1, typed: '', marks: [], sel: 0, peek: s.ready && s.idx + 1 < s.words.length && !s.hints[s.idx + 1] });
/** Νέο παιχνίδι. Οι έτοιμες λέξεις φαίνονται πρώτα (κανείς δεν τις ξέρει), εκτός αν ο μαθητής βλέπει τη σημασία τους. */
/** Νέο παιχνίδι με τις λέξεις ενός κειμένου (π.χ. από λίστα ή από τον πίνακα)· null αν δεν βρέθηκε καμία. */
export function spellGame(text: string): number[] | null {
  const list = spellList(text);
  return list.words.length ? spellPack(spellStart({ ...SPELL_EMPTY, en: list.words.every((w) => spellIsEn(w)) }, list.words, false, list.hints)) : null;
}
const spellStart = (s: Spell, words: string[], ready: boolean, hints: string[] = []): Spell => ({ ...SPELL_EMPTY, hand: s.hand, en: s.en, words, hints: words.map((_, i) => hints[i] ?? ''), res: words.map(() => 0), ready, peek: ready && !hints[0] });
/** Το γεγονός που κάνει την εφαρμογή να πει δυνατά τη λέξη (βλέπε kidFx). */
const spellSay = (s: Spell): string => `say|${/[a-z]/.test(s.words[s.idx]) ? 'en-GB' : 'el-GR'}|${s.words[s.idx]}`;
/**
 * Διάταξη: πάνω η πρόοδος, μετά η γραμμή όπου γράφεται η λέξη (`base`) και τι λέει το τερατάκι (`msg`), στη μέση τα πλήκτρα
 * (ή το πλαίσιο για γραφή με το χέρι), κάτω τα κουμπιά: Λέξεις, 👁, 🔊, τρόπος γραφής, Έλεγχος / Επόμενη.
 */
function spellGeom(w: number, h: number): { top: number; base: number; msg: number; ky: number; kh: number; kx: number; kw: number; by: number; bh: number; bx: number[]; bw: number[] } {
  return { top: h * 0.05, base: h * 0.345, msg: h * 0.44, ky: h * 0.475, kh: h * 0.0975, kx: w * 0.02, kw: w * 0.096, by: h * 0.875, bh: h * 0.11, bx: [0.02, 0.165, 0.25, 0.335, 0.52].map((f) => w * f), bw: [0.135, 0.075, 0.075, 0.175, 0.46].map((f) => w * f) };
}
/** Τα κουτάκια των γραμμάτων: όσο μεγαλώνει το τερατάκι, τόσο περισσότερο χώρο κρατά δεξιά και αριστερά της λέξης. */
function spellLay(w: number, n: number, eaten: number): { r: number; cw: number; x0: number } {
  const r = spellR(w, eaten % SPELL_FEAST), m = Math.max(n, 1), cw = Math.min(w * 0.08, (w - 2 * (r * 2 + w * 0.03)) / m);
  return { r, cw, x0: (w - m * cw) / 2 };
}
const spellBtn = (g: { bx: number[]; bw: number[]; by: number; bh: number }, x: number, y: number): number => (y < g.by || y > g.by + g.bh ? -1 : [0, 1, 2, 3, 4].findIndex((i) => x >= g.bx[i] && x <= g.bx[i] + g.bw[i]));
/**
 * Η σκηνή του δέκατου λάθους, πάνω από όλο το εργαλείο: το τερατάκι φουσκώνει ως να γεμίσει την οθόνη με το στόμα ορθάνοιχτο,
 * «ΧΑΜ!» και όλα σκοτεινιάζουν (είσαι μέσα στο στόμα του), μασάει, ρεύεται και ξαναγίνεται μικρό στη θέση του.
 * `from`: πού ήταν και πόσο μεγάλο· `to`: πού και πόσο θα καταλήξει. `u`: ms από την αρχή (0 έως SPELL_FIN).
 */
function spellFeast(c: C, w: number, h: number, u: number, from: { x: number; y: number; r: number }, to: { x: number; y: number; r: number }): void {
  const ease = (q: number): number => (q <= 0 ? 0 : q >= 1 ? 1 : q * q * (3 - 2 * q));
  const R = Math.hypot(w, h) * 0.55, GROW = 1300, DARK = 2700;
  c.save();
  c.beginPath();
  c.rect(0, 0, w, h);
  c.clip();
  // σκιά που πλησιάζει όσο μεγαλώνει
  const shade = u < GROW ? ease(u / GROW) * 0.35 : u < DARK ? 1 : Math.max(0, 1 - (u - DARK) / 500);
  if (u < GROW) {
    const q = ease(u / GROW), shake = q > 0.5 ? Math.sin(u / 30) * w * 0.006 * q : 0;
    c.fillStyle = '#000000';
    c.globalAlpha = shade;
    c.fillRect(0, 0, w, h);
    c.globalAlpha = 1;
    monster(c, from.x + (w / 2 - from.x) * q + shake, from.y + (h * 0.42 - from.y) * q, from.r + (R - from.r) * q * q, Math.min(1, 0.2 + q * 1.1));
  } else if (u < DARK) {
    // μέσα στο στόμα: σκοτάδι, δόντια πάνω και κάτω που κλείνουν και ανοίγουν (μάσημα)
    // το στόμα κλείνει τη στιγμή που μπαίνεις και μετά κάθε SPELL_CHOMP ms (μαζί με τον ήχο, βλ. fx.ts)
    const v = u - GROW, p = v % SPELL_CHOMP, bite = 0.5 - 0.5 * Math.cos((2 * Math.PI * v) / SPELL_CHOMP);
    c.fillStyle = '#2e1065';
    c.fillRect(0, 0, w, h);
    const gap = h * (0.09 + 0.3 * bite), n = 7, tw = w / n, th = h * 0.13;
    // άνω και κάτω σαγόνι: μωβ ούλα και άσπρα δόντια που πλησιάζουν
    for (const dir of [-1, 1]) {
      const edge = h / 2 + dir * gap, base = edge + dir * th;
      c.fillStyle = PURPLE;
      c.fillRect(0, dir < 0 ? 0 : base, w, dir < 0 ? base : h - base);
      c.fillStyle = '#ffffff';
      for (let i = 0; i < n; i++) {
        c.beginPath();
        c.moveTo(i * tw + 2, base);
        c.lineTo((i + 1) * tw - 2, base);
        c.lineTo((i + 0.5) * tw, edge);
        c.closePath();
        c.fill();
      }
    }
    // ένα «ΧΑΜ!» σε κάθε κλείσιμο: πετάγεται μεγάλο πάνω από τα δόντια και σβήνει όσο ξανανοίγει
    if (p < SPELL_CHOMP * 0.45) {
      c.save();
      c.globalAlpha = Math.min(1, 2.2 * (1 - p / (SPELL_CHOMP * 0.45)));
      fitText(c, 'ΧΑΜ!', w / 2, h / 2 + 2, h * 0.24 * (1 + 0.25 * Math.max(0, 1 - p / 120)), w * 0.85, YELLOW, 900);
      c.restore();
    }
  } else {
    // ρέψιμο και πίσω στο κανονικό: το σκοτάδι φεύγει, το τερατάκι ξεφουσκώνει πηγαίνοντας στη θέση του
    const q = ease((u - DARK) / (SPELL_FIN - DARK));
    c.fillStyle = '#2e1065';
    c.globalAlpha = shade;
    c.fillRect(0, 0, w, h);
    c.globalAlpha = 1;
    const r = R * 0.35 + (to.r - R * 0.35) * q, x = w / 2 + (to.x - w / 2) * q, y = h * 0.5 + (to.y - h * 0.5) * q;
    monster(c, x, y, r, q < 0.4 ? 0.7 : 0.1);
    fitText(c, 'Μπουρπ!', x + r * 1.2, y - r * 1.1, Math.max(h * 0.05, r * 0.5) * (1 - q * 0.5), w * 0.5, YELLOW, 900);
  }
  c.restore();
}
/** Το τερατάκι που τρώει τα λάθη, με κέντρο το (x, y): `open` από 0 (κλειστό στόμα) έως 1 (ορθάνοιχτο). */
function monster(c: C, x: number, y: number, r: number, open: number): void {
  c.save();
  c.lineJoin = 'round';
  c.lineWidth = Math.max(1.5, r * 0.08);
  c.strokeStyle = '#581c87';
  c.fillStyle = PURPLE;
  // κέρατα και πόδια πίσω από το σώμα
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(x + s * r * 0.3, y - r * 0.8);
    c.lineTo(x + s * r * 0.62, y - r * 1.35);
    c.lineTo(x + s * r * 0.72, y - r * 0.6);
    c.closePath();
    c.fill();
    c.stroke();
    c.beginPath();
    c.ellipse(x + s * r * 0.42, y + r * 0.95, r * 0.26, r * 0.16, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
  c.beginPath();
  c.ellipse(x, y, r, r * 0.96, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // μάτια
  for (const s of [-1, 1]) {
    c.beginPath();
    c.arc(x + s * r * 0.36, y - r * 0.32, r * 0.25, 0, Math.PI * 2);
    c.fillStyle = '#ffffff';
    c.fill();
    c.beginPath();
    c.arc(x + s * r * 0.36, y - r * 0.24, r * 0.11, 0, Math.PI * 2);
    c.fillStyle = '#1e293b';
    c.fill();
  }
  // στόμα με δόντια
  const mh = r * (0.1 + 0.42 * open), my = y + r * 0.38;
  c.beginPath();
  c.ellipse(x, my, r * 0.58, mh, 0, 0, Math.PI * 2);
  c.fillStyle = '#3b0764';
  c.fill();
  c.fillStyle = '#ffffff';
  for (const s of [-1, 0, 1]) {
    const tx = x + s * r * 0.26, ty = my - mh * 0.86;
    c.beginPath();
    c.moveTo(tx - r * 0.1, ty);
    c.lineTo(tx + r * 0.1, ty);
    c.lineTo(tx, ty + Math.min(r * 0.22, mh * 0.9));
    c.closePath();
    c.fill();
  }
  c.restore();
}

// ---------- κρεμάλα ----------
const ABC = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ';
const HANG_MAX = 6;
/** Λέξεις για την τυχαία επιλογή: γνωστές σε παιδιά Δημοτικού, χωρίς παγίδες στην ορθογραφία του τονισμού. */
const HANG_WORDS = [
  'ΣΧΟΛΕΙΟ', 'ΔΑΣΚΑΛΑ', 'ΜΟΛΥΒΙ', 'ΤΕΤΡΑΔΙΟ', 'ΒΙΒΛΙΟ', 'ΘΡΑΝΙΟ', 'ΠΙΝΑΚΑΣ', 'ΤΣΑΝΤΑ', 'ΓΟΜΟΛΑΣΤΙΧΑ', 'ΔΙΑΛΕΙΜΜΑ',
  'ΠΕΤΑΛΟΥΔΑ', 'ΕΛΕΦΑΝΤΑΣ', 'ΚΑΜΗΛΟΠΑΡΔΑΛΗ', 'ΔΕΛΦΙΝΙ', 'ΧΕΛΩΝΑ', 'ΒΑΤΡΑΧΟΣ', 'ΛΙΟΝΤΑΡΙ', 'ΑΛΕΠΟΥ', 'ΣΚΙΟΥΡΟΣ', 'ΠΑΠΑΓΑΛΟΣ',
  'ΚΑΡΠΟΥΖΙ', 'ΠΟΡΤΟΚΑΛΙ', 'ΦΡΑΟΥΛΑ', 'ΜΠΑΝΑΝΑ', 'ΣΟΚΟΛΑΤΑ', 'ΜΑΚΑΡΟΝΙΑ', 'ΠΑΓΩΤΟ', 'ΝΤΟΜΑΤΑ',
  'ΘΑΛΑΣΣΑ', 'ΟΥΡΑΝΟΣ', 'ΦΕΓΓΑΡΙ', 'ΣΥΝΝΕΦΟ', 'ΒΡΟΧΗ', 'ΑΝΟΙΞΗ', 'ΚΑΛΟΚΑΙΡΙ', 'ΧΕΙΜΩΝΑΣ', 'ΦΘΙΝΟΠΩΡΟ',
  'ΠΟΔΗΛΑΤΟ', 'ΑΕΡΟΠΛΑΝΟ', 'ΚΑΡΑΒΙ', 'ΑΥΤΟΚΙΝΗΤΟ', 'ΠΑΙΧΝΙΔΙ', 'ΟΙΚΟΓΕΝΕΙΑ', 'ΓΙΟΡΤΗ', 'ΜΟΥΣΙΚΗ', 'ΖΩΓΡΑΦΙΑ', 'ΥΠΟΛΟΓΙΣΤΗΣ',
];
/** Κεφαλαία χωρίς τόνους και διαλυτικά: «Σχολείο» → «ΣΧΟΛΕΙΟ». */
export function hangNorm(word: string): string {
  return word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^Α-Ω ]/g, '').trim().slice(0, 16);
}
/** Νέα παρτίδα: όπως παίζεται στην τάξη, το πρώτο και το τελευταίο γράμμα φαίνονται από την αρχή (όπου κι αν ξαναβγαίνουν). */
export function hangStart(word: string): number[] {
  const w = hangNorm(word);
  const letters = w.replace(/ /g, '');
  if (letters.length < 2) return [0];
  let mask = 0;
  for (const ch of [letters[0], letters[letters.length - 1]]) mask |= 1 << ABC.indexOf(ch);
  return [mask, ...[...w].map((ch) => ch.charCodeAt(0))];
}
/** Πού βρίσκεται η παρτίδα: η λέξη, τα λάθη ως τώρα, αν βρέθηκε ή χάθηκε. */
export function hangState(v: number[]): { word: string; mask: number; wrong: number; won: boolean; lost: boolean } {
  const word = String.fromCharCode(...v.slice(1));
  const mask = v[0] ?? 0;
  let wrong = 0;
  for (let i = 0; i < ABC.length; i++) if (mask & (1 << i) && !word.includes(ABC[i])) wrong++;
  const won = word.length > 0 && [...word].every((ch) => ch === ' ' || mask & (1 << ABC.indexOf(ch)));
  return { word, mask, wrong, won, lost: wrong >= HANG_MAX };
}
/** Διάταξη: αριστερά η κρεμάλα, δεξιά η λέξη, τα γράμματα και τα δύο κουμπιά. */
function hangGeom(w: number, h: number): { kx: number; ky: number; kw: number; kh: number; by: number; bh: number; bx: [number, number]; bw: number } {
  const kx = w * 0.36, kw = (w * 0.62) / 8, ky = h * 0.4, kh = h * 0.13;
  return { kx, ky, kw, kh, by: h * 0.84, bh: h * 0.12, bx: [w * 0.37, w * 0.68], bw: w * 0.29 };
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

// ---------- χτίσιμο με κυβάκια ----------
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

// ---------- εικόνες για μέτρημα και προβλήματα ----------
// Οι βασικές είναι σχεδιασμένες με γραμμές και γεμίσματα, ώστε να μένουν καθαρές σε όποιο μέγεθος· οι υπόλοιπες είναι emoji.

const OUT = '#334155';
type Draw = (c: C, w: number, h: number) => void;
/** Γεμίζει και περιγράφει το τρέχον σχήμα. */
function paintShape(c: C, fill: string, lw: number): void {
  c.fillStyle = fill;
  c.fill();
  c.lineWidth = lw;
  c.strokeStyle = OUT;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.stroke();
}
const disc = (c: C, x: number, y: number, r: number, fill: string, lw: number): void => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); paintShape(c, fill, lw); };
const box = (c: C, x: number, y: number, w: number, h: number, fill: string, lw: number, r = 0): void => { if (r) rrect(c, x, y, w, h, r); else { c.beginPath(); c.rect(x, y, w, h); } paintShape(c, fill, lw); };
const poly = (c: C, pts: number[][], fill: string, lw: number): void => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); paintShape(c, fill, lw); };

const house: Draw = (c, w, h) => {
  const lw = Math.max(2, w * 0.018);
  box(c, w * 0.66, h * 0.1, w * 0.11, h * 0.26, '#b45309', lw);
  box(c, w * 0.14, h * 0.46, w * 0.72, h * 0.5, '#fde68a', lw);
  poly(c, [[w * 0.04, h * 0.48], [w * 0.5, h * 0.06], [w * 0.96, h * 0.48]], '#ef4444', lw);
  box(c, w * 0.42, h * 0.64, w * 0.17, h * 0.32, '#92400e', lw, w * 0.015);
  disc(c, w * 0.55, h * 0.81, w * 0.012, YELLOW, lw * 0.5);
  for (const x of [0.2, 0.66]) {
    box(c, w * x, h * 0.58, w * 0.15, h * 0.16, '#bae6fd', lw);
    c.beginPath();
    c.moveTo(w * (x + 0.075), h * 0.58); c.lineTo(w * (x + 0.075), h * 0.74);
    c.moveTo(w * x, h * 0.66); c.lineTo(w * (x + 0.15), h * 0.66);
    c.stroke();
  }
};
const tree: Draw = (c, w, h) => {
  const lw = Math.max(2, w * 0.022);
  box(c, w * 0.42, h * 0.56, w * 0.16, h * 0.4, '#92400e', lw, w * 0.03);
  for (const [x, y, r] of [[0.3, 0.42, 0.24], [0.7, 0.42, 0.24], [0.5, 0.26, 0.28], [0.5, 0.46, 0.22]]) disc(c, w * x, h * y, w * r, '#22c55e', lw);
  // το φύλλωμα σαν ενιαία μάζα: σκεπάζουμε τα εσωτερικά περιγράμματα
  for (const [x, y, r] of [[0.3, 0.42, 0.2], [0.7, 0.42, 0.2], [0.5, 0.27, 0.24], [0.5, 0.45, 0.2]]) { c.beginPath(); c.arc(w * x, h * y, w * r, 0, Math.PI * 2); c.fillStyle = '#22c55e'; c.fill(); }
  for (const [x, y] of [[0.36, 0.3], [0.62, 0.38], [0.48, 0.5]]) disc(c, w * x, h * y, w * 0.035, '#ef4444', lw * 0.5);
};
const pine: Draw = (c, w, h) => {
  const lw = Math.max(2, w * 0.022);
  box(c, w * 0.43, h * 0.78, w * 0.14, h * 0.18, '#92400e', lw);
  for (const [top, bot, half] of [[0.42, 0.82, 0.44], [0.22, 0.6, 0.36], [0.04, 0.38, 0.27]]) poly(c, [[w * 0.5, h * top], [w * (0.5 + half), h * bot], [w * (0.5 - half), h * bot]], '#15803d', lw);
};
const bush: Draw = (c, w, h) => {
  const lw = Math.max(2, w * 0.02);
  for (const [x, y, r] of [[0.24, 0.62, 0.22], [0.76, 0.62, 0.22], [0.5, 0.46, 0.28]]) disc(c, w * x, h * y, w * r, '#16a34a', lw);
  for (const [x, y, r] of [[0.24, 0.62, 0.19], [0.76, 0.62, 0.19], [0.5, 0.48, 0.25], [0.5, 0.7, 0.2]]) { c.beginPath(); c.arc(w * x, h * y, w * r, 0, Math.PI * 2); c.fillStyle = '#16a34a'; c.fill(); }
  for (const [x, y] of [[0.3, 0.52], [0.52, 0.36], [0.7, 0.58], [0.46, 0.66]]) disc(c, w * x, h * y, w * 0.03, '#f472b6', lw * 0.5);
};
/** Παιδί ολόσωμο: `girl` για φόρεμα και κοτσίδες, αλλιώς μπλούζα και παντελόνι. */
const child = (girl: boolean): Draw => (c, w, h) => {
  const lw = Math.max(2, w * 0.03), skin = '#f2c29b', hair = girl ? '#7c2d12' : '#5b3a1e';
  const cx = w / 2;
  // πόδια και παπούτσια
  for (const dx of [-0.11, 0.11]) {
    box(c, cx + w * dx - w * 0.06, h * 0.68, w * 0.12, h * 0.24, girl ? skin : '#1e3a8a', lw, w * 0.03);
    box(c, cx + w * dx - w * 0.09, h * 0.9, w * 0.18, h * 0.06, '#475569', lw, w * 0.03);
  }
  // χέρια
  for (const d of [-1, 1]) {
    c.beginPath();
    c.moveTo(cx + d * w * 0.2, h * 0.42);
    c.lineTo(cx + d * w * 0.4, h * 0.6);
    c.lineWidth = w * 0.1;
    c.lineCap = 'round';
    c.strokeStyle = OUT;
    c.stroke();
    c.lineWidth = w * 0.1 - lw * 1.6;
    c.strokeStyle = skin;
    c.stroke();
  }
  // κορμός
  if (girl) poly(c, [[cx - w * 0.17, h * 0.38], [cx + w * 0.17, h * 0.38], [cx + w * 0.3, h * 0.72], [cx - w * 0.3, h * 0.72]], '#ec4899', lw);
  else box(c, cx - w * 0.21, h * 0.38, w * 0.42, h * 0.33, '#3b82f6', lw, w * 0.06);
  // κεφάλι και μαλλιά
  if (girl) for (const d of [-1, 1]) disc(c, cx + d * w * 0.3, h * 0.24, w * 0.09, hair, lw);
  disc(c, cx, h * 0.21, w * 0.24, skin, lw);
  c.beginPath();
  c.arc(cx, h * 0.19, w * 0.245, Math.PI * 1.02, Math.PI * 1.98);
  c.quadraticCurveTo(cx, h * 0.1, cx - w * 0.245, h * 0.19);
  c.closePath();
  paintShape(c, hair, lw);
  c.fillStyle = OUT;
  for (const d of [-1, 1]) { c.beginPath(); c.arc(cx + d * w * 0.09, h * 0.22, w * 0.025, 0, Math.PI * 2); c.fill(); }
  c.beginPath();
  c.arc(cx, h * 0.24, w * 0.1, Math.PI * 0.2, Math.PI * 0.8);
  c.lineWidth = lw * 0.8;
  c.stroke();
};
const apple: Draw = (c, w, h) => {
  const lw = Math.max(2, w * 0.025);
  c.beginPath();
  c.moveTo(w * 0.5, h * 0.3);
  c.bezierCurveTo(w * 0.2, h * 0.1, w * 0.02, h * 0.42, w * 0.14, h * 0.7);
  c.bezierCurveTo(w * 0.24, h * 0.98, w * 0.42, h * 0.96, w * 0.5, h * 0.9);
  c.bezierCurveTo(w * 0.58, h * 0.96, w * 0.76, h * 0.98, w * 0.86, h * 0.7);
  c.bezierCurveTo(w * 0.98, h * 0.42, w * 0.8, h * 0.1, w * 0.5, h * 0.3);
  c.closePath();
  paintShape(c, '#ef4444', lw);
  c.beginPath();
  c.moveTo(w * 0.5, h * 0.3);
  c.quadraticCurveTo(w * 0.5, h * 0.14, w * 0.56, h * 0.08);
  c.lineWidth = lw * 1.4;
  c.stroke();
  c.beginPath();
  c.moveTo(w * 0.55, h * 0.18);
  c.quadraticCurveTo(w * 0.72, h * 0.02, w * 0.84, h * 0.14);
  c.quadraticCurveTo(w * 0.7, h * 0.26, w * 0.55, h * 0.18);
  paintShape(c, '#22c55e', lw);
};
const flower: Draw = (c, w, h) => {
  const lw = Math.max(2, w * 0.025);
  c.beginPath();
  c.moveTo(w * 0.5, h * 0.5);
  c.lineTo(w * 0.5, h * 0.96);
  c.lineWidth = lw * 2.2;
  c.strokeStyle = '#16a34a';
  c.lineCap = 'round';
  c.stroke();
  c.beginPath();
  c.moveTo(w * 0.5, h * 0.8);
  c.quadraticCurveTo(w * 0.78, h * 0.62, w * 0.86, h * 0.76);
  c.quadraticCurveTo(w * 0.7, h * 0.9, w * 0.5, h * 0.8);
  paintShape(c, '#22c55e', lw);
  for (let i = 0; i < 6; i++) disc(c, w * 0.5 + w * 0.2 * Math.cos((i * Math.PI) / 3), h * 0.32 + w * 0.2 * Math.sin((i * Math.PI) / 3), w * 0.14, '#f472b6', lw);
  disc(c, w * 0.5, h * 0.32, w * 0.13, YELLOW, lw);
};
const sun: Draw = (c, w, h) => {
  const lw = Math.max(2, w * 0.03);
  c.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    c.moveTo(w / 2 + w * 0.34 * Math.cos(a), h / 2 + w * 0.34 * Math.sin(a));
    c.lineTo(w / 2 + w * 0.47 * Math.cos(a), h / 2 + w * 0.47 * Math.sin(a));
  }
  c.lineWidth = lw * 1.8;
  c.lineCap = 'round';
  c.strokeStyle = '#f59e0b';
  c.stroke();
  disc(c, w / 2, h / 2, w * 0.27, YELLOW, lw);
};
const cloud: Draw = (c, w, h) => {
  const lw = Math.max(2, w * 0.022);
  const parts = [[0.28, 0.6, 0.2], [0.72, 0.6, 0.2], [0.42, 0.42, 0.22], [0.62, 0.46, 0.2], [0.5, 0.64, 0.2]];
  for (const [x, y, r] of parts) disc(c, w * x, h * y, w * r, '#f1f5f9', lw);
  for (const [x, y, r] of parts) { c.beginPath(); c.arc(w * x, h * y, w * r - lw * 0.6, 0, Math.PI * 2); c.fillStyle = '#f1f5f9'; c.fill(); }
};
const heart: Draw = (c, w, h) => {
  c.beginPath();
  c.moveTo(w * 0.5, h * 0.9);
  c.bezierCurveTo(w * 0.02, h * 0.56, w * 0.06, h * 0.12, w * 0.3, h * 0.14);
  c.bezierCurveTo(w * 0.42, h * 0.15, w * 0.5, h * 0.26, w * 0.5, h * 0.3);
  c.bezierCurveTo(w * 0.5, h * 0.26, w * 0.58, h * 0.15, w * 0.7, h * 0.14);
  c.bezierCurveTo(w * 0.94, h * 0.12, w * 0.98, h * 0.56, w * 0.5, h * 0.9);
  c.closePath();
  paintShape(c, '#ef4444', Math.max(2, w * 0.025));
};
const ball: Draw = (c, w, h) => {
  const lw = Math.max(2, w * 0.025), r = w * 0.44;
  const cols = [RED, YELLOW, BLUE, GREEN, ORANGE, PURPLE];
  cols.forEach((col, i) => {
    c.beginPath();
    c.moveTo(w / 2, h / 2);
    c.arc(w / 2, h / 2, r, (i * Math.PI) / 3, ((i + 1) * Math.PI) / 3);
    c.closePath();
    c.fillStyle = col;
    c.fill();
  });
  c.beginPath();
  c.arc(w / 2, h / 2, r, 0, Math.PI * 2);
  c.lineWidth = lw;
  c.strokeStyle = OUT;
  c.stroke();
  disc(c, w / 2, h / 2, r * 0.16, '#ffffff', lw * 0.7);
};
const balloon: Draw = (c, w, h) => {
  const lw = Math.max(2, w * 0.03);
  c.beginPath();
  c.moveTo(w * 0.5, h * 0.62);
  c.bezierCurveTo(w * 0.4, h * 0.74, w * 0.62, h * 0.84, w * 0.5, h * 0.97);
  c.lineWidth = lw * 0.8;
  c.strokeStyle = OUT;
  c.stroke();
  c.beginPath();
  c.ellipse(w * 0.5, h * 0.33, w * 0.3, h * 0.28, 0, 0, Math.PI * 2);
  paintShape(c, '#ef4444', lw);
  poly(c, [[w * 0.5, h * 0.6], [w * 0.44, h * 0.66], [w * 0.56, h * 0.66]], '#ef4444', lw);
  c.beginPath();
  c.ellipse(w * 0.4, h * 0.22, w * 0.06, h * 0.08, -0.5, 0, Math.PI * 2);
  c.fillStyle = 'rgba(255,255,255,0.55)';
  c.fill();
};

/** `draw`: σχεδιασμένη εικόνα με το δικό της αρχικό μέγεθος· χωρίς αυτό, ζωγραφίζεται το emoji. */
export const PICS: [key: string, emoji: string, label: string, draw?: Draw, w?: number, h?: number][] = [
  ['house', '🏠', 'Σπίτι', house, 200, 180], ['tree', '🌳', 'Δέντρο', tree, 150, 190], ['pine', '🌲', 'Έλατο', pine, 140, 190], ['bush', '🌿', 'Θάμνος', bush, 170, 120],
  ['boy', '👦', 'Αγόρι', child(false), 110, 190], ['girl', '👧', 'Κορίτσι', child(true), 110, 190],
  ['apple', '🍎', 'Μήλο', apple], ['flower', '🌸', 'Λουλούδι', flower, 110, 160], ['sun', '☀️', 'Ήλιος', sun, 150, 150], ['cloud', '☁️', 'Σύννεφο', cloud, 200, 140],
  ['heart', '❤️', 'Καρδιά', heart], ['ball', '⚽', 'Μπάλα', ball], ['balloon', '🎈', 'Μπαλόνι', balloon, 100, 170],
  ['dog', '🐶', 'Σκύλος'], ['cat', '🐱', 'Γάτα'], ['fish', '🐟', 'Ψάρι'], ['bird', '🐦', 'Πουλί'],
  ['car', '🚗', 'Αυτοκίνητο'], ['candy', '🍬', 'Καραμέλα'], ['book', '📕', 'Βιβλίο'], ['pencil', '✏️', 'Μολύβι'], ['cookie', '🍪', 'Μπισκότο'],
];
const EMOJI_FONT = '"Segoe UI Emoji", "Noto Color Emoji", "Apple Color Emoji", sans-serif';

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
        else if (env.full) {
          // πόρτα επιστροφής: μπλε κουμπί, για να ξεχωρίζει από τα υλικά
          rrect(c, x - g.ps * 0.14, y - g.ps * 0.14, g.ps * 1.28, g.ps * 1.28, g.ps * 0.22);
          c.save();
          c.fillStyle = BLUE;
          c.fill();
          c.restore();
          text(c, '🚪', cx, g.py + 1, g.ps * 0.8);
        }
        else {
          // «όλη η οθόνη»: τέσσερις γωνίες που ανοίγουν
          const r = g.ps * 0.38, q = g.ps * 0.2;
          c.save();
          c.strokeStyle = env.ink;
          c.lineWidth = Math.max(2.5, g.ps * 0.09);
          c.lineCap = 'round';
          c.lineJoin = 'round';
          c.beginPath();
          for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            c.moveTo(cx + sx * r, g.py + sy * (r - q));
            c.lineTo(cx + sx * r, g.py + sy * r);
            c.lineTo(cx + sx * (r - q), g.py + sy * r);
          }
          c.stroke();
          c.restore();
        }
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

  spell: kid({
    label: 'Ορθογραφία', w: 900, h: 660, init: [0, 0], animMs: 16000, big: true,
    drawKid(c, w, h, v, env) {
      // μετά τη σκηνή του δέκατου λάθους φαίνεται η λίστα από την αρχή (όσο παίζει η σκηνή, ό,τι έγινε στον έλεγχο)
      const raw = spellState(v), before = env.anim ? spellState(env.anim.prev) : null;
      const restarted = spellFed(raw) && !(before && !spellFed(before) && spellFin(raw, before, env.anim!.t) < SPELL_FIN);
      const s = restarted ? spellLive(v) : raw, g = spellGeom(w, h), eaten = spellEaten(s.res);
      const prev = restarted ? null : before, at = restarted ? Infinity : env.anim?.t ?? Infinity;
      const lathi = (k: number): string => (k === 1 ? '1 λάθος' : `${k} λάθη`);
      c.lineCap = 'round';
      const btn = (x: number, y: number, bw: number, bh: number, label: string, color: string, on = true): void => {
        rrect(c, x, y, bw, bh, bh * 0.3);
        c.save();
        c.fillStyle = color;
        c.globalAlpha = on ? 0.92 : 0.3;
        c.fill();
        c.restore();
        fitText(c, label, x + bw / 2, y + bh / 2 + 1, bh * 0.42, bw * 0.88, '#ffffff', 700);
      };
      // πριν από το παιχνίδι: ποιες λέξεις;
      if (!s.words.length) {
        monster(c, w / 2, h * 0.15, spellR(w, 0) * 1.5, 0.3);
        fitText(c, 'Ορθογραφία με το τερατάκι', w / 2, h * 0.315, h * 0.062, w * 0.9, env.ink, 800);
        btn(w * 0.3, h * 0.385, w * 0.195, h * 0.085, 'Ελληνικά', BLUE, !s.en);
        btn(w * 0.505, h * 0.385, w * 0.195, h * 0.085, 'English', BLUE, s.en);
        // έτοιμες λέξεις ανά τάξη
        SPELL_GRADES.forEach((name, i) => btn(w * (0.06 + 0.15 * i), h * 0.5, w * 0.13, h * 0.14, name, [GREEN, GOOD, '#0d9488', BLUE, '#6366f1', PURPLE][i]));
        btn(w * 0.2, h * 0.72, w * 0.6, h * 0.14, s.en ? '✏️ 🎤 My own words' : '✏️ 🎤 Δικές μου λέξεις', ORANGE);
        return;
      }
      const n = s.words.length;
      // μετά την τελευταία λέξη: τα αποτελέσματα
      if (s.idx >= n) {
        const ok = s.res.filter((r) => r === 1 || spellFixed(r)).length, r = spellR(w, eaten % SPELL_FEAST), ate = Math.floor(eaten / SPELL_FEAST);
        monster(c, w * 0.14, h * 0.5, r, eaten ? 0.25 : 0);
        fitText(c, `Τέλος! ${ok} από ${n} σωστές`, w * 0.6, h * 0.09, h * 0.068, w * 0.7, env.ink, 800);
        fitText(c, ate ? `Το τερατάκι έφαγε ${lathi(eaten)} και ${ate === 1 ? 'μια φορά' : `${ate} φορές`} κι εσένα!` : eaten ? `Το τερατάκι έφαγε ${lathi(eaten)} και μεγάλωσε!` : 'Το τερατάκι έμεινε νηστικό!', w * 0.6, h * 0.175, h * 0.042, w * 0.7, eaten ? ORANGE : GOOD, 700);
        const cols = n > 10 ? 2 : 1, rows = Math.ceil(n / cols), rh = Math.min(h * 0.085, (h * 0.6) / rows);
        s.words.forEach((word, i) => {
          const res = s.res[i], fixed = spellFixed(res), icon = res === 1 ? '⭐' : fixed ? '✅' : res >= 10 ? '👾' : '➖';
          const x = cols === 1 ? w * 0.6 : w * (0.45 + 0.34 * Math.floor(i / rows));
          fitText(c, `${icon} ${word}`, x, h * 0.25 + rh * ((i % rows) + 0.5), rh * 0.7, cols === 1 ? w * 0.66 : w * 0.32, res >= 10 && !fixed ? PURPLE : env.ink, 700);
        });
        btn(w * 0.02, g.by, w * 0.47, g.bh, '↺ Ξανά οι ίδιες λέξεις', PURPLE);
        btn(w * 0.51, g.by, w * 0.47, g.bh, '✏️ Νέες λέξεις', BLUE);
        return;
      }
      const target = s.words[s.idx], res = s.res[s.idx] ?? 0, hint = s.hints[s.idx];
      // τι φαίνεται στη γραμμή: η σωστή λέξη (👁, ή γραφή με το χέρι χωρίς ανάγνωση), το αποτέλεσμα του ελέγχου, ή ό,τι γράφει ο μαθητής
      const whole = s.peek || s.phase === 3 || (s.phase === 2 && !s.typed);
      // πρώτος έλεγχος που μόλις έγινε: φαίνεται ακόμη ό,τι είχε γραφτεί, και το τερατάκι τρώει τα λάθη του ένα ένα
      const first = s.phase === 1 && prev?.phase === 0
        ? (prev.typed ? spellDiff(spellNorm(prev.typed, SPELL_MAX), target) : [...s.typed].map((ch, i) => ({ a: ch === '_' ? null : ch, b: s.marks[i] ? '' : ch })))
        : [];
      const eat1 = at < SPELL_SNIFF + SPELL_T0 + first.filter((cell) => cell.a !== cell.b).length * SPELL_STEP + 400 && first.length > 0;
      const diff = eat1 ? first : s.phase === 2 && s.typed ? spellDiff(s.typed, target) : [];
      const bad = diff.map((cell, i) => (cell.a === cell.b ? -1 : i)).filter((i) => i >= 0);
      const count = whole ? target.length : s.phase === 2 || eat1 ? diff.length : s.typed.length, m = Math.max(count, 1);
      const { cw, x0 } = spellLay(w, count, eaten), ry = g.base - cw * 0.62;
      const cx = (i: number): number => x0 + (i + 0.5) * cw;
      // πριν γραφτεί οτιδήποτε, στη γραμμή φαίνεται μεγάλη η σημασία της λέξης: το τερατάκι στέκεται δίπλα της
      const big = !whole && s.phase === 0 && !s.typed && !!hint;
      c.save();
      c.font = `800 ${w * 0.075}px ${FONT}`;
      const half = big ? Math.min(c.measureText(hint).width, w * 0.62) / 2 + cw * 0.15 : 0;
      c.restore();
      // ο έλεγχος μόλις έγινε: το τερατάκι περνά από τα λάθη ένα ένα (στον πρώτο, αφού τα μυρίσει)· αλλιώς φαίνεται κατευθείαν το αποτέλεσμα
      const t = eat1 ? at - SPELL_SNIFF : s.phase === 2 && prev && prev.phase !== 2 ? at : Infinity;
      // κενή θέση: εδώ θα γραφτεί το σωστό γράμμα
      const slot = (i: number): void => {
        c.save();
        c.strokeStyle = RED;
        c.lineWidth = 2.5;
        c.setLineDash([cw * 0.1, cw * 0.1]);
        rrect(c, cx(i) - cw * 0.34, ry - cw * 0.46, cw * 0.68, cw * 0.92, cw * 0.1);
        c.stroke();
        c.restore();
      };
      const end = SPELL_T0 + bad.length * SPELL_STEP;
      // πρόοδος: μία κουκκίδα ανά λέξη
      const pr = Math.min(h * 0.024, (w * 0.6) / n / 2.6);
      s.words.forEach((_, i) => {
        c.save();
        c.beginPath();
        c.arc(w / 2 + (i - (n - 1) / 2) * pr * 2.6, g.top, pr, 0, Math.PI * 2);
        if (s.res[i] && (i !== s.idx || (s.phase === 2 && t >= end))) {
          c.fillStyle = s.res[i] === 1 ? YELLOW : spellFixed(s.res[i]) ? GOOD : PURPLE;
          c.fill();
        } else {
          c.globalAlpha = i === s.idx ? 1 : 0.3;
          c.lineWidth = i === s.idx ? 3.5 : 2;
          c.stroke();
        }
        c.restore();
      });
      c.save();
      c.globalAlpha = 0.6;
      text(c, `Λέξη ${s.idx + 1} από ${n}`, w / 2, g.top + pr + h * 0.03, h * 0.03, env.ink, 600);
      // η γραμμή όπου γράφεται η λέξη
      c.globalAlpha = 0.3;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(Math.min(x0, w * 0.2), g.base);
      c.lineTo(Math.max(x0 + m * cw, w * 0.8), g.base);
      c.stroke();
      c.restore();
      if (whole) {
        [...target].forEach((ch, i) => text(c, ch, cx(i), ry, cw * 0.95, s.peek ? BLUE : GOOD, 800));
      } else if (s.phase === 2 || eat1) {
        diff.forEach((cell, i) => {
          const k = bad.indexOf(i);
          if (k < 0) {
            text(c, cell.a!, cx(i), ry, cw * 0.95, env.ink, 700);
            return;
          }
          const eatenAt = SPELL_T0 + k * SPELL_STEP + 450;
          if (t < eatenAt) {
            // το λάθος γράμμα μικραίνει καθώς το δαγκώνει
            if (cell.a) text(c, cell.a, cx(i), ry, cw * 0.95 * Math.max(0.05, Math.min(1, (eatenAt - t) / 150)), RED, 700);
            else if (eat1) slot(i);
            return;
          }
          if (eat1) {
            // πρώτος έλεγχος: μένει κενή θέση, το σωστό δεν φαίνεται· γράμμα που περίσσευε απλώς χάνεται
            if (cell.b !== null) slot(i);
            return;
          }
          // στη θέση του το σωστό, πράσινο· από κάτω μένει σβησμένο αυτό που είχε γραφτεί
          if (cell.b) text(c, cell.b, cx(i), ry, cw * 0.95 * Math.min(1, 0.4 + (t - eatenAt) / 200), GOOD, 800);
          if (cell.a) {
            const ss = cw * 0.5, sy = g.base + ss * 0.62;
            text(c, cell.a, cx(i), sy, ss, RED, 700);
            c.save();
            c.strokeStyle = RED;
            c.lineWidth = Math.max(2, ss * 0.1);
            c.beginPath();
            c.moveTo(cx(i) - ss * 0.42, sy + ss * 0.32);
            c.lineTo(cx(i) + ss * 0.42, sy - ss * 0.32);
            c.stroke();
            c.restore();
          }
        });
      } else {
        [...s.typed].forEach((ch, i) => {
          if (s.sel === i + 1) {
            // το γράμμα που έχει πιαστεί: το επόμενο πλήκτρο το αλλάζει
            rrect(c, cx(i) - cw * 0.46, ry - cw * 0.62, cw * 0.92, cw * 1.2, cw * 0.14);
            c.save();
            c.fillStyle = BLUE;
            c.strokeStyle = BLUE;
            c.globalAlpha = 0.18;
            c.fill();
            c.globalAlpha = 1;
            c.lineWidth = 2.5;
            c.stroke();
            c.restore();
          }
          // κενή θέση: το λάθος το έφαγε το τερατάκι (ή έλειπε γράμμα)
          if (ch === '_') slot(i);
          else text(c, ch, cx(i), ry, cw * 0.95, env.ink, 700);
        });
        // πριν γραφτεί οτιδήποτε, η σημασία της λέξης φαίνεται μεγάλη πάνω στη γραμμή
        if (big) {
          c.save();
          c.globalAlpha = 0.75;
          fitText(c, hint, w / 2, ry, w * 0.075, w * 0.62, BLUE, 800);
          c.restore();
        } else if (s.phase === 0 && !s.hand && !s.sel && s.typed.length < SPELL_MAX) {
          c.save();
          c.globalAlpha = 0.5;
          c.lineWidth = 3;
          const px = s.typed ? x0 + m * cw + cw * 0.12 : w / 2;
          c.beginPath();
          c.moveTo(px, ry - cw * 0.45);
          c.lineTo(px, ry + cw * 0.45);
          c.stroke();
          c.restore();
        }
      }
      // το τερατάκι στέκεται στη γραμμή, αριστερά της λέξης· στον έλεγχο πηδά σε κάθε λάθος, το τρώει, το μασάει και μεγαλώνει· στον τελικό έλεγχο κάθεται μετά δεξιά
      const done = bad.filter((_, k) => t >= SPELL_T0 + k * SPELL_STEP + 450).length;
      const since = t - (SPELL_T0 + (done - 1) * SPELL_STEP + 450);
      // δέκατο λάθος σε αυτόν τον έλεγχο: μόλις φάει τα γράμματα, τρώει κι εσένα (fin: ms από την αρχή της σκηνής)
      const pe = prev ? spellEaten(prev.res) : eaten, cur = eaten - (res >= 10 && s.typed ? bad.length - done : 0);
      // η σκηνή αρχίζει όταν τελειώσει το φάγωμα των γραμμάτων (όπως και ο ήχος της, βλ. fx.ts): μετά το μύρισμα, ένα δάγκωμα για καθένα, και η επιστροφή
      const feast = !!prev && at < Infinity && Math.floor(eaten / SPELL_FEAST) > Math.floor(pe / SPELL_FEAST);
      const fin = feast ? spellFin(s, prev, at) : -1;
      const grown = feast && fin < SPELL_FIN ? Math.min(cur - Math.floor(pe / SPELL_FEAST) * SPELL_FEAST, SPELL_FEAST) : cur % SPELL_FEAST;
      const r = spellR(w, grown) * (done && since < 300 ? 1 + 0.2 * Math.sin((Math.PI * since) / 300) : 1);
      const home = Math.max(r + 4, (big ? w / 2 - half : x0) - r * 1.15), rest = Math.min(w - r - 4, x0 + m * cw + r * 1.15);
      const ease = (q: number): number => (q <= 0 ? 0 : q >= 1 ? 1 : q * q * (3 - 2 * q));
      let mx = s.phase === 2 ? rest : home, my = g.base - r * 1.1, open = s.phase === 1 ? 0.35 : 0;
      if (t < end + 400 && bad.length) {
        const k = Math.max(0, Math.min(bad.length - 1, Math.floor((t - SPELL_T0) / SPELL_STEP)));
        const ts = SPELL_T0 + k * SPELL_STEP, from = k === 0 ? home : cx(bad[k - 1]), to = cx(bad[k]);
        if (t >= end) {
          mx = to + ((eat1 ? home : rest) - to) * ease((t - end) / 400);
        } else {
          const q = ease((t - ts) / 300);
          mx = from + (to - from) * q;
          my -= Math.sin(q * Math.PI) * r * 0.8;
          const u = t - ts - 450;
          open = u < 0 ? Math.min(1, Math.max(0, (u + 300) / 200)) : 0.4 * Math.abs(Math.sin(u / 45)) * Math.max(0, 1 - u / 350);
          // πριν ξεκινήσει μυρίζει: κουνιέται με το στόμα μισάνοιχτο
          if (eat1 && t < SPELL_T0) {
            mx += Math.sin(at / 45) * r * 0.12;
            open = 0.6;
          }
        }
      } else if (s.phase === 2 && (res < 10 || spellFixed(res)) && at < 1200) {
        // σωστή λέξη: χοροπηδά
        my -= Math.abs(Math.sin(at / 130)) * r * 0.5 * (1 - at / 1200);
      } else if (s.phase < 2 && at < 200) {
        my -= Math.sin((Math.PI * at) / 200) * r * 0.12;
      }
      const feasting = feast && fin >= 0 && fin < SPELL_FIN;
      if (!feasting) monster(c, mx, my, r, open);
      // τι λέει το τερατάκι
      const marked = s.marks.filter(Boolean).length;
      const said = feasting ? ''
        : restarted && s.phase === 0 && !s.typed ? `Πάμε πάλι από την αρχή! ${s.peek ? 'Δες καλά τη λέξη!' : hint ? `Γράψε: ${hint}` : 'Πάτα 🔊 για την πρώτη λέξη.'}`
        : s.peek ? `Δες καλά τη λέξη! ${s.hand ? 'Πάτα το 👁 για να κρυφτεί και γράψε την.' : 'Μόλις πατήσεις γράμμα, κρύβεται.'}`
        : s.phase === 0 && hint ? `${/[a-z]/.test(target) ? 'Γράψε στα αγγλικά' : 'Γράψε'}: ${hint}`
        : s.phase === 0 ? (s.hand ? 'Γράψε με το μολύβι στο πλαίσιο αυτό που ακούς και πάτα «Έλεγχος»' : s.typed ? '' : 'Γράψε με τα γράμματα αυτό που ακούς')
        : eat1 ? (t < SPELL_T0 ? `Χμ… μυρίζω ${lathi(bad.length)}!` : 'Μιαμ…')
        : s.phase === 1 ? `Μιαμ! Έφαγα ${lathi(spellAte(res))}. ${s.hand ? 'Σβήσε, γράψε ξανά τη λέξη σωστά και πάτα «Έλεγχος».' : marked ? 'Γράψε το σωστό γράμμα στα κενά.' : 'Δες τη λέξη και πάτα ξανά «Έλεγχος».'}`
        : s.phase === 3 ? 'Έτσι γράφεται. Την έγραψες σωστά;'
        : t < end ? 'Μιαμ…'
        : res === 1 ? 'Τέλεια, με την πρώτη! Το τερατάκι έμεινε νηστικό.'
        : spellFixed(res) ? 'Μπράβο, το διόρθωσες!'
        : !s.typed ? 'Μιαμ! Δες πώς γράφεται και πάμε παρακάτω.'
        : `Το τερατάκι έφαγε ${lathi(bad.length)} και μεγάλωσε!`;
      if (said) fitText(c, said, w / 2, g.msg, h * 0.04, w * 0.94, s.peek || (s.phase === 0 && hint) ? BLUE : s.phase === 1 || (s.phase === 2 && res >= 10 && !spellFixed(res)) ? ORANGE : s.phase === 2 && t >= end ? GOOD : env.ink, 700);
      const live = s.phase < 2 && !feasting;
      if (s.hand) {
        // πλαίσιο για γραφή με το χέρι: γραμμές τετραδίου
        rrect(c, g.kx + 3, g.ky + 3, g.kw * 10 - 6, g.kh * 4 - 6, g.kh * 0.2);
        c.save();
        c.fillStyle = env.ink;
        c.globalAlpha = 0.05;
        c.fill();
        c.globalAlpha = 0.5;
        c.lineWidth = 1.5;
        c.stroke();
        c.globalAlpha = 0.22;
        c.beginPath();
        for (const q of [0.4, 0.75]) { c.moveTo(g.kx + g.kw * 0.3, g.ky + g.kh * 4 * q); c.lineTo(g.kx + g.kw * 9.7, g.ky + g.kh * 4 * q); }
        c.stroke();
        c.restore();
      }
      // πλήκτρα
      const en = spellIsEn(target);
      for (const k of s.hand ? [] : spellKeyboard(g, en)) {
        // ο τόνος ανάβει όσο περιμένει φωνήεν· το «;» είναι μόνο για τη θέση των γραμμάτων
        const tint = k.key === '⌫' || k.key === '΄', on = k.key === '΄' && s.acc > 0, idle = k.key === ';';
        rrect(c, k.x + 3, k.y + 3, k.w - 6, k.h - 6, g.kh * 0.2);
        c.save();
        c.fillStyle = tint ? ORANGE : env.ink;
        c.globalAlpha = !live || idle ? 0.05 : on ? 0.85 : tint ? 0.3 : 0.14;
        c.fill();
        c.globalAlpha = !live || idle ? 0.35 : 1;
        c.lineWidth = on ? 3 : 1.5;
        c.stroke();
        if (k.key === ' ') fitText(c, en ? 'space' : 'κενό', k.x + k.w / 2, k.y + k.h / 2 + 1, g.kh * 0.4, k.w * 0.8, env.ink, 600);
        else text(c, k.key === '΄' ? SPELL_ACC_KEY[s.acc] : k.key, k.x + k.w / 2, k.y + k.h / 2 + 1 + (k.key === '΄' ? g.kh * 0.12 : 0), g.kh * (k.key === '΄' ? 0.9 : 0.6), on ? '#ffffff' : env.ink, 700);
        c.restore();
      }
      btn(g.bx[0], g.by, g.bw[0], g.bh, '✏️ Λέξεις', BLUE);
      btn(g.bx[1], g.by, g.bw[1], g.bh, '👁', s.peek ? ORANGE : '#64748b', live);
      // το κουμπί δείχνει τον άλλο τρόπο γραφής, αυτόν στον οποίο θα σε πάει
      btn(g.bx[2], g.by, g.bw[2], g.bh, '🔊', '#0d9488');
      btn(g.bx[3], g.by, g.bw[3], g.bh, s.hand ? '⌨️ Πλήκτρα' : '✍️ Με το χέρι', '#64748b', s.phase === 0);
      if (s.phase === 3) {
        btn(g.bx[4], g.by, g.bw[4] * 0.49, g.bh, '✓ Σωστά', GOOD);
        btn(g.bx[4] + g.bw[4] * 0.51, g.by, g.bw[4] * 0.49, g.bh, '✗ Λάθος', RED);
      } else if (s.phase === 2) {
        btn(g.bx[4], g.by, g.bw[4], g.bh, s.idx + 1 < n ? '▶ Επόμενη λέξη' : '🏁 Αποτελέσματα', PURPLE);
      } else {
        btn(g.bx[4], g.by, g.bw[4], g.bh, s.phase === 1 ? '🔍 Έλεγχος ξανά' : '🔍 Έλεγχος', GOOD, s.hand || !!spellNorm(s.typed, SPELL_MAX));
      }
      if (feasting) spellFeast(c, w, h, fin, { x: mx, y: my, r }, { x: mx, y: g.base - spellR(w, eaten % SPELL_FEAST) * 1.1, r: spellR(w, eaten % SPELL_FEAST) });
    },
    ask(v, x, y, w, h) {
      const s = spellLive(v), g = spellGeom(w, h);
      if (!s.words.length) {
        if (x < w * 0.2 || x > w * 0.8 || y < h * 0.72 || y > h * 0.86) return null;
        return {
          title: s.en ? 'Οι λέξεις ή οι προτάσεις (Αγγλικά)' : 'Οι λέξεις ή οι προτάσεις της ορθογραφίας',
          hint: `Χωρισμένες με κόμμα${s.en ? ': apple, school, good morning. Με «=» βάζεις τη σημασία που θα βλέπει ο μαθητής: apple=μήλο' : ', με τους τόνους τους: μήλο, σχολείο, καλή μέρα'}. Έως 20, η καθεμία έως 40 γράμματα. Με το 🎤 τις λες αντί να τις γράψεις: κάθε φορά που μιλάς μπαίνει μία. Φαίνονται ως κουκκίδες, για να μη τις δουν οι μαθητές· το 👁 τις δείχνει.`,
          secret: true, max: 840, voice: s.en ? 'en-GB' : 'el-GR', lists: true,
          apply(typed) {
            const list = spellList(typed);
            return list.words.length ? spellPack(spellStart(s, list.words, false, list.hints)) : null;
          },
        };
      }
      if (!s.hand || s.idx >= s.words.length) return null;
      // με το χέρι: ο «Έλεγχος» διαβάζει ό,τι γράφτηκε στο πλαίσιο· όποιο κουμπί αλλάζει λέξη ή τρόπο γραφής το σβήνει
      const k = spellBtn(g, x, y), area = { x: g.kx, y: g.ky, w: g.kw * 10, h: g.kh * 4 };
      const clear = (next: Spell): KidAsk => ({ title: '', area, mode: 'clear', apply: () => spellPack(next) });
      if (k === 0) return clear({ ...SPELL_EMPTY, hand: true, en: s.en });
      if (k === 3 && s.phase === 0) return clear({ ...s, hand: false });
      if (k === 4 && s.phase === 2) return clear(spellNext(s));
      if (k === 4 && s.phase < 2) {
        return {
          title: '', area, mode: 'read',
          // χωρίς ανάγνωση (δεν υπάρχει κλειδί ή ίντερνετ): φαίνεται η σωστή λέξη και η τάξη τη συγκρίνει με το χειρόγραφο
          apply: (read) => spellPack(spellCheck(s, read) ?? { ...s, phase: 3, peek: false, typed: '', marks: [], sel: 0 }),
        };
      }
      return null;
    },
    tap(v, x, y, w, h) {
      let s = spellLive(v);
      const g = spellGeom(w, h);
      if (!s.words.length) {
        if (y >= h * 0.385 && y <= h * 0.47 && x >= w * 0.3 && x <= w * 0.7) return s.en === x > w * 0.5 ? null : spellPack({ ...s, en: !s.en });
        const k = Math.floor((x / w - 0.06) / 0.15);
        if (y < h * 0.5 || y > h * 0.64 || k < 0 || k > 5 || x > w * (0.06 + 0.15 * k + 0.13)) return null;
        const pool = [...(s.en ? SPELL_READY_EN : SPELL_READY)[k]], picked: string[][] = [];
        while (picked.length < SPELL_PICK && pool.length) picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].split('='));
        return spellPack(spellStart(s, picked.map((e) => e[0]), true, picked.map((e) => e[1] ?? '')));
      }
      if (s.idx >= s.words.length) {
        if (y < g.by || y > g.by + g.bh) return null;
        if (x >= w * 0.02 && x <= w * 0.49) return spellPack(spellStart(s, s.words, s.ready, s.hints));
        return x >= w * 0.51 && x <= w * 0.98 ? spellPack({ ...SPELL_EMPTY, hand: s.hand, en: s.en }) : null;
      }
      const k = spellBtn(g, x, y);
      if (k === 0) return s.hand ? null : spellPack({ ...SPELL_EMPTY, en: s.en });
      if (k === 1) return s.phase < 2 ? spellPack({ ...s, peek: !s.peek }) : null;
      if (k === 2) return spellPack({ ...s, said: !s.said });
      if (k === 3) return s.phase === 0 && !s.hand ? spellPack({ ...s, hand: true, typed: '', marks: [], sel: 0 }) : null;
      if (k === 4) {
        if (s.phase === 3) {
          const right = x < g.bx[4] + g.bw[4] / 2, res = [...s.res], ate = spellAte(res[s.idx] ?? 0);
          res[s.idx] = right ? (ate ? 100 + ate : 1) : 11 + ate;
          return spellPack({ ...s, phase: 2, typed: right ? s.words[s.idx] : '', res });
        }
        // με το χέρι τα υπόλοιπα τα χειρίζεται το ask (διάβασμα και καθάρισμα του πλαισίου)
        if (s.hand) return null;
        if (s.phase === 2) return spellPack(spellNext(s));
        const next = spellCheck(s, s.typed);
        return next && spellPack(next);
      }
      // το πλαίσιο της γραφής με το χέρι δεν είναι κουμπί: εκεί γράφει το μολύβι
      if (s.hand || s.phase > 1) return null;
      const lay = spellLay(w, s.typed.length, spellEaten(s.res));
      if (!s.peek && y >= g.base - lay.cw * 1.25 && y <= g.base + lay.cw * 0.25) {
        // πάτημα σε γράμμα το πιάνει για αλλαγή· δεύτερο πάτημα το αφήνει
        const i = Math.floor((x - lay.x0) / lay.cw);
        return i >= 0 && i < s.typed.length ? spellPack({ ...s, sel: s.sel === i + 1 ? 0 : i + 1 }) : null;
      }
      const hit = spellKeyboard(g, spellIsEn(s.words[s.idx])).find((k) => x >= k.x && x < k.x + k.w && y >= k.y && y < k.y + k.h);
      if (!hit || hit.key === ';') return null;
      // νεκρό πλήκτρο: τόνος → διαλυτικά → και τα δύο → τίποτα· το επόμενο φωνήεν το παίρνει
      if (hit.key === '΄') return spellPack({ ...s, acc: (s.acc + 1) % 4 });
      if (hit.key === '⌫' && s.acc) return spellPack({ ...s, acc: 0 });
      const key = SPELL_ACC[s.acc].get(hit.key) ?? hit.key;
      s = { ...s, acc: 0 };
      const chars = [...s.typed], marks = chars.map((_, j) => !!s.marks[j]), i = s.sel - 1, held = i >= 0 && i < chars.length;
      // μετά την αλλαγή: στη διόρθωση πιάνεται το επόμενο σημαδεμένο γράμμα, αλλιώς η γραφή συνεχίζει στο τέλος
      const after = (from: number): number => (s.phase === 1 ? Math.max(marks.findIndex((on, j) => on && j >= from), marks.indexOf(true)) + 1 : 0);
      if (key === '⌫') {
        if (!chars.length) return null;
        const j = held ? i : chars.length - 1;
        chars.splice(j, 1);
        marks.splice(j, 1);
        return spellPack({ ...s, peek: false, typed: chars.join(''), marks, sel: held ? after(j) : 0 });
      }
      if (held) {
        chars[i] = key;
        marks[i] = false;
        return spellPack({ ...s, peek: false, typed: chars.join(''), marks, sel: after(i + 1) });
      }
      if (chars.length >= SPELL_MAX) return null;
      return spellPack({ ...s, peek: false, typed: s.typed + key, marks, sel: 0 });
    },
    fx(a, b) {
      const p = spellLive(a), n = spellState(b);
      const playing = n.idx < n.words.length;
      // νέα λέξη (ή το 🔊): η εφαρμογή τη λέει δυνατά
      if (playing && (p.words.join() !== n.words.join() || p.idx !== n.idx || p.said !== n.said)) return spellSay(n);
      if (p.words.join() !== n.words.join() || p.hand !== n.hand || p.en !== n.en) return 'new';
      if (!playing) return n.words.length && p.idx < n.idx ? 'win' : 'new';
      // όσα λάθη έφαγε μόλις τώρα: ένα δάγκωμα για το καθένα, συγχρονισμένο με την κίνηση
      const ate = Math.min(spellEaten(n.res) - spellEaten(p.res), 12);
      // δέκατο λάθος: στο τέλος του φαγώματος, τρώει κι εσένα
      const x = Math.floor(spellEaten(n.res) / SPELL_FEAST) > Math.floor(spellEaten(p.res) / SPELL_FEAST) ? 'x' : '';
      if (n.phase === 2 && p.phase !== 2) {
        const res = n.res[n.idx];
        return res === 1 ? 'win' : spellFixed(res) ? 'cheer' : `munch${n.typed ? ate : x ? 0 : 1}${x}`;
      }
      return n.phase === 1 && p.phase === 0 ? `sniff${ate}${x}` : 'click';
    },
  }),

  hangman: kid({
    label: 'Κρεμάλα', w: 800, h: 480, init: [0],
    drawKid(c, w, h, v, env) {
      const st = hangState(v), g = hangGeom(w, h);
      c.lineCap = 'round';
      c.lineJoin = 'round';
      // η κρεμάλα
      c.lineWidth = Math.max(5, w * 0.012);
      c.beginPath();
      c.moveTo(w * 0.03, h * 0.92); c.lineTo(w * 0.27, h * 0.92);
      c.moveTo(w * 0.09, h * 0.92); c.lineTo(w * 0.09, h * 0.08); c.lineTo(w * 0.23, h * 0.08); c.lineTo(w * 0.23, h * 0.18);
      c.moveTo(w * 0.09, h * 0.2); c.lineTo(w * 0.14, h * 0.08);
      c.stroke();
      // ο ανθρωπάκος: ένα κομμάτι για κάθε λάθος (κεφάλι, σώμα, χέρια, πόδια)
      const hx = w * 0.23, r = h * 0.07;
      c.lineWidth = Math.max(4, w * 0.008);
      c.save();
      // μόλις άλλαξε κάτι: λάθος γράμμα κουνάει τον ανθρωπάκο, σωστό «σκάει» στη θέση του
      const an = env.anim, was = an ? hangState(an.prev) : null;
      const fresh = an && was && was.word === st.word ? an : null;
      if (fresh && st.wrong > was!.wrong && fresh.t < 450) c.translate(Math.sin(fresh.t / 28) * w * 0.012 * (1 - fresh.t / 450), 0);
      c.strokeStyle = st.lost ? RED : env.ink;
      c.beginPath();
      if (st.wrong > 0) { c.moveTo(hx + r, h * 0.18 + r); c.arc(hx, h * 0.18 + r, r, 0, Math.PI * 2); }
      if (st.wrong > 1) { c.moveTo(hx, h * 0.18 + r * 2); c.lineTo(hx, h * 0.56); }
      if (st.wrong > 2) { c.moveTo(hx, h * 0.38); c.lineTo(hx - w * 0.05, h * 0.47); }
      if (st.wrong > 3) { c.moveTo(hx, h * 0.38); c.lineTo(hx + w * 0.05, h * 0.47); }
      if (st.wrong > 4) { c.moveTo(hx, h * 0.56); c.lineTo(hx - w * 0.045, h * 0.72); }
      if (st.wrong > 5) { c.moveTo(hx, h * 0.56); c.lineTo(hx + w * 0.045, h * 0.72); }
      c.stroke();
      c.restore();
      if (!st.word) {
        text(c, 'Πάτα 🎲 για μια λέξη', w * 0.67, h * 0.2, h * 0.075, env.ink, 700);
        text(c, 'ή ✏️ για να γράψεις τη δική σου', w * 0.67, h * 0.3, h * 0.05, env.ink, 500);
      } else {
        // η λέξη: γράμμα ή παύλα· όταν χαθεί η παρτίδα φαίνονται κόκκινα όσα δεν βρέθηκαν
        const n = st.word.length, cw = Math.min(w * 0.075, (w * 0.62) / n), x0 = w * 0.67 - (cw * n) / 2, y = h * 0.2;
        [...st.word].forEach((ch, i) => {
          if (ch === ' ') return;
          const cx = x0 + cw * (i + 0.5), open = (st.mask & (1 << ABC.indexOf(ch))) !== 0;
          const bit = 1 << ABC.indexOf(ch);
          const pop = fresh && open && !(was!.mask & bit) && fresh.t < 380 ? 1 + 0.9 * (1 - fresh.t / 380) : 1;
          if (open || st.lost) text(c, ch, cx, y, cw * 0.82 * pop, open ? (pop > 1 ? GREEN : env.ink) : RED, 700);
          c.beginPath();
          c.moveTo(cx - cw * 0.36, y + cw * 0.6);
          c.lineTo(cx + cw * 0.36, y + cw * 0.6);
          c.lineWidth = Math.max(3, cw * 0.07);
          c.stroke();
        });
        if (st.won) text(c, '🎉 Μπράβο!', w * 0.67, h * 0.035, h * 0.06, GREEN, 800);
        else if (st.lost) text(c, 'Τέλος! Η λέξη ήταν:', w * 0.67, h * 0.035, h * 0.05, RED, 700);
        else text(c, `Λάθη: ${st.wrong} από ${HANG_MAX}`, w * 0.67, h * 0.035, h * 0.045, env.ink, 600);
      }
      // τα γράμματα: σωστά πράσινα, λάθος γκρίζα με γραμμή
      for (let i = 0; i < ABC.length; i++) {
        const x = g.kx + (i % 8) * g.kw, y = g.ky + Math.floor(i / 8) * g.kh;
        const used = (st.mask & (1 << i)) !== 0, hit = used && st.word.includes(ABC[i]);
        rrect(c, x + 3, y + 3, g.kw - 6, g.kh - 6, g.kh * 0.2);
        c.save();
        c.fillStyle = hit ? GREEN : env.ink;
        c.globalAlpha = hit ? 0.85 : used ? 0.06 : 0.14;
        c.fill();
        c.restore();
        c.save();
        c.globalAlpha = used && !hit ? 0.3 : 1;
        c.lineWidth = 1.5;
        c.stroke();
        text(c, ABC[i], x + g.kw / 2, y + g.kh / 2 + 1, g.kh * 0.5, hit ? '#ffffff' : env.ink, 700);
        c.restore();
      }
      [['🎲 Νέα λέξη', 0], ['✏️ Δική μου λέξη', 1]].forEach(([label, k]) => {
        const x = g.bx[k as number];
        rrect(c, x, g.by, g.bw, g.bh, g.bh * 0.3);
        c.save();
        c.fillStyle = BLUE;
        c.globalAlpha = 0.9;
        c.fill();
        c.restore();
        text(c, label as string, x + g.bw / 2, g.by + g.bh / 2 + 1, g.bh * 0.42, '#ffffff', 700);
      });
    },
    ask(_v, x, y, w, h) {
      const g = hangGeom(w, h);
      if (y < g.by || y > g.by + g.bh || x < g.bx[1] || x > g.bx[1] + g.bw) return null;
      return {
        title: 'Λέξη για την κρεμάλα',
        hint: 'Από 2 έως 16 γράμματα. Φαίνεται ως κουκκίδες, για να μη τη δουν οι μαθητές.',
        secret: true,
        apply(typed) {
          const next = hangStart(typed);
          return next.length > 1 ? next : null;
        },
      };
    },
    tap(v, x, y, w, h) {
      const st = hangState(v), g = hangGeom(w, h);
      if (y >= g.by && y <= g.by + g.bh) {
        if (x >= g.bx[0] && x <= g.bx[0] + g.bw) {
          let word = HANG_WORDS[Math.floor(Math.random() * HANG_WORDS.length)];
          if (word === st.word) word = HANG_WORDS[(HANG_WORDS.indexOf(word) + 1) % HANG_WORDS.length];
          return hangStart(word);
        }
        return null;
      }
      if (!st.word || st.won || st.lost) return null;
      const col = Math.floor((x - g.kx) / g.kw), row = Math.floor((y - g.ky) / g.kh);
      if (col < 0 || col > 7 || row < 0 || row > 2) return null;
      const i = row * 8 + col;
      if (st.mask & (1 << i)) return null;
      return [st.mask | (1 << i), ...v.slice(1)];
    },
    fx(prev, next) {
      const p = hangState(prev), n = hangState(next);
      if (p.word !== n.word) return 'new';
      if (n.won && !p.won) return 'win';
      if (n.lost && !p.lost) return 'lose';
      return n.wrong > p.wrong ? 'bad' : 'good';
    },
  }),

  star: kid({
    label: 'Αστέρι', w: 140, h: 140, cheer: true,
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
    label: 'Φατσούλα', w: 140, h: 140, cheer: true,
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
    label: 'Μπράβο!', w: 300, h: 120, cheer: true,
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

// τα ίδια κλάσματα, που ξεκινούν κατευθείαν ως πίτσα και ως σοκολάτα
KIDS.fracpizza = { ...KIDS.fracpie, label: 'Κλάσμα: πίτσα', init: [4, 0, 1] };
KIDS.fracchoc = { ...KIDS.fracbar, label: 'Κλάσμα: σοκολάτα', init: [4, 0, 1] };
for (const [key, emoji, label, draw, pw, ph] of PICS) {
  KIDS[`pic-${key}`] = kid({
    label, w: pw ?? 130, h: ph ?? 130,
    drawKid(c, w, h) {
      c.save();
      if (draw) draw(c, w, h);
      else {
        c.font = `${h * 0.8}px ${EMOJI_FONT}`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillStyle = '#000000';
        c.fillText(emoji, w / 2, h * 0.54);
      }
      c.restore();
    },
  });
}

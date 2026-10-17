/**
 * «Συλλαβές»: πάνω η λέξη και από κάτω τα γράμματά της με τη σειρά. Στη μέση ένα ποταμάκι· στην αριστερή όχθη ένα βατραχάκι
 * που θέλει να περάσει απέναντι. Το παιδί σέρνει νούφαρα στο ποτάμι, ένα για κάθε συλλαβή, και μετά σέρνει κάθε γράμμα
 * στο νούφαρο της συλλαβής του. Με το «Πήδα!» ο βάτραχος πηδά από νούφαρο σε νούφαρο: σε νούφαρο με λάθος γράμματα βουλιάζει,
 * αν λείπει νούφαρο πέφτει στο νερό, και ξαναρχίζει από την όχθη· αν όλα είναι σωστά, φτάνει απέναντι.
 *
 * Κατάσταση (λίστα αριθμών): [πήδημα, αποτέλεσμα, πού έπεσε, «πες τη», νούφαρα, σύρσιμο, x, y, στόχος, γράμματα n,
 * n κωδικοί γραμμάτων, n θέσεις (0 = στη σειρά τους, 1 + p = στο νούφαρο p), αρχές συλλαβών ως «σημαίες»].
 */
import type { StampDef } from '../stamps';
import { syllableStarts } from '../syllabify';
import { BLUE, FONT, GOOD, kid, RED, rrect, text } from './common';

/** Ένα πήδημα του βατράχου (ms)· το ίδιο και στους ήχους (fx.ts, «frog|…»). */
export const SYL_HOP = 700;
const SINK = 1100;
const MAX_PADS = 7;
const MAX_LETTERS = 14;
/** Τι σέρνεται: 1 + i = το γράμμα i, NEW_PAD = νούφαρο από τη στοίβα, PAD + p = το νούφαρο p του ποταμού. */
const NEW_PAD = 99, PAD = 100;
/** Στόχος «πάτημα στη στοίβα χωρίς σύρσιμο»: μπαίνει ένα νούφαρο στο τέλος. */
const APPEND = 999;

/** Λέξεις για το 🎲: γνωστές στα παιδιά, από 2 ως 5 συλλαβές. */
const SYL_WORDS = [
  'μήλο', 'ψάρι', 'σπίτι', 'γάτα', 'σκύλος', 'μπάλα', 'κούκλα', 'τρένο', 'νερό', 'φωτιά', 'δέντρο', 'άστρο', 'ήλιος', 'γιαγιά', 'παιδιά', 'πουλιά',
  'βάτραχος', 'θάλασσα', 'καρέκλα', 'κουμπί', 'φεγγάρι', 'μολύβι', 'χελώνα', 'καρπούζι', 'ντομάτα', 'σύννεφο', 'ουρανός', 'λιοντάρι', 'αλεπού',
  'δελφίνι', 'μπανάνα', 'παγωτό', 'κρεβάτι', 'σταφύλι', 'αχλάδι', 'κεράσι', 'σχολείο', 'δάσκαλος', 'βιβλίο', 'λουλούδι', 'φράουλα', 'καράβι', 'ρολόι',
  'τετράδιο', 'πεταλούδα', 'παπαγάλος', 'ποδήλατο', 'σοκολάτα', 'ελέφαντας', 'πορτοκάλι', 'αεροπλάνο', 'αυτοκίνητο',
];

export interface SylState {
  run: number;
  /** 0 = δεν έγινε έλεγχος (ή άλλαξε κάτι μετά), 1 = πέρασε απέναντι, 2 = βούλιαξε στο νούφαρο `fail`, 3 = έπεσε στο νερό μετά από `fail` νούφαρα. */
  res: number;
  fail: number;
  say: number;
  pads: number;
  drag: number;
  dx: number;
  dy: number;
  tgt: number;
  letters: string[];
  loc: number[];
  starts: number[];
}

export function sylState(v: number[]): SylState {
  const n = Math.max(0, Math.min(MAX_LETTERS, v[9] ?? 0));
  const letters = v.slice(10, 10 + n).map((c) => String.fromCodePoint(c));
  const loc = Array.from({ length: n }, (_, i) => v[10 + n + i] ?? 0);
  const mask = v[10 + 2 * n] ?? 1;
  const starts = letters.map((_, i) => i).filter((i) => i === 0 || (mask & (1 << i)) !== 0);
  return { run: v[0] ?? 0, res: v[1] ?? 0, fail: v[2] ?? 0, say: v[3] ?? 0, pads: v[4] ?? 0, drag: v[5] ?? 0, dx: v[6] ?? 0, dy: v[7] ?? 0, tgt: v[8] ?? 0, letters, loc, starts };
}

function sylPack(s: SylState): number[] {
  const mask = s.starts.reduce((m, i) => m | (1 << i), 0);
  return [s.run, s.res, s.fail, s.say, s.pads, s.drag, Math.round(s.dx), Math.round(s.dy), s.tgt, s.letters.length, ...s.letters.map((c) => c.codePointAt(0)!), ...s.loc, mask];
}

/** Νέα λέξη: όλα τα γράμματα στη σειρά τους, κανένα νούφαρο. Με παύλες (βι-βλι-ο-θή-κη) ο χωρισμός είναι αυτός που γράφτηκε. */
export function sylStart(typed: string, prev?: SylState): number[] | null {
  const parts = typed.trim().split(/[-‐–]+/).map((p) => [...p].filter((ch) => /\p{L}/u.test(ch)).join('')).filter(Boolean);
  const word = parts.join('');
  const letters = [...word];
  if (letters.length < 2 || letters.length > MAX_LETTERS) return null;
  let starts: number[];
  if (parts.length > 1) {
    starts = [];
    let at = 0;
    for (const p of parts) { starts.push(at); at += [...p].length; }
  } else starts = syllableStarts(word);
  if (starts.length > MAX_PADS) return null;
  return sylPack({ run: prev?.run ?? 0, res: 0, fail: 0, say: prev?.say ?? 0, pads: 0, drag: 0, dx: 0, dy: 0, tgt: 0, letters, loc: letters.map(() => 0), starts });
}

/** Οι συλλαβές της λέξης της κατάστασης. */
export function sylParts(s: SylState): string[] {
  return s.starts.map((a, k) => s.letters.slice(a, s.starts[k + 1] ?? s.letters.length).join(''));
}

/** Ο έλεγχος: πού φτάνει ο βάτραχος. */
export function sylCheck(s: SylState): { res: number; fail: number } {
  const S = s.starts.length;
  for (let p = 0; p < s.pads; p++) {
    if (p >= S) return { res: 2, fail: p };
    const want = s.letters.map((_, i) => i).filter((i) => i >= s.starts[p] && i < (s.starts[p + 1] ?? s.letters.length));
    const got = s.loc.map((l, i) => (l === p + 1 ? i : -1)).filter((i) => i >= 0);
    if (want.length !== got.length || want.some((i, k) => got[k] !== i)) return { res: 2, fail: p };
  }
  return s.pads < S ? { res: 3, fail: s.pads } : { res: 1, fail: 0 };
}

// ---------- διάταξη ----------

interface Geom {
  wordY: number; wordSize: number; say: [number, number, number];
  tile: number; tray: [number, number][];
  top: number; bottom: number; mid: number; rx0: number; rx1: number;
  pads: [number, number][]; r: number;
  home: [number, number]; goal: [number, number]; frog: number;
  stack: [number, number, number];
  by: number; bh: number; bx: number[]; bw: number;
}

function geom(w: number, h: number, n: number, P: number): Geom {
  const tile = Math.min(h * 0.085, (w * 0.84) / Math.max(1, n * 1.35));
  const gap = tile * 0.35, tot = n * tile + (n - 1) * gap, tx0 = (w - tot) / 2;
  const top = h * 0.27, bottom = h * 0.86, mid = (top + bottom) / 2 + h * 0.02;
  const rx0 = w * 0.15, rx1 = w * 0.85, sp = (rx1 - rx0) / Math.max(1, P);
  return {
    wordY: h * 0.075, wordSize: h * 0.085, say: [w * 0.93, h * 0.075, h * 0.045],
    tile, tray: Array.from({ length: n }, (_, i) => [tx0 + i * (tile + gap) + tile / 2, h * 0.195]),
    top, bottom, mid, rx0, rx1,
    pads: Array.from({ length: P }, (_, i) => [rx0 + (i + 0.5) * sp, mid + (P > 1 ? (i % 2 ? 1 : -1) * h * 0.035 : 0)]),
    r: Math.min(h * 0.11, sp * 0.42),
    home: [w * 0.075, mid - h * 0.05], goal: [w * 0.925, mid - h * 0.05], frog: h * 0.15,
    stack: [w * 0.075, bottom - h * 0.09, h * 0.05],
    by: h * 0.885, bh: h * 0.1, bx: [w * 0.05, w * 0.37, w * 0.69], bw: w * 0.26,
  };
}

/** Τα γράμματα ενός νούφαρου (με τη σειρά τους στη λέξη) και πού ζωγραφίζεται το καθένα. */
function padLetters(s: SylState, g: Geom, p: number): { i: number; x: number; y: number; size: number }[] {
  const ids = s.loc.map((l, i) => (l === p + 1 ? i : -1)).filter((i) => i >= 0);
  const [cx, cy] = g.pads[p];
  const size = Math.min(g.r * 0.6, (g.r * 1.5) / Math.max(1, ids.length) / 0.62);
  const step = size * 0.62;
  return ids.map((i, k) => ({ i, x: cx + (k - (ids.length - 1) / 2) * step, y: cy, size }));
}

/** Πού πέφτει ένα γράμμα που αφήνεται στο (x, y): 1 + p για νούφαρο, 0 = πίσω στη σειρά. */
function letterTarget(g: Geom, x: number, y: number): number {
  let best = 0, bd = Infinity;
  g.pads.forEach(([px, py], p) => {
    const d = Math.hypot(x - px, y - py);
    if (d < g.r * 1.3 && d < bd) { bd = d; best = p + 1; }
  });
  return best;
}

/** Πού μπαίνει ένα νούφαρο που αφήνεται στο (x, y): 1 + θέση στη σειρά, ή 0 αν αφέθηκε έξω από το ποτάμι. */
function padTarget(g: Geom, x: number, y: number, skip: number): number {
  if (x < g.rx0 || x > g.rx1 || y < g.top || y > g.bottom) return 0;
  return 1 + g.pads.filter(([px], p) => p !== skip && px < x).length;
}

/** Αλλάζει τη σειρά των νούφαρων (και πού είναι τα γράμματα): `order` = τα παλιά νούμερα με τη νέα σειρά. */
function reorder(s: SylState, order: number[]): void {
  s.loc = s.loc.map((l) => (l === 0 ? 0 : order.indexOf(l - 1) + 1));
  s.pads = order.length;
}

// ---------- σχεδίαση ----------

/** Νούφαρο σε προοπτική: επιπλέει, με σχισμή προς τα πίσω, σκούρα άκρη από κάτω και ένα κυματάκι γύρω του. */
function lilyPad(c: CanvasRenderingContext2D, x: number, y: number, r: number, tint?: string, ripple = true): void {
  const ry = r * 0.5;
  c.save();
  if (ripple) {
    c.beginPath();
    c.ellipse(x, y + r * 0.06, r * 1.16, ry * 1.3, 0, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(219,234,254,0.75)';
    c.lineWidth = Math.max(1.5, r * 0.035);
    c.stroke();
  }
  c.beginPath();
  c.ellipse(x, y + r * 0.08, r, ry, 0, 0, Math.PI * 2);
  c.fillStyle = '#15803d';
  c.fill();
  c.beginPath();
  c.moveTo(x, y);
  c.ellipse(x, y, r, ry, 0, -Math.PI / 2 + 0.38, -Math.PI / 2 - 0.38 + Math.PI * 2);
  c.closePath();
  c.fillStyle = tint ?? '#4ade80';
  c.fill();
  c.lineWidth = Math.max(2, r * 0.05);
  c.strokeStyle = '#15803d';
  c.lineJoin = 'round';
  c.stroke();
  // γυαλάδα μπροστά αριστερά
  c.beginPath();
  c.ellipse(x - r * 0.45, y + ry * 0.2, r * 0.22, ry * 0.18, -0.3, Math.PI * 1.1, Math.PI * 1.9);
  c.strokeStyle = '#bbf7d0';
  c.lineWidth = Math.max(2, r * 0.06);
  c.lineCap = 'round';
  c.stroke();
  c.restore();
}

/**
 * Το βατραχάκι: στρογγυλούλι, λίγο γυρισμένο προς τα δεξιά (εκεί που θέλει να πάει), με πόδια.
 * (x, y) = κάτω στα πόδια του, s = ύψος· `leap` 0…1: πόσο έχουν τεντωθεί τα πίσω πόδια στο πήδημα.
 */
function drawFrog(c: CanvasRenderingContext2D, x: number, y: number, s: number, leap = 0): void {
  const G = '#4ade80', D = '#166534', L = '#bbf7d0';
  const lw = Math.max(2, s * 0.03);
  c.save();
  c.lineWidth = lw;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.strokeStyle = D;
  const blob = (cx: number, cy: number, rx: number, ry: number, fill: string, rot = 0): void => {
    c.beginPath();
    c.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
    c.stroke();
  };
  // πίσω πόδι: διπλωμένο όταν κάθεται, τεντωμένο προς τα πίσω στο πήδημα
  const fx = x - s * (0.3 + 0.25 * leap), fy = y - s * (0.02 - 0.12 * leap);
  blob(fx, fy, s * (0.17 + 0.05 * leap), s * 0.055, '#22c55e', -0.15 * leap);
  blob(x - s * 0.22 - s * 0.1 * leap, y - s * 0.17 + s * 0.05 * leap, s * 0.2, s * 0.15, '#22c55e', 0.5 + 0.6 * leap);
  // σώμα και κοιλίτσα
  blob(x, y - s * 0.3, s * 0.36, s * 0.29, G);
  c.beginPath();
  c.ellipse(x + s * 0.1, y - s * 0.22, s * 0.2, s * 0.15, 0, 0, Math.PI * 2);
  c.fillStyle = L;
  c.fill();
  // μπροστινά πόδια
  for (const [dx, k] of [[0.08, 0.9], [0.27, 1]] as const) {
    c.beginPath();
    c.moveTo(x + s * dx, y - s * 0.16);
    c.lineTo(x + s * (dx + 0.02 + 0.08 * leap), y - s * 0.01 + s * 0.04 * leap);
    c.lineWidth = s * 0.07 * k;
    c.strokeStyle = G;
    c.stroke();
    c.lineWidth = lw;
    c.strokeStyle = D;
    blob(x + s * (dx + 0.05 + 0.08 * leap), y + s * 0.04 * leap, s * 0.08 * k, s * 0.035, G);
  }
  // μάτια: το μακρινό λίγο πιο μικρό, οι κόρες κοιτάζουν μπροστά
  for (const [ex, er] of [[0.0, 0.13], [0.24, 0.15]] as const) {
    blob(x + s * ex, y - s * 0.6, s * er, s * er, G);
    c.beginPath();
    c.arc(x + s * ex, y - s * 0.61, s * er * 0.66, 0, Math.PI * 2);
    c.fillStyle = '#ffffff';
    c.fill();
    c.beginPath();
    c.arc(x + s * (ex + er * 0.25), y - s * 0.6, s * er * 0.38, 0, Math.PI * 2);
    c.fillStyle = '#111111';
    c.fill();
    c.beginPath();
    c.arc(x + s * (ex + er * 0.35), y - s * 0.64, s * er * 0.13, 0, Math.PI * 2);
    c.fillStyle = '#ffffff';
    c.fill();
  }
  // μάγουλο και χαμόγελο
  c.beginPath();
  c.arc(x + s * 0.33, y - s * 0.37, s * 0.045, 0, Math.PI * 2);
  c.fillStyle = '#f9a8d4';
  c.fill();
  c.beginPath();
  c.moveTo(x + s * 0.05, y - s * 0.43);
  c.quadraticCurveTo(x + s * 0.16, y - s * 0.35, x + s * 0.27, y - s * 0.44);
  c.stroke();
  c.restore();
}

/** Γράμμα πάνω σε νούφαρο: σχεδόν μαύρο με χοντρό λευκό περίγραμμα, για να ξεχωρίζει σε κάθε απόχρωση του πράσινου. */
function padLetter(c: CanvasRenderingContext2D, ch: string, x: number, y: number, size: number): void {
  c.save();
  c.font = `800 ${size}px ${FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  c.lineWidth = Math.max(3, size * 0.22);
  c.strokeStyle = '#ffffff';
  c.strokeText(ch, x, y);
  c.fillStyle = '#0f172a';
  c.fillText(ch, x, y);
  c.restore();
}

function letterTile(c: CanvasRenderingContext2D, ch: string, x: number, y: number, s: number, lifted = false): void {
  c.save();
  if (lifted) { c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = s * 0.3; c.shadowOffsetY = s * 0.08; }
  rrect(c, x - s / 2, y - s / 2, s, s, s * 0.2);
  c.fillStyle = '#ffffff';
  c.fill();
  c.shadowColor = 'transparent';
  c.lineWidth = Math.max(1.5, s * 0.05);
  c.strokeStyle = '#334155';
  c.stroke();
  c.restore();
  text(c, ch, x, y + s * 0.03, s * 0.68, '#1e293b', 700);
}

function ripples(c: CanvasRenderingContext2D, x: number, y: number, r: number, k: number): void {
  c.save();
  c.strokeStyle = '#ffffff';
  for (let i = 0; i < 3; i++) {
    const q = (k + i * 0.25) % 1;
    c.globalAlpha = 0.7 * (1 - q);
    c.lineWidth = Math.max(1.5, r * 0.05);
    c.beginPath();
    c.ellipse(x, y, r * (0.3 + q), r * (0.3 + q) * 0.45, 0, 0, Math.PI * 2);
    c.stroke();
  }
  c.restore();
}

function button(c: CanvasRenderingContext2D, label: string, x: number, y: number, w: number, h: number, color: string): void {
  rrect(c, x, y, w, h, h * 0.3);
  c.save();
  c.fillStyle = color;
  c.globalAlpha = 0.92;
  c.fill();
  c.restore();
  text(c, label, x + w / 2, y + h / 2 + 1, h * 0.42, '#ffffff', 700);
}

const ease = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export const SYLLABLE_KIDS: Record<string, StampDef> = {
  syllables: kid({
    label: 'Συλλαβές', w: 960, h: 640, init: [0], big: true, animMs: 9000,
    drawKid(c, w, h, v, env) {
      const s = sylState(v), n = s.letters.length, g = geom(w, h, n, s.pads);
      // δικό του φόντο, για να μη φαίνεται από πίσω ό,τι έχει η σελίδα· μετά το τοπίο: όχθες και ποτάμι
      c.save();
      rrect(c, 0, 0, w, h, h * 0.03);
      c.fillStyle = env.bg;
      c.fill();
      c.globalAlpha = 0.25;
      c.strokeStyle = env.ink;
      c.lineWidth = 2;
      c.stroke();
      c.globalAlpha = 1;
      rrect(c, 0, g.top, w, g.bottom - g.top, h * 0.03);
      c.fillStyle = '#86efac';
      c.fill();
      const river = c.createLinearGradient(g.rx0, 0, g.rx1, 0);
      river.addColorStop(0, '#38bdf8');
      river.addColorStop(0.5, '#3b82f6');
      river.addColorStop(1, '#38bdf8');
      c.fillStyle = river;
      c.beginPath();
      c.moveTo(g.rx0, g.top);
      for (let y = g.top; y <= g.bottom; y += 8) c.lineTo(g.rx0 + Math.sin(y / 23) * w * 0.006, y);
      c.lineTo(g.rx1, g.bottom);
      for (let y = g.bottom; y >= g.top; y -= 8) c.lineTo(g.rx1 + Math.sin(y / 19) * w * 0.006, y);
      c.closePath();
      c.fill();
      // το νερό κυλά: κυματάκια που κατεβαίνουν
      const flow = ((env.anim?.t ?? 0) / 40) % 60;
      c.strokeStyle = 'rgba(255,255,255,0.35)';
      c.lineWidth = Math.max(1.5, w * 0.002);
      c.beginPath();
      for (let k = 1; k < 6; k++) {
        const x = g.rx0 + ((g.rx1 - g.rx0) * k) / 6;
        for (let y = g.top + 15 + flow; y < g.bottom - 20; y += 60) { c.moveTo(x - 8, y); c.quadraticCurveTo(x, y + 8, x + 8, y); }
      }
      c.stroke();
      c.restore();
      text(c, '🌾', w * 0.03, g.top + h * 0.05, h * 0.06);
      text(c, '🌾', w * 0.97, g.bottom - h * 0.05, h * 0.06);
      text(c, '🌼', w * 0.955, g.top + h * 0.05, h * 0.04);

      // η λέξη (μετά από επιτυχία, χωρισμένη σε συλλαβές) και το 🔊
      const an = env.anim, was = an ? sylState(an.prev) : null;
      const jumping = !!an && !!was && was.run !== s.run && s.res !== 0;
      const t = jumping ? an!.t : Infinity;
      const P = s.pads;
      const landings = s.res === 1 ? P : s.res === 2 ? s.fail + 1 : s.fail;
      const jumpEnd = (landings + (s.res === 2 ? 0 : 1)) * SYL_HOP;
      const done = t >= jumpEnd;
      if (!n) {
        text(c, 'Πάτα 🎲 για λέξη, ή ✏️ για δική σου', w / 2, g.wordY, g.wordSize * 0.6, env.ink, 700);
      } else if (s.res === 1 && done) text(c, sylParts(s).join(' - '), w / 2, g.wordY, g.wordSize, GOOD, 800);
      else text(c, s.letters.join(''), w / 2, g.wordY, g.wordSize, env.ink, 800);
      if (n) {
        c.save();
        c.beginPath();
        c.arc(g.say[0], g.say[1], g.say[2], 0, Math.PI * 2);
        c.fillStyle = env.ink;
        c.globalAlpha = 0.1;
        c.fill();
        c.restore();
        text(c, '🔊', g.say[0], g.say[1] + 1, g.say[2] * 1.1);
      }

      // τα γράμματα που δεν έχουν μπει σε νούφαρο, στη θέση τους· οι άδειες θέσεις αχνές
      s.letters.forEach((ch, i) => {
        const [x, y] = g.tray[i];
        if (s.loc[i] === 0 && s.drag !== i + 1) letterTile(c, ch, x, y, g.tile);
        else {
          c.save();
          c.globalAlpha = 0.25;
          c.setLineDash([5, 5]);
          c.strokeStyle = env.ink;
          c.lineWidth = 1.5;
          rrect(c, x - g.tile / 2, y - g.tile / 2, g.tile, g.tile, g.tile * 0.2);
          c.stroke();
          c.restore();
        }
      });

      // η στοίβα με τα νούφαρα στην αριστερή όχθη
      const [sx, sy, sr] = g.stack;
      for (let k = 2; k >= 0; k--) lilyPad(c, sx + k * sr * 0.1, sy - k * sr * 0.16, sr, P >= MAX_PADS ? '#bbf7d0' : undefined, false);
      text(c, 'νούφαρα', sx, sy + sr * 1.35, sr * 0.48, '#14532d', 700);

      // τα νούφαρα του ποταμού (όχι αυτό που σέρνεται), με όσα γράμματα έχουν μπει
      const sinking = s.res === 2 && jumping && t >= jumpEnd && t < jumpEnd + SINK ? (t - jumpEnd) / SINK : 0;
      for (let p = 0; p < P; p++) {
        if (s.drag === PAD + p) continue;
        const [px, py] = g.pads[p];
        // νούφαρα που πάτησε ο βάτραχος και ήταν σωστά: πιο ανοιχτό πράσινο
        const passed = s.res !== 0 && p < Math.min(landings, Math.floor(t / SYL_HOP)) && !(s.res === 2 && p === s.fail);
        const bad = s.res === 2 && p === s.fail && t >= jumpEnd;
        c.save();
        if (p === s.fail && sinking) { c.globalAlpha = 1 - sinking * 0.85; c.translate(0, sinking * g.r * 0.5); }
        lilyPad(c, px, py, g.r, passed ? '#bbf7d0' : undefined);
        if (bad && !sinking) {
          c.beginPath();
          c.arc(px, py, g.r * 1.12, 0, Math.PI * 2);
          c.strokeStyle = RED;
          c.lineWidth = Math.max(3, g.r * 0.1);
          c.setLineDash([g.r * 0.25, g.r * 0.15]);
          c.stroke();
        }
        for (const l of padLetters(s, g, p)) {
          if (s.drag === l.i + 1) continue;
          padLetter(c, s.letters[l.i], l.x, l.y + l.size * 0.04, l.size);
        }
        c.restore();
        if (p === s.fail && sinking) ripples(c, px, py, g.r, sinking);
      }

      // ο βάτραχος: πηδήματα από την όχθη στα νούφαρα, και ό,τι γίνει στο τέλος
      const stops: [number, number][] = [g.home];
      for (let p = 0; p < landings && p < P; p++) stops.push([g.pads[p][0], g.pads[p][1] - g.r * 0.32 - g.frog * 0.42]);
      const water: [number, number] = [P ? (g.pads[P - 1][0] + g.rx1) / 2 : (g.rx0 + g.rx1) / 2, g.mid];
      if (s.res === 1) stops.push(g.goal);
      if (s.res === 3) stops.push(water);
      let fx = g.home[0], fy = g.home[1], alpha = 1, size = g.frog, leap = 0;
      if (s.res === 1 && done) [fx, fy] = g.goal;
      else if (jumping && !done) {
        const k = Math.min(stops.length - 2, Math.floor(t / SYL_HOP)), q = ease((t - k * SYL_HOP) / SYL_HOP);
        const [ax, ay] = stops[k], [bx, by] = stops[k + 1];
        fx = ax + (bx - ax) * q;
        fy = ay + (by - ay) * q - Math.sin(q * Math.PI) * h * 0.12;
        size = g.frog * (1 + 0.25 * Math.sin(q * Math.PI));
        leap = Math.sin(q * Math.PI);
      } else if (jumping && t < jumpEnd + SINK) {
        // βουλιάζει μαζί με το νούφαρο, ή πέφτει στο νερό ανάμεσα
        const q = (t - jumpEnd) / SINK, [ex, ey] = stops[stops.length - 1];
        fx = ex;
        fy = ey + q * g.r * 0.6;
        alpha = 1 - q;
        if (s.res === 3) ripples(c, ex, ey + g.r * 0.2, g.r, q);
      } else if (jumping && t < jumpEnd + SINK + 500) alpha = (t - jumpEnd - SINK) / 500;
      c.save();
      c.globalAlpha = Math.max(0, alpha);
      drawFrog(c, fx, fy + size * 0.42, size * 0.95, leap);
      c.restore();

      // μήνυμα κάτω από το ποτάμι
      const msg = !n ? '' : s.res === 1 && done ? '🎉 Μπράβο! Πέρασε απέναντι!'
        : s.res === 2 && t >= jumpEnd ? `Πλουφ! Το ${s.fail + 1}ο νούφαρο δεν έχει σωστή συλλαβή.`
        : s.res === 3 && t >= jumpEnd ? 'Πλουφ! Λείπει νούφαρο: μία συλλαβή, ένα νούφαρο.'
        : s.res === 0 ? (P === 0 ? 'Σύρε ένα νούφαρο στο ποτάμι για κάθε συλλαβή.' : 'Σύρε κάθε γράμμα στο νούφαρο της συλλαβής του.') : '';
      if (msg) {
        // σε λευκή «ταμπέλα», για να διαβάζεται πάνω στο ποτάμι
        const fs = h * 0.04, my = g.bottom - h * 0.04;
        c.save();
        c.font = `700 ${fs}px ${FONT}`;
        const mw = c.measureText(msg).width + fs * 1.4;
        rrect(c, w / 2 - mw / 2, my - fs * 0.85, mw, fs * 1.7, fs * 0.6);
        c.fillStyle = 'rgba(255,255,255,0.92)';
        c.fill();
        c.restore();
        text(c, msg, w / 2, my, fs, s.res === 1 ? '#14532d' : s.res ? '#991b1b' : '#1e3a8a', 700);
      }

      // ό,τι σέρνεται, από πάνω απ' όλα
      if (s.drag >= 1 && s.drag <= n) letterTile(c, s.letters[s.drag - 1], s.dx, s.dy, g.tile * 1.1, true);
      else if (s.drag === NEW_PAD || s.drag >= PAD) {
        c.save();
        c.globalAlpha = 0.85;
        lilyPad(c, s.dx, s.dy, g.r, undefined, false);
        c.restore();
      }

      button(c, '🎲 Νέα λέξη', g.bx[0], g.by, g.bw, g.bh, BLUE);
      button(c, '✏️ Δική μου λέξη', g.bx[1], g.by, g.bw, g.bh, BLUE);
      button(c, '🐸 Πήδα!', g.bx[2], g.by, g.bw, g.bh, '#16a34a');
    },
    paint(v, x, y, w, h, _st, first) {
      const s = sylState(v), n = s.letters.length, g = geom(w, h, n, s.pads);
      if (first) {
        let drag = 0;
        // ένα γράμμα της σειράς, ή ένα γράμμα πάνω σε νούφαρο
        s.letters.forEach((_, i) => {
          if (!drag && s.loc[i] === 0 && Math.abs(x - g.tray[i][0]) < g.tile / 2 && Math.abs(y - g.tray[i][1]) < g.tile / 2) drag = i + 1;
        });
        for (let p = 0; p < s.pads && !drag; p++) {
          for (const l of padLetters(s, g, p)) if (!drag && Math.abs(x - l.x) < l.size * 0.4 && Math.abs(y - l.y) < l.size * 0.6) drag = l.i + 1;
        }
        for (let p = 0; p < s.pads && !drag; p++) if (Math.hypot(x - g.pads[p][0], y - g.pads[p][1]) < g.r) drag = PAD + p;
        const onStack = Math.hypot(x - g.stack[0], y - g.stack[1]) < g.stack[2] * 1.3;
        if (!drag && onStack && s.pads < MAX_PADS) drag = NEW_PAD;
        if (!drag) return null;
        s.drag = drag;
        s.tgt = drag === NEW_PAD ? APPEND : drag >= PAD ? 1 + (drag - PAD) : s.loc[drag - 1];
      } else {
        if (!s.drag) return null;
        if (s.drag <= n) s.tgt = letterTarget(g, x, y);
        else if (s.drag === NEW_PAD) s.tgt = Math.hypot(x - g.stack[0], y - g.stack[1]) < g.stack[2] * 1.3 ? APPEND : padTarget(g, x, y, -1);
        else s.tgt = padTarget(g, x, y, s.drag - PAD);
      }
      s.dx = x;
      s.dy = y;
      return sylPack(s);
    },
    drop(v) {
      const s = sylState(v);
      if (!s.drag) return null;
      const drag = s.drag, tgt = s.tgt, before = sylPack({ ...s, drag: 0, tgt: 0, dx: 0, dy: 0 });
      let ev = '';
      if (drag <= s.letters.length) {
        if (s.loc[drag - 1] !== tgt) ev = tgt ? 'pop' : 'tok';
        s.loc[drag - 1] = tgt;
      } else if (drag === NEW_PAD) {
        if (tgt && s.pads < MAX_PADS) {
          const at = tgt === APPEND ? s.pads : tgt - 1;
          const order = Array.from({ length: s.pads }, (_, p) => p);
          reorder(s, [...order.slice(0, at), s.pads, ...order.slice(at)]);
          ev = 'pop';
        }
      } else {
        const p = drag - PAD, order = Array.from({ length: s.pads }, (_, q) => q).filter((q) => q !== p);
        if (!tgt) {
          // νούφαρο έξω από το ποτάμι: φεύγει, και τα γράμματά του γυρίζουν στη σειρά τους
          s.loc = s.loc.map((l) => (l === p + 1 ? 0 : l));
          reorder(s, order);
          ev = 'wipe';
        } else {
          reorder(s, [...order.slice(0, tgt - 1), p, ...order.slice(tgt - 1)]);
        }
      }
      s.drag = 0; s.tgt = 0; s.dx = 0; s.dy = 0;
      const next = sylPack(s);
      // ό,τι αλλάζει μετά από ένα πήδημα, ξαναφέρνει τον βάτραχο στην αρχή
      if (next.join() !== before.join()) s.res = 0;
      return { v: sylPack(s), ev };
    },
    tap(v, x, y, w, h) {
      const s = sylState(v), g = geom(w, h, s.letters.length, s.pads);
      if (s.letters.length && Math.hypot(x - g.say[0], y - g.say[1]) < g.say[2] * 1.3) return sylPack({ ...s, say: s.say + 1 });
      if (y < g.by || y > g.by + g.bh) return null;
      if (x >= g.bx[0] && x <= g.bx[0] + g.bw) {
        const cur = s.letters.join('');
        let word = SYL_WORDS[Math.floor(Math.random() * SYL_WORDS.length)];
        if (word === cur) word = SYL_WORDS[(SYL_WORDS.indexOf(word) + 1) % SYL_WORDS.length];
        return sylStart(word, s);
      }
      if (x >= g.bx[2] && x <= g.bx[2] + g.bw && s.letters.length) return sylPack({ ...s, ...sylCheck(s), run: s.run + 1 });
      return null;
    },
    ask(v, x, y, w, h) {
      const s = sylState(v), g = geom(w, h, s.letters.length, s.pads);
      if (y < g.by || y > g.by + g.bh || x < g.bx[1] || x > g.bx[1] + g.bw) return null;
      return {
        title: 'Λέξη για τις συλλαβές',
        hint: `Μία λέξη, ως ${MAX_LETTERS} γράμματα. Ο πίνακας τη χωρίζει μόνος του· για άλλον χωρισμό γράψ' τη με παύλες, π.χ. βι-βλι-ο-θή-κη.`,
        voice: 'el-GR',
        max: 30,
        apply: (typed) => sylStart(typed, s),
      };
    },
    fx(prev, next) {
      const p = sylState(prev), q = sylState(next);
      if (p.letters.join('') !== q.letters.join('') || p.starts.join() !== q.starts.join()) return 'new';
      if (q.run !== p.run && q.res) {
        const landings = q.res === 1 ? q.pads : q.res === 2 ? q.fail + 1 : q.fail;
        return `frog|${landings}|${q.res === 1 ? 'w' : q.res === 2 ? 's' : 'g'}`;
      }
      if (q.say !== p.say) return `say|el-GR|${q.letters.join('')}`;
      return null;
    },
  }),
};

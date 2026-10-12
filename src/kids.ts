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

/** Υλικό δεκάδων: όρια των τριών στηλών (ως κλάσμα του πλάτους) και ύψος της κεφαλίδας. */
const BCOL = [0, 0.44, 0.72, 1], BHEAD = 0.24;

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
/** Διάταξη του εργαλείου: πλέγμα επάνω, σειρά υλικών κάτω (υλικά, γόμα, καθάρισμα). */
function buildGeom(w: number, h: number): { s: number; gh: number; slots: number; sw: number; py: number; ps: number } {
  const s = w / BCOLS, gh = s * BROWS;
  const slots = BLOCKS.length + 2, sw = w / slots;
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
    // οι δείκτες σέρνονται: έξω κοντά στους αριθμούς ο λεπτοδείκτης (ανά 5 λεπτά), πιο μέσα ο ωροδείκτης
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
      if (st.hand === 1) return [Math.floor(mins / 60) * 60 + (Math.round((a / (2 * Math.PI)) * 12) % 12) * 5, v[1] ?? 1];
      return [(Math.round((a / (2 * Math.PI)) * 12 - (mins % 60) / 60 + 12) % 12) * 60 + (mins % 60), v[1] ?? 1];
    },
    tap(v, _x, y, w, h) {
      const mins = ((v[0] ?? 0) % 720 + 720) % 720;
      return y > w && y <= h ? [mins, v[1] ? 0 : 1] : null;
    },
  }),

  blocks: kid({
    label: 'Εκατοντάδες, δεκάδες, μονάδες', w: 620, h: 400, init: [234, 1],
    drawKid(c, w, h, v, env) {
      const n = Math.max(0, Math.min(999, v[0] ?? 0));
      const digits = [Math.floor(n / 100), Math.floor(n / 10) % 10, n % 10];
      const cols = BCOL.map((q) => q * w);
      const head = h * BHEAD, foot = h * 0.16;
      const names = ['Εκατοντάδες', 'Δεκάδες', 'Μονάδες'], fills = [GREEN, BLUE, YELLOW];
      c.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        const x0 = cols[k], x1 = cols[k + 1], mid = (x0 + x1) / 2;
        c.save();
        c.globalAlpha = 0.35;
        c.strokeRect(x0, 0, x1 - x0, h - foot);
        c.restore();
        // επάνω το όνομα της στήλης· από κάτω − και +, με το ψηφίο της ανάμεσα
        const r = head * 0.2, ky = head * 0.68;
        text(c, names[k], mid, head * 0.22, Math.min(head * 0.3, ((x1 - x0) * 1.5) / names[k].length), env.ink, 700);
        knob(c, x0 + r * 1.5, ky, r, '−', env);
        knob(c, x1 - r * 1.5, ky, r, '+', env);
        // όταν ο αριθμός είναι κρυμμένος («Ποιος αριθμός είναι;») κρύβονται και τα ψηφία
        text(c, v[1] ? String(digits[k]) : '?', mid, ky + 1, head * 0.36, env.ink, 800);
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
      const cols = BCOL.map((q) => q * w), head = h * BHEAD, foot = h * 0.16, r = head * 0.2, ky = head * 0.68;
      if (y > h - foot && y <= h) return [n, v[1] ? 0 : 1];
      for (let k = 0; k < 3; k++) {
        // πάνω από 9 η στήλη μηδενίζει και περνά ένα στην αριστερή της (κρατούμενο)· κάτω από 0 «δανείζεται» από εκεί
        const unit = [100, 10, 1][k];
        if (inR(x, y, cols[k] + r * 1.5, ky, r * 1.2)) return n - unit >= 0 ? [n - unit, v[1] ?? 1] : null;
        if (inR(x, y, cols[k + 1] - r * 1.5, ky, r * 1.2)) return n + unit <= 999 ? [n + unit, v[1] ?? 1] : null;
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
        else text(c, k === BLOCKS.length ? '🧽' : '🗑️', cx, g.py + 1, g.ps * 0.8);
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
      if (k === BLOCKS.length + 1) return [sel >= BLOCKS.length ? 0 : sel];
      out[0] = k;
      return out;
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
          if (open || st.lost) text(c, ch, cx, y, cw * 0.82, open ? env.ink : RED, 700);
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

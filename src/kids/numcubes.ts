/** Αριθμοκυβάκια: χαρακτήρες-αριθμοί που χτίζονται, κόβονται, ντύνονται και ζυγίζονται στη ζυγαριά. */
import type { StampDef } from '../stamps';
import { type C, FONT, fullIcon, kid, rrect, text } from './common';

/**
 * Χαρακτήρες από κυβάκια, 1 έως 20, που ενώνονται (σύρεις το ένα πάνω στο άλλο), χωρίζονται (✂️), αλλάζουν σχήμα, χρώμα
 * και φοράνε αξεσουάρ. Η σκηνή μετριέται σε κυβάκια (NC_W × NC_H), για να μη χρειάζεται το μέγεθος του κουτιού στο «άφημα».
 * Κατάσταση: [λειτουργία, επιλογή στην παλέτα, σημαίες σκηνής (S_*), και ανά χαρακτήρα NC_REC αριθμοί].
 */
const NC_W = 28, NC_H = 13, NC_MAX = 20, NC_ITEMS = 30, NC_HEAD = 3, NC_REC = 7;
/** Σημαίες σκηνής: κρυφοί αριθμοί, ζυγαριά (η τιμή 2 ήταν η τραμπάλα: τα παλιά μαθήματα ανοίγουν με ζυγαριά). */
const S_HIDDEN = 1, S_SCALE = 2;
/** Σημαίες χαρακτήρα: κρατιέται, πάνω από τον κάδο, μόλις κόπηκε, πάνω σε πιατέλα της ζυγαριάς. */
const F_HELD = 1, F_TRASH = 2, F_FRESH = 4, F_PAN = 8;
/** Χαρακτήρας: κάτω-κέντρο (x, y) σε δέκατα του κυβακίου, πόσα κυβάκια, ύψος σχήματος (γεμίζει ανά στήλη), αξεσουάρ, χρώμα, σημαίες (F_*). */
export interface NCube { x: number; y: number; n: number; h: number; acc: number; col: number; f: number }
export interface NCState { mode: number; sel: number; flags: number; cubes: NCube[] }
export function ncState(v: number[]): NCState {
  const cubes: NCube[] = [];
  for (let i = NC_HEAD; i + NC_REC <= v.length; i += NC_REC) {
    const n = Math.max(1, Math.min(NC_MAX, v[i + 2] || 1));
    const e = { x: v[i], y: v[i + 1], n, h: Math.max(1, Math.min(n, v[i + 3] || Math.min(n, 10))), acc: v[i + 4] ?? 0, col: v[i + 5] ?? 0, f: v[i + 6] ?? 0 };
    // όσοι κάθονταν στην παλιά τραμπάλα πάνε στην πιατέλα τους
    if (e.f & F_PAN && !(e.f & F_HELD) && e.y !== NC_PY * 10) ncClamp(e);
    cubes.push(e);
  }
  // το 3 ήταν το βάψιμο (δεν υπάρχει πια)
  return { mode: v[0] === 3 ? 0 : v[0] ?? 0, sel: v[1] ?? 0, flags: v[2] ?? 0, cubes };
}
export function ncPack(s: NCState): number[] {
  return [s.mode, s.sel, s.flags, ...s.cubes.flatMap((e) => [e.x, e.y, e.n, e.h, e.acc, e.col, e.f])];
}
const ncCols = (e: NCube): number => Math.ceil(e.n / e.h);
/** Τα σχήματα ενός αριθμού (ύψος στήλης): πύργος (ή δεκάδα + μονάδες) και όσα ορθογώνια βγαίνουν ακριβώς, π.χ. 6 → 6, 3, 2, 1. */
export function ncShapes(n: number): number[] {
  const out = [Math.min(n, 10)];
  for (let d = 10; d >= 1; d--) if (n % d === 0 && n / d <= 10 && !out.includes(d)) out.push(d);
  return out.sort((a, b) => b - a);
}
/**
 * Ζυγαριά (S_SCALE): δύο οριζόντιες πιατέλες με κέντρο NC_PX ∓ NC_PA και μισό πλάτος NC_PW, σε κυβάκια, πάνω σε στυλάκια
 * μιας δοκού. Οι χαρακτήρες πάνω τους (F_PAN) κρατούν y = NC_PY· όλη η πιατέλα με το μεγαλύτερο άθροισμα κατεβαίνει
 * κατά NC_DY και η άλλη ανεβαίνει. Μετράει μόνο το άθροισμα, όχι το πού στέκεται ο καθένας πάνω στην πιατέλα.
 */
const NC_PX = 14, NC_PY = 10.2, NC_PA = 7, NC_PW = 5.5, NC_DY = 0.8;
/** Η πιατέλα ενός χαρακτήρα: −1 αριστερά, 1 δεξιά. */
const ncPan = (e: NCube): number => (e.x < NC_PX * 10 ? -1 : 1);
/** Τα αθροίσματα στην αριστερή και στη δεξιά πιατέλα (όχι όποιος κρατιέται). */
function ncSides(cubes: NCube[]): [number, number] {
  let l = 0, r = 0;
  for (const e of cubes) {
    if (!(e.f & F_PAN) || e.f & F_HELD) continue;
    if (ncPan(e) < 0) l += e.n;
    else r += e.n;
  }
  return [l, r];
}
/** Προς τα πού γέρνει η ζυγαριά: −1 αριστερά, 0 ίσια, 1 δεξιά (ενδιάμεσες τιμές όσο κινείται). */
const ncTilt = (cubes: NCube[]): number => {
  const [l, r] = ncSides(cubes);
  return Math.sign(r - l);
};
/** Πόσο πιο κάτω (σε κυβάκια) φαίνεται ένας χαρακτήρας της ζυγαριάς όταν γέρνει κατά k. */
const ncLift = (e: NCube, k: number): number => (e.f & F_PAN && !(e.f & F_HELD) ? ncPan(e) * k * NC_DY : 0);
function ncBox(e: NCube, k = 0): { x0: number; x1: number; y0: number; y1: number } {
  const c = ncCols(e), y = e.y / 10 + ncLift(e, k);
  return { x0: e.x / 10 - c / 2, x1: e.x / 10 + c / 2, y0: y - e.h, y1: y };
}
function ncClamp(e: NCube): void {
  const c = ncCols(e) / 2;
  if (e.f & F_PAN) {
    // πάνω στη ζυγαριά: ολόκληρος μέσα στην πιατέλα του (ένας πολύ φαρδύς στη μέση της)
    const m = NC_PX + ncPan(e) * NC_PA;
    e.x = Math.round(c >= NC_PW ? m * 10 : Math.max((m - NC_PW + c) * 10, Math.min((m + NC_PW - c) * 10, e.x)));
    e.y = NC_PY * 10;
    return;
  }
  e.x = Math.round(Math.max(c * 10, Math.min((NC_W - c) * 10, e.x)));
  e.y = Math.round(Math.max((e.h + 0.9) * 10, Math.min(NC_H * 10, e.y)));
}
/** Με τη ζυγαριά, ό,τι αφήνεται πάνω από μια πιατέλα κάθεται πάνω της. true αν κάθισε. */
function ncSeat(s: NCState, e: NCube): boolean {
  if (!(s.flags & S_SCALE) || Math.abs(Math.abs(e.x / 10 - NC_PX) - NC_PA) > NC_PW) return false;
  e.f |= F_PAN;
  ncClamp(e);
  return true;
}
/** Η ζυγαριά, γερμένη κατά k, και πάνω στη μέση η σύγκριση των δύο αθροισμάτων (π.χ. 6 < 9). */
function ncScale(c: C, g: { S: number; ox: number; oy: number }, k: number, sides: [number, number], hidden: boolean): void {
  const S = g.S, X = g.ox + NC_PX * S, gy = g.oy + NC_H * S, t = S * 0.36, lw = Math.max(1.5, S * 0.07);
  const pivot = gy - S * 1.5, dy = k * NC_DY * S, arm = NC_PA * S;
  c.save();
  c.lineJoin = 'round';
  c.lineCap = 'round';
  // βάση και κολόνα
  rrect(c, X - S * 1.6, gy - S * 0.3, S * 3.2, S * 0.3, S * 0.12);
  paintPath(c, '#64748b', '#334155', lw);
  c.beginPath();
  c.moveTo(X - S * 0.45, gy - S * 0.3);
  c.lineTo(X - S * 0.2, pivot);
  c.lineTo(X + S * 0.2, pivot);
  c.lineTo(X + S * 0.45, gy - S * 0.3);
  c.closePath();
  paintPath(c, '#64748b', '#334155', lw);
  // δοκός και στυλάκια ως τις πιατέλες, που μένουν πάντα οριζόντιες
  for (const side of [-1, 1]) {
    const px = X + side * arm, py = g.oy + NC_PY * S + side * dy;
    c.strokeStyle = '#334155';
    c.lineWidth = S * 0.22;
    c.beginPath();
    c.moveTo(px, pivot + side * dy);
    c.lineTo(px, py + t);
    c.stroke();
    c.beginPath();
    c.moveTo(px - NC_PW * S, py);
    c.lineTo(px + NC_PW * S, py);
    c.quadraticCurveTo(px + NC_PW * S * 0.9, py + t * 1.4, px + NC_PW * S * 0.75, py + t * 1.4);
    c.lineTo(px - NC_PW * S * 0.75, py + t * 1.4);
    c.quadraticCurveTo(px - NC_PW * S * 0.9, py + t * 1.4, px - NC_PW * S, py);
    c.closePath();
    paintPath(c, '#f59e0b', '#92400e', lw);
  }
  c.strokeStyle = '#475569';
  c.lineWidth = S * 0.3;
  c.beginPath();
  c.moveTo(X - arm, pivot - dy);
  c.lineTo(X + arm, pivot + dy);
  c.stroke();
  c.beginPath();
  c.arc(X, pivot, S * 0.26, 0, Math.PI * 2);
  paintPath(c, '#334155');
  c.restore();
  // η σύγκριση, ψηλά στη μέση
  const [l, r] = sides, sign = l < r ? '<' : l > r ? '>' : '=';
  const label = `${hidden ? '?' : l}  ${sign}  ${hidden ? '?' : r}`, fs = S * 0.95;
  c.save();
  c.font = `800 ${fs}px ${FONT}`;
  const pw = c.measureText(label).width + fs * 1.2;
  c.restore();
  rrect(c, X - pw / 2, g.oy + S * 0.25, pw, fs * 1.45, fs * 0.5);
  c.save();
  c.fillStyle = 'rgba(255,255,255,0.92)';
  c.fill();
  c.strokeStyle = '#92400e';
  c.lineWidth = Math.max(1.5, S * 0.06);
  c.stroke();
  c.restore();
  text(c, label, X, g.oy + S * 0.25 + fs * 0.75, fs, '#1f2937', 800);
}
/** Το χρώμα κάθε αριθμού ως το 10 (το 7 είναι ουράνιο τόξο, το 10 άσπρο με κόκκινο περίγραμμα). */
const NC_NUM = ['', '#ef4444', '#f97316', '#facc15', '#22c55e', '#22d3ee', '#8b5cf6', '', '#ec4899', '#9ca3af', '#ffffff'];
const RAINBOW = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#6366f1', '#a855f7'];
/** Η παλέτα του 🎨: 0 = το χρώμα του αριθμού, 13 = ουράνιο τόξο. */
const NC_PAL = ['', '#ef4444', '#f97316', '#facc15', '#22c55e', '#22d3ee', '#3b82f6', '#8b5cf6', '#ec4899', '#9ca3af', '#ffffff', '#92400e', '#1f2937', ''];
/** Τα αξεσουάρ: [ομάδα (0 κεφάλι, 1 πρόσωπο, 2 άλλο· −1 = βγάζει όλα), τιμή, εικονίδιο]. Ένα από κάθε ομάδα. */
/** Τα αξεσουάρ: [ομάδα (0 κεφάλι, 1 πρόσωπο, 2 άλλο· −1 = βγάζει όλα), τιμή]. Ένα από κάθε ομάδα. */
const NC_ACC: [number, number][] = [[-1, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [1, 1], [1, 3], [2, 1], [2, 2], [2, 3], [2, 4]];
const NC_SH = [0, 3, 5], NC_MASK = [7, 3, 7];
const ncAcc = (acc: number, g: number): number => (acc >> NC_SH[g]) & NC_MASK[g];
const ncSetAcc = (acc: number, g: number, val: number): number => (acc & ~(NC_MASK[g] << NC_SH[g])) | (val << NC_SH[g]);
/** Πόσο ψηλά φτάνει κάθε καπέλο (σε πλάτη κεφαλιού), για να μπει ο αριθμός από πάνω του. */
const NC_HAT_H = [0, 0.95, 0.68, 0.32, 0.5, 0.45, 1.1];
const darker = (hex: string, k = 0.32): string => {
  const n = parseInt(hex.slice(1), 16), f = (s: number): number => Math.round(((n >> s) & 255) * (1 - k));
  return `rgb(${f(16)},${f(8)},${f(0)})`;
};
/** Γέμισμα και περίγραμμα του κυβακίου i (από κάτω, ανά στήλη). Από το 11: μια άσπρη δεκάδα και οι μονάδες με το χρώμα τους. */
function ncColour(e: NCube, i: number): [string, string] {
  let f: string;
  const one = (k: number, j: number): string => (k === 7 ? RAINBOW[6 - j] : NC_NUM[k]);
  if (e.col === 13) f = RAINBOW[i % 7];
  else if (e.col) f = NC_PAL[e.col];
  else if (e.n === 10 || (e.n > 10 && i < 10)) return ['#ffffff', '#dc2626'];
  else if (e.n === 20) return ['#ffffff', '#ea580c'];
  else f = e.n > 10 ? one(e.n - 10, i - 10) : one(e.n, i);
  return [f, f === '#ffffff' ? '#94a3b8' : darker(f)];
}
function ncGeom(w: number, h: number): { bh: number; sh: number; S: number; ox: number; oy: number } {
  const bh = h * 0.22, sh = h - bh, S = Math.min(w / NC_W, sh / NC_H);
  return { bh, sh, S, ox: (w - NC_W * S) / 2, oy: sh - NC_H * S };
}
/** Πόσα κουμπιά έχει η πάνω σειρά της μπάρας σε κάθε λειτουργία: αριθμοί 1–10 ή αξεσουάρ. */
const ncRowA = (mode: number): number => (mode === 4 ? NC_ACC.length : 10);
/** Οι λειτουργίες της κάτω σειράς: ✋ μετακίνηση/ένωση, ✂️ χώρισμα, 🔄 σχήμα, 🎩 αξεσουάρ, 🧽 σβήσιμο ενός χαρακτήρα (το 3 ήταν το βάψιμο). */
const NC_MODES = [0, 1, 2, 4, 5], NC_BTNS = ['✋', '✂️', '🔄', '🎩', '🧽'];
/** Κουμπιά της κάτω σειράς μετά τις λειτουργίες (0–4): 🔢, ⚖️ ζυγαριά, 🗑️, όλη η οθόνη. */
const B_NUM = 5, B_SCALE = 6, B_TRASH = 7, B_FULL = 8, NC_BAR = 9;
/** ⚖️: η ζυγαριά μπαίνει (όσοι στέκονται πάνω από μια πιατέλα ανεβαίνουν πάνω της) ή φεύγει (κατεβαίνουν στο γρασίδι). */
function ncScaleToggle(s: NCState): void {
  s.flags ^= S_SCALE;
  for (const e of s.cubes) {
    if (s.flags & S_SCALE) ncSeat(s, e);
    else if (e.f & F_PAN) {
      e.f &= ~F_PAN;
      e.y = NC_H * 10;
      ncClamp(e);
    }
  }
}
/** Το τελευταίο κόψιμο (πότε, πού): ένα δεύτερο άγγιγμα στο ίδιο σημείο αμέσως μετά (διπλή επαφή του πίνακα, παλάμη) δεν ξανακόβει. */
const ncCut = { t: -1e9, x: 0, y: 0 };
/** Κέρσορας ψαλίδι για το ✂️: οριζόντιο, οι μύτες δεξιά, εκεί που κόβει. */
const NC_SCISSORS = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><g stroke-linecap="round"><path d="M11 12 29 19M11 20 29 13" stroke="#fff" stroke-width="5"/><path d="M11 12 29 19M11 20 29 13" stroke="#111827" stroke-width="2.5"/></g><g fill="#ef4444" stroke="#7f1d1d" stroke-width="1.5"><circle cx="7" cy="10" r="4.5"/><circle cx="7" cy="22" r="4.5"/></g><g fill="#fff"><circle cx="7" cy="10" r="1.8"/><circle cx="7" cy="22" r="1.8"/></g><circle cx="20" cy="16" r="1.4" fill="#9ca3af"/></svg>')}") 29 16, crosshair`;

/** Γεμίζει και περιγράφει το τρέχον σχήμα. */
function paintPath(c: C, fill: string, line?: string, lw = 0): void {
  c.fillStyle = fill;
  c.fill();
  if (line && lw) {
    c.strokeStyle = line;
    c.lineWidth = lw;
    c.stroke();
  }
}

/** Καπέλο πάνω στο κεφάλι: κέντρο cx, κορυφή του κεφαλιού top, u = πλάτος του κεφαλιού. */
function ncHat(c: C, kind: number, cx: number, top: number, u: number): void {
  c.save();
  c.translate(cx, top);
  c.rotate(kind === 3 ? 0 : -0.07);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  const lw = Math.max(1, u * 0.04);
  if (kind === 1) {
    // ψηλό καπέλο με κόκκινη κορδέλα
    c.beginPath();
    c.moveTo(-u * 0.36, -u * 0.1);
    c.lineTo(-u * 0.32, -u * 0.9);
    c.lineTo(u * 0.32, -u * 0.9);
    c.lineTo(u * 0.36, -u * 0.1);
    c.closePath();
    paintPath(c, '#1f2937', '#0b1120', lw);
    c.fillStyle = '#dc2626';
    c.fillRect(-u * 0.35, -u * 0.32, u * 0.7, u * 0.15);
    c.beginPath();
    c.ellipse(0, -u * 0.9, u * 0.32, u * 0.06, 0, 0, Math.PI * 2);
    paintPath(c, '#374151');
    c.strokeStyle = 'rgba(255,255,255,0.22)';
    c.lineWidth = u * 0.06;
    c.beginPath();
    c.moveTo(-u * 0.22, -u * 0.8);
    c.lineTo(-u * 0.24, -u * 0.4);
    c.stroke();
    rrect(c, -u * 0.6, -u * 0.15, u * 1.2, u * 0.15, u * 0.075);
    paintPath(c, '#111827', '#0b1120', lw);
  } else if (kind === 2) {
    // χρυσή κορώνα με πετράδια
    c.beginPath();
    c.moveTo(-u * 0.44, 0);
    c.lineTo(-u * 0.48, -u * 0.5);
    c.lineTo(-u * 0.22, -u * 0.27);
    c.lineTo(0, -u * 0.62);
    c.lineTo(u * 0.22, -u * 0.27);
    c.lineTo(u * 0.48, -u * 0.5);
    c.lineTo(u * 0.44, 0);
    c.closePath();
    paintPath(c, '#facc15', '#b45309', lw * 1.2);
    c.fillStyle = '#fde68a';
    c.fillRect(-u * 0.43, -u * 0.16, u * 0.86, u * 0.08);
    for (const [x, y, col] of [[-0.48, -0.5, '#ef4444'], [0, -0.62, '#3b82f6'], [0.48, -0.5, '#22c55e'], [0, -0.12, '#ef4444']] as const) {
      c.beginPath();
      c.arc(x * u, y * u, u * 0.07, 0, Math.PI * 2);
      paintPath(c, col, '#7c2d12', lw * 0.6);
    }
    c.fillStyle = 'rgba(255,255,255,0.7)';
    c.beginPath();
    c.arc(-u * 0.2, -u * 0.36, u * 0.035, 0, Math.PI * 2);
    c.fill();
  } else if (kind === 3) {
    // φιόγκος στο πλάι
    c.translate(u * 0.3, 0);
    c.rotate(0.35);
    for (const sx of [-1, 1]) {
      c.beginPath();
      c.moveTo(0, 0);
      c.bezierCurveTo(sx * u * 0.12, -u * 0.32, sx * u * 0.42, -u * 0.26, sx * u * 0.38, -u * 0.02);
      c.bezierCurveTo(sx * u * 0.36, u * 0.18, sx * u * 0.12, u * 0.12, 0, 0);
      paintPath(c, '#ec4899', '#9d174d', lw);
      c.strokeStyle = 'rgba(255,255,255,0.45)';
      c.lineWidth = lw;
      c.beginPath();
      c.moveTo(sx * u * 0.1, -u * 0.08);
      c.quadraticCurveTo(sx * u * 0.22, -u * 0.2, sx * u * 0.3, -u * 0.1);
      c.stroke();
    }
    c.beginPath();
    c.ellipse(0, 0, u * 0.09, u * 0.11, 0, 0, Math.PI * 2);
    paintPath(c, '#f472b6', '#9d174d', lw);
  } else if (kind === 4) {
    // τζόκεϊ με γείσο προς τα δεξιά
    c.beginPath();
    c.ellipse(u * 0.48, -u * 0.02, u * 0.3, u * 0.075, 0, 0, Math.PI * 2);
    paintPath(c, '#1d4ed8', '#1e3a8a', lw);
    c.beginPath();
    c.arc(0, 0, u * 0.46, Math.PI, 0);
    c.closePath();
    paintPath(c, '#2563eb', '#1e3a8a', lw);
    c.strokeStyle = '#1e3a8a';
    c.lineWidth = lw * 0.8;
    c.beginPath();
    c.moveTo(0, -u * 0.46);
    c.quadraticCurveTo(-u * 0.12, -u * 0.2, -u * 0.1, 0);
    c.moveTo(0, -u * 0.46);
    c.quadraticCurveTo(u * 0.12, -u * 0.2, u * 0.1, 0);
    c.stroke();
    c.fillStyle = '#fde047';
    c.fillRect(-u * 0.46, -u * 0.1, u * 0.92, u * 0.07);
    c.beginPath();
    c.arc(0, -u * 0.46, u * 0.06, 0, Math.PI * 2);
    paintPath(c, '#1e3a8a');
  } else if (kind === 5) {
    // καπέλο αποφοίτησης με φούντα
    c.beginPath();
    c.moveTo(-u * 0.32, 0);
    c.lineTo(-u * 0.3, -u * 0.24);
    c.lineTo(u * 0.3, -u * 0.24);
    c.lineTo(u * 0.32, 0);
    c.closePath();
    paintPath(c, '#111827');
    c.beginPath();
    c.moveTo(0, -u * 0.44);
    c.lineTo(u * 0.64, -u * 0.29);
    c.lineTo(0, -u * 0.14);
    c.lineTo(-u * 0.64, -u * 0.29);
    c.closePath();
    paintPath(c, '#1f2937', '#030712', lw);
    c.strokeStyle = '#facc15';
    c.lineWidth = Math.max(1, u * 0.04);
    c.beginPath();
    c.moveTo(0, -u * 0.29);
    c.lineTo(u * 0.46, -u * 0.25);
    c.lineTo(u * 0.47, u * 0.02);
    c.stroke();
    c.beginPath();
    c.ellipse(u * 0.47, u * 0.06, u * 0.05, u * 0.09, 0, 0, Math.PI * 2);
    paintPath(c, '#facc15');
    c.beginPath();
    c.arc(0, -u * 0.29, u * 0.05, 0, Math.PI * 2);
    paintPath(c, '#facc15');
  } else if (kind === 6) {
    // καπέλο πάρτι με ρίγες και φουντίτσα
    c.beginPath();
    c.moveTo(-u * 0.32, 0);
    c.lineTo(u * 0.03, -u * 0.98);
    c.lineTo(u * 0.32, 0);
    c.closePath();
    c.save();
    c.clip();
    c.fillStyle = '#8b5cf6';
    c.fillRect(-u * 0.4, -u, u * 0.8, u);
    c.strokeStyle = '#facc15';
    c.lineWidth = u * 0.09;
    for (let i = -3; i <= 3; i++) {
      c.beginPath();
      c.moveTo(-u * 0.5 + i * u * 0.25, 0);
      c.lineTo(u * 0.1 + i * u * 0.25, -u);
      c.stroke();
    }
    c.restore();
    c.beginPath();
    c.moveTo(-u * 0.32, 0);
    c.lineTo(u * 0.03, -u * 0.98);
    c.lineTo(u * 0.32, 0);
    c.closePath();
    c.strokeStyle = '#5b21b6';
    c.lineWidth = lw;
    c.stroke();
    c.beginPath();
    c.arc(u * 0.03, -u * 1.0, u * 0.1, 0, Math.PI * 2);
    paintPath(c, '#f472b6', '#9d174d', lw);
  }
  c.restore();
}

function ncGlasses(c: C, cx: number, ey: number, ex: number, r: number, S: number): void {
  c.save();
  c.lineWidth = Math.max(1.5, S * 0.055);
  c.strokeStyle = '#111827';
  for (const sx of [-1, 1]) {
    c.beginPath();
    c.arc(cx + sx * ex, ey, r, 0, Math.PI * 2);
    c.fillStyle = 'rgba(191,219,254,0.35)';
    c.fill();
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.8)';
    c.lineWidth = Math.max(1, S * 0.03);
    c.beginPath();
    c.arc(cx + sx * ex, ey, r * 0.7, Math.PI * 1.1, Math.PI * 1.4);
    c.stroke();
    c.strokeStyle = '#111827';
    c.lineWidth = Math.max(1.5, S * 0.055);
  }
  c.beginPath();
  c.moveTo(cx - ex + r, ey - r * 0.15);
  c.quadraticCurveTo(cx, ey - r * 0.6, cx + ex - r, ey - r * 0.15);
  c.stroke();
  c.restore();
}

function ncMoustache(c: C, cx: number, my: number, mw: number, S: number): void {
  c.save();
  c.fillStyle = '#4a2c12';
  for (const sx of [-1, 1]) {
    c.beginPath();
    c.moveTo(cx, my - S * 0.03);
    c.bezierCurveTo(cx + sx * mw * 0.4, my - S * 0.12, cx + sx * mw * 0.8, my - S * 0.05, cx + sx * mw, my - S * 0.11);
    c.bezierCurveTo(cx + sx * mw * 1.05, my - S * 0.02, cx + sx * mw * 0.75, my + S * 0.07, cx + sx * mw * 0.45, my + S * 0.05);
    c.quadraticCurveTo(cx + sx * mw * 0.2, my + S * 0.05, cx, my + S * 0.02);
    c.closePath();
    c.fill();
  }
  c.restore();
}

/** Πατίνι: το κατάστρωμα στο έδαφος, το τιμόνι ψηλά (ως το postTop). */
function ncScooter(c: C, cx: number, ground: number, L: number, S: number, postTop: number): void {
  c.save();
  c.lineCap = 'round';
  const dy = ground - S * 0.3, fx = cx + L / 2 - S * 0.05;
  c.strokeStyle = '#94a3b8';
  c.lineWidth = Math.max(2, S * 0.09);
  c.beginPath();
  c.moveTo(fx - S * 0.05, dy);
  c.lineTo(fx + S * 0.02, postTop);
  c.moveTo(fx - S * 0.2, postTop);
  c.lineTo(fx + S * 0.24, postTop);
  c.stroke();
  c.strokeStyle = '#ef4444';
  c.lineWidth = Math.max(2.5, S * 0.12);
  c.beginPath();
  c.moveTo(fx - S * 0.22, postTop);
  c.lineTo(fx - S * 0.12, postTop);
  c.moveTo(fx + S * 0.16, postTop);
  c.lineTo(fx + S * 0.26, postTop);
  c.stroke();
  rrect(c, cx - L / 2, dy - S * 0.06, L - S * 0.05, S * 0.13, S * 0.06);
  paintPath(c, '#0ea5e9', '#0369a1', Math.max(1, S * 0.04));
  for (const x of [cx - L / 2 + S * 0.14, fx]) {
    c.beginPath();
    c.arc(x, ground - S * 0.14, S * 0.14, 0, Math.PI * 2);
    paintPath(c, '#1f2937');
    c.beginPath();
    c.arc(x, ground - S * 0.14, S * 0.05, 0, Math.PI * 2);
    paintPath(c, '#cbd5e1');
  }
  c.restore();
}

function ncSkate(c: C, cx: number, ground: number, L: number, S: number): void {
  c.save();
  const dy = ground - S * 0.32;
  c.beginPath();
  c.moveTo(cx - L / 2, dy - S * 0.1);
  c.quadraticCurveTo(cx - L / 2 + S * 0.05, dy + S * 0.06, cx - L / 2 + S * 0.25, dy + S * 0.06);
  c.lineTo(cx + L / 2 - S * 0.25, dy + S * 0.06);
  c.quadraticCurveTo(cx + L / 2 - S * 0.05, dy + S * 0.06, cx + L / 2, dy - S * 0.1);
  c.lineTo(cx + L / 2 - S * 0.06, dy - S * 0.04);
  c.lineTo(cx - L / 2 + S * 0.06, dy - S * 0.04);
  c.closePath();
  paintPath(c, '#f97316', '#9a3412', Math.max(1, S * 0.04));
  c.fillStyle = '#fde68a';
  c.fillRect(cx - L * 0.2, dy - S * 0.03, L * 0.4, S * 0.04);
  for (const x of [cx - L / 2 + S * 0.3, cx + L / 2 - S * 0.3]) {
    c.fillStyle = '#64748b';
    c.fillRect(x - S * 0.12, dy + S * 0.05, S * 0.24, S * 0.06);
    for (const dx of [-0.1, 0.1]) {
      c.beginPath();
      c.arc(x + dx * S, ground - S * 0.1, S * 0.1, 0, Math.PI * 2);
      paintPath(c, '#facc15', '#a16207', Math.max(1, S * 0.03));
    }
  }
  c.restore();
}

/** Μπαλόνι με γυαλάδα και κομπάκι, και σπαγκάκι που κατεβαίνει με καμπύλη ως το χέρι (hx, hy). */
function ncBalloon(c: C, bx: number, by: number, S: number, hx: number, hy: number): void {
  c.save();
  const rx = S * 0.4, ry = S * 0.5;
  c.strokeStyle = '#64748b';
  c.lineWidth = Math.max(1, S * 0.03);
  c.beginPath();
  c.moveTo(bx, by + ry + S * 0.08);
  c.bezierCurveTo(bx - S * 0.25, by + ry + S * 0.45, hx + S * 0.25, hy - S * 0.4, hx, hy);
  c.stroke();
  c.beginPath();
  c.moveTo(bx, by + ry - S * 0.02);
  c.lineTo(bx - S * 0.08, by + ry + S * 0.1);
  c.lineTo(bx + S * 0.08, by + ry + S * 0.1);
  c.closePath();
  paintPath(c, '#dc2626');
  c.beginPath();
  c.moveTo(bx, by + ry);
  c.bezierCurveTo(bx - rx * 1.35, by + ry * 0.5, bx - rx * 1.25, by - ry * 1.05, bx, by - ry);
  c.bezierCurveTo(bx + rx * 1.25, by - ry * 1.05, bx + rx * 1.35, by + ry * 0.5, bx, by + ry);
  paintPath(c, '#ef4444', '#b91c1c', Math.max(1, S * 0.035));
  c.fillStyle = 'rgba(255,255,255,0.55)';
  c.beginPath();
  c.ellipse(bx - rx * 0.4, by - ry * 0.45, rx * 0.18, ry * 0.3, -0.5, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/** Κάπα πίσω από το σώμα: από τους ώμους (x0..x1, ύψος y0) ως κάτω (y1), με κυματιστή άκρη. */
function ncCape(c: C, x0: number, x1: number, y0: number, y1: number, S: number, wave = 0): void {
  c.save();
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y0);
  // wave: η κάπα ανεμίζει (στο πέταγμα), τα κάτω άκρα πάνε πέρα δώθε
  c.quadraticCurveTo(x1 + S * 0.3, (y0 + y1) / 2, x1 + S * 0.5 + wave, y1 - Math.abs(wave) * 0.5);
  const w = x1 - x0 + S, n = 3;
  for (let i = 0; i < n; i++) {
    const xa = x1 + S * 0.5 - (w * (i + 0.5)) / n + wave, xb = x1 + S * 0.5 - (w * (i + 1)) / n + wave * (i % 2 ? 1 : -0.6);
    c.quadraticCurveTo(xa, y1 - S * 0.18, xb, y1);
  }
  c.quadraticCurveTo(x0 - S * 0.3, (y0 + y1) / 2, x0, y0);
  c.closePath();
  paintPath(c, '#dc2626', '#991b1b', Math.max(1, S * 0.04));
  c.strokeStyle = 'rgba(127,29,29,0.45)';
  c.lineWidth = Math.max(1, S * 0.04);
  c.beginPath();
  c.moveTo((x0 + x1) / 2, y0 + S * 0.2);
  c.lineTo((x0 + x1) / 2 - S * 0.15, y1 - S * 0.15);
  c.stroke();
  c.restore();
}

/** Το εικονίδιο ενός αξεσουάρ στην παλέτα (ίδιο σχέδιο με αυτό που φοριέται). */
function ncAccIcon(c: C, item: number, cx: number, cy: number, s: number): void {
  const [gp, val] = NC_ACC[item];
  if (gp < 0) return text(c, '🚫', cx, cy + 1, s * 0.8);
  if (gp === 0) {
    const u = s * Math.min(0.95, 0.85 / Math.max(NC_HAT_H[val], 0.6));
    return ncHat(c, val, val === 3 ? cx - u * 0.3 : cx, cy + (NC_HAT_H[val] * u) / 2, u);
  }
  if (gp === 1 && val === 1) return ncGlasses(c, cx, cy, s * 0.27, s * 0.21, s * 0.8);
  if (gp === 1) return ncMoustache(c, cx, cy + s * 0.05, s * 0.48, s * 1.1);
  if (val === 1) return ncScooter(c, cx, cy + s * 0.42, s * 0.8, s * 0.5, cy - s * 0.38);
  if (val === 2) return ncSkate(c, cx, cy + s * 0.2, s * 0.95, s * 0.6);
  if (val === 3) return ncBalloon(c, cx + s * 0.08, cy - s * 0.12, s * 0.6, cx - s * 0.12, cy + s * 0.45);
  return ncCape(c, cx - s * 0.18, cx + s * 0.18, cy - s * 0.35, cy + s * 0.4, s * 0.55);
}

const easeBounce = (t: number): number => {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};

/** Μικρό αστεράκι τεσσάρων ακτίνων. */
function sparkle(c: C, x: number, y: number, r: number, col: string): void {
  c.beginPath();
  c.moveTo(x, y - r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.quadraticCurveTo(x, y, x, y + r);
  c.quadraticCurveTo(x, y, x - r, y);
  c.quadraticCurveTo(x, y, x, y - r);
  c.fillStyle = col;
  c.fill();
}

/** Κίνηση ενός χαρακτήρα: p = πρόοδος 0–1, drop = η ομάδα του αξεσουάρ που μόλις μπήκε (−1 καμία), pop = μόλις ενώθηκε. */
interface NcAnim { p: number; drop: number; pop: boolean }
/** Όσο κρατά η κίνηση: το αξεσουάρ πέφτει στο πρώτο 25%, μετά κάνει το «κόλπο» του. */
const NC_ANIM_MS = 2000;
/** Ποιοι χαρακτήρες κινούνται μετά από μια αλλαγή: όσοι πήραν αξεσουάρ ή μεγάλωσαν (ένωση), στην ίδια θέση με πριν. */
function ncAnims(prev: number[], cur: NCube[], t: number): (NcAnim | null)[] {
  const before = ncState(prev).cubes, p = Math.min(1, t / NC_ANIM_MS);
  return cur.map((e) => {
    const o = before.find((q) => q.x === e.x && q.y === e.y && !(q.f & F_HELD));
    if (!o || p >= 1) return null;
    if (e.n > o.n) return { p, drop: -1, pop: true };
    if (e.acc === o.acc) return null;
    let drop = -1;
    for (let g = 0; g < 3; g++) if (ncAcc(e.acc, g) && ncAcc(e.acc, g) !== ncAcc(o.acc, g)) drop = g;
    return { p, drop, pop: false };
  });
}

function ncDraw(c: C, g: { S: number; ox: number; oy: number }, e: NCube, hidden: boolean, an: NcAnim | null = null): void {
  const S = g.S, C2 = ncCols(e), H = e.h, head = ncAcc(e.acc, 0), face = ncAcc(e.acc, 1), extra = ncAcc(e.acc, 2);
  // το σώμα πατά σε δύο ποδαράκια· πάνω σε πατίνι ή σκέιτ ανεβαίνει λίγο ακόμα
  const ground = g.oy + (e.y / 10) * S, by = ground - S * 0.26 - (extra === 1 || extra === 2 ? S * 0.36 : 0);
  const bx = g.ox + (e.x / 10 - C2 / 2) * S, top = by - H * S;
  const fc = Math.max(1, Math.floor(e.n / H)), fw = Math.min(fc, 3) * S, fcx = bx + fw / 2;
  const k = Math.min(fw / S, 2), hu = S * Math.min(k, 1.6);
  // κίνηση: στην ένωση ένα χοπ· ένα νέο αξεσουάρ πέφτει από ψηλά (πρώτο 25%) και μετά κάνει το «κόλπο» του (q: 0 → 1)
  const p = an?.p ?? 1, land = Math.min(1, p / 0.25), q = an && an.drop >= 0 && p > 0.25 ? (p - 0.25) / 0.75 : -1;
  const trick = q >= 0 ? an!.drop * 10 + ncAcc(e.acc, an!.drop) : 0, bell = q >= 0 ? Math.sin(Math.PI * q) : 0;
  const fall = (grp: number): number => (an && an.drop === grp ? -(1 - easeBounce(land)) * S * 3 : 0);
  let dx = 0, lift = an?.pop && p < 0.5 ? Math.sin((Math.PI * p) / 0.5) * S * 0.5 : 0, sway = 0;
  // 🎈 σηκώνει τον χαρακτήρα (τους μικρούς πιο ψηλά) · 🛴 🛹 βόλτα (το σκέιτ και με πηδηματάκι) · 🦸 πέταγμα · 🎀 κούνημα
  if (trick === 23) { lift = bell * S * (e.n <= 3 ? 3.6 : e.n <= 6 ? 2 : e.n <= 10 ? 0.9 : 0.35); dx = Math.sin(q * Math.PI * 3) * S * 0.18 * bell; }
  if (trick === 21 || trick === 22) dx = bell * S * 2.6;
  if (trick === 22 && q > 0.38 && q < 0.62) lift = Math.sin((Math.PI * (q - 0.38)) / 0.24) * S * 0.9;
  if (trick === 24) { lift = bell * S * 2.4; dx = bell * S * 0.8; sway = bell * 0.18; }
  if (trick === 3) sway = Math.sin(q * Math.PI * 6) * 0.14 * (1 - q);
  const cx0 = bx + (C2 * S) / 2;
  c.save();
  if (e.f & F_TRASH) c.globalAlpha = 0.4;
  c.fillStyle = 'rgba(15,23,42,0.13)';
  c.beginPath();
  c.ellipse(cx0 + dx, ground, C2 * S * 0.62 * Math.max(0.4, 1 - lift / (S * 4)), S * 0.14, 0, 0, Math.PI * 2);
  c.fill();
  // γραμμές ταχύτητας πίσω από πατίνι και σκέιτ
  if (trick === 21 || trick === 22) {
    const dir = Math.cos(Math.PI * q), back = dir > 0 ? bx + dx - S * 0.3 : bx + dx + C2 * S + S * 0.3;
    c.save();
    c.globalAlpha *= Math.min(1, Math.abs(dir) * 1.5);
    c.strokeStyle = '#64748b';
    c.lineWidth = Math.max(1.5, S * 0.06);
    c.lineCap = 'round';
    c.beginPath();
    for (const [yy, ll] of [[0.55, 1], [0.95, 0.7], [1.35, 0.85]]) {
      const y = ground - lift - S * yy, sx = dir > 0 ? -1 : 1;
      c.moveTo(back, y);
      c.lineTo(back + sx * S * ll, y);
    }
    c.stroke();
    c.restore();
  }
  c.translate(dx, -lift);
  if (sway) {
    c.translate(cx0, ground);
    c.rotate(sway);
    c.translate(-cx0, -ground);
  }
  c.lineCap = 'round';
  c.lineJoin = 'round';
  if (extra === 4) {
    c.save();
    c.translate(0, fall(2));
    ncCape(c, bx + S * 0.12, bx + fw - S * 0.12, top + S * 0.8, by + S * 0.05, S, trick === 24 ? Math.sin(q * Math.PI * 8) * S * 0.25 * bell - bell * S * 0.6 : 0);
    c.restore();
  }
  // χέρια: στο δεύτερο κυβάκι από πάνω (στο μοναδικό, όταν το σχήμα έχει ύψος ένα)
  const ay = top + S * (H > 1 ? 1.4 : 0.62), arow = H - 1 - Math.floor((ay - top) / S);
  let rc = 0;
  for (let i = 0; i < C2; i++) if (Math.min(H, e.n - i * H) > arow) rc = i;
  const armCol = ncColour(e, Math.min(e.n - 1, H - 1))[1], ax = bx + (rc + 1) * S;
  // στο πέταγμα με το μπαλόνι ή την κάπα το χέρι σηκώνεται ψηλά
  const up = extra === 3 || trick === 24;
  const hands: [number, number][] = [[bx - S * 0.32, ay + S * 0.3], [ax + S * 0.32, ay + (up ? -S * 0.3 : S * 0.3)]];
  c.strokeStyle = armCol;
  c.fillStyle = armCol;
  c.lineWidth = Math.max(2, S * 0.11);
  c.beginPath();
  c.moveTo(bx, ay);
  c.lineTo(...hands[0]);
  c.moveTo(ax, ay);
  c.lineTo(...hands[1]);
  c.stroke();
  for (const [hx, hy] of hands) {
    c.beginPath();
    c.arc(hx, hy, S * 0.1, 0, Math.PI * 2);
    c.fill();
  }
  // ποδαράκια, στο χρώμα του κάτω κυβακίου
  const foot = ncColour(e, 0)[1], fx0 = bx + Math.min(C2, 2) * S / 2, fd = Math.min(C2, 2) * S * 0.24;
  c.fillStyle = foot;
  c.strokeStyle = foot;
  c.lineWidth = Math.max(2.5, S * 0.11);
  for (const sx of [-1, 1]) {
    c.beginPath();
    c.moveTo(fx0 + sx * fd, by - S * 0.05);
    c.lineTo(fx0 + sx * fd, by + S * 0.16);
    c.stroke();
    c.beginPath();
    c.ellipse(fx0 + sx * (fd + S * 0.07), by + S * 0.18, S * 0.19, S * 0.09, 0, 0, Math.PI * 2);
    c.fill();
  }
  // τα κυβάκια
  c.lineWidth = Math.max(1.5, S * 0.06);
  for (let i = 0; i < e.n; i++) {
    const [fill, line] = ncColour(e, i);
    const x = bx + Math.floor(i / H) * S, y = by - ((i % H) + 1) * S;
    rrect(c, x + 0.5, y + 0.5, S - 1, S - 1, S * 0.12);
    c.fillStyle = fill;
    c.fill();
    c.strokeStyle = line;
    c.stroke();
  }
  // πρόσωπο στην πάνω σειρά, πάνω σε όσες γεμάτες στήλες χωρούν (ως τρεις)
  const er = S * 0.15 * Math.sqrt(k), ey = top + S * 0.42, ex = Math.min(fw, 2 * S) * 0.2;
  // τα γυαλιά γλιστράνε λίγο και ξανανεβαίνουν· το μουστάκι κουνιέται πάνω κάτω
  const happy = an?.pop || q >= 0;
  for (const sx of [-1, 1]) {
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.ellipse(fcx + sx * ex, ey, er * 0.85, er, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#111827';
    c.beginPath();
    c.arc(fcx + sx * ex + er * 0.12, ey + er * 0.18, er * 0.48, 0, Math.PI * 2);
    c.fill();
  }
  c.strokeStyle = '#111827';
  c.lineWidth = Math.max(1.5, S * 0.06);
  c.beginPath();
  c.moveTo(fcx - ex * 0.55, top + S * 0.7);
  c.quadraticCurveTo(fcx, top + S * (happy ? 0.95 : 0.86), fcx + ex * 0.55, top + S * 0.7);
  c.stroke();
  c.save();
  c.translate(0, fall(1) + (trick === 11 ? bell * S * 0.22 : 0));
  if (face === 1) ncGlasses(c, fcx, ey, ex, er * 1.3, S);
  else if (face === 3) {
    const my = top + S * 0.66;
    c.translate(fcx, my);
    if (trick === 13) c.rotate(Math.sin(q * Math.PI * 8) * 0.12 * bell);
    c.translate(0, trick === 13 ? -Math.abs(Math.sin(q * Math.PI * 8)) * S * 0.06 : 0);
    ncMoustache(c, 0, 0, ex * 0.95, S);
  }
  c.restore();
  c.save();
  c.translate(0, fall(2));
  const L = Math.max(C2 * S * 1.15, S * 1.5);
  if (extra === 1) ncScooter(c, cx0, ground, L, S, Math.max(top + S * 0.9, ay));
  else if (extra === 2) ncSkate(c, cx0, ground, L, S);
  else if (extra === 3) ncBalloon(c, ax + S * 0.75, top - S * 0.75 - bell * S * 0.3, S, ...hands[1]);
  c.restore();
  if (head) {
    // 🎩 χαιρετισμός · 🧢 στροφή · 🎓 πετιέται στον αέρα και πέφτει πίσω στο κεφάλι
    c.save();
    c.translate(fcx, top + S * 0.04 + fall(0));
    if (trick === 1) { c.translate(-hu * 0.3 * bell, -hu * 0.5 * bell); c.rotate(-0.55 * bell); }
    if (trick === 4) c.scale(Math.cos(q * Math.PI * 2), 1);
    if (trick === 5) { c.translate(0, -bell * S * 2.8); c.rotate(q * Math.PI * 2); }
    ncHat(c, head, 0, 0, hu);
    c.restore();
  }
  // ο αριθμός, πάνω από το κεφάλι (και πάνω από το καπέλο)
  const ny = top - S * 0.5 - (head ? hu * NC_HAT_H[head] : 0), nr = S * 0.36;
  c.beginPath();
  c.arc(fcx, ny, nr, 0, Math.PI * 2);
  c.fillStyle = '#ffffff';
  c.fill();
  c.strokeStyle = '#334155';
  c.lineWidth = Math.max(1.5, S * 0.05);
  c.stroke();
  text(c, hidden ? '?' : String(e.n), fcx, ny + 1, nr * (e.n > 9 && !hidden ? 1.05 : 1.25), '#1f2937', 800);
  // 🥳 κομφετί από την κορυφή του καπέλου
  if (trick === 6) {
    const tx = fcx + hu * 0.03, ty = top - hu;
    const cols = ['#ef4444', '#facc15', '#22c55e', '#3b82f6', '#ec4899', '#a855f7'];
    c.save();
    c.globalAlpha *= 1 - q;
    for (let i = 0; i < 16; i++) {
      const a = -Math.PI / 2 + (i / 15 - 0.5) * 2.2, v = S * (1.6 + (i % 3) * 0.6);
      c.save();
      c.translate(tx + Math.cos(a) * v * q, ty + Math.sin(a) * v * q + S * 3 * q * q);
      c.rotate(i + q * 8);
      c.fillStyle = cols[i % cols.length];
      c.fillRect(-S * 0.1, -S * 0.055, S * 0.2, S * 0.11);
      c.restore();
    }
    c.restore();
  }
  // 👑 η κορώνα λάμπει
  if (trick === 2) {
    c.save();
    c.globalAlpha *= bell;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + q * 4;
      sparkle(c, fcx + Math.cos(a) * hu * 0.75, top - hu * 0.35 + Math.sin(a) * hu * 0.45, S * 0.14 * (0.6 + 0.4 * Math.sin(q * 20 + i)), '#facc15');
    }
    c.restore();
  }
  // αστεράκια γύρω από το κεφάλι: στην ένωση, και τη στιγμή που προσγειώνεται το αξεσουάρ
  const sp = an?.pop ? p : an && an.drop >= 0 && p > 0.2 && p < 0.55 ? (p - 0.2) / 0.35 : -1;
  if (sp >= 0) {
    c.globalAlpha *= 1 - sp;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.3, r = S * (0.7 + sp * 1.3);
      sparkle(c, fcx + Math.cos(a) * r, top + S * 0.2 + Math.sin(a) * r * 0.8, S * 0.16 * (1 - sp * 0.5), i % 2 ? '#facc15' : '#f472b6');
    }
  }
  c.restore();
}

/** Το τοπίο πίσω από τους χαρακτήρες: ήλιος, σύννεφα, λόφοι, δεντράκια και λουλουδάκια, απαλά για να ξεχωρίζουν τα κυβάκια. */
function ncScenery(c: C, w: number, g: { sh: number; S: number; ox: number; oy: number }): void {
  const S = g.S, X = (u: number): number => g.ox + u * S, Y = (u: number): number => g.oy + u * S;
  c.save();
  // ήλιος
  c.fillStyle = '#fde68a';
  c.beginPath();
  c.arc(X(25.3), Y(1.9), S * 1.6, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#fcd34d';
  c.beginPath();
  c.arc(X(25.3), Y(1.9), S * 1.1, 0, Math.PI * 2);
  c.fill();
  // σύννεφα
  c.fillStyle = '#ffffff';
  for (const [cx, cy, k] of [[3.5, 1.6, 1], [11.5, 2.6, 0.8], [19, 1.2, 1.15], [8, 5.2, 0.6]]) {
    c.beginPath();
    for (const [dx, dy, r] of [[-1.1, 0.25, 0.75], [-0.3, -0.2, 1], [0.7, 0, 0.85], [1.4, 0.3, 0.6]]) {
      c.moveTo(X(cx + dx * k) + r * k * S, Y(cy + dy * k));
      c.arc(X(cx + dx * k), Y(cy + dy * k), r * k * S, 0, Math.PI * 2);
    }
    c.rect(X(cx - 1.1 * k), Y(cy + 0.25 * k), 2.5 * k * S, 0.6 * k * S);
    c.fill();
  }
  // λόφοι στο βάθος
  for (const [cx, rx, ry, col] of [[4, 9, 2.6, '#bbf7d0'], [17, 11, 3.4, '#a7f3d0'], [28, 8, 2.2, '#bbf7d0']] as const) {
    c.fillStyle = col;
    c.beginPath();
    c.ellipse(X(cx), g.sh, rx * S, ry * S, 0, Math.PI, 0);
    c.fill();
  }
  // δεντράκια
  for (const [tx, k] of [[1.6, 1], [13.2, 0.75], [23.2, 1.1], [26.6, 0.8]]) {
    const base = g.sh - S * 0.1;
    c.fillStyle = '#a16207';
    c.fillRect(X(tx) - S * 0.18 * k, base - S * 1.6 * k, S * 0.36 * k, S * 1.6 * k);
    c.fillStyle = '#4ade80';
    c.beginPath();
    for (const [dx, dy, r] of [[0, -2.5, 1], [-0.7, -1.8, 0.75], [0.7, -1.8, 0.75]]) {
      c.moveTo(X(tx + dx * k) + r * k * S, base + dy * k * S);
      c.arc(X(tx + dx * k), base + dy * k * S, r * k * S, 0, Math.PI * 2);
    }
    c.fill();
  }
  // λουλουδάκια στο γρασίδι
  for (const [fx, col] of [[6.2, '#f472b6'], [10.4, '#facc15'], [16.6, '#f87171'], [20.4, '#c084fc'], [24.8, '#facc15']] as const) {
    const fy = g.sh - S * 0.35;
    c.strokeStyle = '#16a34a';
    c.lineWidth = Math.max(1, S * 0.05);
    c.beginPath();
    c.moveTo(X(fx), fy);
    c.lineTo(X(fx), g.sh - S * 0.05);
    c.stroke();
    c.fillStyle = col;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      c.beginPath();
      c.arc(X(fx) + Math.cos(a) * S * 0.1, fy + Math.sin(a) * S * 0.1, S * 0.08, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = '#fef08a';
    c.beginPath();
    c.arc(X(fx), fy, S * 0.06, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

/** Μικρό κυβάκι της παλέτας: το χρώμα του αριθμού (ή της παλέτας) με τον αριθμό μέσα. */
function ncChip(c: C, cx: number, cy: number, s: number, fills: string[], line: string, label: string): void {
  c.save();
  rrect(c, cx - s / 2, cy - s / 2, s, s, s * 0.16);
  c.clip();
  fills.forEach((f, i) => {
    c.fillStyle = f;
    c.fillRect(cx - s / 2, cy - s / 2 + (i * s) / fills.length, s, s / fills.length + 1);
  });
  c.restore();
  c.save();
  rrect(c, cx - s / 2, cy - s / 2, s, s, s * 0.16);
  c.strokeStyle = line;
  c.lineWidth = Math.max(1.5, s * 0.06);
  c.stroke();
  c.restore();
  if (label) {
    c.save();
    c.font = `800 ${s * 0.5}px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineWidth = Math.max(2, s * 0.08);
    c.strokeStyle = '#ffffff';
    c.strokeText(label, cx, cy + 1);
    c.fillStyle = '#1f2937';
    c.fillText(label, cx, cy + 1);
    c.restore();
  }
}

/** Ο χαρακτήρας που μόλις αφέθηκε: στον κάδο σβήνεται, πάνω σε άλλον ενώνονται (ως το 20), αλλιώς μένει εκεί. */
export function ncDrop(v: number[]): { v: number[]; ev: string } | null {
  const s = ncState(v), j = s.cubes.findIndex((e) => e.f & F_HELD);
  if (j < 0) return null;
  const e = s.cubes[j], fresh = e.f & F_FRESH;
  if (e.f & F_TRASH) {
    s.cubes.splice(j, 1);
    return { v: ncPack(s), ev: 'wipe' };
  }
  e.f = 0;
  const b = ncBox(e), th = ncTilt(s.cubes);
  let best = -1, area = 0;
  s.cubes.forEach((o, i) => {
    if (i === j) return;
    // ενώνονται και όταν αφήνεις τον έναν πάνω στο κεφάλι του άλλου (ως λίγο πάνω από το καπέλο)·
    // ένα κομμάτι που μόλις κόπηκε ακουμπά τη βάση του από πάνω: μετράει κι αυτό, για να πάει δίπλα της
    const q = ncBox(o, th), ix = Math.min(b.x1, q.x1) - Math.max(b.x0, q.x0), iy = Math.min(b.y1, q.y1) - Math.max(b.y0, q.y0 - (fresh ? 0 : 1.4));
    if (ix >= (fresh ? 0.5 : 0.4) && iy >= (fresh ? -0.1 : 0.15) && ix * Math.max(iy, 0.01) > area) { area = ix * Math.max(iy, 0.01); best = i; }
  });
  if (best >= 0 && fresh) {
    // κόπηκε με απλό πάτημα (χωρίς σύρσιμο): το κομμάτι πάει δίπλα, για να μην ξανακολλήσει αμέσως
    const o = s.cubes[best], gap = (ncCols(o) / 2 + 0.6 + ncCols(e) / 2) * 10;
    e.x = o.x + gap > (NC_W - ncCols(e) / 2) * 10 ? o.x - gap : o.x + gap;
    e.y = o.y;
    if (!ncSeat(s, e)) ncClamp(e);
    return { v: ncPack(s), ev: '' };
  }
  if (best >= 0) {
    const o = s.cubes[best], n = o.n + e.n;
    if (n > NC_MAX) {
      ncClamp(e);
      return { v: ncPack(s), ev: 'bad' };
    }
    o.n = n;
    o.h = Math.min(n, 10);
    o.col = 0;
    for (let g = 0; g < 3; g++) if (!ncAcc(o.acc, g)) o.acc = ncSetAcc(o.acc, g, ncAcc(e.acc, g));
    s.cubes.splice(j, 1);
    ncClamp(o);
    return { v: ncPack(s), ev: `num|pop|${n}` };
  }
  // πάνω στη ζυγαριά: «τοκ» και γέρνει
  if (ncSeat(s, e)) return { v: ncPack(s), ev: 'tok' };
  ncClamp(e);
  return { v: ncPack(s), ev: '' };
}

export const NUMCUBE_KIDS: Record<string, StampDef> = {
  numcubes: kid({
    label: 'Αριθμοκυβάκια', w: 960, h: 640, animMs: NC_ANIM_MS,
    init: [0, 0, 0, ...[1, 2, 3, 4, 5].flatMap((n) => [10 + n * 45, 130, n, n, 0, 0, 0])],
    drawKid(c, w, h, v, env) {
      const g = ncGeom(w, h), s = ncState(v);
      c.save();
      c.fillStyle = '#e0f2fe';
      c.fillRect(0, 0, w, g.sh);
      ncScenery(c, w, g);
      c.fillStyle = '#86efac';
      c.fillRect(0, g.sh - g.S * 0.22, w, g.S * 0.22);
      // η μπάρα: πάνω σειρά ανάλογα με τη λειτουργία, κάτω οι λειτουργίες
      c.fillStyle = '#f1f5f9';
      c.fillRect(0, g.sh, w, g.bh);
      c.restore();
      c.lineWidth = 2;
      c.strokeRect(0, 0, w, h);
      const rh = g.bh / 2, ya = g.sh + rh / 2, yb = g.sh + rh * 1.5, na = ncRowA(s.mode), sa = w / na;
      const frame = (cx: number, cy: number, ps: number): void => {
        c.save();
        c.strokeStyle = '#1f2937';
        c.lineWidth = Math.max(3, ps * 0.08);
        rrect(c, cx - ps * 0.62, cy - ps * 0.62, ps * 1.24, ps * 1.24, ps * 0.18);
        c.stroke();
        c.restore();
      };
      const ps = Math.min(sa, rh) * 0.7;
      for (let k = 0; k < na; k++) {
        const cx = sa * (k + 0.5);
        if (s.mode === 4) ncAccIcon(c, k, cx, ya, ps);
        else {
          const n = k + 1;
          ncChip(c, cx, ya, ps, n === 7 ? RAINBOW : [n === 10 ? '#ffffff' : NC_NUM[n]], n === 10 ? '#dc2626' : n === 7 ? '#475569' : darker(NC_NUM[n]), String(n));
        }
        if (s.mode === 4 && k === s.sel) frame(cx, ya, ps);
      }
      const sb = w / NC_BAR, pb = Math.min(sb, rh) * 0.62;
      for (let k = 0; k < NC_BAR; k++) {
        const cx = sb * (k + 0.5);
        if (k < B_NUM) text(c, NC_BTNS[k], cx, yb + 1, pb * 0.8);
        else if (k === B_NUM) text(c, s.flags & S_HIDDEN ? '❓' : '🔢', cx, yb + 1, pb * 0.8);
        else if (k === B_SCALE) {
          text(c, '⚖️', cx, yb + 1, pb * 0.8);
          if (s.flags & S_SCALE) frame(cx, yb, pb);
        } else if (k === B_TRASH) text(c, '🗑️', cx, yb + 1, pb * 0.8);
        else fullIcon(c, cx, yb, pb, { ...env, ink: '#1f2937' });
        if (k < B_NUM && NC_MODES[k] === s.mode) frame(cx, yb, pb);
      }
      // οι χαρακτήρες τελευταίοι: όποιος σέρνεται πάνω από τη μπάρα (προς τον 🗑️) φαίνεται
      const an = env.anim ? ncAnims(env.anim.prev, s.cubes, env.anim.t) : [];
      let th = 0;
      if (s.flags & S_SCALE) {
        // η ζυγαριά γέρνει με ένα μικρό αναπήδημα από εκεί που ήταν πριν
        th = ncTilt(s.cubes);
        if (env.anim) {
          const t0 = ncTilt(ncState(env.anim.prev).cubes);
          th = t0 + (th - t0) * easeBounce(Math.min(1, env.anim.t / 900));
        }
        ncScale(c, g, th, ncSides(s.cubes), !!(s.flags & S_HIDDEN));
      }
      s.cubes.forEach((e, i) => ncDraw(c, g, e.f & F_PAN ? { ...e, y: e.y + ncLift(e, th) * 10 } : e, !!(s.flags & S_HIDDEN), an[i]));
    },
    cursor(v, x, y, w, h) {
      const g = ncGeom(w, h), s = ncState(v);
      if (y >= g.sh) return 'pointer';
      const cx = (x - g.ox) / g.S, cy = (y - g.oy) / g.S;
      const th = ncTilt(s.cubes);
      if (!s.cubes.some((e) => { const b = ncBox(e, th); return cx >= b.x0 && cx <= b.x1 && cy >= b.y0 && cy <= b.y1; })) return null;
      return s.mode === 1 ? NC_SCISSORS : s.mode === 0 ? 'grab' : 'pointer';
    },
    fullAt(x, y, w, h) {
      const g = ncGeom(w, h);
      return y >= g.sh + g.bh / 2 && y <= h && Math.floor(x / (w / NC_BAR)) === B_FULL;
    },
    paint(v, x, y, w, h, st, first) {
      const g = ncGeom(w, h), s = ncState(v);
      const [cx, cy] = [(x - g.ox) / g.S, (y - g.oy) / g.S];
      if (!first) {
        // σύρσιμο του χαρακτήρα που κρατιέται· πάνω από τον 🗑️ θα σβηστεί όταν αφεθεί
        const e = st.j ? s.cubes[st.j - 1] : null;
        if (!e || !(e.f & F_HELD)) return null;
        e.x = Math.round((cx + st.ax) * 10);
        e.y = Math.round((cy + st.ay) * 10);
        if (Math.hypot(cx - st.sx, cy - st.sy) > 0.3) e.f &= ~F_FRESH;
        e.f = y > g.sh + g.bh / 2 && Math.floor(x / (w / NC_BAR)) === B_TRASH ? e.f | F_TRASH : e.f & ~F_TRASH;
        return ncPack(s);
      }
      st.j = 0;
      const pick = (e: NCube): number[] => {
        e.f |= F_HELD;
        s.cubes.push(e);
        Object.assign(st, { j: s.cubes.length, ax: e.x / 10 - cx, ay: e.y / 10 - cy, sx: cx, sy: cy });
        return ncPack(s);
      };
      if (y >= g.sh) {
        if (y > h || x < 0 || x > w) return null;
        if (y < g.sh + g.bh / 2) {
          const na = ncRowA(s.mode), k = Math.max(0, Math.min(na - 1, Math.floor(x / (w / na))));
          if (s.mode === 4) {
            s.sel = k;
            return ncPack(s);
          }
          // ένας νέος αριθμός βγαίνει από την παλέτα με σύρσιμο (ή με πάτημα μπαίνει στη σκηνή)
          if (s.cubes.length >= NC_ITEMS) return v;
          return pick({ x: Math.round(cx * 10), y: Math.round((cy + (k + 1) / 2) * 10), n: k + 1, h: k + 1, acc: 0, col: 0, f: 0 });
        }
        const k = Math.floor(x / (w / NC_BAR));
        if (k < B_NUM) { s.mode = NC_MODES[k]; s.sel = s.mode === 4 ? 1 : 0; }
        else if (k === B_NUM) s.flags ^= S_HIDDEN;
        else if (k === B_SCALE) ncScaleToggle(s);
        else if (k === B_TRASH) s.cubes = [];
        else return null;
        return ncPack(s);
      }
      let j = -1;
      const th = ncTilt(s.cubes);
      for (let i = s.cubes.length - 1; i >= 0 && j < 0; i--) {
        const b = ncBox(s.cubes[i], th);
        if (cx >= b.x0 && cx <= b.x1 && cy >= b.y0 && cy <= b.y1) j = i;
      }
      if (j < 0) return null;
      const e = s.cubes[j];
      if (s.mode === 1) {
        const now = performance.now();
        if (now - ncCut.t < 300 && Math.hypot(cx - ncCut.x, cy - ncCut.y) < 1.5) return v;
        Object.assign(ncCut, { t: now, x: cx, y: cy });
        // χώρισμα: το κυβάκι που πατήθηκε και όσα είναι από πάνω του (και στις επόμενες στήλες) φεύγουν μαζί
        const b = ncBox(e, th), i = Math.floor(cx - b.x0) * e.h + Math.max(0, Math.min(e.h - 1, Math.floor(b.y1 - cy)));
        if (i > 0 && i < e.n) {
          const n2 = e.n - i;
          e.n = i;
          e.h = Math.min(e.h, i);
          return pick({ x: e.x, y: Math.round(b.y1 * 10) - e.h * 10, n: n2, h: Math.min(n2, 10), acc: 0, col: e.col, f: F_FRESH });
        }
      }
      if (s.mode <= 1) {
        // από τη ζυγαριά: σηκώνεται από εκεί που φαίνεται
        if (e.f & F_PAN) {
          e.y = Math.round(ncBox(e, th).y1 * 10);
          e.f &= ~F_PAN;
        }
        s.cubes.splice(j, 1);
        return pick(e);
      }
      if (s.mode === 5) {
        // 🧽: σβήνει μόνο αυτόν τον χαρακτήρα
        s.cubes.splice(j, 1);
        return ncPack(s);
      }
      if (s.mode === 2) {
        const sh = ncShapes(e.n);
        e.h = sh[(sh.indexOf(e.h) + 1) % sh.length];
      } else {
        const [gp, val] = NC_ACC[s.sel] ?? [-1, 0];
        e.acc = gp < 0 ? 0 : ncSetAcc(e.acc, gp, ncAcc(e.acc, gp) === val ? 0 : val);
      }
      ncClamp(e);
      return ncPack(s);
    },
    drop: ncDrop,
    fx(prev, next) {
      const a = ncState(prev), b = ncState(next);
      if (a.mode !== b.mode || a.sel !== b.sel || a.flags !== b.flags) return 'click';
      const last = b.cubes[b.cubes.length - 1];
      if (b.cubes.length > a.cubes.length) return `num|${last.f & F_FRESH ? 'split' : 'pop'}|${last.n}`;
      if (b.cubes.length < a.cubes.length) return 'wipe';
      if (a.cubes.some((e) => e.f & F_HELD)) return null;
      // μόλις πιάστηκε: λέει τον αριθμό του
      if (last && last.f & F_HELD) return `num|tok|${last.n}`;
      for (let i = 0; i < b.cubes.length; i++) {
        const p = a.cubes[i], q = b.cubes[i];
        if (p.acc !== q.acc) return 'new';
        if (p.h !== q.h) return 'tok';
      }
      return null;
    },
  }),
};

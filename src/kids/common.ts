/** Κοινά για τα εργαλεία του Δημοτικού: χρώματα, κείμενο, κουμπιά και το περιβάλλον σχεδίασης. */
import type { StampDef } from '../stamps';

export type C = CanvasRenderingContext2D;

/** Χρώματα που δεν εξαρτώνται από το χρώμα της γραφής. */
export const BLUE = '#3b82f6', ORANGE = '#f97316', GREEN = '#22c55e', YELLOW = '#facc15', RED = '#ef4444', PURPLE = '#a855f7';
export const FONT = '"Playpen Sans", system-ui, "Segoe UI", Roboto, sans-serif';

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

export const el = (n: number, d = 2): string => (+n.toFixed(d) || 0).toLocaleString('el', { maximumFractionDigits: d }).replace('-', '−');

export function text(c: C, t: string, x: number, y: number, size: number, color?: string, weight = 600): void {
  c.save();
  c.font = `${weight} ${size}px ${FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  if (color) c.fillStyle = color;
  c.fillText(t, x, y);
  c.restore();
}

/** Κείμενο που μικραίνει όσο χρειάζεται για να χωρέσει σε πλάτος maxW. */
export function fitText(c: C, t: string, x: number, y: number, size: number, maxW: number, color?: string, weight = 600): void {
  c.save();
  c.font = `${weight} ${size}px ${FONT}`;
  const m = c.measureText(t).width;
  c.restore();
  text(c, t, x, y, m > maxW ? (size * maxW) / m : size, color, weight);
}

/** Στρογγυλό κουμπί με σύμβολο (−, +, ⟳). */
export function knob(c: C, x: number, y: number, r: number, label: string, env: KidEnv): void {
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
export const inR = (x: number, y: number, cx: number, cy: number, r: number): boolean => Math.hypot(x - cx, y - cy) <= r * 1.25;

export function rrect(c: C, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// ---------- δυαδικές «σημαίες» σε λίστα αριθμών (25 ανά αριθμό, για να μένουν ακέραιοι στο JSON) ----------
export const bit = (v: number[], from: number, i: number): boolean => ((v[from + Math.floor(i / 25)] ?? 0) & (1 << i % 25)) !== 0;
export function flip(v: number[], from: number, i: number): number[] {
  const out = [...v];
  const k = from + Math.floor(i / 25);
  while (out.length <= k) out.push(0);
  out[k] ^= 1 << i % 25;
  return out;
}

/** Το πράσινο του «σωστό». */
export const GOOD = '#16a34a';
/** Μικρό κουμπί που αλλάζει την όψη του κλάσματος· με περίγραμμα όταν είναι αναμμένο. */
export function skinBtn(c: C, x: number, y: number, r: number, emoji: string, on: boolean, env: KidEnv): void {
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
export const sum = (a: number[]): number => a.reduce((p, q) => p + q, 0);
export function star(c: C, cx: number, cy: number, r: number): void {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, q = i % 2 ? r * 0.42 : r;
    c.lineTo(cx + q * Math.cos(a), cy + q * Math.sin(a));
  }
  c.closePath();
}

export const kid = (d: Omit<StampDef, 'draw' | 'kid'>): StampDef => ({ ...d, kid: true, draw: () => {} });

/** «Όλη η οθόνη»: τέσσερις γωνίες που ανοίγουν· σε όλη την οθόνη, μπλε πόρτα επιστροφής. */
export function fullIcon(c: C, cx: number, cy: number, ps: number, env: KidEnv): void {
  if (env.full) {
    rrect(c, cx - ps * 0.64, cy - ps * 0.64, ps * 1.28, ps * 1.28, ps * 0.22);
    c.save();
    c.fillStyle = BLUE;
    c.fill();
    c.restore();
    text(c, '🚪', cx, cy + 1, ps * 0.8);
    return;
  }
  const r = ps * 0.38, q = ps * 0.2;
  c.save();
  c.strokeStyle = env.ink;
  c.lineWidth = Math.max(2.5, ps * 0.09);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    c.moveTo(cx + sx * r, cy + sy * (r - q));
    c.lineTo(cx + sx * r, cy + sy * r);
    c.lineTo(cx + sx * (r - q), cy + sy * r);
  }
  c.stroke();
  c.restore();
}

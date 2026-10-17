/** Εικόνες για μέτρημα και προβλήματα, και σφραγίδες επιβράβευσης. */
import type { StampDef } from '../stamps';
import { BLUE, type C, GREEN, kid, ORANGE, PURPLE, RED, rrect, star, text, YELLOW } from './common';

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

export const STICKER_KIDS: Record<string, StampDef> = {
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

for (const [key, emoji, label, draw, pw, ph] of PICS) {
  STICKER_KIDS[`pic-${key}`] = kid({
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

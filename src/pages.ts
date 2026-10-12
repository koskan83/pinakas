/** Έτοιμες σελίδες (πρότυπα) που μπαίνουν με ένα πάτημα από το ＋ → Πρότυπα. Συντεταγμένες σε μονάδες πίνακα. */

import type { Item } from './model';
import { STAMPS } from './stamps';

export interface Template { name: string; items: Item[]; lv?: 'pri' | 'sec' }
const kidItem = (name: string, x: number, y: number, scale = 1): Item => {
  const d = STAMPS[name];
  return { kind: 'stamp', id: '', name, x, y, w: d.w * scale, h: d.h * scale, color: '#111111', width: 3, v: d.init?.slice() };
};
const text = (x: number, y: number, t: string, size = 34): Item => ({ kind: 'text', id: '', x, y, text: t, size, color: '#111111' });
const rule = (x0: number, y0: number, x1: number, y1: number): Item =>
  ({ kind: 'shape', id: '', shape: 'line', x0, y0, x1, y1, color: '#111111', width: 2 });
export const BUILTIN: Template[] = [
  {
    name: 'Δεδομένα – Ζητούμενα – Λύση',
    items: [text(60, 90, 'Δεδομένα'), rule(60, 140, 420, 140), text(60, 380, 'Ζητούμενα'), rule(60, 430, 420, 430),
      rule(470, 80, 470, 660), text(520, 90, 'Λύση'), rule(520, 140, 1180, 140)],
  },
  {
    name: 'Δύο στήλες',
    items: [rule(640, 80, 640, 660)],
  },
  {
    name: 'Μελέτη συνάρτησης', lv: 'sec',
    items: [text(60, 90, 'f(x) ='), rule(60, 140, 600, 140),
      text(60, 165, 'Πεδίο ορισμού', 26), text(60, 285, 'Μονοτονία – ακρότατα', 26), text(60, 415, 'Κυρτότητα – σημεία καμπής', 26), text(60, 545, 'Ασύμπτωτες', 26),
      rule(640, 90, 640, 640),
      { kind: 'axes', id: '', x: 930, y: 375, unit: 30, mode: 'full', nx: 8, ny: 8, color: '#111111' }],
  },
  {
    name: 'Κλάσματα', lv: 'pri',
    items: [text(60, 85, 'Κλάσματα', 44), kidItem('fracpie', 80, 190, 0.95), kidItem('fracpie', 400, 190, 0.95), kidItem('fracbar', 730, 200, 0.85), kidItem('fracbar', 730, 400, 0.85)],
  },
  {
    name: 'Αριθμοί ως το 1000', lv: 'pri',
    items: [text(60, 85, 'Εκατοντάδες, Δεκάδες, Μονάδες', 40), kidItem('blocks', 60, 160, 0.85), kidItem('balance', 680, 170, 0.75), kidItem('numline', 60, 530)],
  },
  {
    name: 'Τι ώρα είναι;', lv: 'pri',
    items: [text(60, 85, 'Τι ώρα είναι;', 44), kidItem('clock', 150, 190), kidItem('clock', 760, 190), rule(640, 170, 640, 600)],
  },
  {
    name: 'Προπαίδεια', lv: 'pri',
    items: [text(60, 85, 'Προπαίδεια', 44), kidItem('times', 60, 160, 0.9), kidItem('hundred', 680, 165, 0.9)],
  },
];

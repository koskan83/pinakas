/**
 * Τα εργαλεία του Δημοτικού όπως τα βλέπει η εφαρμογή στο άνοιγμα: οι εικόνες και οι σφραγίδες είναι έτοιμες, τα υπόλοιπα
 * είναι «θέσεις» από τον κατάλογο (όνομα, μέγεθος, αρχική κατάσταση) ώσπου να φτάσει ο κώδικάς τους (tools.ts).
 * Τότε κάθε θέση γεμίζει επί τόπου με το αληθινό εργαλείο, ώστε όσοι την κρατούν (STAMPS) να το βρίσκουν χωρίς τίποτα άλλο.
 * Ως τότε ζωγραφίζεται ένα απλό πλαίσιο με το όνομα, και τα πατήματα δεν κάνουν τίποτα (αλλά ξεκινούν τη φόρτωση).
 */
import type { StampDef } from '../stamps';
import { KID_CATALOG } from './catalog';
import { FONT, kid } from './common';
import { STICKER_KIDS } from './stickers';

let loading: Promise<void> | null = null;
let ready = false;
const waiting: (() => void)[] = [];

/** Φέρνει τον κώδικα των εργαλείων (μία φορά). */
export function loadKids(): Promise<void> {
  loading ??= import('./tools').then(({ TOOL_KIDS }) => {
    for (const [k, d] of Object.entries(TOOL_KIDS)) Object.assign(KIDS[k] ?? (KIDS[k] = { ...d }), d);
    ready = true;
    for (const f of waiting.splice(0)) f();
  });
  return loading;
}

export const kidsReady = (): boolean => ready;

/** Τι να γίνει όταν φτάσουν τα εργαλεία (π.χ. να ξαναζωγραφιστεί ο πίνακας). */
export function onKidsLoaded(f: () => void): void {
  if (ready) f();
  else waiting.push(f);
}

const later = (): null => {
  void loadKids();
  return null;
};

function placeholder(label: string, has: string): StampDef {
  const d = kid({
    label, w: 0, h: 0,
    drawKid(c, w, h, _v, env) {
      void loadKids();
      c.save();
      c.globalAlpha = 0.5;
      c.strokeStyle = env.ink;
      c.lineWidth = Math.max(2, Math.min(w, h) * 0.01);
      c.setLineDash([12, 10]);
      c.strokeRect(1, 1, w - 2, h - 2);
      c.fillStyle = env.ink;
      c.font = `600 ${Math.max(14, Math.min(w * 0.06, h * 0.2))}px ${FONT}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(`${label}…`, w / 2, h / 2);
      c.restore();
    },
  });
  // μόνο οι μέθοδοι που έχει και το αληθινό, για να μην αλλάζει τίποτα στους ελέγχους «έχει tap;» κ.λπ.
  for (const m of has.split(' ').filter(Boolean)) (d as unknown as Record<string, unknown>)[m] = m === 'fullAt' ? () => (later(), false) : later;
  return d;
}

export const KIDS: Record<string, StampDef> = { ...STICKER_KIDS };
for (const [k, { has, ...meta }] of Object.entries(KID_CATALOG)) KIDS[k] = { ...placeholder(meta.label, has), ...meta };

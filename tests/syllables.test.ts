import { describe, expect, it } from 'vitest';
import { syllables } from '../src/syllabify';
import { SYLLABLE_KIDS, sylCheck, sylParts, sylStart, sylState } from '../src/kids/syllables';

const split = (w: string): string => syllables(w).join('-');

describe('χωρισμός σε συλλαβές', () => {
  it('σύμφωνα ανάμεσα σε φωνήεντα: μαζί αν αρχίζει λέξη με αυτά', () => {
    expect(split('βάτραχος')).toBe('βά-τρα-χος');
    expect(split('άστρο')).toBe('ά-στρο');
    expect(split('καρέκλα')).toBe('κα-ρέ-κλα');
    expect(split('άλμα')).toBe('άλ-μα');
    expect(split('θάλασσα')).toBe('θά-λασ-σα');
    expect(split('άνθρωπος')).toBe('άν-θρω-πος');
    expect(split('κουμπί')).toBe('κου-μπί');
    expect(split('πέντε')).toBe('πέ-ντε');
    expect(split('φεγγάρι')).toBe('φεγ-γά-ρι');
  });
  it('φωνήεντα που γράφονται μαζί, τόνος και διαλυτικά', () => {
    expect(split('αυτοκίνητο')).toBe('αυ-το-κί-νη-το');
    expect(split('σχολείο')).toBe('σχο-λεί-ο');
    expect(split('τσάι')).toBe('τσά-ι');
    expect(split('κοροϊδεύω')).toBe('κο-ρο-ϊ-δεύ-ω');
    expect(split('αεροπλάνο')).toBe('α-ε-ρο-πλά-νο');
  });
  it('συνίζηση, με τις εξαιρέσεις της', () => {
    expect(split('παιδιά')).toBe('παι-διά');
    expect(split('ήλιος')).toBe('ή-λιος');
    expect(split('γιαγιά')).toBe('για-γιά');
    expect(split('Μαρία')).toBe('Μα-ρί-α');
    expect(split('Ιούνιος')).toBe('Ι-ού-νιος');
    expect(split('τετράδιο')).toBe('τε-τρά-δι-ο');
    expect(split('αλήθεια')).toBe('α-λή-θει-α');
  });
});

describe('Συλλαβές: το βατραχάκι', () => {
  const d = SYLLABLE_KIDS.syllables, W = 960, H = 640;
  /** Σέρνει από (x0, y0) σε (x1, y1) και αφήνει. */
  const drag = (v: number[], x0: number, y0: number, x1: number, y1: number): number[] => {
    const st = {};
    let cur = d.paint!(v, x0, y0, W, H, st, true);
    if (!cur) return v;
    cur = d.paint!(cur, x1, y1, W, H, st, false)!;
    return d.drop!(cur)?.v ?? cur;
  };
  const stack: [number, number] = [W * 0.075, 0.86 * H - 0.09 * H];
  const river = (k: number, P: number): [number, number] => [W * 0.15 + ((k + 0.5) * W * 0.7) / P, ((0.27 + 0.86) / 2 + 0.02) * H + (P > 1 ? (k % 2 ? 1 : -1) * H * 0.035 : 0)];

  it('λέξη με παύλες: ο χωρισμός είναι αυτός που γράφτηκε', () => {
    expect(sylParts(sylState(sylStart('βι-βλι-ο-θή-κη')!))).toEqual(['βι', 'βλι', 'ο', 'θή', 'κη']);
    expect(sylParts(sylState(sylStart('βιβλιοθήκη')!))).toEqual(['βι', 'βλιο', 'θή', 'κη']);
    expect(sylStart('α')).toBeNull();
  });

  it('νούφαρα από τη στοίβα, γράμματα στα νούφαρα, και ο έλεγχος', () => {
    let v = sylStart('μήλο')!;
    expect(sylCheck(sylState(v))).toEqual({ res: 3, fail: 0 });
    // ένα πάτημα στη στοίβα βάζει νούφαρο στο τέλος· ένα σύρσιμο στο ποτάμι, εκεί που αφέθηκε
    v = drag(v, ...stack, ...stack);
    v = drag(v, ...stack, W * 0.8, H * 0.55);
    expect(sylState(v).pads).toBe(2);
    // τα γράμματα: μ ή στο πρώτο, λ ο στο δεύτερο
    const tray = (i: number): [number, number] => {
      const tile = Math.min(H * 0.085, (W * 0.84) / (4 * 1.35)), gap = tile * 0.35, x0 = (W - (4 * tile + 3 * gap)) / 2;
      return [x0 + i * (tile + gap) + tile / 2, H * 0.195];
    };
    for (const [i, p] of [[0, 0], [1, 0], [2, 1], [3, 1]] as const) v = drag(v, ...tray(i), ...river(p, 2));
    expect(sylState(v).loc).toEqual([1, 1, 2, 2]);
    expect(sylCheck(sylState(v))).toEqual({ res: 1, fail: 0 });
    // το «Πήδα!»: ο βάτραχος περνά, και ο ήχος ξέρει πόσα πηδήματα
    const go = d.tap!(v, W * 0.69 + 10, H * 0.9, W, H)!;
    expect(sylState(go).res).toBe(1);
    expect(d.fx!(v, go)).toBe('frog|2|w');
    // το λ στο πρώτο νούφαρο: εκεί βουλιάζει
    const wrong = drag(go, ...river(1, 2).map((q, k) => q + (k === 0 ? -12 : 0)) as [number, number], ...river(0, 2));
    expect(sylState(wrong).res).toBe(0);
    expect(sylCheck(sylState(wrong))).toEqual({ res: 2, fail: 0 });
  });

  it('νούφαρο έξω από το ποτάμι: φεύγει και τα γράμματά του γυρίζουν στη σειρά', () => {
    // δύο νούφαρα, με ψά και ρι
    let v = sylStart('ψάρι')!;
    v = drag(drag(v, ...stack, ...stack), ...stack, ...stack);
    const tile = Math.min(H * 0.085, (W * 0.84) / (4 * 1.35)), gap = tile * 0.35, x0 = (W - (4 * tile + 3 * gap)) / 2;
    for (const [i, p] of [[0, 0], [1, 0], [2, 1], [3, 1]] as const) v = drag(v, x0 + i * (tile + gap) + tile / 2, H * 0.195, ...river(p, 2));
    // το πρώτο νούφαρο, από την άκρη του (όχι από γράμμα), σέρνεται στην όχθη
    const [px, py] = river(0, 2);
    v = drag(v, px, py + H * 0.08, W * 0.05, H * 0.5);
    expect(sylState(v).pads).toBe(1);
    expect(sylState(v).loc).toEqual([0, 0, 1, 1]);
  });
});

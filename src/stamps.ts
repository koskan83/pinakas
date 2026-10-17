/** Έτοιμα σχήματα φυσικής. Κάθε σχήμα ζωγραφίζεται μέσα σε κουτί w × h με το τρέχον χρώμα του c. */

import { KIDS } from './kids/lazy';
import type { KidEnv } from './kids/common';
import { hatch, label, path, zigzag } from './draw-util';
import { PHYSICS } from './physics';

type C = CanvasRenderingContext2D;

/** Κατάσταση ταλάντωσης ενός ελατηρίου τη στιγμή που ζωγραφίζεται. */
export interface SpringState {
  /** Απομάκρυνση του σώματος από τη θέση ισορροπίας (θετική = επιμήκυνση). */
  d: number;
  /** Πλάτος, για τις γραμμές ±A· 0 αν δεν ταλαντώνεται. */
  amp: number;
  /** Εμφάνιση Θ.Φ.Μ., Θ.Ι. και ±A. */
  marks: boolean;
  /** Σχήματα με κίνηση (play): ms από τότε που πατήθηκε το ▶· undefined όταν είναι ακίνητο. */
  t?: number;
}

/** Πού βρίσκεται το σώμα ενός ελατηρίου και προς τα πού κινείται. */
export interface SpringGeom {
  /** Κέντρο του σώματος στη θέση ισορροπίας. */
  cx: number;
  cy: number;
  /** Μοναδιαίο διάνυσμα της επιμήκυνσης. */
  ux: number;
  uy: number;
  /** Μέγιστο πλάτος. */
  max: number;
  /** Ακτίνα μέσα στην οποία «πιάνεται» το σώμα. */
  r: number;
  /** Πού είναι το σώμα με απομάκρυνση d, όταν δεν κινείται σε ευθεία (εκκρεμές: πάνω σε τόξο)· idle = ακίνητο, στο αρχικό σχέδιο. */
  bob?(d: number, idle: boolean): [number, number];
  /** Η απομάκρυνση του ακίνητου σχεδίου (εκκρεμές: γερμένο κατά θ)· αν λείπει, 0. */
  rest?: number;
}

/** Περιοχή μέσα στο κουτί του εργαλείου (στις μονάδες του). */
export interface KidArea { x: number; y: number; w: number; h: number }
export interface KidAsk {
  title: string;
  hint?: string;
  secret?: boolean;
  /** Πόσα γράμματα χωρά η απάντηση· αν λείπει, 24. */
  max?: number;
  /** Το παράθυρο έχει και 🎤: ό,τι πει ο χρήστης σε αυτή τη γλώσσα (π.χ. 'el-GR') προστίθεται στην απάντηση. */
  voice?: string;
  /** Οι λέξεις της ορθογραφίας: αντί για απλό πεδίο, το παράθυρο με τις φυλαγμένες λίστες (βλ. spell-lists.ts). */
  lists?: boolean;
  /** Αρχική τιμή του πεδίου και έτοιμες τιμές που μπαίνουν με ένα πάτημα. */
  value?: string;
  picks?: string[];
  /**
   * Αντί για ερώτηση προς τον χρήστη, η «απάντηση» βγαίνει από ό,τι έχει γραφτεί με το μολύβι στην περιοχή:
   * 'read' = το διαβάζει η υπηρεσία αναγνώρισης και δίνεται στο apply (κενό αν δεν μπόρεσε να διαβαστεί)· 'clear' = σβήνεται και το apply παίρνει κενό.
   */
  area?: KidArea;
  mode?: 'read' | 'clear';
  /** Μετά από ερώτηση που απαντήθηκε: σβήνεται και ό,τι είχε γραφτεί σε αυτή την περιοχή. */
  then?: { area: KidArea; mode: 'clear' };
  apply(text: string): number[] | null;
}

/** Κατηγορίες του μενού «Σχήματα Φυσικής», με τη σειρά που εμφανίζονται. */
export const STAMP_CATS = {
  mech: 'Δυνάμεις και κινήσεις',
  mom: 'Ορμή και κρούσεις',
  osc: 'Ταλαντώσεις',
  wave: 'Κύματα',
  circ: 'Ηλεκτρικά κυκλώματα',
  em: 'Ηλεκτρικό και μαγνητικό πεδίο',
} as const;

export interface StampDef {
  label: string;
  /** Κατηγορία στο μενού (βλ. STAMP_CATS). */
  cat?: keyof typeof STAMP_CATS;
  /** Δεν φαίνεται πια στο μενού· μένει μόνο για να ανοίγουν τα παλιά μαθήματα που το έχουν. */
  hidden?: boolean;
  /** Κινείται με το ▶ (κρούση, κύματα, κυκλική κίνηση): το draw παίρνει τον χρόνο στο st.t. */
  play?: boolean;
  /** Αρχικό μέγεθος σε μονάδες πίνακα. */
  w: number;
  h: number;
  draw(c: C, w: number, h: number, st?: SpringState): void;
  /** Μόνο για ελατήρια: το σώμα μπορεί να τραβηχτεί και να ταλαντωθεί. */
  spring?(w: number, h: number): SpringGeom;
  /** Εργαλείο του Δημοτικού (βλ. kids.ts): ζωγραφίζεται από την κατάστασή του και αλλάζει με πάτημα. */
  kid?: boolean;
  /** Αρχική κατάσταση. */
  init?: number[];
  /** Παιχνίδι για όλη την τάξη: όταν μπαίνει στον πίνακα μεγαλώνει ώστε να γεμίσει την οθόνη. */
  big?: boolean;
  /** Πόσο κρατά η κίνηση μετά από κάθε αλλαγή (ms)· αν λείπει, ενάμισι δευτερόλεπτο. */
  animMs?: number;
  drawKid?(c: C, w: number, h: number, v: number[], env: KidEnv): void;
  /** Πάτημα στο σημείο (x, y) του κουτιού: η νέα κατάσταση, ή null αν δεν έπεσε πουθενά. */
  tap?(v: number[], x: number, y: number, w: number, h: number, env?: { names?: string[] }): number[] | null;
  /** Πάτημα που χρειάζεται κείμενο από τον χρήστη (π.χ. λέξη της κρεμάλας): τι να ρωτηθεί και πώς γίνεται κατάσταση. */
  ask?(v: number[], x: number, y: number, w: number, h: number): KidAsk | null;
  /**
   * Σύρσιμο πάνω στο εργαλείο (χτίσιμο με κυβάκια, δείκτες ρολογιού). `first`: η αρχή της κίνησης· αν τότε επιστρέψει null,
   * το σύρσιμο μετακινεί το εργαλείο ως συνήθως. `st`: πρόχειρη μνήμη για όσο κρατά η κίνηση.
   */
  paint?(v: number[], x: number, y: number, w: number, h: number, st: Record<string, number>, first: boolean): number[] | null;
  /** Το σύρσιμο τελείωσε με κατάσταση v: αν αυτό σημαίνει κάτι (π.χ. οι δείκτες έμειναν στην ώρα της άσκησης), η τελική κατάσταση και τι έγινε. */
  drop?(v: number[]): { v: number[]; ev: string } | null;
  /** Τι «έγινε» όταν η κατάσταση άλλαξε από prev σε next (π.χ. 'win', 'tok'), για ήχο και πανηγυρισμό· αν λείπει, απλό 'click'. */
  fx?(prev: number[], next: number[]): string | null;
  /** Επιβράβευση (αστέρι, μπράβο): μπαίνει στον πίνακα με αναπήδημα και κομφετί. */
  cheer?: boolean;
  /** Ο κέρσορας του ποντικιού πάνω από το σημείο (CSS, π.χ. ψαλίδι στο ✂️ των αριθμοκυβάκιων)· null = ο συνηθισμένος. */
  cursor?(v: number[], x: number, y: number, w: number, h: number): string | null;
  /** true αν το σημείο είναι το κουμπί «όλη η οθόνη» του εργαλείου (ή η πόρτα επιστροφής, όταν είναι ήδη σε όλη την οθόνη). */
  fullAt?(x: number, y: number, w: number, h: number): boolean;
}

/** Διακεκομμένη γραμμή αναφοράς με ετικέτα στο σημείο (tx, ty). */
function mark(c: C, x0: number, y0: number, x1: number, y1: number, text: string, tx: number, ty: number, size: number): void {
  c.save();
  c.globalAlpha = 0.75;
  c.lineWidth *= 0.55;
  c.setLineDash([7, 6]);
  path(c, [[x0, y0], [x1, y1]]);
  c.font = `600 ${size}px system-ui, "Segoe UI", Roboto, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, tx, ty);
  c.restore();
}

/** Ένα γράμμα ενός σχήματος (φ, m, θ…): κέντρο και μέγεθος, στις μονάδες του κουτιού του. */
export interface StampText { t: string; x: number; y: number; size: number }

/** Τα γράμματα που ζωγραφίζει ένα σχήμα σε κουτί w × h, για να πατηθούν και να αλλάξουν. */
export function stampTexts(d: StampDef, w: number, h: number): StampText[] {
  const out: StampText[] = [];
  let font = '';
  // «καμβάς» που μόνο σημειώνει πού γράφτηκε κείμενο· όλα τα άλλα είναι κενές κινήσεις
  const rec = new Proxy({}, {
    get: (_, k) => (k === 'font' ? font : k === 'fillText' ? (t: string, x: number, y: number) => out.push({ t, x, y, size: parseFloat(/([\d.]+)px/.exec(font)?.[1] ?? '16') }) : () => {}),
    set: (_, k, v) => {
      if (k === 'font') font = v;
      return true;
    },
  }) as C;
  d.draw(rec, w, h);
  return out;
}

/**
 * Εκκρεμές: νήμα από το (w/2, 0)· η «απομάκρυνση» d είναι το μήκος του τόξου που διαγράφει η σφαίρα (θετικό προς τα δεξιά).
 * Ακίνητο, σχεδιάζεται γερμένο κατά θ, όπως πάντα. Γωνίες ως PEND_MAX (15°), όπου ισχύει η απλή αρμονική ταλάντωση.
 */
const PEND_MAX = Math.PI / 12;
function pendulum(w: number, h: number): SpringGeom {
  const L = h * 0.8;
  const at = (a: number): [number, number] => [w / 2 + L * Math.sin(a), L * Math.cos(a)];
  const rest = L * PEND_MAX;
  const [cx, cy] = at(0);
  return {
    cx, cy, ux: 1, uy: 0, max: L * PEND_MAX, r: Math.max(w * 0.18, 28),
    bob: (d, idle) => at((idle ? rest : d) / L),
    rest,
  };
}

function meter(letter: string): StampDef['draw'] {
  return (c, w, h) => {
    const r = h * 0.42;
    path(c, [[0, h / 2], [w / 2 - r, h / 2]]);
    path(c, [[w / 2 + r, h / 2], [w, h / 2]]);
    c.beginPath();
    c.arc(w / 2, h / 2, r, 0, Math.PI * 2);
    c.stroke();
    label(c, letter, w / 2, h / 2 + 1, r * 1.1);
  };
}

export const STAMPS: Record<string, StampDef> = {
  incline: {
    label: 'Κεκλιμένο επίπεδο', cat: 'mech', w: 320, h: 180,
    draw(c, w, h) {
      path(c, [[0, h], [w, h], [w, h * 0.25], [0, h]], true);
      // σώμα πάνω στο επίπεδο
      const ang = Math.atan2(-h * 0.75, w);
      c.save();
      c.translate(w * 0.55, h - h * 0.75 * 0.55);
      c.rotate(ang);
      c.strokeRect(-w * 0.09, -h * 0.26, w * 0.18, h * 0.26);
      c.restore();
      c.beginPath();
      c.arc(0, h, w * 0.16, ang, 0);
      c.stroke();
      label(c, 'φ', w * 0.21, h - h * 0.09, h * 0.14);
    },
  },
  block: {
    label: 'Σώμα', cat: 'mech', w: 120, h: 90,
    draw(c, w, h) {
      c.strokeRect(1, 1, w - 2, h - 2);
      label(c, 'm', w / 2, h / 2, h * 0.4);
    },
  },
  spring: {
    label: 'Οριζόντιο ελατήριο', cat: 'osc', w: 380, h: 100,
    draw(c, w, h, st) {
      const d = st?.d ?? 0;
      const x = w * 0.5 + d;
      path(c, [[10, 0], [10, h]]);
      hatch(c, 10, 6, 10, h - 6, 6, -10, 10);
      path(c, [[0, h], [w, h]]);
      path(c, [[10, h * 0.55], [30, h * 0.55], ...zigzag(30, x - w * 0.05, h * 0.55, h * 0.2, 14).slice(1), [x, h * 0.55]]);
      c.strokeRect(x, h * 0.2, w * 0.22, h * 0.8 - 1);
      label(c, 'm', x + w * 0.11, h * 0.6, h * 0.3);
      if (st?.marks) {
        const fs = Math.max(11, h * 0.15);
        // οριζόντια, η θέση ισορροπίας συμπίπτει με τη θέση φυσικού μήκους
        mark(c, w * 0.5, -h * 0.15, w * 0.5, h, 'Θ.Φ.Μ. ≡ Θ.Ι.', w * 0.5, -h * 0.3, fs);
        if (st.amp) {
          mark(c, w * 0.5 - st.amp, h * 0.05, w * 0.5 - st.amp, h, '−A', w * 0.5 - st.amp, -h * 0.08, fs);
          mark(c, w * 0.5 + st.amp, h * 0.05, w * 0.5 + st.amp, h, '+A', w * 0.5 + st.amp, -h * 0.08, fs);
        }
      }
    },
    spring: (w, h) => ({ cx: w * 0.61, cy: h * 0.6, ux: 1, uy: 0, max: w * 0.24, r: Math.max(w * 0.13, h * 0.45) }),
  },
  springV: {
    label: 'Κατακόρυφο ελατήριο', cat: 'osc', w: 150, h: 360,
    draw(c, w, h, st) {
      const d = st?.d ?? 0;
      const cx = w / 2, top = 2, y0 = h * 0.06, yi = h * 0.56, y = yi + d, amp = w * 0.16, n = 14;
      path(c, [[w * 0.1, top], [w * 0.9, top]]);
      hatch(c, w * 0.15, top, w * 0.85, top, 6, 8, -8);
      const y1 = y - h * 0.04;
      const pts = [[cx, top], [cx, y0]];
      for (let i = 0; i < n; i++) pts.push([cx + (i % 2 ? amp : -amp), y0 + ((y1 - y0) * (i + 0.5)) / n]);
      pts.push([cx, y1], [cx, y]);
      path(c, pts);
      c.strokeRect(cx - w * 0.3, y, w * 0.6, h * 0.2);
      label(c, 'm', cx, y + h * 0.1, h * 0.09);
      if (st?.marks) {
        const fs = Math.max(11, w * 0.1);
        const line = (yy: number, text: string): void => mark(c, w * 0.05, yy, w * 1.1, yy, text, w * 1.1 + fs * (text.length * 0.33 + 0.4), yy, fs);
        line(yi - h * 0.1, 'Θ.Φ.Μ.');
        line(yi, 'Θ.Ι.');
        if (st.amp) {
          line(yi - st.amp, '−A');
          line(yi + st.amp, '+A');
        }
      }
    },
    spring: (w, h) => ({ cx: w / 2, cy: h * 0.66, ux: 0, uy: 1, max: h * 0.2, r: Math.max(w * 0.34, h * 0.12) }),
  },
  springIncline: {
    label: 'Ελατήριο σε κεκλιμένο', cat: 'osc', w: 400, h: 250,
    draw(c, w, h, st) {
      const d = st?.d ?? 0;
      const rise = h * 0.72;
      path(c, [[0, h], [w, h], [w, h - rise], [0, h]], true);
      const ang = Math.atan2(rise, -w);
      const L = Math.hypot(w, rise);
      const bh = h * 0.2, bw = L * 0.17, s0 = L * 0.05, xi = L * 0.42, x = xi + d;
      c.save();
      // x κατά μήκος του επιπέδου προς τα κάτω, y κάθετα προς τα έξω
      c.translate(w, h - rise);
      c.rotate(ang);
      path(c, [[0, 0], [0, bh * 1.25]]);
      path(c, [[0, bh / 2], [s0, bh / 2], ...zigzag(s0, x - L * 0.04, bh / 2, bh * 0.32, 12).slice(1), [x, bh / 2]]);
      c.strokeRect(x, 0, bw, bh);
      c.restore();
      // τα γράμματα μένουν όρθια: υπολογίζουμε τη θέση τους έξω από την περιστροφή
      const at = (px: number, py: number): [number, number] => [w + px * Math.cos(ang) - py * Math.sin(ang), h - rise + px * Math.sin(ang) + py * Math.cos(ang)];
      const [mx, my] = at(x + bw / 2, bh / 2);
      label(c, 'm', mx, my, bh * 0.6);
      c.beginPath();
      c.arc(0, h, w * 0.15, -Math.atan2(rise, w), 0);
      c.stroke();
      label(c, 'φ', w * 0.2, h - h * 0.07, h * 0.12);
      if (st?.marks) {
        const fs = Math.max(11, h * 0.065);
        const line = (px: number, text: string, far: number): void => {
          const [ax, ay] = at(px, 0), [bx, by] = at(px, bh * far), [tx, ty] = at(px, bh * far + fs * 1.1);
          mark(c, ax, ay, bx, by, text, tx, ty, fs);
        };
        line(xi - L * 0.09, 'Θ.Φ.Μ.', 2.1);
        line(xi, 'Θ.Ι.', 2.1);
        if (st.amp) {
          line(xi - st.amp, '−A', 1.5);
          line(xi + st.amp, '+A', 1.5);
        }
      }
    },
    spring(w, h) {
      const rise = h * 0.72, L = Math.hypot(w, rise), ang = Math.atan2(rise, -w);
      const px = L * 0.42 + (L * 0.17) / 2, py = h * 0.1;
      return {
        cx: w + px * Math.cos(ang) - py * Math.sin(ang), cy: h - rise + px * Math.sin(ang) + py * Math.cos(ang),
        ux: Math.cos(ang), uy: Math.sin(ang), max: L * 0.2, r: L * 0.12,
      };
    },
  },
  pulley: {
    label: 'Τροχαλία', cat: 'mech', w: 200, h: 300,
    draw(c, w, h) {
      const r = w * 0.28, cy = h * 0.22;
      path(c, [[w * 0.15, 0], [w * 0.85, 0]]);
      hatch(c, w * 0.2, 0, w * 0.8, 0, 6, 8, -8);
      path(c, [[w / 2, 0], [w / 2, cy]]);
      c.beginPath();
      c.arc(w / 2, cy, r, 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      c.arc(w / 2, cy, 3, 0, Math.PI * 2);
      c.fill();
      path(c, [[w / 2 - r, cy], [w / 2 - r, h * 0.62]]);
      path(c, [[w / 2 + r, cy], [w / 2 + r, h * 0.78]]);
      c.strokeRect(w / 2 - r - w * 0.14, h * 0.62, w * 0.28, h * 0.16);
      c.strokeRect(w / 2 + r - w * 0.14, h * 0.78, w * 0.28, h * 0.2);
      label(c, 'm₁', w / 2 - r, h * 0.7, h * 0.07);
      label(c, 'm₂', w / 2 + r, h * 0.88, h * 0.07);
    },
  },
  pendulum: {
    label: 'Εκκρεμές', cat: 'osc', w: 200, h: 280,
    draw(c, w, h, st) {
      path(c, [[w * 0.2, 0], [w * 0.8, 0]]);
      hatch(c, w * 0.25, 0, w * 0.75, 0, 5, 8, -8);
      const g = pendulum(w, h);
      const idle = !st || (!st.amp && !st.d);
      const r = w * 0.09;
      const [bx, by] = g.bob!(st?.d ?? 0, idle);
      const [ix, iy] = g.bob!(0, false);
      // η κατακόρυφη (θέση ισορροπίας) σταματά στη σφαίρα
      c.save();
      c.setLineDash([8, 6]);
      c.lineWidth *= 0.6;
      path(c, [[w / 2, 0], [ix, iy]]);
      c.restore();
      // ακραίες θέσεις (±A) και θέση ισορροπίας: αχνά, διακεκομμένα, με τα ονόματα ακριβώς κάτω από τη σφαίρα
      const amp = st?.amp || (idle ? g.rest! : 0);
      if (st?.marks) {
        const fs = Math.max(11, h * 0.05);
        const ghost = (x: number, y: number, t: string): void => {
          c.globalAlpha = 0.55;
          c.beginPath();
          c.arc(x, y, r, 0, Math.PI * 2);
          c.stroke();
          c.globalAlpha = 0.85;
          c.fillText(t, x, y + r + fs * 0.75);
        };
        c.save();
        c.lineWidth *= 0.6;
        c.setLineDash([6, 5]);
        c.font = `600 ${fs}px system-ui, "Segoe UI", Roboto, sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        if (amp) {
          // το τόξο της τροχιάς ανάμεσα στις ακραίες θέσεις
          c.globalAlpha = 0.4;
          c.beginPath();
          c.arc(w / 2, 0, iy, Math.PI / 2 + amp / iy, Math.PI / 2 - amp / iy, true);
          c.stroke();
          for (const [s, t] of [[-1, '−A'], [1, '+A']] as const) {
            const [ex, ey] = g.bob!(s * amp, false);
            c.globalAlpha = 0.55;
            path(c, [[w / 2, 0], [ex, ey]]);
            ghost(ex, ey, t);
          }
        }
        ghost(ix, iy, 'Θ.Ι.');
        c.restore();
      }
      path(c, [[w / 2, 0], [bx, by]]);
      c.beginPath();
      c.arc(bx, by, r, 0, Math.PI * 2);
      c.fill();
      // το θ ανάμεσα στην κατακόρυφη και στο νήμα
      if (idle) label(c, 'θ', w / 2 + h * 0.067, h * 0.5, h * 0.07);
    },
    spring: (w, h) => pendulum(w, h),
  },
  resistor: {
    label: 'Αντιστάτης', hidden: true, w: 220, h: 60,
    draw(c, w, h) {
      path(c, [[0, h / 2], [w * 0.22, h / 2], ...zigzag(w * 0.22, w * 0.78, h / 2, h * 0.32, 7).slice(1), [w, h / 2]]);
    },
  },
  battery: {
    label: 'Πηγή', hidden: true, w: 160, h: 90,
    draw(c, w, h) {
      path(c, [[0, h / 2], [w * 0.44, h / 2]]);
      path(c, [[w * 0.56, h / 2], [w, h / 2]]);
      path(c, [[w * 0.44, h * 0.1], [w * 0.44, h * 0.9]]);
      c.save();
      c.lineWidth *= 2;
      path(c, [[w * 0.56, h * 0.3], [w * 0.56, h * 0.7]]);
      c.restore();
      label(c, '+', w * 0.32, h * 0.2, h * 0.3);
      label(c, '−', w * 0.7, h * 0.2, h * 0.3);
    },
  },
  capacitor: {
    label: 'Πυκνωτής', hidden: true, w: 160, h: 90,
    draw(c, w, h) {
      path(c, [[0, h / 2], [w * 0.44, h / 2]]);
      path(c, [[w * 0.56, h / 2], [w, h / 2]]);
      path(c, [[w * 0.44, h * 0.1], [w * 0.44, h * 0.9]]);
      path(c, [[w * 0.56, h * 0.1], [w * 0.56, h * 0.9]]);
    },
  },
  lamp: {
    label: 'Λαμπτήρας', hidden: true, w: 160, h: 80,
    draw(c, w, h) {
      const r = h * 0.42, q = r * Math.SQRT1_2;
      path(c, [[0, h / 2], [w / 2 - r, h / 2]]);
      path(c, [[w / 2 + r, h / 2], [w, h / 2]]);
      c.beginPath();
      c.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      c.stroke();
      path(c, [[w / 2 - q, h / 2 - q], [w / 2 + q, h / 2 + q]]);
      path(c, [[w / 2 - q, h / 2 + q], [w / 2 + q, h / 2 - q]]);
    },
  },
  switch: {
    label: 'Διακόπτης', hidden: true, w: 180, h: 70,
    draw(c, w, h) {
      const y = h * 0.75;
      path(c, [[0, y], [w * 0.3, y]]);
      path(c, [[w * 0.7, y], [w, y]]);
      path(c, [[w * 0.3, y], [w * 0.66, h * 0.15]]);
      for (const x of [w * 0.3, w * 0.7]) {
        c.beginPath();
        c.arc(x, y, 4, 0, Math.PI * 2);
        c.fill();
      }
    },
  },
  ammeter: { label: 'Αμπερόμετρο', hidden: true, w: 160, h: 80, draw: meter('A') },
  voltmeter: { label: 'Βολτόμετρο', hidden: true, w: 160, h: 80, draw: meter('V') },
};

Object.assign(STAMPS, PHYSICS, KIDS);

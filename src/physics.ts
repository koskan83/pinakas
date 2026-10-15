/**
 * Έτοιμα σχήματα Φυσικής Γυμνασίου–Λυκείου: δυνάμεις, ορμή, κύματα, κυκλώματα, πεδία.
 * Κάθε σχήμα σχεδιάζεται σε κουτί W × H «σχεδίου» και κλιμακώνεται αναλογικά στο πραγματικό w × h.
 * Τα γράμματα (R₁, υ, λ…) γράφονται με label, ώστε να αλλάζουν με δεύτερο πάτημα.
 */

import { hatch, label, path, zigzag } from './draw-util';
import type { SpringState, StampDef, STAMP_CATS } from './stamps';

type C = CanvasRenderingContext2D;
type P2 = [number, number];

/** Εργαλεία σχεδίασης σε συντεταγμένες σχεδίου. */
interface Kit {
  c: C;
  /** Από συντεταγμένες σχεδίου σε συντεταγμένες κουτιού. */
  P(x: number, y: number): P2;
  /** Κλίμακα για μεγέθη (ακτίνες, γράμματα). */
  s: number;
  line(...pts: P2[]): void;
  /** Λεπτή διακεκομμένη γραμμή (βοηθητική). */
  dash(...pts: P2[]): void;
  poly(pts: P2[], fill?: boolean): void;
  circle(x: number, y: number, r: number, fill?: boolean): void;
  rect(x0: number, y0: number, x1: number, y1: number): void;
  /** Βέλος (διάνυσμα)· το όνομα μπαίνει δίπλα στη μέση του, αριστερά της φοράς (πάνω σε οριζόντιο προς τα δεξιά). */
  arrow(x0: number, y0: number, x1: number, y1: number, name?: string, at?: P2): void;
  /** Μόνο η μύτη βέλους στο (x, y) με φορά (dx, dy) (για δυναμικές γραμμές). */
  head(x: number, y: number, dx: number, dy: number): void;
  text(t: string, x: number, y: number, size?: number, italic?: boolean): void;
  /** Καμπύλη από σημεία f(u), u από u0 ως u1. */
  curve(f: (u: number) => P2, u0: number, u1: number, n?: number, dashed?: boolean): void;
  /** Δάπεδο με γραμμούλες από κάτω. */
  ground(x0: number, x1: number, y: number): void;
  /** Τοίχος με γραμμούλες αριστερά. */
  wall(x: number, y0: number, y1: number): void;
  /** Σφαίρα με το όνομά της μέσα. */
  ball(x: number, y: number, r: number, name?: string): void;
  /** Κουτί (σώμα) με το όνομά του μέσα. */
  block(x0: number, y0: number, x1: number, y1: number, name?: string): void;
  dot(x: number, y: number): void;
  res(x0: number, x1: number, y: number, name: string): void;
  resV(x: number, y0: number, y1: number, name: string): void;
  cell(x0: number, x1: number, y: number, name?: string): void;
  /** Κατακόρυφη πηγή (+ πάνω)· right: τα σημάδια δεξιά και το όνομα αριστερά (πηγή στη δεξιά πλευρά). */
  cellV(x: number, y0: number, y1: number, name?: string, right?: boolean): void;
  meter(x0: number, x1: number, y: number, letter: string): void;
  lamp(x0: number, x1: number, y: number, name?: string): void;
  /** Ανοιχτός διακόπτης. */
  sw(x0: number, x1: number, y: number): void;
}

function kit(c: C, sx: number, sy: number): Kit {
  const s = Math.min(sx, sy);
  const P = (x: number, y: number): P2 => [x * sx, y * sy];
  const M = (pts: P2[]): number[][] => pts.map(([x, y]) => P(x, y));
  const k: Kit = {
    c, P, s,
    line: (...pts) => path(c, M(pts)),
    dash(...pts) {
      c.save();
      c.globalAlpha *= 0.7;
      c.lineWidth *= 0.6;
      c.setLineDash([7 * s, 6 * s]);
      path(c, M(pts));
      c.restore();
    },
    poly(pts, fill) {
      c.beginPath();
      M(pts).forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
      if (fill) c.fill();
      else c.stroke();
    },
    circle(x, y, r, fill) {
      const [px, py] = P(x, y);
      c.beginPath();
      c.ellipse(px, py, r * sx, r * sy, 0, 0, Math.PI * 2);
      if (fill) c.fill();
      else c.stroke();
    },
    rect: (x0, y0, x1, y1) => k.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]),
    arrow(x0, y0, x1, y1, name, at) {
      k.line([x0, y0], [x1, y1]);
      const len = Math.hypot(x1 - x0, y1 - y0) || 1;
      const ux = (x1 - x0) / len, uy = (y1 - y0) / len;
      k.head(x1, y1, ux, uy);
      // το όνομα πάει από την πάνω μεριά του βέλους (στα κατακόρυφα: αριστερά αν ανεβαίνει, δεξιά αν κατεβαίνει)
      const f = -ux > 0.01 ? -1 : 1;
      if (name) k.text(name, ...(at ?? [(x0 + x1) / 2 + f * uy * 18, (y0 + y1) / 2 - f * ux * 18]));
    },
    head(x, y, dx, dy) {
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len, hl = 12, hw = 5.5;
      k.poly([[x, y], [x - ux * hl - uy * hw, y - uy * hl + ux * hw], [x - ux * hl + uy * hw, y - uy * hl - ux * hw]], true);
    },
    text: (t, x, y, size = 21, italic = true) => label(c, t, ...P(x, y), size * s, italic),
    curve(f, u0, u1, n = 80, dashed) {
      const pts: P2[] = [];
      for (let i = 0; i <= n; i++) pts.push(f(u0 + ((u1 - u0) * i) / n));
      if (dashed) k.dash(...pts);
      else k.line(...pts);
    },
    ground(x0, x1, y) {
      k.line([x0, y], [x1, y]);
      const [a, b] = [P(x0, y), P(x1, y)];
      hatch(c, a[0] + 6 * s, a[1], b[0] - 6 * s, b[1], Math.max(4, Math.round((x1 - x0) / 22)), -8 * s, 8 * s);
    },
    wall(x, y0, y1) {
      k.line([x, y0], [x, y1]);
      const [a, b] = [P(x, y0), P(x, y1)];
      hatch(c, a[0], a[1] + 6 * s, b[0], b[1] - 6 * s, Math.max(4, Math.round((y1 - y0) / 22)), -8 * s, 8 * s);
    },
    ball(x, y, r, name) {
      k.circle(x, y, r);
      if (name) k.text(name, x, y, Math.min(20, r * 0.85));
    },
    block(x0, y0, x1, y1, name) {
      k.rect(x0, y0, x1, y1);
      if (name) k.text(name, (x0 + x1) / 2, (y0 + y1) / 2, Math.min(24, (y1 - y0) * 0.45));
    },
    dot(x, y) {
      const [px, py] = P(x, y);
      c.beginPath();
      c.arc(px, py, Math.max(3, 5 * s), 0, Math.PI * 2);
      c.fill();
    },
    res(x0, x1, y, name) {
      const m = (x0 + x1) / 2, half = 34;
      path(c, M([[x0, y], ...(zigzag(m - half, m + half, y, 11, 6) as P2[]), [x1, y]]));
      k.text(name, m, y - 27);
    },
    resV(x, y0, y1, name) {
      const m = (y0 + y1) / 2, half = 34;
      path(c, M([[x, y0], ...(zigzag(m - half, m + half, x, 11, 6) as P2[]).map(([a, b]) => [b, a] as P2), [x, y1]]));
      k.text(name, x + 32, m);
    },
    cell(x0, x1, y, name) {
      const m = (x0 + x1) / 2;
      k.line([x0, y], [m - 8, y]);
      k.line([m + 8, y], [x1, y]);
      k.line([m - 8, y - 26], [m - 8, y + 26]);
      c.save();
      c.lineWidth *= 2.2;
      k.line([m + 8, y - 13], [m + 8, y + 13]);
      c.restore();
      k.text('+', m - 24, y - 30);
      k.text('−', m + 24, y - 30);
      if (name) k.text(name, m, y + 42);
    },
    cellV(x, y0, y1, name, right) {
      const m = (y0 + y1) / 2;
      k.line([x, y0], [x, m - 8]);
      k.line([x, m + 8], [x, y1]);
      k.line([x - 26, m - 8], [x + 26, m - 8]);
      c.save();
      c.lineWidth *= 2.2;
      k.line([x - 13, m + 8], [x + 13, m + 8]);
      c.restore();
      const sd = right ? 1 : -1;
      k.text('+', x + sd * 32, m - 22);
      k.text('−', x + sd * 32, m + 22);
      if (name) k.text(name, x - sd * 40, m);
    },
    meter(x0, x1, y, letter) {
      const m = (x0 + x1) / 2, r = 20;
      k.line([x0, y], [m - r, y]);
      k.line([m + r, y], [x1, y]);
      k.circle(m, y, r);
      k.text(letter, m, y + 1, 22, false);
    },
    lamp(x0, x1, y, name) {
      const m = (x0 + x1) / 2, r = 20, q = r * Math.SQRT1_2;
      k.line([x0, y], [m - r, y]);
      k.line([m + r, y], [x1, y]);
      k.circle(m, y, r);
      k.line([m - q, y - q], [m + q, y + q]);
      k.line([m - q, y + q], [m + q, y - q]);
      if (name) k.text(name, m, y - 34);
    },
    sw(x0, x1, y) {
      const m = (x0 + x1) / 2;
      k.line([x0, y], [m - 26, y]);
      k.line([m + 26, y], [x1, y]);
      k.line([m - 26, y], [m + 20, y - 30]);
      k.dot(m - 26, y);
      k.dot(m + 26, y);
      k.text('Δ', m, y + 24);
    },
  };
  return k;
}

/** Σχήμα σε κουτί W × H σχεδίου. */
function fig(title: string, cat: keyof typeof STAMP_CATS, W: number, H: number, body: (k: Kit, st?: SpringState) => void, play = false): StampDef {
  return {
    label: title, cat, w: W, h: H, play: play || undefined,
    draw(c, w, h, st) {
      body(kit(c, w / W, h / H), st);
    },
  };
}

// ---------- κυκλώματα ----------

/** Τα δύο πλαϊνά σύρματα και η πηγή κάτω: κλείνουν τον βρόχο από τη γραμμή y = top ως y = bot. */
function loop(k: Kit, l: number, r: number, top: number, bot: number): void {
  k.line([l, top], [l, bot]);
  k.line([r, top], [r, bot]);
  k.cell(l, r, bot);
}

/** Κλάδος με αντιστάτη κάτω από το σύρμα y = top, από x0 ως x1, με τελείες στους κόμβους. */
function branch(k: Kit, x0: number, x1: number, top: number, y: number, name: string): void {
  k.line([x0, top], [x0, y]);
  k.line([x1, top], [x1, y]);
  k.res(x0, x1, y, name);
  k.dot(x0, top);
  k.dot(x1, top);
}

const circ = (title: string, W: number, H: number, body: (k: Kit) => void): StampDef => fig(title, 'circ', W, H, body);

const CIRCUITS: Record<string, StampDef> = {
  circSeries2: circ('Δύο σε σειρά', 380, 220, (k) => {
    k.res(20, 190, 50, 'R₁');
    k.res(190, 360, 50, 'R₂');
    loop(k, 20, 360, 50, 190);
  }),
  circPar2: circ('Δύο παράλληλα', 340, 270, (k) => {
    k.res(20, 320, 50, 'R₁');
    branch(k, 80, 260, 50, 130, 'R₂');
    loop(k, 20, 320, 50, 230);
  }),
  circSeries3: circ('Τρεις σε σειρά', 520, 220, (k) => {
    k.res(20, 180, 50, 'R₁');
    k.res(180, 340, 50, 'R₂');
    k.res(340, 500, 50, 'R₃');
    loop(k, 20, 500, 50, 190);
  }),
  circPar3: circ('Τρεις παράλληλα', 340, 350, (k) => {
    k.res(20, 320, 50, 'R₁');
    branch(k, 80, 260, 50, 130, 'R₂');
    branch(k, 80, 260, 130, 210, 'R₃');
    loop(k, 20, 320, 50, 310);
  }),
  circSeriesPar3: circ('R₁, R₂ σε σειρά, παράλληλα με R₃', 420, 270, (k) => {
    k.res(20, 210, 50, 'R₁');
    k.res(210, 400, 50, 'R₂');
    branch(k, 60, 360, 50, 130, 'R₃');
    loop(k, 20, 400, 50, 230);
  }),
  circParSeries3: circ('R₁ ∥ R₂, σε σειρά με R₃', 440, 270, (k) => {
    k.res(20, 240, 50, 'R₁');
    k.res(240, 420, 50, 'R₃');
    branch(k, 60, 240, 50, 130, 'R₂');
    loop(k, 20, 420, 50, 230);
  }),
  circMeters: circ('Με αμπερόμετρο και βολτόμετρο', 400, 290, (k) => {
    k.meter(20, 130, 130, 'A');
    k.res(130, 380, 130, 'R');
    // το βολτόμετρο παράλληλα στον αντιστάτη
    k.line([190, 130], [190, 50]);
    k.line([320, 130], [320, 50]);
    k.meter(190, 320, 50, 'V');
    k.dot(190, 130);
    k.dot(320, 130);
    loop(k, 20, 380, 130, 250);
  }),
  circLamp: circ('Λάμπα με διακόπτη', 380, 220, (k) => {
    k.sw(20, 170, 60);
    k.lamp(170, 360, 60, 'Λ');
    loop(k, 20, 360, 60, 180);
  }),
  circLamps2: circ('Δύο λάμπες παράλληλα, με διακόπτη', 400, 300, (k) => {
    k.sw(20, 150, 60);
    k.lamp(150, 380, 60, 'Λ₁');
    k.line([220, 60], [220, 150]);
    k.line([340, 60], [340, 150]);
    k.lamp(220, 340, 150, 'Λ₂');
    k.dot(220, 60);
    k.dot(340, 60);
    loop(k, 20, 380, 60, 250);
  }),
  circKirchhoff: circ('Δύο πηγές (Kirchhoff)', 460, 290, (k) => {
    k.res(30, 230, 40, 'R₁');
    k.res(230, 430, 40, 'R₂');
    k.line([30, 250], [430, 250]);
    k.cellV(30, 40, 250, 'E₁');
    k.cellV(430, 40, 250, 'E₂', true);
    k.resV(230, 40, 250, 'R₃');
    k.dot(230, 40);
    k.dot(230, 250);
  }),
};

// ---------- πεδία ----------

/** Δυναμικές γραμμές σημειακών φορτίων: ξεκινούν από τα θετικά και ακολουθούν την ένταση. */
function fieldLines(k: Kit, W: number, H: number, qs: { x: number; y: number; q: number }[]): void {
  const E = (x: number, y: number): P2 => {
    let ex = 0, ey = 0;
    for (const o of qs) {
      const dx = x - o.x, dy = y - o.y, r3 = Math.max(1, Math.hypot(dx, dy) ** 3);
      ex += (o.q * dx) / r3;
      ey += (o.q * dy) / r3;
    }
    return [ex, ey];
  };
  const n = 12;
  for (const src of qs.filter((o) => o.q > 0)) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / n;
      let x = src.x + 20 * Math.cos(a), y = src.y + 20 * Math.sin(a);
      const pts: P2[] = [[x, y]];
      for (let step = 0; step < 500; step++) {
        const [ex, ey] = E(x, y);
        const m = Math.hypot(ex, ey) || 1;
        x += (3 * ex) / m;
        y += (3 * ey) / m;
        pts.push([x, y]);
        if (x < 0 || y < 0 || x > W || y > H || qs.some((o) => o.q < 0 && Math.hypot(x - o.x, y - o.y) < 18)) break;
      }
      k.line(...pts);
      const j = Math.min(pts.length - 2, 22);
      if (j > 1) k.head(pts[j][0], pts[j][1], pts[j + 1][0] - pts[j][0], pts[j + 1][1] - pts[j][1]);
    }
  }
  for (const o of qs) {
    k.circle(o.x, o.y, 16);
    k.text(o.q > 0 ? '+' : '−', o.x, o.y + 1, 24, false);
  }
}

/** Σύμβολο ⊗ (προς τα μέσα) ή ⊙ (προς τα έξω). */
function intoPage(k: Kit, x: number, y: number, r: number, into: boolean): void {
  k.circle(x, y, r);
  if (into) {
    const q = r * Math.SQRT1_2;
    k.line([x - q, y - q], [x + q, y + q]);
    k.line([x - q, y + q], [x + q, y - q]);
  } else k.circle(x, y, r * 0.25, true);
}

// ---------- όλα τα σχήματα ----------

export const PHYSICS: Record<string, StampDef> = {
  // Δυνάμεις και κινήσεις
  friction: fig('Σώμα με τριβή', 'mech', 380, 240, (k) => {
    k.ground(10, 370, 170);
    k.block(140, 100, 240, 170, 'm');
    k.arrow(240, 135, 330, 135, 'F');
    k.arrow(140, 162, 70, 162, 'T', [92, 145]);
    k.arrow(190, 135, 190, 225, 'B', [208, 215]);
    k.arrow(190, 135, 190, 40, 'N', [172, 52]);
  }),
  projectile: fig('Οριζόντια βολή', 'mech', 420, 350, (k, st) => {
    const G = 250;
    k.ground(10, 410, G);
    k.line([10, 60], [70, 60], [70, G]);
    k.dash([40, 60], [40, G]);
    k.text('h', 26, 155);
    const at = (u: number): P2 => [70 + 280 * u, 60 + (G - 60) * u * u];
    k.arrow(395, 20, 395, 75, 'g', [410, 48]);
    // ταχύτητα στο σημείο u: σταθερή υx, υy που μεγαλώνει ανάλογα με τον χρόνο· και οι δύο ξεκινούν από το σώμα
    const vel = (u: number): void => {
      const [x, y] = at(u), vx = 50, vy = u * 2 * (G - 60) * (vx / 280);
      k.ball(x, y, 9);
      if (u < 0.02) return;
      k.dash([x + vx, y], [x + vx, y + vy], [x, y + vy]);
      k.arrow(x, y, x + vx, y, 'υx', [x + vx / 2, y - 16]);
      k.arrow(x, y, x, y + vy, 'υy', [x - 20, y + vy / 2 + 6]);
      k.arrow(x, y, x + vx, y + vy, 'υ', [x + vx + 2, y + vy + 18]);
    };
    if (st?.t !== undefined) {
      // με το ▶: η πτήση κρατά 1,8 s και μετά ξαναρχίζει· η τροχιά γράφεται όσο προχωρά
      const u = Math.min(1, (st.t % 2800) / 1800);
      if (u > 0) k.curve(at, 0, u, 60, true);
      if (u < 0.02) k.arrow(79, 60, 140, 60, 'υ₀');
      vel(u);
      return;
    }
    k.curve(at, 0, 1, 60, true);
    k.ball(70, 60, 9);
    k.arrow(79, 60, 140, 60, 'υ₀');
    // σε ένα σημείο της τροχιάς και λίγο πριν φτάσει στο έδαφος: συνιστώσες και ταχύτητα
    vel(0.5);
    vel(1);
  }, true),
  circular: fig('Ομαλή κυκλική κίνηση', 'mech', 300, 300, (k, st) => {
    const cx = 150, cy = 150, R = 100;
    k.circle(cx, cy, R);
    k.dot(cx, cy);
    k.text('O', cx - 14, cy + 14, 17, false);
    // με το ▶ γυρίζει αντίθετα από το ρολόι, μία στροφή στα 4 s
    const a = -Math.PI / 4 - (st?.t ?? 0) * ((2 * Math.PI) / 4000);
    const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
    k.dash([cx, cy], [x, y]);
    k.text('R', (cx + x) / 2 - 14 * Math.sin(a), (cy + y) / 2 + 14 * Math.cos(a), 18);
    k.ball(x, y, 11);
    const tx = Math.sin(a), ty = -Math.cos(a);
    k.arrow(x, y, x + 70 * tx, y + 70 * ty, 'υ', [x + 78 * tx + 14 * ty, y + 78 * ty - 14 * tx]);
    k.arrow(x, y, x - 50 * Math.cos(a), y - 50 * Math.sin(a), 'Fκ', [x - 32 * Math.cos(a) + 22 * tx, y - 32 * Math.sin(a) + 22 * ty]);
  }, true),
  lever: fig('Ράβδος με άρθρωση', 'mech', 400, 240, (k) => {
    k.wall(30, 50, 200);
    k.c.save();
    k.c.lineWidth *= 1.6;
    k.rect(30, 114, 360, 126);
    k.c.restore();
    k.circle(30, 120, 8);
    k.text('A', 50, 98, 19, false);
    k.arrow(360, 120, 360, 40, 'F', [378, 60]);
    k.dot(195, 120);
    k.arrow(195, 120, 195, 195, 'B', [213, 185]);
    k.line([30, 222], [360, 222]);
    k.line([30, 214], [30, 230]);
    k.line([360, 214], [360, 230]);
    k.text('ℓ', 280, 208, 20);
  }),

  // Ορμή και κρούσεις
  collision: fig('Κεντρική κρούση', 'mom', 440, 250, (k, st) => {
    // ίδιο μέγεθος (οι μάζες φαίνονται από τα ονόματα)
    const r1 = 26, r2 = 26;
    if (st?.t === undefined) {
      k.text('πριν', 34, 30, 17, false);
      k.ground(10, 430, 112);
      k.ball(110, 112 - r1, r1, 'm₁');
      k.ball(320, 112 - r2, r2, 'm₂');
      k.arrow(146, 112 - r1, 216, 112 - r1, 'υ₁');
      k.arrow(290, 112 - r2, 230, 112 - r2, 'υ₂');
      k.text('μετά', 34, 150, 17, false);
      k.ground(10, 430, 232);
      k.ball(150, 232 - r1, r1, 'm₁');
      k.ball(300, 232 - r2, r2, 'm₂');
      k.arrow(114, 232 - r1, 84, 232 - r1, 'υ₁′');
      k.arrow(330, 232 - r2, 420, 232 - r2, 'υ₂′');
      return;
    }
    // m₁ = 2m₂, υ₂ = −υ₁, ελαστική: υ₁′ = −υ₁/3, υ₂′ = 5υ₁/3
    const ta = 1600, tb = 1200, T = ta + tb + 1000, p = st.t % T;
    const u = 268 / (2 * ta), y = 180;
    k.ground(10, 430, y);
    const before = p < ta, q = Math.min(p, ta + tb) - ta;
    const x1 = before ? 60 + u * p : 60 + u * ta - (u / 3) * q;
    const x2 = before ? 380 - u * p : 380 - u * ta + ((5 * u) / 3) * q;
    k.ball(x1, y - r1, r1, 'm₁');
    k.ball(x2, y - r2, r2, 'm₂');
    if (before) {
      k.arrow(x1, y - r1 * 2 - 14, x1 + 60, y - r1 * 2 - 14, 'υ₁');
      k.arrow(x2, y - r2 * 2 - 14, x2 - 60, y - r2 * 2 - 14, 'υ₂');
    } else {
      k.arrow(x1, y - r1 * 2 - 14, x1 - 20, y - r1 * 2 - 14, 'υ₁′');
      k.arrow(x2, y - r2 * 2 - 14, x2 + 100, y - r2 * 2 - 14, 'υ₂′');
    }
  }, true),
  bullet: fig('Βλήμα σε ξύλο', 'mom', 440, 210, (k) => {
    k.ground(10, 430, 170);
    k.poly([[60, 134], [92, 134], [102, 140], [92, 146], [60, 146]], true);
    k.text('m', 80, 116, 19);
    k.arrow(112, 140, 172, 140, 'υ');
    k.block(220, 100, 300, 170, 'M');
    // μετά: το βλήμα σφηνωμένο, μαζί με το ξύλο
    k.c.save();
    k.c.setLineDash([7 * k.s, 6 * k.s]);
    k.rect(330, 100, 410, 170);
    k.c.restore();
    k.poly([[330, 134], [346, 134], [352, 140], [346, 146], [330, 146]], true);
    k.arrow(340, 80, 410, 80, 'V');
  }),
  explosion: fig('Έκρηξη σε δύο κομμάτια', 'mom', 420, 200, (k) => {
    k.c.save();
    k.c.setLineDash([7 * k.s, 6 * k.s]);
    k.circle(210, 100, 30);
    k.c.restore();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      k.line([210 + 36 * Math.cos(a), 100 + 36 * Math.sin(a)], [210 + 48 * Math.cos(a), 100 + 48 * Math.sin(a)]);
    }
    k.ball(110, 100, 24, 'm₁');
    k.arrow(86, 100, 30, 100, 'υ₁');
    k.ball(320, 100, 24, 'm₂');
    k.arrow(350, 100, 400, 100, 'υ₂');
  }),
  oblique: fig('Πλάγια κρούση', 'mom', 420, 290, (k) => {
    k.c.save();
    k.c.setLineDash([7 * k.s, 6 * k.s]);
    k.circle(60, 145, 22);
    k.c.restore();
    k.text('m₁', 60, 145, 17);
    k.arrow(86, 145, 190, 145, 'p₁');
    k.ball(222, 145, 22, 'm₂');
    k.dash([244, 145], [400, 145]);
    const a1 = (35 * Math.PI) / 180, a2 = (40 * Math.PI) / 180;
    k.arrow(222, 145, 222 + 140 * Math.cos(a1), 145 - 140 * Math.sin(a1), 'p₁′');
    k.arrow(222, 145, 222 + 130 * Math.cos(a2), 145 + 130 * Math.sin(a2), 'p₂′', [222 + 130 * Math.cos(a2) - 8, 145 + 130 * Math.sin(a2) + 20]);
    k.curve((u) => [222 + 70 * Math.cos(u), 145 + 70 * Math.sin(u)], -a1, 0, 20);
    k.curve((u) => [222 + 60 * Math.cos(u), 145 + 60 * Math.sin(u)], 0, a2, 20);
    k.text('φ', 310, 127, 18);
    k.text('θ', 300, 168, 18);
  }),

  // Ταλαντώσεις
  springHit: fig('Ελατήριο και κρούση', 'osc', 460, 150, (k) => {
    k.wall(14, 20, 130);
    k.ground(14, 450, 130);
    k.line(...(zigzag(14, 200, 92, 14, 14) as P2[]));
    k.block(200, 55, 272, 130, 'M');
    k.ball(390, 110, 20, 'm');
    k.arrow(364, 70, 304, 70, 'υ');
  }),

  // Κύματα
  waveT: fig('Εγκάρσιο κύμα', 'wave', 470, 210, (k, st) => {
    const y0 = 105, A = 50, lam = 180, x0 = 20, x1 = 450;
    const ph = ((st?.t ?? 0) / 1600) * Math.PI * 2;
    const Y = (x: number): number => y0 - A * Math.sin((2 * Math.PI * (x - x0)) / lam - ph);
    k.dash([x0, y0], [x1, y0]);
    k.curve((x) => [x, Y(x)], x0, x1, 120);
    // ένα μόριο του μέσου: ανεβοκατεβαίνει, δεν προχωρά
    k.dot(155, Y(155));
    k.arrow(380, 22, 440, 22, 'υ', [410, 6]);
    if (st?.t === undefined) {
      k.line([65, 36], [245, 36]);
      k.line([65, 28], [65, 44]);
      k.line([245, 28], [245, 44]);
      k.text('λ', 155, 22);
      k.dash([65, 55], [65, y0]);
      k.text('A', 50, 80);
    }
  }, true),
  waveL: fig('Διάμηκες κύμα', 'wave', 470, 180, (k, st) => {
    const lam = 150, D = 9;
    const ph = ((st?.t ?? 0) / 1600) * Math.PI * 2;
    for (let x0 = 20; x0 <= 450; x0 += 7) {
      const x = x0 + D * Math.sin((2 * Math.PI * x0) / lam - ph);
      k.line([x, 40], [x, 120]);
    }
    k.arrow(380, 18, 440, 18, 'υ', [410, 4]);
    if (st?.t === undefined) {
      k.text('πύκνωμα', 75, 145, 15, false);
      k.text('αραίωμα', 150, 165, 15, false);
      k.text('πύκνωμα', 225, 145, 15, false);
    }
  }, true),
  waveS: fig('Στάσιμο κύμα', 'wave', 470, 210, (k, st) => {
    const y0 = 105, A = 50, L = 400, x0 = 35, n = 3;
    const env = (x: number): number => A * Math.sin((n * Math.PI * (x - x0)) / L);
    const cs = Math.cos(((st?.t ?? 0) / 1400) * Math.PI * 2);
    k.curve((x) => [x, y0 - env(x)], x0, x0 + L, 120, true);
    k.curve((x) => [x, y0 + env(x)], x0, x0 + L, 120, true);
    k.curve((x) => [x, y0 - env(x) * cs], x0, x0 + L, 120);
    k.wall(x0, y0 - 30, y0 + 30);
    k.line([x0 + L, y0 - 30], [x0 + L, y0 + 30]);
    for (let i = 0; i <= n; i++) k.text('Δ', x0 + (L * i) / n, y0 + 75, 17, false);
    for (let i = 0; i < n; i++) k.text('Κ', x0 + (L * (i + 0.5)) / n, y0 - 75, 17, false);
  }, true),
  interference: fig('Συμβολή από δύο πηγές', 'wave', 420, 300, (k, st) => {
    const sp = 34, grow = (((st?.t ?? 0) / 1200) % 1) * sp;
    const [w, h] = k.P(420, 300);
    k.c.save();
    k.c.beginPath();
    k.c.rect(0, 0, w, h);
    k.c.clip();
    k.c.lineWidth *= 0.6;
    for (const sx of [160, 260]) for (let r = grow + 6; r < 360; r += sp) k.circle(sx, 150, r);
    k.c.restore();
    k.dot(160, 150);
    k.dot(260, 150);
    k.text('Π₁', 160, 175, 18);
    k.text('Π₂', 260, 175, 18);
  }, true),

  ...CIRCUITS,

  // Ηλεκτρικό και μαγνητικό πεδίο
  capField: fig('Πυκνωτής: ομογενές πεδίο', 'em', 300, 260, (k) => {
    k.c.save();
    k.c.lineWidth *= 2;
    k.line([90, 30], [90, 230]);
    k.line([210, 30], [210, 230]);
    k.c.restore();
    for (const y of [50, 90, 130, 170, 210]) {
      k.text('+', 72, y, 20, false);
      k.text('−', 228, y, 20, false);
    }
    for (const y of [70, 110, 150, 190]) {
      k.line([92, y], [208, y]);
      k.head(158, y, 1, 0);
    }
    k.text('E', 150, 18);
  }),
  dipole: fig('Αντίθετα φορτία', 'em', 420, 280, (k) => fieldLines(k, 420, 280, [{ x: 140, y: 140, q: 1 }, { x: 280, y: 140, q: -1 }])),
  likeCharges: fig('Ομώνυμα φορτία', 'em', 420, 280, (k) => fieldLines(k, 420, 280, [{ x: 140, y: 140, q: 1 }, { x: 280, y: 140, q: 1 }])),
  wireField: fig('Ρευματοφόρος αγωγός', 'em', 260, 260, (k) => {
    intoPage(k, 130, 130, 12, false);
    k.text('I', 150, 112, 19);
    for (const r of [45, 75, 105]) {
      k.circle(130, 130, r);
      // ρεύμα προς τα έξω: οι γραμμές γυρίζουν αντίθετα από το ρολόι
      k.head(130, 130 - r, -1, 0);
      k.head(130, 130 + r, 1, 0);
    }
    k.text('B', 220, 40);
  }),
  coilField: fig('Πηνίο (σωληνοειδές)', 'em', 440, 270, (k) => {
    for (const ry of [118, 92]) {
      k.curve((u) => [220 + 205 * Math.cos(u), 135 - ry * Math.sin(u)], 0.32, Math.PI - 0.32, 50);
      k.curve((u) => [220 + 205 * Math.cos(u), 135 + ry * Math.sin(u)], 0.32, Math.PI - 0.32, 50);
      k.head(220, 135 - ry, -1, 0);
      k.head(220, 135 + ry, -1, 0);
    }
    for (const y of [118, 135, 152]) {
      k.line([40, y], [400, y]);
      k.head(310, y, 1, 0);
    }
    for (let i = 0; i < 9; i++) k.curve((u) => [130 + i * 22 + 8 * Math.cos(u), 135 + 38 * Math.sin(u)], -Math.PI / 2, Math.PI / 2, 16);
    k.line([130, 97], [130, 240]);
    k.line([306, 173], [306, 240]);
    k.text('I', 116, 225, 19);
    k.text('S', 100, 135, 22, false);
    k.text('N', 340, 135, 22, false);
  }),
  rails: fig('Ράβδος σε ράγες', 'em', 440, 290, (k) => {
    for (let x = 100; x <= 410; x += 56) for (const y of [100, 190]) if (Math.abs(x - 270) > 25) intoPage(k, x, y, 8, true);
    k.text('B', 410, 30);
    k.line([30, 60], [425, 60]);
    k.line([30, 230], [425, 230]);
    k.resV(30, 60, 230, 'R');
    k.c.save();
    k.c.lineWidth *= 2.2;
    k.line([270, 50], [270, 240]);
    k.c.restore();
    k.arrow(270, 145, 345, 145, 'υ', [310, 128]);
    k.text('ℓ', 288, 258, 20);
  }),
};

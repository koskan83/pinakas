import { Pt, Stroke, uid } from './model';

/** 1 εκατοστό = 40 μονάδες πίνακα (ίδιο με το βήμα του πλέγματος). */
export const CM = 40;
const MM = CM / 10;

export type GadgetKind = 'ruler' | 'protractor' | 'compass';

export interface DrawStyle {
  color: string;
  width: number;
  hl: boolean;
  /** true όταν το ενεργό εργαλείο γράφει (στυλό/μαρκαδόρος). */
  drawing: boolean;
}

/** Ενεργό σύρσιμο πάνω σε όργανο. Αν έχει stroke, καταχωρείται στον πίνακα όταν σηκωθεί η γραφίδα. */
export interface GadgetDrag {
  stroke?: Stroke;
  move(wx: number, wy: number): void;
}

interface Ruler { x: number; y: number; a: number; len: number; h: number }
interface Protractor { x: number; y: number; a: number; r: number }
interface Compass { x: number; y: number; r: number; a: number }

const RULER_MARGIN = 20;
const SNAP_STEP = Math.PI / 12; // 15°
const SNAP_TOL = (2 * Math.PI) / 180;

function snapAngle(a: number): number {
  const n = Math.round(a / SNAP_STEP) * SNAP_STEP;
  return Math.abs(n - a) < SNAP_TOL ? n : a;
}

function toLocal(g: { x: number; y: number; a: number }, wx: number, wy: number): Pt {
  const dx = wx - g.x;
  const dy = wy - g.y;
  const c = Math.cos(g.a);
  const s = Math.sin(g.a);
  return [dx * c + dy * s, -dx * s + dy * c];
}

function normAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a <= -Math.PI) a += 2 * Math.PI;
  return a;
}

export class Gadgets {
  ruler: Ruler | null = null;
  protractor: Protractor | null = null;
  compass: Compass | null = null;

  has(kind: GadgetKind): boolean {
    return this[kind] !== null;
  }

  /** Εμφανίζει ή κρύβει ένα όργανο· εμφανίζεται στο κέντρο (cx, cy) της οθόνης. */
  toggle(kind: GadgetKind, cx: number, cy: number): void {
    if (this[kind]) {
      this[kind] = null;
      return;
    }
    if (kind === 'ruler') this.ruler = { x: cx, y: cy, a: 0, len: 20 * CM + 2 * RULER_MARGIN, h: 90 };
    else if (kind === 'protractor') this.protractor = { x: cx, y: cy + 100, a: 0, r: 280 };
    else this.compass = { x: cx - 60, y: cy, r: 3 * CM, a: 0 };
  }

  // ---------- είσοδος ----------

  down(wx: number, wy: number, k: number, style: DrawStyle): GadgetDrag | null {
    return this.compassDown(wx, wy, k, style) ?? this.rulerDown(wx, wy, k, style) ?? this.protractorDown(wx, wy, k);
  }

  private rulerDown(wx: number, wy: number, k: number, style: DrawStyle): GadgetDrag | null {
    const g = this.ruler;
    if (!g) return null;
    const [u, v] = toLocal(g, wx, wy);
    const knobU = g.len / 2 + 34 / k;
    if (Math.hypot(u - knobU, v) < 28 / k) {
      return { move: (x, y) => { g.a = snapAngle(Math.atan2(y - g.y, x - g.x)); } };
    }
    const half = g.h / 2;
    const out = 24 / k;
    if (Math.abs(u) > g.len / 2 + out || Math.abs(v) > half + out) return null;
    const inside = Math.abs(u) <= g.len / 2 && Math.abs(v) <= half;
    const nearEdge = Math.abs(v) > half ? Math.abs(v) - half <= out : half - Math.abs(v) <= Math.min(14 / k, half / 3);
    if (style.drawing && nearEdge) {
      // Γραμμή κατά μήκος της ακμής του χάρακα
      const sign = v < 0 ? -1 : 1;
      const lw = style.hl ? style.width * 4 : style.width;
      const off = sign * (half + lw / 2);
      const c = Math.cos(g.a);
      const s = Math.sin(g.a);
      const at = (uu: number): Pt => [g.x + uu * c - off * s, g.y + uu * s + off * c];
      let uMin = u;
      let uMax = u;
      const stroke: Stroke = { kind: 'stroke', id: uid(), pts: [at(u)], color: style.color, width: style.width, hl: style.hl };
      return {
        stroke,
        move: (x, y) => {
          const [uu] = toLocal(g, x, y);
          uMin = Math.min(uMin, uu);
          uMax = Math.max(uMax, uu);
          stroke.pts = [at(uMin), at(uMax)];
        },
      };
    }
    if (!inside) return null;
    const ox = wx - g.x;
    const oy = wy - g.y;
    return { move: (x, y) => { g.x = x - ox; g.y = y - oy; } };
  }

  private protractorDown(wx: number, wy: number, k: number): GadgetDrag | null {
    const g = this.protractor;
    if (!g) return null;
    const [u, v] = toLocal(g, wx, wy);
    if (Math.hypot(u - (g.r + 34 / k), v - 18) < 28 / k) {
      return { move: (x, y) => { g.a = snapAngle(Math.atan2(y - g.y, x - g.x)); } };
    }
    const inDome = v <= 0 && Math.hypot(u, v) <= g.r;
    const inBase = v > 0 && v <= 36 && Math.abs(u) <= g.r;
    if (!inDome && !inBase) return null;
    const ox = wx - g.x;
    const oy = wy - g.y;
    return { move: (x, y) => { g.x = x - ox; g.y = y - oy; } };
  }

  private compassDown(wx: number, wy: number, k: number, style: DrawStyle): GadgetDrag | null {
    const g = this.compass;
    if (!g) return null;
    const hit = 28 / k;
    const dir = (): Pt => [Math.cos(g.a), Math.sin(g.a)];
    const pencil = (): Pt => [g.x + g.r * dir()[0], g.y + g.r * dir()[1]];
    const [dx, dy] = dir();
    const knob: Pt = [g.x + (g.r + 50 / k) * dx, g.y + (g.r + 50 / k) * dy];
    const p = pencil();

    if (Math.hypot(wx - p[0], wy - p[1]) < hit) {
      // Το μολύβι χαράζει τόξο σταθερής ακτίνας
      const stroke: Stroke = { kind: 'stroke', id: uid(), pts: [p], color: style.color, width: style.width, hl: style.hl };
      return {
        stroke,
        move: (x, y) => {
          const delta = normAngle(Math.atan2(y - g.y, x - g.x) - g.a);
          const steps = Math.max(1, Math.ceil(Math.abs(delta) / ((2 * Math.PI) / 180)));
          for (let i = 0; i < steps; i++) {
            g.a += delta / steps;
            stroke.pts.push(pencil());
          }
        },
      };
    }
    if (Math.hypot(wx - knob[0], wy - knob[1]) < hit) {
      return {
        move: (x, y) => {
          const d = Math.hypot(x - g.x, y - g.y) - 50 / k;
          g.r = Math.max(MM * 5, Math.round(d / MM) * MM);
          g.a = Math.atan2(y - g.y, x - g.x);
        },
      };
    }
    if (Math.hypot(wx - g.x, wy - g.y) < hit) {
      const ox = wx - g.x;
      const oy = wy - g.y;
      return { move: (x, y) => { g.x = x - ox; g.y = y - oy; } };
    }
    return null;
  }

  // ---------- σχεδίαση ----------

  draw(c: CanvasRenderingContext2D, k: number, penColor: string): void {
    if (this.protractor) this.drawProtractor(c, this.protractor, k);
    if (this.ruler) this.drawRuler(c, this.ruler, k);
    if (this.compass) this.drawCompass(c, this.compass, k, penColor);
  }

  private knob(c: CanvasRenderingContext2D, x: number, y: number, k: number, label: string): void {
    c.save();
    c.beginPath();
    c.arc(x, y, 20 / k, 0, Math.PI * 2);
    c.fillStyle = '#2563eb';
    c.fill();
    c.fillStyle = '#fff';
    c.font = `${20 / k}px system-ui, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(label, x, y + 1 / k);
    c.restore();
  }

  private drawRuler(c: CanvasRenderingContext2D, g: Ruler, k: number): void {
    c.save();
    c.translate(g.x, g.y);
    c.rotate(g.a);
    const L = g.len;
    const half = g.h / 2;
    c.fillStyle = 'rgba(253, 224, 71, 0.55)';
    c.strokeStyle = '#854d0e';
    c.lineWidth = 1.5 / k;
    c.beginPath();
    c.rect(-L / 2, -half, L, g.h);
    c.fill();
    c.stroke();

    c.strokeStyle = '#422006';
    c.fillStyle = '#422006';
    c.lineWidth = 1 / k;
    c.font = '13px system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'top';
    const showMm = MM * k >= 3;
    const n = Math.round((L - 2 * RULER_MARGIN) / MM);
    c.beginPath();
    for (let i = 0; i <= n; i++) {
      const cm = i % 10 === 0;
      const five = i % 5 === 0;
      if (!cm && !five && !showMm) continue;
      const x = -L / 2 + RULER_MARGIN + i * MM;
      const len = cm ? 18 : five ? 12 : 7;
      c.moveTo(x, -half);
      c.lineTo(x, -half + len);
      c.moveTo(x, half);
      c.lineTo(x, half - (cm ? 10 : five ? 7 : 4));
      if (cm) c.fillText(String(i / 10), x, -half + 20);
    }
    c.stroke();

    let deg = Math.round((-g.a * 180) / Math.PI) % 180;
    if (deg < 0) deg += 180;
    c.font = '15px system-ui, sans-serif';
    c.textBaseline = 'alphabetic';
    c.fillText(`${deg}°   ·   cm`, 0, half - 14);
    c.restore();

    const kx = g.x + (L / 2 + 34 / k) * Math.cos(g.a);
    const ky = g.y + (L / 2 + 34 / k) * Math.sin(g.a);
    this.knob(c, kx, ky, k, '↻');
  }

  private drawProtractor(c: CanvasRenderingContext2D, g: Protractor, k: number): void {
    const r = g.r;
    c.save();
    c.translate(g.x, g.y);
    c.rotate(g.a);
    c.fillStyle = 'rgba(147, 197, 253, 0.45)';
    c.strokeStyle = '#1e3a8a';
    c.lineWidth = 1.5 / k;
    c.beginPath();
    c.arc(0, 0, r, Math.PI, 0);
    c.lineTo(r, 36);
    c.lineTo(-r, 36);
    c.closePath();
    c.fill();
    c.stroke();

    c.lineWidth = 1 / k;
    c.fillStyle = '#1e3a8a';
    const showDeg = ((r * Math.PI) / 180) * k >= 3;
    c.beginPath();
    for (let d = 0; d <= 180; d++) {
      const ten = d % 10 === 0;
      const five = d % 5 === 0;
      if (!ten && !five && !showDeg) continue;
      const t = (d * Math.PI) / 180;
      const len = ten ? 22 : five ? 15 : 9;
      c.moveTo(r * Math.cos(t), -r * Math.sin(t));
      c.lineTo((r - len) * Math.cos(t), -(r - len) * Math.sin(t));
    }
    // γραμμή βάσης και κέντρο
    c.moveTo(-r, 0);
    c.lineTo(r, 0);
    c.moveTo(0, -16);
    c.lineTo(0, 16);
    c.stroke();

    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (let d = 0; d <= 180; d += 10) {
      const t = (d * Math.PI) / 180;
      for (const [rad, val, font, alpha] of [[r - 36, d, 15, 1], [r - 60, 180 - d, 12, 0.6]] as const) {
        c.save();
        c.globalAlpha = alpha;
        c.font = `${font}px system-ui, sans-serif`;
        c.translate(rad * Math.cos(t), -rad * Math.sin(t));
        c.rotate(Math.PI / 2 - t);
        c.fillText(String(val), 0, 0);
        c.restore();
      }
    }
    c.restore();

    const cs = Math.cos(g.a);
    const sn = Math.sin(g.a);
    const u = r + 34 / k;
    this.knob(c, g.x + u * cs - 18 * sn, g.y + u * sn + 18 * cs, k, '↻');
  }

  private drawCompass(c: CanvasRenderingContext2D, g: Compass, k: number, penColor: string): void {
    const dx = Math.cos(g.a);
    const dy = Math.sin(g.a);
    const px = g.x + g.r * dx;
    const py = g.y + g.r * dy;
    c.save();
    // βοηθητικός κύκλος
    c.strokeStyle = 'rgba(100,116,139,0.6)';
    c.lineWidth = 1 / k;
    c.setLineDash([6 / k, 6 / k]);
    c.beginPath();
    c.arc(g.x, g.y, g.r, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
    // σκέλος
    c.strokeStyle = '#64748b';
    c.lineWidth = 6 / k;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(g.x, g.y);
    c.lineTo(px, py);
    c.stroke();
    // ακίδα (κέντρο)
    c.beginPath();
    c.arc(g.x, g.y, 16 / k, 0, Math.PI * 2);
    c.fillStyle = 'rgba(30,41,59,0.85)';
    c.fill();
    c.beginPath();
    c.arc(g.x, g.y, 3 / k, 0, Math.PI * 2);
    c.fillStyle = '#fff';
    c.fill();
    // μολύβι
    c.beginPath();
    c.arc(px, py, 16 / k, 0, Math.PI * 2);
    c.fillStyle = penColor;
    c.fill();
    c.strokeStyle = '#64748b';
    c.lineWidth = 3 / k;
    c.stroke();
    // ετικέτα ακτίνας
    const label = `r = ${(g.r / CM).toFixed(1)} cm`;
    c.font = `${15 / k}px system-ui, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const lx = g.x + (g.r / 2) * dx - (22 / k) * dy;
    const ly = g.y + (g.r / 2) * dy + (22 / k) * dx;
    const w = c.measureText(label).width + 12 / k;
    c.fillStyle = 'rgba(30,41,59,0.85)';
    c.fillRect(lx - w / 2, ly - 12 / k, w, 24 / k);
    c.fillStyle = '#fff';
    c.fillText(label, lx, ly);
    c.restore();
    this.knob(c, g.x + (g.r + 50 / k) * dx, g.y + (g.r + 50 / k) * dy, k, '↔');
  }
}

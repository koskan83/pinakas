/** Σχεδίαση των στοιχείων του πίνακα στον καμβά: γραμμές, σχήματα, άξονες, ανάλυση, τριγωνομετρικός κύκλος, μετρήσεις. */

import {
  AngleItem, AxesAn, AxesItem, Doc, FnDef, Item, Page, Pic, Pt, Shape, StampItem, Stroke, TextItem, TrigItem, angleDegrees, angleEnds, axesRange, isDark, isPoly, itemRot, tableLines, textFont, textLines, trianglePts, unrot,
} from './model';
import { Fn, Params, compileCached, domText, fnOf, keyPoints } from './expr';
import { Asymptotes, asymptotes, integrate, lineEq, nf, oneSided, riemann, slope, crossings } from './analysis';
import { STAMPS, SpringState } from './stamps';
import { CM } from './gadgets';
import { ANGLE_KEY, HL_ALPHA, angleSides, fmt, fmtU, hlFlat, measureAngles, measureSides, radText, sideText, trigPoint, unitsFor } from './measure';

/** Ό,τι χρειάζεται η σχεδίαση από τον πίνακα. */
export interface RenderHost {
  doc: Doc;
  readonly page: Page;
  selected: string | null;
  fnPreview: { index: number | null; expr: string; color: string } | null;
  paramPreview: Params | null;
  transparent: boolean;
  lctx: CanvasRenderingContext2D;
  ink(color: string, hl?: boolean): string;
  getImg(p: Pic): HTMLImageElement | null;
  springState(s: StampItem): SpringState;
}

export class Renderer {
  constructor(private b: RenderHost) {}

  paintBackground(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, k: number): void {
    const bg = this.b.doc.bg;
    const dark = isDark(bg);
    if (!this.b.transparent) {
      c.fillStyle = dark ? '#14201b' : '#ffffff';
      c.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
    if (bg === 'write' || bg === 'squares') {
      // τετράδια του Δημοτικού: γραμμές γραφής με βοηθητική διακεκομμένη για τα μικρά γράμματα, ή μεγάλα τετράγωνα αριθμητικής
      const step = bg === 'write' ? 130 : 80;
      if (step * k < 10) return;
      c.save();
      c.strokeStyle = 'rgba(37,99,235,0.42)';
      c.lineWidth = 1.6 / k;
      c.beginPath();
      for (let y = Math.floor(y0 / step) * step; y <= y1; y += step) { c.moveTo(x0, y); c.lineTo(x1, y); }
      for (let x = Math.floor(x0 / step) * step; bg === 'squares' && x <= x1; x += step) { c.moveTo(x, y0); c.lineTo(x, y1); }
      c.stroke();
      if (bg === 'write') {
        c.strokeStyle = 'rgba(37,99,235,0.3)';
        c.lineWidth = 1.2 / k;
        c.setLineDash([10 / k, 9 / k]);
        c.beginPath();
        for (let y = Math.floor(y0 / step) * step - 45; y <= y1; y += step) { c.moveTo(x0, y); c.lineTo(x1, y); }
        c.stroke();
      }
      c.restore();
      return;
    }
    const grid = bg.endsWith('grid');
    if (!grid && !bg.endsWith('lines')) return;
    // πλέγμα ανά 1 cm, γραμμές τετραδίου ανά 2 cm
    const step = grid ? 40 : 80;
    if (step * k < 8) return;
    if (grid) c.strokeStyle = dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.13)';
    else c.strokeStyle = dark ? 'rgba(147,197,253,0.3)' : 'rgba(37,99,235,0.3)';
    c.lineWidth = (grid ? 1 : 1.5) / k;
    c.beginPath();
    for (let x = Math.floor(x0 / step) * step; grid && x <= x1; x += step) {
      c.moveTo(x, y0);
      c.lineTo(x, y1);
    }
    for (let y = Math.floor(y0 / step) * step; y <= y1; y += step) {
      c.moveTo(x0, y);
      c.lineTo(x1, y);
    }
    c.stroke();
  }

  drawStroke(c: CanvasRenderingContext2D, s: Stroke): void {
    const pts = s.pts;
    c.save();
    c.strokeStyle = c.fillStyle = this.b.ink(s.color, s.hl);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    const w = s.hl ? s.width * 4 : s.width;
    if (s.hl) {
      // Πάνω στη σελίδα το υπογραμμιστικό «βάφει» μόνο ό,τι είναι πιο ανοιχτό από το χρώμα του (πιο σκούρο, σε σκούρο φόντο):
      // δεύτερο πέρασμα στο ίδιο σημείο δεν το σκουραίνει και η γραφή από κάτω μένει καθαρή.
      const dark = isDark(this.b.doc.bg);
      const flat = c !== this.b.lctx && !this.b.transparent ? hlFlat(this.b.ink(s.color, true), dark ? [20, 32, 27] : [255, 255, 255]) : null;
      if (flat) {
        c.strokeStyle = c.fillStyle = flat;
        c.globalCompositeOperation = dark ? 'lighten' : 'darken';
      } else c.globalAlpha = HL_ALPHA;
    }
    c.lineWidth = w;
    if (pts.length === 1) {
      c.beginPath();
      c.arc(pts[0][0], pts[0][1], w / 2, 0, Math.PI * 2);
      c.fill();
    } else {
      c.beginPath();
      c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2;
        const my = (pts[i][1] + pts[i + 1][1]) / 2;
        c.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
      }
      const last = pts[pts.length - 1];
      c.lineTo(last[0], last[1]);
      c.stroke();
    }
    c.restore();
  }

  private drawShape(c: CanvasRenderingContext2D, s: Shape): void {
    c.save();
    c.strokeStyle = c.fillStyle = this.b.ink(s.color);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.lineWidth = s.hl ? s.width * 4 : s.width;
    c.globalAlpha = s.hl ? 0.35 : 1;
    if (s.dash) c.setLineDash([10, 9]);
    c.beginPath();
    if (isPoly(s.shape)) {
      const t = trianglePts(s);
      t.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])));
      c.closePath();
    } else if (s.shape === 'table') {
      for (const [p, q] of tableLines(s)) {
        c.moveTo(p[0], p[1]);
        c.lineTo(q[0], q[1]);
      }
    } else if (s.shape === 'rect') {
      c.rect(Math.min(s.x0, s.x1), Math.min(s.y0, s.y1), Math.abs(s.x1 - s.x0), Math.abs(s.y1 - s.y0));
    } else if (s.shape === 'ellipse') {
      c.ellipse((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, Math.max(Math.abs(s.x1 - s.x0) / 2, 0.5), Math.max(Math.abs(s.y1 - s.y0) / 2, 0.5), 0, 0, Math.PI * 2);
    } else {
      c.moveTo(s.x0, s.y0);
      c.lineTo(s.x1, s.y1);
      if (s.shape === 'arrow') {
        const ang = Math.atan2(s.y1 - s.y0, s.x1 - s.x0);
        const L = Math.max(s.width * 4, 16);
        for (const d of [-0.45, 0.45]) {
          c.moveTo(s.x1, s.y1);
          c.lineTo(s.x1 - L * Math.cos(ang + d), s.y1 - L * Math.sin(ang + d));
        }
      }
    }
    c.stroke();
    // γωνία με το πιο κοντινό (σε άνοιγμα) προηγούμενο βέλος/ευθεία που ξεκινά από το ίδιο σημείο
    const l2 = Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
    if (s.angleWith && l2 > 20) {
      const a2 = Math.atan2(s.y1 - s.y0, s.x1 - s.x0);
      let best: { a1: number; d: number; len: number } | null = null;
      for (const o of this.b.page.items) {
        if (o.id === s.id) break;
        if (o.kind !== 'shape' || (o.shape !== 'arrow' && o.shape !== 'line') || Math.hypot(o.x0 - s.x0, o.y0 - s.y0) >= 1) continue;
        const l1 = Math.hypot(o.x1 - o.x0, o.y1 - o.y0);
        if (l1 <= 20) continue;
        const a1 = Math.atan2(o.y1 - o.y0, o.x1 - o.x0);
        let d = Math.abs(a1 - a2) % (2 * Math.PI);
        if (d > Math.PI) d = 2 * Math.PI - d;
        if (!best || d < best.d) best = { a1, d, len: Math.min(l1, l2) };
      }
      if (best) {
        c.globalAlpha = 1;
        this.drawAngleMark(c, s.x0, s.y0, best.a1, a2, best.len, s.width, Math.round((best.d * 180) / Math.PI));
      }
    }
    c.restore();
  }

  private drawText(c: CanvasRenderingContext2D, t: TextItem): void {
    c.save();
    c.fillStyle = this.b.ink(t.color);
    c.font = textFont(t.size);
    c.textBaseline = 'top';
    textLines(t).forEach((line, i) => c.fillText(line, t.x, t.y + i * t.size * 1.25));
    c.restore();
  }

  private drawAngle(c: CanvasRenderingContext2D, a: AngleItem): void {
    const [p1, p2] = angleEnds(a);
    const deg = angleDegrees(a);
    c.save();
    c.strokeStyle = c.fillStyle = this.b.ink(a.color);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.lineWidth = a.width;
    if (!a.arc) {
      c.beginPath();
      c.moveTo(p1[0], p1[1]);
      c.lineTo(a.x, a.y);
      c.lineTo(p2[0], p2[1]);
      c.stroke();
    }

    this.drawAngleMark(c, a.x, a.y, a.a1, a.a2, Math.min(a.len1, a.len2), a.width, deg, a.arc ? a.len1 * 0.4 : undefined);
    if (a.meas?.len) {
      c.fillStyle = isDark(this.b.doc.bg) ? '#5eead4' : '#0f766e';
      c.font = '600 17px system-ui, "Segoe UI", Roboto, sans-serif';
      for (const m of angleSides(a)) c.fillText(a.labels?.[m.i] ?? fmt(m.len / CM), m.pos[0], m.pos[1]);
    }
    c.restore();
  }

  /** Τόξο (ή τετραγωνάκι για ορθή γωνία) και ένδειξη μοιρών, με το τρέχον χρώμα του c. */
  private drawAngleMark(c: CanvasRenderingContext2D, x: number, y: number, a1: number, a2: number, len: number, width: number, deg: number, radius?: number): void {
    const r = radius ?? Math.max(18, Math.min(46, len * 0.4));
    const diff = Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1));
    c.lineWidth = Math.max(1.5, width * 0.5);
    c.beginPath();
    if (deg === 90) {
      const q = r * 0.6;
      const u1: Pt = [Math.cos(a1) * q, Math.sin(a1) * q];
      const u2: Pt = [Math.cos(a2) * q, Math.sin(a2) * q];
      c.moveTo(x + u1[0], y + u1[1]);
      c.lineTo(x + u1[0] + u2[0], y + u1[1] + u2[1]);
      c.lineTo(x + u2[0], y + u2[1]);
    } else {
      c.arc(x, y, r, a1, a1 + diff, diff < 0);
    }
    c.stroke();
    const mid = a1 + diff / 2;
    const lr = r + 26;
    c.font = '600 22px system-ui, "Segoe UI", Roboto, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(`${deg}°`, x + lr * Math.cos(mid), y + lr * Math.sin(mid));
  }

  private drawAxes(c: CanvasRenderingContext2D, a: AxesItem): void {
    const lines = axesRange(a);
    // κάθε άξονας μπορεί να έχει δική του κλίμακα: κάθε γραμμή αξίζει sx (οριζόντια) ή sy (κατακόρυφα)
    const sx = a.sx ?? 1, sy = a.sy ?? 1;
    const xmin = lines.xmin * sx, xmax = lines.xmax * sx;
    const ymin = lines.ymin * sy, ymax = lines.ymax * sy;
    const u = a.unit;
    const X = (v: number) => a.x + (v / sx) * u;
    const Y = (v: number) => a.y - (v / sy) * u;
    c.save();
    c.strokeStyle = c.fillStyle = this.b.ink(a.color);
    c.lineCap = 'round';
    c.lineJoin = 'round';

    // βοηθητικό πλέγμα
    c.globalAlpha = 0.16;
    c.lineWidth = 1;
    c.beginPath();
    for (let i = lines.xmin; i <= lines.xmax; i++) { c.moveTo(X(i * sx), Y(ymin)); c.lineTo(X(i * sx), Y(ymax)); }
    for (let j = lines.ymin; j <= lines.ymax; j++) { c.moveTo(X(xmin), Y(j * sy)); c.lineTo(X(xmax), Y(j * sy)); }
    c.stroke();
    c.globalAlpha = 1;

    // συναρτήσεις
    const live = a.id === this.b.selected;
    let all: FnDef[] = a.fns ?? [];
    const pv = live ? this.b.fnPreview : null;
    if (pv) all = pv.index === null ? [...all, { expr: pv.expr, color: pv.color }] : all.map((f, i) => (i === pv.index ? { ...f, expr: pv.expr } : f));
    const fns = all.filter((f) => !f.hidden);
    const prm: Params = { ...a.params, ...(live ? this.b.paramPreview : null) };
    if (fns.length) {
      c.save();
      c.beginPath();
      c.rect(X(xmin), Y(ymax), (lines.xmax - lines.xmin) * u, (lines.ymax - lines.ymin) * u);
      c.clip();
      c.lineWidth = 3;
      const n = Math.max(80, Math.min(1500, Math.round(((lines.xmax - lines.xmin) * u) / 1.5)));
      for (const f of fns) {
        const fn = fnOf(f);
        if (!fn) continue;
        c.strokeStyle = this.b.ink(f.color);
        c.beginPath();
        let pen = false, py = 0;
        for (let i = 0; i <= n; i++) {
          const xv = xmin + ((xmax - xmin) * i) / n;
          const yv = Math.max(-1e5 * sy, Math.min(1e5 * sy, fn(xv, prm)));
          if (!Number.isFinite(yv)) {
            pen = false;
            continue;
          }
          // μεγάλο άλμα = ασύμπτωτη: δεν ενώνουμε τα δύο σκέλη
          if (pen && Math.abs(yv - py) < ymax - ymin) c.lineTo(X(xv), Y(yv));
          else c.moveTo(X(xv), Y(yv));
          pen = true;
          py = yv;
        }
        c.stroke();
      }
      const info = a.an ? this.drawAnalysis(c, a, fns, prm) : [];
      c.restore();
      const lf = Math.max(11, Math.min(20, u * 0.45));
      c.font = `italic 600 ${lf}px system-ui, "Segoe UI", Roboto, sans-serif`;
      c.textAlign = 'left';
      c.textBaseline = 'top';
      fns.forEach((f, i) => {
        c.fillStyle = this.b.ink(f.color);
        c.fillText(compileCached(f.expr) ? (f.dom ? `${f.expr},  ${domText(f.dom, a.lx ?? 'x')}` : f.expr) : `${f.expr} ?`, X(xmax + 1.1 * sx), Y(ymax) + i * lf * 1.4);
      });
      if (a.points) {
        const ok = fns.map((f) => fnOf(f)).filter((f): f is Fn => !!f);
        const num = (v: number): string => String(+v.toFixed(2) || 0);
        c.font = `600 ${lf * 0.85}px system-ui, "Segoe UI", Roboto, sans-serif`;
        c.textBaseline = 'bottom';
        c.fillStyle = this.b.ink(a.color);
        for (const k of keyPoints(ok, prm, xmin, xmax, ymin, ymax)) {
          c.beginPath();
          c.arc(X(k.x), Y(k.y), Math.max(4, u * 0.09), 0, Math.PI * 2);
          c.fill();
          c.fillText(`(${num(k.x)}, ${num(k.y)})`, X(k.x) + 7, Y(k.y) - 5);
        }
      }
      // αποτελέσματα ανάλυσης, κάτω από τα ονόματα των συναρτήσεων
      c.font = `600 ${lf * 0.9}px system-ui, "Segoe UI", Roboto, sans-serif`;
      c.textBaseline = 'top';
      info.forEach(([text, col], i) => {
        c.fillStyle = col;
        c.fillText(text, X(xmax + 1.1 * sx), Y(ymax) + (fns.length + 0.6 + i) * lf * 1.4);
      });
      c.fillStyle = this.b.ink(a.color);
    }

    // άξονες με βέλη
    const ext = 0.6;
    const ex = ext * sx;
    const xa = xmin < 0 ? xmin - ex : 0;
    const ey = ext * sy;
    const ya = ymin < 0 ? ymin - ey : 0;
    const ah = Math.max(8, u * 0.22);
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(X(xa), a.y);
    c.lineTo(X(xmax + ex), a.y);
    c.moveTo(X(xmax + ex) - ah, a.y - ah * 0.55);
    c.lineTo(X(xmax + ex), a.y);
    c.lineTo(X(xmax + ex) - ah, a.y + ah * 0.55);
    c.moveTo(a.x, Y(ya));
    c.lineTo(a.x, Y(ymax + ey));
    c.moveTo(a.x - ah * 0.55, Y(ymax + ey) + ah);
    c.lineTo(a.x, Y(ymax + ey));
    c.lineTo(a.x + ah * 0.55, Y(ymax + ey) + ah);
    // υποδιαιρέσεις
    const t = Math.max(3, u * 0.1);
    for (let i = lines.xmin; i <= lines.xmax; i++) if (i !== 0) { c.moveTo(X(i * sx), a.y - t); c.lineTo(X(i * sx), a.y + t); }
    for (let j = lines.ymin; j <= lines.ymax; j++) if (j !== 0) { c.moveTo(a.x - t, Y(j * sy)); c.lineTo(a.x + t, Y(j * sy)); }
    c.stroke();

    // αριθμοί και ονόματα αξόνων
    const fs = Math.max(9, Math.min(17, u * 0.38));
    c.font = `${fs}px system-ui, "Segoe UI", Roboto, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'top';
    const nums = a.nums !== false;
    for (let i = lines.xmin; nums && i <= lines.xmax; i++) if (i !== 0) c.fillText(String(+(i * sx).toPrecision(10)), X(i * sx), a.y + t + 3);
    c.textAlign = 'right';
    c.textBaseline = 'middle';
    for (let j = lines.ymin; nums && j <= lines.ymax; j++) if (j !== 0) c.fillText(String(+(j * sy).toPrecision(10)), a.x - t - 4, Y(j * sy));
    c.textBaseline = 'top';
    c.fillText('O', a.x - t - 3, a.y + t + 3);
    c.font = `italic 600 ${fs * 1.25}px system-ui, "Segoe UI", Roboto, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'top';
    c.fillText(a.lx ?? 'x', X(xmax + ex), a.y + t + 4);
    c.textAlign = 'right';
    c.textBaseline = 'middle';
    c.fillText(a.ly ?? 'y', a.x - t - 6, Y(ymax + ey) + 4);
    c.restore();
  }

  /** Οι δύο πρώτες ορατές συναρτήσεις των αξόνων (σε αυτές δουλεύουν ολοκλήρωμα, όριο, εφαπτομένη) με τις παραμέτρους τους. */
  private axesFn(a: AxesItem): { f?: (x: number) => number; g?: (x: number) => number } {
    const prm: Params = { ...a.params, ...(a.id === this.b.selected ? this.b.paramPreview : null) };
    const ok = (a.fns ?? []).filter((d) => !d.hidden).map((d) => fnOf(d)).filter((d): d is Fn => !!d);
    return { f: ok[0] && ((x) => ok[0](x, prm)), g: ok[1] && ((x) => ok[1](x, prm)) };
  }

  /** Λαβές των εργαλείων ανάλυσης: άκρα ολοκλήρωσης και x0 πάνω στον άξονα x, τα υπόλοιπα πάνω στην καμπύλη. */
  axesHandles(a: AxesItem): { k: string; p: Pt }[] {
    const an = a.an;
    const { f } = this.axesFn(a);
    if (!an || !f) return [];
    const lines = axesRange(a);
    const sx = a.sx ?? 1, sy = a.sy ?? 1;
    const ymin = lines.ymin * sy, ymax = lines.ymax * sy;
    const X = (v: number) => a.x + (v / sx) * a.unit;
    const on = (x: number): Pt => {
      const y = f(x);
      return [X(x), a.y - ((Number.isFinite(y) ? Math.max(ymin, Math.min(ymax, y)) : 0) / sy) * a.unit];
    };
    const out: { k: string; p: Pt }[] = [];
    if (an.lim) out.push({ k: 'lim.x', p: on(an.lim.x) }, { k: 'lim.x0', p: [X(an.lim.x0), a.y] });
    if (an.tan) {
      out.push({ k: 'tan.x', p: on(an.tan.x) });
      if (an.tan.h) out.push({ k: 'tan.h', p: on(an.tan.x + an.tan.h) });
    }
    if (an.int) out.push({ k: 'int.a', p: [X(an.int.a), a.y] }, { k: 'int.b', p: [X(an.int.b), a.y] });
    return out;
  }

  /** Μετακίνηση μιας λαβής ανάλυσης στη θέση x (σε μονάδες των αξόνων). */
  moveAxesHandle(o: AxesItem, key: string, xw: number): AxesItem {
    const lines = axesRange(o);
    const sx = o.sx ?? 1;
    const xmin = lines.xmin * sx, xmax = lines.xmax * sx;
    const an: AxesAn = { ...o.an };
    let x = Math.max(xmin, Math.min(xmax, xw * sx));
    // βήμα 0,05 και «κούμπωμα» στους ακέραιους· το σημείο του ορίου κινείται πιο λεπτά, για να πλησιάζει το x0
    const snap = (v: number): number => { const l = v / sx; return +((Math.abs(l - Math.round(l)) < 0.08 ? Math.round(l) : Math.round(l * 20) / 20) * sx).toPrecision(10); };
    if (key === 'lim.x' && an.lim) {
      x = +(Math.round((x / sx) * 100) / 100 * sx).toPrecision(10);
      an.lim = { ...an.lim, x: Math.abs(x - an.lim.x0) < 0.012 * sx ? an.lim.x0 : x };
    } else if (key === 'lim.x0' && an.lim) an.lim = { ...an.lim, x0: snap(x) };
    else if (key === 'tan.x' && an.tan) an.tan = { ...an.tan, x: snap(x) };
    else if (key === 'tan.h' && an.tan) {
      const h = +((Math.round(((x - an.tan.x) / sx) * 20) / 20) * sx).toPrecision(10);
      an.tan = { ...an.tan, h: Math.abs(h) < 0.05 * sx ? (x < an.tan.x ? -0.05 : 0.05) * sx : h };
    } else if ((key === 'int.a' || key === 'int.b') && an.int) {
      // τα άκρα «κουμπώνουν» στα σημεία τομής των δύο καμπυλών (ή στις ρίζες, όταν το χωρίο είναι ως τον άξονα x)
      const { f, g } = this.axesFn(o);
      const xs = f ? crossings(f, an.int.between && g ? g : null, xmin, xmax) : [];
      const hit = xs.find((c) => Math.abs(c - x) < 0.3 * sx);
      const v = hit ?? snap(x);
      an.int = key === 'int.a' ? { ...an.int, a: v } : { ...an.int, b: v };
    }
    return { ...o, an };
  }

  private asymCache = new Map<string, Asymptotes>();

  /**
   * Σχεδιάζει μέσα στο πλαίσιο των αξόνων τα εργαλεία ανάλυσης (ολοκλήρωμα, Riemann, όριο, εφαπτομένη, ασύμπτωτες)
   * και επιστρέφει τις γραμμές κειμένου με τα αποτελέσματα.
   */
  private drawAnalysis(c: CanvasRenderingContext2D, a: AxesItem, fns: FnDef[], prm: Params): [string, string][] {
    const an = a.an!;
    const lines = axesRange(a);
    const sx = a.sx ?? 1, sy = a.sy ?? 1;
    const xmin = lines.xmin * sx, xmax = lines.xmax * sx;
    const ymin = lines.ymin * sy, ymax = lines.ymax * sy;
    const u = a.unit;
    const X = (v: number) => a.x + (v / sx) * u;
    const Y = (v: number) => a.y - Math.max(-1e5, Math.min(1e5, v / sy)) * u;
    const dark = isDark(this.b.doc.bg);
    const ink = this.b.ink(a.color);
    const ok = fns.map((d) => ({ d, fn: fnOf(d) })).filter((o): o is { d: FnDef; fn: Fn } => !!o.fn);
    const info: [string, string][] = [];
    if (!ok.length) return info;
    const f = (x: number): number => ok[0].fn(x, prm);
    const fcol = this.b.ink(ok[0].d.color);
    const dot = (x: number, y: number, col: string, hollow = false): void => {
      c.beginPath();
      c.arc(X(x), Y(y), Math.max(5, u * 0.11), 0, Math.PI * 2);
      c.fillStyle = hollow ? (dark ? '#14201b' : '#ffffff') : col;
      c.strokeStyle = col;
      c.lineWidth = 2.5;
      c.setLineDash([]);
      c.fill();
      c.stroke();
    };
    const lineThrough = (x: number, y: number, m: number): void => {
      c.beginPath();
      c.moveTo(X(xmin), Y(y + m * (xmin - x)));
      c.lineTo(X(xmax), Y(y + m * (xmax - x)));
      c.stroke();
    };
    c.save();

    if (an.asym) {
      c.lineWidth = 1.8;
      c.setLineDash([9, 7]);
      const fs = Math.max(10, Math.min(16, u * 0.36));
      c.font = `600 ${fs}px system-ui, "Segoe UI", Roboto, sans-serif`;
      for (const o of ok) {
        const key = `${o.d.expr}|${JSON.stringify(prm)}|${xmin}|${xmax}`;
        let as = this.asymCache.get(key);
        if (!as) {
          if (this.asymCache.size > 200) this.asymCache.clear();
          as = asymptotes((x) => o.fn(x, prm), xmin, xmax);
          this.asymCache.set(key, as);
        }
        c.strokeStyle = c.fillStyle = this.b.ink(o.d.color);
        c.textBaseline = 'top';
        for (const x of as.vx) {
          c.beginPath();
          c.moveTo(X(x), Y(ymin));
          c.lineTo(X(x), Y(ymax));
          c.stroke();
          c.textAlign = 'left';
          c.fillText(`x = ${nf(x)}`, X(x) + 5, Y(ymax) + 4);
        }
        for (const l of as.lines) {
          lineThrough(0, l.b, l.m);
          // η ετικέτα μπαίνει στο δεξί (ή αριστερό) άκρο όπου η ευθεία είναι μέσα στο πλαίσιο
          const right = l.m * xmax + l.b <= ymax && l.m * xmax + l.b >= ymin;
          const lx = right ? xmax : xmin;
          c.textAlign = right ? 'right' : 'left';
          c.textBaseline = 'bottom';
          c.fillText(lineEq(l.m, l.b), X(lx) + (right ? -5 : 5), Y(l.m * lx + l.b) - 4);
        }
      }
      c.setLineDash([]);
    }

    if (an.int) {
      const lo = Math.min(an.int.a, an.int.b), hi = Math.max(an.int.a, an.int.b);
      const g = an.int.between && ok[1] ? (x: number): number => ok[1].fn(x, prm) : null;
      const base = (x: number): number => (g ? g(x) : 0);
      const d = (x: number): number => f(x) - base(x);
      // το κομμάτι κάτω από τον άξονα σε άλλο χρώμα από τη συνάρτηση
      const reds = ['#fb7185', '#e11d48'];
      const neg = reds.includes(fcol) ? (dark ? '#7dd3fc' : '#2563eb') : reds[dark ? 0 : 1];
      const fin = (v: number): number => (Number.isFinite(v) ? v : 0);
      if (an.int.n) {
        const n = an.int.n, w = (hi - lo) / n;
        c.lineWidth = 1.5;
        for (let i = 0; i < n; i++) {
          const x = lo + i * w, h = fin(d(x)), b0 = fin(base(x));
          c.fillStyle = c.strokeStyle = h >= 0 ? fcol : neg;
          c.globalAlpha = 0.22;
          c.fillRect(X(x), Y(b0 + h), (w / sx) * u, Y(b0) - Y(b0 + h));
          c.globalAlpha = 0.9;
          c.strokeRect(X(x), Y(b0 + h), (w / sx) * u, Y(b0) - Y(b0 + h));
        }
      } else {
        const n = 240;
        for (const sign of [1, -1]) {
          c.beginPath();
          for (let i = 0; i <= n; i++) {
            const x = lo + ((hi - lo) * i) / n, b0 = fin(base(x)), h = fin(d(x));
            c.lineTo(X(x), Y(b0 + (h * sign > 0 ? h : 0)));
          }
          for (let i = n; i >= 0; i--) {
            const x = lo + ((hi - lo) * i) / n;
            c.lineTo(X(x), Y(fin(base(x))));
          }
          c.closePath();
          c.fillStyle = sign > 0 ? fcol : neg;
          c.globalAlpha = 0.25;
          c.fill();
        }
      }
      c.globalAlpha = 1;
      c.strokeStyle = ink;
      c.lineWidth = 1.5;
      c.beginPath();
      for (const x of [an.int.a, an.int.b]) {
        c.moveTo(X(x), Y(fin(base(x))));
        c.lineTo(X(x), Y(fin(f(x))));
      }
      c.stroke();
      if (g) {
        // τα σημεία τομής των δύο καμπυλών μέσα στο πλαίσιο, για να φαίνεται από πού ως πού είναι το χωρίο
        for (const x of crossings(f, g, xmin, xmax)) {
          const y = f(x);
          if (Number.isFinite(y) && y >= ymin && y <= ymax) dot(x, y, ink, true);
        }
      }
      const what = g ? '(f − g)' : 'f(x)';
      const val = integrate(d, an.int.a, an.int.b);
      info.push([`∫ ${what}dx από ${nf(an.int.a)} έως ${nf(an.int.b)} = ${nf(val)}`, ink]);
      info.push([`Εμβαδόν Ε = ${nf(integrate((x) => Math.abs(d(x)), lo, hi))} τ.μ.`, ink]);
      if (an.int.n) info.push([`Άθροισμα Riemann, ν = ${an.int.n}: Sν = ${nf(riemann(d, an.int.a, an.int.b, an.int.n))}`, ink]);
    }

    if (an.tan) {
      const x = an.tan.x, y = f(x);
      const tc = dark ? '#fbbf24' : '#d97706';
      const sc = dark ? '#c4b5fd' : '#7c3aed';
      if (Number.isFinite(y)) {
        if (an.tan.h) {
          const y2 = f(x + an.tan.h);
          if (Number.isFinite(y2)) {
            const ms = (y2 - y) / an.tan.h;
            c.strokeStyle = sc;
            c.lineWidth = 2;
            lineThrough(x, y, ms);
            dot(x + an.tan.h, y2, sc);
            info.push([`Τέμνουσα (h = ${nf(an.tan.h)}): λ = ${nf(ms)}`, sc]);
          }
        }
        const m = slope(f, x);
        if (Number.isFinite(m)) {
          c.strokeStyle = tc;
          c.lineWidth = 2.5;
          lineThrough(x, y, m);
          info.push([`f′(${nf(x)}) = ${nf(m)}`, tc], [`Εφαπτομένη: ${lineEq(m, y - m * x)}`, tc]);
        } else info.push([`f′(${nf(x)}): δεν υπάρχει`, tc]);
        dot(x, y, tc);
      } else info.push([`f(${nf(x)}): δεν ορίζεται`, tc]);
    }

    if (an.lim) {
      const { x0, x } = an.lim;
      const y = f(x);
      c.strokeStyle = ink;
      c.lineWidth = 1.5;
      c.setLineDash([6, 6]);
      c.beginPath();
      c.moveTo(X(x0), Y(ymin));
      c.lineTo(X(x0), Y(ymax));
      if (Number.isFinite(y)) {
        c.moveTo(X(x), Y(0));
        c.lineTo(X(x), Y(y));
        c.lineTo(X(0), Y(y));
      }
      c.stroke();
      c.setLineDash([]);
      const l = oneSided(f, x0, -1), r = oneSided(f, x0, 1);
      const at = f(x0);
      for (const v of new Set([l, r])) {
        if (v !== null && Number.isFinite(v) && !(Number.isFinite(at) && Math.abs(at - v) < 1e-6)) dot(x0, v, fcol, true);
      }
      if (Number.isFinite(at)) dot(x0, at, fcol);
      if (Number.isFinite(y)) dot(x, y, ink);
      const txt = (v: number | null): string => (v === null ? 'δεν υπάρχει' : nf(v));
      info.push([`x = ${nf(x)}   f(x) = ${Number.isFinite(y) ? (+y.toFixed(3) || 0).toLocaleString('el', { maximumFractionDigits: 3 }).replace('-', '−') : 'δεν ορίζεται'}`, ink]);
      if (l !== null && l === r) info.push([`lim f(x) = ${nf(l)}  όταν x → ${nf(x0)}`, ink]);
      else info.push([`x → ${nf(x0)}⁻ :  lim f(x) = ${txt(l)}`, ink], [`x → ${nf(x0)}⁺ :  lim f(x) = ${txt(r)}`, ink]);
    }
    c.restore();
    return info;
  }

  private drawStamp(c: CanvasRenderingContext2D, s: StampItem): void {
    const d = STAMPS[s.name];
    if (!d) return;
    c.save();
    c.translate(s.x, s.y);
    c.strokeStyle = c.fillStyle = this.b.ink(s.color);
    c.lineWidth = s.width;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    if (d.drawKid) d.drawKid(c, s.w, s.h, s.v ?? d.init ?? [], { ink: this.b.ink(s.color), bg: isDark(this.b.doc.bg) ? '#14201b' : '#ffffff' });
    else d.draw(c, s.w, s.h, d.spring ? this.b.springState(s) : undefined);
    c.restore();
  }

  private drawTrig(c: CanvasRenderingContext2D, t: TrigItem): void {
    const { x, y, r, a } = t;
    const [px, py] = trigPoint(t);
    const dark = isDark(this.b.doc.bg);
    const cosC = dark ? '#7dd3fc' : '#2563eb';
    const sinC = dark ? '#fb7185' : '#e11d48';
    const ink = this.b.ink(t.color);
    c.save();
    c.lineCap = 'round';
    c.strokeStyle = c.fillStyle = ink;
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(x - r * 1.2, y); c.lineTo(x + r * 1.2, y);
    c.moveTo(x, y - r * 1.2); c.lineTo(x, y + r * 1.2);
    c.stroke();
    c.lineWidth = 2.5;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.moveTo(x, y); c.lineTo(px, py);
    c.stroke();
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(x, y, r * 0.2, 0, -a, true);
    c.stroke();
    // η γωνία σε μοίρες πάνω στο σχήμα, στη διχοτόμο του τόξου
    const degOn = ((Math.round((a * 180) / Math.PI) % 360) + 360) % 360;
    c.font = `600 ${r * 0.1}px system-ui, "Segoe UI", Roboto, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    if (degOn < 40) c.fillText(`${degOn}°`, x + r * 0.4, y + r * 0.1);
    else if (degOn > 320) c.fillText(`${degOn}°`, x + r * 0.4, y - r * 0.1);
    else {
      // κοντά στις 180° η διχοτόμος πέφτει πάνω στον κατακόρυφο άξονα: τη γέρνουμε λίγο
      const m = Math.abs(degOn - 180) < 25 ? a / 2 - 0.3 : a / 2;
      c.fillText(`${degOn}°`, x + r * 0.36 * Math.cos(m), y - r * 0.36 * Math.sin(m));
    }
    c.lineWidth = 5;
    c.strokeStyle = cosC;
    c.beginPath();
    c.moveTo(x, y); c.lineTo(px, y);
    c.stroke();
    c.strokeStyle = sinC;
    c.beginPath();
    c.moveTo(px, y); c.lineTo(px, py);
    c.stroke();
    c.beginPath();
    c.arc(px, py, Math.max(6, r * 0.045), 0, Math.PI * 2);
    c.fill();

    const fs = r * 0.11;
    const sin = Math.sin(a), cos = Math.cos(a);
    const deg = ((Math.round((a * 180) / Math.PI) % 360) + 360) % 360;
    const n2 = (v: number) => (Math.abs(v) < 0.005 ? 0 : v).toLocaleString('el', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    c.font = `600 ${fs}px system-ui, "Segoe UI", Roboto, sans-serif`;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    const parts: [string, string][] = [
      [`θ = ${radText(deg)} rad`, ink],
      [`ημθ = ${n2(sin)}`, sinC],
      [`συνθ = ${n2(cos)}`, cosC],
      [`εφθ = ${Math.abs(cos) < 1e-9 ? '—' : n2(sin / cos)}`, ink],
    ];
    const gap = fs * 1.1;
    const widths = parts.map(([text]) => c.measureText(text).width);
    let tx = x - (widths.reduce((p, w) => p + w, 0) + gap * 3) / 2;
    parts.forEach(([text, col], i) => {
      c.fillStyle = col;
      c.fillText(text, tx, y + r * 1.28 + fs);
      tx += widths[i] + gap;
    });
    c.restore();
  }

  /** Οι μετρήσεις που έχουν ζητηθεί για ένα σχήμα (μήκη, γωνίες, εμβαδόν, περίμετρος), σε μονάδες του χάρακα. */
  drawMeasures(c: CanvasRenderingContext2D, s: Shape): void {
    const o = s.meas;
    if (s.dash || !o) return;
    c.save();
    c.fillStyle = isDark(this.b.doc.bg) ? '#5eead4' : '#0f766e';
    c.font = '600 17px system-ui, "Segoe UI", Roboto, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    if (s.rot) {
      // στραμμένο ορθογώνιο ή έλλειψη: οι μετρήσεις στρέφονται μαζί του
      const mx = (s.x0 + s.x1) / 2, my = (s.y0 + s.y1) / 2;
      c.translate(mx, my);
      c.rotate(s.rot);
      c.translate(-mx, -my);
    }
    const len = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);
    const sides = measureSides(s);
    // πάνω σε άξονες οι μετρήσεις είναι στις μονάδες τους (π.χ. s και m/s), όχι σε εκατοστά
    const un = unitsFor(this.b.page.items, s);
    const same = Math.abs(un.kx - un.ky) <= 1e-9 * Math.max(un.kx, un.ky);
    const num = un.axes ? fmtU : fmt;
    const isLine = s.shape === 'line' || s.shape === 'arrow';
    if (o.len) for (const m of sides) {
      const text = s.labels?.[m.i] ?? sideText(m, un, isLine);
      // μακριά ετικέτα (π.χ. «λ = 20») πάει λίγο πιο μακριά από την πλευρά, για να μην πέφτει πάνω της
      const far = text.length > 4 ? 1 + Math.min(1.6, (text.length - 4) * 0.22) : 1;
      const mx = (m.a[0] + m.b[0]) / 2, my = (m.a[1] + m.b[1]) / 2;
      c.fillText(text, mx + (m.pos[0] - mx) * far, my + (m.pos[1] - my) * far);
    }
    // με δικές σου ετικέτες το σχήμα δεν είναι σε κλίμακα: εμβαδόν και περίμετρος δεν θα είχαν νόημα
    const scaled = !Object.keys(s.labels ?? {}).some((key) => +key < ANGLE_KEY);
    const { x0, y0, x1, y1 } = s;
    /** Γραμμές κειμένου στο κέντρο του σχήματος. */
    const mid: string[] = [];
    let ctr: Pt = [(x0 + x1) / 2, (y0 + y1) / 2];
    /** Μοίρες στην κορυφή p, λίγο προς το εσωτερικό (σημείο g). */
    const corner = (p: Pt, q: Pt, w: Pt, g: Pt): void => {
      const u1 = Math.atan2(q[1] - p[1], q[0] - p[0]), u2 = Math.atan2(w[1] - p[1], w[0] - p[0]);
      let d = Math.abs(u1 - u2) % (2 * Math.PI);
      if (d > Math.PI) d = 2 * Math.PI - d;
      const gl = Math.max(len(p, g), 1);
      const off = Math.min(42, gl * 0.45);
      c.fillText(`${Math.round((d * 180) / Math.PI)}°`, p[0] + ((g[0] - p[0]) / gl) * off, p[1] + ((g[1] - p[1]) / gl) * off);
    };
    if (s.shape === 'rect') {
      const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
      if (o.ang && same && w > 110 && h > 70) {
        const q: Pt[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
        for (let i = 0; i < 4; i++) corner(q[i], q[(i + 1) % 4], q[(i + 3) % 4], ctr);
      }
      if (scaled && o.area) mid.push(`Ε = ${num(w * un.kx * h * un.ky)}`);
      if (scaled && o.per && same) mid.push(`Π = ${num(2 * (w + h) * un.kx)}`);
    } else if (s.shape === 'ellipse') {
      const a = Math.abs(x1 - x0) / 2, b = Math.abs(y1 - y0) / 2;
      const circle = Math.abs(a - b) < Math.max(a, b) * 0.03;
      if (o.len) mid.push(circle && same ? `r = ${num(a * un.kx)}` : `a = ${num(a * un.kx)}  b = ${num(b * un.ky)}`);
      if (o.area) mid.push(`Ε = ${num(Math.PI * a * un.kx * b * un.ky)}`);
      // περίμετρος έλλειψης: προσέγγιση του Ramanujan (ακριβής για κύκλο)
      if (o.per && same) mid.push(`Π = ${num(Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b))) * un.kx)}`);
    } else if (isPoly(s.shape)) {
      const t = trianglePts(s);
      const n = t.length;
      ctr = [t.reduce((a, p) => a + p[0], 0) / n, t.reduce((a, p) => a + p[1], 0) / n];
      // εμβαδόν πολυγώνου από τις κορυφές του
      const area = Math.abs(t.reduce((a, p, i) => a + p[0] * t[(i + 1) % n][1] - t[(i + 1) % n][0] * p[1], 0)) / 2;
      if (o.ang && same) for (const m of measureAngles(s)) c.fillText(s.labels?.[ANGLE_KEY + m.i] ?? `${m.deg}°`, m.pos[0], m.pos[1]);
      if (scaled && o.area) mid.push(`Ε = ${num(area * un.kx * un.ky)}`);
      if (scaled && o.per && same) mid.push(`Π = ${num(t.reduce((a, p, i) => a + len(p, t[(i + 1) % n]), 0) * un.kx)}`);
    }
    mid.forEach((text, i) => c.fillText(text, ctr[0], ctr[1] + (i - (mid.length - 1) / 2) * 24));
    c.restore();
  }

  drawItem(c: CanvasRenderingContext2D, it: Item): void {
    const rot = itemRot(it);
    if (rot) {
      const [mx, my] = unrot(it, 0, 0), [ox, oy] = unrot(it, 1, 0);
      // ο αντίστροφος του unrot: στροφή κατά rot γύρω από το κέντρο του στοιχείου
      c.save();
      c.transform(ox - mx, -(oy - my), oy - my, ox - mx, 0, 0);
      c.translate(-mx, -my);
      this.drawItemRaw(c, it);
      c.restore();
      return;
    }
    this.drawItemRaw(c, it);
  }

  private drawItemRaw(c: CanvasRenderingContext2D, it: Item): void {
    switch (it.kind) {
      case 'stamp':
        this.drawStamp(c, it);
        break;
      case 'trig':
        this.drawTrig(c, it);
        break;
      case 'angle':
        this.drawAngle(c, it);
        break;
      case 'axes':
        this.drawAxes(c, it);
        break;
      case 'stroke':
        this.drawStroke(c, it);
        break;
      case 'shape':
        this.drawShape(c, it);
        break;
      case 'text':
        this.drawText(c, it);
        break;
      case 'image': {
        const img = this.b.getImg(it);
        if (img) c.drawImage(img, it.x, it.y, it.w, it.h);
      }
    }
  }}

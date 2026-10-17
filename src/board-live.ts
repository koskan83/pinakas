/** Το πάνω, «ζωντανό» στρώμα: ό,τι σχεδιάζεται τώρα, η επιλογή με τις λαβές της, λέιζερ και λάσο (μέθοδοι της Board, σε δικό τους αρχείο). */

import { Item, Pt, Shape, itemBounds, snapLine } from './model';
import { LASER_MS, type Board, type Box } from './board';

export function renderLive(bd: Board): void {
  const c = bd.lctx;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, bd.live.width, bd.live.height);
  bd.setWorldTransform(c);
  const k = bd.page.view.k;
  const selIds = bd.selectedIds();
  if (bd.region && bd.tool === 'select' && (selIds.size === 0 || bd.page.items.some((it) => it.kind === 'image' && selIds.has(it.id)))) {
    // η περιοχή που θα δει το AI: φαίνεται όταν το λάσο έπιασε κομμάτι εικόνας και όχι ξεχωριστά στοιχεία
    const r = bd.region;
    c.save();
    c.strokeStyle = '#7c68b0';
    c.fillStyle = 'rgba(124,104,176,.07)';
    c.lineWidth = 2 / k;
    c.setLineDash([8 / k, 6 / k]);
    c.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
    c.strokeRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
    c.restore();
  }
  for (const id of new Set([...bd.osc.keys(), ...(bd.oscDrag ? [bd.oscDrag.id] : [])])) {
    const it = bd.page.items.find((x) => x.id === id);
    if (it && !bd.replay) bd.r.drawItem(c, it);
  }
  let selItem: Item | undefined;
  for (const p of bd.ptrs.values()) {
    if (p.live) {
      bd.r.drawItem(c, p.live);
      if (p.live.kind === 'shape' && p.live.meas) bd.r.drawMeasures(c, p.live);
      if (p.live.kind === 'shape' && (p.live.shape === 'line' || p.live.shape === 'arrow') && !p.live.angleWith) drawSlope(c, p.live, k);
    } else if (p.stroke) bd.r.drawStroke(c, p.stroke);
    if (p.lasso && p.lasso.length > 1) {
      c.save();
      c.strokeStyle = '#2563eb';
      c.fillStyle = 'rgba(37,99,235,0.07)';
      c.lineWidth = 2 / k;
      c.setLineDash([8 / k, 6 / k]);
      c.beginPath();
      p.lasso.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
      c.fill();
      c.stroke();
      c.restore();
    }
    if (p.preview) {
      bd.r.drawItem(c, p.preview);
      selItem = p.preview;
    }
  }
  if (!selItem && bd.selected) selItem = bd.page.items.find((x) => x.id === bd.selected);
  if (selItem && bd.tool === 'select') {
    const b = itemBounds(selItem);
    c.save();
    c.strokeStyle = '#2563eb';
    c.lineWidth = 2 / k;
    c.setLineDash([8 / k, 6 / k]);
    c.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    c.setLineDash([]);
    c.fillStyle = '#2563eb';
    if (bd.cornerResizable(selItem)) {
      c.beginPath();
      c.arc(b.x1, b.y1, 12 / k, 0, Math.PI * 2);
      c.fill();
    }
    // στους άξονες οι λαβές είναι πολλές και κοντά: μικρότερες, με λευκό περίγραμμα
    const hr = (selItem.kind === 'axes' ? 8 : 12) / k;
    for (const p of bd.pointHandles(selItem)) {
      c.beginPath();
      c.arc(p[0], p[1], hr, 0, Math.PI * 2);
      c.fill();
      if (selItem.kind === 'axes') {
        c.setLineDash([]);
        c.strokeStyle = '#ffffff';
        c.lineWidth = 2 / k;
        c.stroke();
      }
    }
    if (bd.rotatable(selItem)) {
      drawRotHandle(bd, c, b);
      if (bd.pivot?.key === bd.pivotKey()) drawPivot(bd, c, bd.pivotPoint(b, selItem));
    }
    c.restore();
  }
  if (bd.multi.length && bd.tool === 'select') {
    const ids = new Set(bd.multi);
    c.save();
    c.strokeStyle = '#2563eb';
    c.fillStyle = '#2563eb';
    c.lineWidth = 1 / k;
    c.globalAlpha = 0.5;
    for (const it of bd.page.items) {
      if (!ids.has(it.id)) continue;
      const ib = itemBounds(it);
      c.strokeRect(ib.x0, ib.y0, ib.x1 - ib.x0, ib.y1 - ib.y0);
    }
    c.globalAlpha = 1;
    const b = bd.groupBounds();
    if (b) {
      c.lineWidth = 2 / k;
      c.setLineDash([8 / k, 6 / k]);
      c.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      c.beginPath();
      c.arc(b.x1, b.y1, 12 / k, 0, Math.PI * 2);
      c.fill();
      drawRotHandle(bd, c, b);
      if (bd.pivot?.key === bd.pivotKey()) drawPivot(bd, c, bd.pivotPoint(b));
    }
    c.restore();
  }
  if (bd.lasers.length) {
    const now = performance.now();
    c.save();
    c.strokeStyle = c.fillStyle = '#ff2d2d';
    c.shadowColor = '#ff2d2d';
    c.shadowBlur = 14;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.lineWidth = 6 / k;
    for (const l of bd.lasers) {
      c.globalAlpha = l.t ? Math.max(0, 1 - (now - l.t) / LASER_MS) : 1;
      c.beginPath();
      l.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      if (l.pts.length === 1) c.lineTo(l.pts[0][0] + 0.01, l.pts[0][1]);
      c.stroke();
    }
    c.restore();
  }
  bd.gadgets.draw(c, k, bd.ink(bd.color));
  if (bd.eraserAt) {
    c.save();
    c.strokeStyle = '#ef4444';
    c.fillStyle = 'rgba(239,68,68,0.12)';
    c.lineWidth = 2 / k;
    c.beginPath();
    c.arc(bd.eraserAt.x, bd.eraserAt.y, bd.eraserRadius(), 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.restore();
  }
}

/** Όσο τραβιέται μια ευθεία: η γωνία της με το οριζόντιο, με διακεκομμένη οριζόντια και τόξο· πράσινη όταν κούμπωσε στα 15°. */
function drawSlope(c: CanvasRenderingContext2D, l: Shape, k: number): void {
  const len = Math.hypot(l.x1 - l.x0, l.y1 - l.y0);
  if (len < 30 / k) return;
  const { deg, snap } = snapLine(l.x0, l.y0, l.x1, l.y1);
  const col = snap ? '#16a34a' : '#475569';
  const h = l.x1 >= l.x0 - 1e-6 ? 0 : Math.PI, t = Math.atan2(l.y1 - l.y0, l.x1 - l.x0);
  let d = t - h;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const ra = Math.min(46 / k, len * 0.45), ref = Math.min(len, 110 / k);
  c.save();
  c.strokeStyle = col;
  c.lineWidth = 2 / k;
  c.setLineDash([6 / k, 5 / k]);
  c.beginPath();
  c.moveTo(l.x0, l.y0);
  c.lineTo(l.x0 + Math.cos(h) * ref, l.y0);
  c.stroke();
  c.setLineDash([]);
  if (Math.abs(d) > 1e-3) {
    c.beginPath();
    c.arc(l.x0, l.y0, ra, h, h + d, d < 0);
    c.stroke();
  }
  // η ετικέτα στη μέση του τόξου, λίγο έξω από αυτό
  const m = h + d / 2, rl = ra + 26 / k;
  const tx = l.x0 + Math.cos(m) * rl, ty = l.y0 + Math.sin(m) * rl;
  const txt = `${Math.round(deg)}°`;
  c.font = `700 ${18 / k}px system-ui, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const w = c.measureText(txt).width + 12 / k, hh = 26 / k;
  c.fillStyle = 'rgba(255,255,255,.92)';
  c.beginPath();
  c.roundRect(tx - w / 2, ty - hh / 2, w, hh, 8 / k);
  c.fill();
  c.strokeStyle = col;
  c.lineWidth = 1.5 / k;
  c.stroke();
  c.fillStyle = col;
  c.fillText(txt, tx, ty + 1 / k);
  c.restore();
}

function drawPivot(bd: Board, c: CanvasRenderingContext2D, p: Pt): void {
  const k = bd.page.view.k;
  c.save();
  c.setLineDash([]);
  c.lineWidth = 2.5 / k;
  c.strokeStyle = '#2563eb';
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.arc(p[0], p[1], 11 / k, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = '#2563eb';
  c.beginPath();
  c.arc(p[0], p[1], 4 / k, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function drawRotHandle(bd: Board, c: CanvasRenderingContext2D, b: Box): void {
  const k = bd.page.view.k;
  const [hx, hy] = bd.rotHandle(b);
  c.save();
  c.setLineDash([]);
  c.strokeStyle = c.fillStyle = '#2563eb';
  c.lineWidth = 2 / k;
  c.beginPath();
  c.moveTo(hx, b.y0);
  c.lineTo(hx, hy);
  c.stroke();
  c.beginPath();
  c.arc(hx, hy, 12 / k, 0, Math.PI * 2);
  c.fill();
  // κυκλικό βελάκι μέσα στη λαβή
  c.strokeStyle = '#ffffff';
  c.lineWidth = 1.8 / k;
  c.beginPath();
  c.arc(hx, hy, 6 / k, -0.3, Math.PI * 1.45);
  c.stroke();
  c.beginPath();
  c.moveTo(hx + 2 / k, hy - 9 / k);
  c.lineTo(hx + 6.5 / k, hy - 3 / k);
  c.lineTo(hx + 9.5 / k, hy - 8.5 / k);
  c.stroke();
  c.restore();
}

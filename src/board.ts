import {
  AngleItem, AxesItem, AxesMode, Background, Doc, Item, Op, Page, Pic, Pt, Shape, ShapeKind, Stroke, TextItem, Tool, View,
  angleDegrees, angleEnds, axesRange, erasePartial, hitItem, isDark, itemBounds, newDoc, newPage, reboxShape, recognizeShape, roundAngle,
  textFont, textLines, translateItem, trianglePts, uid,
} from './model';
import { CM, GadgetDrag, GadgetKind, Gadgets } from './gadgets';

type Mode = 'draw' | 'shape' | 'gadget' | 'erase' | 'move' | 'resize' | 'pan' | 'none';

interface PState {
  id: number;
  type: string;
  x: number;
  y: number;
  t0: number;
  mode: Mode;
  stroke?: Stroke;
  /** Σχήμα που σχεδιάζεται ή «κλειδώθηκε» από αναγνώριση. */
  live?: Shape | AngleItem;
  /** Ποια λαβή σύρεται (για γωνία: 1 ή 2). */
  handle?: number;
  timer?: number;
  gadget?: GadgetDrag;
  /** Η λίστα της σελίδας πριν αρχίσει το σβήσιμο. */
  before?: Item[];
  changed?: boolean;
  orig?: Item;
  preview?: Item;
  start?: Pt;
  v0?: View;
}

interface Gesture {
  a: number;
  b: number;
  c0: Pt;
  d0: number;
  v0: View;
}

export type SizedTool = 'pen' | 'highlighter' | 'eraser';
export type EraserMode = 'stroke' | 'partial';

export class Board {
  doc: Doc = newDoc();
  cur = 0;
  tool: Tool = 'pen';
  color = '#111111';
  /** Πάχος ανά εργαλείο· για τη γόμα είναι η ακτίνα του κύκλου (px οθόνης). */
  sizes: Record<SizedTool, number> = { pen: 4, highlighter: 4, eraser: 16 };
  /** 'stroke': σβήνει ολόκληρη τη γραμμή· 'partial': μόνο ό,τι είναι μέσα στον κύκλο. */
  eraserMode: EraserMode = 'partial';
  shapeKind: ShapeKind | 'angle' = 'line';
  readonly gadgets = new Gadgets();
  selected: string | null = null;
  palmThreshold = 40;
  /** Ύψος (px) που καλύπτει η γραμμή εργαλείων στο κάτω μέρος. */
  bottomInset = 110;

  /** Ζητά από το UI να ανοίξει editor κειμένου. */
  onTextRequest: (x: number, y: number, existing?: TextItem) => void = () => {};
  onChange: () => void = () => {};
  onUi: () => void = () => {};
  onPointerInfo: (e: PointerEvent, count: number) => void = () => {};

  private undoStack: Op[] = [];
  private redoStack: Op[] = [];
  private imgs = new Map<string, HTMLImageElement>();
  private ptrs = new Map<number, PState>();
  private gesture: Gesture | null = null;
  private eraserAt: { x: number; y: number } | null = null;
  private dpr = 1;
  private W = 0;
  private H = 0;
  private bctx: CanvasRenderingContext2D;
  private lctx: CanvasRenderingContext2D;

  constructor(private base: HTMLCanvasElement, private live: HTMLCanvasElement) {
    this.bctx = base.getContext('2d')!;
    this.lctx = live.getContext('2d')!;
    this.bindEvents();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // ---------- κατάσταση / σελίδες ----------

  get page(): Page {
    return this.doc.pages[this.cur];
  }

  get width(): number {
    return this.tool === 'highlighter' ? this.sizes.highlighter : this.sizes.pen;
  }

  /** Το χρώμα όπως φαίνεται στο τρέχον φόντο: το μαύρο γίνεται λευκό σε σκούρο πίνακα και αντίστροφα. */
  ink(color: string): string {
    const dark = isDark(this.doc.bg);
    if (dark && color === '#111111') return '#ffffff';
    if (!dark && color === '#ffffff') return '#111111';
    return color;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  setTool(t: Tool): void {
    this.tool = t;
    if (t !== 'select') this.selected = null;
    this.renderLive();
    this.onUi();
  }

  /** Εμφάνιση/απόκρυψη οργάνου (χάρακας, μοιρογνωμόνιο, διαβήτης). */
  toggleGadget(kind: GadgetKind): void {
    const [cx, cy] = this.toWorld(this.W / 2, (this.H - this.bottomInset) / 2);
    this.gadgets.toggle(kind, cx, cy);
    this.renderLive();
    this.onUi();
  }

  setBackground(bg: Background): void {
    this.doc.bg = bg;
    this.redraw();
    this.onChange();
    this.onUi();
  }

  loadDoc(d: Doc): void {
    if (!d || d.v !== 1 || !Array.isArray(d.pages) || d.pages.length === 0) {
      throw new Error('Μη έγκυρο αρχείο πίνακα');
    }
    this.doc = d;
    this.cur = 0;
    this.selected = null;
    this.undoStack = [];
    this.redoStack = [];
    this.redraw();
    this.onChange();
    this.onUi();
  }

  goto(i: number): void {
    if (i < 0 || i >= this.doc.pages.length) return;
    this.cur = i;
    this.selected = null;
    this.redraw();
    this.onUi();
  }

  addPage(): void {
    this.doc.pages.push(newPage());
    this.goto(this.doc.pages.length - 1);
    this.onChange();
  }

  deletePage(): void {
    if (this.doc.pages.length === 1) {
      this.doc.pages[0] = newPage();
    } else {
      this.doc.pages.splice(this.cur, 1);
      this.cur = Math.min(this.cur, this.doc.pages.length - 1);
    }
    this.undoStack = [];
    this.redoStack = [];
    this.selected = null;
    this.redraw();
    this.onChange();
    this.onUi();
  }

  /** Προσθέτει σελίδες στο τέλος. Αν ο πίνακας έχει μία κενή σελίδα, την αντικαθιστά. */
  appendPages(pages: Page[]): void {
    if (pages.length === 0) return;
    const only = this.doc.pages;
    let first = only.length;
    if (only.length === 1 && only[0].items.length === 0) {
      only.splice(0, 1);
      first = 0;
    }
    for (const p of pages) this.fitPage(p);
    only.push(...pages);
    this.undoStack = [];
    this.redoStack = [];
    this.goto(first);
    this.onChange();
  }

  // ---------- ιστορικό ----------

  private push(op: Op): void {
    this.undoStack.push(op);
    this.redoStack = [];
    this.onChange();
    this.onUi();
  }

  private apply(op: Op, inverse: boolean): void {
    if (op.t === 'set') {
      this.doc.pages[op.p].items = (inverse ? op.before : op.after).slice();
      return;
    }
    const items = this.doc.pages[op.p].items;
    const removeById = (id: string) => {
      const i = items.findIndex((x) => x.id === id);
      if (i >= 0) items.splice(i, 1);
    };
    if (op.t === 'add') {
      if (inverse) removeById(op.item.id);
      else items.push(op.item);
    } else if (op.t === 'del') {
      if (inverse) {
        for (const { item, i } of [...op.items].sort((a, b) => a.i - b.i)) items.splice(i, 0, item);
      } else {
        for (const { item } of op.items) removeById(item.id);
      }
    } else {
      const target = inverse ? op.before : op.after;
      const i = items.findIndex((x) => x.id === target.id);
      if (i >= 0) items[i] = target;
    }
  }

  undo(): void {
    const op = this.undoStack.pop();
    if (!op) return;
    this.apply(op, true);
    this.redoStack.push(op);
    this.afterHistory(op);
  }

  redo(): void {
    const op = this.redoStack.pop();
    if (!op) return;
    this.apply(op, false);
    this.undoStack.push(op);
    this.afterHistory(op);
  }

  private afterHistory(op: Op): void {
    this.cur = op.p;
    this.selected = null;
    this.redraw();
    this.onChange();
    this.onUi();
  }

  // ---------- εικόνες / στοιχεία ----------

  addPicture(src: string, iw: number, ih: number): Pic {
    const k = this.page.view.k;
    const maxW = (this.W * 0.6) / k;
    const maxH = ((this.H - this.bottomInset) * 0.7) / k;
    const s = Math.min(maxW / iw, maxH / ih);
    const w = iw * s;
    const h = ih * s;
    const c = this.toWorld(this.W / 2, (this.H - this.bottomInset) / 2);
    const pic: Pic = { kind: 'image', id: uid(), x: c[0] - w / 2, y: c[1] - h / 2, w, h, src };
    this.page.items.push(pic);
    this.push({ t: 'add', p: this.cur, item: pic });
    this.tool = 'select';
    this.selected = pic.id;
    this.redraw();
    return pic;
  }

  /** Εισαγωγή καρτεσιανών αξόνων στο κέντρο της οθόνης. */
  addAxes(mode: AxesMode): void {
    const axes: AxesItem = { kind: 'axes', id: uid(), x: 0, y: 0, unit: CM, mode, nx: 10, ny: 10, color: this.color };
    // μικραίνουμε τη μονάδα ώστε να χωράνε ολόκληροι στην οθόνη
    const full = itemBounds(axes);
    const k = this.page.view.k;
    const fit = Math.min(
      (this.W * 0.9) / k / (full.x1 - full.x0),
      (Math.max(this.H - this.bottomInset, 100) * 0.92) / k / (full.y1 - full.y0),
    );
    axes.unit = CM * Math.min(1, fit);
    const b = itemBounds(axes);
    const c = this.toWorld(this.W / 2, (this.H - this.bottomInset) / 2);
    axes.x = c[0] - (b.x0 + b.x1) / 2;
    axes.y = c[1] - (b.y0 + b.y1) / 2;
    this.page.items.push(axes);
    this.push({ t: 'add', p: this.cur, item: axes });
    this.tool = 'select';
    this.selected = axes.id;
    this.redraw();
    this.onUi();
  }

  /** Οι επιλεγμένοι άξονες, αν η επιλογή είναι άξονες. */
  get selectedAxes(): AxesItem | null {
    const it = this.selected ? this.page.items.find((x) => x.id === this.selected) : undefined;
    return it && it.kind === 'axes' ? it : null;
  }

  /** Αλλάζει το όνομα ενός άξονα (π.χ. y → υ για ταχύτητα). */
  setAxisLabel(axis: 'x' | 'y', label: string): void {
    const before = this.selectedAxes;
    if (!before) return;
    const after: AxesItem = axis === 'x' ? { ...before, lx: label } : { ...before, ly: label };
    const i = this.page.items.indexOf(before);
    this.page.items[i] = after;
    this.push({ t: 'mod', p: this.cur, before, after });
    this.redraw();
  }

  deleteSelected(): void {
    if (!this.selected) return;
    const items = this.page.items;
    const i = items.findIndex((x) => x.id === this.selected);
    if (i < 0) return;
    const [item] = items.splice(i, 1);
    this.selected = null;
    this.push({ t: 'del', p: this.cur, items: [{ item, i }] });
    this.redraw();
  }

  clearPage(): void {
    const items = this.page.items;
    if (items.length === 0) return;
    const removed = items.map((item, i) => ({ item, i }));
    items.length = 0;
    this.selected = null;
    this.push({ t: 'del', p: this.cur, items: removed });
    this.redraw();
  }

  fitView(): void {
    this.fitPage(this.page);
    this.redraw();
    this.onChange();
  }

  private fitPage(page: Page): void {
    const items = page.items;
    const v = page.view;
    if (items.length === 0) {
      v.x = 0; v.y = 0; v.k = 1;
      return;
    }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const it of items) {
      const b = itemBounds(it);
      x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0);
      x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1);
    }
    const bw = Math.max(x1 - x0, 1);
    const bh = Math.max(y1 - y0, 1);
    const availH = Math.max(this.H - this.bottomInset, 100);
    const k = Math.min(this.W / (bw * 1.06), availH / (bh * 1.06), 4);
    v.k = k;
    v.x = this.W / 2 - ((x0 + x1) / 2) * k;
    v.y = availH / 2 - ((y0 + y1) / 2) * k;
  }

  // ---------- συντεταγμένες ----------

  private toWorld(sx: number, sy: number): Pt {
    const v = this.page.view;
    return [(sx - v.x) / v.k, (sy - v.y) / v.k];
  }

  // ---------- σχεδίαση ----------

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    for (const c of [this.base, this.live]) {
      c.width = Math.round(this.W * this.dpr);
      c.height = Math.round(this.H * this.dpr);
      c.style.width = this.W + 'px';
      c.style.height = this.H + 'px';
    }
    this.redraw();
  }

  private getImg(p: Pic): HTMLImageElement | null {
    let img = this.imgs.get(p.id);
    if (!img) {
      img = new Image();
      img.onload = () => this.redraw();
      img.src = p.src;
      this.imgs.set(p.id, img);
    }
    return img.complete && img.naturalWidth > 0 ? img : null;
  }

  private paintBackground(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, k: number): void {
    const bg = this.doc.bg;
    const dark = isDark(bg);
    c.fillStyle = dark ? '#14201b' : '#ffffff';
    c.fillRect(x0, y0, x1 - x0, y1 - y0);
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

  private drawStroke(c: CanvasRenderingContext2D, s: Stroke): void {
    const pts = s.pts;
    c.save();
    c.strokeStyle = c.fillStyle = this.ink(s.color);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    const w = s.hl ? s.width * 4 : s.width;
    c.globalAlpha = s.hl ? 0.35 : 1;
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
    c.strokeStyle = c.fillStyle = this.ink(s.color);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.lineWidth = s.hl ? s.width * 4 : s.width;
    c.globalAlpha = s.hl ? 0.35 : 1;
    c.beginPath();
    if (s.shape === 'triangle') {
      const t = trianglePts(s);
      c.moveTo(t[0][0], t[0][1]);
      c.lineTo(t[1][0], t[1][1]);
      c.lineTo(t[2][0], t[2][1]);
      c.closePath();
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
    c.restore();
  }

  private drawText(c: CanvasRenderingContext2D, t: TextItem): void {
    c.save();
    c.fillStyle = this.ink(t.color);
    c.font = textFont(t.size);
    c.textBaseline = 'top';
    textLines(t).forEach((line, i) => c.fillText(line, t.x, t.y + i * t.size * 1.25));
    c.restore();
  }

  private drawAngle(c: CanvasRenderingContext2D, a: AngleItem): void {
    const [p1, p2] = angleEnds(a);
    const deg = angleDegrees(a);
    c.save();
    c.strokeStyle = c.fillStyle = this.ink(a.color);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.lineWidth = a.width;
    c.beginPath();
    c.moveTo(p1[0], p1[1]);
    c.lineTo(a.x, a.y);
    c.lineTo(p2[0], p2[1]);
    c.stroke();

    // τόξο (ή τετραγωνάκι για ορθή γωνία) και ένδειξη μοιρών
    const r = Math.max(18, Math.min(46, Math.min(a.len1, a.len2) * 0.4));
    const diff = Math.atan2(Math.sin(a.a2 - a.a1), Math.cos(a.a2 - a.a1));
    c.lineWidth = Math.max(1.5, a.width * 0.5);
    c.beginPath();
    if (deg === 90) {
      const q = r * 0.6;
      const u1: Pt = [Math.cos(a.a1) * q, Math.sin(a.a1) * q];
      const u2: Pt = [Math.cos(a.a2) * q, Math.sin(a.a2) * q];
      c.moveTo(a.x + u1[0], a.y + u1[1]);
      c.lineTo(a.x + u1[0] + u2[0], a.y + u1[1] + u2[1]);
      c.lineTo(a.x + u2[0], a.y + u2[1]);
    } else {
      c.arc(a.x, a.y, r, a.a1, a.a1 + diff, diff < 0);
    }
    c.stroke();
    const mid = a.a1 + diff / 2;
    const lr = r + 26;
    c.font = '600 22px system-ui, "Segoe UI", Roboto, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(`${deg}°`, a.x + lr * Math.cos(mid), a.y + lr * Math.sin(mid));
    c.restore();
  }

  private drawAxes(c: CanvasRenderingContext2D, a: AxesItem): void {
    const { xmin, xmax, ymin, ymax } = axesRange(a);
    const u = a.unit;
    const X = (v: number) => a.x + v * u;
    const Y = (v: number) => a.y - v * u;
    c.save();
    c.strokeStyle = c.fillStyle = this.ink(a.color);
    c.lineCap = 'round';
    c.lineJoin = 'round';

    // βοηθητικό πλέγμα
    c.globalAlpha = 0.16;
    c.lineWidth = 1;
    c.beginPath();
    for (let i = xmin; i <= xmax; i++) { c.moveTo(X(i), Y(ymin)); c.lineTo(X(i), Y(ymax)); }
    for (let j = ymin; j <= ymax; j++) { c.moveTo(X(xmin), Y(j)); c.lineTo(X(xmax), Y(j)); }
    c.stroke();
    c.globalAlpha = 1;

    // άξονες με βέλη
    const ext = 0.6;
    const xa = xmin < 0 ? xmin - ext : 0;
    const ya = ymin < 0 ? ymin - ext : 0;
    const ah = Math.max(8, u * 0.22);
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(X(xa), a.y);
    c.lineTo(X(xmax + ext), a.y);
    c.moveTo(X(xmax + ext) - ah, a.y - ah * 0.55);
    c.lineTo(X(xmax + ext), a.y);
    c.lineTo(X(xmax + ext) - ah, a.y + ah * 0.55);
    c.moveTo(a.x, Y(ya));
    c.lineTo(a.x, Y(ymax + ext));
    c.moveTo(a.x - ah * 0.55, Y(ymax + ext) + ah);
    c.lineTo(a.x, Y(ymax + ext));
    c.lineTo(a.x + ah * 0.55, Y(ymax + ext) + ah);
    // υποδιαιρέσεις
    const t = Math.max(3, u * 0.1);
    for (let i = xmin; i <= xmax; i++) if (i !== 0) { c.moveTo(X(i), a.y - t); c.lineTo(X(i), a.y + t); }
    for (let j = ymin; j <= ymax; j++) if (j !== 0) { c.moveTo(a.x - t, Y(j)); c.lineTo(a.x + t, Y(j)); }
    c.stroke();

    // αριθμοί και ονόματα αξόνων
    const fs = Math.max(9, Math.min(17, u * 0.38));
    c.font = `${fs}px system-ui, "Segoe UI", Roboto, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'top';
    for (let i = xmin; i <= xmax; i++) if (i !== 0) c.fillText(String(i), X(i), a.y + t + 3);
    c.textAlign = 'right';
    c.textBaseline = 'middle';
    for (let j = ymin; j <= ymax; j++) if (j !== 0) c.fillText(String(j), a.x - t - 4, Y(j));
    c.textBaseline = 'top';
    c.fillText('O', a.x - t - 3, a.y + t + 3);
    c.font = `italic 600 ${fs * 1.25}px system-ui, "Segoe UI", Roboto, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'top';
    c.fillText(a.lx ?? 'x', X(xmax + ext), a.y + t + 4);
    c.textAlign = 'right';
    c.textBaseline = 'middle';
    c.fillText(a.ly ?? 'y', a.x - t - 6, Y(ymax + ext) + 4);
    c.restore();
  }

  private drawItem(c: CanvasRenderingContext2D, it: Item): void {
    switch (it.kind) {
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
        const img = this.getImg(it);
        if (img) c.drawImage(img, it.x, it.y, it.w, it.h);
      }
    }
  }

  private setWorldTransform(c: CanvasRenderingContext2D): void {
    const v = this.page.view;
    const d = this.dpr;
    c.setTransform(d * v.k, 0, 0, d * v.k, d * v.x, d * v.y);
  }

  private dragPreviewIds(): Set<string> {
    const ids = new Set<string>();
    for (const p of this.ptrs.values()) if (p.orig) ids.add(p.orig.id);
    return ids;
  }

  redraw(): void {
    const c = this.bctx;
    const v = this.page.view;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.base.width, this.base.height);
    this.setWorldTransform(c);
    const [x0, y0] = this.toWorld(0, 0);
    const [x1, y1] = this.toWorld(this.W, this.H);
    this.paintBackground(c, x0, y0, x1, y1, v.k);
    const hidden = this.dragPreviewIds();
    for (const it of this.page.items) {
      if (!hidden.has(it.id)) this.drawItem(c, it);
    }
    this.renderLive();
  }

  renderLive(): void {
    const c = this.lctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.live.width, this.live.height);
    this.setWorldTransform(c);
    const k = this.page.view.k;
    let selItem: Item | undefined;
    for (const p of this.ptrs.values()) {
      if (p.live) this.drawItem(c, p.live);
      else if (p.stroke) this.drawStroke(c, p.stroke);
      if (p.preview) {
        this.drawItem(c, p.preview);
        selItem = p.preview;
      }
    }
    if (!selItem && this.selected) selItem = this.page.items.find((x) => x.id === this.selected);
    if (selItem && this.tool === 'select') {
      const b = itemBounds(selItem);
      c.save();
      c.strokeStyle = '#2563eb';
      c.lineWidth = 2 / k;
      c.setLineDash([8 / k, 6 / k]);
      c.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      c.setLineDash([]);
      c.fillStyle = '#2563eb';
      if (selItem.kind === 'image' || selItem.kind === 'shape' || selItem.kind === 'axes') {
        c.beginPath();
        c.arc(b.x1, b.y1, 12 / k, 0, Math.PI * 2);
        c.fill();
      } else if (selItem.kind === 'angle') {
        for (const p of angleEnds(selItem)) {
          c.beginPath();
          c.arc(p[0], p[1], 12 / k, 0, Math.PI * 2);
          c.fill();
        }
      }
      c.restore();
    }
    this.gadgets.draw(c, k, this.ink(this.color));
    if (this.eraserAt) {
      c.save();
      c.strokeStyle = '#ef4444';
      c.fillStyle = 'rgba(239,68,68,0.12)';
      c.lineWidth = 2 / k;
      c.beginPath();
      c.arc(this.eraserAt.x, this.eraserAt.y, this.eraserRadius(), 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.restore();
    }
  }

  private eraserRadius(): number {
    return this.sizes.eraser / this.page.view.k;
  }

  // ---------- εξαγωγή ----------

  async exportPng(): Promise<Blob> {
    const items = this.page.items;
    let x0 = 0, y0 = 0, x1 = this.W, y1 = this.H;
    if (items.length > 0) {
      x0 = Infinity; y0 = Infinity; x1 = -Infinity; y1 = -Infinity;
      for (const it of items) {
        const b = itemBounds(it);
        x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0);
        x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1);
      }
      x0 -= 30; y0 -= 30; x1 += 30; y1 += 30;
    }
    const bw = x1 - x0;
    const bh = y1 - y0;
    const s = Math.min(2, 4096 / Math.max(bw, bh));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(bw * s));
    cv.height = Math.max(1, Math.round(bh * s));
    const c = cv.getContext('2d')!;
    c.setTransform(s, 0, 0, s, -x0 * s, -y0 * s);
    this.paintBackground(c, x0, y0, x1, y1, s);
    await Promise.all(
      items.filter((i): i is Pic => i.kind === 'image').map((p) => {
        this.getImg(p);
        const img = this.imgs.get(p.id)!;
        return img.complete ? Promise.resolve() : new Promise<void>((r) => { img.onload = () => r(); img.onerror = () => r(); });
      })
    );
    for (const it of items) this.drawItem(c, it);
    return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('PNG'))), 'image/png'));
  }

  // ---------- είσοδος ----------

  private hitTest(x: number, y: number): Item | null {
    const r = 8 / this.page.view.k;
    const items = this.page.items;
    for (let i = items.length - 1; i >= 0; i--) {
      if (hitItem(items[i], x, y, r)) return items[i];
    }
    return null;
  }

  private eraseAt(ps: PState, x: number, y: number): void {
    const r = this.eraserRadius();
    const items = this.page.items;
    let changed = false;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.kind === 'image' || it.kind === 'axes') continue;
      if (this.eraserMode === 'partial') {
        const rest = erasePartial(it, x, y, r);
        if (!rest) continue;
        items.splice(i, 1, ...rest);
      } else {
        if (!hitItem(it, x, y, r)) continue;
        items.splice(i, 1);
      }
      changed = true;
    }
    if (changed) {
      ps.changed = true;
      this.redraw();
    }
  }

  private bindEvents(): void {
    const el = this.live;
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e));
    el.addEventListener('pointercancel', (e) => this.up(e));
    el.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse' && this.eraserAt) {
        this.eraserAt = null;
        this.renderLive();
      }
    });
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const v = this.page.view;
        const f = Math.exp(-e.deltaY * 0.0015);
        const k = Math.min(8, Math.max(0.1, v.k * f));
        const wx = (e.clientX - v.x) / v.k;
        const wy = (e.clientY - v.y) / v.k;
        v.k = k;
        v.x = e.clientX - wx * k;
        v.y = e.clientY - wy * k;
        this.redraw();
      },
      { passive: false }
    );
  }

  private down(e: PointerEvent): void {
    e.preventDefault();
    this.live.setPointerCapture(e.pointerId);
    this.onPointerInfo(e, this.ptrs.size + 1);
    const ps: PState = { id: e.pointerId, type: e.pointerType, x: e.clientX, y: e.clientY, t0: performance.now(), mode: 'none' };
    this.ptrs.set(e.pointerId, ps);

    // Χειρονομία δύο δαχτύλων: pan / zoom
    if (e.pointerType === 'touch' && !this.gesture) {
      const other = [...this.ptrs.values()].find((p) => p.type === 'touch' && p.id !== e.pointerId && p.mode !== 'none');
      const otherAny = [...this.ptrs.values()].find((p) => p.type === 'touch' && p.id !== e.pointerId);
      const cand = other ?? otherAny;
      if (cand) {
        const young = cand.stroke ? performance.now() - cand.t0 < 300 : true;
        const busy = cand.mode === 'gadget';
        const free = this.tool === 'hand' || this.tool === 'select' || cand.mode === 'pan' || cand.mode === 'none';
        if (!busy && (young || free)) {
          this.cancelPointer(cand);
          this.startGesture(cand, ps);
          return;
        }
      }
    }
    if (this.gesture) return;

    const [wx, wy] = this.toWorld(e.clientX, e.clientY);
    const v = this.page.view;

    if (e.pointerType === 'mouse' && e.button === 1) {
      ps.mode = 'pan';
      ps.start = [e.clientX, e.clientY];
      ps.v0 = { ...v };
      return;
    }

    const drawing = this.tool === 'pen' || this.tool === 'highlighter';
    const gd = this.gadgets.down(wx, wy, v.k, {
      color: this.color, width: this.width, hl: this.tool === 'highlighter', drawing,
    });
    if (gd) {
      ps.mode = 'gadget';
      ps.gadget = gd;
      ps.stroke = gd.stroke;
      this.renderLive();
      return;
    }

    let tool = this.tool;
    if (e.pointerType === 'touch' && Math.max(e.width, e.height) > this.palmThreshold) tool = 'eraser';

    switch (tool) {
      case 'pen':
      case 'highlighter':
        ps.mode = 'draw';
        ps.stroke = {
          kind: 'stroke', id: uid(), pts: [[wx, wy]],
          color: this.color, width: this.width, hl: tool === 'highlighter',
        };
        ps.start = [e.clientX, e.clientY];
        this.armSnap(ps);
        this.renderLive();
        break;
      case 'shape':
        ps.mode = 'shape';
        ps.live = this.shapeKind === 'angle'
          ? { kind: 'angle', id: uid(), x: wx, y: wy, a1: 0, a2: 0, len1: 0, len2: 0, color: this.color, width: this.width }
          : {
            kind: 'shape', id: uid(), shape: this.shapeKind,
            x0: wx, y0: wy, x1: wx, y1: wy, color: this.color, width: this.width,
          };
        this.renderLive();
        break;
      case 'text': {
        const hit = this.hitTest(wx, wy);
        this.onTextRequest(wx, wy, hit && hit.kind === 'text' ? hit : undefined);
        break;
      }
      case 'eraser':
        ps.mode = 'erase';
        ps.before = this.page.items.slice();
        this.eraserAt = { x: wx, y: wy };
        this.eraseAt(ps, wx, wy);
        this.renderLive();
        break;
      case 'hand':
        ps.mode = 'pan';
        ps.start = [e.clientX, e.clientY];
        ps.v0 = { ...v };
        break;
      case 'select': {
        const sel = this.selected ? this.page.items.find((x) => x.id === this.selected) : undefined;
        if (sel && sel.kind === 'angle') {
          const ends = angleEnds(sel);
          const hi = ends.findIndex((p) => Math.hypot(wx - p[0], wy - p[1]) < 24 / v.k);
          if (hi >= 0) {
            ps.mode = 'resize';
            ps.handle = hi + 1;
            ps.orig = sel;
            ps.preview = sel;
            ps.start = [wx, wy];
            this.redraw();
            return;
          }
        }
        if (sel && (sel.kind === 'image' || sel.kind === 'shape' || sel.kind === 'axes')) {
          const b = itemBounds(sel);
          if (Math.hypot(wx - b.x1, wy - b.y1) < 24 / v.k) {
            ps.mode = 'resize';
            ps.orig = sel;
            ps.preview = sel;
            ps.start = [wx, wy];
            this.redraw();
            return;
          }
        }
        const hit = this.hitTest(wx, wy);
        this.selected = hit ? hit.id : null;
        if (hit) {
          ps.mode = 'move';
          ps.orig = hit;
          ps.preview = hit;
          ps.start = [wx, wy];
          this.redraw();
        } else {
          this.renderLive();
        }
        this.onUi();
        break;
      }
    }
  }

  private startGesture(a: PState, b: PState): void {
    a.mode = 'none';
    b.mode = 'none';
    const c0: Pt = [(a.x + b.x) / 2, (a.y + b.y) / 2];
    this.gesture = {
      a: a.id, b: b.id, c0,
      d0: Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1),
      v0: { ...this.page.view },
    };
    this.redraw();
  }

  /** Ακυρώνει ό,τι έκανε ένας δείκτης χωρίς να το καταχωρήσει. */
  private cancelPointer(ps: PState): void {
    if (ps.mode === 'erase' && ps.changed && ps.before) this.page.items = ps.before;
    clearTimeout(ps.timer);
    ps.stroke = undefined;
    ps.live = undefined;
    ps.gadget = undefined;
    ps.preview = undefined;
    ps.orig = undefined;
    ps.before = undefined;
    ps.changed = false;
    ps.mode = 'none';
    this.eraserAt = null;
    this.redraw();
  }

  /** Κράτημα της γραφίδας ακίνητης: το σκίτσο γίνεται τέλειο σχήμα. */
  private armSnap(ps: PState): void {
    clearTimeout(ps.timer);
    ps.timer = window.setTimeout(() => {
      if (ps.mode !== 'draw' || !ps.stroke || ps.live) return;
      const r = recognizeShape(ps.stroke.pts);
      if (!r) return;
      const s = ps.stroke;
      ps.live = r.t === 'angle'
        ? { kind: 'angle', id: uid(), x: r.x, y: r.y, a1: r.a1, a2: r.a2, len1: r.len1, len2: r.len2, color: s.color, width: s.width }
        : {
          kind: 'shape', id: uid(), shape: r.shape, x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1, pts: r.pts,
          color: s.color, width: s.width, hl: s.hl,
        };
      this.renderLive();
    }, 600);
  }

  /** Προσθήκη ή επεξεργασία κειμένου (καλείται από το UI του editor). */
  commitText(x: number, y: number, text: string, size: number, existing?: TextItem): void {
    const items = this.page.items;
    const has = text.trim().length > 0;
    if (existing) {
      const i = items.findIndex((it) => it.id === existing.id);
      if (i < 0) return;
      if (!has) {
        const [item] = items.splice(i, 1);
        this.push({ t: 'del', p: this.cur, items: [{ item, i }] });
      } else if (text !== existing.text) {
        const after: TextItem = { ...existing, text };
        items[i] = after;
        this.push({ t: 'mod', p: this.cur, before: existing, after });
      }
    } else if (has) {
      const item: TextItem = { kind: 'text', id: uid(), x, y, text, size, color: this.color };
      items.push(item);
      this.push({ t: 'add', p: this.cur, item });
    }
    this.redraw();
  }

  /** Μετατροπή συντεταγμένων κόσμου σε οθόνης (για τον editor κειμένου). */
  toScreen(wx: number, wy: number): Pt {
    const v = this.page.view;
    return [wx * v.k + v.x, wy * v.k + v.y];
  }

  get zoom(): number {
    return this.page.view.k;
  }

  private move(e: PointerEvent): void {
    const ps = this.ptrs.get(e.pointerId);
    if (!ps) {
      if (e.pointerType === 'mouse' && this.tool === 'eraser') {
        const [wx, wy] = this.toWorld(e.clientX, e.clientY);
        this.eraserAt = { x: wx, y: wy };
        this.renderLive();
      }
      return;
    }
    this.onPointerInfo(e, this.ptrs.size);
    const evs = e.getCoalescedEvents?.() ?? [];
    const list = evs.length ? evs : [e];
    for (const ev of list) this.moveOne(ps, ev);
    this.renderLive();
  }

  private moveOne(ps: PState, e: PointerEvent): void {
    ps.x = e.clientX;
    ps.y = e.clientY;
    if (this.gesture) {
      const g = this.gesture;
      const a = this.ptrs.get(g.a);
      const b = this.ptrs.get(g.b);
      if (!a || !b) return;
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const d = Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1);
      const k = Math.min(8, Math.max(0.1, g.v0.k * (d / g.d0)));
      const wx = (g.c0[0] - g.v0.x) / g.v0.k;
      const wy = (g.c0[1] - g.v0.y) / g.v0.k;
      const v = this.page.view;
      v.k = k;
      v.x = cx - wx * k;
      v.y = cy - wy * k;
      this.redraw();
      return;
    }
    const [wx, wy] = this.toWorld(e.clientX, e.clientY);
    switch (ps.mode) {
      case 'draw': {
        if (ps.live) {
          // μετά την αναγνώριση, όσο κρατάς πατημένο, η άκρη ακολουθεί τη γραφίδα
          const l = ps.live;
          if (l.kind === 'angle') {
            l.a2 = roundAngle(Math.atan2(wy - l.y, wx - l.x));
            l.len2 = Math.max(20, Math.hypot(wx - l.x, wy - l.y));
          } else if (l.shape === 'line') {
            l.x1 = wx;
            l.y1 = wy;
          }
          break;
        }
        const pts = ps.stroke!.pts;
        const last = pts[pts.length - 1];
        const minD = 1.2 / this.page.view.k;
        if (Math.hypot(wx - last[0], wy - last[1]) >= minD) pts.push([wx, wy]);
        if (Math.hypot(e.clientX - ps.start![0], e.clientY - ps.start![1]) > 4) {
          ps.start = [e.clientX, e.clientY];
          this.armSnap(ps);
        }
        break;
      }
      case 'gadget':
        ps.gadget!.move(wx, wy);
        break;
      case 'shape': {
        const l = ps.live!;
        if (l.kind === 'angle') {
          // η πρώτη πλευρά μένει οριζόντια, η δεύτερη ακολουθεί τη γραφίδα
          const d = Math.hypot(wx - l.x, wy - l.y);
          l.a2 = roundAngle(Math.atan2(wy - l.y, wx - l.x));
          l.len1 = d;
          l.len2 = d;
        } else {
          l.x1 = wx;
          l.y1 = wy;
        }
        break;
      }
      case 'erase':
        this.eraserAt = { x: wx, y: wy };
        this.eraseAt(ps, wx, wy);
        break;
      case 'pan': {
        const v = this.page.view;
        v.x = ps.v0!.x + (e.clientX - ps.start![0]);
        v.y = ps.v0!.y + (e.clientY - ps.start![1]);
        this.redraw();
        break;
      }
      case 'move': {
        const dx = wx - ps.start![0];
        const dy = wy - ps.start![1];
        const o = ps.orig!;
        ps.preview = translateItem(o, dx, dy);
        break;
      }
      case 'resize': {
        const o = ps.orig!;
        const dx = wx - ps.start![0];
        const dy = wy - ps.start![1];
        if (o.kind === 'image') {
          const nw = Math.max(40, o.w + dx);
          ps.preview = { ...o, w: nw, h: (nw * o.h) / o.w };
        } else if (o.kind === 'shape') {
          const fx = o.x1 >= o.x0;
          const fy = o.y1 >= o.y0;
          ps.preview = reboxShape(
            o,
            fx ? o.x0 : o.x0 + dx, fy ? o.y0 : o.y0 + dy,
            fx ? o.x1 + dx : o.x1, fy ? o.y1 + dy : o.y1,
          );
        } else if (o.kind === 'axes') {
          const b = itemBounds(o);
          const f = Math.max(0.3, (b.x1 - b.x0 + dx) / (b.x1 - b.x0));
          const scaled: AxesItem = { ...o, unit: Math.max(12, o.unit * f) };
          const nb = itemBounds(scaled);
          ps.preview = { ...scaled, x: scaled.x + b.x0 - nb.x0, y: scaled.y + b.y0 - nb.y0 };
        } else if (o.kind === 'angle') {
          const ang = roundAngle(Math.atan2(wy - o.y, wx - o.x));
          const len = Math.max(20, Math.hypot(wx - o.x, wy - o.y));
          ps.preview = ps.handle === 1 ? { ...o, a1: ang, len1: len } : { ...o, a2: ang, len2: len };
        }
        break;
      }
    }
  }

  private up(e: PointerEvent): void {
    const ps = this.ptrs.get(e.pointerId);
    if (!ps) return;
    this.ptrs.delete(e.pointerId);
    this.onPointerInfo(e, this.ptrs.size);

    if (this.gesture && (this.gesture.a === e.pointerId || this.gesture.b === e.pointerId)) {
      this.gesture = null;
      this.onChange();
      return;
    }

    switch (ps.mode) {
      case 'gadget':
        if (!ps.stroke || ps.stroke.pts.length < 2) break;
      case 'draw':
      case 'shape': {
        clearTimeout(ps.timer);
        const s: Item = ps.live ?? ps.stroke!;
        if (ps.mode === 'shape' && ps.live) {
          const l = ps.live;
          const len = l.kind === 'angle' ? l.len2 : Math.hypot(l.x1 - l.x0, l.y1 - l.y0);
          if (len < (l.kind === 'angle' ? 20 : 4) / this.page.view.k) break;
        }
        this.page.items.push(s);
        this.push({ t: 'add', p: this.cur, item: s });
        const c = this.bctx;
        c.save();
        this.setWorldTransform(c);
        this.drawItem(c, s);
        c.restore();
        break;
      }
      case 'erase':
        if (ps.changed && ps.before) {
          this.push({ t: 'set', p: this.cur, before: ps.before, after: this.page.items.slice() });
        }
        this.eraserAt = null;
        break;
      case 'pan':
        this.onChange();
        break;
      case 'move':
      case 'resize': {
        const before = ps.orig!;
        const after = ps.preview!;
        const i = this.page.items.findIndex((x) => x.id === before.id);
        if (i >= 0 && after !== before) {
          this.page.items[i] = after;
          this.push({ t: 'mod', p: this.cur, before, after });
        }
        ps.orig = undefined;
        ps.preview = undefined;
        this.redraw();
        return;
      }
    }
    this.renderLive();
  }
}

import {
  AngleItem, AxesItem, AxesMode, Background, Doc, FnDef, Item, MeasOpts, Op, Page, Pic, Pt, Shape, ShapeKind, StampItem, Stroke, TableStyle, TextItem, Tool, View, angleEnds, cloneItem, distToSeg, erasePartial, hitItem, inLasso, isDark, isPoly, itemBounds, itemRot, newDoc, newPage, pointInPolygon, reboxShape, recognizeShape, rotateItem, roundAngle, scaleItem, translateItem, trianglePts, uid, unrot,
} from './model';
import { Params } from './expr';
import { STAMPS, SpringState } from './stamps';
import { CM, GadgetDrag, GadgetKind, Gadgets } from './gadgets';
import { ANGLE_KEY, angleSides, eraseMeasures, fmt, measureAngles, measureSides, trigPoint, sideLen, sideText, unitsFor } from './measure';
import { Renderer } from './render';

// οι δοκιμές και όποιος τα χρειάζεται τα βρίσκουν ακόμα εδώ
export { eraseMeasures, hlFlat, measureAngles, measureSides, radText } from './measure';

type Mode = 'draw' | 'shape' | 'gadget' | 'erase' | 'move' | 'resize' | 'pan' | 'lasso' | 'gmove' | 'gresize' | 'rotate' | 'grotate' | 'measure' | 'laser' | 'osc' | 'none';

type Box = { x0: number; y0: number; x1: number; y1: number };
/** Ίχνος του δείκτη λέιζερ· t = στιγμή που σηκώθηκε η γραφίδα (0 όσο γράφει). */
interface Laser { pts: Pt[]; t: number }
const LASER_MS = 1800;

/** Περίοδος της ταλάντωσης των ελατηρίων και χρόνος απόσβεσης. */
const OSC_PERIOD_MS = 1600;
const OSC_FADE_MS = 5000;

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
  lasso?: Pt[];
  /** Στοιχείο κάτω από την αρχή του λάσου: επιλέγεται αν τελικά ήταν απλό άγγιγμα. */
  tapHit?: string;
  ids?: Set<string>;
  gb?: Box;
  laser?: Laser;
  orig?: Item;
  preview?: Item;
  start?: Pt;
  /** Περιστροφή: η γωνία της γραφίδας ως προς το κέντρο όταν ακούμπησε. */
  a0?: number;
  /** Περιστροφή: μένει true όσο η γραφίδα δεν έχει συρθεί (απλό πάτημα της λαβής αλλάζει κέντρο). */
  tap?: boolean;
  v0?: View;
}

interface Gesture {
  a: number;
  b: number;
  c0: Pt;
  d0: number;
  v0: View;
  /** Το zoom «ξεκλειδώνει» μόνο όταν τα δάχτυλα ανοίξουν ή κλείσουν αισθητά· ως τότε η κίνηση είναι καθαρή μετακίνηση. */
  zoom: boolean;
}

export type SizedTool = 'pen' | 'highlighter' | 'eraser';
export type EraserMode = 'stroke' | 'partial';

/** Τα ανοιχτά χρώματα του σκούρου πίνακα και τα αντίστοιχά τους για λευκό χαρτί. */
const PAPER_INK: Record<string, string> = {
  '#ffffff': '#111111', '#fb7185': '#e11d48', '#7dd3fc': '#2563eb', '#86efac': '#16a34a',
  '#34d399': '#059669', '#f87171': '#dc2626', '#5eead4': '#0f766e', '#d1d5db': '#6b7280', '#fde047': '#ca8a04', '#a3e635': '#65a30d',
};

/** Λογότυπο στην κάτω δεξιά γωνία, μικρό σε σχέση με τη σελίδα. */
function stampMark(cv: HTMLCanvasElement, mark: HTMLImageElement): void {
  const s = Math.max(40, Math.min(cv.width, cv.height) * 0.07);
  const c = cv.getContext('2d')!;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 0.9;
  c.drawImage(mark, cv.width - s * 1.25, cv.height - s * 1.25, s, s);
  c.globalAlpha = 1;
}

export class Board {
  /** Η σχεδίαση των στοιχείων στον καμβά ζει στο render.ts. */
  private r = new Renderer(this);
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
  /** Συνάρτηση που γράφεται αυτή τη στιγμή: σχεδιάζεται ζωντανά, δεν έχει αποθηκευτεί ακόμα. */
  fnPreview: { index: number | null; expr: string; color: string } | null = null;
  /** Τιμές παραμέτρων όσο σέρνεται ένας δρομέας. */
  paramPreview: Params | null = null;
  /** Πολλαπλή επιλογή (λάσο). Όταν έχει στοιχεία, το `selected` είναι null. */
  multi: string[] = [];
  /** Κέντρο περιστροφής της επιλογής όταν δεν είναι το κέντρο της: ποια άκρη (i) και, για ομάδα, το σημείο. */
  private pivot: { key: string; i: number; p: Pt } | null = null;
  /** Διαφανές φόντο (γράψιμο πάνω από άλλα προγράμματα). */
  transparent = false;
  /** Αν οι νέοι άξονες μπαίνουν με αριθμούς (θυμάται την τελευταία επιλογή). */
  axesNums = true;
  /** Όσο ζωγραφίζεται σελίδα για το χαρτί: σκούρος πίνακας βγαίνει λευκός και τα ανοιχτά χρώματά του σκουραίνουν. */
  private paper = false;
  palmThreshold = 40;
  /** Ύψος (px) που καλύπτει η γραμμή εργαλείων στο κάτω μέρος. */
  bottomInset = 110;

  /** Ζητά από το UI να ανοίξει editor κειμένου. */
  onTextRequest: (x: number, y: number, existing?: TextItem) => void = () => {};
  /** Καλείται όταν αλλάζει η προβολή (zoom/μετακίνηση). */
  onView: () => void = () => {};
  onChange: () => void = () => {};
  onUi: () => void = () => {};
  /** Όταν άξονες με συναρτήσεις αφεθούν πάνω σε άλλους: επιστρέφει τους ενωμένους άξονες, ή null για απλή μετακίνηση. */
  onMergeAxes: (target: AxesItem, dropped: AxesItem) => AxesItem | null = () => null;
  onPointerInfo: (e: PointerEvent, count: number) => void = () => {};
  /** Καλείται όταν ολοκληρωθεί μια γραμμή του στυλό (για την αυτόματη αναγνώριση). */
  onStroke: (s: Stroke) => void = () => {};

  private undoStack: Op[] = [];
  private redoStack: Op[] = [];
  private imgs = new Map<string, HTMLImageElement>();
  private ptrs = new Map<number, PState>();
  private gesture: Gesture | null = null;
  private eraserAt: { x: number; y: number } | null = null;
  private lasers: Laser[] = [];
  private laserRaf = 0;
  private replay: { i: number; prog: number; wait: number; paused: boolean } | null = null;
  private replayRaf = 0;
  private dpr = 1;
  private W = 0;
  private H = 0;
  private bctx: CanvasRenderingContext2D;
  lctx: CanvasRenderingContext2D;

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
  ink(color: string, hl = false): string {
    if (this.paper) return hl ? color : PAPER_INK[color] ?? color;
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
    this.region = null;
    if (t !== 'select') {
      this.selected = null;
      this.multi = [];
    }
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
    this.region = null;
    this.selected = null;
    this.multi = [];
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
    this.multi = [];
    this.osc.clear();
    this.region = null;
    this.redraw();
    this.onUi();
  }

  addPage(): void {
    this.doc.pages.push(newPage());
    this.goto(this.doc.pages.length - 1);
    this.onChange();
  }

  /** Νέα σελίδα με αντίγραφα των στοιχείων (πρότυπο). Αν η τρέχουσα είναι κενή, μπαίνουν σε αυτήν. */
  addPageWith(src: Item[]): void {
    const items = src.map(cloneItem);
    if (this.page.items.length === 0) {
      this.page.items = items;
      this.push({ t: 'set', p: this.cur, before: [], after: items.slice() });
      this.redraw();
      return;
    }
    const p = newPage();
    p.items = items;
    this.doc.pages.push(p);
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
    this.multi = [];
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
    if (this.syncLinks()) this.redraw();
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
    this.multi = [];
    this.syncLinks();
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
    this.multi = [];
    this.redraw();
    return pic;
  }

  /** Εισαγωγή καρτεσιανών αξόνων στο κέντρο της οθόνης. */
  addAxes(mode: AxesMode, extra?: Partial<AxesItem>): void {
    const axes: AxesItem = { kind: 'axes', id: uid(), x: 0, y: 0, unit: CM, mode, nx: 10, ny: 10, color: this.color, ...(this.axesNums ? {} : { nums: false }), ...extra };
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
    this.multi = [];
    this.redraw();
    this.onUi();
  }

  /** Οι επιλεγμένοι άξονες, αν η επιλογή είναι άξονες. */
  /**
   * Άξονες με συναρτήσεις που αφήνονται πάνω σε άλλους άξονες ενώνονται μαζί τους: οι συναρτήσεις περνούν στους πρώτους
   * και οι δεύτεροι φεύγουν. Μία αναίρεση τα χωρίζει ξανά.
   */
  private mergeAxes(before: AxesItem, after: AxesItem): boolean {
    if (!after.fns?.length) return false;
    const b = itemBounds(after);
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    // «πάνω στους άλλους»: το κέντρο αυτών που σέρνεις πέφτει μέσα στο πλαίσιο των άλλων
    const target = [...this.page.items].reverse().find((x): x is AxesItem => {
      if (x.kind !== 'axes' || x.id === before.id) return false;
      const t = itemBounds(x);
      return cx > t.x0 && cx < t.x1 && cy > t.y0 && cy < t.y1;
    });
    const merged = target && this.onMergeAxes(target, after);
    if (!target || !merged) return false;
    const old = [...this.page.items];
    this.page.items = old.filter((x) => x.id !== before.id).map((x) => (x.id === target.id ? merged : x));
    this.push({ t: 'set', p: this.cur, before: old, after: [...this.page.items] });
    this.selected = merged.id;
    this.multi = [];
    return true;
  }

  get selectedAxes(): AxesItem | null {
    const it = this.selected ? this.page.items.find((x) => x.id === this.selected) : undefined;
    return it && it.kind === 'axes' ? it : null;
  }

  /** Επιλέγει τους πιο πρόσφατους άξονες της σελίδας. false αν δεν υπάρχουν. */
  selectAxes(): boolean {
    const ax = [...this.page.items].reverse().find((x) => x.kind === 'axes');
    if (!ax) return false;
    this.selected = ax.id;
    this.multi = [];
    this.redraw();
    this.onUi();
    return true;
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

  private center(): Pt {
    return this.toWorld(this.W / 2, (this.H - this.bottomInset) / 2);
  }

  /** Προσθέτει ένα έτοιμο στοιχείο στη σελίδα και το αφήνει επιλεγμένο (αναιρείται με ένα ↶). */
  addItem(item: Item): void {
    this.addAndSelect(item);
  }

  private addAndSelect(item: Item): void {
    this.page.items.push(item);
    this.push({ t: 'add', p: this.cur, item });
    this.tool = 'select';
    this.selected = item.id;
    this.multi = [];
    this.redraw();
    this.onUi();
  }

  /** Εισαγωγή έτοιμου σχήματος φυσικής στο κέντρο της οθόνης. */
  addStamp(name: string): void {
    const d = STAMPS[name];
    if (!d) return;
    const [cx, cy] = this.center();
    this.addAndSelect({ kind: 'stamp', id: uid(), name, x: cx - d.w / 2, y: cy - d.h / 2, w: d.w, h: d.h, color: this.color, width: 3 });
  }

  /** Κενός πίνακας (πλέγμα, ορίζουσα ή μήτρα) στο κέντρο της οθόνης· γράφεις μέσα στα κελιά με το στυλό. */
  addTable(r: number, c: number, style: TableStyle): void {
    const [cx, cy] = this.center();
    const k = this.page.view.k;
    // κελιά 2,4 × 1,8 cm, μικρότερα αν ο πίνακας δεν χωρά στην οθόνη
    const f = Math.min(1, (this.W * 0.85) / k / (c * 96), (Math.max(this.H - this.bottomInset, 100) * 0.8) / k / (r * 72));
    const w = c * 96 * f, h = r * 72 * f;
    this.addAndSelect({ kind: 'shape', id: uid(), shape: 'table', x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2, color: this.color, width: 3, grid: { r, c, style } });
  }

  addTrig(): void {
    const [cx, cy] = this.center();
    this.addAndSelect({ kind: 'trig', id: uid(), x: cx, y: cy, r: 4 * CM, a: Math.PI / 6, color: this.color });
  }

  /** Ορίζει τις συναρτήσεις που σχεδιάζονται στους επιλεγμένους άξονες. */
  setAxesFns(fns: FnDef[]): void {
    this.updateAxes({ fns });
  }

  /** Αλλάζει ιδιότητες των επιλεγμένων αξόνων (συναρτήσεις, παράμετροι, σημεία) με ένα βήμα αναίρεσης. */
  updateAxes(patch: Partial<AxesItem>): void {
    const before = this.selectedAxes;
    if (!before) return;
    const after = { ...before, ...patch } as AxesItem;
    this.page.items[this.page.items.indexOf(before)] = after;
    this.push({ t: 'mod', p: this.cur, before, after });
    this.redraw();
  }

  /** Η μέτρηση πλευράς που βρίσκεται κάτω από το σημείο της οθόνης, αν φαίνονται οι μετρήσεις. */
  measureAt(sx: number, sy: number): { id: string; side: number; text: string; x: number; y: number } | null {
    const [px, py] = this.toWorld(sx, sy);
    const k = this.page.view.k;
    const items = this.page.items;
    for (let n = items.length - 1; n >= 0; n--) {
      const it = items[n];
      if (it.kind === 'angle' && it.meas?.len) {
        for (const m of angleSides(it)) {
          if (Math.abs(px - m.pos[0]) < Math.max(34, 26 / k) && Math.abs(py - m.pos[1]) < Math.max(18, 20 / k)) {
            return { id: it.id, side: m.i, text: it.labels?.[m.i] ?? fmt(m.len / CM), x: sx, y: sy };
          }
        }
      }
      if (it.kind !== 'shape' || !it.meas) continue;
      const [wx, wy] = unrot(it, px, py);
      const near = (p: Pt): boolean => Math.abs(wx - p[0]) < Math.max(34, 26 / k) && Math.abs(wy - p[1]) < Math.max(18, 20 / k);
      if (it.meas.len) for (const m of measureSides(it)) {
        if (near(m.pos)) return { id: it.id, side: m.i, text: it.labels?.[m.i] ?? sideText(m, unitsFor(items, it), it.shape === 'line' || it.shape === 'arrow').split('   ')[0], x: sx, y: sy };
      }
      if (it.meas.ang) for (const m of measureAngles(it)) {
        if (near(m.pos)) return { id: it.id, side: ANGLE_KEY + m.i, text: it.labels?.[ANGLE_KEY + m.i] ?? String(m.deg), x: sx, y: sy };
      }
    }
    return null;
  }

  /** Όλα τα ευθύγραμμα τμήματα της σελίδας: ευθείες, βέλη, πλευρές τριγώνων, ορθογωνίων και γωνιών. */
  private segments(): [Pt, Pt][] {
    const out: [Pt, Pt][] = [];
    const ring = (p: Pt[]): void => p.forEach((q, i) => out.push([q, p[(i + 1) % p.length]]));
    for (const it of this.page.items) {
      if (it.kind === 'angle' && !it.arc) {
        const [p1, p2] = angleEnds(it);
        out.push([[it.x, it.y], p1], [[it.x, it.y], p2]);
      } else if (it.kind === 'shape') {
        if (it.shape === 'line' || it.shape === 'arrow') out.push([[it.x0, it.y0], [it.x1, it.y1]]);
        else if (isPoly(it.shape)) ring(trianglePts(it));
        else if (it.shape === 'rect') {
          const mx = (it.x0 + it.x1) / 2, my = (it.y0 + it.y1) / 2, cs = Math.cos(it.rot ?? 0), sn = Math.sin(it.rot ?? 0);
          ring(([[it.x0, it.y0], [it.x1, it.y0], [it.x1, it.y1], [it.x0, it.y1]] as Pt[]).map(([x, y]) => [mx + (x - mx) * cs - (y - my) * sn, my + (x - mx) * sn + (y - my) * cs]));
        }
      }
    }
    return out;
  }

  /**
   * Η γωνία μέσα στην οποία βρίσκεται το σημείο: ανάμεσα σε δύο γειτονικά τμήματα που ξεκινούν από κοινή κορυφή
   * (ή τέμνονται εκεί). Επιστρέφει έτοιμο «τόξο με μοίρες», ή null αν το σημείο δεν είναι μέσα σε γωνία.
   */
  private angleAround(wx: number, wy: number): AngleItem | null {
    const segs = this.segments().filter(([p, q]) => Math.hypot(q[0] - p[0], q[1] - p[1]) > 10);
    // ανοχή: γραμμές τραβηγμένες με το χέρι σπάνια ακουμπάνε ακριβώς στην κορυφή
    const SNAP = Math.max(26, 26 / this.page.view.k);
    // υποψήφιες κορυφές: τα σημεία όπου δύο τμήματα συναντιούνται ή διασταυρώνονται (και λίγο έξω από τα άκρα τους)
    const verts: Pt[] = [];
    for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
      const [p, q] = segs[i], [r, t] = segs[j];
      const d1x = q[0] - p[0], d1y = q[1] - p[1], d2x = t[0] - r[0], d2y = t[1] - r[1];
      const l1 = Math.hypot(d1x, d1y), l2 = Math.hypot(d2x, d2y);
      const cross = d1x * d2y - d1y * d2x;
      if (Math.abs(cross) < 0.03 * l1 * l2) continue;
      // δύο άκρα πολύ κοντά το ένα στο άλλο μετράνε ως κοινή κορυφή, ακόμα κι αν οι προεκτάσεις τέμνονται πιο μακριά
      let joined = false;
      for (const e1 of [p, q]) for (const e2 of [r, t]) {
        if (!joined && Math.hypot(e1[0] - e2[0], e1[1] - e2[1]) < SNAP * 1.5) {
          const mid: Pt = [(e1[0] + e2[0]) / 2, (e1[1] + e2[1]) / 2];
          if (!verts.some((v) => Math.hypot(v[0] - mid[0], v[1] - mid[1]) < 3)) verts.push(mid);
          joined = true;
        }
      }
      if (joined) continue;
      const u = ((r[0] - p[0]) * d2y - (r[1] - p[1]) * d2x) / cross;
      const w = ((r[0] - p[0]) * d1y - (r[1] - p[1]) * d1x) / cross;
      if (u * l1 < -SNAP || u * l1 > l1 + SNAP || w * l2 < -SNAP || w * l2 > l2 + SNAP) continue;
      const x: Pt = [p[0] + d1x * u, p[1] + d1y * u];
      if (!verts.some((v) => Math.hypot(v[0] - x[0], v[1] - x[1]) < 3)) verts.push(x);
    }
    let best: { d: number; v: Pt; a1: number; a2: number; len: number } | null = null;
    for (const v of verts) {
      const d = Math.hypot(wx - v[0], wy - v[1]);
      if (d < 6 || (best && d >= best.d)) continue;
      // ακτίνες που φεύγουν από την κορυφή v: προς κάθε άκρο τμήματος που περνά από εκεί
      const rays: { a: number; len: number }[] = [];
      const add = (to: Pt): void => {
        const len = Math.hypot(to[0] - v[0], to[1] - v[1]);
        if (len < SNAP * 1.2) return;
        const a = Math.atan2(to[1] - v[1], to[0] - v[0]);
        const same = rays.find((r) => Math.abs(Math.atan2(Math.sin(r.a - a), Math.cos(r.a - a))) < 0.03);
        if (same) same.len = Math.max(same.len, len);
        else rays.push({ a, len });
      };
      for (const [p, q] of segs) {
        if (distToSeg(v[0], v[1], p, q) > SNAP) continue;
        add(p);
        add(q);
      }
      if (rays.length < 2) continue;
      rays.sort((r, s) => r.a - s.a);
      const th = Math.atan2(wy - v[1], wx - v[0]);
      // το ζευγάρι γειτονικών ακτίνων που έχει ανάμεσά του την κατεύθυνση προς το σημείο
      let i = rays.findIndex((r) => r.a > th);
      if (i < 0) i = 0;
      const hi = rays[i], lo = rays[(i + rays.length - 1) % rays.length];
      const span = (((hi.a - lo.a) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      if (span < 0.02 || span > Math.PI + 1e-6) continue;
      if (d > Math.max(lo.len, hi.len) + 20) continue;
      best = { d, v, a1: lo.a, a2: hi.a, len: Math.min(lo.len, hi.len) };
    }
    if (!best) return null;
    // το μήκος ορίζει μόνο την ακτίνα του τόξου (βλ. drawAngleMark)
    // κάθε επόμενη γωνία στην ίδια κορυφή παίρνει μεγαλύτερο τόξο, για να μην πέφτουν οι μοίρες η μία πάνω στην άλλη
    const v = best.v;
    const mid = best.a1 + ((((best.a2 - best.a1) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / 2;
    const here = this.page.items.filter((x) => {
      if (x.kind !== 'angle' || Math.hypot(x.x - v[0], x.y - v[1]) >= SNAP) return false;
      // μόνο όσες γωνίες «πατάνε» στο ίδιο άνοιγμα (π.χ. η μεγάλη γωνία γύρω από μια μικρότερη)
      const half = Math.abs(Math.atan2(Math.sin(x.a2 - x.a1), Math.cos(x.a2 - x.a1))) / 2;
      const xm = x.a1 + Math.atan2(Math.sin(x.a2 - x.a1), Math.cos(x.a2 - x.a1)) / 2;
      return Math.abs(Math.atan2(Math.sin(mid - xm), Math.cos(mid - xm))) < half + 0.02;
    }).length;
    const len = (Math.max(18, Math.min(46, best.len * 0.4)) + 34 * here) / 0.4;
    return { kind: 'angle', id: uid(), x: best.v[0], y: best.v[1], a1: best.a1, a2: best.a2, len1: len, len2: len, color: this.color, width: 3, arc: true };
  }

  /** Το σχήμα κάτω από το σημείο της οθόνης (και το εσωτερικό του μετράει), με τη θέση της πάνω άκρης του. */
  shapeAt(sx: number, sy: number): { id: string; shape: ShapeKind | 'angle'; meas: MeasOpts; x: number; y: number } | null {
    const [px, py] = this.toWorld(sx, sy);
    const r = 14 / this.page.view.k;
    const items = this.page.items;
    for (let n = items.length - 1; n >= 0; n--) {
      const it = items[n];
      if (it.kind === 'angle' && !it.arc && hitItem(it, px, py, r)) {
        const ab = itemBounds(it);
        const [x, y] = this.toScreen((ab.x0 + ab.x1) / 2, ab.y0);
        return { id: it.id, shape: 'angle', meas: it.meas ?? {}, x, y };
      }
      if (it.kind !== 'shape' || it.dash || it.shape === 'table') continue;
      const [wx, wy] = unrot(it, px, py);
      const b = { x0: Math.min(it.x0, it.x1), y0: Math.min(it.y0, it.y1), x1: Math.max(it.x0, it.x1), y1: Math.max(it.y0, it.y1) };
      let hit = hitItem(it, px, py, r);
      if (!hit && it.shape === 'rect') hit = wx >= b.x0 && wx <= b.x1 && wy >= b.y0 && wy <= b.y1;
      if (!hit && isPoly(it.shape)) hit = pointInPolygon(wx, wy, trianglePts(it));
      if (!hit && it.shape === 'ellipse') {
        const a = Math.max((b.x1 - b.x0) / 2, 0.5), h = Math.max((b.y1 - b.y0) / 2, 0.5);
        hit = Math.hypot((wx - (b.x0 + b.x1) / 2) / a, (wy - (b.y0 + b.y1) / 2) / h) <= 1;
      }
      if (!hit) continue;
      const ib = itemBounds(it);
      const [x, y] = this.toScreen((ib.x0 + ib.x1) / 2, ib.y0);
      return { id: it.id, shape: it.shape, meas: it.meas ?? {}, x, y };
    }
    return null;
  }

  /** Ορίζει ποιες μετρήσεις φαίνονται σε ένα σχήμα· όταν δεν μένει καμία, το σχήμα μένει σκέτο. */
  setMeas(id: string, meas: MeasOpts): void {
    const i = this.page.items.findIndex((x) => x.id === id);
    const before = this.page.items[i];
    if (!before || (before.kind !== 'shape' && before.kind !== 'angle')) return;
    const after: Shape | AngleItem = { ...before, meas };
    if (!meas.len && !meas.ang && !meas.area && !meas.per) delete after.meas;
    this.page.items[i] = after;
    this.push({ t: 'mod', p: this.cur, before, after });
    this.redraw();
  }

  /**
   * Ορίζει τη μέτρηση μιας πλευράς: σκέτος αριθμός αλλάζει το μήκος της (σε cm),
   * οτιδήποτε άλλο γίνεται ετικέτα, και το κενό επαναφέρει την πραγματική μέτρηση.
   */
  setMeasure(id: string, sideIndex: number, value: string): void {
    const idx = this.page.items.findIndex((x) => x.id === id);
    const ang = this.page.items[idx];
    if (ang && ang.kind === 'angle') {
      // πλευρά γωνίας: αριθμός = νέο μήκος σε cm, κείμενο = ετικέτα, κενό = η πραγματική μέτρηση
      const labels = { ...ang.labels };
      delete labels[sideIndex];
      const next: AngleItem = { ...ang, labels };
      const t = value.trim();
      if (/^\d+([.,]\d+)?$/.test(t)) {
        const len = parseFloat(t.replace(',', '.')) * CM;
        if (!(len > 0)) return;
        if (sideIndex) next.len2 = len; else next.len1 = len;
      } else if (t) labels[sideIndex] = t.slice(0, 16);
      if (Object.keys(labels).length === 0) delete next.labels;
      this.page.items[idx] = next;
      this.push({ t: 'mod', p: this.cur, before: ang, after: next });
      this.redraw();
      return;
    }
    const before = this.page.items[idx];
    if (!before || before.kind !== 'shape') return;
    const labels = { ...before.labels };
    delete labels[sideIndex];
    let after: Shape = { ...before, labels };
    const v = value.trim();
    if (sideIndex >= ANGLE_KEY) {
      // γωνία τριγώνου: η κορυφή και η μία πλευρά μένουν, η άλλη πλευρά στρέφεται γύρω από την κορυφή
      const i = sideIndex - ANGLE_KEY;
      const num = /^(\d+([.,]\d+)?)\s*°?$/.exec(v);
      if (!isPoly(before.shape)) return;
      if (num && before.shape !== 'triangle') {
        // ρόμβος ή παραλληλόγραμμο: οι πλευρές κρατούν το μήκος τους, αλλάζει η κλίση (και μαζί οι άλλες τρεις γωνίες)
        const want = (parseFloat(num[1].replace(',', '.')) * Math.PI) / 180;
        if (!(want > 0.02 && want < Math.PI - 0.02)) return;
        const pts = trianglePts(before).map((q): Pt => [q[0], q[1]]);
        const p = pts[i], q = pts[(i + 1) % 4], o = pts[(i + 3) % 4];
        const aq = Math.atan2(q[1] - p[1], q[0] - p[0]);
        let d = Math.atan2(o[1] - p[1], o[0] - p[0]) - aq;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        const na = aq + (d < 0 ? -want : want);
        const lo = Math.hypot(o[0] - p[0], o[1] - p[1]);
        const no: Pt = [p[0] + lo * Math.cos(na), p[1] + lo * Math.sin(na)];
        pts[(i + 3) % 4] = no;
        pts[(i + 2) % 4] = [q[0] + no[0] - p[0], q[1] + no[1] - p[1]];
        const xs = pts.map((c) => c[0]), ys = pts.map((c) => c[1]);
        after = { ...after, pts, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
      } else if (num) {
        const want = (parseFloat(num[1].replace(',', '.')) * Math.PI) / 180;
        if (!(want > 0.02 && want < Math.PI - 0.02)) return;
        const pts = trianglePts(before).map((q): Pt => [q[0], q[1]]);
        const p = pts[i], q = pts[(i + 1) % 3], o = pts[(i + 2) % 3];
        const aq = Math.atan2(q[1] - p[1], q[0] - p[0]);
        let d = Math.atan2(o[1] - p[1], o[0] - p[0]) - aq;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        const na = aq + (d < 0 ? -want : want);
        const lo = Math.hypot(o[0] - p[0], o[1] - p[1]);
        pts[(i + 2) % 3] = [p[0] + lo * Math.cos(na), p[1] + lo * Math.sin(na)];
        const xs = pts.map((c) => c[0]), ys = pts.map((c) => c[1]);
        after = { ...after, pts, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
      } else if (v) labels[sideIndex] = v.slice(0, 16);
      if (Object.keys(labels).length === 0) delete after.labels;
      this.page.items[idx] = after;
      this.push({ t: 'mod', p: this.cur, before, after });
      this.redraw();
      return;
    }
    const m = measureSides(before).find((x) => x.i === sideIndex);
    if (!m) return;
    if (/^\d+([.,]\d+)?$/.test(v)) {
      // πάνω σε άξονες ο αριθμός είναι στις μονάδες τους· πλάγια πλευρά σε άξονες με άλλη κλίμακα ο καθένας δεν έχει μήκος να οριστεί
      const cur = sideLen(m, unitsFor(this.page.items, before));
      if (cur === null) return;
      const f = parseFloat(v.replace(',', '.')) / cur;
      if (!(f > 0) || !Number.isFinite(f)) return;
      // το άκρο a μένει στη θέση του, το b μετακινείται πάνω στην ίδια ευθεία
      const b: Pt = [m.a[0] + (m.b[0] - m.a[0]) * f, m.a[1] + (m.b[1] - m.a[1]) * f];
      if (before.shape === 'line' || before.shape === 'arrow') after = { ...after, x1: b[0], y1: b[1] };
      else if (before.shape === 'rect') after = sideIndex === 0 ? { ...after, x1: b[0] } : { ...after, y1: b[1] };
      else if (before.shape === 'rhombus') {
        // ρόμβος: όλες οι πλευρές ίσες, άρα μεγαλώνει ολόκληρος γύρω από την κορυφή a
        const pts = trianglePts(before).map((q): Pt => [m.a[0] + (q[0] - m.a[0]) * f, m.a[1] + (q[1] - m.a[1]) * f]);
        const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
        after = { ...after, pts, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
      } else if (before.shape === 'para') {
        // παραλληλόγραμμο: μαζί με την πλευρά αλλάζει και η απέναντί της
        const pts = trianglePts(before).map((q): Pt => [q[0], q[1]]);
        const dx = b[0] - m.b[0], dy = b[1] - m.b[1];
        for (const k of [(sideIndex + 1) % 4, (sideIndex + 2) % 4]) pts[k] = [pts[k][0] + dx, pts[k][1] + dy];
        const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
        after = { ...after, pts, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
      } else {
        const pts = trianglePts(before).map((q): Pt => [q[0], q[1]]);
        pts[(sideIndex + 1) % 3] = b;
        const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
        after = { ...after, pts, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
      }
    } else if (v) labels[sideIndex] = v.slice(0, 16);
    if (Object.keys(labels).length === 0) delete after.labels;
    this.page.items[idx] = after;
    this.push({ t: 'mod', p: this.cur, before, after });
    this.redraw();
  }

  /**
   * Η περιοχή που κύκλωσε το τελευταίο λάσο (σε συντεταγμένες πίνακα). Χρησιμεύει για να σταλεί στο AI ό,τι φαίνεται εκεί,
   * ακόμα κι αν είναι κομμάτι εικόνας (π.χ. ερώτηση από σελίδα Word ή PDF) που δεν επιλέγεται ως στοιχείο.
   */
  region: Box | null = null;

  /** Αν η κυκλωμένη περιοχή έχει μέσα της κάτι. */
  get hasRegion(): boolean {
    const r = this.region;
    if (!r) return false;
    return this.page.items.some((it) => {
      const b = itemBounds(it);
      return b.x0 < r.x1 && b.x1 > r.x0 && b.y0 < r.y1 && b.y1 > r.y0;
    });
  }

  /** Εικόνα PNG όλων όσων φαίνονται μέσα στην κυκλωμένη περιοχή, για αποστολή στο AI. */
  async regionImage(): Promise<{ blob: Blob; box: Box; color: string } | null> {
    const b = this.region;
    if (!b) return null;
    const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    const s = Math.min(3, 1600 / Math.max(bw, bh));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(bw * s));
    cv.height = Math.max(1, Math.round(bh * s));
    const c = cv.getContext('2d')!;
    c.fillStyle = isDark(this.doc.bg) ? '#14201b' : '#ffffff';
    c.fillRect(0, 0, cv.width, cv.height);
    c.setTransform(s, 0, 0, s, -b.x0 * s, -b.y0 * s);
    for (const it of this.page.items) {
      const ib = itemBounds(it);
      if (ib.x0 < b.x1 && ib.x1 > b.x0 && ib.y0 < b.y1 && ib.y1 > b.y0) this.r.drawItem(c, it);
    }
    const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, 'image/png'));
    return blob ? { blob, box: b, color: this.color } : null;
  }

  get hasSelection(): boolean {
    return !!this.selected || this.multi.length > 0;
  }

  /** Τα id της τρέχουσας επιλογής (μονής ή ομαδικής). */
  get selectionIds(): string[] {
    return [...this.selectedIds()];
  }

  /** Εικόνα PNG των στοιχείων με τα δοσμένα id, για αποστολή σε αναγνώριση. */
  async inkImage(ids: string[]): Promise<{ blob: Blob; box: Box; color: string } | null> {
    const set = new Set(ids);
    const items = this.page.items.filter((it) => set.has(it.id));
    if (items.length === 0) return null;
    let box: Box | null = null;
    for (const it of items) {
      const b = itemBounds(it);
      box = box ? { x0: Math.min(box.x0, b.x0), y0: Math.min(box.y0, b.y0), x1: Math.max(box.x1, b.x1), y1: Math.max(box.y1, b.y1) } : b;
    }
    const b = box!;
    const pad = 18;
    const bw = b.x1 - b.x0 + pad * 2, bh = b.y1 - b.y0 + pad * 2;
    const s = Math.min(3, 1400 / Math.max(bw, bh));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(bw * s));
    cv.height = Math.max(1, Math.round(bh * s));
    const c = cv.getContext('2d')!;
    c.fillStyle = isDark(this.doc.bg) ? '#14201b' : '#ffffff';
    c.fillRect(0, 0, cv.width, cv.height);
    c.setTransform(s, 0, 0, s, (pad - b.x0) * s, (pad - b.y0) * s);
    for (const it of items) this.r.drawItem(c, it);
    const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, 'image/png'));
    const first = items[0];
    return blob ? { blob, box: b, color: 'color' in first ? first.color : this.color } : null;
  }

  /** Αντικαθιστά τα στοιχεία με τα δοσμένα id από ένα νέο (αναιρείται με ένα ↶). */
  replaceItems(ids: string[], item: Item): boolean {
    const set = new Set(ids);
    const before = this.page.items.slice();
    const rest = before.filter((it) => !set.has(it.id));
    if (rest.length === before.length) return false;
    rest.push(item);
    this.page.items = rest;
    this.selected = null;
    this.multi = [];
    this.push({ t: 'set', p: this.cur, before, after: rest.slice() });
    this.redraw();
    return true;
  }

  private selectedIds(): Set<string> {
    return new Set(this.multi.length ? this.multi : this.selected ? [this.selected] : []);
  }

  /** Το πλαίσιο της επιλογής σε συντεταγμένες οθόνης (για τη μπάρα ενεργειών δίπλα της). */
  selectionScreenBox(): Box | null {
    const ids = this.selectedIds();
    // όταν υπάρχει κυκλωμένη περιοχή, η μπάρα στέκεται κάτω από αυτήν (η επιλογή μπορεί να είναι ολόκληρη σελίδα-εικόνα)
    let b: Box | null = this.region;
    for (const it of b ? [] : this.page.items) {
      if (!ids.has(it.id)) continue;
      const ib = itemBounds(it);
      b = b ? { x0: Math.min(b.x0, ib.x0), y0: Math.min(b.y0, ib.y0), x1: Math.max(b.x1, ib.x1), y1: Math.max(b.y1, ib.y1) } : ib;
    }
    if (!b) return null;
    const [x0, y0] = this.toScreen(b.x0, b.y0);
    const [x1, y1] = this.toScreen(b.x1, b.y1);
    return { x0, y0, x1, y1 };
  }

  private groupBounds(): Box | null {
    const ids = new Set(this.multi);
    let b: Box | null = null;
    for (const it of this.page.items) {
      if (!ids.has(it.id)) continue;
      const ib = itemBounds(it);
      b = b ? { x0: Math.min(b.x0, ib.x0), y0: Math.min(b.y0, ib.y0), x1: Math.max(b.x1, ib.x1), y1: Math.max(b.y1, ib.y1) } : ib;
    }
    return b;
  }

  /** Αντίγραφο της επιλογής, λίγο πιο κάτω-δεξιά. */
  duplicateSelected(): void {
    const ids = this.selectedIds();
    if (ids.size === 0) return;
    const before = this.page.items.slice();
    const copies = before.filter((it) => ids.has(it.id)).map((it) => translateItem(cloneItem(it), 30, 30));
    this.page.items.push(...copies);
    this.selected = copies.length === 1 ? copies[0].id : null;
    this.multi = copies.length > 1 ? copies.map((c) => c.id) : [];
    this.push({ t: 'set', p: this.cur, before, after: this.page.items.slice() });
    this.redraw();
  }

  /** Κοινή αρχή O και άκρα A, B των δύο πλευρών από τις οποίες βγαίνει μια συνισταμένη. */
  private linkGeom(aId: string, bId: string): { o: Pt; a: Pt; b: Pt; color: string; width: number } | null {
    const items = this.page.items;
    const a = items.find((x) => x.id === aId), b = items.find((x) => x.id === bId);
    if (a && a.kind === 'angle') {
      const [p1, p2] = angleEnds(a);
      return { o: [a.x, a.y], a: p1, b: p2, color: a.color, width: a.width };
    }
    const ok = (q: Item | undefined): q is Shape => !!q && q.kind === 'shape' && (q.shape === 'arrow' || q.shape === 'line');
    if (!ok(a) || !ok(b)) return null;
    // ένα βέλος ξεκινά πάντα από την αρχή του· μια ευθεία μπορεί να «γυρίσει», όποιο άκρο της είναι πιο κοντά στο άλλο
    const ends = (q: Shape): [Pt, Pt][] => (q.shape === 'line' ? [[[q.x0, q.y0], [q.x1, q.y1]], [[q.x1, q.y1], [q.x0, q.y0]]] : [[[q.x0, q.y0], [q.x1, q.y1]]]);
    let best: { d: number; p: [Pt, Pt]; q: [Pt, Pt] } | null = null;
    for (const p of ends(a)) for (const q of ends(b)) {
      const d = Math.hypot(p[0][0] - q[0][0], p[0][1] - q[0][1]);
      if (!best || d < best.d) best = { d, p, q };
    }
    const { p, q } = best!;
    // το δεύτερο μεταφέρεται παράλληλα ώστε να ξεκινά από την αρχή του πρώτου
    return { o: p[0], a: p[1], b: [q[1][0] + p[0][0] - q[0][0], q[1][1] + p[0][1] - q[0][1]], color: a.color, width: a.width };
  }

  /**
   * Από τι μπορεί να βγει συνισταμένη με την τωρινή επιλογή: μια γωνία, δύο βέλη/ευθείες με κοινή κορυφή,
   * ή ένα βέλος/ευθεία που «κούμπωσε» στην αρχή άλλου. Επιστρέφει τα id των δύο πλευρών.
   */
  get resultantSource(): [string, string] | null {
    const items = this.page.items;
    const ok = (q: Item | undefined): q is Shape => !!q && q.kind === 'shape' && (q.shape === 'arrow' || q.shape === 'line') && !q.dash && !q.link;
    if (this.multi.length === 2) {
      const [a, b] = this.multi.map((id) => items.find((x) => x.id === id));
      if (!ok(a) || !ok(b)) return null;
      const pts = (q: Shape): Pt[] => (q.shape === 'line' ? [[q.x0, q.y0], [q.x1, q.y1]] : [[q.x0, q.y0]]);
      const common = pts(a).some((p) => pts(b).some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 16));
      return common ? [a.id, b.id] : null;
    }
    const sel = this.selected ? items.find((x) => x.id === this.selected) : undefined;
    if (!sel) return null;
    if (sel.kind === 'angle') return [sel.id, sel.id];
    if (!ok(sel)) return null;
    const mate = items.find((x) => x.id === sel.angleWith) ?? items.find((x) => ok(x) && x.angleWith === sel.id);
    return ok(mate) ? [mate.id, sel.id] : null;
  }

  /** Σχεδιάζει το παραλληλόγραμμο και τη συνισταμένη· και τα τρία μένουν δεμένα με τις δύο πλευρές. */
  addResultant(): void {
    const src = this.resultantSource;
    const g = src && this.linkGeom(src[0], src[1]);
    if (!src || !g) return;
    const [a, b] = src;
    // υπάρχει ήδη συνισταμένη για αυτές τις πλευρές: απλώς την επιλέγουμε
    const have = this.page.items.find((x) => x.kind === 'shape' && x.link?.role === 'sum' && [x.link.a, x.link.b].sort().join() === [a, b].sort().join());
    if (have) {
      this.selected = have.id;
      this.multi = [];
      this.redraw();
      this.onUi();
      return;
    }
    const before = this.page.items.slice();
    const base = { kind: 'shape' as const, x0: 0, y0: 0, x1: 0, y1: 0 };
    const side = (role: 'sideA' | 'sideB'): Shape => ({
      ...base, id: uid(), shape: 'line', color: g.color, width: Math.max(1.5, g.width / 2), dash: true, link: { a, b, role },
    });
    const color = g.color === '#e11d48' || g.color === '#fb7185' ? '#2563eb' : isDark(this.doc.bg) ? '#fb7185' : '#e11d48';
    const sum: Shape = {
      ...base, id: uid(), shape: 'arrow', color, width: g.width, link: { a, b, role: 'sum' },
      angleWith: this.page.items.find((x) => x.id === a)?.kind === 'shape' ? a : undefined,
    };
    this.page.items.push(side('sideA'), side('sideB'), sum);
    this.selected = sum.id;
    this.multi = [];
    this.push({ t: 'set', p: this.cur, before, after: this.page.items.slice() });
    this.redraw();
  }

  /**
   * Φέρνει τις συνισταμένες και τα παραλληλόγραμμά τους στη θέση που ορίζουν οι πλευρές τους.
   * Αν μια πλευρά έχει σβηστεί, η συνισταμένη μένει όπως είναι, ελεύθερη.
   */
  private syncLinks(): boolean {
    const items = this.page.items;
    let changed = false;
    items.forEach((it, i) => {
      if (it.kind !== 'shape' || !it.link) return;
      const g = this.linkGeom(it.link.a, it.link.b);
      if (!g) {
        const { link: _drop, ...free } = it;
        items[i] = free;
        changed = true;
        return;
      }
      const r: Pt = [g.a[0] + g.b[0] - g.o[0], g.a[1] + g.b[1] - g.o[1]];
      const from = it.link.role === 'sum' ? g.o : it.link.role === 'sideA' ? g.a : g.b;
      if (Math.hypot(it.x0 - from[0], it.y0 - from[1]) + Math.hypot(it.x1 - r[0], it.y1 - r[1]) < 1e-6) return;
      items[i] = { ...it, x0: from[0], y0: from[1], x1: r[0], y1: r[1] };
      changed = true;
    });
    return changed;
  }

  deleteSelected(): void {
    if (this.multi.length) {
      const ids = new Set(this.multi);
      const before = this.page.items.slice();
      this.page.items = before.filter((it) => !ids.has(it.id));
      this.multi = [];
      this.push({ t: 'set', p: this.cur, before, after: this.page.items.slice() });
      this.redraw();
      return;
    }
    if (!this.selected) return;
    const items = this.page.items;
    const i = items.findIndex((x) => x.id === this.selected);
    if (i < 0) return;
    const [item] = items.splice(i, 1);
    this.selected = null;
    this.multi = [];
    this.push({ t: 'del', p: this.cur, items: [{ item, i }] });
    this.redraw();
  }

  clearPage(): void {
    const items = this.page.items;
    if (items.length === 0) return;
    const removed = items.map((item, i) => ({ item, i }));
    items.length = 0;
    this.selected = null;
    this.multi = [];
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

  getImg(p: Pic): HTMLImageElement | null {
    let img = this.imgs.get(p.id);
    if (!img) {
      img = new Image();
      img.onload = () => this.redraw();
      img.src = p.src;
      this.imgs.set(p.id, img);
    }
    return img.complete && img.naturalWidth > 0 ? img : null;
  }


  private setWorldTransform(c: CanvasRenderingContext2D): void {
    const v = this.page.view;
    const d = this.dpr;
    c.setTransform(d * v.k, 0, 0, d * v.k, d * v.x, d * v.y);
  }

  private dragPreviewIds(): Set<string> {
    const ids = new Set<string>();
    for (const p of this.ptrs.values()) if (p.orig) ids.add(p.orig.id);
    // ό,τι ταλαντώνεται ζωγραφίζεται στο ζωντανό στρώμα, για να μην ξαναστήνεται όλη η σελίδα σε κάθε καρέ
    for (const id of this.osc.keys()) ids.add(id);
    if (this.oscDrag) ids.add(this.oscDrag.id);
    return ids;
  }

  // ---------- ταλάντωση ελατηρίων ----------

  /** Ελατήρια που ταλαντώνονται τώρα (δεν αποθηκεύεται). */
  private osc = new Map<string, { amp: number; t0: number }>();
  /** Σώμα που τραβιέται αυτή τη στιγμή. */
  private oscDrag: { id: string; d: number } | null = null;
  private oscRaf = 0;

  springState(s: StampItem): SpringState {
    const marks = !!s.marks;
    if (this.oscDrag?.id === s.id) return { d: this.oscDrag.d, amp: Math.abs(this.oscDrag.d), marks };
    const o = this.osc.get(s.id);
    if (!o) return { d: 0, amp: 0, marks };
    const t = performance.now() - o.t0;
    const fade = s.damp ? Math.exp(-t / OSC_FADE_MS) : 1;
    return { d: o.amp * fade * Math.cos((2 * Math.PI * t) / OSC_PERIOD_MS), amp: Math.abs(o.amp), marks };
  }

  /** Το ελατήριο του οποίου το σώμα βρίσκεται κάτω από το σημείο. */
  private springAt(wx: number, wy: number): StampItem | null {
    const items = this.page.items;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.kind !== 'stamp') continue;
      const g = STAMPS[it.name]?.spring?.(it.w, it.h);
      if (!g) continue;
      const d = this.springState(it).d;
      const [ux, uy] = unrot(it, wx, wy);
      if (Math.hypot(ux - (it.x + g.cx + g.ux * d), uy - (it.y + g.cy + g.uy * d)) < g.r) return it;
    }
    return null;
  }

  private runOsc(): void {
    if (this.oscRaf) return;
    const loop = (): void => {
      const now = performance.now();
      for (const [id, o] of this.osc) {
        const it = this.page.items.find((x) => x.id === id);
        // σβήνει όταν το πλάτος γίνει αμελητέο ή το ελατήριο διαγραφεί
        if (!it || it.kind !== 'stamp' || (it.damp && Math.abs(o.amp) * Math.exp(-(now - o.t0) / OSC_FADE_MS) < 0.7)) this.osc.delete(id);
      }
      if (this.osc.size) {
        this.renderLive();
        this.oscRaf = requestAnimationFrame(loop);
      } else {
        this.oscRaf = 0;
        this.redraw();
      }
    };
    this.oscRaf = requestAnimationFrame(loop);
  }

  /** Το επιλεγμένο ελατήριο, αν η επιλογή είναι ελατήριο. */
  get selectedSpring(): StampItem | null {
    const it = this.selected ? this.page.items.find((x) => x.id === this.selected) : undefined;
    return it && it.kind === 'stamp' && STAMPS[it.name]?.spring ? it : null;
  }

  get springMoving(): boolean {
    return !!this.selected && this.osc.has(this.selected);
  }

  /** Αλλάζει ιδιότητα του επιλεγμένου ελατηρίου (σημάνσεις, απόσβεση). */
  updateSpring(patch: Partial<StampItem>): void {
    const before = this.selectedSpring;
    if (!before) return;
    const after = { ...before, ...patch } as StampItem;
    this.page.items[this.page.items.indexOf(before)] = after;
    this.push({ t: 'mod', p: this.cur, before, after });
    this.redraw();
  }

  /** Σταματά την ταλάντωση του επιλεγμένου ελατηρίου· το σώμα γυρίζει στη θέση ισορροπίας. */
  stopSpring(): void {
    if (this.selected) this.osc.delete(this.selected);
    this.redraw();
    this.onUi();
  }

  redraw(): void {
    const c = this.bctx;
    const v = this.page.view;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.base.width, this.base.height);
    this.setWorldTransform(c);
    const [x0, y0] = this.toWorld(0, 0);
    const [x1, y1] = this.toWorld(this.W, this.H);
    this.r.paintBackground(c, x0, y0, x1, y1, v.k);
    const hidden = this.dragPreviewIds();
    const rp = this.replay;
    const items = this.page.items;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (hidden.has(it.id)) continue;
      if (rp && i > rp.i) break;
      if (rp && i === rp.i && it.kind === 'stroke') {
        if (rp.prog > 0) this.r.drawStroke(c, { ...it, pts: it.pts.slice(0, rp.prog) });
        break;
      }
      this.r.drawItem(c, it);
      if (it.kind === 'shape' && it.meas) this.r.drawMeasures(c, it);
    }
    this.renderLive();
    this.onView();
  }

  renderLive(): void {
    const c = this.lctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.live.width, this.live.height);
    this.setWorldTransform(c);
    const k = this.page.view.k;
    const selIds = this.selectedIds();
    if (this.region && this.tool === 'select' && (selIds.size === 0 || this.page.items.some((it) => it.kind === 'image' && selIds.has(it.id)))) {
      // η περιοχή που θα δει το AI: φαίνεται όταν το λάσο έπιασε κομμάτι εικόνας και όχι ξεχωριστά στοιχεία
      const r = this.region;
      c.save();
      c.strokeStyle = '#7c68b0';
      c.fillStyle = 'rgba(124,104,176,.07)';
      c.lineWidth = 2 / k;
      c.setLineDash([8 / k, 6 / k]);
      c.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
      c.strokeRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
      c.restore();
    }
    for (const id of new Set([...this.osc.keys(), ...(this.oscDrag ? [this.oscDrag.id] : [])])) {
      const it = this.page.items.find((x) => x.id === id);
      if (it && !this.replay) this.r.drawItem(c, it);
    }
    let selItem: Item | undefined;
    for (const p of this.ptrs.values()) {
      if (p.live) {
        this.r.drawItem(c, p.live);
        if (p.live.kind === 'shape' && p.live.meas) this.r.drawMeasures(c, p.live);
      } else if (p.stroke) this.r.drawStroke(c, p.stroke);
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
        this.r.drawItem(c, p.preview);
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
      if (this.cornerResizable(selItem)) {
        c.beginPath();
        c.arc(b.x1, b.y1, 12 / k, 0, Math.PI * 2);
        c.fill();
      }
      // στους άξονες οι λαβές είναι πολλές και κοντά: μικρότερες, με λευκό περίγραμμα
      const hr = (selItem.kind === 'axes' ? 8 : 12) / k;
      for (const p of this.pointHandles(selItem)) {
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
      if (this.rotatable(selItem)) {
        this.drawRotHandle(c, b);
        if (this.pivot?.key === this.pivotKey()) this.drawPivot(c, this.pivotPoint(b, selItem));
      }
      c.restore();
    }
    if (this.multi.length && this.tool === 'select') {
      const ids = new Set(this.multi);
      c.save();
      c.strokeStyle = '#2563eb';
      c.fillStyle = '#2563eb';
      c.lineWidth = 1 / k;
      c.globalAlpha = 0.5;
      for (const it of this.page.items) {
        if (!ids.has(it.id)) continue;
        const ib = itemBounds(it);
        c.strokeRect(ib.x0, ib.y0, ib.x1 - ib.x0, ib.y1 - ib.y0);
      }
      c.globalAlpha = 1;
      const b = this.groupBounds();
      if (b) {
        c.lineWidth = 2 / k;
        c.setLineDash([8 / k, 6 / k]);
        c.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
        c.beginPath();
        c.arc(b.x1, b.y1, 12 / k, 0, Math.PI * 2);
        c.fill();
        this.drawRotHandle(c, b);
        if (this.pivot?.key === this.pivotKey()) this.drawPivot(c, this.pivotPoint(b));
      }
      c.restore();
    }
    if (this.lasers.length) {
      const now = performance.now();
      c.save();
      c.strokeStyle = c.fillStyle = '#ff2d2d';
      c.shadowColor = '#ff2d2d';
      c.shadowBlur = 14;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.lineWidth = 6 / k;
      for (const l of this.lasers) {
        c.globalAlpha = l.t ? Math.max(0, 1 - (now - l.t) / LASER_MS) : 1;
        c.beginPath();
        l.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
        if (l.pts.length === 1) c.lineTo(l.pts[0][0] + 0.01, l.pts[0][1]);
        c.stroke();
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

  private cornerResizable(it: Item): boolean {
    return it.kind === 'image' || it.kind === 'shape' || it.kind === 'axes' || it.kind === 'stamp' || it.kind === 'trig';
  }

  private rotatable(it: Item): boolean {
    return it.kind !== 'axes' && it.kind !== 'trig';
  }

  /** Οι άκρες ενός στοιχείου που μπορούν να γίνουν κέντρο περιστροφής (άκρα γραμμής, κορυφές, γωνίες πλαισίου). */
  private pivots(it: Item): Pt[] {
    if (it.kind === 'stroke') return it.pts.length > 1 ? [[it.pts[0][0], it.pts[0][1]], [it.pts[it.pts.length - 1][0], it.pts[it.pts.length - 1][1]]] : [];
    if (it.kind === 'angle') return [[it.x, it.y], ...angleEnds(it)];
    if (it.kind === 'shape' && (it.shape === 'line' || it.shape === 'arrow')) return [[it.x0, it.y0], [it.x1, it.y1]];
    if (it.kind === 'shape' && isPoly(it.shape)) return trianglePts(it);
    const rot = itemRot(it);
    const b = it.kind === 'shape' ? it : itemBounds(rot ? ({ ...it, rot: 0 } as Item) : it);
    const mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2, cs = Math.cos(rot), sn = Math.sin(rot);
    return ([[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]] as Pt[]).map(([x, y]) => [mx + (x - mx) * cs - (y - my) * sn, my + (x - mx) * sn + (y - my) * cs]);
  }

  private pivotKey(): string {
    return this.selected ?? this.multi.join(',');
  }

  /** Το σημείο γύρω από το οποίο στρέφεται η επιλογή: το κέντρο του πλαισίου, ή η άκρη που έχει διαλεχτεί. */
  private pivotPoint(b: Box, it?: Item): Pt {
    const ctr: Pt = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
    const pv = this.pivot;
    if (!pv || pv.key !== this.pivotKey()) return ctr;
    return it ? this.pivots(it)[pv.i] ?? ctr : pv.p;
  }

  /** Πάτημα στη λαβή περιστροφής: κέντρο → κάθε άκρη με τη σειρά → πάλι κέντρο. */
  private nextPivot(b: Box, it?: Item): void {
    const key = this.pivotKey();
    const list = it ? this.pivots(it) : ([[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]] as Pt[]);
    const i = this.pivot && this.pivot.key === key ? this.pivot.i + 1 : 0;
    this.pivot = i < list.length ? { key, i, p: list[i] } : null;
  }

  private drawPivot(c: CanvasRenderingContext2D, p: Pt): void {
    const k = this.page.view.k;
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

  /** Η λαβή περιστροφής: πάνω από τη μέση του πλαισίου επιλογής. */
  private rotHandle(b: Box): Pt {
    return [(b.x0 + b.x1) / 2, b.y0 - 38 / this.page.view.k];
  }

  private drawRotHandle(c: CanvasRenderingContext2D, b: Box): void {
    const k = this.page.view.k;
    const [hx, hy] = this.rotHandle(b);
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

  /** Αν η γραφίδα δεν έχει ακόμα συρθεί γύρω από το κέντρο (λιγότερο από 8 px στην οθόνη). */
  private rotStill(ps: PState, wx: number, wy: number): boolean {
    const [cx, cy] = ps.start!;
    const d = Math.atan2(wy - cy, wx - cx) - ps.a0!;
    return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) * Math.hypot(wx - cx, wy - cy) * this.page.view.k < 8;
  }

  /** Γωνία περιστροφής από τη θέση της γραφίδας· κοντά σε πολλαπλάσια των 15° «κουμπώνει». */
  private rotAngle(ps: PState, wx: number, wy: number): number {
    const [cx, cy] = ps.start!;
    let deg = ((Math.atan2(wy - cy, wx - cx) - ps.a0!) * 180) / Math.PI;
    const near = Math.round(deg / 15) * 15;
    if (Math.abs(near - deg) <= 3) deg = near;
    return (deg * Math.PI) / 180;
  }

  /** Λαβές-σημεία ενός στοιχείου (άκρα γωνίας, σημείο τριγωνομετρικού κύκλου). */
  private pointHandles(it: Item): Pt[] {
    if (it.kind === 'angle') return angleEnds(it);
    if (it.kind === 'trig') return [trigPoint(it)];
    if (it.kind === 'axes') return this.r.axesHandles(it).map((h) => h.p);
    return [];
  }

  private fadeLasers(): void {
    if (this.laserRaf) return;
    const loop = (): void => {
      const now = performance.now();
      this.lasers = this.lasers.filter((l) => !l.t || now - l.t < LASER_MS);
      this.renderLive();
      this.laserRaf = this.lasers.some((l) => l.t) ? requestAnimationFrame(loop) : 0;
    };
    this.laserRaf = requestAnimationFrame(loop);
  }

  // ---------- αναπαραγωγή ----------

  get replaying(): boolean {
    return !!this.replay;
  }

  get replayPaused(): boolean {
    return !!this.replay?.paused;
  }

  /** Ξαναπαίζει τη σελίδα με τη σειρά που γράφτηκε. */
  startReplay(): void {
    if (this.replay || this.page.items.length === 0) return;
    this.selected = null;
    this.multi = [];
    this.replay = { i: 0, prog: 0, wait: 0, paused: false };
    this.onUi();
    const loop = (): void => {
      if (!this.replay) return;
      if (!this.replay.paused) this.replayAdvance();
      if (!this.replay) return;
      this.redraw();
      this.replayRaf = requestAnimationFrame(loop);
    };
    loop();
  }

  private replayNext(): void {
    const rp = this.replay!;
    rp.i++;
    rp.prog = 0;
    rp.wait = 0;
    const items = this.page.items;
    // οι εικόνες εμφανίζονται αμέσως
    while (rp.i < items.length && items[rp.i].kind === 'image') rp.i++;
    if (rp.i >= items.length) this.stopReplay();
  }

  private replayAdvance(): void {
    const rp = this.replay!;
    const it = this.page.items[rp.i];
    if (!it) {
      this.stopReplay();
      return;
    }
    if (it.kind === 'image') {
      this.replayNext();
    } else if (it.kind === 'stroke' && rp.prog < it.pts.length) {
      let d = 0;
      while (rp.prog < it.pts.length && d < 16) {
        if (rp.prog > 0) d += Math.hypot(it.pts[rp.prog][0] - it.pts[rp.prog - 1][0], it.pts[rp.prog][1] - it.pts[rp.prog - 1][1]);
        rp.prog++;
      }
    } else if (++rp.wait > (it.kind === 'stroke' ? 5 : 22)) {
      this.replayNext();
    }
  }

  toggleReplayPause(): void {
    if (!this.replay) return;
    this.replay.paused = !this.replay.paused;
    this.onUi();
  }

  /** Ολοκληρώνει το τρέχον βήμα, πάει στο επόμενο και σταματά εκεί. */
  replayStep(): void {
    if (!this.replay) return;
    this.replay.paused = true;
    const it = this.page.items[this.replay.i];
    if (it && it.kind === 'stroke' && this.replay.prog < it.pts.length) this.replay.prog = it.pts.length;
    else this.replayNext();
    if (this.replay) {
      const nx = this.page.items[this.replay.i];
      if (nx && nx.kind === 'stroke') this.replay.prog = nx.pts.length;
    }
    this.onUi();
  }

  stopReplay(): void {
    if (!this.replay) return;
    cancelAnimationFrame(this.replayRaf);
    this.replay = null;
    this.redraw();
    this.onUi();
  }

  private eraserRadius(): number {
    return this.sizes.eraser / this.page.view.k;
  }

  // ---------- εξαγωγή ----------

  /** Ζωγραφίζει ολόκληρη μια σελίδα (όλα τα στοιχεία της με περιθώριο) σε νέο καμβά. */
  private async pageCanvas(pi: number, opaque: boolean): Promise<HTMLCanvasElement> {
    await this.loadImages(pi);
    return this.drawPage(pi, opaque, false);
  }

  /** Περιμένει να φορτωθούν οι εικόνες μιας σελίδας (ή όλων, χωρίς όρισμα). */
  async loadImages(pi?: number): Promise<void> {
    const pages = pi === undefined ? this.doc.pages : [this.doc.pages[pi]];
    await Promise.all(
      pages.flatMap((pg) => pg.items).filter((i): i is Pic => i.kind === 'image').map((p) => {
        this.getImg(p);
        const img = this.imgs.get(p.id)!;
        return img.complete ? Promise.resolve() : new Promise<void>((r) => { img.addEventListener('load', () => r()); img.addEventListener('error', () => r()); });
      })
    );
  }

  /** Σύγχρονη σχεδίαση σελίδας με όσες εικόνες έχουν ήδη φορτωθεί. `paper`: για εκτύπωση, πάντα σε λευκό φόντο. */
  private drawPage(pi: number, opaque: boolean, paper: boolean): HTMLCanvasElement {
    const items = this.doc.pages[pi].items;
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
    // η σχεδίαση διαβάζει την τρέχουσα σελίδα και το φόντο· τα αλλάζουμε προσωρινά (σύγχρονα)
    const keep = this.cur;
    const bg = this.doc.bg;
    const clear = this.transparent;
    this.cur = pi;
    if (paper) {
      this.paper = isDark(bg);
      this.doc.bg = bg.replace(/^dark-?/, '') as Background || 'white';
      this.transparent = false;
    }
    try {
      if (opaque && this.transparent) {
        c.fillStyle = '#ffffff';
        c.fillRect(0, 0, cv.width, cv.height);
      }
      c.setTransform(s, 0, 0, s, -x0 * s, -y0 * s);
      this.r.paintBackground(c, x0, y0, x1, y1, s);
      for (const it of items) {
        this.r.drawItem(c, it);
        if (it.kind === 'shape' && it.meas) this.r.drawMeasures(c, it);
      }
    } finally {
      this.cur = keep;
      this.doc.bg = bg;
      this.transparent = clear;
      this.paper = false;
    }
    return cv;
  }

  /**
   * Οι σελίδες για τον εκτυπωτή (JPEG data URL), πάντα σε λευκό φόντο. Σύγχρονη, γιατί ο browser δεν περιμένει όταν πατηθεί «Εκτύπωση»·
   * οι εικόνες πρέπει να έχουν φορτωθεί από πριν με loadImages().
   */
  printPages(mark?: HTMLImageElement | null): string[] {
    return this.doc.pages.map((_, pi) => {
      const cv = this.drawPage(pi, true, true);
      if (mark) stampMark(cv, mark);
      return cv.toDataURL('image/jpeg', 0.9);
    });
  }

  /** Μικρογραφία της πρώτης σελίδας (JPEG data URL), για τη βιβλιοθήκη μαθημάτων. */
  async thumb(maxW = 360): Promise<string> {
    const cv = await this.pageCanvas(0, true);
    const s = Math.min(1, maxW / cv.width, (maxW * 0.7) / cv.height);
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(cv.width * s));
    out.height = Math.max(1, Math.round(cv.height * s));
    out.getContext('2d')!.drawImage(cv, 0, 0, out.width, out.height);
    return out.toDataURL('image/jpeg', 0.7);
  }

  /** Μικρογραφία της σελίδας pi, για την επιλογή σελίδων στην εξαγωγή. */
  async pageThumb(pi: number, maxW: number): Promise<HTMLCanvasElement> {
    const cv = await this.pageCanvas(pi, true);
    const s = Math.min(1, maxW / cv.width);
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(cv.width * s));
    out.height = Math.max(1, Math.round(cv.height * s));
    out.getContext('2d')!.drawImage(cv, 0, 0, out.width, out.height);
    return out;
  }

  async exportPng(): Promise<Blob> {
    const cv = await this.pageCanvas(this.cur, false);
    return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('PNG'))), 'image/png'));
  }

  /** Οι σελίδες (όλες, ή μόνο όσες δίνει η λίστα `only`) ως εικόνες JPEG, για το PDF. */
  async exportJpegPages(onProgress: (done: number, total: number) => void, mark?: HTMLImageElement, only?: number[]): Promise<{ jpeg: Uint8Array; w: number; h: number }[]> {
    const out: { jpeg: Uint8Array; w: number; h: number }[] = [];
    const list = only ?? this.doc.pages.map((_, i) => i);
    const n = list.length;
    for (let i = 0; i < n; i++) {
      onProgress(i, n);
      const cv = await this.pageCanvas(list[i], true);
      if (mark) stampMark(cv, mark);
      const blob = await new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('JPEG'))), 'image/jpeg', 0.9));
      out.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), w: cv.width, h: cv.height });
    }
    return out;
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
      // εικόνες, άξονες, τριγωνομετρικός κύκλος, σχήματα φυσικής και πίνακες σβήνονται μόνο με τον κάδο
      // (ο πίνακας ειδικά για να σβήνεις ό,τι έγραψες στα κελιά χωρίς να χαλάς τις γραμμές του)
      if (it.kind === 'image' || it.kind === 'axes' || it.kind === 'trig' || it.kind === 'stamp' || (it.kind === 'shape' && it.shape === 'table')) continue;
      // πρώτα οι μετρήσεις: η γόμα πάνω σε ένα μήκος ή μια γωνία σβήνει την ένδειξη, όχι το σχήμα
      const bare = eraseMeasures(it, x, y, r);
      if (bare) {
        items[i] = bare;
        changed = true;
        continue;
      }
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
    if (this.replay) return;
    this.live.setPointerCapture(e.pointerId);
    this.onPointerInfo(e, this.ptrs.size + 1);
    const ps: PState = { id: e.pointerId, type: e.pointerType, x: e.clientX, y: e.clientY, t0: performance.now(), mode: 'none' };
    this.ptrs.set(e.pointerId, ps);
    // κάθε νέο άγγιγμα ακυρώνει την περιοχή του προηγούμενου λάσου
    const hadRegion = !!this.region;
    this.region = null;
    if (hadRegion) this.onUi();

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
        // βέλος/ευθεία που ξεκινά πολύ κοντά στην αρχή άλλου: κουμπώνει εκεί και δείχνει τη γωνία τους
        let sx = wx, sy = wy, angleWith: string | undefined;
        if (this.shapeKind === 'arrow' || this.shapeKind === 'line') {
          const items = this.page.items;
          for (let i = items.length - 1; i >= 0; i--) {
            const it = items[i];
            if (it.kind === 'shape' && (it.shape === 'arrow' || it.shape === 'line') && Math.hypot(it.x0 - wx, it.y0 - wy) < 28 / v.k) {
              sx = it.x0; sy = it.y0; angleWith = it.id;
              break;
            }
          }
        }
        ps.live = this.shapeKind === 'angle'
          ? { kind: 'angle', id: uid(), x: wx, y: wy, a1: 0, a2: 0, len1: 0, len2: 0, color: this.color, width: this.width }
          : {
            kind: 'shape', id: uid(), shape: this.shapeKind,
            x0: sx, y0: sy, x1: wx, y1: wy, color: this.color, width: this.width, angleWith,
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
      case 'measure':
        // πάτημα ή σύρσιμο μέσα σε μια γωνία τη μετράει· το τόξο μένει στη σελίδα όταν σηκώσεις τη γραφίδα
        ps.mode = 'measure';
        ps.start = [e.clientX, e.clientY];
        ps.live = this.angleAround(wx, wy) ?? undefined;
        this.renderLive();
        break;
      case 'laser':
        ps.mode = 'laser';
        ps.laser = { pts: [[wx, wy]], t: 0 };
        this.lasers.push(ps.laser);
        this.renderLive();
        break;
      case 'hand':
        ps.mode = 'pan';
        ps.start = [e.clientX, e.clientY];
        ps.v0 = { ...v };
        break;
      case 'select': {
        const items = this.page.items;
        // πιάνοντας το σώμα ενός ελατηρίου το τραβάς· όταν το αφήσεις ταλαντώνεται
        const spring = this.springAt(wx, wy);
        if (spring) {
          this.osc.delete(spring.id);
          this.selected = spring.id;
          this.multi = [];
          this.oscDrag = { id: spring.id, d: 0 };
          ps.mode = 'osc';
          ps.start = [wx, wy];
          this.redraw();
          this.onUi();
          return;
        }
        const sel = this.selected ? items.find((x) => x.id === this.selected) : undefined;
        if (sel) {
          const hi = this.pointHandles(sel).findIndex((p) => Math.hypot(wx - p[0], wy - p[1]) < 24 / v.k);
          const b = itemBounds(sel);
          const corner = this.cornerResizable(sel) && Math.hypot(wx - b.x1, wy - b.y1) < 24 / v.k;
          const rh = this.rotHandle(b);
          if (hi < 0 && !corner && this.rotatable(sel) && Math.hypot(wx - rh[0], wy - rh[1]) < 22 / v.k) {
            ps.mode = 'rotate';
            ps.orig = sel;
            ps.preview = sel;
            ps.start = this.pivotPoint(b, sel);
            ps.a0 = Math.atan2(wy - ps.start[1], wx - ps.start[0]);
            ps.tap = true;
            this.redraw();
            return;
          }
          if (hi >= 0 || corner) {
            ps.mode = 'resize';
            ps.handle = hi >= 0 ? hi + 1 : 0;
            ps.orig = sel;
            ps.preview = sel;
            ps.start = [wx, wy];
            this.redraw();
            return;
          }
        }
        if (this.multi.length) {
          const b = this.groupBounds();
          if (b) {
            const corner = Math.hypot(wx - b.x1, wy - b.y1) < 24 / v.k;
            const inside = wx >= b.x0 && wx <= b.x1 && wy >= b.y0 && wy <= b.y1;
            const rh = this.rotHandle(b);
            if (!corner && Math.hypot(wx - rh[0], wy - rh[1]) < 22 / v.k) {
              ps.mode = 'grotate';
              ps.before = items.slice();
              ps.ids = new Set(this.multi);
              ps.start = this.pivotPoint(b);
              ps.a0 = Math.atan2(wy - ps.start[1], wx - ps.start[0]);
              ps.tap = true;
              return;
            }
            if (corner || inside) {
              ps.mode = corner ? 'gresize' : 'gmove';
              ps.before = items.slice();
              ps.ids = new Set(this.multi);
              ps.gb = b;
              ps.start = [wx, wy];
              return;
            }
          }
        }
        const hit = this.hitTest(wx, wy);
        this.multi = [];
        // πάνω σε μη επιλεγμένη εικόνα (π.χ. σελίδα PDF) το σύρσιμο κάνει λάσο· το απλό άγγιγμα την επιλέγει
        if (hit && !(hit.kind === 'image' && hit.id !== this.selected)) {
          this.selected = hit.id;
          ps.mode = 'move';
          ps.orig = hit;
          ps.preview = hit;
          ps.start = [wx, wy];
          this.redraw();
        } else {
          this.selected = null;
          ps.mode = 'lasso';
          ps.lasso = [[wx, wy]];
          ps.tapHit = hit?.id;
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
      zoom: false,
    };
    this.redraw();
  }

  /** Ακυρώνει ό,τι έκανε ένας δείκτης χωρίς να το καταχωρήσει. */
  private cancelPointer(ps: PState): void {
    if ((ps.mode === 'erase' || ps.mode === 'gmove' || ps.mode === 'gresize') && ps.changed && ps.before) this.page.items = ps.before;
    if (ps.laser) this.lasers = this.lasers.filter((l) => l !== ps.laser);
    ps.laser = undefined;
    ps.lasso = undefined;
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
      if (ps.mode !== 'draw' || !ps.stroke || ps.stroke.hl || ps.live) return;
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

  /** Μεγέθυνση ή σμίκρυνση γύρω από το κέντρο της οθόνης. */
  zoomBy(f: number): void {
    const v = this.page.view;
    const k = Math.min(8, Math.max(0.1, v.k * f));
    const cx = this.W / 2, cy = (this.H - this.bottomInset) / 2;
    v.x = cx - ((cx - v.x) / v.k) * k;
    v.y = cy - ((cy - v.y) / v.k) * k;
    v.k = k;
    this.redraw();
    this.onChange();
  }

  /** Αν στην επιλογή υπάρχει χειρόγραφη γραμμή. */
  /** Αν στην επιλογή υπάρχει κάτι γραμμένο (χειρόγραφο, κείμενο ή τυπωμένος τύπος) που έχει νόημα να λυθεί. */
  get selectionHasWriting(): boolean {
    const ids = this.selectedIds();
    return this.page.items.some((it) => (it.kind === 'stroke' || it.kind === 'text' || it.kind === 'image') && ids.has(it.id));
  }

  get selectionHasInk(): boolean {
    const ids = this.selectedIds();
    return this.page.items.some((it) => it.kind === 'stroke' && ids.has(it.id));
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
      if (!g.zoom) {
        // δύο δάχτυλα που σέρνονται μαζί δεν κρατούν ποτέ ακριβώς την ίδια απόσταση: μικρές αλλαγές δεν είναι zoom.
        // Αν η σελίδα έχει ήδη μετακινηθεί αρκετά, είναι φανερά μετακίνηση και το zoom θέλει ακόμα πιο καθαρό άνοιγμα.
        const moved = Math.hypot(cx - g.c0[0], cy - g.c0[1]);
        const need = moved > 60 ? Math.max(90, g.d0 * 0.3) : Math.max(36, g.d0 * 0.14);
        if (Math.abs(d - g.d0) > need) {
          g.zoom = true;
          // το zoom ξεκινά από εδώ, χωρίς πήδημα
          g.d0 = d;
          g.c0 = [cx, cy];
          g.v0 = { ...this.page.view };
        }
      }
      const k = g.zoom ? Math.min(8, Math.max(0.1, g.v0.k * (d / g.d0))) : g.v0.k;
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
        if (ps.stroke!.hl) {
          // το υπογραμμιστικό τραβάει μόνο ευθεία· κοντά στο οριζόντιο ή το κατακόρυφο ισιώνει τελείως
          const [ax, ay] = pts[0];
          let bx = wx, by = wy;
          if (Math.abs(by - ay) < Math.abs(bx - ax) * 0.14) by = ay;
          else if (Math.abs(bx - ax) < Math.abs(by - ay) * 0.14) bx = ax;
          // ενδιάμεσα σημεία, για να μπορεί η γόμα να σβήσει ένα κομμάτι της
          const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 8));
          pts.length = 1;
          for (let i = 1; i <= n; i++) pts.push([ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n]);
          break;
        }
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
      case 'laser':
        ps.laser!.pts.push([wx, wy]);
        break;
      case 'measure':
        ps.live = this.angleAround(wx, wy) ?? undefined;
        break;
      case 'lasso':
        ps.lasso!.push([wx, wy]);
        break;
      case 'rotate':
        if (ps.tap && this.rotStill(ps, wx, wy)) break;
        ps.tap = false;
        ps.preview = rotateItem(ps.orig!, ps.start![0], ps.start![1], this.rotAngle(ps, wx, wy));
        break;
      case 'grotate': {
        if (ps.tap && this.rotStill(ps, wx, wy)) break;
        ps.tap = false;
        const ang = this.rotAngle(ps, wx, wy);
        const ids = ps.ids!;
        this.page.items = ps.before!.map((it) => (ids.has(it.id) ? rotateItem(it, ps.start![0], ps.start![1], ang) : it));
        ps.changed = true;
        this.redraw();
        break;
      }
      case 'gmove':
      case 'gresize': {
        const dx = wx - ps.start![0];
        const dy = wy - ps.start![1];
        const b = ps.gb!;
        const f = Math.max(0.1, (b.x1 - b.x0 + dx) / Math.max(b.x1 - b.x0, 1));
        const ids = ps.ids!;
        const move = ps.mode === 'gmove';
        this.page.items = ps.before!.map((it) => (!ids.has(it.id) ? it : move ? translateItem(it, dx, dy) : scaleItem(it, b.x0, b.y0, f)));
        ps.changed = true;
        this.redraw();
        break;
      }
      case 'pan': {
        const v = this.page.view;
        v.x = ps.v0!.x + (e.clientX - ps.start![0]);
        v.y = ps.v0!.y + (e.clientY - ps.start![1]);
        this.redraw();
        break;
      }
      case 'osc': {
        const o = this.oscDrag;
        const it = o && this.page.items.find((x) => x.id === o.id);
        const g = it && it.kind === 'stamp' ? STAMPS[it.name]?.spring?.(it.w, it.h) : undefined;
        if (o && g && it) {
          // σε στραμμένο ελατήριο η μετατόπιση μετριέται πάνω στον δικό του άξονα
          const [ax, ay] = unrot(it, ps.start![0], ps.start![1]), [bx, by] = unrot(it, wx, wy);
          o.d = Math.max(-g.max, Math.min(g.max, (bx - ax) * g.ux + (by - ay) * g.uy));
        }
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
        if (o.kind === 'image' || o.kind === 'stamp') {
          const nw = Math.max(40, o.w + dx);
          ps.preview = { ...o, w: nw, h: (nw * o.h) / o.w };
        } else if (o.kind === 'trig') {
          if (ps.handle === 1) {
            // ακέραιες μοίρες· κοντά σε πολλαπλάσια των 15° «κουμπώνει»
            let deg = Math.round((Math.atan2(o.y - wy, wx - o.x) * 180) / Math.PI);
            const near = Math.round(deg / 15) * 15;
            if (Math.abs(near - deg) <= 2) deg = near;
            ps.preview = { ...o, a: (((deg % 360) + 360) % 360) * (Math.PI / 180) };
          } else {
            ps.preview = { ...o, r: Math.max(60, o.r + dx / 1.28) };
          }
        } else if (o.kind === 'shape') {
          const fx = o.x1 >= o.x0;
          const fy = o.y1 >= o.y0;
          ps.preview = reboxShape(
            o,
            fx ? o.x0 : o.x0 + dx, fy ? o.y0 : o.y0 + dy,
            fx ? o.x1 + dx : o.x1, fy ? o.y1 + dy : o.y1,
          );
        } else if (o.kind === 'axes' && ps.handle) {
          const key = this.r.axesHandles(o)[ps.handle - 1]?.k;
          if (key) ps.preview = this.r.moveAxesHandle(o, key, (wx - o.x) / o.unit);
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
        if (ps.mode === 'draw' && s.kind === 'stroke' && !s.hl) this.onStroke(s);
        const c = this.bctx;
        c.save();
        this.setWorldTransform(c);
        this.r.drawItem(c, s);
        if (s.kind === 'shape' && s.meas) this.r.drawMeasures(c, s);
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
      case 'laser':
        ps.laser!.t = performance.now();
        this.fadeLasers();
        break;
      case 'measure': {
        const m = ps.live;
        // η ίδια γωνία δεν μετριέται δεύτερη φορά
        const dup = m && m.kind === 'angle' && this.page.items.some((x) => x.kind === 'angle' && x.arc
          && Math.hypot(x.x - m.x, x.y - m.y) < 2 && Math.abs(x.a1 - m.a1) < 0.01 && Math.abs(x.a2 - m.a2) < 0.01);
        if (m && !dup) {
          this.page.items.push(m);
          this.push({ t: 'add', p: this.cur, item: m });
          this.redraw();
          return;
        }
        break;
      }
      case 'lasso': {
        const poly = ps.lasso!;
        const xs = poly.map((q) => q[0]), ys = poly.map((q) => q[1]);
        const ext = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
        if (ext < 12 / this.page.view.k) {
          this.selected = ps.tapHit ?? null;
        } else {
          const ids = this.page.items.filter((it) => inLasso(it, poly)).map((it) => it.id);
          this.selected = ids.length === 1 ? ids[0] : null;
          this.multi = ids.length > 1 ? ids : [];
          this.region = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
        }
        this.onUi();
        break;
      }
      case 'gmove':
      case 'gresize':
      case 'grotate':
        if (ps.mode === 'grotate' && ps.tap) {
          const gb = this.groupBounds();
          if (gb) this.nextPivot(gb);
        } else if (this.pivot && ps.changed && ps.mode !== 'grotate') {
          // η ομάδα μετακινήθηκε: το κέντρο περιστροφής πάει μαζί της· αν άλλαξε μέγεθος, ξαναγίνεται το κέντρο της
          const gb = this.groupBounds();
          if (ps.mode === 'gmove' && gb && ps.gb) this.pivot = { ...this.pivot, p: [this.pivot.p[0] + gb.x0 - ps.gb.x0, this.pivot.p[1] + gb.y0 - ps.gb.y0] };
          else this.pivot = null;
        }
        if (ps.changed && ps.before) {
          this.push({ t: 'set', p: this.cur, before: ps.before, after: this.page.items.slice() });
        }
        this.redraw();
        return;
      case 'osc': {
        const o = this.oscDrag;
        this.oscDrag = null;
        // ένα απλό άγγιγμα (χωρίς τράβηγμα) απλώς σταματά το σώμα
        if (o && Math.abs(o.d) > 3) {
          this.osc.set(o.id, { amp: o.d, t0: performance.now() });
          this.runOsc();
        }
        this.redraw();
        this.onUi();
        return;
      }
      case 'move':
      case 'rotate':
      case 'resize': {
        const before = ps.orig!;
        const after = ps.preview!;
        if (ps.mode === 'rotate' && ps.tap) this.nextPivot(itemBounds(before), before);
        const i = this.page.items.findIndex((x) => x.id === before.id);
        if (i >= 0 && ps.mode === 'move' && after.kind === 'axes' && after !== before && this.mergeAxes(before as AxesItem, after)) {
          ps.orig = undefined;
          ps.preview = undefined;
          this.redraw();
          this.onUi();
          return;
        }
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

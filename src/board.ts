import {
  AngleItem, AxesItem, AxesMode, Background, Doc, FnDef, Item, MeasOpts, Op, Page, Pic, Pt, Shape, ShapeKind, StampItem, Stroke, TableStyle, TextItem, Tool, View, angleEnds, cloneItem, distToSeg, erasePartial, hitItem, inLasso, isDark, isPoly, itemBounds, itemRot, newDoc, newPage, pointInPolygon, reboxShape, recognizeShape, rotateItem, roundAngle, scaleItem, translateItem, trianglePts, uid, unrot,
} from './model';
import { Params } from './expr';
import { STAMPS, SpringState, type KidArea, type KidAsk } from './stamps';
import { CM, GadgetDrag, GadgetKind, Gadgets } from './gadgets';
import { ANGLE_KEY, angleSides, eraseMeasures, fmt, measureAngles, measureSides, trigPoint, sideLen, sideText, unitsFor } from './measure';
import { Renderer } from './render';
import * as P from './board-pointer';
import * as R from './board-replay';
import * as X from './board-export';
import * as M from './board-measure';

// οι δοκιμές και όποιος τα χρειάζεται τα βρίσκουν ακόμα εδώ
export { eraseMeasures, hlFlat, measureAngles, measureSides, radText } from './measure';

type Mode = 'draw' | 'shape' | 'gadget' | 'erase' | 'move' | 'resize' | 'pan' | 'lasso' | 'gmove' | 'gresize' | 'rotate' | 'grotate' | 'measure' | 'laser' | 'osc' | 'kid' | 'none';

type Box = { x0: number; y0: number; x1: number; y1: number };
/** Ίχνος του δείκτη λέιζερ· t = στιγμή που σηκώθηκε η γραφίδα (0 όσο γράφει). */
interface Laser { pts: Pt[]; t: number }
const LASER_MS = 1800;

/** Περίοδος της ταλάντωσης των ελατηρίων και χρόνος απόσβεσης. */
const OSC_PERIOD_MS = 1600;
const OSC_FADE_MS = 5000;

export interface PState {
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
  /** Πρόχειρη μνήμη ενός συρσίματος πάνω σε εργαλείο του Δημοτικού. */
  kid?: Record<string, number>;
  /** Το εργαλείο όπως ήταν πριν αρχίσει το σύρσιμο πάνω του (για την αναίρεση). */
  kidOrig?: StampItem;
}

export interface Twist {
  ids: Set<string>;
  /** Τα στοιχεία της σελίδας πριν από την περιστροφή. */
  before: Item[];
  /** Κέντρο περιστροφής (κέντρο της επιλογής). */
  pivot: Pt;
  /** Πού ήταν κάθε δάχτυλο όταν μετρήθηκε τελευταία φορά η βάση. */
  p0: Map<number, Pt>;
  /** Γωνία που έχει μαζευτεί πριν από την τωρινή βάση (όταν προστέθηκε ή σηκώθηκε δάχτυλο). */
  acc: number;
  changed: boolean;
}

interface Gesture {
  a: number;
  b: number;
  c0: Pt;
  d0: number;
  v0: View;
  /** Το zoom «ξεκλειδώνει» μόνο όταν τα δάχτυλα ανοίξουν ή κλείσουν αισθητά· ως τότε η κίνηση είναι καθαρή μετακίνηση. */
  zoom: boolean;
  /** Όλο το χέρι πάνω στον πίνακα (4+ δάχτυλα) με κάτι επιλεγμένο: το στρίψιμο του χεριού περιστρέφει την επιλογή. */
  twist?: Twist;
}

export type SizedTool = 'pen' | 'highlighter' | 'eraser';
export type EraserMode = 'stroke' | 'partial';

/** Τα ανοιχτά χρώματα του σκούρου πίνακα και τα αντίστοιχά τους για λευκό χαρτί. */
const PAPER_INK: Record<string, string> = {
  '#ffffff': '#111111', '#fb7185': '#e11d48', '#7dd3fc': '#2563eb', '#86efac': '#16a34a',
  '#34d399': '#059669', '#f87171': '#dc2626', '#5eead4': '#0f766e', '#d1d5db': '#6b7280', '#fde047': '#ca8a04', '#a3e635': '#65a30d',
};

export class Board {
  /** Η σχεδίαση των στοιχείων στον καμβά ζει στο render.ts. */
  r = new Renderer(this);
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
  pivot: { key: string; i: number; p: Pt } | null = null;
  /** Διαφανές φόντο (γράψιμο πάνω από άλλα προγράμματα). */
  transparent = false;
  /** Αν οι νέοι άξονες μπαίνουν με αριθμούς (θυμάται την τελευταία επιλογή). */
  axesNums = true;
  /** Όσο ζωγραφίζεται σελίδα για το χαρτί: σκούρος πίνακας βγαίνει λευκός και τα ανοιχτά χρώματά του σκουραίνουν. */
  paper = false;
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
  /** Ερώτηση προς τον χρήστη από εργαλείο του Δημοτικού (π.χ. λέξη της κρεμάλας). */
  /** Εργαλεία του Δημοτικού που μόλις άλλαξαν: για λίγο ζωγραφίζονται «εν κινήσει» (βλ. KidEnv.anim). */
  kidAnim = new Map<string, { t0: number; prev: number[]; ms: number }>();
  /** Κίνηση στα εργαλεία του Δημοτικού (ανάβει μόνο στο Δημοτικό). */
  kidMotion = false;
  /** Κάτι έγινε σε εργαλείο του Δημοτικού ('click', 'win', 'tok'…): για ήχο και πανηγυρισμό. */
  onKidFx: (ev: string, it: StampItem) => void = () => {};
  /** Πατήθηκε το «όλη η οθόνη» ενός εργαλείου του Δημοτικού (κυβάκια). */
  onKidFull: (it: StampItem) => void = () => {};
  /** Τα ονόματα των μαθητών του τμήματος του ανοιχτού μαθήματος (για την κλήρωση)· κενό αν δεν υπάρχουν. */
  kidNames: () => string[] = () => [];
  onAsk: (q: KidAsk) => Promise<string | null> = () => Promise.resolve(null);
  /** Διάβασμα χειρόγραφου για εργαλείο του Δημοτικού (ορθογραφία με το χέρι): οι γραμμές γραφής με αυτά τα id ως κείμενο· κενό αν δεν διαβάστηκαν, null αν δεν υπάρχει τίποτα να διαβαστεί. */
  onRead: (ids: string[]) => Promise<string | null> = () => Promise.resolve(null);
  onMergeAxes: (target: AxesItem, dropped: AxesItem) => AxesItem | null = () => null;
  onPointerInfo: (e: PointerEvent, count: number) => void = () => {};
  /** Καλείται όταν ολοκληρωθεί μια γραμμή του στυλό (για την αυτόματη αναγνώριση). */
  onStroke: (s: Stroke) => void = () => {};

  private undoStack: Op[] = [];
  private redoStack: Op[] = [];
  imgs = new Map<string, HTMLImageElement>();
  ptrs = new Map<number, PState>();
  gesture: Gesture | null = null;
  /** Η επιλογή τη στιγμή που ακούμπησε το πρώτο δάχτυλο: το ίδιο το άγγιγμα μπορεί να την αλλάξει πριν φτάσουν τα υπόλοιπα. */
  touchSel: { selected: string | null; multi: string[] } | null = null;
  eraserAt: { x: number; y: number } | null = null;
  lasers: Laser[] = [];
  private laserRaf = 0;
  replay: { i: number; prog: number; wait: number; paused: boolean } | null = null;
  replayRaf = 0;
  private dpr = 1;
  W = 0;
  H = 0;
  bctx: CanvasRenderingContext2D;
  lctx: CanvasRenderingContext2D;

  constructor(private base: HTMLCanvasElement, readonly live: HTMLCanvasElement) {
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

  /** Σβήνει την τρέχουσα σελίδα. Επιστρέφει ό,τι χρειάζεται η `restorePage` για να τη φέρει πίσω. */
  deletePage(): { page: Page; at: number; only: boolean } {
    const gone = { page: this.page, at: this.cur, only: this.doc.pages.length === 1 };
    if (gone.only) {
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
    return gone;
  }

  /** Φέρνει πίσω σελίδα που μόλις σβήστηκε, στη θέση που ήταν. */
  restorePage(gone: { page: Page; at: number; only: boolean }): void {
    const at = Math.min(gone.at, this.doc.pages.length);
    // η μοναδική σελίδα είχε αντικατασταθεί από κενή: αν έμεινε κενή, ξαναπαίρνει τη θέση της
    if (gone.only && this.doc.pages.length === 1 && this.doc.pages[0].items.length === 0) this.doc.pages[0] = gone.page;
    else this.doc.pages.splice(at, 0, gone.page);
    this.undoStack = [];
    this.redoStack = [];
    this.goto(Math.min(at, this.doc.pages.length - 1));
    this.onChange();
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

  push(op: Op): void {
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

  /** Η κατάσταση ενός εργαλείου άλλαξε (ή μια επιβράβευση μόλις μπήκε): ήχος, και κίνηση για όσο κρατά. */
  kidChanged(it: StampItem, prev: number[], ev?: string): void {
    const d = STAMPS[it.name];
    const what = ev ?? (d?.fx ? d.fx(prev, it.v ?? []) : 'click');
    if (what) this.onKidFx(what, it);
    if (!this.kidMotion) return;
    const idle = this.kidAnim.size === 0;
    this.kidAnim.set(it.id, { t0: performance.now(), prev, ms: d?.animMs ?? 1500 });
    if (!idle) return;
    const tick = (): void => {
      const now = performance.now();
      for (const [id, a] of this.kidAnim) if (now - a.t0 > a.ms) this.kidAnim.delete(id);
      this.redraw();
      if (this.kidAnim.size) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /** Η κατάσταση ενός εργαλείου του Δημοτικού, ή null αν δεν υπάρχει στη σελίδα. */
  kidState(id: string): number[] | null {
    const it = this.page.items.find((x) => x.id === id);
    return it && it.kind === 'stamp' ? it.v ?? STAMPS[it.name]?.init ?? [] : null;
  }

  /** Αλλάζει την κατάσταση ενός εργαλείου του Δημοτικού (με αναίρεση). */
  setKidState(id: string, v: number[]): void {
    const i = this.page.items.findIndex((x) => x.id === id);
    const before = this.page.items[i];
    if (!before || before.kind !== 'stamp') return;
    const after: StampItem = { ...before, v };
    this.page.items[i] = after;
    this.push({ t: 'mod', p: this.cur, before, after });
    this.redraw();
  }

  /** Σύρσιμο πάνω σε εργαλείο του Δημοτικού που «ζωγραφίζεται» (κυβάκια, δείκτες ρολογιού). false αν το σημείο δεν το αφορά. */
  kidPaint(ps: PState, it: StampItem, wx: number, wy: number, first: boolean): boolean {
    const d = STAMPS[it.name];
    if (!d?.paint) return false;
    if (first) ps.kid = {};
    const [lx, ly] = unrot(it, wx, wy);
    if (first && d.fullAt?.(lx - it.x, ly - it.y, it.w, it.h)) {
      this.onKidFull(it);
      return true;
    }
    const v = d.paint(it.v ?? d.init ?? [], lx - it.x, ly - it.y, it.w, it.h, ps.kid!, first);
    if (!v) return false;
    this.page.items[this.page.items.indexOf(it)] = { ...it, v };
    const ev = d.fx ? d.fx(it.v ?? d.init ?? [], v) : null;
    if (ev) this.onKidFx(ev, it);
    return true;
  }

  /** Οι γραμμές γραφής της σελίδας που το κέντρο τους πέφτει μέσα στο ορθογώνιο. */
  private strokesIn(b: Box): string[] {
    return this.page.items
      .filter((x) => {
        if (x.kind !== 'stroke' || x.hl) return false;
        const ib = itemBounds(x), cx = (ib.x0 + ib.x1) / 2, cy = (ib.y0 + ib.y1) / 2;
        return cx >= b.x0 && cx <= b.x1 && cy >= b.y0 && cy <= b.y1;
      })
      .map((x) => x.id);
  }

  /** Σβήνει στοιχεία της σελίδας με ένα βήμα αναίρεσης, χωρίς να πειράξει την επιλογή. */
  private deleteItems(ids: string[]): void {
    if (!ids.length) return;
    const set = new Set(ids), before = this.page.items.slice();
    this.page.items = before.filter((x) => !set.has(x.id));
    this.push({ t: 'set', p: this.cur, before, after: this.page.items.slice() });
    this.redraw();
  }

  /**
   * Πάτημα στο σημείο `at` ενός εργαλείου του Δημοτικού. true αν έπεσε σε κουμπί του (και έγινε ό,τι κάνει το κουμπί).
   */
  pressKid(it: StampItem, at: Pt): boolean {
    const d = STAMPS[it.name];
    if (!d?.kid) return false;
    const [lx, ly] = unrot(it, at[0], at[1]);
    const cur = it.v ?? d.init ?? [];
    const apply = (v: number[]): void => {
      const before = this.page.items.find((x) => x.id === it.id);
      if (!before || before.kind !== 'stamp') return;
      const next: StampItem = { ...before, v };
      this.page.items[this.page.items.indexOf(before)] = next;
      this.push({ t: 'mod', p: this.cur, before, after: next });
      this.kidChanged(next, before.v ?? d.init ?? []);
      this.redraw();
    };
    const q = d.ask?.(cur, lx - it.x, ly - it.y, it.w, it.h);
    if (q) {
      const page = this.cur;
      const inArea = (a: KidArea): string[] => this.strokesIn({ x0: it.x + a.x, y0: it.y + a.y, x1: it.x + a.x + a.w, y1: it.y + a.y + a.h });
      if (q.area && q.mode === 'clear') {
        this.deleteItems(inArea(q.area));
        const v = q.apply('');
        if (v) apply(v);
      } else {
        void (q.area ? this.onRead(inArea(q.area)) : this.onAsk(q)).then((text) => {
          const v = text == null || page !== this.cur ? null : q.apply(text);
          if (!v) return;
          if (q.then) this.deleteItems(inArea(q.then.area));
          apply(v);
        });
      }
    } else {
      const v = d.tap?.(cur, lx - it.x, ly - it.y, it.w, it.h, { names: this.kidNames() });
      if (!v) return false;
      apply(v);
    }
    // πάτημα σε κουμπί του εργαλείου (γράμμα, +, κομμάτι κλάσματος) δεν το επιλέγει: αλλιώς η μπάρα «Διαγραφή / ×2» πέφτει πάνω στο παιχνίδι
    this.selected = null;
    this.onUi();
    return true;
  }

  /** true αν ήταν πάτημα πάνω σε εργαλείο του Δημοτικού (και όχι μετακίνησή του)· τότε εφαρμόζει ό,τι κάνει το πάτημα. */
  tapKid(before: StampItem, after: Item, at: Pt): boolean {
    const d = STAMPS[before.name];
    if (!d?.kid || (!d.tap && !d.ask) || after.kind !== 'stamp') return false;
    if (Math.hypot(after.x - before.x, after.y - before.y) > 8 / this.page.view.k) return false;
    // ακόμα κι αν το πάτημα δεν έπεσε σε κουμπί, το εργαλείο δεν μετακινείται από ένα απλό άγγιγμα
    this.pressKid(before, at);
    return true;
  }

  /**
   * Άξονες με συναρτήσεις που αφήνονται πάνω σε άλλους άξονες ενώνονται μαζί τους: οι συναρτήσεις περνούν στους πρώτους
   * και οι δεύτεροι φεύγουν. Μία αναίρεση τα χωρίζει ξανά.
   */
  mergeAxes(before: AxesItem, after: AxesItem): boolean {
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

  /** Προσθέτει πολλά στοιχεία μαζί (π.χ. ένα σχήμα από κομμάτια) και τα αφήνει όλα επιλεγμένα· αναιρούνται με ένα ↶. */
  addItems(items: Item[]): void {
    if (items.length === 0) return;
    if (items.length === 1) return this.addAndSelect(items[0]);
    const before = this.page.items.slice();
    this.page.items.push(...items);
    this.push({ t: 'set', p: this.cur, before, after: this.page.items.slice() });
    this.tool = 'select';
    this.selected = null;
    this.multi = items.map((it) => it.id);
    this.redraw();
    this.onUi();
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

  /** Εισαγωγή έτοιμου σχήματος φυσικής στο κέντρο της οθόνης· `v`: αρχική κατάσταση εργαλείου του Δημοτικού, αντί για την αρχική του. */
  addStamp(name: string, v?: number[]): void {
    const d = STAMPS[name];
    if (!d) return;
    const [cx, cy] = this.center();
    // τα μεγάλα εργαλεία του Δημοτικού μικραίνουν ώστε να χωράνε στην οθόνη· τα παιχνίδια όλης της τάξης μεγαλώνουν κιόλας ώστε να τη γεμίσουν
    const fit = Math.min((this.W * (d.big ? 0.96 : 0.9)) / this.page.view.k / d.w, (Math.max(this.H - this.bottomInset, 100) * (d.big ? 0.95 : 0.85)) / this.page.view.k / d.h);
    const f = d.big ? fit : d.kid ? Math.min(1, fit) : 1;
    const it: StampItem = { kind: 'stamp', id: uid(), name, x: cx - (d.w * f) / 2, y: cy - (d.h * f) / 2, w: d.w * f, h: d.h * f, color: this.color, width: 3, ...(v ? { v } : d.init ? { v: [...d.init] } : {}) };
    this.addAndSelect(it);
    if (v) this.kidChanged(it, d.init ?? []);
    else if (d.cheer) this.kidChanged(it, [], 'cheer');
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

  measureAt(sx: number, sy: number): { id: string; side: number; text: string; x: number; y: number } | null { return M.measureAt(this, sx, sy); }

  segments(): [Pt, Pt][] { return M.segments(this); }

  angleAround(wx: number, wy: number): AngleItem | null { return M.angleAround(this, wx, wy); }

  shapeAt(sx: number, sy: number): { id: string; shape: ShapeKind | 'angle'; meas: MeasOpts; x: number; y: number } | null { return M.shapeAt(this, sx, sy); }

  setMeas(id: string, meas: MeasOpts): void { M.setMeas(this, id, meas); }

  setMeasure(id: string, sideIndex: number, value: string): void { M.setMeasure(this, id, sideIndex, value); }

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

  selectedIds(): Set<string> {
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

  groupBounds(): Box | null {
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

  toWorld(sx: number, sy: number): Pt {
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


  setWorldTransform(c: CanvasRenderingContext2D): void {
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
  osc = new Map<string, { amp: number; t0: number }>();
  /** Σώμα που τραβιέται αυτή τη στιγμή. */
  oscDrag: { id: string; d: number } | null = null;
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
  springAt(wx: number, wy: number): StampItem | null {
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

  runOsc(): void {
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

  cornerResizable(it: Item): boolean {
    return it.kind === 'image' || it.kind === 'shape' || it.kind === 'axes' || it.kind === 'stamp' || it.kind === 'trig';
  }

  rotatable(it: Item): boolean {
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
  pivotPoint(b: Box, it?: Item): Pt {
    const ctr: Pt = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
    const pv = this.pivot;
    if (!pv || pv.key !== this.pivotKey()) return ctr;
    return it ? this.pivots(it)[pv.i] ?? ctr : pv.p;
  }

  /** Πάτημα στη λαβή περιστροφής: κέντρο → κάθε άκρη με τη σειρά → πάλι κέντρο. */
  nextPivot(b: Box, it?: Item): void {
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
  rotHandle(b: Box): Pt {
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
  rotStill(ps: PState, wx: number, wy: number): boolean {
    const [cx, cy] = ps.start!;
    const d = Math.atan2(wy - cy, wx - cx) - ps.a0!;
    return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) * Math.hypot(wx - cx, wy - cy) * this.page.view.k < 8;
  }

  /** Γωνία περιστροφής από τη θέση της γραφίδας· κοντά σε πολλαπλάσια των 15° «κουμπώνει». */
  rotAngle(ps: PState, wx: number, wy: number): number {
    const [cx, cy] = ps.start!;
    let deg = ((Math.atan2(wy - cy, wx - cx) - ps.a0!) * 180) / Math.PI;
    const near = Math.round(deg / 15) * 15;
    if (Math.abs(near - deg) <= 3) deg = near;
    return (deg * Math.PI) / 180;
  }

  /** Λαβές-σημεία ενός στοιχείου (άκρα γωνίας, σημείο τριγωνομετρικού κύκλου). */
  pointHandles(it: Item): Pt[] {
    if (it.kind === 'angle') return angleEnds(it);
    if (it.kind === 'trig') return [trigPoint(it)];
    if (it.kind === 'axes') return this.r.axesHandles(it).map((h) => h.p);
    return [];
  }

  fadeLasers(): void {
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

  startReplay(): void { R.startReplay(this); }

  replayNext(): void { R.replayNext(this); }

  replayAdvance(): void { R.replayAdvance(this); }

  toggleReplayPause(): void { R.toggleReplayPause(this); }

  replayStep(): void { R.replayStep(this); }

  stopReplay(): void { R.stopReplay(this); }

  private eraserRadius(): number {
    return this.sizes.eraser / this.page.view.k;
  }

  // ---------- εξαγωγή ----------

  async pageCanvas(pi: number, opaque: boolean): Promise<HTMLCanvasElement> { return X.pageCanvas(this, pi, opaque); }

  async loadImages(pi?: number): Promise<void> { return X.loadImages(this, pi); }

  drawPage(pi: number, opaque: boolean, paper: boolean): HTMLCanvasElement { return X.drawPage(this, pi, opaque, paper); }

  printPages(mark?: HTMLImageElement | null): string[] { return X.printPages(this, mark); }

  async thumb(maxW = 360): Promise<string> { return X.thumb(this, maxW); }

  async pageThumb(pi: number, maxW: number): Promise<HTMLCanvasElement> { return X.pageThumb(this, pi, maxW); }

  async exportPng(): Promise<Blob> { return X.exportPng(this); }

  async exportJpegPages(onProgress: (done: number, total: number) => void, mark?: HTMLImageElement, only?: number[]): Promise<{ jpeg: Uint8Array; w: number; h: number }[]> { return X.exportJpegPages(this, onProgress); }

  // ---------- είσοδος ----------

  hitTest(x: number, y: number): Item | null {
    const r = 8 / this.page.view.k;
    const items = this.page.items;
    for (let i = items.length - 1; i >= 0; i--) {
      if (hitItem(items[i], x, y, r)) return items[i];
    }
    return null;
  }

  eraseAt(ps: PState, x: number, y: number): void {
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

  private down(e: PointerEvent): void { P.down(this, e); }

  startGesture(a: PState, b: PState): void { P.startGesture(this, a, b); }

  cancelPointer(ps: PState): void { P.cancelPointer(this, ps); }

  armSnap(ps: PState): void { P.armSnap(this, ps); }

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

  private move(e: PointerEvent): void { P.move(this, e); }

  moveOne(ps: PState, e: PointerEvent): void { P.moveOne(this, ps, e); }

  private up(e: PointerEvent): void { P.up(this, e); }
}

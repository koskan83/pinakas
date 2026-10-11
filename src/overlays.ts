/** Κουρτίνες και προβολέας: στρώματα πάνω από τον πίνακα. */

function dragX(el: HTMLElement, onMove: (x: number, y: number) => void): void {
  let on = false;
  el.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    on = true;
    el.setPointerCapture(e.pointerId);
    onMove(e.clientX, e.clientY);
  });
  el.addEventListener('pointermove', (e) => on && onMove(e.clientX, e.clientY));
  const end = (): void => { on = false; };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

/** Με τι γράφει τώρα ο χρήστης (το δίνει ο πίνακας, για να γράφεις και πάνω στην κουρτίνα με το ίδιο εργαλείο). */
export interface CurtainInk {
  tool: string;
  color: string;
  width: number;
  eraser: number;
}

/** Γραμμή πάνω στην κουρτίνα: x στην οθόνη, d = απόσταση από την άκρη με τη λαβή προς το εσωτερικό της κουρτίνας. */
interface CStroke {
  pts: [number, number][];
  color: string;
  width: number;
  hl?: boolean;
}

const HANDLE = 46;

/**
 * Κουρτίνα που κατεβαίνει από πάνω ή ανεβαίνει από κάτω και κρύβει μέρος του πίνακα.
 * Είναι και η ίδια πίνακας: γράφεις πάνω της με το στυλό, και ό,τι γράψεις κινείται μαζί της.
 * Η θέση και τα γραμμένα της μένουν στη συσκευή και μετά το κλείσιμο.
 */
export class Curtain {
  private el: HTMLElement;
  private cv: HTMLCanvasElement;
  private pos: number;
  private strokes: CStroke[] = [];
  private live = new Map<number, CStroke>();
  private erasing = new Set<number>();
  private key: string;
  onChange: () => void = () => {};
  /** Το τρέχον εργαλείο του πίνακα. */
  ink: () => CurtainInk = () => ({ tool: 'pen', color: '#111111', width: 4, eraser: 16 });

  constructor(parent: HTMLElement, private side: 'top' | 'bottom') {
    this.key = `grafida.curtain.${side}`;
    this.pos = side === 'top' ? 0.3 : 0.6;
    const el = document.createElement('div');
    el.className = `curtain ${side} hidden`;
    el.innerHTML = `<canvas></canvas><div class="chandle"><span>⇕ Σύρε · γράφεις και πάνω της</span>
      <button data-c="clear" title="Σβήσιμο όσων γράφτηκαν στην κουρτίνα">⌫</button><button data-c="close" title="Κλείσιμο">✕</button></div>`;
    parent.append(el);
    this.el = el;
    this.cv = el.querySelector('canvas')!;
    const handle = el.querySelector<HTMLElement>('.chandle')!;
    dragX(handle, (_x, y) => {
      // η λαβή μένει κάτω από το δάχτυλο
      this.pos = (y + (side === 'top' ? HANDLE / 2 : -HANDLE / 2)) / window.innerHeight;
      this.layout();
    });
    handle.addEventListener('pointerup', () => this.save());
    handle.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-c]');
      if (!b) return;
      if (b.dataset.c === 'close') this.toggle();
      else {
        this.strokes = [];
        this.draw();
        this.save();
      }
    });
    this.bindInk();
    window.addEventListener('resize', () => this.layout());
    try {
      const st = JSON.parse(localStorage.getItem(this.key) || 'null') as { pos?: number; on?: boolean; strokes?: CStroke[] } | null;
      if (st) {
        if (typeof st.pos === 'number') this.pos = st.pos;
        if (Array.isArray(st.strokes)) this.strokes = st.strokes;
        if (st.on) {
          el.classList.remove('hidden');
          this.layout();
        }
      }
    } catch {
      /* χωρίς αποθήκευση */
    }
  }

  get visible(): boolean {
    return !this.el.classList.contains('hidden');
  }

  /** Πόσο μέρος της οθόνης αφήνει ελεύθερο από τη μεριά της (0–1 από πάνω). */
  get edge(): number {
    return this.pos;
  }

  toggle(pos?: number): void {
    this.el.classList.toggle('hidden');
    if (this.visible && pos !== undefined) this.pos = pos;
    this.layout();
    this.save();
    this.onChange();
  }

  private save(): void {
    try {
      localStorage.setItem(this.key, JSON.stringify({ pos: this.pos, on: this.visible, strokes: this.strokes }));
    } catch {
      /* γεμάτη ή κλειστή αποθήκευση: η κουρτίνα δουλεύει κανονικά, απλώς δεν θυμάται */
    }
  }

  /** Ύψος της κουρτίνας σε px, μαζί με τη λαβή. */
  private height(): number {
    const H = window.innerHeight;
    return this.side === 'top' ? this.pos * H : (1 - this.pos) * H;
  }

  private layout(): void {
    const min = HANDLE / window.innerHeight;
    this.pos = this.side === 'top' ? Math.max(min, Math.min(1, this.pos)) : Math.max(0, Math.min(1 - min, this.pos));
    this.el.style.height = `${this.height()}px`;
    if (this.visible) this.draw();
  }

  /** Από συντεταγμένες οθόνης σε [x, απόσταση από τη λαβή]. */
  private local(e: PointerEvent): [number, number] {
    const edge = this.pos * window.innerHeight;
    return [e.clientX, this.side === 'top' ? edge - HANDLE - e.clientY : e.clientY - edge - HANDLE];
  }

  private draw(): void {
    const w = window.innerWidth, h = Math.max(0, this.height() - HANDLE);
    const dpr = window.devicePixelRatio || 1;
    const cv = this.cv;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    const c = cv.getContext('2d')!;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    // στην πάνω κουρτίνα η απόσταση μετριέται από κάτω προς τα πάνω
    const Y = (d: number): number => (this.side === 'top' ? h - d : d);
    for (const s of [...this.strokes, ...this.live.values()]) {
      c.globalAlpha = s.hl ? 0.4 : 1;
      c.strokeStyle = c.fillStyle = s.color;
      c.lineWidth = s.width;
      c.beginPath();
      if (s.pts.length === 1) {
        c.arc(s.pts[0][0], Y(s.pts[0][1]), s.width / 2, 0, Math.PI * 2);
        c.fill();
        continue;
      }
      s.pts.forEach(([x, d], i) => (i ? c.lineTo(x, Y(d)) : c.moveTo(x, Y(d))));
      c.stroke();
    }
    c.globalAlpha = 1;
  }

  private eraseAt(p: [number, number], r: number): void {
    const n = this.strokes.length;
    this.strokes = this.strokes.filter((s) => !s.pts.some(([x, d]) => Math.hypot(x - p[0], d - p[1]) <= r + s.width / 2));
    if (this.strokes.length !== n) this.draw();
  }

  private bindInk(): void {
    const cv = this.cv;
    cv.addEventListener('pointerdown', (e) => {
      const k = this.ink();
      // παλάμη ή γροθιά σβήνει, όπως στον πίνακα
      const palm = e.pointerType === 'touch' && Math.max(e.width, e.height) > 40;
      const p = this.local(e);
      cv.setPointerCapture(e.pointerId);
      if (palm || k.tool === 'eraser') {
        this.erasing.add(e.pointerId);
        this.eraseAt(p, palm ? 40 : k.eraser);
      } else if (k.tool === 'pen' || k.tool === 'highlighter') {
        const hl = k.tool === 'highlighter';
        this.live.set(e.pointerId, { pts: [p], color: onDark(k.color), width: hl ? k.width * 5 : k.width, hl: hl || undefined });
        this.draw();
      }
    });
    cv.addEventListener('pointermove', (e) => {
      const evs = e.getCoalescedEvents?.() ?? [];
      const list = evs.length ? evs : [e];
      if (this.erasing.has(e.pointerId)) {
        for (const ev of list) this.eraseAt(this.local(ev), this.ink().eraser);
        return;
      }
      const s = this.live.get(e.pointerId);
      if (!s) return;
      for (const ev of list) s.pts.push(this.local(ev));
      this.draw();
    });
    const end = (e: PointerEvent): void => {
      const s = this.live.get(e.pointerId);
      if (s) {
        this.live.delete(e.pointerId);
        this.strokes.push(s);
      }
      if (s || this.erasing.delete(e.pointerId)) this.save();
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
  }
}

/** Η κουρτίνα είναι σκούρα: το μαύρο (και κάθε πολύ σκούρο) μελάνι γράφει σαν κιμωλία. */
function onDark(color: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const n = parseInt(m[1], 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum < 0.3 ? '#f8fafc' : color;
}

/** Σκοτεινιάζει τον πίνακα εκτός από έναν κύκλο που μετακινείς. */
export class Spotlight {
  private el: HTMLElement;
  private x = 0;
  private y = 0;
  private r = 170;
  onChange: () => void = () => {};

  constructor(parent: HTMLElement) {
    parent.insertAdjacentHTML(
      'beforeend',
      `<div id="spot" class="hidden"><div class="sctl">
        <button data-s="-" title="Μικρότερος">−</button><button data-s="+" title="Μεγαλύτερος">＋</button><button data-s="x" title="Κλείσιμο">✕</button></div></div>`,
    );
    this.el = parent.querySelector<HTMLElement>('#spot')!;
    dragX(this.el, (x, y) => {
      this.x = x;
      this.y = y;
      this.layout();
    });
    this.el.addEventListener('wheel', (e) => {
      this.r *= Math.exp(-e.deltaY * 0.0015);
      this.layout();
    });
    this.el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-s]');
      if (!b) return;
      if (b.dataset.s === 'x') this.toggle();
      else {
        this.r *= b.dataset.s === '+' ? 1.25 : 0.8;
        this.layout();
      }
    });
    window.addEventListener('resize', () => this.layout());
  }

  get visible(): boolean {
    return !this.el.classList.contains('hidden');
  }

  toggle(): void {
    this.el.classList.toggle('hidden');
    this.x = window.innerWidth / 2;
    this.y = window.innerHeight / 2;
    this.layout();
    this.onChange();
  }

  private layout(): void {
    this.r = Math.max(60, Math.min(this.r, Math.max(window.innerWidth, window.innerHeight)));
    const { x, y, r } = this;
    this.el.style.background = `radial-gradient(circle at ${x}px ${y}px, transparent ${r}px, rgba(0,0,0,.84) ${r + 3}px)`;
    const ctl = this.el.querySelector<HTMLElement>('.sctl')!;
    const below = y + r + 70 < window.innerHeight;
    ctl.style.left = `${Math.max(8, Math.min(x - 80, window.innerWidth - 170))}px`;
    ctl.style.top = `${below ? y + r + 12 : Math.max(8, y - r - 62)}px`;
  }
}

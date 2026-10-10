/** Κουρτίνα και προβολέας: στρώματα πάνω από τον πίνακα, δεν αποθηκεύονται. */

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

/** Κρύβει το κάτω (ή το δεξί) μέρος του πίνακα· σέρνεις τη λαβή για να αποκαλύψεις. */
export class Curtain {
  private el: HTMLElement;
  private horizontal = false;
  private pos = 0.3;
  onChange: () => void = () => {};

  constructor(parent: HTMLElement) {
    parent.insertAdjacentHTML(
      'beforeend',
      `<div id="curtain" class="hidden"><div class="chandle"><span>⇕ Σύρε για αποκάλυψη</span>
        <button data-c="turn" title="Αλλαγή κατεύθυνσης">⟳</button><button data-c="close" title="Κλείσιμο">✕</button></div></div>`,
    );
    this.el = parent.querySelector<HTMLElement>('#curtain')!;
    const handle = this.el.querySelector<HTMLElement>('.chandle')!;
    dragX(handle, (x, y) => {
      this.pos = this.horizontal ? x / window.innerWidth : y / window.innerHeight;
      this.layout();
    });
    handle.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-c]');
      if (!b) return;
      if (b.dataset.c === 'close') this.toggle();
      else {
        this.horizontal = !this.horizontal;
        this.pos = 0.3;
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
    this.pos = 0.3;
    this.layout();
    this.onChange();
  }

  private layout(): void {
    this.pos = Math.max(0, Math.min(0.97, this.pos));
    this.el.classList.toggle('horiz', this.horizontal);
    this.el.style.top = this.horizontal ? '0' : `${this.pos * 100}%`;
    this.el.style.left = this.horizontal ? `${this.pos * 100}%` : '0';
    this.el.querySelector('span')!.textContent = this.horizontal ? '⇔ Σύρε' : '⇕ Σύρε για αποκάλυψη';
  }
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

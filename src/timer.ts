/** Αιωρούμενο χρονόμετρο: αντίστροφη μέτρηση όταν έχει οριστεί χρόνος, αλλιώς μετράει προς τα πάνω. */
export class Timer {
  private el: HTMLElement;
  private display: HTMLElement;
  private startBtn: HTMLButtonElement;
  private setMs = 5 * 60_000;
  private ms = this.setMs;
  private countdown = true;
  private running = false;
  private last = 0;
  private tick = 0;

  constructor(parent: HTMLElement) {
    parent.insertAdjacentHTML(
      'beforeend',
      `<div id="timer" class="hidden">
        <div class="thead"><span>⏱ Χρονόμετρο</span><button data-t="close">✕</button></div>
        <div class="tdisplay">05:00</div>
        <div class="row">
          <button data-add="-60">−1′</button>
          <button data-add="-10">−10″</button>
          <button data-add="10">+10″</button>
          <button data-add="60">+1′</button>
          <button data-add="300">+5′</button>
        </div>
        <div class="row">
          <button data-t="start" class="go">▶ Έναρξη</button>
          <button data-t="reset">↺ Μηδενισμός</button>
        </div>
      </div>`
    );
    this.el = parent.querySelector<HTMLElement>('#timer')!;
    this.display = this.el.querySelector<HTMLElement>('.tdisplay')!;
    this.startBtn = this.el.querySelector<HTMLButtonElement>('[data-t="start"]')!;

    this.el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('button');
      if (!b) return;
      if (b.dataset.add) this.adjust(Number(b.dataset.add) * 1000);
      else if (b.dataset.t === 'start') this.toggleRun();
      else if (b.dataset.t === 'reset') this.reset();
      else if (b.dataset.t === 'close') this.toggle();
    });
    this.bindDrag(this.el.querySelector<HTMLElement>('.thead')!);
    this.render();
  }

  get visible(): boolean {
    return !this.el.classList.contains('hidden');
  }

  toggle(): void {
    this.el.classList.toggle('hidden');
    if (!this.visible) this.stop();
  }

  private adjust(delta: number): void {
    this.el.classList.remove('done');
    if (this.running) {
      if (this.countdown) this.ms = Math.max(0, this.ms + delta);
    } else {
      this.setMs = Math.max(0, Math.min(this.setMs + delta, 99 * 60_000));
      this.ms = this.setMs;
    }
    this.render();
  }

  private toggleRun(): void {
    if (this.running) {
      this.stop();
      return;
    }
    this.el.classList.remove('done');
    if (this.ms === this.setMs) this.countdown = this.setMs > 0;
    if (this.countdown && this.ms <= 0) this.ms = this.setMs;
    this.running = true;
    this.last = Date.now();
    this.tick = window.setInterval(() => this.step(), 200);
    this.render();
  }

  private stop(): void {
    this.running = false;
    clearInterval(this.tick);
    this.render();
  }

  private reset(): void {
    this.stop();
    this.el.classList.remove('done');
    this.ms = this.setMs;
    this.render();
  }

  private step(): void {
    const now = Date.now();
    const dt = now - this.last;
    this.last = now;
    if (this.countdown) {
      this.ms -= dt;
      if (this.ms <= 0) {
        this.ms = 0;
        this.stop();
        this.el.classList.add('done');
        this.beep();
      }
    } else {
      this.ms += dt;
    }
    this.render();
  }

  private render(): void {
    const total = this.countdown ? Math.ceil(this.ms / 1000) : Math.floor(this.ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    this.display.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    this.startBtn.textContent = this.running ? '⏸ Παύση' : '▶ Έναρξη';
  }

  private beep(): void {
    try {
      const ac = new AudioContext();
      for (let i = 0; i < 3; i++) {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.frequency.value = 880;
        o.connect(g);
        g.connect(ac.destination);
        const t = ac.currentTime + i * 0.4;
        g.gain.setValueAtTime(0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        o.start(t);
        o.stop(t + 0.3);
      }
      setTimeout(() => void ac.close(), 2000);
    } catch {
      /* χωρίς ήχο */
    }
  }

  private bindDrag(handle: HTMLElement): void {
    let ox = 0;
    let oy = 0;
    let active = false;
    handle.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      active = true;
      const r = this.el.getBoundingClientRect();
      ox = e.clientX - r.left;
      oy = e.clientY - r.top;
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', (e) => {
      if (!active) return;
      const x = Math.max(0, Math.min(e.clientX - ox, window.innerWidth - 80));
      const y = Math.max(0, Math.min(e.clientY - oy, window.innerHeight - 60));
      this.el.style.left = x + 'px';
      this.el.style.top = y + 'px';
      this.el.style.right = 'auto';
    });
    const end = () => (active = false);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }
}

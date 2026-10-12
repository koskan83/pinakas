/** Θέση, μέγεθος και σύμπτυξη της γραμμής εργαλείων. */

import { $, board, setLayoutBar } from './app';

interface BarState {
  scale: number;
  folded: boolean;
  /** Θέση πάνω-αριστερά όταν ο χρήστης την έχει μετακινήσει· αλλιώς κάτω στο κέντρο. */
  pos: { x: number; y: number } | null;
  /** Κάθετη διάταξη, όταν έχει αφεθεί στην αριστερή ή δεξιά άκρη. */
  vertical: boolean;
}

export function initToolbar(): void {
  const wrap = $('toolbarWrap');
  const bar = $('toolbar');
  const tab = $('barTab');
  const hint = $('dockHint');
  const KEY = 'grafida.toolbar';
  const st: BarState = { scale: 1, folded: false, pos: null, vertical: false };
  try {
    Object.assign(st, JSON.parse(localStorage.getItem(KEY) ?? '{}'));
  } catch {
    /* χωρίς αποθηκευμένες ρυθμίσεις */
  }

  // τα κείμενα των κουμπιών γίνονται tooltips· στη γραμμή φαίνονται μόνο τα εικονίδια
  bar.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
    const label = [...b.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('').trim();
    if (label) {
      b.title = label;
      b.setAttribute('aria-label', label);
    }
  });

  const apply = (): void => {
    bar.style.setProperty('--ts', String(st.scale));
    bar.classList.toggle('folded', st.folded);
    $('barFold').querySelector('span')!.textContent = st.folded ? '▸' : '▾';
    wrap.classList.toggle('moved', !!st.pos);
    bar.classList.toggle('vertical', !!st.pos && st.vertical);
    if (st.pos) {
      // κρατάμε τη γραμμή (και τη λαβή πάνω της) μέσα στην οθόνη
      const r = bar.getBoundingClientRect();
      const th = tab.getBoundingClientRect().height;
      st.pos.x = Math.max(0, Math.min(st.pos.x, window.innerWidth - r.width));
      // πάνω αριστερά βρίσκεται το κουμπί του μενού: δεν το σκεπάζουμε
      const minY = (st.pos.x < 80 && r.height < window.innerHeight - 120 ? 78 : 0) + th;
      st.pos.y = Math.max(minY, Math.min(st.pos.y, window.innerHeight - r.height));
      wrap.style.left = st.pos.x + 'px';
      wrap.style.top = st.pos.y + 'px';
    } else {
      wrap.style.left = '';
      wrap.style.top = '';
    }
    // η δεύτερη σειρά ανοίγει προς την πλευρά που έχει χώρο
    const r = bar.getBoundingClientRect();
    bar.classList.toggle('sub-below', r.top < 70 * st.scale + 30);
    bar.classList.toggle('sub-right', r.left + r.width / 2 < window.innerWidth / 2);
    // ...και στέκεται πάνω από (ή δίπλα σε) το εργαλείο που αφορά
    const sub = $('subbar');
    const anchor = bar.querySelector<HTMLElement>('#tools button.on, #gadgetBtn.on');
    sub.style.left = sub.style.right = sub.style.top = '';
    bar.classList.remove('sub-lift');
    if (anchor && !sub.classList.contains('hidden') && !st.folded) {
      const k = r.width / bar.offsetWidth || 1;
      const a = anchor.getBoundingClientRect();
      const s = sub.getBoundingClientRect();
      if (bar.classList.contains('vertical')) {
        const first = sub.querySelector<HTMLElement>('.group:not(.hidden) button');
        const pad = first ? first.getBoundingClientRect().top - s.top : 0;
        const top = Math.max(8, Math.min(a.top - pad, window.innerHeight - s.height - 8));
        sub.style.setProperty('--caret', (a.top + a.height / 2 - top) / k + 'px');
        sub.style.top = (top - r.top) / k + 'px';
      } else {
        // το πρώτο εικονίδιο της σειράς κάθεται ακριβώς πάνω από το εργαλείο
        const first = sub.querySelector<HTMLElement>('.group:not(.hidden) button');
        const pad = first ? first.getBoundingClientRect().left - s.left : 0;
        const left = Math.max(8, Math.min(a.left - pad, window.innerWidth - s.width - 8));
        sub.style.setProperty('--caret', (a.left + a.width / 2 - left) / k + 'px');
        sub.style.left = (left - r.left) / k + 'px';
        sub.style.right = 'auto';
        // αν πέφτει πάνω στη λαβή της γραμμής, ανεβαίνει πάνω από αυτήν
        const t = tab.getBoundingClientRect();
        bar.classList.toggle('sub-lift', !bar.classList.contains('sub-below') && left + s.width > t.left - 4 && left < t.right + 4);
      }
    }
    board.bottomInset = st.pos ? 0 : r.height + 24 + 56 * st.scale;
  };
  const save = (): void => {
    try {
      localStorage.setItem(KEY, JSON.stringify(st));
    } catch {
      /* δεν πειράζει */
    }
  };

  $('barSmaller').onclick = () => { st.scale = Math.max(0.6, +(st.scale - 0.15).toFixed(2)); apply(); save(); };
  $('barBigger').onclick = () => { st.scale = Math.min(2, +(st.scale + 0.15).toFixed(2)); apply(); save(); };
  $('barFold').onclick = () => { st.folded = !st.folded; apply(); save(); };

  const grip = $('barDrag');
  const EDGE = 70;
  let off: { x: number; y: number } | null = null;
  let dragged = false;
  /** Σε ποια άκρη θα «κουμπώσει» κατακόρυφα αν αφεθεί τώρα. */
  let dock: 'left' | 'right' | null = null;
  grip.addEventListener('pointerdown', (e) => {
    const r = bar.getBoundingClientRect();
    off = { x: e.clientX - r.left, y: e.clientY - r.top };
    dragged = false;
    dock = null;
    grip.setPointerCapture(e.pointerId);
  });
  grip.addEventListener('pointermove', (e) => {
    if (!off) return;
    dragged = true;
    st.pos = { x: e.clientX - off.x, y: e.clientY - off.y };
    // κουμπώνει όταν το δάχτυλο φτάσει κοντά στην άκρη ή όταν η γραμμή σπρωχτεί πάνω της
    const w = bar.getBoundingClientRect().width;
    if (e.clientX < EDGE || st.pos.x < 6) dock = 'left';
    else if (e.clientX > window.innerWidth - EDGE || st.pos.x + w > window.innerWidth - 6) dock = 'right';
    else dock = null;
    hint.classList.toggle('hidden', !dock);
    hint.classList.toggle('right', dock === 'right');
    apply();
  });
  const end = (): void => {
    if (!off) return;
    off = null;
    hint.classList.add('hidden');
    if (!dragged) return;
    // κοντά στο κάτω-κεντρικό σημείο επιστρέφει στην αρχική της θέση
    const r = bar.getBoundingClientRect();
    const centered = Math.abs(r.left + r.width / 2 - window.innerWidth / 2) < 60;
    st.vertical = !!dock;
    if (!dock && centered && r.bottom > window.innerHeight - 40) st.pos = null;
    if (dock && st.pos) st.pos.x = dock === 'left' ? 0 : window.innerWidth;
    apply();
    // η κατακόρυφη γραμμή έχει άλλο ύψος: ξαναελέγχουμε ότι χωρά
    apply();
    save();
  };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
  grip.addEventListener('lostpointercapture', end);
  grip.addEventListener('dblclick', () => { st.pos = null; st.vertical = false; apply(); save(); });
  window.addEventListener('resize', apply);
  new MutationObserver(apply).observe($('subbar'), { attributes: true, attributeFilter: ['class'] });

  // όσο γράφεις, η γραμμή δεν πιάνει αγγίγματα· ξεθωριάζει μόνο ό,τι πλησιάζει η γραφίδα, ώστε να μην αναβοσβήνει σε κάθε γράμμα
  const inking = new Set<number>();
  const live = $('live');
  const NEAR = 48;
  const chrome: [fade: HTMLElement, hit: HTMLElement][] = [[$('toolbarWrap'), $('toolbar')], [$('lessonName'), $('lessonName')], [$('zoomCtl'), $('zoomCtl')]];
  let rects: DOMRect[] = [];
  const near = (e: PointerEvent): void => {
    if (!inking.has(e.pointerId)) return;
    rects.forEach((r, i) => {
      if (e.clientX > r.left - NEAR && e.clientX < r.right + NEAR && e.clientY > r.top - NEAR && e.clientY < r.bottom + NEAR) chrome[i][0].classList.add('under');
    });
  };
  live.addEventListener('pointerdown', (e) => {
    if (inking.size === 0) rects = chrome.map(([, hit]) => hit.getBoundingClientRect());
    inking.add(e.pointerId);
    document.body.classList.add('inking');
    near(e);
  });
  live.addEventListener('pointermove', near);
  const lift = (e: PointerEvent): void => {
    inking.delete(e.pointerId);
    if (inking.size > 0) return;
    document.body.classList.remove('inking');
    for (const [fade] of chrome) fade.classList.remove('under');
  };
  live.addEventListener('pointerup', lift);
  live.addEventListener('pointercancel', lift);

  setLayoutBar(apply);
  apply();
}

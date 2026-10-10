import './style.css';
import { Board } from './board';
import { AxesMode, Background, Doc, ShapeKind, TextItem, Tool, newDoc } from './model';
import { blobToPic, captureScreen, clipboardImage, pdfToPages } from './importers';
import { loadDoc, saveDoc } from './storage';
import { Timer } from './timer';
import { GadgetKind } from './gadgets';
import { isNative, nativeSave, nativeScreenshot } from './native';

const COLORS = ['#111111', '#e11d48', '#2563eb', '#16a34a', '#f59e0b', '#facc15', '#ffffff'];
const WIDTHS = [3, 6, 12];

const app = document.getElementById('app')!;
app.insertAdjacentHTML(
  'beforeend',
  `
  <button id="menuBtn" class="fab" title="Μενού">☰</button>
  <div id="menu" class="popup hidden">
    <button data-act="new">🆕 Νέος πίνακας</button>
    <button data-act="open">📂 Άνοιγμα αρχείου…</button>
    <button data-act="save">💾 Αποθήκευση αρχείου</button>
    <button data-act="png">🖼 Εξαγωγή σελίδας σε PNG</button>
    <hr />
    <button data-act="bg-white">⬜ Φόντο: λευκό</button>
    <button data-act="bg-grid">▦ Φόντο: πλέγμα</button>
    <button data-act="bg-dark">⬛ Φόντο: σκούρο</button>
    <hr />
    <button data-act="clear">🧹 Καθαρισμός σελίδας</button>
    <button data-act="delpage">🗑 Διαγραφή σελίδας</button>
    <hr />
    <button data-act="full">⛶ Πλήρης οθόνη</button>
    <button data-act="diag">🔬 Διάγνωση αφής/γραφίδας</button>
  </div>

  <div id="toolbarWrap">
  <div id="toolbar">
    <div class="group" id="barCtl">
      <button id="barDrag"><span>⠿</span>Μετακίνηση γραμμής εργαλείων</button>
      <button id="barSmaller" class="mini"><span>−</span>Μικρότερη</button>
      <button id="barBigger" class="mini"><span>＋</span>Μεγαλύτερη</button>
      <button id="barFold" class="mini"><span>▾</span>Σύμπτυξη</button>
    </div>
    <div class="group" id="tools">
      <button data-tool="select"><span>↖</span>Επιλογή</button>
      <button data-tool="pen"><span>✏️</span>Στυλό</button>
      <button data-tool="highlighter"><span>🖍</span>Μαρκαδόρος</button>
      <button data-tool="shape"><span>▭</span>Σχήματα</button>
      <button data-tool="text"><span>T</span>Κείμενο</button>
      <button data-tool="eraser"><span>🧽</span>Γόμα</button>
      <button data-tool="hand"><span>✋</span>Μετακίνηση</button>
    </div>
    <div class="group hidden" id="shapes">
      <button data-shape="line"><span>╱</span>Ευθεία</button>
      <button data-shape="arrow"><span>➚</span>Βέλος</button>
      <button data-shape="rect"><span>▭</span>Ορθογώνιο</button>
      <button data-shape="ellipse"><span>◯</span>Έλλειψη</button>
      <button data-shape="triangle"><span>△</span>Τρίγωνο</button>
      <button data-shape="angle"><span>∠</span>Γωνία με μοίρες</button>
    </div>
    <div class="group" id="colors"></div>
    <div class="group" id="widths"></div>
    <div class="group">
      <button id="undo"><span>↶</span>Αναίρεση</button>
      <button id="redo"><span>↷</span>Επανάληψη</button>
      <button id="del"><span>🗑</span>Διαγραφή</button>
    </div>
    <div class="group">
      <button id="importBtn" class="accent"><span>＋</span>Εισαγωγή</button>
      <button id="gadgetBtn"><span>📐</span>Όργανα</button>
      <button id="fit"><span>⤢</span>Προσαρμογή</button>
    </div>
    <div class="group pages">
      <button id="prev"><span>◀</span></button>
      <div id="pageLabel">1 / 1</div>
      <button id="next"><span>▶</span></button>
      <button id="addPage"><span>＋</span>Σελίδα</button>
    </div>
  </div>
  </div>

  <div id="importMenu" class="popup hidden">
    <button data-imp="file">📁 Εικόνα ή PDF από αρχείο…</button>
    <button data-imp="shot">🖥 Στιγμιότυπο οθόνης</button>
    <button data-imp="paste">📋 Επικόλληση από το πρόχειρο</button>
    <div class="hint">Συμβουλή: μπορείς επίσης να σύρεις αρχεία πάνω στον πίνακα ή να πατήσεις Ctrl+V.</div>
  </div>

  <div id="gadgetMenu" class="popup hidden">
    <button data-gadget="ruler">📏 Χάρακας</button>
    <button data-gadget="protractor">◗ Μοιρογνωμόνιο</button>
    <button data-gadget="compass">⭕ Διαβήτης</button>
    <button data-gadget="timer">⏱ Χρονόμετρο</button>
    <hr />
    <button data-axes="full">╋ Άξονες: 4 τεταρτημόρια</button>
    <button data-axes="q1">┗ Άξονες: 1ο τεταρτημόριο</button>
    <button data-axes="q14">┣ Άξονες: 1ο και 4ο (x ≥ 0)</button>
    <div class="hint">Χάρακας: γράψε δίπλα στην ακμή του για ευθεία γραμμή. Διαβήτης: σύρε το χρωματιστό μολύβι για τόξο, το ↔ για ακτίνα.</div>
  </div>
  <div id="textEd" class="hidden">
    <textarea rows="2" placeholder="Γράψε εδώ…"></textarea>
    <div class="row">
      <button id="textOk">✓ Εντάξει</button>
      <button id="textCancel">✕ Άκυρο</button>
    </div>
  </div>
  <div id="diag" class="hidden"></div>
  <div id="toast" class="hidden"></div>
  <div id="drop" class="hidden">Άφησε το αρχείο εδώ (εικόνα ή PDF)</div>
  <input id="fileImport" type="file" accept="image/*,application/pdf" multiple hidden />
  <input id="fileOpen" type="file" accept=".json,application/json" hidden />
`
);

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const timer = new Timer(app);
const board = new Board($('base') as HTMLCanvasElement, $('live') as HTMLCanvasElement);

// ---------- helpers ----------

let toastTimer = 0;
function toast(msg: string, ms = 3000): void {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  if (ms > 0) toastTimer = window.setTimeout(() => t.classList.add('hidden'), ms);
}

function download(blob: Blob, name: string): void {
  if (isNative) {
    nativeSave(blob, name)
      .then((ok) => ok && toast('Αποθηκεύτηκε'))
      .catch((err) => toast(`Αποτυχία αποθήκευσης: ${err}`, 6000));
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

// ---------- εισαγωγή ----------

async function importFiles(files: File[]): Promise<void> {
  for (const f of files) {
    try {
      if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
        toast(`Εισαγωγή PDF… 0%`, 0);
        const pages = await pdfToPages(f, (d, n) => toast(`Εισαγωγή PDF… σελίδα ${Math.min(d + 1, n)} από ${n}`, 0));
        board.appendPages(pages);
        toast(`Προστέθηκαν ${pages.length} σελίδες από το PDF`);
      } else if (f.type.startsWith('image/')) {
        const pic = await blobToPic(f);
        board.addPicture(pic.src, pic.w, pic.h);
      } else if (/\.json$/i.test(f.name)) {
        board.loadDoc(JSON.parse(await f.text()) as Doc);
        toast('Ο πίνακας άνοιξε');
      } else {
        toast(`Μη υποστηριζόμενο αρχείο: ${f.name}`);
      }
    } catch (err) {
      console.error(err);
      toast(`Αποτυχία εισαγωγής: ${f.name}`, 5000);
    }
  }
}

async function doScreenshot(): Promise<void> {
  try {
    const pic = isNative ? await blobToPic(await nativeScreenshot()) : await captureScreen();
    board.addPicture(pic.src, pic.w, pic.h);
  } catch (err) {
    const name = (err as Error).name;
    if (name === 'NotAllowedError') return; // ο χρήστης ακύρωσε
    toast('Η λήψη οθόνης δεν υποστηρίζεται εδώ. Βγάλε στιγμιότυπο με τη συσκευή και πάτα «Επικόλληση» ή Εισαγωγή αρχείου.', 7000);
  }
}

async function doPaste(): Promise<void> {
  try {
    const blob = await clipboardImage();
    if (!blob) {
      toast('Δεν βρέθηκε εικόνα στο πρόχειρο');
      return;
    }
    const pic = await blobToPic(blob);
    board.addPicture(pic.src, pic.w, pic.h);
  } catch {
    toast('Δεν επιτρέπεται η πρόσβαση στο πρόχειρο. Δοκίμασε Ctrl+V.', 5000);
  }
}

document.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.files ?? [])];
  if (files.length) {
    e.preventDefault();
    void importFiles(files);
  }
});

let dragDepth = 0;
window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragDepth++;
  $('drop').classList.remove('hidden');
});
window.addEventListener('dragleave', () => {
  if (--dragDepth <= 0) {
    dragDepth = 0;
    $('drop').classList.add('hidden');
  }
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  $('drop').classList.add('hidden');
  void importFiles([...(e.dataTransfer?.files ?? [])]);
});

// ---------- γραμμή εργαλείων ----------

const colorsEl = $('colors');
for (const c of COLORS) {
  const b = document.createElement('button');
  b.className = 'color';
  b.dataset.color = c;
  b.style.background = c;
  b.setAttribute('aria-label', c);
  colorsEl.append(b);
}
const widthsEl = $('widths');
for (const w of WIDTHS) {
  const b = document.createElement('button');
  b.className = 'width';
  b.dataset.width = String(w);
  b.innerHTML = `<i style="width:${8 + w * 2}px;height:${8 + w * 2}px"></i>`;
  widthsEl.append(b);
}

$('shapes').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-shape]');
  if (!b) return;
  board.shapeKind = b.dataset.shape as ShapeKind | 'angle';
  refreshUi();
});
$('tools').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tool]');
  if (b) board.setTool(b.dataset.tool as Tool);
});
colorsEl.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-color]');
  if (!b) return;
  board.color = b.dataset.color!;
  if (!['highlighter', 'pen', 'shape', 'text'].includes(board.tool)) board.setTool('pen');
  refreshUi();
});
widthsEl.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-width]');
  if (!b) return;
  board.width = Number(b.dataset.width);
  refreshUi();
});
$('undo').onclick = () => board.undo();
$('redo').onclick = () => board.redo();
$('del').onclick = () => board.deleteSelected();
$('fit').onclick = () => board.fitView();
$('prev').onclick = () => board.goto(board.cur - 1);
$('next').onclick = () => board.goto(board.cur + 1);
$('addPage').onclick = () => board.addPage();

function refreshUi(): void {
  document.querySelectorAll<HTMLElement>('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === board.tool));
  document.querySelectorAll<HTMLElement>('[data-color]').forEach((b) => b.classList.toggle('on', b.dataset.color === board.color));
  document.querySelectorAll<HTMLElement>('[data-width]').forEach((b) => b.classList.toggle('on', Number(b.dataset.width) === board.width));
  document.querySelectorAll<HTMLElement>('[data-shape]').forEach((b) => b.classList.toggle('on', b.dataset.shape === board.shapeKind));
  $('shapes').classList.toggle('hidden', board.tool !== 'shape');
  ($('undo') as HTMLButtonElement).disabled = !board.canUndo;
  ($('redo') as HTMLButtonElement).disabled = !board.canRedo;
  ($('del') as HTMLButtonElement).disabled = !board.selected;
  ($('prev') as HTMLButtonElement).disabled = board.cur === 0;
  ($('next') as HTMLButtonElement).disabled = board.cur >= board.doc.pages.length - 1;
  $('pageLabel').textContent = `${board.cur + 1} / ${board.doc.pages.length}`;
  document.querySelectorAll<HTMLElement>('[data-gadget]').forEach((b) => {
    const g = b.dataset.gadget!;
    b.classList.toggle('on', g === 'timer' ? timer.visible : board.gadgets.has(g as GadgetKind));
  });
  document.body.dataset.bg = board.doc.bg;
}
board.onUi = refreshUi;

// ---------- θέση, μέγεθος και σύμπτυξη της γραμμής εργαλείων ----------

interface BarState {
  scale: number;
  folded: boolean;
  /** Θέση πάνω-αριστερά όταν ο χρήστης την έχει μετακινήσει· αλλιώς κάτω στο κέντρο. */
  pos: { x: number; y: number } | null;
  /** Κάθετη διάταξη, όταν έχει αφεθεί στην αριστερή ή δεξιά άκρη. */
  vertical: boolean;
}

function initToolbar(): void {
  const wrap = $('toolbarWrap');
  const bar = $('toolbar');
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
      // κρατάμε τη γραμμή μέσα στην οθόνη
      const r = bar.getBoundingClientRect();
      st.pos.x = Math.max(0, Math.min(st.pos.x, window.innerWidth - r.width));
      // πάνω αριστερά βρίσκεται το κουμπί του μενού: δεν το σκεπάζουμε
      const minY = st.pos.x < 80 && r.height < window.innerHeight - 90 ? 78 : 0;
      st.pos.y = Math.max(minY, Math.min(st.pos.y, window.innerHeight - r.height));
      wrap.style.left = st.pos.x + 'px';
      wrap.style.top = st.pos.y + 'px';
    } else {
      wrap.style.left = '';
      wrap.style.top = '';
    }
    board.bottomInset = st.pos ? 0 : bar.getBoundingClientRect().height + 24;
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
  let off: { x: number; y: number } | null = null;
  let lastX = 0;
  let dragged = false;
  grip.addEventListener('pointerdown', (e) => {
    const r = bar.getBoundingClientRect();
    off = { x: e.clientX - r.left, y: e.clientY - r.top };
    dragged = false;
    grip.setPointerCapture(e.pointerId);
  });
  grip.addEventListener('pointermove', (e) => {
    if (!off) return;
    lastX = e.clientX;
    dragged = true;
    st.pos = { x: e.clientX - off.x, y: e.clientY - off.y };
    apply();
  });
  const end = (): void => {
    if (!off) return;
    off = null;
    if (!dragged) return;
    // κοντά στο κάτω-κεντρικό σημείο επιστρέφει στην αρχική της θέση
    const r = bar.getBoundingClientRect();
    const centered = Math.abs(r.left + r.width / 2 - window.innerWidth / 2) < 60;
    st.vertical = lastX < 50 || lastX > window.innerWidth - 50;
    if (!st.vertical && centered && r.bottom > window.innerHeight - 40) st.pos = null;
    if (st.vertical && st.pos && lastX > window.innerWidth - 50) st.pos.x = window.innerWidth;
    apply();
    save();
  };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
  grip.addEventListener('dblclick', () => { st.pos = null; st.vertical = false; apply(); save(); });
  window.addEventListener('resize', apply);

  // όσο γράφεις, η γραμμή ξεθωριάζει και δεν εμποδίζει τη γραφίδα
  const inking = new Set<number>();
  const live = $('live');
  live.addEventListener('pointerdown', (e) => { inking.add(e.pointerId); document.body.classList.add('inking'); });
  const lift = (e: PointerEvent): void => {
    inking.delete(e.pointerId);
    if (inking.size === 0) document.body.classList.remove('inking');
  };
  live.addEventListener('pointerup', lift);
  live.addEventListener('pointercancel', lift);

  apply();
}

// ---------- αναδυόμενα μενού ----------

const menu = $('menu');
const impMenu = $('importMenu');
const gadgetMenu = $('gadgetMenu');
function closePopups(): void {
  menu.classList.add('hidden');
  impMenu.classList.add('hidden');
  gadgetMenu.classList.add('hidden');
}
/** Τοποθετεί ένα αναδυόμενο μενού δίπλα στο κουμπί του, μέσα στα όρια της οθόνης. */
function placeNear(popup: HTMLElement, anchor: HTMLElement): void {
  const a = anchor.getBoundingClientRect();
  const w = popup.offsetWidth;
  const h = popup.offsetHeight;
  const left = Math.max(8, Math.min(a.left + a.width / 2 - w / 2, window.innerWidth - w - 8));
  let top = a.top - h - 10;
  if (top < 8) top = Math.min(a.bottom + 10, window.innerHeight - h - 8);
  popup.style.left = left + 'px';
  popup.style.top = Math.max(8, top) + 'px';
}
$('gadgetBtn').onclick = (e) => {
  e.stopPropagation();
  const open = gadgetMenu.classList.contains('hidden');
  closePopups();
  gadgetMenu.classList.toggle('hidden', !open);
  if (open) placeNear(gadgetMenu, $('gadgetBtn'));
};
gadgetMenu.addEventListener('click', (e) => {
  const ax = (e.target as HTMLElement).closest<HTMLElement>('[data-axes]');
  if (ax) {
    closePopups();
    board.addAxes(ax.dataset.axes as AxesMode);
    return;
  }
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-gadget]');
  if (!b) return;
  const g = b.dataset.gadget!;
  if (g === 'timer') timer.toggle();
  else board.toggleGadget(g as GadgetKind);
  refreshUi();
});
$('menuBtn').onclick = (e) => {
  e.stopPropagation();
  const open = menu.classList.contains('hidden');
  closePopups();
  menu.classList.toggle('hidden', !open);
};
$('importBtn').onclick = (e) => {
  e.stopPropagation();
  const open = impMenu.classList.contains('hidden');
  closePopups();
  impMenu.classList.toggle('hidden', !open);
  if (open) placeNear(impMenu, $('importBtn'));
};
document.addEventListener('pointerdown', (e) => {
  if (!(e.target as HTMLElement).closest('.popup, #menuBtn, #importBtn, #gadgetBtn')) closePopups();
});

impMenu.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-imp]');
  if (!b) return;
  closePopups();
  if (b.dataset.imp === 'file') ($('fileImport') as HTMLInputElement).click();
  else if (b.dataset.imp === 'shot') void doScreenshot();
  else void doPaste();
});
($('fileImport') as HTMLInputElement).onchange = (e) => {
  const input = e.target as HTMLInputElement;
  void importFiles([...(input.files ?? [])]);
  input.value = '';
};
($('fileOpen') as HTMLInputElement).onchange = (e) => {
  const input = e.target as HTMLInputElement;
  void importFiles([...(input.files ?? [])]);
  input.value = '';
};

menu.addEventListener('click', async (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!b) return;
  closePopups();
  const act = b.dataset.act!;
  if (act === 'new') {
    if (confirm('Να δημιουργηθεί νέος πίνακας; Ο τρέχων θα χαθεί αν δεν τον έχεις αποθηκεύσει.')) board.loadDoc(newDoc());
  } else if (act === 'open') {
    ($('fileOpen') as HTMLInputElement).click();
  } else if (act === 'save') {
    download(new Blob([JSON.stringify(board.doc)], { type: 'application/json' }), `pinakas_${stamp()}.json`);
  } else if (act === 'png') {
    download(await board.exportPng(), `selida_${board.cur + 1}_${stamp()}.png`);
  } else if (act.startsWith('bg-')) {
    board.setBackground(act.slice(3) as Background);
    if (act === 'bg-dark' && board.color === '#111111') board.color = '#ffffff';
    if (act !== 'bg-dark' && board.color === '#ffffff') board.color = '#111111';
    refreshUi();
  } else if (act === 'clear') {
    board.clearPage();
  } else if (act === 'delpage') {
    if (confirm('Να διαγραφεί η σελίδα;')) board.deletePage();
  } else if (act === 'full') {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen().catch(() => {});
  } else if (act === 'diag') {
    $('diag').classList.toggle('hidden');
  }
});

// ---------- διάγνωση ----------

const diag = $('diag');
diag.innerHTML = `
  <b>Διάγνωση εισόδου</b>
  <pre id="diagText">Άγγιξε ή γράψε στον πίνακα…</pre>
  <label>Όριο παλάμης (px): <span id="palmV"></span>
    <input id="palm" type="range" min="10" max="120" step="1" /></label>
  <small>Αν η γραφίδα του BenQ εμφανίζεται ως «touch», το μέγεθος επαφής ξεχωρίζει στυλό από παλάμη.
  Επαφές μεγαλύτερες από το όριο λειτουργούν ως γόμα.</small>`;
const palm = diag.querySelector<HTMLInputElement>('#palm')!;
palm.value = String(board.palmThreshold);
const palmV = diag.querySelector<HTMLElement>('#palmV')!;
palmV.textContent = palm.value;
palm.oninput = () => {
  board.palmThreshold = Number(palm.value);
  palmV.textContent = palm.value;
};
const diagText = diag.querySelector<HTMLElement>('#diagText')!;
let maxContact = 0;
board.onPointerInfo = (e, n) => {
  if (diag.classList.contains('hidden')) return;
  const size = Math.max(e.width, e.height);
  if (e.type === 'pointerdown') maxContact = size;
  else maxContact = Math.max(maxContact, size);
  diagText.textContent =
    `τύπος:        ${e.pointerType}\n` +
    `επαφή:        ${e.width.toFixed(1)} × ${e.height.toFixed(1)} px\n` +
    `μέγιστη επαφή:${maxContact.toFixed(1)} px\n` +
    `πίεση:        ${e.pressure.toFixed(2)}\n` +
    `κουμπιά:      ${e.buttons}\n` +
    `ταυτόχρονοι δείκτες: ${n}\n` +
    `pointerId:    ${e.pointerId}`;
};

// ---------- κείμενο ----------

const TEXT_SIZES = [28, 44, 72];
const textEd = $('textEd');
const textArea = textEd.querySelector('textarea')!;
let textCtx: { x: number; y: number; existing?: TextItem } | null = null;

function openText(x: number, y: number, existing?: TextItem): void {
  if (textCtx) closeText(true);
  textCtx = { x, y, existing };
  const size = existing?.size ?? TEXT_SIZES[Math.max(0, WIDTHS.indexOf(board.width))];
  const [sx, sy] = board.toScreen(x, y);
  const fs = Math.max(14, size * board.zoom);
  textEd.style.left = Math.max(8, Math.min(sx, window.innerWidth - 340)) + 'px';
  textEd.style.top = Math.max(8, Math.min(sy, window.innerHeight - 220)) + 'px';
  textArea.style.fontSize = fs + 'px';
  textArea.style.color = existing?.color ?? board.color;
  textArea.style.background = board.color === '#ffffff' || existing?.color === '#ffffff' ? '#374151' : '#fff';
  textArea.value = existing?.text ?? '';
  textEd.classList.remove('hidden');
  textArea.focus();
}

function closeText(save: boolean): void {
  if (!textCtx) return;
  const c = textCtx;
  textCtx = null;
  textEd.classList.add('hidden');
  if (save) {
    const size = c.existing?.size ?? TEXT_SIZES[Math.max(0, WIDTHS.indexOf(board.width))];
    board.commitText(c.x, c.y, textArea.value, size, c.existing);
  }
}
board.onTextRequest = openText;
$('textOk').onclick = () => closeText(true);
$('textCancel').onclick = () => closeText(false);
textArea.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Escape') closeText(false);
  else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) closeText(true);
});
document.addEventListener(
  'pointerdown',
  (e) => {
    if (textCtx && !(e.target as HTMLElement).closest('#textEd')) closeText(true);
  },
  true
);

// ---------- πληκτρολόγιο ----------

window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).closest('textarea, input')) return;
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) board.redo();
    else board.undo();
  } else if (ctrl && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    board.redo();
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    board.deleteSelected();
  } else if (!ctrl) {
    const map: Record<string, Tool> = { v: 'select', p: 'pen', h: 'highlighter', e: 'eraser', m: 'hand', s: 'shape', t: 'text' };
    const t = map[e.key.toLowerCase()];
    if (t) board.setTool(t);
    else if (e.key === 'PageDown') board.goto(board.cur + 1);
    else if (e.key === 'PageUp') board.goto(board.cur - 1);
  }
});

// ---------- αυτόματη αποθήκευση ----------

let saveTimer = 0;
board.onChange = () => {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => void saveDoc(board.doc), 1500);
};

void (async () => {
  const saved = await loadDoc();
  if (saved) {
    try {
      board.loadDoc(saved);
    } catch {
      /* κατεστραμμένη αποθήκευση: ξεκινάμε καθαροί */
    }
  }
  refreshUi();
  initToolbar();
})();

if (import.meta.env.PROD && !isNative && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

/** Αναγνώριση γραφής, έλεγχος και λύσεις με AI. */

import { FnDef, Item, TextItem, isDark } from './model';
import { Params, compile, fnOf, paramsOf } from './expr';
import { fitScaleX, fitScaleY, pickAxesMode } from './analysis';
import { AiTask, FigCmd, MODELS, Provider, RecKind, loadAi, recognize, saveAi, texToImage, parseFigureReply, parseGraphReply } from './ai';
import { uid, wrapText } from './model';
import { $, board, download, toast } from './app';
import { spellGame, spellList } from './kids';
import { askSpellWords } from './spell-lists';
// κυκλική αναφορά με το main: μόνο συναρτήσεις, που καλούνται αφού στηθεί όλη η εφαρμογή
import { closePopups, inkPalette, refreshUi } from './main';

export const ai = loadAi();
const aiMenu = $('aiMenu');
const aiKey = $('aiKey') as HTMLInputElement;
const aiModel = $('aiModel') as HTMLInputElement;
const AI_HINT: Record<Provider, string> = {
  gemini: 'Δωρεάν κλειδί από το Google AI Studio (aistudio.google.com), με ημερήσιο όριο. Στη δωρεάν βαθμίδα η Google χρησιμοποιεί ό,τι στέλνεις για να βελτιώνει τα προϊόντα της.',
  claude: 'Κλειδί από το console.anthropic.com. Χρεώνεται ανά χρήση.',
};
function renderAi(): void {
  document.querySelectorAll<HTMLElement>('[data-prov]').forEach((b) => b.classList.toggle('on', b.dataset.prov === ai.provider));
  $('aiModels').innerHTML = MODELS[ai.provider].map((m) => `<option value="${m}"></option>`).join('');
  aiModel.value = ai.models[ai.provider];
  aiKey.value = '';
  aiKey.placeholder = ai.keys[ai.provider] ? '•••••••• (αποθηκευμένο σε αυτή τη συσκευή)' : 'επικόλλησε εδώ το κλειδί σου';
  $('aiHint').textContent = `${AI_HINT[ai.provider]} Το κλειδί μένει μόνο σε αυτή τη συσκευή. Η εικόνα όσων αναγνωρίζεις στέλνεται στην υπηρεσία.`;
}
export function openAi(): void {
  closePopups();
  renderAi();
  aiMenu.classList.remove('hidden');
}
aiMenu.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const prov = t.closest<HTMLElement>('[data-prov]')?.dataset.prov as Provider | undefined;
  if (prov) {
    ai.provider = prov;
    saveAi(ai);
    renderAi();
  } else if (t.closest('#aiSave')) {
    if (aiKey.value.trim()) ai.keys[ai.provider] = aiKey.value.trim();
    if (aiModel.value.trim()) ai.models[ai.provider] = aiModel.value.trim();
    saveAi(ai);
    closePopups();
    toast(ai.keys[ai.provider] ? 'Οι ρυθμίσεις αποθηκεύτηκαν' : 'Αποθηκεύτηκαν, αλλά λείπει το κλειδί');
  } else if (t.closest('#aiForget')) {
    ai.keys[ai.provider] = '';
    saveAi(ai);
    renderAi();
    toast('Το κλειδί διαγράφηκε από αυτή τη συσκευή');
  }
});

const AI_NOTE_COLORS = { ok: ['#059669', '#34d399'], bad: ['#dc2626', '#f87171'], info: ['#2563eb', '#7dd3fc'] };
/**
 * Γράφει την απάντηση του AI κάτω από την περιοχή: σε μέγεθος που διαβάζεται στο τρέχον zoom
 * και σπασμένη σε γραμμές, ώστε να μην απλώνεται έξω από την οθόνη.
 */
function aiNote(box: { x0: number; y0: number; x1: number; y1: number }, text: string, tone: keyof typeof AI_NOTE_COLORS): void {
  const k = board.page.view.k;
  const size = Math.max(22, Math.min(160, 26 / k));
  const maxW = Math.min(Math.max(box.x1 - box.x0, 560 / k), (window.innerWidth - 60) / k);
  board.addItem({ kind: 'text', id: uid(), x: box.x0, y: box.y1 + 20 / k, text: wrapText(text, size, maxW), size, color: AI_NOTE_COLORS[tone][isDark(board.doc.bg) ? 1 : 0] });
}

let aiBusy = 0;
// ορθογραφία με το χέρι (Δημοτικό): ό,τι έγραψε ο μαθητής στο πλαίσιο του εργαλείου διαβάζεται όπως ακριβώς γράφτηκε, με τα λάθη του.
// Χωρίς κλειδί ή ίντερνετ επιστρέφει κενό: το παιχνίδι δείχνει τότε τη σωστή λέξη και η τάξη τη συγκρίνει με το χειρόγραφο.
board.onRead = async (ids) => {
  if (!ids.length) {
    toast('Γράψε πρώτα με το μολύβι μέσα στο πλαίσιο');
    return null;
  }
  if (!ai.keys[ai.provider]) return '';
  const img = await board.inkImage(ids);
  if (!img) return null;
  aiBusy++;
  toast('✨ Το διαβάζω…', 0);
  try {
    const out = (await recognize(img.blob, 'letters', ai)).split('\n')[0].trim();
    if (out) $('toast').classList.add('hidden');
    else toast('Δεν μπόρεσα να το διαβάσω: συγκρίνετέ το εσείς με τη σωστή λέξη.', 5000);
    return out;
  } catch (err) {
    toast(`Η ανάγνωση απέτυχε (${(err as Error).message}): συγκρίνετέ το εσείς με τη σωστή λέξη.`, 6000);
    return '';
  } finally {
    aiBusy--;
  }
};
/** Στέλνει τα στοιχεία για αναγνώριση και τα αντικαθιστά με κείμενο ή τυπωμένο τύπο. */
/** Βάζει άξονες με τις συναρτήσεις που διάβασε το AI· οι άξονες και η κλίμακα διαλέγονται από το πεδίο ορισμού και τις τιμές τους. */
function plotReply(out: string): void {
  const r = parseGraphReply(out);
  const pal = [...inkPalette().slice(1), '#ea580c', '#7c3aed'];
  const fns: FnDef[] = [];
  const params: Params = {};
  for (const f of r.fns) {
    try {
      compile(f.expr);
    } catch {
      continue;
    }
    for (const n of paramsOf(f.expr)) params[n] ??= 1;
    // οι κλάδοι της ίδιας συνάρτησης (ίδια απάντηση) παίρνουν το ίδιο χρώμα
    fns.push({ expr: f.expr, color: pal[0], ...(f.dom ? { dom: f.dom } : {}) });
  }
  if (!fns.length) {
    toast(r.fns.length ? `Δεν μπόρεσα να σχεδιάσω το «${r.fns[0].expr}». Γράψε το με το f(x).` : 'Δεν βρήκα συνάρτηση για γραφική παράσταση', 6000);
    return;
  }
  const NX = 10;
  const gs = fns.map((f) => fnOf(f)!).map((f) => (x: number) => f(x, params));
  // ο οριζόντιος άξονας απλώνεται ή μαζεύεται ώστε να χωράει ακριβώς το πεδίο ορισμού (π.χ. 0 ≤ t ≤ 50 → 5 ανά γραμμή)
  const sx = fitScaleX(fns.map((f) => f.dom), NX);
  const mode = pickAxesMode(gs, NX * sx);
  const sy = fitScaleY(gs, mode === 'full' ? -NX * sx : 0, NX * sx, 10, mode === 'q1' ? 0 : 10);
  board.addAxes(mode, { fns, ...(Object.keys(params).length ? { params } : {}), ...(sx === 1 ? {} : { sx }), ...(sy === 1 ? {} : { sy }), ...(r.lx ? { lx: r.lx } : {}), ...(r.ly ? { ly: r.ly } : {}) });
  toast('Η γραφική παράσταση μπήκε. Έλεγξε ότι ο τύπος διαβάστηκε σωστά.', 5000);
}

/**
 * Τα κομμάτια ενός σχήματος (καμβάς 100 × 70) ως στοιχεία του πίνακα, με πάνω αριστερή γωνία το (x, y) και `f` μονάδες πίνακα ανά μονάδα καμβά.
 * Είναι συνηθισμένα σχήματα, βέλη και κείμενα: ο καθηγητής τα μετακινεί, τα σβήνει ή τα διορθώνει όπως ό,τι άλλο έχει στον πίνακα.
 */
export function figureItems(cmds: FigCmd[], x: number, y: number, f: number, ink: string, pal: Record<'red' | 'blue' | 'green', string>): Item[] {
  const X = (v: number): number => x + v * f, Y = (v: number): number => y + v * f;
  const width = Math.max(2, 0.55 * f);
  const size = Math.max(14, 3.6 * f);
  const items: Item[] = [];
  for (const c of cmds) {
    if (c.k === 'line' || c.k === 'arrow') {
      const [x0, y0, x1, y1] = [X(c.pts[0]), Y(c.pts[1]), X(c.pts[2]), Y(c.pts[3])];
      items.push({ kind: 'shape', id: uid(), shape: c.k, x0, y0, x1, y1, color: c.k === 'arrow' ? pal[c.color] : ink, width: c.k === 'arrow' ? width * 1.25 : width, ...(c.k === 'line' && c.dash ? { dash: true } : {}) });
    } else if (c.k === 'rect') {
      const xs = [X(c.pts[0]), X(c.pts[2])], ys = [Y(c.pts[1]), Y(c.pts[3])];
      items.push({ kind: 'shape', id: uid(), shape: 'rect', x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), color: ink, width });
    } else if (c.k === 'circle') {
      items.push({ kind: 'shape', id: uid(), shape: 'ellipse', x0: X(c.x - c.r), y0: Y(c.y - c.r), x1: X(c.x + c.r), y1: Y(c.y + c.r), color: ink, width });
    } else if (c.k === 'poly') {
      // ευθείες μία μία και όχι γραμμή γραφής: οι γωνίες μένουν αιχμηρές και κάθε πλευρά διορθώνεται χωριστά
      for (let i = 0; i + 1 < c.pts.length; i++) items.push({ kind: 'shape', id: uid(), shape: 'line', x0: X(c.pts[i][0]), y0: Y(c.pts[i][1]), x1: X(c.pts[i + 1][0]), y1: Y(c.pts[i + 1][1]), color: ink, width });
    } else {
      // η ετικέτα δίνεται με το κέντρο της· το κείμενο του πίνακα μετριέται από πάνω αριστερά
      const w = [...c.text].length * size * 0.52;
      items.push({ kind: 'text', id: uid(), x: X(c.x) - w / 2, y: Y(c.y) - size * 0.6, text: c.text, size, color: ink });
    }
  }
  return items;
}

/**
 * Το κείμενο της επιλογής: ό,τι γράφτηκε με το «Κείμενο» διαβάζεται κατευθείαν (ενωμένο με `join`), το χειρόγραφο
 * ή κομμάτι εικόνας το αναγνωρίζει πρώτα το AI. null αν δεν μπόρεσε (το μήνυμα έχει ήδη φανεί).
 */
async function selectionText(join: string): Promise<string | null> {
  const ids = new Set(board.selectionIds);
  const picked = board.page.items.filter((it) => ids.has(it.id));
  const typed = picked.filter((it): it is TextItem => it.kind === 'text').map((t) => t.text).join(join);
  if (typed) return typed;
  if (!ai.keys[ai.provider]) {
    toast('Για χειρόγραφο χρειάζεται το κλειδί της αναγνώρισης. Κείμενο γραμμένο με το «Κείμενο» διαβάζεται χωρίς κλειδί.', 6000);
    return null;
  }
  const img = board.hasRegion ? await board.regionImage() : await board.inkImage(board.selectionIds);
  if (!img) return null;
  aiBusy++;
  toast('✨ Το διαβάζω…', 0);
  try {
    const out = await recognize(img.blob, 'text', ai);
    $('toast').classList.add('hidden');
    return out;
  } catch (err) {
    toast(`Η ανάγνωση απέτυχε: ${(err as Error).message}`, 6000);
    return null;
  } finally {
    aiBusy--;
  }
}

/** Ορθογραφία με τις λέξεις της επιλογής: φαίνονται στο παράθυρο των λέξεων (για διόρθωση ή φύλαξη) και ξεκινά νέο παιχνίδι. */
async function spellFromSelection(): Promise<void> {
  let found = await selectionText('\n');
  if (found == null) return;
  // λέξεις γραμμένες στον πίνακα με κενά ή σε γραμμές: μία σε κάθε γραμμή (με κόμμα, το κόμμα χωρίζει, για να μένουν οι φράσεις)
  if (!/[,;·]/.test(found)) found = found.trim().split(/\s+/).join('\n');
  if (!spellList(found).words.length) {
    toast('Δεν βρήκα λέξεις στην επιλογή');
    return;
  }
  const en = spellList(found).words.every((w) => /[a-z]/.test(w));
  const text = await askSpellWords({ title: 'Ορθογραφία με αυτές τις λέξεις', voice: en ? 'en-GB' : 'el-GR', value: found, download });
  const v = text == null ? null : spellGame(text);
  if (v) board.addStamp('spell', v);
}

/** Διαβάζει φωναχτά το επιλεγμένο κείμενο με τη φωνή του browser· το χειρόγραφο το αναγνωρίζει πρώτα το AI. */
async function speakSelection(): Promise<void> {
  const synth = window.speechSynthesis;
  if (!synth) {
    toast('Αυτός ο browser δεν μπορεί να διαβάσει φωναχτά');
    return;
  }
  if (synth.speaking) {
    synth.cancel();
    return;
  }
  const words = await selectionText('. ');
  if (words == null) return;
  if (!words.trim()) {
    toast('Δεν βρήκα κάτι να διαβάσω');
    return;
  }
  const u = new SpeechSynthesisUtterance(words);
  u.lang = 'el-GR';
  u.rate = 0.85;
  const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith('el'));
  if (voice) u.voice = voice;
  else if (synth.getVoices().length) toast('Δεν βρέθηκε ελληνική φωνή σε αυτή τη συσκευή· η ανάγνωση μπορεί να μην ακούγεται σωστά.', 6000);
  synth.speak(u);
}

async function runRecognition(ids: string[], kind: AiTask): Promise<void> {
  if (!ai.keys[ai.provider]) {
    openAi();
    toast('Βάλε πρώτα το κλειδί της υπηρεσίας');
    return;
  }
  const page = board.cur;
  // λύση και έλεγχος βλέπουν ό,τι υπάρχει στην κυκλωμένη περιοχή (και κομμάτι εικόνας από Word ή PDF)· η αναγνώριση μόνο τα επιλεγμένα χειρόγραφα
  const img = kind !== 'text' && kind !== 'math' && board.hasRegion ? await board.regionImage() : await board.inkImage(ids);
  if (!img) return;
  aiBusy++;
  toast(kind === 'spell' ? '✨ Ορθογραφία…' : kind === 'graph' ? '✨ Γραφική παράσταση…' : kind === 'figure' ? '✨ Σχήμα…' : kind === 'solve' ? '✨ Λύνεται…' : kind === 'check' ? '✨ Ελέγχεται…' : '✨ Αναγνώριση…', 0);
  try {
    const out = await recognize(img.blob, kind, ai);
    if (kind === 'graph') {
      if (board.cur !== page) toast('Άλλαξες σελίδα· η γραφική παράσταση δεν μπήκε');
      else plotReply(out);
      return;
    }
    if (kind === 'figure') {
      const cmds = out ? parseFigureReply(out) : [];
      if (board.cur !== page) toast('Άλλαξες σελίδα· το σχήμα δεν μπήκε');
      else if (cmds === null) toast('Αυτή η εκφώνηση δεν χρειάζεται σχήμα.', 5000);
      else if (!cmds.length) toast('Δεν μπόρεσα να φτιάξω σχήμα για αυτή την εκφώνηση');
      else {
        // κάτω από την εκφώνηση, σε μέγεθος που διαβάζεται στο τρέχον zoom
        const zk = board.page.view.k;
        const f = Math.max(4, Math.min(5.6 / zk, (window.innerWidth - 80) / zk / 100));
        const pal = inkPalette();
        board.addItems(figureItems(cmds, img.box.x0, img.box.y1 + 24 / zk, f, img.color, { red: pal[1], blue: pal[2], green: pal[3] }));
        toast('Το σχήμα μπήκε κάτω από την εκφώνηση. Είναι πρόχειρο: έλεγξέ το και διόρθωσέ το πριν το δείξεις.', 6000);
      }
      return;
    }
    if (!out) {
      toast(kind === 'solve' ? 'Δεν βρήκα κάτι να λύσω' : kind === 'check' ? 'Δεν βρήκα λύση να ελέγξω' : 'Δεν μπόρεσα να το διαβάσω');
      return;
    }
    if (board.cur !== page) {
      toast(kind === 'solve' ? 'Άλλαξες σελίδα· η λύση δεν μπήκε' : kind === 'check' ? 'Άλλαξες σελίδα· ο έλεγχος δεν μπήκε' : 'Άλλαξες σελίδα· η αναγνώριση δεν εφαρμόστηκε');
      return;
    }
    const { box, color } = img;
    const bh = box.y1 - box.y0;
    if (kind === 'check' || kind === 'spell') {
      // η κρίση μπαίνει κάτω από τη λύση του μαθητή: πράσινη αν είναι σωστή, κόκκινη αν έχει λάθος
      const ok = out.startsWith('✓');
      aiNote(box, out, ok ? 'ok' : 'bad');
      toast(ok ? 'Δεν βρέθηκε λάθος. Ρίξε κι εσύ μια ματιά.' : kind === 'spell' ? 'Βρέθηκαν λέξεις για διόρθωση. Ρίξε κι εσύ μια ματιά.' : 'Βρέθηκε πιθανό λάθος. Έλεγξέ το πριν το πεις στον μαθητή.', 5000);
      return;
    }
    if (kind === 'solve') {
      if (/^TEXT\b/.test(out)) {
        // ερώτηση θεωρίας ή πολλαπλής επιλογής: η απάντηση είναι σκέτο κείμενο
        aiNote(box, out.replace(/^TEXT\s*/, ''), 'info');
        toast('Η απάντηση μπήκε κάτω από την ερώτηση. Έλεγξέ την πριν τη δείξεις.', 5000);
        return;
      }
      // η λύση μπαίνει κάτω από την άσκηση, χωρίς να πειράξει το χειρόγραφο
      const lines = out.split('\\\\').length;
      // το μέγεθος ακολουθεί το zoom, για να διαβάζεται και σε σμικρυμένη σελίδα
      const zk = board.page.view.k;
      const pic = await texToImage(out, board.ink(color), Math.max(26, Math.min(160, Math.max(Math.min(bh * 0.4, 60), 30 / zk))));
      board.addItem({ kind: 'image', id: uid(), x: box.x0, y: box.y1 + 20 / zk, w: pic.w, h: pic.h, src: pic.src });
      toast(lines > 1 ? 'Η λύση μπήκε κάτω από την άσκηση. Έλεγξέ την πριν τη δείξεις.' : 'Η απάντηση μπήκε κάτω από την άσκηση. Έλεγξέ την.', 5000);
      return;
    }
    if (kind === 'text') {
      const lines = out.split('\n').length;
      const size = Math.max(22, Math.min(96, (bh / lines) * 0.75));
      board.replaceItems(ids, { kind: 'text', id: uid(), x: box.x0, y: box.y0, text: out, size, color });
    } else {
      let pic = await texToImage(out, board.ink(color), Math.max(24, Math.min(90, bh * 0.45)));
      // ο τύπος να μην βγει πολύ ψηλότερος από το χειρόγραφο
      const f = Math.min(1, (Math.max(bh, 50) * 1.15) / pic.h);
      pic = { ...pic, w: pic.w * f, h: pic.h * f };
      board.replaceItems(ids, { kind: 'image', id: uid(), x: box.x0, y: box.y0 + (bh - pic.h) / 2, w: pic.w, h: pic.h, src: pic.src });
    }
    $('toast').classList.add('hidden');
  } catch (err) {
    toast(`${kind === 'solve' ? 'Η λύση' : kind === 'check' ? 'Ο έλεγχος' : kind === 'figure' ? 'Το σχήμα' : 'Η αναγνώριση'} απέτυχε: ${(err as Error).message}`, 6000);
  } finally {
    aiBusy--;
  }
}
$('selOpts').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-rec]');
  if (b) void runRecognition(board.selectionIds, b.dataset.rec as AiTask);
  else if ((e.target as HTMLElement).closest('[data-speak]')) void speakSelection();
  else if ((e.target as HTMLElement).closest('[data-spellwords]')) void spellFromSelection();
});

// αυτόματη αναγνώριση: ό,τι γράφεται στέλνεται μόλις η γραφίδα μείνει σηκωμένη για λίγο
export let autoKind: RecKind | null = null;
let autoBatch: string[] = [];
let autoTimer = 0;
const AUTO_IDLE_MS = 1600;
function autoFlush(): void {
  clearTimeout(autoTimer);
  const ids = autoBatch;
  autoBatch = [];
  if (autoKind && ids.length) void runRecognition(ids, autoKind);
}
board.onStroke = (s) => {
  if (!autoKind) return;
  autoBatch.push(s.id);
  clearTimeout(autoTimer);
  autoTimer = window.setTimeout(autoFlush, AUTO_IDLE_MS);
};
$('live').addEventListener('pointerdown', () => clearTimeout(autoTimer));
const autoRearm = (): void => {
  if (!autoKind || autoBatch.length === 0) return;
  clearTimeout(autoTimer);
  autoTimer = window.setTimeout(autoFlush, AUTO_IDLE_MS);
};
$('live').addEventListener('pointerup', autoRearm);
$('live').addEventListener('pointercancel', autoRearm);
$('penKinds').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-auto]');
  if (!b) return;
  const k = b.dataset.auto as RecKind;
  if (autoKind === k) {
    autoKind = null;
  } else if (!ai.keys[ai.provider]) {
    openAi();
    toast('Βάλε πρώτα το κλειδί της υπηρεσίας');
    return;
  } else {
    autoKind = k;
    if (board.tool !== 'pen') board.setTool('pen');
    toast(k === 'text' ? 'Αυτόματη αναγνώριση κειμένου: γράψε και σταμάτα για λίγο' : 'Αυτόματη αναγνώριση τύπων: γράψε και σταμάτα για λίγο', 4000);
  }
  clearTimeout(autoTimer);
  autoBatch = [];
  refreshUi();
});

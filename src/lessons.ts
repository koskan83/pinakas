/** Βιβλιοθήκη μαθημάτων: κάθε μάθημα είναι ένας πίνακας που σώζεται χωριστά στη συσκευή. */

import { Doc, newDoc, readDoc, uid } from './model';
import { backupLesson, driveClientId, driveConnect, driveReady, listDriveLessons, listLessonBackups, readBackup, trashBackup, type RemoteLesson } from './drive';
import { deleteLesson, kvGet, kvSet, loadDoc, loadLesson, saveLesson } from './storage';
import { ask, askLines, chooseBox, confirmBox, type Choice, type WordList } from './dialog';
import { classFileName, safeName, saveClassFile } from './class-files';
import { loadLists, mergeLists } from './spell-lists';
import { mascot } from './mascot';

export interface LessonMeta {
  id: string;
  name: string;
  /** Τελευταία αλλαγή (ms). */
  updated: number;
  pages: number;
  /** Τμήμα ή τάξη στην οποία ανήκει (π.χ. «Β2»), αν έχει οριστεί. */
  group?: string;
  /** Μικρογραφία της πρώτης σελίδας (data URL). */
  thumb?: string;
}

interface Backup {
  grafida: 'backup';
  v: 1;
  lessons: { meta: LessonMeta; doc: Doc }[];
  /** Τα ονόματα των μαθητών κάθε τμήματος (μόνο στο αντίγραφο σε αρχείο, ποτέ στο Drive). */
  rosters?: Record<string, string[]>;
  /** Οι λίστες λέξεων της ορθογραφίας (κι αυτές μόνο στο αντίγραφο σε αρχείο). */
  spellLists?: WordList[];
}

const INDEX = 'lessons';
const CURRENT = 'lesson.current';
const ROSTERS = 'rosters';

/** Τι έχει ανέβει στο Drive από αυτή τη συσκευή. */
interface SafeState {
  /** Πότε έγινε το τελευταίο αντίγραφο (ή πότε πρωτοάνοιξε η εφαρμογή, αν δεν έγινε ποτέ). */
  at: number;
  /** Αν έχει γίνει ποτέ αντίγραφο στο Drive. */
  done: boolean;
  /** Η έκδοση (updated) κάθε μαθήματος που ανέβηκε. */
  ids: Record<string, number>;
  /** Μαθήματα που σβήστηκαν εδώ: δεν ξαναέρχονται από το Drive. */
  gone: string[];
  /** Πότε έγινε το τελευταίο αντίγραφο σε αρχείο. */
  file?: number;
  /** Πότε φάνηκε τελευταία η υπενθύμιση για αντίγραφο. */
  told?: number;
}
const SAFE = 'grafida.safe';
const GROUP = 'grafida.group';
const DAY = 86400000;
/** Η ένδειξη του Drive δίπλα στο όνομα του μαθήματος και στις κάρτες. */
const CLOUD = { '': '', ok: '☁ ✓', chg: '☁ ↑' } as const;
/** Μετά από τόσες μέρες χωρίς αντίγραφο το κουμπί των μαθημάτων δείχνει υπενθύμιση. */
const REMIND_DAYS = 7;

function loadSafe(): SafeState {
  const s: SafeState = { at: Date.now(), done: false, ids: {}, gone: [] };
  try {
    const p = JSON.parse(localStorage.getItem(SAFE) ?? 'null');
    if (p) Object.assign(s, p);
    else localStorage.setItem(SAFE, JSON.stringify(s));
  } catch {
    /* χωρίς αποθήκευση */
  }
  return s;
}

export interface LessonHost {
  /** Ο πίνακας που είναι ανοιχτός τώρα. */
  getDoc(): Doc;
  /** Ανοίγει έναν πίνακα στην οθόνη. */
  setDoc(doc: Doc): void;
  /** Μικρογραφία της πρώτης σελίδας του ανοιχτού πίνακα. */
  thumb(): Promise<string | undefined>;
  /** Ξαναζωγραφίζει τον πίνακα (π.χ. άλλαξαν τα ονόματα του τμήματος που δείχνει η κλήρωση). */
  redraw(): void;
  download(blob: Blob, name: string): void;
  toast(msg: string, ms?: number, action?: { label: string; run: () => void }): void;
}


function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

export class Lessons {
  private index: LessonMeta[] = [];
  private cur = '';
  private timer = 0;
  private dirty = false;
  private thumbAt = 0;
  private el: HTMLElement;
  private label: HTMLElement;
  /** Όσο φορτώνουμε πίνακα, οι «αλλαγές» του δεν μετράνε ως επεξεργασία. */
  private loading = false;
  private safe = loadSafe();
  /** Το τμήμα που φαίνεται στη βιβλιοθήκη· κενό = όλα. */
  private filter = (() => { try { return localStorage.getItem(GROUP) ?? ''; } catch { return ''; } })();
  private busy = false;
  /** Τα ονόματα των μαθητών κάθε τμήματος. Μένουν μόνο σε αυτή τη συσκευή. */
  private rosters: Record<string, string[]> = {};
  private startEl: HTMLElement;
  /** Μαθήματα που δεν άνοιξαν σε αυτή τη συνεδρία (π.χ. από νεότερη έκδοση). */
  private failed = new Set<string>();

  constructor(private host: LessonHost, parent: HTMLElement) {
    parent.insertAdjacentHTML(
      'beforeend',
      `<button id="lessonName" class="fab hidden" title="Μετονομασία μαθήματος"><i id="libOpen" title="Μαθήματα"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z"/></svg></i><span></span><em class="cl"></em></button>
      <div id="lib" class="hidden">
        <div id="libHead">
          <img class="lg onDark" src="./logo-light.svg" alt="" /><img class="lg onLight" src="./logo.svg" alt="" />
          <b>Μαθήματα</b>
          <button data-lib="new" class="go">＋ Νέο μάθημα</button>
          <span class="sp"></span>
          <button data-lib="backup" title="Κατεβάζει όλα τα μαθήματα σε ένα αρχείο">Αντίγραφο σε αρχείο</button>
          <button data-lib="restore" title="Φέρνει πίσω μαθήματα από αρχείο αντιγράφου">Επαναφορά από αρχείο</button>
          <button data-lib="close" title="Κλείσιμο">✕</button>
        </div>
        <div id="libSafe">
          <span id="libSafeMsg"></span>
          <button data-lib="cloud" class="go" title="Ανεβάζει στο δικό σου Google Drive όσα μαθήματα άλλαξαν, το καθένα στον φάκελο του τμήματός του">☁ Όλα στο Drive</button>
          <button data-lib="cloudGet" title="Διαλέγεις ένα μάθημα από το Google Drive σου (από οποιαδήποτε συσκευή) και ανοίγει εδώ">☁ Άνοιγμα από το Drive…</button>
        </div>
        <div id="libGroups"></div>
        <div id="libGrid"></div>
        <input id="libFile" type="file" accept=".json,application/json" hidden />
      </div>
      <div id="start" class="hidden"><div id="stBox"></div></div>`,
    );
    this.startEl = parent.querySelector<HTMLElement>('#start')!;
    this.startEl.addEventListener('click', (e) => void this.startClick(e));
    this.el = parent.querySelector<HTMLElement>('#lib')!;
    this.label = parent.querySelector<HTMLElement>('#lessonName')!;
    // το εικονίδιο ανοίγει τα μαθήματα· το ίδιο το όνομα μετονομάζει το ανοιχτό μάθημα
    // το ☁ με αλλαγές τις ανεβάζει στο Drive
    this.label.onclick = (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('#libOpen')) return void this.open();
      if (t.closest('.cl.chg')) return void this.saveToDrive();
      void this.rename(this.current);
    };
    this.el.addEventListener('click', (e) => void this.click(e));
    const file = this.el.querySelector<HTMLInputElement>('#libFile')!;
    file.onchange = () => {
      const f = file.files?.[0];
      file.value = '';
      if (f) void this.restore(f);
    };
    // το κλείσιμο της καρτέλας δεν περιμένει το χρονόμετρο της αυτόματης αποθήκευσης
    window.addEventListener('pagehide', () => this.flushSoon(false));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flushSoon(false);
    });
  }

  /** «Μάθημα 14/10/2026» (ή «Β2 14/10/2026» για τμήμα), με αρίθμηση αν υπάρχει ήδη. */
  private defaultName(group = ''): string {
    const base = `${group || 'Μάθημα'} ${new Date().toLocaleDateString('el')}`;
    let name = base;
    for (let n = 2; this.index.some((m) => m.name === name); n++) name = `${base} (${n})`;
    return name;
  }

  get current(): LessonMeta | undefined {
    return this.index.find((m) => m.id === this.cur);
  }

  /** Φορτώνει τη βιβλιοθήκη και ανοίγει το μάθημα που ήταν ανοιχτό την τελευταία φορά. */
  async init(): Promise<void> {
    // ζητάμε από τον browser να μη σβήσει τα δεδομένα όταν γεμίσει ο δίσκος
    void navigator.storage?.persist?.().catch(() => false);
    this.index = (await kvGet<LessonMeta[]>(INDEX)) ?? [];
    this.rosters = (await kvGet<Record<string, string[]>>(ROSTERS)) ?? {};
    if (this.index.length === 0) {
      // πρώτη φορά: ο πίνακας της παλιάς έκδοσης γίνεται το πρώτο μάθημα
      const old = await loadDoc();
      await this.add(old ?? newDoc(), this.defaultName());
    }
    const want = await kvGet<string>(CURRENT);
    const meta = this.index.find((m) => m.id === want) ?? this.index[0];
    await this.show(meta.id);
  }

  /** Τα ονόματα των μαθητών του τμήματος του ανοιχτού μαθήματος· κενό αν δεν έχει τμήμα ή λίστα. */
  names(): string[] {
    const g = this.current?.group;
    return (g && this.rosters[g]) || [];
  }

  /** Αλλάζει τη λίστα μαθητών ενός τμήματος: ένα όνομα σε κάθε γραμμή. */
  private async editRoster(group: string): Promise<void> {
    const have = this.rosters[group] ?? [];
    const text = await askLines(`Μαθητές του ${group}`, {
      value: have.join('\n'),
      hint: 'Ένα όνομα σε κάθε γραμμή (μπορείς να τα επικολλήσεις από λίστα). Μένουν μόνο σε αυτή τη συσκευή. Με αυτά η Κλήρωση βγάζει όνομα αντί για αριθμό.',
      ok: 'Αποθήκευση',
    });
    if (text === null) return;
    const names = [...new Set(text.split(/\r?\n/).map((s) => s.trim().slice(0, 40)).filter(Boolean))].slice(0, 60);
    if (names.length) this.rosters[group] = names;
    else delete this.rosters[group];
    await kvSet(ROSTERS, this.rosters);
    this.host.redraw();
  }

  /**
   * Η οθόνη «Τι κάνουμε σήμερα;»: βγαίνει στο πρώτο άνοιγμα της μέρας, όταν το ανοιχτό μάθημα είναι παλιότερο.
   * Ένα πάτημα συνεχίζει το τελευταίο μάθημα ή ανοίγει νέο για το τμήμα που έχεις τώρα.
   */
  start(): void {
    const cur = this.current;
    if (!cur) return;
    const day = (t: number): string => new Date(t).toDateString();
    if (day(cur.updated) === day(Date.now())) return;
    // μία μόνο άγραφη σελίδα: δεν υπάρχει κάτι να συνεχίσεις ή να διαλέξεις
    if (this.index.length === 1 && this.host.getDoc().pages.every((p) => p.items.length === 0)) return;
    const when = (t: number): string => new Date(t).toLocaleDateString('el', { weekday: 'long', day: 'numeric', month: 'long' });
    const last = (g: string): LessonMeta | undefined => this.index.filter((m) => m.group === g).sort((a, b) => b.updated - a.updated)[0];
    const rows = this.groups
      .map((g) => ({ g, m: last(g)! }))
      .sort((a, b) => b.m.updated - a.m.updated)
      .slice(0, 6)
      .map(({ g, m }) => `<div class="row"><span class="grp">${esc(g)}</span>
        <button data-st="new" data-g="${esc(g)}">＋ Νέο μάθημα</button>
        ${m.id === cur.id ? '' : `<button data-st="open" data-id="${m.id}" class="last"><small>Τελευταίο · ${new Date(m.updated).toLocaleDateString('el', { day: 'numeric', month: 'numeric' })}</small>${esc(m.name)}</button>`}</div>`)
      .join('');
    this.startEl.querySelector('#stBox')!.innerHTML = `
      <div id="stHead"><b>${new Date().getHours() < 12 ? 'Καλημέρα' : 'Καλησπέρα'}! Τι κάνουμε σήμερα;</b><span>${when(Date.now())}</span></div>
      <button id="stCont" data-st="cont">
        <span class="th">${cur.thumb ? `<img src="${cur.thumb}" alt="" />` : ''}</span>
        <span class="tx"><small>Συνέχισε από εκεί που έμεινες</small><b>${cur.group ? `<i class="grp">${esc(cur.group)}</i>` : ''}${esc(cur.name)}</b><small>${when(cur.updated)} · ${cur.pages} ${cur.pages === 1 ? 'σελίδα' : 'σελίδες'}</small></span>
      </button>
      ${rows ? `<div id="stGroups">${rows}</div>` : ''}
      <div id="stActs"><button data-st="lib">Όλα τα μαθήματα</button><button data-st="new" data-g="" class="go">＋ Νέο μάθημα</button></div>`;
    // το τερατάκι λέει την καλημέρα
    this.startEl.querySelector('#stHead')!.prepend(mascot(76, 1.4));
    this.startEl.classList.remove('hidden');
  }

  private async startClick(e: Event): Promise<void> {
    const t = e.target as HTMLElement;
    const b = t.closest<HTMLElement>('[data-st]');
    // πάτημα έξω από το πλαίσιο: συνεχίζεις όπως ήσουν
    if (!b && t !== this.startEl) return;
    this.startEl.classList.add('hidden');
    const act = b?.dataset.st;
    if (act === 'lib') return this.open();
    if (act === 'open' && b!.dataset.id && b!.dataset.id !== this.cur) {
      await this.flush(false);
      return this.show(b!.dataset.id);
    }
    if (act === 'new') {
      const g = b!.dataset.g ?? '';
      await this.flush(false);
      const meta = await this.add(newDoc(), this.defaultName(g));
      if (g) {
        meta.group = g;
        await kvSet(INDEX, this.index);
      }
      await this.show(meta.id);
    }
  }

  /** Καλείται σε κάθε αλλαγή του πίνακα: αποθηκεύει λίγο αργότερα. */
  touch(): void {
    if (this.loading || !this.cur) return;
    this.dirty = true;
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.flushSoon(Date.now() - this.thumbAt > 20000), 1500);
  }

  /** Αποθήκευση στο παρασκήνιο: αν αποτύχει, δεν μένει σφάλμα «στον αέρα» και η επόμενη αλλαγή ξαναδοκιμάζει. */
  private flushSoon(withThumb: boolean): void {
    this.flush(withThumb).catch((err) => console.warn('Η αποθήκευση δεν ολοκληρώθηκε', err));
  }

  /** Γράφει τώρα το ανοιχτό μάθημα στη συσκευή. */
  async flush(withThumb: boolean): Promise<void> {
    clearTimeout(this.timer);
    const meta = this.current;
    if (!meta || !this.dirty) return;
    this.dirty = false;
    const doc = this.host.getDoc();
    meta.updated = Date.now();
    meta.pages = doc.pages.length;
    try {
      await saveLesson(meta.id, doc);
    } catch (err) {
      // δεν γράφτηκε (π.χ. η σελίδα έκλεινε εκείνη τη στιγμή): μένει «προς αποθήκευση» για την επόμενη φορά
      this.dirty = true;
      throw err;
    }
    if (withThumb) {
      this.thumbAt = Date.now();
      meta.thumb = (await this.host.thumb().catch(() => undefined)) ?? meta.thumb;
    }
    await kvSet(INDEX, this.index);
    this.renderLabel();
  }

  /** Νέο μάθημα από έτοιμο πίνακα (π.χ. αρχείο που άνοιξε ο χρήστης) και άνοιγμά του. */
  async createFrom(doc: Doc, name: string, group?: string): Promise<void> {
    await this.flush(true);
    const meta = await this.add(doc, name);
    if (group) {
      meta.group = group;
      await kvSet(INDEX, this.index);
    }
    await this.show(meta.id);
  }

  private async add(doc: Doc, name: string): Promise<LessonMeta> {
    const meta: LessonMeta = { id: uid(), name, updated: Date.now(), pages: doc.pages.length };
    this.index.unshift(meta);
    await saveLesson(meta.id, doc);
    await kvSet(INDEX, this.index);
    return meta;
  }

  private async show(id: string): Promise<void> {
    const doc = (await loadLesson(id, true)) ?? newDoc();
    this.loading = true;
    try {
      this.host.setDoc(doc);
      this.cur = id;
    } catch (err) {
      // δεν διαβάζεται (π.χ. από νεότερη έκδοση): μένει ανέγγιχτο, και ανοίγει άλλο μάθημα ή ένα νέο, ώστε να μη γραφτεί ποτέ από πάνω του
      this.loading = false;
      this.host.toast(`Το «${this.index.find((m) => m.id === id)?.name ?? ''}» δεν άνοιξε: ${err instanceof Error ? err.message : err}`, 8000);
      this.failed.add(id);
      const other = this.index.find((m) => !this.failed.has(m.id));
      return other ? this.show(other.id) : this.show((await this.add(newDoc(), this.defaultName())).id);
    }
    this.loading = false;
    this.dirty = false;
    await kvSet(CURRENT, id);
    this.renderLabel();
  }

  private async rename(meta: LessonMeta | undefined): Promise<void> {
    if (!meta) return;
    const name = (await ask('Όνομα μαθήματος', { value: meta.name }))?.trim();
    if (!name || name === meta.name) return;
    meta.name = name.slice(0, 60);
    meta.updated = Date.now();
    await kvSet(INDEX, this.index);
    this.renderLabel();
  }

  private renderLabel(): void {
    const cur = this.current;
    const name = cur?.name ?? '';
    this.label.querySelector('span')!.textContent = name;
    this.label.classList.toggle('hidden', !name);
    this.label.classList.toggle('warn', this.overdue);
    const st = cur ? this.cloud(cur) : '';
    const cl = this.label.querySelector<HTMLElement>('.cl')!;
    cl.className = `cl ${st}`;
    cl.textContent = CLOUD[st];
    cl.title = st === 'ok' ? 'Αποθηκευμένο και στο Google Drive' : st === 'chg' ? 'Έχει αλλαγές που δεν έχουν ανέβει στο Drive: πάτα για ανέβασμα' : '';
  }

  /** Η κατάσταση ενός μαθήματος στο Drive: 'ok' ανεβασμένο όπως είναι, 'chg' άλλαξε μετά, '' δεν έχει ανέβει ποτέ από εδώ. */
  private cloud(m: LessonMeta): '' | 'ok' | 'chg' {
    if (!driveClientId() || !(m.id in this.safe.ids)) return '';
    return this.safe.ids[m.id] >= m.updated ? 'ok' : 'chg';
  }

  /** Ένα μάθημα ως αρχείο: το ίδιο για τον φάκελο, τη συσκευή και το Drive. Κρατά όνομα και τμήμα, ώστε να ξανανοίγει ως το ίδιο μάθημα. */
  private lessonBlob(meta: LessonMeta, doc: Doc): Blob {
    const { thumb: _thumb, ...slim } = meta;
    const out: Backup = { grafida: 'backup', v: 1, lessons: [{ meta: slim, doc }] };
    return new Blob([JSON.stringify(out)], { type: 'application/json' });
  }

  /**
   * Ανεβάζει ένα μάθημα στο Drive, στον φάκελο του τμήματός του. `remote`: το αρχείο του εκεί (null: δεν υπάρχει·
   * undefined: άγνωστο, το ψάχνουμε). Επιστρέφει τον φάκελο, π.χ. «PrismaBoard/Β2».
   */
  private async uploadOne(meta: LessonMeta, remote?: RemoteLesson | null): Promise<string> {
    const doc = await loadLesson(meta.id);
    if (!doc) throw new Error('το μάθημα δεν διαβάστηκε');
    if (remote === undefined) remote = (await listLessonBackups()).find((r) => r.id === meta.id) ?? null;
    const where = await backupLesson(meta.id, safeName(meta.name), meta.updated, this.lessonBlob(meta, doc), meta.group ? safeName(meta.group) : undefined, remote ?? undefined);
    this.safe.ids[meta.id] = meta.updated;
    this.safe.gone = this.safe.gone.filter((g) => g !== meta.id);
    this.saveSafe();
    this.renderLabel();
    return where;
  }

  /** ☰ → «Αποθήκευση…» → «Στο Google Drive»: το ανοιχτό μάθημα, τώρα, στον φάκελο του τμήματός του. */
  async saveToDrive(): Promise<void> {
    if (this.busy || !driveClientId()) return;
    this.busy = true;
    try {
      // η σύνδεση πρώτα, όσο «μετράει» ακόμα το πάτημα του κουμπιού
      await driveConnect();
      await this.flush(true);
      const meta = this.current;
      if (!meta) return;
      this.host.toast(`Αποθήκευση του «${meta.name}» στο Drive…`, 0);
      const where = await this.uploadOne(meta);
      this.host.toast(`Αποθηκεύτηκε στο Google Drive, στο «${where}». Ανοίγει από κάθε συσκευή με ☰ → «Άνοιγμα από το Google Drive».`, 7000);
    } catch (err) {
      console.error(err);
      this.host.toast(`Δεν αποθηκεύτηκε στο Drive: ${err instanceof Error ? err.message : err}`, 8000);
    } finally {
      this.busy = false;
    }
  }

  /** ☰ → «Αποθήκευση…» → «Στον δίσκο» και το «Αρχείο» της κάρτας: στον φάκελο του τμήματος (βλ. class-files.ts). */
  async exportFile(meta = this.current): Promise<void> {
    if (!meta) return;
    if (meta.id === this.cur) await this.flush(true);
    const doc = await loadLesson(meta.id);
    if (!doc) return;
    // το αντίγραφο στο Drive (αν είναι αναμμένο) είναι το ίδιο το μάθημα στο Drive, όχι δεύτερο αρχείο δίπλα του
    await saveClassFile(this.lessonBlob(meta, doc), classFileName(meta.name, meta.group, 'json'), meta.group, this.host.toast, () => this.uploadOne(meta));
  }

  /** ☰ → «Άνοιγμα από το Google Drive»: λίστα με τα μαθήματα του Drive (από όλες τις συσκευές) ανά τμήμα· ένα πάτημα ανοίγει. */
  async openFromDrive(): Promise<void> {
    if (this.busy || !driveClientId()) return;
    this.busy = true;
    let list: RemoteLesson[];
    try {
      await driveConnect();
      this.host.toast('Ψάχνω στο Drive…', 0);
      await this.flush(false);
      list = await listDriveLessons();
      this.host.toast('', 1);
    } catch (err) {
      console.error(err);
      return this.host.toast(`Δεν άνοιξε το Drive: ${err instanceof Error ? err.message : err}`, 8000);
    } finally {
      this.busy = false;
    }
    const known = (r: RemoteLesson): LessonMeta | undefined => (r.id ? this.index.find((m) => m.id === r.id) : undefined);
    const NONE = 'Χωρίς τμήμα';
    const sec = (r: RemoteLesson): string => r.group || known(r)?.group || NONE;
    const when = (t: number): string => `${new Date(t).toLocaleDateString('el', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}, ${new Date(t).toLocaleTimeString('el', { hour: '2-digit', minute: '2-digit' })}`;
    const rows = list
      .map((r) => ({ r, s: sec(r) }))
      .sort((a, b) => (a.s === b.s ? b.r.updated - a.r.updated : a.s === NONE ? 1 : b.s === NONE ? -1 : a.s.localeCompare(b.s, 'el')));
    const items: Choice[] = rows.map(({ r, s }) => {
      const have = known(r);
      const badge = !r.id ? 'αρχείο' : !have ? 'δεν είναι εδώ' : r.updated > have.updated ? 'νεότερο στο Drive' : r.updated < have.updated ? 'νεότερο εδώ' : 'ίδιο με εδώ';
      return { key: r.fileId, title: r.name, sub: when(r.updated), badge, badgeGo: !!r.id && (!have || r.updated > have.updated), section: s };
    });
    const newer = list.filter((r) => r.id && !this.safe.gone.includes(r.id) && r.updated > (known(r)?.updated ?? 0)).length;
    const pick = await chooseBox('Άνοιγμα από το Google Drive', items, {
      hint: 'Τα μαθήματα που έχεις αποθηκεύσει στο Google Drive σου, από όλες τις συσκευές. Στο Drive είναι στον φάκελο PrismaBoard, με έναν υποφάκελο για κάθε τμήμα.',
      empty: 'Δεν υπάρχουν ακόμα μαθήματα στο Drive. Αποθήκευσε ένα από ☰ → «Αποθήκευση…» → «Στο Google Drive».',
      extra: newer > 1 ? [{ key: '*', label: `Φέρε όλα τα νεότερα (${newer})` }] : [],
    });
    if (!pick) return;
    if (pick === '*') return this.cloudRestore();
    const r = list.find((x) => x.fileId === pick);
    if (!r) return;
    this.host.toast(`Κατεβαίνει το «${r.name}»…`, 0);
    try {
      await this.openJson(await readBackup(r.fileId), r.name, r);
    } catch (err) {
      console.error(err);
      this.host.toast(`Το «${r.name}» δεν άνοιξε: ${err instanceof Error ? err.message : err}`, 8000);
    }
  }

  /**
   * Ανοίγει ένα αρχείο .json (από τη συσκευή ή από το Drive, `remote`):
   * - ένα μάθημα: αν υπάρχει ήδη εδώ, ανοίγει αυτό (με τις αλλαγές του αρχείου, αν είναι νεότερο), αλλιώς μπαίνει ως νέο·
   * - αντίγραφο πολλών μαθημάτων: επαναφορά όλων·
   * - σκέτος πίνακας (παλιότερες εκδόσεις): νέο μάθημα.
   */
  async openJson(text: string, name: string, remote?: RemoteLesson): Promise<void> {
    const data = JSON.parse(text) as Partial<Backup> & Partial<Doc>;
    const src = remote ? 'το Drive' : 'το αρχείο';
    if (data.grafida === 'backup' && Array.isArray(data.lessons)) {
      if (data.lessons.length !== 1 || data.rosters || data.spellLists) return this.restoreAll(data);
      const { meta, doc } = data.lessons[0];
      if (!meta?.id) throw new Error('άγνωστη μορφή');
      await this.flush(false);
      const was = this.index.find((m) => m.id === meta.id)?.updated ?? 0;
      this.safe.gone = this.safe.gone.filter((g) => g !== meta.id);
      const r = await this.put(meta, doc);
      if (!this.index.some((m) => m.id === meta.id)) throw new Error('το μάθημα δεν διαβάζεται');
      // από το Drive και ίδιο πια με εκεί: ☁ ✓
      if (remote && (r || was === meta.updated)) this.safe.ids[meta.id] = meta.updated;
      this.saveSafe();
      await kvSet(INDEX, this.index);
      if (meta.id !== this.cur) await this.show(meta.id);
      this.close();
      this.renderLabel();
      const nm = this.current?.name ?? name;
      if (r === 'upd') this.host.toast(`Άνοιξε το «${nm}», με τις αλλαγές από ${src}`, 6000);
      else if (!r && was > meta.updated) {
        this.host.toast(`Άνοιξε το «${nm}» όπως είναι σε αυτή τη συσκευή: είναι νεότερο από ${src}`, 10000, {
          label: 'Άνοιγμα του παλιότερου ως αντίγραφο',
          run: () => void this.createFrom(readDoc(doc), `${meta.name} (από ${remote ? 'Drive' : 'αρχείο'})`.slice(0, 60), meta.group),
        });
      } else this.host.toast(`Άνοιξε το «${nm}»`);
      return;
    }
    if (typeof data.v === 'number' && Array.isArray(data.pages)) {
      await this.createFrom(readDoc(data), name.replace(/\.json$/i, '').slice(0, 60));
      this.close();
      return this.host.toast('Το αρχείο άνοιξε ως νέο μάθημα');
    }
    throw new Error('άγνωστη μορφή');
  }


  private saveSafe(): void {
    try {
      localStorage.setItem(SAFE, JSON.stringify(this.safe));
    } catch {
      /* χωρίς αποθήκευση */
    }
  }

  /** Μαθήματα που άλλαξαν μετά το τελευταίο τους αντίγραφο στο Drive. */
  private get pending(): LessonMeta[] {
    return this.index.filter((m) => m.updated > (this.safe.ids[m.id] ?? 0));
  }

  /** Υπάρχουν αλλαγές χωρίς αντίγραφο εδώ και μέρες. */
  private get overdue(): boolean {
    return !!driveClientId() && Date.now() - this.safe.at > REMIND_DAYS * DAY && this.pending.length > 0;
  }

  private renderSafe(): void {
    const box = this.el.querySelector<HTMLElement>('#libSafe')!;
    box.classList.toggle('hidden', !driveClientId());
    const n = this.pending.length;
    const days = Math.floor((Date.now() - this.safe.at) / DAY);
    const when = days === 0 ? 'σήμερα' : days === 1 ? 'χθες' : `πριν από ${days} μέρες`;
    const msg = !this.safe.done
      ? 'Τα μαθήματα υπάρχουν μόνο σε αυτή τη συσκευή. Κράτα αντίγραφο στο Google Drive σου.'
      : n === 0
        ? `Όλα τα μαθήματα έχουν αντίγραφο στο Drive (τελευταίο: ${when}).`
        : `${n === 1 ? '1 μάθημα άλλαξε' : `${n} μαθήματα άλλαξαν`} μετά το τελευταίο αντίγραφο (${when}).`;
    box.querySelector('#libSafeMsg')!.textContent = msg;
    box.classList.toggle('warn', this.overdue || !this.safe.done);
    box.querySelector<HTMLElement>('[data-lib="cloud"]')!.classList.toggle('go', n > 0);
  }

  /**
   * Ανεβάζει στο Drive όσα μαθήματα άλλαξαν. `quiet`: χωρίς μηνύματα και μόνο αν υπάρχει ήδη σύνδεση
   * (π.χ. αμέσως μετά από αποστολή στους μαθητές).
   */
  async cloudBackup(quiet = false): Promise<void> {
    if (this.busy || !driveClientId() || (quiet && !driveReady())) return;
    this.busy = true;
    try {
      // η σύνδεση πρώτα, όσο «μετράει» ακόμα το πάτημα του κουμπιού
      if (!quiet) await driveConnect();
      await this.flush(false);
      const todo = this.pending;
      const gone = this.safe.gone;
      if (todo.length === 0 && gone.length === 0) {
        if (!quiet) this.host.toast('Όλα τα μαθήματα έχουν ήδη αντίγραφο στο Drive');
        return;
      }
      const remote = await listLessonBackups();
      let done = 0;
      for (const meta of todo) {
        if (!quiet) this.host.toast(`Αντίγραφο στο Drive… ${done + 1} από ${todo.length}`, 0);
        await this.uploadOne(meta, remote.find((r) => r.id === meta.id) ?? null).catch((err) => {
          // μάθημα που δεν διαβάζεται από τη συσκευή: το προσπερνάμε
          if (!/δεν διαβάστηκε/.test(String(err))) throw err;
        });
        done++;
      }
      for (const id of gone.slice()) {
        const r = remote.find((x) => x.id === id);
        if (r) await trashBackup(r.fileId).catch(() => undefined);
        delete this.safe.ids[id];
      }
      this.safe.at = Date.now();
      this.safe.done = true;
      this.saveSafe();
      if (!quiet) this.host.toast(done === 1 ? 'Ανέβηκε αντίγραφο 1 μαθήματος στο Drive' : `Ανέβηκαν αντίγραφα ${done} μαθημάτων στο Drive`, 5000);
    } catch (err) {
      console.error(err);
      if (!quiet) this.host.toast(`Το αντίγραφο δεν ολοκληρώθηκε: ${err instanceof Error ? err.message : err}`, 8000);
    } finally {
      this.busy = false;
      this.renderLabel();
      if (!this.el.classList.contains('hidden')) this.renderSafe();
    }
  }

  /** Φέρνει από το Drive όσα μαθήματα λείπουν από τη συσκευή ή είναι νεότερα εκεί. */
  private async cloudRestore(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await driveConnect();
      await this.flush(false);
      const remote = (await listLessonBackups()).filter((r) => !this.safe.gone.includes(r.id));
      const want = remote.filter((r) => r.updated > (this.index.find((m) => m.id === r.id)?.updated ?? 0));
      if (want.length === 0) {
        this.host.toast(remote.length ? 'Η συσκευή έχει ήδη ό,τι υπάρχει στο Drive' : 'Δεν βρέθηκαν αντίγραφα μαθημάτων στο Drive', 5000);
        return;
      }
      let got = 0;
      for (const r of want) {
        this.host.toast(`Κατεβαίνει από το Drive… ${got + 1} από ${want.length}`, 0);
        const data = JSON.parse(await readBackup(r.fileId)) as Partial<Backup>;
        for (const l of data.lessons ?? []) {
          if (await this.put(l.meta, l.doc)) {
            this.safe.ids[l.meta.id] = l.meta.updated;
            got++;
          }
        }
      }
      this.saveSafe();
      await kvSet(INDEX, this.index);
      this.render();
      this.host.toast(got === 1 ? 'Ήρθε 1 μάθημα από το Drive' : `Ήρθαν ${got} μαθήματα από το Drive`, 5000);
    } catch (err) {
      console.error(err);
      this.host.toast(`Δεν ολοκληρώθηκε: ${err instanceof Error ? err.message : err}`, 8000);
    } finally {
      this.busy = false;
      this.renderSafe();
    }
  }

  /**
   * Βάζει στη συσκευή ένα μάθημα από αντίγραφο, αν λείπει ή αν το αντίγραφο είναι νεότερο.
   * Επιστρέφει 'new', 'upd', ή null αν έμεινε όπως ήταν. Το ευρετήριο το γράφει όποιος την καλεί.
   */
  private async put(meta: LessonMeta, doc: Doc): Promise<'new' | 'upd' | null> {
    if (!meta?.id) return null;
    try {
      doc = readDoc(doc);
    } catch {
      return null;
    }
    const have = this.index.find((m) => m.id === meta.id);
    if (have && have.updated >= meta.updated) return null;
    await saveLesson(meta.id, doc);
    if (have) Object.assign(have, { ...meta, thumb: meta.thumb ?? have.thumb });
    else this.index.push(meta);
    // το ανοιχτό μάθημα ξαναφορτώνεται για να φανεί η νεότερη μορφή του
    if (meta.id === this.cur) await this.show(meta.id);
    return have ? 'upd' : 'new';
  }

  async open(): Promise<void> {
    await this.flush(true);
    const meta = this.current;
    if (meta && !meta.thumb) {
      meta.thumb = await this.host.thumb().catch(() => undefined);
      await kvSet(INDEX, this.index);
    }
    this.render();
    this.renderSafe();
    this.el.classList.remove('hidden');
  }

  private close(): void {
    this.el.classList.add('hidden');
  }

  /** Κλείνει τη βιβλιοθήκη και το «Τι κάνουμε σήμερα;» (πλήκτρο Esc). */
  dismiss(): void {
    this.close();
    this.startEl.classList.add('hidden');
  }

  private get groups(): string[] {
    return [...new Set(this.index.map((m) => m.group).filter((g): g is string => !!g))].sort((a, b) => a.localeCompare(b, 'el'));
  }

  private setFilter(g: string): void {
    this.filter = g;
    try { localStorage.setItem(GROUP, g); } catch { /* χωρίς αποθήκευση */ }
  }

  private render(): void {
    const groups = this.groups;
    if (this.filter && !groups.includes(this.filter)) this.setFilter('');
    const bar = this.el.querySelector<HTMLElement>('#libGroups')!;
    bar.classList.toggle('hidden', groups.length === 0);
    bar.innerHTML = `<span>Τμήμα</span>` + ['', ...groups]
      .map((g) => `<button data-group="${esc(g)}" class="${g === this.filter ? 'on' : ''}">${g ? esc(g) : 'Όλα'} <small>${this.index.filter((m) => !g || m.group === g).length}</small></button>`)
      .join('');
    if (this.filter) {
      const n = this.rosters[this.filter]?.length ?? 0;
      bar.innerHTML += `<button data-lib="roster" class="roster" title="Τα ονόματα των μαθητών του τμήματος, για την Κλήρωση">${n ? `Μαθητές του ${esc(this.filter)} <small>${n}</small>` : `＋ Μαθητές του ${esc(this.filter)}`}</button>`;
    }
    const list = [...this.index].filter((m) => !this.filter || m.group === this.filter).sort((a, b) => b.updated - a.updated);
    this.el.querySelector('#libGrid')!.innerHTML = list
      .map((m) => {
        const d = new Date(m.updated);
        const when = `${d.toLocaleDateString('el')} ${d.toLocaleTimeString('el', { hour: '2-digit', minute: '2-digit' })}`;
        return `<div class="card${m.id === this.cur ? ' on' : ''}" data-id="${m.id}">
          <div class="th">${m.thumb ? `<img src="${m.thumb}" alt="" />` : ''}</div>
          <div class="nm">${m.group ? `<span class="grp">${esc(m.group)}</span>` : ''}${esc(m.name)}</div>
          <div class="info">${when} · ${m.pages} ${m.pages === 1 ? 'σελίδα' : 'σελίδες'}${this.cloud(m) ? ` · <span class="cl ${this.cloud(m)}">${CLOUD[this.cloud(m)]}</span>` : ''}</div>
          <div class="acts">
            <button data-card="rename">Όνομα</button>
            <button data-card="group">Τμήμα</button>
            <button data-card="copy">Αντίγραφο</button>
            <button data-card="file">Αρχείο</button>
            <button data-card="del" class="danger">Διαγραφή</button>
          </div>
        </div>`;
      })
      .join('');
  }

  private async click(e: Event): Promise<void> {
    const t = e.target as HTMLElement;
    const top = t.closest<HTMLElement>('[data-lib]')?.dataset.lib;
    if (top === 'close') return this.close();
    if (top === 'new') {
      const name = (await ask('Όνομα νέου μαθήματος', { value: this.defaultName(), hint: 'π.χ. Β2 Τριγωνομετρία' }))?.trim();
      if (!name) return;
      const meta = await this.add(newDoc(), name.slice(0, 60));
      // μέσα σε τμήμα, το νέο μάθημα ανήκει σε αυτό
      if (this.filter) {
        meta.group = this.filter;
        await kvSet(INDEX, this.index);
      }
      await this.show(meta.id);
      return this.close();
    }
    if (top === 'roster') {
      if (this.filter) await this.editRoster(this.filter);
      return this.render();
    }
    const grp = t.closest<HTMLElement>('[data-group]');
    if (grp) {
      this.setFilter(grp.dataset.group ?? '');
      return this.render();
    }
    if (top === 'backup') return void this.backup();
    if (top === 'cloud') return void this.cloudBackup();
    if (top === 'cloudGet') return void this.openFromDrive();
    if (top === 'restore') return this.el.querySelector<HTMLInputElement>('#libFile')!.click();

    const card = t.closest<HTMLElement>('.card');
    const meta = card && this.index.find((m) => m.id === card.dataset.id);
    if (!meta) return;
    const act = t.closest<HTMLElement>('[data-card]')?.dataset.card;
    if (!act) {
      if (meta.id !== this.cur) await this.show(meta.id);
      return this.close();
    }
    if (act === 'rename') {
      await this.rename(meta);
    } else if (act === 'group') {
      const have = this.groups;
      const g = await ask('Τμήμα ή τάξη του μαθήματος', { value: meta.group ?? this.filter, hint: 'π.χ. Β2. Άφησέ το κενό για κανένα.', picks: have, max: 20 });
      if (g === null) return;
      meta.group = g.trim().slice(0, 20) || undefined;
      meta.updated = Date.now();
      await kvSet(INDEX, this.index);
    } else if (act === 'copy') {
      const doc = await loadLesson(meta.id);
      if (doc) Object.assign(await this.add(doc, `${meta.name} (αντίγραφο)`), { thumb: meta.thumb, group: meta.group });
      await kvSet(INDEX, this.index);
    } else if (act === 'file') {
      await this.exportFile(meta);
    } else if (act === 'del') {
      if (!(await confirmBox(`Να διαγραφεί το μάθημα «${meta.name}»;`, 'Διαγραφή', true, 'Δεν αναιρείται.'))) return;
      this.index = this.index.filter((m) => m.id !== meta.id);
      await deleteLesson(meta.id);
      // αν έχει αντίγραφο στο Drive, θα πάει στον κάδο του στο επόμενο αντίγραφο και δεν θα ξαναέρθει από εκεί
      if (meta.id in this.safe.ids) this.safe.gone.push(meta.id);
      this.saveSafe();
      if (this.index.length === 0) await this.add(newDoc(), this.defaultName());
      await kvSet(INDEX, this.index);
      if (meta.id === this.cur) await this.show(this.index[0].id);
    }
    this.render();
    // το τμήμα του ανοιχτού μαθήματος μπορεί να άλλαξε: η κλήρωση δείχνει άλλα ονόματα
    this.host.redraw();
  }

  /**
   * Μία φορά την εβδομάδα, αν υπάρχουν μαθήματα που άλλαξαν μετά το τελευταίο αντίγραφο (Drive ή αρχείο),
   * ένα μήνυμα με κουμπί που το κάνει με ένα πάτημα. Τα μαθήματα αλλιώς ζουν μόνο σε αυτή τη συσκευή.
   */
  remind(): void {
    const last = Math.max(this.safe.done ? this.safe.at : 0, this.safe.file ?? 0);
    const first = this.safe.done || this.safe.file ? 0 : this.safe.at;
    const since = Math.max(last, first);
    if (Date.now() - since < REMIND_DAYS * DAY || Date.now() - (this.safe.told ?? 0) < REMIND_DAYS * DAY) return;
    if (!this.index.some((m) => m.updated > last)) return;
    this.safe.told = Date.now();
    this.saveSafe();
    const days = last ? Math.floor((Date.now() - last) / DAY) : 0;
    const msg = last ? `Τελευταίο αντίγραφο των μαθημάτων πριν από ${days} μέρες` : 'Τα μαθήματα υπάρχουν μόνο σε αυτή τη συσκευή';
    if (driveClientId()) this.host.toast(msg, 15000, { label: '☁ Αντίγραφο στο Drive', run: () => void this.cloudBackup() });
    else this.host.toast(msg, 15000, { label: 'Αντίγραφο σε αρχείο', run: () => void this.backup() });
  }

  private async backup(): Promise<void> {
    const out: Backup = { grafida: 'backup', v: 1, lessons: [], rosters: this.rosters, spellLists: await loadLists() };
    for (const meta of this.index) {
      const doc = await loadLesson(meta.id);
      if (doc) out.lessons.push({ meta, doc });
    }
    const d = new Date();
    const p = (n: number): string => String(n).padStart(2, '0');
    this.host.download(new Blob([JSON.stringify(out)], { type: 'application/json' }), `mathimata_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`);
    this.safe.file = Date.now();
    this.saveSafe();
  }

  /** Φέρνει μαθήματα από αρχείο αντιγράφου: όσα υπάρχουν ήδη αντικαθίστανται μόνο αν το αντίγραφο είναι νεότερο. */
  private async restore(f: File): Promise<void> {
    try {
      await this.openJson(await f.text(), f.name);
    } catch (err) {
      this.host.toast(`Το αρχείο δεν είναι μάθημα ή αντίγραφο μαθημάτων (${err instanceof Error ? err.message : err})`, 6000);
    }
  }

  /** Επαναφορά από αντίγραφο πολλών μαθημάτων: μπαίνουν όσα λείπουν και όσα είναι νεότερα στο αντίγραφο. */
  private async restoreAll(data: Partial<Backup>): Promise<void> {
    let added = 0, updated = 0, skipped = 0;
    for (const { meta, doc } of data.lessons ?? []) {
      const r = await this.put(meta, doc);
      if (r === 'new') added++; else if (r === 'upd') updated++; else skipped++;
    }
    await kvSet(INDEX, this.index);
    // λίστες μαθητών: μπαίνουν μόνο για τμήματα που δεν έχουν ήδη λίστα εδώ
    let lists = 0;
    for (const [g, names] of Object.entries(data.rosters ?? {})) {
      if (this.rosters[g]?.length || !Array.isArray(names)) continue;
      this.rosters[g] = names.filter((n) => typeof n === 'string').slice(0, 60);
      lists++;
    }
    if (lists) await kvSet(ROSTERS, this.rosters);
    // λίστες λέξεων: μπαίνουν όσες δεν υπάρχουν ήδη εδώ με το ίδιο όνομα
    if (Array.isArray(data.spellLists)) await mergeLists(data.spellLists, false);
    this.render();
    this.host.redraw();
    this.host.toast(`Επαναφορά: ${added} νέα, ${updated} ενημερώθηκαν, ${skipped} έμειναν όπως ήταν`, 6000);
  }
}

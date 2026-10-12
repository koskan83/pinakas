/** Βιβλιοθήκη μαθημάτων: κάθε μάθημα είναι ένας πίνακας που σώζεται χωριστά στη συσκευή. */

import { Doc, newDoc, uid } from './model';
import { backupLesson, driveClientId, driveConnect, driveReady, listLessonBackups, readBackup, trashBackup } from './drive';
import { kvDel, kvGet, kvSet, loadDoc } from './storage';
import { ask, confirmBox } from './dialog';

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
}

const INDEX = 'lessons';
const CURRENT = 'lesson.current';
const key = (id: string): string => `lesson:${id}`;

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
}
const SAFE = 'grafida.safe';
const GROUP = 'grafida.group';
const DAY = 86400000;
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
  download(blob: Blob, name: string): void;
  toast(msg: string, ms?: number): void;
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

  constructor(private host: LessonHost, parent: HTMLElement) {
    parent.insertAdjacentHTML(
      'beforeend',
      `<button id="lessonName" class="fab hidden" title="Μετονομασία μαθήματος"><i id="libOpen" title="Μαθήματα"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z"/></svg></i><span></span></button>
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
          <button data-lib="cloud" class="go" title="Ανεβάζει στο δικό σου Google Drive όσα μαθήματα άλλαξαν">☁ Αντίγραφο στο Drive</button>
          <button data-lib="cloudGet" title="Φέρνει από το Google Drive μαθήματα που λείπουν ή είναι νεότερα εκεί">☁ Φέρε από το Drive</button>
        </div>
        <div id="libGroups"></div>
        <div id="libGrid"></div>
        <input id="libFile" type="file" accept=".json,application/json" hidden />
      </div>`,
    );
    this.el = parent.querySelector<HTMLElement>('#lib')!;
    this.label = parent.querySelector<HTMLElement>('#lessonName')!;
    // το εικονίδιο ανοίγει τα μαθήματα· το ίδιο το όνομα μετονομάζει το ανοιχτό μάθημα
    this.label.onclick = (e) => void ((e.target as HTMLElement).closest('#libOpen') ? this.open() : this.rename(this.current));
    this.el.addEventListener('click', (e) => void this.click(e));
    const file = this.el.querySelector<HTMLInputElement>('#libFile')!;
    file.onchange = () => {
      const f = file.files?.[0];
      file.value = '';
      if (f) void this.restore(f);
    };
    // το κλείσιμο της καρτέλας δεν περιμένει το χρονόμετρο της αυτόματης αποθήκευσης
    window.addEventListener('pagehide', () => void this.flush(false));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void this.flush(false);
    });
  }

  /** «Μάθημα 14/10/2026», με αρίθμηση αν υπάρχει ήδη. */
  private defaultName(): string {
    const base = `Μάθημα ${new Date().toLocaleDateString('el')}`;
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
    if (this.index.length === 0) {
      // πρώτη φορά: ο πίνακας της παλιάς έκδοσης γίνεται το πρώτο μάθημα
      const old = await loadDoc();
      await this.add(old ?? newDoc(), this.defaultName());
    }
    const want = await kvGet<string>(CURRENT);
    const meta = this.index.find((m) => m.id === want) ?? this.index[0];
    await this.show(meta.id);
  }

  /** Καλείται σε κάθε αλλαγή του πίνακα: αποθηκεύει λίγο αργότερα. */
  touch(): void {
    if (this.loading || !this.cur) return;
    this.dirty = true;
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.flush(Date.now() - this.thumbAt > 20000), 1500);
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
    await kvSet(key(meta.id), doc);
    if (withThumb) {
      this.thumbAt = Date.now();
      meta.thumb = (await this.host.thumb().catch(() => undefined)) ?? meta.thumb;
    }
    await kvSet(INDEX, this.index);
    this.renderLabel();
  }

  /** Νέο μάθημα από έτοιμο πίνακα (π.χ. αρχείο που άνοιξε ο χρήστης) και άνοιγμά του. */
  async createFrom(doc: Doc, name: string): Promise<void> {
    await this.flush(true);
    const meta = await this.add(doc, name);
    await this.show(meta.id);
  }

  private async add(doc: Doc, name: string): Promise<LessonMeta> {
    const meta: LessonMeta = { id: uid(), name, updated: Date.now(), pages: doc.pages.length };
    this.index.unshift(meta);
    await kvSet(key(meta.id), doc);
    await kvSet(INDEX, this.index);
    return meta;
  }

  private async show(id: string): Promise<void> {
    const doc = (await kvGet<Doc>(key(id))) ?? newDoc();
    this.cur = id;
    this.loading = true;
    try {
      this.host.setDoc(doc);
    } catch {
      this.host.setDoc(newDoc());
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
    const name = this.current?.name ?? '';
    this.label.querySelector('span')!.textContent = name;
    this.label.classList.toggle('hidden', !name);
    this.label.classList.toggle('warn', this.overdue);
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
        const doc = await kvGet<Doc>(key(meta.id));
        if (!doc) continue;
        const { thumb: _thumb, ...slim } = meta;
        const out: Backup = { grafida: 'backup', v: 1, lessons: [{ meta: slim, doc }] };
        await backupLesson(meta.id, meta.name.replace(/[\\/:*?"<>|]/g, '_'), meta.updated, new Blob([JSON.stringify(out)], { type: 'application/json' }), remote.find((r) => r.id === meta.id)?.fileId);
        this.safe.ids[meta.id] = meta.updated;
        this.saveSafe();
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
    if (!meta?.id || doc?.v !== 1 || !Array.isArray(doc.pages)) return null;
    const have = this.index.find((m) => m.id === meta.id);
    if (have && have.updated >= meta.updated) return null;
    await kvSet(key(meta.id), doc);
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
    const list = [...this.index].filter((m) => !this.filter || m.group === this.filter).sort((a, b) => b.updated - a.updated);
    this.el.querySelector('#libGrid')!.innerHTML = list
      .map((m) => {
        const d = new Date(m.updated);
        const when = `${d.toLocaleDateString('el')} ${d.toLocaleTimeString('el', { hour: '2-digit', minute: '2-digit' })}`;
        return `<div class="card${m.id === this.cur ? ' on' : ''}" data-id="${m.id}">
          <div class="th">${m.thumb ? `<img src="${m.thumb}" alt="" />` : ''}</div>
          <div class="nm">${m.group ? `<span class="grp">${esc(m.group)}</span>` : ''}${esc(m.name)}</div>
          <div class="info">${when} · ${m.pages} ${m.pages === 1 ? 'σελίδα' : 'σελίδες'}</div>
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
    const grp = t.closest<HTMLElement>('[data-group]');
    if (grp) {
      this.setFilter(grp.dataset.group ?? '');
      return this.render();
    }
    if (top === 'backup') return void this.backup();
    if (top === 'cloud') return void this.cloudBackup();
    if (top === 'cloudGet') return void this.cloudRestore();
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
      const doc = await kvGet<Doc>(key(meta.id));
      if (doc) Object.assign(await this.add(doc, `${meta.name} (αντίγραφο)`), { thumb: meta.thumb, group: meta.group });
      await kvSet(INDEX, this.index);
    } else if (act === 'file') {
      const doc = await kvGet<Doc>(key(meta.id));
      if (doc) this.host.download(new Blob([JSON.stringify(doc)], { type: 'application/json' }), `${meta.name.replace(/[\\/:*?"<>|]/g, '_')}.json`);
    } else if (act === 'del') {
      if (!(await confirmBox(`Να διαγραφεί το μάθημα «${meta.name}»;`, 'Διαγραφή', true, 'Δεν αναιρείται.'))) return;
      this.index = this.index.filter((m) => m.id !== meta.id);
      await kvDel(key(meta.id));
      // αν έχει αντίγραφο στο Drive, θα πάει στον κάδο του στο επόμενο αντίγραφο και δεν θα ξαναέρθει από εκεί
      if (meta.id in this.safe.ids) this.safe.gone.push(meta.id);
      this.saveSafe();
      if (this.index.length === 0) await this.add(newDoc(), this.defaultName());
      await kvSet(INDEX, this.index);
      if (meta.id === this.cur) await this.show(this.index[0].id);
    }
    this.render();
  }

  private async backup(): Promise<void> {
    const out: Backup = { grafida: 'backup', v: 1, lessons: [] };
    for (const meta of this.index) {
      const doc = await kvGet<Doc>(key(meta.id));
      if (doc) out.lessons.push({ meta, doc });
    }
    const d = new Date();
    const p = (n: number): string => String(n).padStart(2, '0');
    this.host.download(new Blob([JSON.stringify(out)], { type: 'application/json' }), `mathimata_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`);
  }

  /** Φέρνει μαθήματα από αρχείο αντιγράφου: όσα υπάρχουν ήδη αντικαθίστανται μόνο αν το αντίγραφο είναι νεότερο. */
  private async restore(f: File): Promise<void> {
    try {
      const data = JSON.parse(await f.text()) as Partial<Backup> & Partial<Doc>;
      if (data.grafida !== 'backup' || !Array.isArray(data.lessons)) {
        // σκέτο αρχείο πίνακα: μπαίνει ως νέο μάθημα
        if (data.v === 1 && Array.isArray(data.pages)) {
          await this.add(data as Doc, f.name.replace(/\.json$/i, ''));
          this.render();
          return this.host.toast('Το αρχείο μπήκε ως νέο μάθημα');
        }
        throw new Error('άγνωστη μορφή');
      }
      let added = 0, updated = 0, skipped = 0;
      for (const { meta, doc } of data.lessons) {
        const r = await this.put(meta, doc);
        if (r === 'new') added++; else if (r === 'upd') updated++; else skipped++;
      }
      await kvSet(INDEX, this.index);
      this.render();
      this.host.toast(`Επαναφορά: ${added} νέα, ${updated} ενημερώθηκαν, ${skipped} έμειναν όπως ήταν`, 6000);
    } catch (err) {
      this.host.toast(`Το αρχείο δεν είναι αντίγραφο μαθημάτων (${err instanceof Error ? err.message : err})`, 6000);
    }
  }
}

/** Βιβλιοθήκη μαθημάτων: κάθε μάθημα είναι ένας πίνακας που σώζεται χωριστά στη συσκευή. */

import { Doc, newDoc, uid } from './model';
import { kvDel, kvGet, kvSet, loadDoc } from './storage';

export interface LessonMeta {
  id: string;
  name: string;
  /** Τελευταία αλλαγή (ms). */
  updated: number;
  pages: number;
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

  constructor(private host: LessonHost, parent: HTMLElement) {
    parent.insertAdjacentHTML(
      'beforeend',
      `<button id="lessonName" class="fab" title="Μαθήματα"></button>
      <div id="lib" class="hidden">
        <div id="libHead">
          <img class="lg onDark" src="./logo-light.svg" alt="" /><img class="lg onLight" src="./logo.svg" alt="" />
          <b>Μαθήματα</b>
          <button data-lib="new" class="go">＋ Νέο μάθημα</button>
          <span class="sp"></span>
          <button data-lib="backup" title="Κατεβάζει όλα τα μαθήματα σε ένα αρχείο">Αντίγραφο ασφαλείας</button>
          <button data-lib="restore" title="Φέρνει πίσω μαθήματα από αρχείο αντιγράφου">Επαναφορά</button>
          <button data-lib="close" title="Κλείσιμο">✕</button>
        </div>
        <div id="libGrid"></div>
        <input id="libFile" type="file" accept=".json,application/json" hidden />
      </div>`,
    );
    this.el = parent.querySelector<HTMLElement>('#lib')!;
    this.label = parent.querySelector<HTMLElement>('#lessonName')!;
    this.label.onclick = () => void this.open();
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

  private renderLabel(): void {
    this.label.textContent = this.current?.name ?? '';
  }

  async open(): Promise<void> {
    await this.flush(true);
    const meta = this.current;
    if (meta && !meta.thumb) {
      meta.thumb = await this.host.thumb().catch(() => undefined);
      await kvSet(INDEX, this.index);
    }
    this.render();
    this.el.classList.remove('hidden');
  }

  private close(): void {
    this.el.classList.add('hidden');
  }

  private render(): void {
    const list = [...this.index].sort((a, b) => b.updated - a.updated);
    this.el.querySelector('#libGrid')!.innerHTML = list
      .map((m) => {
        const d = new Date(m.updated);
        const when = `${d.toLocaleDateString('el')} ${d.toLocaleTimeString('el', { hour: '2-digit', minute: '2-digit' })}`;
        return `<div class="card${m.id === this.cur ? ' on' : ''}" data-id="${m.id}">
          <div class="th">${m.thumb ? `<img src="${m.thumb}" alt="" />` : ''}</div>
          <div class="nm">${esc(m.name)}</div>
          <div class="info">${when} · ${m.pages} ${m.pages === 1 ? 'σελίδα' : 'σελίδες'}</div>
          <div class="acts">
            <button data-card="rename">Όνομα</button>
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
      const name = prompt('Όνομα μαθήματος (π.χ. Β2 Τριγωνομετρία)', this.defaultName())?.trim();
      if (!name) return;
      const meta = await this.add(newDoc(), name.slice(0, 60));
      await this.show(meta.id);
      return this.close();
    }
    if (top === 'backup') return void this.backup();
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
      const name = prompt('Όνομα μαθήματος', meta.name)?.trim();
      if (!name) return;
      meta.name = name.slice(0, 60);
      await kvSet(INDEX, this.index);
      this.renderLabel();
    } else if (act === 'copy') {
      const doc = await kvGet<Doc>(key(meta.id));
      if (doc) (await this.add(doc, `${meta.name} (αντίγραφο)`)).thumb = meta.thumb;
      await kvSet(INDEX, this.index);
    } else if (act === 'file') {
      const doc = await kvGet<Doc>(key(meta.id));
      if (doc) this.host.download(new Blob([JSON.stringify(doc)], { type: 'application/json' }), `${meta.name.replace(/[\\/:*?"<>|]/g, '_')}.json`);
    } else if (act === 'del') {
      if (!confirm(`Να διαγραφεί το μάθημα «${meta.name}»; Δεν αναιρείται.`)) return;
      this.index = this.index.filter((m) => m.id !== meta.id);
      await kvDel(key(meta.id));
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
        if (!meta?.id || doc?.v !== 1 || !Array.isArray(doc.pages)) continue;
        const have = this.index.find((m) => m.id === meta.id);
        if (have && have.updated >= meta.updated) { skipped++; continue; }
        if (have && have.id === this.cur) { skipped++; continue; }
        if (have) { Object.assign(have, meta); updated++; } else { this.index.push(meta); added++; }
        await kvSet(key(meta.id), doc);
      }
      await kvSet(INDEX, this.index);
      this.render();
      this.host.toast(`Επαναφορά: ${added} νέα, ${updated} ενημερώθηκαν, ${skipped} έμειναν όπως ήταν`, 6000);
    } catch (err) {
      this.host.toast(`Το αρχείο δεν είναι αντίγραφο μαθημάτων (${err instanceof Error ? err.message : err})`, 6000);
    }
  }
}

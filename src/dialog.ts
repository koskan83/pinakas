/**
 * Μεγάλα παράθυρα ερώτησης της ίδιας της εφαρμογής, αντί για τα μικρά `prompt` / `confirm` του browser:
 * διαβάζονται από μακριά, πατιούνται με το δάχτυλο και δεν βγάζουν τον πίνακα από την πλήρη οθόνη.
 */

export interface AskOptions {
  /** Αρχική τιμή του πεδίου. */
  value?: string;
  /** Μικρή επεξήγηση κάτω από τον τίτλο. */
  hint?: string;
  /** Ό,τι γράφεται φαίνεται ως κουκκίδες (π.χ. η λέξη της κρεμάλας). */
  secret?: boolean;
  max?: number;
  /** Υπαγόρευση: 🎤 δίπλα στο πεδίο, που προσθέτει ό,τι πει ο χρήστης σε αυτή τη γλώσσα (π.χ. 'el-GR'), χωρισμένο με κόμμα από τα προηγούμενα. */
  voice?: string;
  /** Έτοιμες τιμές που μπαίνουν με ένα πάτημα. */
  picks?: string[];
  ok?: string;
}

let open: (() => void) | null = null;

/** Όσα χρειαζόμαστε από την αναγνώριση ομιλίας του browser (υπάρχει σε Chrome και Edge). */
interface SpeechRec {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

function shell(title: string, hint: string | undefined): { back: HTMLDivElement; box: HTMLDivElement } {
  open?.();
  const back = document.createElement('div');
  back.id = 'ask';
  const box = document.createElement('div');
  box.className = 'askBox';
  const b = document.createElement('b');
  b.textContent = title;
  box.append(b);
  if (hint) {
    const s = document.createElement('small');
    s.textContent = hint;
    box.append(s);
  }
  back.append(box);
  document.body.append(back);
  return { back, box };
}

function button(label: string, cls: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.className = cls;
  return b;
}

interface Mic { btn: HTMLButtonElement; note: HTMLElement; abort(): void }

/** Κουμπί 🎤 για υπαγόρευση: κάθε φορά που μιλά ο χρήστης, το `add` παίρνει ό,τι είπε και λέει πόσα έχουν μπει ως τώρα. */
function micButton(lang: string, add: (said: string) => number): Mic {
  let rec: SpeechRec | null = null;
  const SR = (window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec });
  const Rec = SR.SpeechRecognition ?? SR.webkitSpeechRecognition;
  const btn = button('🎤', 'eye mic'), note = document.createElement('small');
  btn.title = 'Πες τη λέξη ή την πρόταση';
  btn.onclick = () => {
    if (rec) return rec.stop();
    if (!Rec) {
      note.textContent = 'Η υπαγόρευση δεν υποστηρίζεται εδώ: θέλει Chrome ή Edge και ίντερνετ. Γράψε τις λέξεις με το πληκτρολόγιο.';
      return;
    }
    const r = (rec = new Rec());
    r.lang = lang;
    r.interimResults = false;
    r.onresult = (e) => {
      const said = e.results[e.results.length - 1][0].transcript.replace(/[,;.!?·]/g, ' ').replace(/ +/g, ' ').trim();
      if (said) note.textContent = `Μπήκε (${add(said)}). Πάτα ξανά το 🎤 για την επόμενη.`;
    };
    r.onerror = (e) => {
      note.textContent = e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Δεν δόθηκε άδεια για το μικρόφωνο.' : e.error === 'no-speech' ? 'Δεν άκουσα τίποτα. Πάτα το 🎤 και ξαναπές το.' : 'Η υπαγόρευση δεν δούλεψε (θέλει ίντερνετ). Γράψε τις λέξεις με το πληκτρολόγιο.';
    };
    r.onend = () => {
      rec = null;
      btn.classList.remove('on');
    };
    note.textContent = 'Ακούω… πες τη λέξη ή την πρόταση.';
    btn.classList.add('on');
    try { r.start(); } catch { rec = null; btn.classList.remove('on'); }
  };
  return { btn, note, abort: () => rec?.abort() };
}

/** Ζητά ένα κείμενο. null αν ο χρήστης το ακύρωσε. */
export function ask(title: string, o: AskOptions = {}): Promise<string | null> {
  return new Promise((res) => {
    const { back, box } = shell(title, o.hint);
    const row = document.createElement('div');
    row.className = 'askIn';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = o.value ?? '';
    inp.maxLength = o.max ?? 60;
    inp.autocomplete = 'off';
    inp.spellcheck = false;
    inp.enterKeyHint = 'done';
    row.append(inp);
    if (o.secret) {
      inp.classList.add('secret');
      const eye = button('👁', 'eye');
      eye.title = 'Εμφάνιση / απόκρυψη';
      eye.onclick = () => {
        inp.classList.toggle('secret');
        inp.focus();
      };
      row.append(eye);
    }
    box.append(row);
    let mic: Mic | null = null;
    if (o.voice) {
      mic = micButton(o.voice, (said) => {
        inp.value = (inp.value.trim() ? `${inp.value.trim().replace(/,$/, '')}, ${said}` : said).slice(0, inp.maxLength);
        return inp.value.split(',').length;
      });
      row.append(mic.btn);
      box.append(mic.note);
    }
    if (o.picks?.length) {
      const picks = document.createElement('div');
      picks.className = 'askPicks';
      for (const p of o.picks) {
        const b = button(p, '');
        b.onclick = () => {
          inp.value = p;
          inp.focus();
        };
        picks.append(b);
      }
      box.append(picks);
    }
    const acts = document.createElement('div');
    acts.className = 'askActs';
    const no = button('Άκυρο', 'no'), yes = button(o.ok ?? 'Εντάξει', 'go');
    acts.append(no, yes);
    box.append(acts);
    const done = (v: string | null): void => {
      if (open !== cancel) return;
      open = null;
      mic?.abort();
      back.remove();
      res(v);
    };
    const cancel = (): void => done(null);
    open = cancel;
    no.onclick = cancel;
    yes.onclick = () => done(inp.value);
    back.addEventListener('pointerdown', (e) => {
      if (e.target === back) cancel();
    });
    inp.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') done(inp.value);
      else if (e.key === 'Escape') cancel();
    });
    inp.focus();
    inp.select();
  });
}

/** Ζητά κείμενο πολλών γραμμών (π.χ. τα ονόματα ενός τμήματος, ένα σε κάθε γραμμή). null αν ακυρώθηκε. */
export function askLines(title: string, o: { value?: string; hint?: string; ok?: string } = {}): Promise<string | null> {
  return new Promise((res) => {
    const { back, box } = shell(title, o.hint);
    const ta = document.createElement('textarea');
    ta.className = 'askText';
    ta.value = o.value ?? '';
    ta.spellcheck = false;
    ta.rows = 10;
    const acts = document.createElement('div');
    acts.className = 'askActs';
    const no = button('Άκυρο', 'no'), yes = button(o.ok ?? 'Εντάξει', 'go');
    acts.append(no, yes);
    box.append(ta, acts);
    const done = (v: string | null): void => {
      if (open !== cancel) return;
      open = null;
      back.remove();
      res(v);
    };
    const cancel = (): void => done(null);
    open = cancel;
    no.onclick = cancel;
    yes.onclick = () => done(ta.value);
    ta.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') cancel();
    });
    ta.focus();
  });
}

/** Ζητά επιβεβαίωση. `danger`: το κουμπί της ενέργειας γίνεται κόκκινο (διαγραφές). */
export function confirmBox(title: string, ok = 'Ναι', danger = false, hint?: string): Promise<boolean> {
  return new Promise((res) => {
    const { back, box } = shell(title, hint);
    const acts = document.createElement('div');
    acts.className = 'askActs';
    const no = button('Άκυρο', 'no'), yes = button(ok, danger ? 'go danger' : 'go');
    acts.append(no, yes);
    box.append(acts);
    const done = (v: boolean): void => {
      if (open !== cancel) return;
      open = null;
      removeEventListener('keydown', key, true);
      back.remove();
      res(v);
    };
    const cancel = (): void => done(false);
    const key = (e: KeyboardEvent): void => {
      e.stopPropagation();
      if (e.key === 'Enter') done(true);
      else if (e.key === 'Escape') cancel();
    };
    open = cancel;
    addEventListener('keydown', key, true);
    no.onclick = cancel;
    yes.onclick = () => done(true);
    back.addEventListener('pointerdown', (e) => {
      if (e.target === back) cancel();
    });
    yes.focus();
  });
}

/** Ενημερωτικό παράθυρο με λίστα (π.χ. «Τι νέο»). */
export function notice(title: string, lines: string[], hint?: string): Promise<void> {
  return new Promise((res) => {
    const { back, box } = shell(title, hint);
    const ul = document.createElement('ul');
    for (const l of lines) {
      const li = document.createElement('li');
      li.textContent = l;
      ul.append(li);
    }
    const acts = document.createElement('div');
    acts.className = 'askActs';
    const yes = button('Εντάξει', 'go');
    acts.append(yes);
    box.append(ul, acts);
    const done = (): void => {
      if (open !== done) return;
      open = null;
      back.remove();
      res();
    };
    open = done;
    yes.onclick = done;
    back.addEventListener('pointerdown', (e) => {
      if (e.target === back) done();
    });
  });
}

/** Μια φυλαγμένη λίστα λέξεων της ορθογραφίας. */
export interface WordList { name: string; text: string }

export interface AskWordsOptions {
  title: string;
  hint: string;
  value?: string;
  /** Η γλώσσα της υπαγόρευσης. */
  voice: string;
  lists: WordList[];
  /** Πόσες λέξεις βγαίνουν από το κείμενο (και πόσες χωρούν στο παιχνίδι). */
  count(text: string): number;
  max: number;
  save(l: WordList): Promise<WordList[]>;
  remove(name: string): Promise<WordList[]>;
  exportAll(): void;
  /** Λίστες από αρχείο· null αν το αρχείο δεν διαβάστηκε. */
  importFile(f: File): Promise<WordList[] | null>;
  /** Το αρχείο λιστών στο Google Drive: `added` πόσες ήρθαν ή ανέβηκαν (-1 στο load: δεν υπάρχει ακόμη αρχείο). */
  drive?: { load(): Promise<{ lists: WordList[]; added: number }>; save(): Promise<{ lists: WordList[]; added: number }> };
  /** 🎲: λίγες λέξεις στην τύχη από αυτά τα κείμενα· `count` πόσες διαφορετικές είχαν όλα μαζί. */
  random?(texts: string[]): { text: string; count: number };
}

/**
 * Οι λέξεις της ορθογραφίας: μεγάλο κουτί για επικόλληση ή υπαγόρευση, και οι φυλαγμένες λίστες με ένα πάτημα.
 * Επιστρέφει το κείμενο των λέξεων για να ξεκινήσει το παιχνίδι, ή null αν ακυρώθηκε.
 */
export function askWords(o: AskWordsOptions): Promise<string | null> {
  return new Promise((res) => {
    const { back, box } = shell(o.title, o.hint);
    box.classList.add('wordsBox');
    let lists = o.lists, armed = '';
    const chips = document.createElement('div');
    chips.className = 'askPicks wordLists';
    const name = document.createElement('input');
    name.className = 'wordName';
    name.placeholder = 'Όνομα της λίστας, για να φυλαχτεί (π.χ. Γλώσσα – Ενότητα 3)';
    name.maxLength = 60;
    const row = document.createElement('div');
    row.className = 'askIn wordsIn';
    const ta = document.createElement('textarea');
    ta.className = 'askText secret';
    ta.value = o.value ?? '';
    ta.spellcheck = false;
    ta.placeholder = 'μήλο, σχολείο, καλή μέρα\nή μία σε κάθε γραμμή';
    ta.rows = 7;
    const side = document.createElement('div');
    side.className = 'wordsSide';
    const eye = button('👁', 'eye');
    eye.title = 'Εμφάνιση / απόκρυψη των λέξεων';
    eye.onclick = () => ta.classList.toggle('secret');
    const mic = micButton(o.voice, (said) => {
      ta.value = ta.value.trim() ? `${ta.value.trim().replace(/,$/, '')}, ${said}` : said;
      update();
      return o.count(ta.value);
    });
    side.append(eye, mic.btn);
    if (o.random) {
      const random = o.random, dice = button('🎲', 'eye');
      // ξανά 🎲 χωρίς αλλαγή στο κουτί: νέα δεκάδα από την ίδια πηγή, όχι από την προηγούμενη δεκάδα
      let last: { text: string; from: string[]; label: string } | null = null;
      dice.title = '10 λέξεις στην τύχη: από τη λίστα στο κουτί, ή από όλες τις λίστες σου αν το κουτί είναι άδειο';
      dice.onclick = () => {
        // από ό,τι είναι στο κουτί (μια λίστα που μόλις διάλεξες, ή πολλές επικολλημένες)· αλλιώς από όλες τις φυλαγμένες
        const again = last && ta.value === last.text ? last : null, own = o.count(ta.value) > 0, from = own ? name.value.trim() : '';
        const src = again?.from ?? (own ? [ta.value] : lists.map((l) => l.text));
        const label = again?.label ?? (own ? (from ? `τη λίστα «${from}»` : 'τις λέξεις του κουτιού') : lists.length === 1 ? 'τη λίστα σου' : 'όλες τις λίστες σου');
        const r = random(src);
        if (!r.text) {
          info.textContent = 'Δεν υπάρχουν λέξεις για να διαλέξω: γράψε λέξεις ή φύλαξε πρώτα μια λίστα.';
          return;
        }
        ta.value = r.text;
        last = { text: r.text, from: src, label };
        // το όνομα σβήνει, για να μη γραφτεί η τυχαία δεκάδα πάνω στη λίστα από την οποία βγήκε
        name.value = '';
        update();
        info.textContent = `🎲 ${o.count(r.text)} στην τύχη από ${label} (${r.count} λέξεις). Πάτα ξανά το 🎲 για άλλες.`;
      };
      side.append(dice);
    }
    row.append(ta, side);
    const info = document.createElement('small');
    const files = document.createElement('div');
    files.className = 'askPicks';
    const pick = document.createElement('input');
    pick.type = 'file';
    pick.accept = '.txt,.csv,.json,text/plain,text/csv,application/json';
    pick.hidden = true;
    const open1 = button('📂 Λίστες από αρχείο', ''), save1 = button('⬇ Όλες οι λίστες σε αρχείο', '');
    open1.onclick = () => pick.click();
    save1.onclick = () => o.exportAll();
    files.append(open1, save1, pick);
    if (o.drive) {
      const drive = o.drive, up = button('☁️ Στο Google Drive', ''), down = button('☁️ Από το Google Drive', '');
      const run = (b: HTMLButtonElement, wait: string, job: () => Promise<{ lists: WordList[]; added: number }>, ok: (n: number) => string): void => {
        b.disabled = true;
        info.textContent = wait;
        // η σύνδεση με τη Google ξεκινά αμέσως μέσα στο πάτημα, αλλιώς ο browser μπλοκάρει το παράθυρό της
        job().then((r) => {
          lists = r.lists;
          draw();
          info.textContent = ok(r.added);
        }, (err: unknown) => {
          info.textContent = `Το Google Drive δεν απάντησε: ${err instanceof Error ? err.message : err}`;
        }).finally(() => { b.disabled = false; });
      };
      up.onclick = () => run(up, 'Ανεβαίνουν οι λίστες στο Drive…', drive.save, (n) => `Στο Drive υπάρχουν τώρα ${n === 1 ? '1 λίστα' : `${n} λίστες`} (φάκελος PrismaBoard).`);
      down.onclick = () => run(down, 'Φέρνω τις λίστες από το Drive…', drive.load, (n) => (n < 0 ? 'Δεν υπάρχουν ακόμη λίστες στο Drive: πάτα πρώτα «Στο Google Drive» από τη συσκευή που τις έχει.' : n ? `Ήρθαν ${n === 1 ? '1 λίστα' : `${n} λίστες`} από το Drive.` : 'Το Drive δεν είχε λίστες.'));
      files.append(up, down);
    }
    const acts = document.createElement('div');
    acts.className = 'askActs';
    const no = button('Άκυρο', 'no'), keep = button('💾 Φύλαξε', ''), yes = button('▶ Ξεκίνα', 'go');
    acts.append(no, keep, yes);
    box.append(chips, name, row, info, mic.note, files, acts);

    const update = (): void => {
      const n = o.count(ta.value);
      info.textContent = !n ? 'Γράψε ή επικόλλησε λέξεις, ή διάλεξε μια λίστα από πάνω.' : `${n === 1 ? '1 λέξη' : `${n} λέξεις`}${n >= o.max ? ` (μπαίνουν οι πρώτες ${o.max})` : ''}`;
      yes.disabled = keep.disabled = !n;
      keep.disabled ||= !name.value.trim();
      chips.querySelectorAll<HTMLElement>('[data-name]').forEach((c) => c.classList.toggle('on', c.dataset.name === name.value.trim()));
    };
    const draw = (): void => {
      chips.replaceChildren();
      if (!lists.length) {
        const none = document.createElement('small');
        none.textContent = 'Δεν έχεις ακόμη φυλαγμένες λίστες: γράψε λέξεις, δώσε όνομα και πάτα «Φύλαξε».';
        chips.append(none);
      }
      for (const l of lists) {
        const chip = button(l.name, 'wordChip');
        chip.dataset.name = l.name;
        chip.onclick = () => {
          name.value = l.name;
          ta.value = l.text;
          update();
        };
        // το × θέλει δεύτερο πάτημα, για να μη σβηστεί λίστα κατά λάθος
        const x = document.createElement('span');
        x.className = 'wordDel';
        x.textContent = armed === l.name ? 'Σβήσ’ την;' : '×';
        x.onclick = (e) => {
          e.stopPropagation();
          if (armed !== l.name) {
            armed = l.name;
            return draw();
          }
          armed = '';
          void o.remove(l.name).then((next) => { lists = next; draw(); });
        };
        chip.append(x);
        chips.append(chip);
      }
      update();
    };
    pick.onchange = () => {
      const f = pick.files?.[0];
      pick.value = '';
      if (!f) return;
      void o.importFile(f).then((got) => {
        if (!got) {
          info.textContent = 'Το αρχείο δεν διαβάστηκε: θέλει απλό κείμενο (.txt, .csv) ή αρχείο λιστών του PrismaBoard (.json).';
          return;
        }
        lists = got;
        draw();
        info.textContent = 'Οι λίστες του αρχείου μπήκαν στις λίστες σου.';
      });
    };
    const store = async (): Promise<void> => {
      const n = name.value.trim();
      if (n && o.count(ta.value)) lists = await o.save({ name: n, text: ta.value.trim() });
    };
    const done = (v: string | null): void => {
      if (open !== cancel) return;
      open = null;
      mic.abort();
      back.remove();
      res(v);
    };
    const cancel = (): void => done(null);
    open = cancel;
    no.onclick = cancel;
    keep.onclick = () => void store().then(() => { draw(); info.textContent = `Φυλάχτηκε η λίστα «${name.value.trim()}».`; });
    yes.onclick = () => void store().then(() => done(ta.value));
    ta.oninput = name.oninput = update;
    for (const el of [ta, name] as HTMLElement[]) {
      el.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Escape') cancel();
      });
    }
    back.addEventListener('pointerdown', (e) => {
      if (e.target === back) cancel();
    });
    draw();
    ta.focus();
  });
}

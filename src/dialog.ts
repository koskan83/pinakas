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
    let rec: SpeechRec | null = null;
    const SR = (window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec });
    const Rec = SR.SpeechRecognition ?? SR.webkitSpeechRecognition;
    if (o.voice) {
      const mic = button('🎤', 'eye mic');
      const note = document.createElement('small');
      mic.title = 'Πες τη λέξη ή την πρόταση';
      mic.onclick = () => {
        if (rec) return rec.stop();
        if (!Rec) {
          note.textContent = 'Η υπαγόρευση δεν υποστηρίζεται εδώ: θέλει Chrome ή Edge και ίντερνετ. Γράψε τις λέξεις με το πληκτρολόγιο.';
          return;
        }
        const r = (rec = new Rec());
        r.lang = o.voice!;
        r.interimResults = false;
        r.onresult = (e) => {
          const said = e.results[e.results.length - 1][0].transcript.replace(/[,;.!?·]/g, ' ').replace(/ +/g, ' ').trim();
          if (!said) return;
          inp.value = (inp.value.trim() ? `${inp.value.trim().replace(/,$/, '')}, ${said}` : said).slice(0, inp.maxLength);
          note.textContent = `Μπήκε (${inp.value.split(',').length}). Πάτα ξανά το 🎤 για την επόμενη.`;
        };
        r.onerror = (e) => {
          note.textContent = e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Δεν δόθηκε άδεια για το μικρόφωνο.' : e.error === 'no-speech' ? 'Δεν άκουσα τίποτα. Πάτα το 🎤 και ξαναπές το.' : 'Η υπαγόρευση δεν δούλεψε (θέλει ίντερνετ). Γράψε τις λέξεις με το πληκτρολόγιο.';
        };
        r.onend = () => {
          rec = null;
          mic.classList.remove('on');
        };
        note.textContent = 'Ακούω… πες τη λέξη ή την πρόταση.';
        mic.classList.add('on');
        try { r.start(); } catch { rec = null; mic.classList.remove('on'); }
      };
      row.append(mic);
      box.append(note);
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
      rec?.abort();
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

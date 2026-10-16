/**
 * Μετρητές χρήσης: πόσες φορές πατήθηκε κάθε κουμπί (εργαλείο, όργανο, ενέργεια μενού) και πότε τελευταία.
 * Μένουν μόνο σε αυτή τη συσκευή (localStorage) και δεν στέλνονται πουθενά· χρησιμεύουν για να φανεί τι δεν χρησιμοποιείται.
 */
const KEY = 'grafida.usage';
/** Τα χαρακτηριστικά που ξεχωρίζουν ένα κουμπί· όποιο δεν έχει κανένα μετριέται με το id του. */
const ATTRS = ['tool', 'pen', 'shape', 'axes', 'ins', 'anq', 'gadget', 'view', 'kid', 'act', 'imp', 'rec', 'an', 'eraser', 'tbl', 'meas', 'auto', 'speak', 'rp'];

interface Usage { since: string; n: Record<string, [count: number, last: string]> }

const today = (): string => new Date().toISOString().slice(0, 10);
function load(): Usage {
  try {
    const u = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Usage | null;
    if (u && typeof u.since === 'string' && u.n && typeof u.n === 'object') return u;
  } catch {
    /* χωρίς αποθήκευση ή χαλασμένη τιμή: αρχίζουμε από την αρχή */
  }
  return { since: today(), n: {} };
}
const usage = load();

function keyOf(b: HTMLElement): string {
  const a = ATTRS.find((k) => b.dataset[k] !== undefined);
  return a ? `${a}=${b.dataset[a]}` : b.id ? `#${b.id}` : '';
}

/** Ξεκινά το μέτρημα: ένα μόνο «αυτί» για όλα τα κουμπιά, χωρίς να αγγίζει τη δουλειά τους. */
export function trackUsage(): void {
  document.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement | null)?.closest?.<HTMLElement>('button');
    const k = b ? keyOf(b) : '';
    if (!k) return;
    usage.n[k] = [(usage.n[k]?.[0] ?? 0) + 1, today()];
    try {
      localStorage.setItem(KEY, JSON.stringify(usage));
    } catch {
      /* χωρίς αποθήκευση: μετράμε μόνο όσο είναι ανοιχτή η εφαρμογή */
    }
  }, true);
}

/** Αναφορά σε απλό κείμενο: πρώτα ό,τι πατήθηκε πιο πολύ, στο τέλος ό,τι δεν πατήθηκε ποτέ. */
export function usageReport(): string {
  const label = new Map<string, string>();
  document.querySelectorAll<HTMLElement>('button').forEach((b) => {
    const k = keyOf(b);
    if (k && !label.has(k)) label.set(k, (b.textContent?.trim() || b.title || b.dataset.l || '').replace(/\s+/g, ' ').slice(0, 60));
  });
  const keys = [...new Set([...Object.keys(usage.n), ...label.keys()])].sort((a, b) => (usage.n[b]?.[0] ?? 0) - (usage.n[a]?.[0] ?? 0) || a.localeCompare(b));
  const row = (k: string): string => `${String(usage.n[k]?.[0] ?? 0).padStart(6)}  ${usage.n[k]?.[1] ?? '    —     '}  ${k.padEnd(22)}  ${label.get(k) ?? ''}`;
  return [`PrismaBoard: μετρητές χρήσης σε αυτή τη συσκευή, από ${usage.since} έως ${today()}`, '', 'πατήματα  τελευταία   κουμπί                  όνομα', ...keys.map(row), ''].join('\n');
}

/** Κουμπιά που είναι «λειτουργίες» (εργαλεία, όργανα, επιλογές μενού), όχι πλήκτρα ή μέρη παραθύρων. */
const FEATURE = '#toolbar button[data-l], #gadgetMenu .tiles:not(#recentTiles) .tile, #menu button[data-act], #setMenu button[data-act], #importMenu button, #selOpts button';

/** Το σύντομο όνομα ενός κουμπιού: η ετικέτα του, η λεζάντα του πλακιδίου ή το κείμενό του χωρίς τα εικονίδια. */
function nameOf(b: HTMLElement): string {
  const own = [...b.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('');
  return (b.dataset.l || b.querySelector('small')?.textContent || own.trim() || b.title || b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
}

/** Τα ονόματα των κουμπιών-λειτουργιών, όπως φαίνονται. */
function labels(): Map<string, string> {
  const label = new Map<string, string>();
  const lv = document.body.classList.contains('primary') ? 'pri' : 'sec';
  document.querySelectorAll<HTMLElement>(FEATURE).forEach((b) => {
    // ό,τι ανήκει μόνο στην άλλη βαθμίδα δεν φαίνεται εδώ, άρα δεν μετρά ως «ποτέ»
    if ((b.closest<HTMLElement>('[data-lv]')?.dataset.lv ?? lv) !== lv) return;
    const k = keyOf(b);
    const l = nameOf(b);
    if (k && l && !label.has(k)) label.set(k, l);
  });
  return label;
}

export interface UsageSummary {
  since: string;
  /** Τα πιο συχνά κουμπιά: [όνομα, πατήματα]. */
  top: [string, number][];
  /** Κουμπιά που δεν πατήθηκαν ποτέ σε αυτή τη συσκευή. */
  never: string[];
  /** Πόσο χρειάζεται συνήθως η εφαρμογή για να ανοίξει το μάθημα (ms, διάμεσος των τελευταίων ανοιγμάτων). */
  openMs: number | null;
}

export function usageSummary(n = 12): UsageSummary {
  const label = labels();
  const used = Object.entries(usage.n).filter(([k]) => label.has(k)).sort((a, b) => b[1][0] - a[1][0]);
  const top = used.slice(0, n).map(([k, [c]]): [string, number] => [label.get(k)!, c]);
  const never = [...label.keys()].filter((k) => !usage.n[k]).map((k) => label.get(k)!);
  return { since: usage.since, top, never: [...new Set(never)], openMs: openTime() };
}

// ---------- χρόνος ανοίγματος ----------

const OPEN = 'grafida.open';

/** Σημειώνει πόσο κράτησε το άνοιγμα, από τη φόρτωση της σελίδας ως το έτοιμο μάθημα· κρατά τα 10 τελευταία. */
export function markReady(): void {
  const ms = Math.round(performance.now());
  try {
    const list = (JSON.parse(localStorage.getItem(OPEN) ?? '[]') as number[]).filter(Number.isFinite).slice(-9);
    localStorage.setItem(OPEN, JSON.stringify([...list, ms]));
  } catch {
    /* χωρίς αποθήκευση */
  }
}

function openTime(): number | null {
  try {
    const list = (JSON.parse(localStorage.getItem(OPEN) ?? '[]') as number[]).filter(Number.isFinite).sort((a, b) => a - b);
    return list.length ? list[Math.floor(list.length / 2)] : null;
  } catch {
    return null;
  }
}

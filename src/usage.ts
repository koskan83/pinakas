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

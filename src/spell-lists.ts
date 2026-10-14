/**
 * Οι λίστες λέξεων της ορθογραφίας: φυλάγονται στη συσκευή με όνομα, μπαίνουν στο αντίγραφο μαθημάτων σε αρχείο,
 * και βγαίνουν ή μπαίνουν και μόνες τους σε αρχείο (για συναδέλφους ή άλλον πίνακα).
 */
import { askWords, type WordList } from './dialog';
import { spellList } from './kids';
import { kvGet, kvSet } from './storage';
import { readSpellLists, saveSpellLists } from './drive';

const KEY = 'spellLists';
/** Πόσες λέξεις παίρνει ένα παιχνίδι (όπως το SPELL_WORDS στο kids.ts). */
const MAX = 20;
/** Πόσες λέξεις διαλέγει το 🎲. */
const RANDOM = 10;

interface ListsFile { grafida: 'spell-lists'; v: 1; lists: WordList[] }

const clean = (l: unknown): WordList | null => {
  const x = l as Partial<WordList> | null;
  return x && typeof x.name === 'string' && typeof x.text === 'string' && x.name.trim() && x.text.trim() ? { name: x.name.trim().slice(0, 60), text: x.text.trim().slice(0, 4000) } : null;
};

export async function loadLists(): Promise<WordList[]> {
  const got = await kvGet<unknown[]>(KEY);
  return Array.isArray(got) ? got.map(clean).filter((l): l is WordList => !!l) : [];
}

async function store(lists: WordList[]): Promise<WordList[]> {
  lists.sort((a, b) => a.name.localeCompare(b.name, 'el', { numeric: true }));
  await kvSet(KEY, lists);
  return lists;
}

/** Φυλάει μια λίστα· με το ίδιο όνομα αντικαθιστά την παλιά. */
async function saveList(l: WordList): Promise<WordList[]> {
  return store([...(await loadLists()).filter((x) => x.name !== l.name), l]);
}

async function removeList(name: string): Promise<WordList[]> {
  return store((await loadLists()).filter((x) => x.name !== name));
}

/**
 * Προσθέτει λίστες (από αρχείο ή από αντίγραφο)· όσες έχουν ίδιο όνομα με υπάρχουσα αντικαθίστανται μόνο αν `replace`.
 * Επιστρέφει όλες τις λίστες και πόσες μπήκαν.
 */
export async function mergeLists(add: unknown[], replace = true): Promise<{ lists: WordList[]; added: number }> {
  const have = await loadLists();
  let added = 0;
  for (const l of add.map(clean)) {
    if (!l) continue;
    const i = have.findIndex((x) => x.name === l.name);
    if (i >= 0 && !replace) continue;
    if (i >= 0) have.splice(i, 1);
    have.push(l);
    added++;
  }
  return { lists: added ? await store(have) : have, added };
}

/** Αρχείο λιστών: το δικό μας .json, ή απλό κείμενο (.txt, .csv) που γίνεται μία λίστα με το όνομα του αρχείου. */
async function importFile(f: File): Promise<WordList[] | null> {
  try {
    const text = await f.text();
    if (/\.json$/i.test(f.name) || f.type === 'application/json') {
      const data = JSON.parse(text) as Partial<ListsFile>;
      if (data.grafida !== 'spell-lists' || !Array.isArray(data.lists)) return null;
      return (await mergeLists(data.lists)).lists;
    }
    if (!spellList(text).words.length) return null;
    return (await mergeLists([{ name: f.name.replace(/\.[^.]+$/, ''), text }])).lists;
  } catch {
    return null;
  }
}

/** `n` λέξεις στην τύχη από τα κείμενα (μία ή πολλές λίστες), με τη σημασία τους, μία σε κάθε γραμμή· χωρίς διπλές. */
export function randomWords(texts: string[], n: number): { text: string; count: number } {
  const seen = new Set<string>(), all: string[] = [];
  for (const t of texts) {
    const l = spellList(t);
    l.words.forEach((w, i) => {
      if (seen.has(w)) return;
      seen.add(w);
      all.push(l.hints[i] ? `${w} = ${l.hints[i]}` : w);
    });
  }
  const out: string[] = [];
  while (out.length < n && all.length) out.push(all.splice(Math.floor(Math.random() * all.length), 1)[0]);
  return { text: out.join('\n'), count: seen.size };
}

/** Λίστες από το αρχείο του Drive: όσες έχουν ίδιο όνομα αντικαθίστανται (το Drive είναι το κοινό σημείο όλων των συσκευών). */
async function fromDrive(): Promise<{ lists: WordList[]; added: number }> {
  const text = await readSpellLists();
  if (text == null) return { lists: await loadLists(), added: -1 };
  const data = JSON.parse(text) as Partial<ListsFile>;
  return mergeLists(Array.isArray(data.lists) ? data.lists : []);
}

/** Ανεβάζει όλες τις λίστες· όσες υπάρχουν μόνο στο Drive (από άλλη συσκευή) κρατιούνται κι αυτές, και μπαίνουν και εδώ. */
async function toDrive(): Promise<{ lists: WordList[]; added: number }> {
  const text = await readSpellLists();
  if (text != null) {
    const data = JSON.parse(text) as Partial<ListsFile>;
    await mergeLists(Array.isArray(data.lists) ? data.lists : [], false);
  }
  const lists = await loadLists(), out: ListsFile = { grafida: 'spell-lists', v: 1, lists };
  await saveSpellLists(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }));
  return { lists, added: lists.length };
}

async function exportAll(download: (blob: Blob, name: string) => void): Promise<void> {
  const out: ListsFile = { grafida: 'spell-lists', v: 1, lists: await loadLists() };
  download(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }), `orthografia_listes_${new Date().toISOString().slice(0, 10)}.json`);
}

/** Το παράθυρο των λέξεων· επιστρέφει το κείμενο για το παιχνίδι ή null. `download`: πώς κατεβαίνει το αρχείο των λιστών. */
export async function askSpellWords(o: { title: string; hint?: string; voice: string; value?: string; download: (blob: Blob, name: string) => void }): Promise<string | null> {
  return askWords({
    title: o.title,
    hint: o.hint ?? 'Επικόλλησε ή γράψε λέξεις, χωρισμένες με κόμμα ή μία σε κάθε γραμμή. Στα αγγλικά βάζεις και τη σημασία: apple = μήλο (ή apple - μήλο, ή δύο στήλες από Excel). Με όνομα, η λίστα φυλάγεται για την επόμενη φορά.',
    value: o.value,
    voice: o.voice,
    lists: await loadLists(),
    count: (text) => spellList(text).words.length,
    max: MAX,
    save: saveList,
    remove: removeList,
    exportAll: () => void exportAll(o.download),
    importFile,
    drive: { load: fromDrive, save: toDrive },
    random: (texts) => randomWords(texts, RANDOM),
  });
}

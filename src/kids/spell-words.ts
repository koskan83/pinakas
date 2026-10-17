/**
 * Οι λέξεις της Ορθογραφίας και η κατάσταση του παιχνιδιού, χωρίς τη σκηνή: τις χρειάζονται και οι λίστες λέξεων
 * και η «Ορθογραφία από τον πίνακα» από την αρχή, ενώ η σκηνή (spell.ts) φορτώνεται αργότερα.
 */

/** Τα πλήκτρα ακολουθούν τη γλώσσα της λέξης που ζητείται. */
export const spellIsEn = (target: string): boolean => /[a-z]/.test(target);
/** Πόσα γράμματα χωρά μια λέξη ή πρόταση, και πόσα μπορεί να γράψει ο μαθητής (λίγα παραπάνω, για τα περιττά). */
export const SPELL_LEN = 40, SPELL_MAX = 42, SPELL_WORDS = 20, SPELL_PICK = 8;
/** Οι αγγλικές έχουν δίπλα τους τη σημασία στα ελληνικά: αυτή βλέπει ο μαθητής, και γράφει την αγγλική λέξη. */
export const SPELL_READY_EN = [
  'cat=γάτα dog=σκύλος sun=ήλιος red=κόκκινο blue=μπλε one=ένα two=δύο book=βιβλίο pen=στιλό mum=μαμά dad=μπαμπάς ball=μπάλα',
  'apple=μήλο school=σχολείο green=πράσινο yellow=κίτρινο three=τρία happy=χαρούμενος water=νερό house=σπίτι mother=μητέρα father=πατέρας sister=αδελφή brother=αδελφός',
  'teacher=δάσκαλος friend=φίλος family=οικογένεια window=παράθυρο orange=πορτοκάλι monday=Δευτέρα pencil=μολύβι number=αριθμός garden=κήπος rabbit=κουνέλι summer=καλοκαίρι winter=χειμώνας',
  'breakfast=πρωινό birthday=γενέθλια tomorrow=αύριο elephant=ελέφαντας football=ποδόσφαιρο saturday=Σάββατο beautiful=όμορφος kitchen=κουζίνα morning=πρωί thursday=Πέμπτη because=επειδή children=παιδιά',
  'different=διαφορετικός favourite=αγαπημένος wednesday=Τετάρτη mountain=βουνό language=γλώσσα question=ερώτηση february=Φεβρουάριος together=μαζί vegetable=λαχανικό computer=υπολογιστής yesterday=χθες dangerous=επικίνδυνος',
  'environment=περιβάλλον necessary=απαραίτητος restaurant=εστιατόριο temperature=θερμοκρασία government=κυβέρνηση interesting=ενδιαφέρων neighbour=γείτονας knowledge=γνώση dictionary=λεξικό experience=εμπειρία invitation=πρόσκληση comfortable=άνετος',
].map((s) => s.split(' '));
export const SPELL_MEANING = new Map(SPELL_READY_EN.flat().map((e) => e.split('=') as [string, string]));
/** Λέξη ή πρόταση όπως συγκρίνεται, ελληνική ή αγγλική: πεζά με τους τόνους τους, χωρίς στίξη (μένει η απόστροφος) και διπλά κενά. */
export function spellNorm(text: string, max = SPELL_LEN): string {
  return text.toLocaleLowerCase('el').replace(/[’`´]/g, "'").replace(/[^α-ωάέήίόύώϊϋΐΰa-z' ]/g, '').replace(/ +/g, ' ').trim().slice(0, max).trim();
}
/**
 * Η λίστα του δασκάλου: λέξεις ή μικρές προτάσεις χωρισμένες με κόμμα (ή ερωτηματικό, ή αλλαγή γραμμής).
 * Κάθε μία μπορεί να έχει μετά από «=» αυτό που θα βλέπει ο μαθητής (π.χ. τη σημασία στα ελληνικά: apple=μήλο)·
 * αν γραφτούν ανάποδα (μήλο=apple), η αγγλική είναι αυτή που ζητείται. Αντί για «=» πιάνουν και « - », «:» και το tab
 * (δύο στήλες επικολλημένες από Excel). Χωρίς κανένα κόμμα ή αλλαγή γραμμής, κάθε λέξη χωριστά (π.χ. «μήλο σχολείο φως»).
 */
export function spellList(text: string): { words: string[]; hints: string[] } {
  const words: string[] = [], hints: string[] = [];
  const flat = text.replace(/[ \t]*(?:=|:|\t| [-–—] )[ \t]*/g, '=').replace(/\r/g, '');
  for (const entry of flat.split(/[,;·\n]/.test(flat) ? /[,;·\n]+/ : /\s+/)) {
    const [a, b = ''] = entry.split('='), swap = !!b && !/[a-z]/i.test(a) && /[a-z]/i.test(b);
    const word = spellNorm(swap ? b : a);
    if (!word || words.length >= SPELL_WORDS) continue;
    words.push(word);
    // αγγλική λέξη χωρίς σημασία: αν είναι από τις έτοιμες, μπαίνει η δική τους
    hints.push((swap ? a : b).replace(/\s+/g, ' ').trim().slice(0, SPELL_LEN) || (SPELL_MEANING.get(word) ?? ''));
  }
  return { words, hints };
}
/**
 * Η κατάσταση του παιχνιδιού.
 * `phase`: 0 ο μαθητής γράφει · 1 πρώτος έλεγχος, το τερατάκι έφαγε τα λάθη και ο μαθητής γράφει το σωστό στα κενά · 2 τέλος της λέξης ·
 * 3 γραφή με το χέρι χωρίς ανάγνωση: φαίνεται η σωστή και η τάξη λέει αν γράφτηκε σωστά.
 * `res` ανά λέξη: 0 δεν παίχτηκε · 1 σωστή με την πρώτη · 10 + όσα λάθη έφαγε το τερατάκι (και όσο διορθώνεται, και αν έμεινε λάθος) ·
 * 100 + όσα έφαγε, αν γράφτηκε σωστά στη δεύτερη προσπάθεια (2 σε παλιότερες καταστάσεις).
 * `sel`: το γράμμα που έχει πιαστεί για αλλαγή (θέση + 1), 0 αν γράφει στο τέλος. `marks`: ποιες θέσεις άδειασε ο πρώτος έλεγχος
 * (το «_» είναι κενή θέση που περιμένει γράμμα). `peek`: η σωστή λέξη φαίνεται· `ready`: έτοιμες λέξεις, άρα κάθε νέα λέξη δείχνεται πρώτα.
 * `hints`: ανά λέξη, αυτό που βλέπει ο μαθητής αντί να την ακούσει (η σημασία της στα ελληνικά), ή κενό. `said`: αλλάζει σε κάθε πάτημα του 🔊.
 * `en`: στην αρχική οθόνη έχουν διαλεχτεί τα Αγγλικά (έτοιμες αγγλικές λέξεις, υπαγόρευση στα αγγλικά).
 * `acc`: πατήθηκε το νεκρό πλήκτρο του τόνου και περιμένει φωνήεν (1 τόνος, 2 διαλυτικά, 3 και τα δύο).
 */
export interface Spell {
  phase: number; hand: boolean; peek: boolean; ready: boolean; en: boolean; said: boolean; acc: number; idx: number; sel: number;
  words: string[]; hints: string[]; res: number[]; typed: string; marks: boolean[];
}
export const SPELL_NEW = 1024, SPELL_MARK = 0x10000;
export const SPELL_EMPTY: Spell = { phase: 0, hand: false, peek: false, ready: false, en: false, said: false, acc: 0, idx: 0, sel: 0, words: [], hints: [], res: [], typed: '', marks: [] };
/** [σημαίες, ποια λέξη, πιασμένο γράμμα, μήκος λίστας, η λίστα…, αποτέλεσμα ανά λέξη…, ό,τι έχει γραφτεί…]. */
export function spellState(v: number[]): Spell {
  const f = v[0] ?? 0;
  // καταστάσεις της πρώτης έκδοσης (μία λέξη) δεν έχουν τη σημαία: ξεκινούν από την αρχή
  if (!(f & SPELL_NEW)) return SPELL_EMPTY;
  const n = v[3] ?? 0, list = String.fromCharCode(...v.slice(4, 4 + n)), entries = list ? list.split('\n').map((e) => e.split('=')) : [], words = entries.map((e) => e[0]);
  const rest = v.slice(4 + n + words.length);
  return {
    phase: f & 3, hand: (f & 4) !== 0, peek: (f & 8) !== 0, ready: (f & 16) !== 0, en: (f & 32) !== 0, said: (f & 64) !== 0, acc: (f >> 7) & 3, idx: v[1] ?? 0, sel: v[2] ?? 0, words, hints: entries.map((e) => e[1] ?? ''),
    res: words.map((_, i) => v[4 + n + i] ?? 0), typed: rest.map((code) => String.fromCharCode(code % SPELL_MARK)).join(''), marks: rest.map((code) => code >= SPELL_MARK),
  };
}
export function spellPack(s: Spell): number[] {
  const list = s.words.map((word, i) => (s.hints[i] ? `${word}=${s.hints[i]}` : word)).join('\n');
  return [
    SPELL_NEW + s.phase + (s.hand ? 4 : 0) + (s.peek ? 8 : 0) + (s.ready ? 16 : 0) + (s.en ? 32 : 0) + (s.said ? 64 : 0) + (s.acc << 7), s.idx, s.sel, list.length,
    ...[...list].map((ch) => ch.charCodeAt(0)), ...s.words.map((_, i) => s.res[i] ?? 0),
    ...[...s.typed].map((ch, i) => ch.charCodeAt(0) + (s.marks[i] ? SPELL_MARK : 0)),
  ];
}
/** Νέο παιχνίδι. Οι έτοιμες λέξεις φαίνονται πρώτα (κανείς δεν τις ξέρει), εκτός αν ο μαθητής βλέπει τη σημασία τους. */
/** Νέο παιχνίδι με τις λέξεις ενός κειμένου (π.χ. από λίστα ή από τον πίνακα)· null αν δεν βρέθηκε καμία. */
export function spellGame(text: string): number[] | null {
  const list = spellList(text);
  return list.words.length ? spellPack(spellStart({ ...SPELL_EMPTY, en: list.words.every((w) => spellIsEn(w)) }, list.words, false, list.hints)) : null;
}
export const spellStart = (s: Spell, words: string[], ready: boolean, hints: string[] = []): Spell => ({ ...SPELL_EMPTY, hand: s.hand, en: s.en, words, hints: words.map((_, i) => hints[i] ?? ''), res: words.map(() => 0), ready, peek: ready && !hints[0] });

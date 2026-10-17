/** Ορθογραφία με το τερατάκι που τρώει τα λάθη. */
import type { KidAsk, StampDef } from '../stamps';
import { BLUE, type C, fitText, FONT, GOOD, GREEN, kid, ORANGE, PURPLE, RED, rrect, sum, text, YELLOW } from './common';
import { monster } from './monster';
import { type Spell, SPELL_EMPTY, SPELL_MAX, SPELL_PICK, SPELL_READY_EN, spellIsEn, spellList, spellNorm, spellPack, spellStart, spellState } from './spell-words';

/**
 * Τα πλήκτρα όπως σε κανονικό πληκτρολόγιο (ελληνικό ή QWERTY), για να μαθαίνουν τα παιδιά και τη διάταξη:
 * κάθε σειρά με την εσοχή της (σε πλάτη πλήκτρου), το ⌫ στο τέλος της τρίτης και το κενό από κάτω.
 * Ο τόνος είναι νεκρό πλήκτρο, όπως στο αληθινό: πρώτα ΄ και μετά το φωνήεν (ξανά ΄ για διαλυτικά, και τρίτη φορά για ΐ, ΰ).
 * Το «;» της πρώτης θέσης δεν γράφει τίποτα· είναι εκεί μόνο για να μένουν τα γράμματα στη θέση τους.
 */
const SPELL_ROWS: [number, string][] = [[0, ';ςερτυθιοπ'], [0.25, 'ασδφγηξκλ΄'], [0.75, 'ζχψωβνμ⌫']];
const SPELL_ROWS_EN: [number, string][] = [[0, 'qwertyuiop'], [0.25, "asdfghjkl'"], [0.75, 'zxcvbnm⌫']];
/** Πόσα πλάτη πλήκτρου πιάνει όλο το πληκτρολόγιο, και το ⌫. */
const SPELL_KB_UNITS = 10.25, SPELL_BS = 2.5;
/** Τι γίνεται ένα φωνήεν μετά το νεκρό πλήκτρο: 1 τόνος, 2 διαλυτικά, 3 και τα δύο. */
const SPELL_ACC = ['', 'άέήίόύώ', 'αεηϊοϋω', 'αεηΐοΰω'].map((to) => new Map([...'αεηιουω'].map((ch, i) => [ch, to[i]])));
const SPELL_ACC_KEY = ['΄', '΄', '¨', '΅'];
/** Πού είναι κάθε πλήκτρο, μέσα στην περιοχή των πλήκτρων (`kx`, `ky`, πλάτος `kw`·10, ύψος `kh`·4). */
export function spellKeyboard(g: { kx: number; ky: number; kw: number; kh: number }, en: boolean): { key: string; x: number; y: number; w: number; h: number }[] {
  const u = (g.kw * 10) / SPELL_KB_UNITS, out: { key: string; x: number; y: number; w: number; h: number }[] = [];
  (en ? SPELL_ROWS_EN : SPELL_ROWS).forEach(([off, keys], row) => [...keys].forEach((key, i) => {
    out.push({ key, x: g.kx + (off + i) * u, y: g.ky + row * g.kh, w: key === '⌫' ? SPELL_BS * u : u, h: g.kh });
  }));
  out.push({ key: ' ', x: g.kx + 2.5 * u, y: g.ky + 3 * g.kh, w: 5.5 * u, h: g.kh });
  return out;
}
/** Πόσο κρατά το φάγωμα ενός λάθους (ms) και πότε αρχίζει το πρώτο. */
const SPELL_STEP = 800, SPELL_T0 = 350, SPELL_SNIFF = 300;
const SPELL_GRADES = ['Α΄', 'Β΄', 'Γ΄', 'Δ΄', 'Ε΄', 'ΣΤ΄'];
/** Έτοιμες λέξεις ανά τάξη· κάθε παιχνίδι παίρνει στην τύχη SPELL_PICK από αυτές. */
const SPELL_READY = [
  'μαμά νερό παιδί γάτα σπίτι ήλιος μήλο καλός τόπι φως χέρι πόδι λεμόνι ψωμί γάλα',
  'σχολείο δάσκαλος βιβλίο θάλασσα παιχνίδι καλημέρα οικογένεια μολύβι τετράδιο ποδήλατο ουρανός λουλούδι κήπος αυτοκίνητο',
  'άνθρωπος γειτονιά ταξίδι χειμώνας καλοκαίρι άνοιξη φθινόπωρο εικόνα ζωγραφιά μαθητής παράθυρο κουζίνα ειρήνη αεροπλάνο',
  'συγγραφέας εφημερίδα υπολογιστής περιβάλλον θερμοκρασία εγγονός άγγελος συννεφιά αγκαλιά ευχαριστώ πρωινό βιβλιοθήκη γυμναστική',
  'δημοκρατία επανάσταση πολιτισμός εκπαίδευση συνάντηση αλληλεγγύη ανακύκλωση εμπιστοσύνη πληροφορία ειλικρίνεια υποχρέωση εξαίρεση',
  'κοινοβούλιο συνείδηση αξιοπρέπεια ευαισθησία παρεξήγηση επιχείρηση συμπεριφορά διεύθυνση ατμόσφαιρα δικαιοσύνη ευθύνη αποτέλεσμα σύγκρουση εξυπηρέτηση',
].map((s) => s.split(' '));
/**
 * Αντιστοιχίζει ό,τι γράφτηκε με το σωστό, γράμμα προς γράμμα: `a` αυτό που έγραψε ο μαθητής, `b` το σωστό.
 * Λάθος γράμμα έχει και τα δύο διαφορετικά· γράμμα που περισσεύει δεν έχει `b`· γράμμα που λείπει δεν έχει `a`.
 */
export function spellDiff(typed: string, target: string): { a: string | null; b: string | null }[] {
  const n = typed.length, m = target.length;
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) d[i][j] = Math.min(d[i - 1][j - 1] + (typed[i - 1] === target[j - 1] ? 0 : 1), d[i - 1][j] + 1, d[i][j - 1] + 1);
  const out: { a: string | null; b: string | null }[] = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (typed[i - 1] === target[j - 1] ? 0 : 1)) out.push({ a: typed[--i], b: target[--j] });
    else if (i > 0 && d[i][j] === d[i - 1][j] + 1) out.push({ a: typed[--i], b: null });
    else out.push({ a: null, b: target[--j] });
  }
  return out.reverse();
}
/** Πόσα λάθη έχει φάει το τερατάκι σε όλες τις λέξεις μέχρι τώρα. */
const spellAte = (r: number): number => (r >= 100 ? r - 100 : r >= 10 ? r - 10 : 0);
const spellEaten = (res: number[]): number => res.reduce((sum, r) => sum + spellAte(r), 0);
/** Η λέξη γράφτηκε σωστά στη δεύτερη προσπάθεια, αφού το τερατάκι έφαγε τα λάθη της πρώτης. */
const spellFixed = (r: number): boolean => r === 2 || r >= 100;
/**
 * Το τερατάκι μεγαλώνει πολύ με κάθε λάθος που τρώει (`k` από 0 έως 9, σχεδόν τριπλάσιο στο ένατο). Στο δέκατο γίνεται
 * τεράστιο, γεμίζει την οθόνη και τρώει τον μαθητή (SPELL_FEAST)· μετά ρεύεται και ξαναγίνεται μικρό, για τα επόμενα δέκα.
 */
const spellR = (w: number, k: number): number => w * 0.042 * (1 + 0.17 * k);
const SPELL_FEAST = 10;
/** Πόσο κρατά η σκηνή του δέκατου λάθους (ms): μεγαλώνει, χαμ, σκοτάδι μέσα στο στόμα, ρέψιμο. */
const SPELL_FIN = 3600;
/** Κάθε πόσα ms κλείνει το στόμα μέσα στη σκηνή (ένα «ΧΑΜ!» τη φορά). */
const SPELL_CHOMP = 600;
/**
 * Ο έλεγχος αυτού που γράφτηκε. Την πρώτη φορά το τερατάκι τρώει τα λάθη και αφήνει τη θέση τους κενή («_»), για να γράψει
 * ο μαθητής το σωστό· ό,τι περίσσευε φεύγει. Τη δεύτερη, τρώει όσα έμειναν και φαίνεται το σωστό.
 */
function spellCheck(s: Spell, written: string): Spell | null {
  const target = s.words[s.idx], t = spellNorm(written, SPELL_MAX);
  if (!target || !t) return null;
  const diff = spellDiff(t, target), bad = diff.filter((cell) => cell.a !== cell.b).length;
  const res = [...s.res], ate = spellAte(res[s.idx] ?? 0);
  s = { ...s, acc: 0 };
  if (bad && s.phase === 0) {
    const kept = diff.filter((cell) => cell.b !== null), marks = kept.map((cell) => cell.a !== cell.b);
    res[s.idx] = 10 + bad;
    return { ...s, phase: 1, peek: false, typed: kept.map((cell) => (cell.a === cell.b ? cell.a : '_')).join(''), marks, sel: s.hand ? 0 : marks.indexOf(true) + 1, res };
  }
  res[s.idx] = bad ? 10 + ate + bad : ate ? 100 + ate : 1;
  return { ...s, phase: 2, peek: false, typed: t, marks: [], sel: 0, res };
}
/**
 * Πόσα ms έχουν περάσει από την αρχή της σκηνής του δέκατου λάθους (βλ. spellFeast)· αρχίζει όταν τελειώσει το φάγωμα των
 * γραμμάτων, όπως και ο ήχος της (fx.ts): μετά το μύρισμα (στον πρώτο έλεγχο), ένα δάγκωμα για καθένα, και η επιστροφή.
 */
function spellFin(s: Spell, prev: Spell, at: number): number {
  return at - (s.phase === 1 && prev.phase === 0 ? SPELL_SNIFF : 0) - SPELL_T0 - (s.typed ? spellEaten(s.res) - spellEaten(prev.res) : 0) * SPELL_STEP - 400;
}
/** Το τερατάκι έφαγε δέκα λάθη, άρα κι εσένα: μετά τη σκηνή η λίστα ξεκινά από την αρχή, με το τερατάκι μικρό. */
const spellFed = (s: Spell): boolean => spellEaten(s.res) >= SPELL_FEAST;
/** Η κατάσταση όπως παίζεται: αν το τερατάκι σε έχει φάει, η ίδια λίστα από την αρχή. */
function spellLive(v: number[]): Spell {
  const s = spellState(v);
  return spellFed(s) ? spellStart(s, s.words, s.ready, s.hints) : s;
}
/** Η επόμενη λέξη (ή, μετά την τελευταία, τα αποτελέσματα). */
const spellNext = (s: Spell): Spell => ({ ...s, acc: 0, phase: 0, idx: s.idx + 1, typed: '', marks: [], sel: 0, peek: s.ready && s.idx + 1 < s.words.length && !s.hints[s.idx + 1] });
/** Το γεγονός που κάνει την εφαρμογή να πει δυνατά τη λέξη (βλέπε kidFx). */
const spellSay = (s: Spell): string => `say|${/[a-z]/.test(s.words[s.idx]) ? 'en-GB' : 'el-GR'}|${s.words[s.idx]}`;
/**
 * Διάταξη: πάνω η πρόοδος, μετά η γραμμή όπου γράφεται η λέξη (`base`) και τι λέει το τερατάκι (`msg`), στη μέση τα πλήκτρα
 * (ή το πλαίσιο για γραφή με το χέρι), κάτω τα κουμπιά: Λέξεις, 👁, 🔊, τρόπος γραφής, Έλεγχος / Επόμενη.
 */
function spellGeom(w: number, h: number): { top: number; base: number; msg: number; ky: number; kh: number; kx: number; kw: number; by: number; bh: number; bx: number[]; bw: number[] } {
  return { top: h * 0.05, base: h * 0.345, msg: h * 0.44, ky: h * 0.475, kh: h * 0.0975, kx: w * 0.02, kw: w * 0.096, by: h * 0.875, bh: h * 0.11, bx: [0.02, 0.165, 0.25, 0.335, 0.52].map((f) => w * f), bw: [0.135, 0.075, 0.075, 0.175, 0.46].map((f) => w * f) };
}
/** Τα κουτάκια των γραμμάτων: όσο μεγαλώνει το τερατάκι, τόσο περισσότερο χώρο κρατά δεξιά και αριστερά της λέξης. */
function spellLay(w: number, n: number, eaten: number): { r: number; cw: number; x0: number } {
  const r = spellR(w, eaten % SPELL_FEAST), m = Math.max(n, 1), cw = Math.min(w * 0.08, (w - 2 * (r * 2 + w * 0.03)) / m);
  return { r, cw, x0: (w - m * cw) / 2 };
}
const spellBtn = (g: { bx: number[]; bw: number[]; by: number; bh: number }, x: number, y: number): number => (y < g.by || y > g.by + g.bh ? -1 : [0, 1, 2, 3, 4].findIndex((i) => x >= g.bx[i] && x <= g.bx[i] + g.bw[i]));
/**
 * Η σκηνή του δέκατου λάθους, πάνω από όλο το εργαλείο: το τερατάκι φουσκώνει ως να γεμίσει την οθόνη με το στόμα ορθάνοιχτο,
 * «ΧΑΜ!» και όλα σκοτεινιάζουν (είσαι μέσα στο στόμα του), μασάει, ρεύεται και ξαναγίνεται μικρό στη θέση του.
 * `from`: πού ήταν και πόσο μεγάλο· `to`: πού και πόσο θα καταλήξει. `u`: ms από την αρχή (0 έως SPELL_FIN).
 */
function spellFeast(c: C, w: number, h: number, u: number, from: { x: number; y: number; r: number }, to: { x: number; y: number; r: number }): void {
  const ease = (q: number): number => (q <= 0 ? 0 : q >= 1 ? 1 : q * q * (3 - 2 * q));
  const R = Math.hypot(w, h) * 0.55, GROW = 1300, DARK = 2700;
  c.save();
  c.beginPath();
  c.rect(0, 0, w, h);
  c.clip();
  // σκιά που πλησιάζει όσο μεγαλώνει
  const shade = u < GROW ? ease(u / GROW) * 0.35 : u < DARK ? 1 : Math.max(0, 1 - (u - DARK) / 500);
  if (u < GROW) {
    const q = ease(u / GROW), shake = q > 0.5 ? Math.sin(u / 30) * w * 0.006 * q : 0;
    c.fillStyle = '#000000';
    c.globalAlpha = shade;
    c.fillRect(0, 0, w, h);
    c.globalAlpha = 1;
    monster(c, from.x + (w / 2 - from.x) * q + shake, from.y + (h * 0.42 - from.y) * q, from.r + (R - from.r) * q * q, Math.min(1, 0.2 + q * 1.1));
  } else if (u < DARK) {
    // μέσα στο στόμα: σκοτάδι, δόντια πάνω και κάτω που κλείνουν και ανοίγουν (μάσημα)
    // το στόμα κλείνει τη στιγμή που μπαίνεις και μετά κάθε SPELL_CHOMP ms (μαζί με τον ήχο, βλ. fx.ts)
    const v = u - GROW, p = v % SPELL_CHOMP, bite = 0.5 - 0.5 * Math.cos((2 * Math.PI * v) / SPELL_CHOMP);
    c.fillStyle = '#2e1065';
    c.fillRect(0, 0, w, h);
    const gap = h * (0.09 + 0.3 * bite), n = 7, tw = w / n, th = h * 0.13;
    // άνω και κάτω σαγόνι: μωβ ούλα και άσπρα δόντια που πλησιάζουν
    for (const dir of [-1, 1]) {
      const edge = h / 2 + dir * gap, base = edge + dir * th;
      c.fillStyle = PURPLE;
      c.fillRect(0, dir < 0 ? 0 : base, w, dir < 0 ? base : h - base);
      c.fillStyle = '#ffffff';
      for (let i = 0; i < n; i++) {
        c.beginPath();
        c.moveTo(i * tw + 2, base);
        c.lineTo((i + 1) * tw - 2, base);
        c.lineTo((i + 0.5) * tw, edge);
        c.closePath();
        c.fill();
      }
    }
    // ένα «ΧΑΜ!» σε κάθε κλείσιμο: πετάγεται μεγάλο πάνω από τα δόντια και σβήνει όσο ξανανοίγει
    if (p < SPELL_CHOMP * 0.45) {
      c.save();
      c.globalAlpha = Math.min(1, 2.2 * (1 - p / (SPELL_CHOMP * 0.45)));
      fitText(c, 'ΧΑΜ!', w / 2, h / 2 + 2, h * 0.24 * (1 + 0.25 * Math.max(0, 1 - p / 120)), w * 0.85, YELLOW, 900);
      c.restore();
    }
  } else {
    // ρέψιμο και πίσω στο κανονικό: το σκοτάδι φεύγει, το τερατάκι ξεφουσκώνει πηγαίνοντας στη θέση του
    const q = ease((u - DARK) / (SPELL_FIN - DARK));
    c.fillStyle = '#2e1065';
    c.globalAlpha = shade;
    c.fillRect(0, 0, w, h);
    c.globalAlpha = 1;
    const r = R * 0.35 + (to.r - R * 0.35) * q, x = w / 2 + (to.x - w / 2) * q, y = h * 0.5 + (to.y - h * 0.5) * q;
    monster(c, x, y, r, q < 0.4 ? 0.7 : 0.1);
    fitText(c, 'Μπουρπ!', x + r * 1.2, y - r * 1.1, Math.max(h * 0.05, r * 0.5) * (1 - q * 0.5), w * 0.5, YELLOW, 900);
  }
  c.restore();
}

export const SPELL_KIDS: Record<string, StampDef> = {
  spell: kid({
    label: 'Ορθογραφία', w: 900, h: 660, init: [0, 0], animMs: 16000, big: true,
    drawKid(c, w, h, v, env) {
      // μετά τη σκηνή του δέκατου λάθους φαίνεται η λίστα από την αρχή (όσο παίζει η σκηνή, ό,τι έγινε στον έλεγχο)
      const raw = spellState(v), before = env.anim ? spellState(env.anim.prev) : null;
      const restarted = spellFed(raw) && !(before && !spellFed(before) && spellFin(raw, before, env.anim!.t) < SPELL_FIN);
      const s = restarted ? spellLive(v) : raw, g = spellGeom(w, h), eaten = spellEaten(s.res);
      const prev = restarted ? null : before, at = restarted ? Infinity : env.anim?.t ?? Infinity;
      const lathi = (k: number): string => (k === 1 ? '1 λάθος' : `${k} λάθη`);
      c.lineCap = 'round';
      const btn = (x: number, y: number, bw: number, bh: number, label: string, color: string, on = true): void => {
        rrect(c, x, y, bw, bh, bh * 0.3);
        c.save();
        c.fillStyle = color;
        c.globalAlpha = on ? 0.92 : 0.3;
        c.fill();
        c.restore();
        fitText(c, label, x + bw / 2, y + bh / 2 + 1, bh * 0.42, bw * 0.88, '#ffffff', 700);
      };
      // πριν από το παιχνίδι: ποιες λέξεις;
      if (!s.words.length) {
        monster(c, w / 2, h * 0.15, spellR(w, 0) * 1.5, 0.3);
        fitText(c, 'Ορθογραφία με το τερατάκι', w / 2, h * 0.315, h * 0.062, w * 0.9, env.ink, 800);
        btn(w * 0.3, h * 0.385, w * 0.195, h * 0.085, 'Ελληνικά', BLUE, !s.en);
        btn(w * 0.505, h * 0.385, w * 0.195, h * 0.085, 'English', BLUE, s.en);
        // έτοιμες λέξεις ανά τάξη
        SPELL_GRADES.forEach((name, i) => btn(w * (0.06 + 0.15 * i), h * 0.5, w * 0.13, h * 0.14, name, [GREEN, GOOD, '#0d9488', BLUE, '#6366f1', PURPLE][i]));
        btn(w * 0.2, h * 0.72, w * 0.6, h * 0.14, s.en ? '✏️ 🎤 My own words' : '✏️ 🎤 Δικές μου λέξεις', ORANGE);
        return;
      }
      const n = s.words.length;
      // μετά την τελευταία λέξη: τα αποτελέσματα
      if (s.idx >= n) {
        const ok = s.res.filter((r) => r === 1 || spellFixed(r)).length, r = spellR(w, eaten % SPELL_FEAST), ate = Math.floor(eaten / SPELL_FEAST);
        monster(c, w * 0.14, h * 0.5, r, eaten ? 0.25 : 0);
        fitText(c, `Τέλος! ${ok} από ${n} σωστές`, w * 0.6, h * 0.09, h * 0.068, w * 0.7, env.ink, 800);
        fitText(c, ate ? `Το τερατάκι έφαγε ${lathi(eaten)} και ${ate === 1 ? 'μια φορά' : `${ate} φορές`} κι εσένα!` : eaten ? `Το τερατάκι έφαγε ${lathi(eaten)} και μεγάλωσε!` : 'Το τερατάκι έμεινε νηστικό!', w * 0.6, h * 0.175, h * 0.042, w * 0.7, eaten ? ORANGE : GOOD, 700);
        const cols = n > 10 ? 2 : 1, rows = Math.ceil(n / cols), rh = Math.min(h * 0.085, (h * 0.6) / rows);
        s.words.forEach((word, i) => {
          const res = s.res[i], fixed = spellFixed(res), icon = res === 1 ? '⭐' : fixed ? '✅' : res >= 10 ? '👾' : '➖';
          const x = cols === 1 ? w * 0.6 : w * (0.45 + 0.34 * Math.floor(i / rows));
          fitText(c, `${icon} ${word}`, x, h * 0.25 + rh * ((i % rows) + 0.5), rh * 0.7, cols === 1 ? w * 0.66 : w * 0.32, res >= 10 && !fixed ? PURPLE : env.ink, 700);
        });
        btn(w * 0.02, g.by, w * 0.47, g.bh, '↺ Ξανά οι ίδιες λέξεις', PURPLE);
        btn(w * 0.51, g.by, w * 0.47, g.bh, '✏️ Νέες λέξεις', BLUE);
        return;
      }
      const target = s.words[s.idx], res = s.res[s.idx] ?? 0, hint = s.hints[s.idx];
      // τι φαίνεται στη γραμμή: η σωστή λέξη (👁, ή γραφή με το χέρι χωρίς ανάγνωση), το αποτέλεσμα του ελέγχου, ή ό,τι γράφει ο μαθητής
      const whole = s.peek || s.phase === 3 || (s.phase === 2 && !s.typed);
      // πρώτος έλεγχος που μόλις έγινε: φαίνεται ακόμη ό,τι είχε γραφτεί, και το τερατάκι τρώει τα λάθη του ένα ένα
      const first = s.phase === 1 && prev?.phase === 0
        ? (prev.typed ? spellDiff(spellNorm(prev.typed, SPELL_MAX), target) : [...s.typed].map((ch, i) => ({ a: ch === '_' ? null : ch, b: s.marks[i] ? '' : ch })))
        : [];
      const eat1 = at < SPELL_SNIFF + SPELL_T0 + first.filter((cell) => cell.a !== cell.b).length * SPELL_STEP + 400 && first.length > 0;
      const diff = eat1 ? first : s.phase === 2 && s.typed ? spellDiff(s.typed, target) : [];
      const bad = diff.map((cell, i) => (cell.a === cell.b ? -1 : i)).filter((i) => i >= 0);
      const count = whole ? target.length : s.phase === 2 || eat1 ? diff.length : s.typed.length, m = Math.max(count, 1);
      const { cw, x0 } = spellLay(w, count, eaten), ry = g.base - cw * 0.62;
      const cx = (i: number): number => x0 + (i + 0.5) * cw;
      // πριν γραφτεί οτιδήποτε, στη γραμμή φαίνεται μεγάλη η σημασία της λέξης: το τερατάκι στέκεται δίπλα της
      const big = !whole && s.phase === 0 && !s.typed && !!hint;
      c.save();
      c.font = `800 ${w * 0.075}px ${FONT}`;
      const half = big ? Math.min(c.measureText(hint).width, w * 0.62) / 2 + cw * 0.15 : 0;
      c.restore();
      // ο έλεγχος μόλις έγινε: το τερατάκι περνά από τα λάθη ένα ένα (στον πρώτο, αφού τα μυρίσει)· αλλιώς φαίνεται κατευθείαν το αποτέλεσμα
      const t = eat1 ? at - SPELL_SNIFF : s.phase === 2 && prev && prev.phase !== 2 ? at : Infinity;
      // κενή θέση: εδώ θα γραφτεί το σωστό γράμμα
      const slot = (i: number): void => {
        c.save();
        c.strokeStyle = RED;
        c.lineWidth = 2.5;
        c.setLineDash([cw * 0.1, cw * 0.1]);
        rrect(c, cx(i) - cw * 0.34, ry - cw * 0.46, cw * 0.68, cw * 0.92, cw * 0.1);
        c.stroke();
        c.restore();
      };
      const end = SPELL_T0 + bad.length * SPELL_STEP;
      // πρόοδος: μία κουκκίδα ανά λέξη
      const pr = Math.min(h * 0.024, (w * 0.6) / n / 2.6);
      s.words.forEach((_, i) => {
        c.save();
        c.beginPath();
        c.arc(w / 2 + (i - (n - 1) / 2) * pr * 2.6, g.top, pr, 0, Math.PI * 2);
        if (s.res[i] && (i !== s.idx || (s.phase === 2 && t >= end))) {
          c.fillStyle = s.res[i] === 1 ? YELLOW : spellFixed(s.res[i]) ? GOOD : PURPLE;
          c.fill();
        } else {
          c.globalAlpha = i === s.idx ? 1 : 0.3;
          c.lineWidth = i === s.idx ? 3.5 : 2;
          c.stroke();
        }
        c.restore();
      });
      c.save();
      c.globalAlpha = 0.6;
      text(c, `Λέξη ${s.idx + 1} από ${n}`, w / 2, g.top + pr + h * 0.03, h * 0.03, env.ink, 600);
      // η γραμμή όπου γράφεται η λέξη
      c.globalAlpha = 0.3;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(Math.min(x0, w * 0.2), g.base);
      c.lineTo(Math.max(x0 + m * cw, w * 0.8), g.base);
      c.stroke();
      c.restore();
      if (whole) {
        [...target].forEach((ch, i) => text(c, ch, cx(i), ry, cw * 0.95, s.peek ? BLUE : GOOD, 800));
      } else if (s.phase === 2 || eat1) {
        diff.forEach((cell, i) => {
          const k = bad.indexOf(i);
          if (k < 0) {
            text(c, cell.a!, cx(i), ry, cw * 0.95, env.ink, 700);
            return;
          }
          const eatenAt = SPELL_T0 + k * SPELL_STEP + 450;
          if (t < eatenAt) {
            // το λάθος γράμμα μικραίνει καθώς το δαγκώνει
            if (cell.a) text(c, cell.a, cx(i), ry, cw * 0.95 * Math.max(0.05, Math.min(1, (eatenAt - t) / 150)), RED, 700);
            else if (eat1) slot(i);
            return;
          }
          if (eat1) {
            // πρώτος έλεγχος: μένει κενή θέση, το σωστό δεν φαίνεται· γράμμα που περίσσευε απλώς χάνεται
            if (cell.b !== null) slot(i);
            return;
          }
          // στη θέση του το σωστό, πράσινο· από κάτω μένει σβησμένο αυτό που είχε γραφτεί
          if (cell.b) text(c, cell.b, cx(i), ry, cw * 0.95 * Math.min(1, 0.4 + (t - eatenAt) / 200), GOOD, 800);
          if (cell.a) {
            const ss = cw * 0.5, sy = g.base + ss * 0.62;
            text(c, cell.a, cx(i), sy, ss, RED, 700);
            c.save();
            c.strokeStyle = RED;
            c.lineWidth = Math.max(2, ss * 0.1);
            c.beginPath();
            c.moveTo(cx(i) - ss * 0.42, sy + ss * 0.32);
            c.lineTo(cx(i) + ss * 0.42, sy - ss * 0.32);
            c.stroke();
            c.restore();
          }
        });
      } else {
        [...s.typed].forEach((ch, i) => {
          if (s.sel === i + 1) {
            // το γράμμα που έχει πιαστεί: το επόμενο πλήκτρο το αλλάζει
            rrect(c, cx(i) - cw * 0.46, ry - cw * 0.62, cw * 0.92, cw * 1.2, cw * 0.14);
            c.save();
            c.fillStyle = BLUE;
            c.strokeStyle = BLUE;
            c.globalAlpha = 0.18;
            c.fill();
            c.globalAlpha = 1;
            c.lineWidth = 2.5;
            c.stroke();
            c.restore();
          }
          // κενή θέση: το λάθος το έφαγε το τερατάκι (ή έλειπε γράμμα)
          if (ch === '_') slot(i);
          else text(c, ch, cx(i), ry, cw * 0.95, env.ink, 700);
        });
        // πριν γραφτεί οτιδήποτε, η σημασία της λέξης φαίνεται μεγάλη πάνω στη γραμμή
        if (big) {
          c.save();
          c.globalAlpha = 0.75;
          fitText(c, hint, w / 2, ry, w * 0.075, w * 0.62, BLUE, 800);
          c.restore();
        } else if (s.phase === 0 && !s.hand && !s.sel && s.typed.length < SPELL_MAX) {
          c.save();
          c.globalAlpha = 0.5;
          c.lineWidth = 3;
          const px = s.typed ? x0 + m * cw + cw * 0.12 : w / 2;
          c.beginPath();
          c.moveTo(px, ry - cw * 0.45);
          c.lineTo(px, ry + cw * 0.45);
          c.stroke();
          c.restore();
        }
      }
      // το τερατάκι στέκεται στη γραμμή, αριστερά της λέξης· στον έλεγχο πηδά σε κάθε λάθος, το τρώει, το μασάει και μεγαλώνει· στον τελικό έλεγχο κάθεται μετά δεξιά
      const done = bad.filter((_, k) => t >= SPELL_T0 + k * SPELL_STEP + 450).length;
      const since = t - (SPELL_T0 + (done - 1) * SPELL_STEP + 450);
      // δέκατο λάθος σε αυτόν τον έλεγχο: μόλις φάει τα γράμματα, τρώει κι εσένα (fin: ms από την αρχή της σκηνής)
      const pe = prev ? spellEaten(prev.res) : eaten, cur = eaten - (res >= 10 && s.typed ? bad.length - done : 0);
      // η σκηνή αρχίζει όταν τελειώσει το φάγωμα των γραμμάτων (όπως και ο ήχος της, βλ. fx.ts): μετά το μύρισμα, ένα δάγκωμα για καθένα, και η επιστροφή
      const feast = !!prev && at < Infinity && Math.floor(eaten / SPELL_FEAST) > Math.floor(pe / SPELL_FEAST);
      const fin = feast ? spellFin(s, prev, at) : -1;
      const grown = feast && fin < SPELL_FIN ? Math.min(cur - Math.floor(pe / SPELL_FEAST) * SPELL_FEAST, SPELL_FEAST) : cur % SPELL_FEAST;
      const r = spellR(w, grown) * (done && since < 300 ? 1 + 0.2 * Math.sin((Math.PI * since) / 300) : 1);
      const home = Math.max(r + 4, (big ? w / 2 - half : x0) - r * 1.15), rest = Math.min(w - r - 4, x0 + m * cw + r * 1.15);
      const ease = (q: number): number => (q <= 0 ? 0 : q >= 1 ? 1 : q * q * (3 - 2 * q));
      let mx = s.phase === 2 ? rest : home, my = g.base - r * 1.1, open = s.phase === 1 ? 0.35 : 0;
      if (t < end + 400 && bad.length) {
        const k = Math.max(0, Math.min(bad.length - 1, Math.floor((t - SPELL_T0) / SPELL_STEP)));
        const ts = SPELL_T0 + k * SPELL_STEP, from = k === 0 ? home : cx(bad[k - 1]), to = cx(bad[k]);
        if (t >= end) {
          mx = to + ((eat1 ? home : rest) - to) * ease((t - end) / 400);
        } else {
          const q = ease((t - ts) / 300);
          mx = from + (to - from) * q;
          my -= Math.sin(q * Math.PI) * r * 0.8;
          const u = t - ts - 450;
          open = u < 0 ? Math.min(1, Math.max(0, (u + 300) / 200)) : 0.4 * Math.abs(Math.sin(u / 45)) * Math.max(0, 1 - u / 350);
          // πριν ξεκινήσει μυρίζει: κουνιέται με το στόμα μισάνοιχτο
          if (eat1 && t < SPELL_T0) {
            mx += Math.sin(at / 45) * r * 0.12;
            open = 0.6;
          }
        }
      } else if (s.phase === 2 && (res < 10 || spellFixed(res)) && at < 1200) {
        // σωστή λέξη: χοροπηδά
        my -= Math.abs(Math.sin(at / 130)) * r * 0.5 * (1 - at / 1200);
      } else if (s.phase < 2 && at < 200) {
        my -= Math.sin((Math.PI * at) / 200) * r * 0.12;
      }
      const feasting = feast && fin >= 0 && fin < SPELL_FIN;
      if (!feasting) monster(c, mx, my, r, open);
      // τι λέει το τερατάκι
      const marked = s.marks.filter(Boolean).length;
      const said = feasting ? ''
        : restarted && s.phase === 0 && !s.typed ? `Πάμε πάλι από την αρχή! ${s.peek ? 'Δες καλά τη λέξη!' : hint ? `Γράψε: ${hint}` : 'Πάτα 🔊 για την πρώτη λέξη.'}`
        : s.peek ? `Δες καλά τη λέξη! ${s.hand ? 'Πάτα το 👁 για να κρυφτεί και γράψε την.' : 'Μόλις πατήσεις γράμμα, κρύβεται.'}`
        : s.phase === 0 && hint ? `${/[a-z]/.test(target) ? 'Γράψε στα αγγλικά' : 'Γράψε'}: ${hint}`
        : s.phase === 0 ? (s.hand ? 'Γράψε με το μολύβι στο πλαίσιο αυτό που ακούς και πάτα «Έλεγχος»' : s.typed ? '' : 'Γράψε με τα γράμματα αυτό που ακούς')
        : eat1 ? (t < SPELL_T0 ? `Χμ… μυρίζω ${lathi(bad.length)}!` : 'Μιαμ…')
        : s.phase === 1 ? `Μιαμ! Έφαγα ${lathi(spellAte(res))}. ${s.hand ? 'Σβήσε, γράψε ξανά τη λέξη σωστά και πάτα «Έλεγχος».' : marked ? 'Γράψε το σωστό γράμμα στα κενά.' : 'Δες τη λέξη και πάτα ξανά «Έλεγχος».'}`
        : s.phase === 3 ? 'Έτσι γράφεται. Την έγραψες σωστά;'
        : t < end ? 'Μιαμ…'
        : res === 1 ? 'Τέλεια, με την πρώτη! Το τερατάκι έμεινε νηστικό.'
        : spellFixed(res) ? 'Μπράβο, το διόρθωσες!'
        : !s.typed ? 'Μιαμ! Δες πώς γράφεται και πάμε παρακάτω.'
        : `Το τερατάκι έφαγε ${lathi(bad.length)} και μεγάλωσε!`;
      if (said) fitText(c, said, w / 2, g.msg, h * 0.04, w * 0.94, s.peek || (s.phase === 0 && hint) ? BLUE : s.phase === 1 || (s.phase === 2 && res >= 10 && !spellFixed(res)) ? ORANGE : s.phase === 2 && t >= end ? GOOD : env.ink, 700);
      const live = s.phase < 2 && !feasting;
      if (s.hand) {
        // πλαίσιο για γραφή με το χέρι: γραμμές τετραδίου
        rrect(c, g.kx + 3, g.ky + 3, g.kw * 10 - 6, g.kh * 4 - 6, g.kh * 0.2);
        c.save();
        c.fillStyle = env.ink;
        c.globalAlpha = 0.05;
        c.fill();
        c.globalAlpha = 0.5;
        c.lineWidth = 1.5;
        c.stroke();
        c.globalAlpha = 0.22;
        c.beginPath();
        for (const q of [0.4, 0.75]) { c.moveTo(g.kx + g.kw * 0.3, g.ky + g.kh * 4 * q); c.lineTo(g.kx + g.kw * 9.7, g.ky + g.kh * 4 * q); }
        c.stroke();
        c.restore();
      }
      // πλήκτρα
      const en = spellIsEn(target);
      for (const k of s.hand ? [] : spellKeyboard(g, en)) {
        // ο τόνος ανάβει όσο περιμένει φωνήεν· το «;» είναι μόνο για τη θέση των γραμμάτων
        const tint = k.key === '⌫' || k.key === '΄', on = k.key === '΄' && s.acc > 0, idle = k.key === ';';
        rrect(c, k.x + 3, k.y + 3, k.w - 6, k.h - 6, g.kh * 0.2);
        c.save();
        c.fillStyle = tint ? ORANGE : env.ink;
        c.globalAlpha = !live || idle ? 0.05 : on ? 0.85 : tint ? 0.3 : 0.14;
        c.fill();
        c.globalAlpha = !live || idle ? 0.35 : 1;
        c.lineWidth = on ? 3 : 1.5;
        c.stroke();
        if (k.key === ' ') fitText(c, en ? 'space' : 'κενό', k.x + k.w / 2, k.y + k.h / 2 + 1, g.kh * 0.4, k.w * 0.8, env.ink, 600);
        else text(c, k.key === '΄' ? SPELL_ACC_KEY[s.acc] : k.key, k.x + k.w / 2, k.y + k.h / 2 + 1 + (k.key === '΄' ? g.kh * 0.12 : 0), g.kh * (k.key === '΄' ? 0.9 : 0.6), on ? '#ffffff' : env.ink, 700);
        c.restore();
      }
      btn(g.bx[0], g.by, g.bw[0], g.bh, '✏️ Λέξεις', BLUE);
      btn(g.bx[1], g.by, g.bw[1], g.bh, '👁', s.peek ? ORANGE : '#64748b', live);
      // το κουμπί δείχνει τον άλλο τρόπο γραφής, αυτόν στον οποίο θα σε πάει
      btn(g.bx[2], g.by, g.bw[2], g.bh, '🔊', '#0d9488');
      btn(g.bx[3], g.by, g.bw[3], g.bh, s.hand ? '⌨️ Πλήκτρα' : '✍️ Με το χέρι', '#64748b', s.phase === 0);
      if (s.phase === 3) {
        btn(g.bx[4], g.by, g.bw[4] * 0.49, g.bh, '✓ Σωστά', GOOD);
        btn(g.bx[4] + g.bw[4] * 0.51, g.by, g.bw[4] * 0.49, g.bh, '✗ Λάθος', RED);
      } else if (s.phase === 2) {
        btn(g.bx[4], g.by, g.bw[4], g.bh, s.idx + 1 < n ? '▶ Επόμενη λέξη' : '🏁 Αποτελέσματα', PURPLE);
      } else {
        btn(g.bx[4], g.by, g.bw[4], g.bh, s.phase === 1 ? '🔍 Έλεγχος ξανά' : '🔍 Έλεγχος', GOOD, s.hand || !!spellNorm(s.typed, SPELL_MAX));
      }
      if (feasting) spellFeast(c, w, h, fin, { x: mx, y: my, r }, { x: mx, y: g.base - spellR(w, eaten % SPELL_FEAST) * 1.1, r: spellR(w, eaten % SPELL_FEAST) });
    },
    ask(v, x, y, w, h) {
      const s = spellLive(v), g = spellGeom(w, h);
      if (!s.words.length) {
        if (x < w * 0.2 || x > w * 0.8 || y < h * 0.72 || y > h * 0.86) return null;
        return {
          title: s.en ? 'Οι λέξεις ή οι προτάσεις (Αγγλικά)' : 'Οι λέξεις ή οι προτάσεις της ορθογραφίας',
          hint: `Χωρισμένες με κόμμα${s.en ? ': apple, school, good morning. Με «=» βάζεις τη σημασία που θα βλέπει ο μαθητής: apple=μήλο' : ', με τους τόνους τους: μήλο, σχολείο, καλή μέρα'}. Έως 20, η καθεμία έως 40 γράμματα. Με το 🎤 τις λες αντί να τις γράψεις: κάθε φορά που μιλάς μπαίνει μία. Φαίνονται ως κουκκίδες, για να μη τις δουν οι μαθητές· το 👁 τις δείχνει.`,
          secret: true, max: 840, voice: s.en ? 'en-GB' : 'el-GR', lists: true,
          apply(typed) {
            const list = spellList(typed);
            return list.words.length ? spellPack(spellStart(s, list.words, false, list.hints)) : null;
          },
        };
      }
      if (!s.hand || s.idx >= s.words.length) return null;
      // με το χέρι: ο «Έλεγχος» διαβάζει ό,τι γράφτηκε στο πλαίσιο· όποιο κουμπί αλλάζει λέξη ή τρόπο γραφής το σβήνει
      const k = spellBtn(g, x, y), area = { x: g.kx, y: g.ky, w: g.kw * 10, h: g.kh * 4 };
      const clear = (next: Spell): KidAsk => ({ title: '', area, mode: 'clear', apply: () => spellPack(next) });
      if (k === 0) return clear({ ...SPELL_EMPTY, hand: true, en: s.en });
      if (k === 3 && s.phase === 0) return clear({ ...s, hand: false });
      if (k === 4 && s.phase === 2) return clear(spellNext(s));
      if (k === 4 && s.phase < 2) {
        return {
          title: '', area, mode: 'read',
          // χωρίς ανάγνωση (δεν υπάρχει κλειδί ή ίντερνετ): φαίνεται η σωστή λέξη και η τάξη τη συγκρίνει με το χειρόγραφο
          apply: (read) => spellPack(spellCheck(s, read) ?? { ...s, phase: 3, peek: false, typed: '', marks: [], sel: 0 }),
        };
      }
      return null;
    },
    tap(v, x, y, w, h) {
      let s = spellLive(v);
      const g = spellGeom(w, h);
      if (!s.words.length) {
        if (y >= h * 0.385 && y <= h * 0.47 && x >= w * 0.3 && x <= w * 0.7) return s.en === x > w * 0.5 ? null : spellPack({ ...s, en: !s.en });
        const k = Math.floor((x / w - 0.06) / 0.15);
        if (y < h * 0.5 || y > h * 0.64 || k < 0 || k > 5 || x > w * (0.06 + 0.15 * k + 0.13)) return null;
        const pool = [...(s.en ? SPELL_READY_EN : SPELL_READY)[k]], picked: string[][] = [];
        while (picked.length < SPELL_PICK && pool.length) picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].split('='));
        return spellPack(spellStart(s, picked.map((e) => e[0]), true, picked.map((e) => e[1] ?? '')));
      }
      if (s.idx >= s.words.length) {
        if (y < g.by || y > g.by + g.bh) return null;
        if (x >= w * 0.02 && x <= w * 0.49) return spellPack(spellStart(s, s.words, s.ready, s.hints));
        return x >= w * 0.51 && x <= w * 0.98 ? spellPack({ ...SPELL_EMPTY, hand: s.hand, en: s.en }) : null;
      }
      const k = spellBtn(g, x, y);
      if (k === 0) return s.hand ? null : spellPack({ ...SPELL_EMPTY, en: s.en });
      if (k === 1) return s.phase < 2 ? spellPack({ ...s, peek: !s.peek }) : null;
      if (k === 2) return spellPack({ ...s, said: !s.said });
      if (k === 3) return s.phase === 0 && !s.hand ? spellPack({ ...s, hand: true, typed: '', marks: [], sel: 0 }) : null;
      if (k === 4) {
        if (s.phase === 3) {
          const right = x < g.bx[4] + g.bw[4] / 2, res = [...s.res], ate = spellAte(res[s.idx] ?? 0);
          res[s.idx] = right ? (ate ? 100 + ate : 1) : 11 + ate;
          return spellPack({ ...s, phase: 2, typed: right ? s.words[s.idx] : '', res });
        }
        // με το χέρι τα υπόλοιπα τα χειρίζεται το ask (διάβασμα και καθάρισμα του πλαισίου)
        if (s.hand) return null;
        if (s.phase === 2) return spellPack(spellNext(s));
        const next = spellCheck(s, s.typed);
        return next && spellPack(next);
      }
      // το πλαίσιο της γραφής με το χέρι δεν είναι κουμπί: εκεί γράφει το μολύβι
      if (s.hand || s.phase > 1) return null;
      const lay = spellLay(w, s.typed.length, spellEaten(s.res));
      if (!s.peek && y >= g.base - lay.cw * 1.25 && y <= g.base + lay.cw * 0.25) {
        // πάτημα σε γράμμα το πιάνει για αλλαγή· δεύτερο πάτημα το αφήνει
        const i = Math.floor((x - lay.x0) / lay.cw);
        return i >= 0 && i < s.typed.length ? spellPack({ ...s, sel: s.sel === i + 1 ? 0 : i + 1 }) : null;
      }
      const hit = spellKeyboard(g, spellIsEn(s.words[s.idx])).find((k) => x >= k.x && x < k.x + k.w && y >= k.y && y < k.y + k.h);
      if (!hit || hit.key === ';') return null;
      // νεκρό πλήκτρο: τόνος → διαλυτικά → και τα δύο → τίποτα· το επόμενο φωνήεν το παίρνει
      if (hit.key === '΄') return spellPack({ ...s, acc: (s.acc + 1) % 4 });
      if (hit.key === '⌫' && s.acc) return spellPack({ ...s, acc: 0 });
      const key = SPELL_ACC[s.acc].get(hit.key) ?? hit.key;
      s = { ...s, acc: 0 };
      const chars = [...s.typed], marks = chars.map((_, j) => !!s.marks[j]), i = s.sel - 1, held = i >= 0 && i < chars.length;
      // μετά την αλλαγή: στη διόρθωση πιάνεται το επόμενο σημαδεμένο γράμμα, αλλιώς η γραφή συνεχίζει στο τέλος
      const after = (from: number): number => (s.phase === 1 ? Math.max(marks.findIndex((on, j) => on && j >= from), marks.indexOf(true)) + 1 : 0);
      if (key === '⌫') {
        if (!chars.length) return null;
        const j = held ? i : chars.length - 1;
        chars.splice(j, 1);
        marks.splice(j, 1);
        return spellPack({ ...s, peek: false, typed: chars.join(''), marks, sel: held ? after(j) : 0 });
      }
      if (held) {
        chars[i] = key;
        marks[i] = false;
        return spellPack({ ...s, peek: false, typed: chars.join(''), marks, sel: after(i + 1) });
      }
      if (chars.length >= SPELL_MAX) return null;
      return spellPack({ ...s, peek: false, typed: s.typed + key, marks, sel: 0 });
    },
    fx(a, b) {
      const p = spellLive(a), n = spellState(b);
      const playing = n.idx < n.words.length;
      // νέα λέξη (ή το 🔊): η εφαρμογή τη λέει δυνατά
      if (playing && (p.words.join() !== n.words.join() || p.idx !== n.idx || p.said !== n.said)) return spellSay(n);
      if (p.words.join() !== n.words.join() || p.hand !== n.hand || p.en !== n.en) return 'new';
      if (!playing) return n.words.length && p.idx < n.idx ? 'win' : 'new';
      // όσα λάθη έφαγε μόλις τώρα: ένα δάγκωμα για το καθένα, συγχρονισμένο με την κίνηση
      const ate = Math.min(spellEaten(n.res) - spellEaten(p.res), 12);
      // δέκατο λάθος: στο τέλος του φαγώματος, τρώει κι εσένα
      const x = Math.floor(spellEaten(n.res) / SPELL_FEAST) > Math.floor(spellEaten(p.res) / SPELL_FEAST) ? 'x' : '';
      if (n.phase === 2 && p.phase !== 2) {
        const res = n.res[n.idx];
        return res === 1 ? 'win' : spellFixed(res) ? 'cheer' : `munch${n.typed ? ate : x ? 0 : 1}${x}`;
      }
      return n.phase === 1 && p.phase === 0 ? `sniff${ate}${x}` : 'click';
    },
  }),
};

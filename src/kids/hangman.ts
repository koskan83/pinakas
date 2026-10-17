/** Κρεμάλα. */
import type { StampDef } from '../stamps';
import { bit, BLUE, GREEN, kid, RED, rrect, text } from './common';

const ABC = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ';
const HANG_MAX = 6;
/** Λέξεις για την τυχαία επιλογή: γνωστές σε παιδιά Δημοτικού, χωρίς παγίδες στην ορθογραφία του τονισμού. */
const HANG_WORDS = [
  'ΣΧΟΛΕΙΟ', 'ΔΑΣΚΑΛΑ', 'ΜΟΛΥΒΙ', 'ΤΕΤΡΑΔΙΟ', 'ΒΙΒΛΙΟ', 'ΘΡΑΝΙΟ', 'ΠΙΝΑΚΑΣ', 'ΤΣΑΝΤΑ', 'ΓΟΜΟΛΑΣΤΙΧΑ', 'ΔΙΑΛΕΙΜΜΑ',
  'ΠΕΤΑΛΟΥΔΑ', 'ΕΛΕΦΑΝΤΑΣ', 'ΚΑΜΗΛΟΠΑΡΔΑΛΗ', 'ΔΕΛΦΙΝΙ', 'ΧΕΛΩΝΑ', 'ΒΑΤΡΑΧΟΣ', 'ΛΙΟΝΤΑΡΙ', 'ΑΛΕΠΟΥ', 'ΣΚΙΟΥΡΟΣ', 'ΠΑΠΑΓΑΛΟΣ',
  'ΚΑΡΠΟΥΖΙ', 'ΠΟΡΤΟΚΑΛΙ', 'ΦΡΑΟΥΛΑ', 'ΜΠΑΝΑΝΑ', 'ΣΟΚΟΛΑΤΑ', 'ΜΑΚΑΡΟΝΙΑ', 'ΠΑΓΩΤΟ', 'ΝΤΟΜΑΤΑ',
  'ΘΑΛΑΣΣΑ', 'ΟΥΡΑΝΟΣ', 'ΦΕΓΓΑΡΙ', 'ΣΥΝΝΕΦΟ', 'ΒΡΟΧΗ', 'ΑΝΟΙΞΗ', 'ΚΑΛΟΚΑΙΡΙ', 'ΧΕΙΜΩΝΑΣ', 'ΦΘΙΝΟΠΩΡΟ',
  'ΠΟΔΗΛΑΤΟ', 'ΑΕΡΟΠΛΑΝΟ', 'ΚΑΡΑΒΙ', 'ΑΥΤΟΚΙΝΗΤΟ', 'ΠΑΙΧΝΙΔΙ', 'ΟΙΚΟΓΕΝΕΙΑ', 'ΓΙΟΡΤΗ', 'ΜΟΥΣΙΚΗ', 'ΖΩΓΡΑΦΙΑ', 'ΥΠΟΛΟΓΙΣΤΗΣ',
];
/** Κεφαλαία χωρίς τόνους και διαλυτικά: «Σχολείο» → «ΣΧΟΛΕΙΟ». */
export function hangNorm(word: string): string {
  return word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^Α-Ω ]/g, '').trim().slice(0, 16);
}
/** Νέα παρτίδα: όπως παίζεται στην τάξη, το πρώτο και το τελευταίο γράμμα φαίνονται από την αρχή (όπου κι αν ξαναβγαίνουν). */
export function hangStart(word: string): number[] {
  const w = hangNorm(word);
  const letters = w.replace(/ /g, '');
  if (letters.length < 2) return [0];
  let mask = 0;
  for (const ch of [letters[0], letters[letters.length - 1]]) mask |= 1 << ABC.indexOf(ch);
  return [mask, ...[...w].map((ch) => ch.charCodeAt(0))];
}
/** Πού βρίσκεται η παρτίδα: η λέξη, τα λάθη ως τώρα, αν βρέθηκε ή χάθηκε. */
export function hangState(v: number[]): { word: string; mask: number; wrong: number; won: boolean; lost: boolean } {
  const word = String.fromCharCode(...v.slice(1));
  const mask = v[0] ?? 0;
  let wrong = 0;
  for (let i = 0; i < ABC.length; i++) if (mask & (1 << i) && !word.includes(ABC[i])) wrong++;
  const won = word.length > 0 && [...word].every((ch) => ch === ' ' || mask & (1 << ABC.indexOf(ch)));
  return { word, mask, wrong, won, lost: wrong >= HANG_MAX };
}
/** Διάταξη: αριστερά η κρεμάλα, δεξιά η λέξη, τα γράμματα και τα δύο κουμπιά. */
function hangGeom(w: number, h: number): { kx: number; ky: number; kw: number; kh: number; by: number; bh: number; bx: [number, number]; bw: number } {
  const kx = w * 0.36, kw = (w * 0.62) / 8, ky = h * 0.4, kh = h * 0.13;
  return { kx, ky, kw, kh, by: h * 0.84, bh: h * 0.12, bx: [w * 0.37, w * 0.68], bw: w * 0.29 };
}

export const HANGMAN_KIDS: Record<string, StampDef> = {
  hangman: kid({
    label: 'Κρεμάλα', w: 800, h: 480, init: [0],
    drawKid(c, w, h, v, env) {
      const st = hangState(v), g = hangGeom(w, h);
      c.lineCap = 'round';
      c.lineJoin = 'round';
      // η κρεμάλα
      c.lineWidth = Math.max(5, w * 0.012);
      c.beginPath();
      c.moveTo(w * 0.03, h * 0.92); c.lineTo(w * 0.27, h * 0.92);
      c.moveTo(w * 0.09, h * 0.92); c.lineTo(w * 0.09, h * 0.08); c.lineTo(w * 0.23, h * 0.08); c.lineTo(w * 0.23, h * 0.18);
      c.moveTo(w * 0.09, h * 0.2); c.lineTo(w * 0.14, h * 0.08);
      c.stroke();
      // ο ανθρωπάκος: ένα κομμάτι για κάθε λάθος (κεφάλι, σώμα, χέρια, πόδια)
      const hx = w * 0.23, r = h * 0.07;
      c.lineWidth = Math.max(4, w * 0.008);
      c.save();
      // μόλις άλλαξε κάτι: λάθος γράμμα κουνάει τον ανθρωπάκο, σωστό «σκάει» στη θέση του
      const an = env.anim, was = an ? hangState(an.prev) : null;
      const fresh = an && was && was.word === st.word ? an : null;
      if (fresh && st.wrong > was!.wrong && fresh.t < 450) c.translate(Math.sin(fresh.t / 28) * w * 0.012 * (1 - fresh.t / 450), 0);
      c.strokeStyle = st.lost ? RED : env.ink;
      c.beginPath();
      if (st.wrong > 0) { c.moveTo(hx + r, h * 0.18 + r); c.arc(hx, h * 0.18 + r, r, 0, Math.PI * 2); }
      if (st.wrong > 1) { c.moveTo(hx, h * 0.18 + r * 2); c.lineTo(hx, h * 0.56); }
      if (st.wrong > 2) { c.moveTo(hx, h * 0.38); c.lineTo(hx - w * 0.05, h * 0.47); }
      if (st.wrong > 3) { c.moveTo(hx, h * 0.38); c.lineTo(hx + w * 0.05, h * 0.47); }
      if (st.wrong > 4) { c.moveTo(hx, h * 0.56); c.lineTo(hx - w * 0.045, h * 0.72); }
      if (st.wrong > 5) { c.moveTo(hx, h * 0.56); c.lineTo(hx + w * 0.045, h * 0.72); }
      c.stroke();
      c.restore();
      if (!st.word) {
        text(c, 'Πάτα 🎲 για μια λέξη', w * 0.67, h * 0.2, h * 0.075, env.ink, 700);
        text(c, 'ή ✏️ για να γράψεις τη δική σου', w * 0.67, h * 0.3, h * 0.05, env.ink, 500);
      } else {
        // η λέξη: γράμμα ή παύλα· όταν χαθεί η παρτίδα φαίνονται κόκκινα όσα δεν βρέθηκαν
        const n = st.word.length, cw = Math.min(w * 0.075, (w * 0.62) / n), x0 = w * 0.67 - (cw * n) / 2, y = h * 0.2;
        [...st.word].forEach((ch, i) => {
          if (ch === ' ') return;
          const cx = x0 + cw * (i + 0.5), open = (st.mask & (1 << ABC.indexOf(ch))) !== 0;
          const bit = 1 << ABC.indexOf(ch);
          const pop = fresh && open && !(was!.mask & bit) && fresh.t < 380 ? 1 + 0.9 * (1 - fresh.t / 380) : 1;
          if (open || st.lost) text(c, ch, cx, y, cw * 0.82 * pop, open ? (pop > 1 ? GREEN : env.ink) : RED, 700);
          c.beginPath();
          c.moveTo(cx - cw * 0.36, y + cw * 0.6);
          c.lineTo(cx + cw * 0.36, y + cw * 0.6);
          c.lineWidth = Math.max(3, cw * 0.07);
          c.stroke();
        });
        if (st.won) text(c, '🎉 Μπράβο!', w * 0.67, h * 0.035, h * 0.06, GREEN, 800);
        else if (st.lost) text(c, 'Τέλος! Η λέξη ήταν:', w * 0.67, h * 0.035, h * 0.05, RED, 700);
        else text(c, `Λάθη: ${st.wrong} από ${HANG_MAX}`, w * 0.67, h * 0.035, h * 0.045, env.ink, 600);
      }
      // τα γράμματα: σωστά πράσινα, λάθος γκρίζα με γραμμή
      for (let i = 0; i < ABC.length; i++) {
        const x = g.kx + (i % 8) * g.kw, y = g.ky + Math.floor(i / 8) * g.kh;
        const used = (st.mask & (1 << i)) !== 0, hit = used && st.word.includes(ABC[i]);
        rrect(c, x + 3, y + 3, g.kw - 6, g.kh - 6, g.kh * 0.2);
        c.save();
        c.fillStyle = hit ? GREEN : env.ink;
        c.globalAlpha = hit ? 0.85 : used ? 0.06 : 0.14;
        c.fill();
        c.restore();
        c.save();
        c.globalAlpha = used && !hit ? 0.3 : 1;
        c.lineWidth = 1.5;
        c.stroke();
        text(c, ABC[i], x + g.kw / 2, y + g.kh / 2 + 1, g.kh * 0.5, hit ? '#ffffff' : env.ink, 700);
        c.restore();
      }
      [['🎲 Νέα λέξη', 0], ['✏️ Δική μου λέξη', 1]].forEach(([label, k]) => {
        const x = g.bx[k as number];
        rrect(c, x, g.by, g.bw, g.bh, g.bh * 0.3);
        c.save();
        c.fillStyle = BLUE;
        c.globalAlpha = 0.9;
        c.fill();
        c.restore();
        text(c, label as string, x + g.bw / 2, g.by + g.bh / 2 + 1, g.bh * 0.42, '#ffffff', 700);
      });
    },
    ask(_v, x, y, w, h) {
      const g = hangGeom(w, h);
      if (y < g.by || y > g.by + g.bh || x < g.bx[1] || x > g.bx[1] + g.bw) return null;
      return {
        title: 'Λέξη για την κρεμάλα',
        hint: 'Από 2 έως 16 γράμματα. Φαίνεται ως κουκκίδες, για να μη τη δουν οι μαθητές.',
        secret: true,
        apply(typed) {
          const next = hangStart(typed);
          return next.length > 1 ? next : null;
        },
      };
    },
    tap(v, x, y, w, h) {
      const st = hangState(v), g = hangGeom(w, h);
      if (y >= g.by && y <= g.by + g.bh) {
        if (x >= g.bx[0] && x <= g.bx[0] + g.bw) {
          let word = HANG_WORDS[Math.floor(Math.random() * HANG_WORDS.length)];
          if (word === st.word) word = HANG_WORDS[(HANG_WORDS.indexOf(word) + 1) % HANG_WORDS.length];
          return hangStart(word);
        }
        return null;
      }
      if (!st.word || st.won || st.lost) return null;
      const col = Math.floor((x - g.kx) / g.kw), row = Math.floor((y - g.ky) / g.kh);
      if (col < 0 || col > 7 || row < 0 || row > 2) return null;
      const i = row * 8 + col;
      if (st.mask & (1 << i)) return null;
      return [st.mask | (1 << i), ...v.slice(1)];
    },
    fx(prev, next) {
      const p = hangState(prev), n = hangState(next);
      if (p.word !== n.word) return 'new';
      if (n.won && !p.won) return 'win';
      if (n.lost && !p.lost) return 'lose';
      return n.wrong > p.wrong ? 'bad' : 'good';
    },
  }),
};

/**
 * Χωρισμός ελληνικών λέξεων σε συλλαβές, με τους κανόνες της σχολικής γραμματικής (χωρίς ίντερνετ):
 * - τα αι, ει, οι, υι, ου, αυ, ευ, ηυ δεν χωρίζουν (εκτός αν το πρώτο έχει τόνο ή το δεύτερο διαλυτικά: τσά-ι, κο-ρο-ϊ-δεύ-ω)
 * - ένα σύμφωνο ανάμεσα σε φωνήεντα πάει στην επόμενη συλλαβή· δύο ή περισσότερα πάνε μαζί στην επόμενη
 *   αν τα δύο πρώτα μπορούν να αρχίσουν ελληνική λέξη (ά-στρο, κα-ρέ-κλα, κου-μπί), αλλιώς χωρίζουν (άλ-μα, θά-λασ-σα, άν-θρω-πος)
 * - συνίζηση: άτονο ι, υ, οι πριν από φωνήεν προφέρεται μαζί του (παι-διά, ή-λιος, για-γιά, ποιος), όχι όμως στην αρχή της λέξης
 *   (Ι-ού-νιος), στο «ει» (α-λή-θει-α) και στα ουδέτερα σε -ιο με τόνο πιο πριν (τε-τρά-δι-ο, δω-μά-τι-ο)
 * Όπου η προφορά διαφέρει (π.χ. βι-βλι-ο-θή-κη), ο δάσκαλος γράφει τη λέξη με παύλες (βλ. kids/syllables.ts).
 */

const VOWELS = 'αεηιουωάέήίόύώϊϋΐΰ';
const ACCENTED = 'άέήίόύώΐΰ';
/** Ζευγάρια συμφώνων με τα οποία αρχίζουν ελληνικές λέξεις. */
const ONSETS = new Set(
  'βγ βδ βλ βρ γδ γκ γλ γν γρ δρ θλ θν θρ κλ κν κρ κτ μν μπ ντ πλ πν πρ πτ σβ σγ σθ σκ σλ σμ σν σπ στ σφ σχ τζ τμ τρ τσ φθ φκ φλ φν φρ φτ χθ χλ χν χρ χτ'.split(' '),
);

const plain = (ch: string): string => ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace('ς', 'σ');
const isVowel = (ch: string): boolean => VOWELS.includes(ch.toLowerCase());

/** Δύο φωνήεντα που γράφονται μαζί και λέγονται ως ένας ήχος (ή ως αβ/εβ). */
function digraph(a: string, b: string): boolean {
  const la = a.toLowerCase(), lb = b.toLowerCase();
  if (ACCENTED.includes(la) || 'ϊϋΐΰ'.includes(lb)) return false;
  const p = plain(la) + plain(lb);
  return ['αι', 'ει', 'οι', 'υι', 'ου', 'αυ', 'ευ', 'ηυ'].includes(p);
}

/**
 * Πού αρχίζει κάθε συλλαβή: οι θέσεις των γραμμάτων (η πρώτη είναι πάντα 0).
 * Μη ελληνικά γράμματα μετρούν ως σύμφωνα. Λέξη χωρίς φωνήεν είναι μία συλλαβή.
 */
export function syllableStarts(word: string): number[] {
  const ch = [...word];
  // πυρήνες: [αρχή, τέλος) από φωνήεντα που λέγονται σε μία συλλαβή
  const nuclei: [number, number][] = [];
  for (let i = 0; i < ch.length; ) {
    if (!isVowel(ch[i])) { i++; continue; }
    let j = i + 1;
    if (j < ch.length && isVowel(ch[j]) && digraph(ch[i], ch[j])) j++;
    nuclei.push([i, j]);
    i = j;
  }
  // συνίζηση: άτονος πυρήνας ι / υ / οι / υι αμέσως πριν από φωνήεν ενώνεται μαζί του
  const merged: [number, number][] = [];
  for (const n of nuclei) {
    const prev = merged[merged.length - 1];
    if (prev && prev[1] === n[0]) {
      const p = ch.slice(prev[0], prev[1]).join('');
      const neuterIo = n[1] === ch.length && plain(ch[n[0]]) === 'ο' && plain(p) === 'ι' && /[άέήίόύώ]/.test(word);
      const glide = !/[άέήίόύώΐΰ]/.test(p) && ['ι', 'υ', 'οι', 'υι'].includes(plain(p.toLowerCase())) && prev[0] !== 0 && !neuterIo;
      if (glide) { prev[1] = n[1]; continue; }
    }
    merged.push([n[0], n[1]]);
  }
  if (merged.length < 2) return [0];
  const starts = [0];
  for (let k = 1; k < merged.length; k++) {
    const a = merged[k - 1][1], b = merged[k][0];
    // σύμφωνα ανάμεσα: [a, b)
    const n = b - a;
    let cut = a;
    if (n > 1) {
      cut = b - 1;
      for (let i = a; i < b - 1; i++) {
        if (ONSETS.has(plain(ch[i]) + plain(ch[i + 1]))) { cut = i; break; }
      }
    }
    starts.push(cut);
  }
  return starts;
}

/** Η λέξη σε συλλαβές: «βάτραχος» → ['βά', 'τρα', 'χος']. */
export function syllables(word: string): string[] {
  const ch = [...word], s = syllableStarts(word);
  return s.map((a, i) => ch.slice(a, s[i + 1] ?? ch.length).join(''));
}

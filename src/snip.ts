/**
 * «Ψαλίδι πάνω από άλλες εφαρμογές» (μόνο στο Android, π.χ. BenQ Board).
 * Μια σελίδα web δεν μπορεί να βάλει κουμπί πάνω από άλλες εφαρμογές ούτε να τραβήξει στιγμιότυπό τους·
 * το κάνει ο μικρός βοηθός του φακέλου `android-snip/`, που ανοίγει/κλείνει από εδώ με σύνδεσμο intent://.
 * Ό,τι κόβεις με τον κύκλο έρχεται πίσω με «Κοινοποίηση» (share_target, βλ. sw.js) στο ανοιχτό μάθημα.
 */
import { isNative } from './native';

const KEY = 'grafida.snip';
/** Αν ο βοηθός δεν είναι εγκατεστημένος, ο Chrome ανοίγει αυτό αντί για τον βοηθό (κατέβασμα του APK). */
export const SNIP_APK = 'https://github.com/koskan83/prismaboard/releases/download/prismasnip/PrismaBoard-psalidi.apk';

/**
 * Android; και στις μεγάλες οθόνες (BenQ Board), όπου ο Chrome ζητά μόνος του «έκδοση για υπολογιστές»
 * και το userAgent λέει Linux αντί για Android: τότε το καταλαβαίνουμε από την αφή.
 */
function isAndroid(): boolean {
  const ua = navigator.userAgent;
  const platform = (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ?? '';
  return /Android/i.test(ua) || /Android/i.test(platform) || (/Linux/i.test(ua) && !/CrOS/i.test(ua) && navigator.maxTouchPoints > 0);
}

export const snipAvailable = !isNative && isAndroid();

let on = false;

function mark(): void {
  document.querySelector('[data-act=snip]')?.classList.toggle('on', on);
}

/** Εμφανίζει τον διακόπτη στις Ρυθμίσεις, μόνο όπου έχει νόημα. */
export function initSnip(): void {
  if (!snipAvailable) return;
  try {
    on = localStorage.getItem(KEY) === '1';
  } catch {
    /* χωρίς αποθήκευση: ξεκινά κλειστό */
  }
  document.querySelector('[data-act=snip]')?.classList.remove('hidden');
  mark();
}

export function toggleSnip(): void {
  on = !on;
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* χωρίς αποθήκευση */
  }
  mark();
  location.href = `intent://${on ? 'on' : 'off'}#Intent;scheme=prismasnip;package=gr.grafida.prismasnip;S.browser_fallback_url=${encodeURIComponent(SNIP_APK)};end`;
}

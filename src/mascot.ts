/**
 * Το τερατάκι 👾, η μασκότ του PrismaBoard: το ίδιο που τρώει τα λάθη στην Ορθογραφία.
 * Χαιρετά στο «Τι κάνουμε σήμερα;» και στη γνωριμία, και στο Δημοτικό πετάγεται να πανηγυρίσει τις επιτυχίες.
 */

import { monster } from './kids';

const still = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Καμβάς με το τερατάκι, μεγέθους `size` px, που ανασαίνει (ανεβοκατεβαίνει λίγο).
 * `talk`: για τόσα δευτερόλεπτα από την αρχή ανοιγοκλείνει το στόμα του, σαν να μιλά.
 */
export function mascot(size: number, talk = 0): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.className = 'mascot';
  const dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = cv.height = Math.round(size * dpr);
  cv.style.width = cv.style.height = `${size}px`;
  cv.setAttribute('aria-hidden', 'true');
  const c = cv.getContext('2d');
  if (!c) return cv;
  const t0 = performance.now();
  const frame = (now: number): void => {
    const t = (now - t0) / 1000, calm = still();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, size, size);
    const bob = calm ? 0 : Math.sin(t * 2.4) * size * 0.025;
    const open = t < talk && !calm ? 0.45 + 0.45 * Math.sin(t * 13) : 0.12;
    monster(c, size / 2, size * 0.55 + bob, size * 0.3, Math.max(0, open));
    if (calm) return;
    // όσο δεν φαίνεται, ξαναδοκιμάζει αραιά· όταν βγει από τη σελίδα, σταματά
    if (cv.isConnected && cv.offsetParent) requestAnimationFrame(frame);
    else if (cv.isConnected || now - t0 < 2000) setTimeout(() => requestAnimationFrame(frame), 400);
  };
  requestAnimationFrame(frame);
  return cv;
}

const CHEERS = ['Μπράβο!', 'Τέλεια!', 'Σούπερ!', 'Ναι!', 'Υπέροχα!'];
let popping: HTMLElement | null = null;

/** Το τερατάκι πετάγεται κάτω αριστερά με ένα συννεφάκι («Μπράβο!») και φεύγει μόνο του. */
export function cheer(text = CHEERS[Math.floor(Math.random() * CHEERS.length)]): void {
  popping?.remove();
  const box = document.createElement('div');
  box.className = 'mascotPop';
  const bubble = document.createElement('b');
  bubble.textContent = text;
  box.append(mascot(120, 1.2), bubble);
  // στέκεται πάνω στη γραμμή εργαλείων όταν εκείνη είναι κάτω, αλλιώς στη γωνία
  const bar = document.getElementById('toolbar')?.getBoundingClientRect();
  box.style.bottom = `${bar && bar.height > 0 && bar.top > innerHeight / 2 ? innerHeight - bar.top - 6 : 16}px`;
  document.body.append(box);
  popping = box;
  setTimeout(() => box.classList.add('out'), 2200);
  setTimeout(() => {
    box.remove();
    if (popping === box) popping = null;
  }, 2700);
}

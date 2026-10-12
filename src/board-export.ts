/** Σελίδες ως εικόνες: εκτύπωση, μικρογραφίες, PNG και JPEG για το PDF (μέθοδοι της Board, σε δικό τους αρχείο). */

import { Background, Pic, isDark, itemBounds } from './model';
import type { Board } from './board';

/** Ζωγραφίζει ολόκληρη μια σελίδα (όλα τα στοιχεία της με περιθώριο) σε νέο καμβά. */
/** Λογότυπο στην κάτω δεξιά γωνία, μικρό σε σχέση με τη σελίδα. */
function stampMark(cv: HTMLCanvasElement, mark: HTMLImageElement): void {
  const s = Math.max(40, Math.min(cv.width, cv.height) * 0.07);
  const c = cv.getContext('2d')!;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 0.9;
  c.drawImage(mark, cv.width - s * 1.25, cv.height - s * 1.25, s, s);
  c.globalAlpha = 1;
}

export async function pageCanvas(bd: Board, pi: number, opaque: boolean): Promise<HTMLCanvasElement> {
  await bd.loadImages(pi);
  return bd.drawPage(pi, opaque, false);
}

/** Περιμένει να φορτωθούν οι εικόνες μιας σελίδας (ή όλων, χωρίς όρισμα). */
export async function loadImages(bd: Board, pi?: number): Promise<void> {
  const pages = pi === undefined ? bd.doc.pages : [bd.doc.pages[pi]];
  await Promise.all(
    pages.flatMap((pg) => pg.items).filter((i): i is Pic => i.kind === 'image').map((p) => {
      bd.getImg(p);
      const img = bd.imgs.get(p.id)!;
      return img.complete ? Promise.resolve() : new Promise<void>((r) => { img.addEventListener('load', () => r()); img.addEventListener('error', () => r()); });
    })
  );
}

/** Σύγχρονη σχεδίαση σελίδας με όσες εικόνες έχουν ήδη φορτωθεί. `paper`: για εκτύπωση, πάντα σε λευκό φόντο. */
export function drawPage(bd: Board, pi: number, opaque: boolean, paper: boolean): HTMLCanvasElement {
  const items = bd.doc.pages[pi].items;
  let x0 = 0, y0 = 0, x1 = bd.W, y1 = bd.H;
  if (items.length > 0) {
    x0 = Infinity; y0 = Infinity; x1 = -Infinity; y1 = -Infinity;
    for (const it of items) {
      const b = itemBounds(it);
      x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0);
      x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1);
    }
    x0 -= 30; y0 -= 30; x1 += 30; y1 += 30;
  }
  const bw = x1 - x0;
  const bh = y1 - y0;
  const s = Math.min(2, 4096 / Math.max(bw, bh));
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(bw * s));
  cv.height = Math.max(1, Math.round(bh * s));
  const c = cv.getContext('2d')!;
  // η σχεδίαση διαβάζει την τρέχουσα σελίδα και το φόντο· τα αλλάζουμε προσωρινά (σύγχρονα)
  const keep = bd.cur;
  const bg = bd.doc.bg;
  const clear = bd.transparent;
  bd.cur = pi;
  if (paper) {
    bd.paper = isDark(bg);
    bd.doc.bg = bg.replace(/^dark-?/, '') as Background || 'white';
    bd.transparent = false;
  }
  try {
    if (opaque && bd.transparent) {
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, cv.width, cv.height);
    }
    c.setTransform(s, 0, 0, s, -x0 * s, -y0 * s);
    bd.r.paintBackground(c, x0, y0, x1, y1, s);
    for (const it of items) {
      bd.r.drawItem(c, it);
      if (it.kind === 'shape' && it.meas) bd.r.drawMeasures(c, it);
    }
  } finally {
    bd.cur = keep;
    bd.doc.bg = bg;
    bd.transparent = clear;
    bd.paper = false;
  }
  return cv;
}

/**
 * Οι σελίδες για τον εκτυπωτή (JPEG data URL), πάντα σε λευκό φόντο. Σύγχρονη, γιατί ο browser δεν περιμένει όταν πατηθεί «Εκτύπωση»·
 * οι εικόνες πρέπει να έχουν φορτωθεί από πριν με loadImages().
 */
export function printPages(bd: Board, mark?: HTMLImageElement | null): string[] {
  return bd.doc.pages.map((_, pi) => {
    const cv = bd.drawPage(pi, true, true);
    if (mark) stampMark(cv, mark);
    return cv.toDataURL('image/jpeg', 0.9);
  });
}

/** Μικρογραφία της πρώτης σελίδας (JPEG data URL), για τη βιβλιοθήκη μαθημάτων. */
export async function thumb(bd: Board, maxW = 360): Promise<string> {
  const cv = await bd.pageCanvas(0, true);
  const s = Math.min(1, maxW / cv.width, (maxW * 0.7) / cv.height);
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(cv.width * s));
  out.height = Math.max(1, Math.round(cv.height * s));
  out.getContext('2d')!.drawImage(cv, 0, 0, out.width, out.height);
  return out.toDataURL('image/jpeg', 0.7);
}

/** Μικρογραφία της σελίδας pi, για την επιλογή σελίδων στην εξαγωγή. */
export async function pageThumb(bd: Board, pi: number, maxW: number): Promise<HTMLCanvasElement> {
  const cv = await bd.pageCanvas(pi, true);
  const s = Math.min(1, maxW / cv.width);
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(cv.width * s));
  out.height = Math.max(1, Math.round(cv.height * s));
  out.getContext('2d')!.drawImage(cv, 0, 0, out.width, out.height);
  return out;
}

export async function exportPng(bd: Board): Promise<Blob> {
  const cv = await bd.pageCanvas(bd.cur, false);
  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('PNG'))), 'image/png'));
}

/** Οι σελίδες (όλες, ή μόνο όσες δίνει η λίστα `only`) ως εικόνες JPEG, για το PDF. */
export async function exportJpegPages(bd: Board, onProgress: (done: number, total: number) => void, mark?: HTMLImageElement, only?: number[]): Promise<{ jpeg: Uint8Array; w: number; h: number }[]> {
  const out: { jpeg: Uint8Array; w: number; h: number }[] = [];
  const list = only ?? bd.doc.pages.map((_, i) => i);
  const n = list.length;
  for (let i = 0; i < n; i++) {
    onProgress(i, n);
    const cv = await bd.pageCanvas(list[i], true);
    if (mark) stampMark(cv, mark);
    const blob = await new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('JPEG'))), 'image/jpeg', 0.9));
    out.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), w: cv.width, h: cv.height });
  }
  return out;
}

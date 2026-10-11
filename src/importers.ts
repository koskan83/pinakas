import { Page, uid } from './model';

export interface PicData {
  src: string;
  w: number;
  h: number;
}

const MAX_SIDE = 2400;

/** Μετατρέπει εικόνα (Blob) σε dataURL, με σμίκρυνση αν είναι τεράστια. */
export async function blobToPic(blob: Blob): Promise<PicData> {
  const bmp = await createImageBitmap(blob);
  const s = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * s));
  const h = Math.max(1, Math.round(bmp.height * s));
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  cv.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const jpeg = blob.type === 'image/jpeg';
  return { src: cv.toDataURL(jpeg ? 'image/jpeg' : 'image/png', 0.9), w, h };
}

/** Ανοιγμένο PDF: πόσες σελίδες έχει, μικρογραφίες για να διαλέξεις, και μετατροπή όσων θέλεις σε σελίδες του πίνακα. */
export interface OpenPdf {
  n: number;
  /** Μικρογραφία της σελίδας i (από 0), πλάτους w. */
  thumb(i: number, w: number): Promise<HTMLCanvasElement>;
  /** Οι σελίδες της λίστας (από 0) γίνονται σελίδες του πίνακα, καθεμιά με την εικόνα της. */
  pages(list: number[], onProgress: (done: number, total: number) => void): Promise<Page[]>;
  close(): void;
}

export async function openPdf(file: File): Promise<OpenPdf> {
  const pdfjs = await import('pdfjs-dist');
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const render = async (i: number, scaleFor: (w: number, h: number) => number): Promise<HTMLCanvasElement> => {
    const page = await pdf.getPage(i + 1);
    const v1 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: scaleFor(v1.width, v1.height) });
    const cv = document.createElement('canvas');
    cv.width = Math.round(vp.width);
    cv.height = Math.round(vp.height);
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cv.width, cv.height);
    await page.render({ canvasContext: ctx, viewport: vp, canvas: cv }).promise;
    page.cleanup();
    return cv;
  };
  return {
    n: pdf.numPages,
    thumb: (i, w) => render(i, (pw) => w / pw),
    async pages(list, onProgress) {
      const pages: Page[] = [];
      for (let k = 0; k < list.length; k++) {
        onProgress(k, list.length);
        const cv = await render(list[k], (pw, ph) => Math.min(1800 / pw, 2600 / ph, 3));
        const w = 1000;
        const h = (1000 * cv.height) / cv.width;
        pages.push({
          view: { x: 0, y: 0, k: 1 },
          items: [{ kind: 'image', id: uid(), x: 0, y: 0, w, h, src: cv.toDataURL('image/jpeg', 0.88) }],
        });
      }
      onProgress(list.length, list.length);
      return pages;
    },
    close: () => void pdf.cleanup(),
  };
}

/** Στιγμιότυπο οθόνης/παραθύρου μέσω του προγράμματος περιήγησης. */
export async function captureScreen(): Promise<PicData> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error('unsupported');
  }
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  try {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    await new Promise((r) => setTimeout(r, 300));
    const cv = document.createElement('canvas');
    cv.width = video.videoWidth;
    cv.height = video.videoHeight;
    cv.getContext('2d')!.drawImage(video, 0, 0);
    return { src: cv.toDataURL('image/png'), w: cv.width, h: cv.height };
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

/** Εικόνα από το clipboard (κουμπί «Επικόλληση»). */
export async function clipboardImage(): Promise<Blob | null> {
  const items = await navigator.clipboard.read();
  for (const it of items) {
    const type = it.types.find((t) => t.startsWith('image/'));
    if (type) return it.getType(type);
  }
  return null;
}

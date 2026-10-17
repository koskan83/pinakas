/** Εισαγωγή στον πίνακα: αρχεία (PDF, Word, εικόνες, μαθήματα), λήψη οθόνης, επικόλληση και άφημα αρχείων με το ποντίκι. */

import { readDoc } from './model';
import { blobToPic, captureScreen, clipboardImage, openDocx, openPdf } from './importers';
import { isNative, nativeScreenshot } from './native';
import { $, board, toast } from './app';
import { pickPages } from './send-ui';
import { lessons } from './main';

export async function importFiles(files: File[]): Promise<void> {
  for (const f of files) {
    try {
      const word = /\.docx$/i.test(f.name) || f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      if (/\.(doc|odt|rtf)$/i.test(f.name)) {
        toast('Αυτή η μορφή δεν ανοίγει. Αποθήκευσέ το από το Word ως .docx ή ως PDF.', 7000);
      } else if (word || f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
        const kind = word ? 'Word' : 'PDF';
        toast(`Ανοίγει το ${kind}…`, 0);
        const pdf = await (word ? openDocx(f) : openPdf(f));
        try {
          toast('', 1);
          // με πάνω από μία σελίδα ρωτάμε ποιες θα μπουν
          const list = pdf.n > 1 ? await pickPages(`Εισαγωγή από «${f.name}»`, 'Εισαγωγή', pdf.n, (i, w) => pdf.thumb(i, w)) : [0];
          if (!list) continue;
          const pages = await pdf.pages(list, (d, n) => toast(`Εισαγωγή ${kind}… σελίδα ${Math.min(d + 1, n)} από ${n}`, 0));
          board.appendPages(pages);
          toast(pages.length === 1 ? `Προστέθηκε 1 σελίδα από το ${kind}` : `Προστέθηκαν ${pages.length} σελίδες από το ${kind}`);
        } finally {
          pdf.close();
        }
      } else if (f.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(f.name)) {
        // σε κάποιες συσκευές (Android, πίνακες) ο επιλογέας αρχείων δεν δίνει τύπο: τότε μετρά η κατάληξη
        const pic = await blobToPic(f);
        board.addPicture(pic.src, pic.w, pic.h);
      } else if (/\.json$/i.test(f.name)) {
        // μάθημα: ανοίγει χωριστά (ή ως το ίδιο, αν υπάρχει ήδη εδώ)· το τρέχον δεν πειράζεται
        const text = await f.text();
        if (lessons) await lessons.openJson(text, f.name);
        else {
          const j = JSON.parse(text);
          board.loadDoc(readDoc(j?.grafida === 'backup' ? j.lessons?.[0]?.doc : j));
        }
      } else {
        toast(`Μη υποστηριζόμενο αρχείο: ${f.name}`);
      }
    } catch (err) {
      console.error(err);
      toast(err instanceof Error && err.message.includes('νεότερη') ? err.message : `Αποτυχία εισαγωγής: ${f.name}`, 6000);
    }
  }
}

export async function doScreenshot(): Promise<void> {
  try {
    const pic = isNative ? await blobToPic(await nativeScreenshot()) : await captureScreen();
    board.addPicture(pic.src, pic.w, pic.h);
  } catch (err) {
    const name = (err as Error).name;
    if (name === 'NotAllowedError') return; // ο χρήστης ακύρωσε
    toast('Η λήψη οθόνης δεν υποστηρίζεται εδώ. Βγάλε στιγμιότυπο με τη συσκευή και πάτα «Επικόλληση» ή Εισαγωγή αρχείου.', 7000);
  }
}

export async function doPaste(): Promise<void> {
  try {
    const blob = await clipboardImage();
    if (!blob) {
      toast('Δεν βρέθηκε εικόνα στο πρόχειρο');
      return;
    }
    const pic = await blobToPic(blob);
    board.addPicture(pic.src, pic.w, pic.h);
  } catch {
    toast('Δεν επιτρέπεται η πρόσβαση στο πρόχειρο. Δοκίμασε Ctrl+V.', 5000);
  }
}

/** Ctrl+V με αρχεία και άφημα αρχείων πάνω στο παράθυρο. */
export function initImport(): void {
  document.addEventListener('paste', (e) => {
    const files = [...(e.clipboardData?.files ?? [])];
    if (files.length) {
      e.preventDefault();
      void importFiles(files);
    }
  });

  let dragDepth = 0;
  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragDepth++;
    $('drop').classList.remove('hidden');
  });
  window.addEventListener('dragleave', () => {
    if (--dragDepth <= 0) {
      dragDepth = 0;
      $('drop').classList.add('hidden');
    }
  });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    $('drop').classList.add('hidden');
    void importFiles([...(e.dataTransfer?.files ?? [])]);
  });
}

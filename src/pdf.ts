/** Ελάχιστος συγγραφέας PDF: μία εικόνα JPEG ανά σελίδα. */

export interface PdfPage {
  jpeg: Uint8Array;
  /** Διαστάσεις της εικόνας σε pixel. */
  w: number;
  h: number;
}

export function buildPdf(pages: PdfPage[]): Blob {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;
  const put = (d: string | Uint8Array): void => {
    const b = typeof d === 'string' ? enc.encode(d) : d;
    chunks.push(b);
    pos += b.length;
  };
  const obj = (n: number, body: string, stream?: Uint8Array): void => {
    offsets[n] = pos;
    put(`${n} 0 obj\n${body}\n`);
    if (stream) {
      put('stream\n');
      put(stream);
      put('\nendstream\n');
    }
    put('endobj\n');
  };

  put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Count ${pages.length} /Kids [${kids}] >>`);
  pages.forEach((pg, i) => {
    const n = 3 + i * 3;
    // πλάτος Α4 οριζόντιο (842 pt), ύψος ανάλογα με την εικόνα
    const W = 842;
    const H = +((W * pg.h) / pg.w).toFixed(2);
    const content = enc.encode(`q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`);
    obj(n, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${n + 2} 0 R >> >> /Contents ${n + 1} 0 R >>`);
    obj(n + 1, `<< /Length ${content.length} >>`, content);
    obj(
      n + 2,
      `<< /Type /XObject /Subtype /Image /Width ${pg.w} /Height ${pg.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.jpeg.length} >>`,
      pg.jpeg,
    );
  });
  const count = 3 + pages.length * 3;
  const xref = pos;
  put(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let n = 1; n < count; n++) put(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
  put(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}

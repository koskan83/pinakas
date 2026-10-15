/** Μικρά εργαλεία σχεδίασης που μοιράζονται τα έτοιμα σχήματα (stamps.ts, physics.ts). */

type C = CanvasRenderingContext2D;

export function path(c: C, pts: number[][], close = false): void {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  if (close) c.closePath();
  c.stroke();
}

export function hatch(c: C, x0: number, y0: number, x1: number, y1: number, n: number, dx: number, dy: number): void {
  c.save();
  c.lineWidth *= 0.6;
  c.beginPath();
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
    c.moveTo(x, y);
    c.lineTo(x + dx, y + dy);
  }
  c.stroke();
  c.restore();
}

export function zigzag(x0: number, x1: number, y: number, amp: number, n: number): number[][] {
  const pts = [[x0, y]];
  for (let i = 0; i < n; i++) pts.push([x0 + ((x1 - x0) * (i + 0.5)) / n, y + (i % 2 ? amp : -amp)]);
  pts.push([x1, y]);
  return pts;
}

/** Γράμμα του σχήματος (πλάγιο), κεντραρισμένο στο (x, y). Αυτά τα γράμματα αλλάζουν με δεύτερο πάτημα (βλ. stampTexts). */
export function label(c: C, text: string, x: number, y: number, size: number, italic = true): void {
  c.font = `${italic ? 'italic ' : ''}600 ${size}px system-ui, "Segoe UI", Roboto, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, x, y);
}

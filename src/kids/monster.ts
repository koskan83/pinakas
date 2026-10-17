/** Το τερατάκι 👾 που τρώει τα λάθη στην Ορθογραφία· και η μασκότ του PrismaBoard (mascot.ts). */
import { type C, PURPLE } from './common';

/** Το τερατάκι που τρώει τα λάθη, με κέντρο το (x, y): `open` από 0 (κλειστό στόμα) έως 1 (ορθάνοιχτο). */
export function monster(c: C, x: number, y: number, r: number, open: number): void {
  c.save();
  c.lineJoin = 'round';
  c.lineWidth = Math.max(1.5, r * 0.08);
  c.strokeStyle = '#581c87';
  c.fillStyle = PURPLE;
  // κέρατα και πόδια πίσω από το σώμα
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(x + s * r * 0.3, y - r * 0.8);
    c.lineTo(x + s * r * 0.62, y - r * 1.35);
    c.lineTo(x + s * r * 0.72, y - r * 0.6);
    c.closePath();
    c.fill();
    c.stroke();
    c.beginPath();
    c.ellipse(x + s * r * 0.42, y + r * 0.95, r * 0.26, r * 0.16, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
  c.beginPath();
  c.ellipse(x, y, r, r * 0.96, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // μάτια
  for (const s of [-1, 1]) {
    c.beginPath();
    c.arc(x + s * r * 0.36, y - r * 0.32, r * 0.25, 0, Math.PI * 2);
    c.fillStyle = '#ffffff';
    c.fill();
    c.beginPath();
    c.arc(x + s * r * 0.36, y - r * 0.24, r * 0.11, 0, Math.PI * 2);
    c.fillStyle = '#1e293b';
    c.fill();
  }
  // στόμα με δόντια
  const mh = r * (0.1 + 0.42 * open), my = y + r * 0.38;
  c.beginPath();
  c.ellipse(x, my, r * 0.58, mh, 0, 0, Math.PI * 2);
  c.fillStyle = '#3b0764';
  c.fill();
  c.fillStyle = '#ffffff';
  for (const s of [-1, 0, 1]) {
    const tx = x + s * r * 0.26, ty = my - mh * 0.86;
    c.beginPath();
    c.moveTo(tx - r * 0.1, ty);
    c.lineTo(tx + r * 0.1, ty);
    c.lineTo(tx, ty + Math.min(r * 0.22, mh * 0.9));
    c.closePath();
    c.fill();
  }
  c.restore();
}

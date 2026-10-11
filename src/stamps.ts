/** Έτοιμα σχήματα φυσικής. Κάθε σχήμα ζωγραφίζεται μέσα σε κουτί w × h με το τρέχον χρώμα του c. */

type C = CanvasRenderingContext2D;

export interface StampDef {
  label: string;
  /** Αρχικό μέγεθος σε μονάδες πίνακα. */
  w: number;
  h: number;
  draw(c: C, w: number, h: number): void;
}

function path(c: C, pts: number[][], close = false): void {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  if (close) c.closePath();
  c.stroke();
}

function hatch(c: C, x0: number, y0: number, x1: number, y1: number, n: number, dx: number, dy: number): void {
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

function zigzag(x0: number, x1: number, y: number, amp: number, n: number): number[][] {
  const pts = [[x0, y]];
  for (let i = 0; i < n; i++) pts.push([x0 + ((x1 - x0) * (i + 0.5)) / n, y + (i % 2 ? amp : -amp)]);
  pts.push([x1, y]);
  return pts;
}

function label(c: C, text: string, x: number, y: number, size: number): void {
  c.font = `italic 600 ${size}px system-ui, "Segoe UI", Roboto, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, x, y);
}

function meter(letter: string): StampDef['draw'] {
  return (c, w, h) => {
    const r = h * 0.42;
    path(c, [[0, h / 2], [w / 2 - r, h / 2]]);
    path(c, [[w / 2 + r, h / 2], [w, h / 2]]);
    c.beginPath();
    c.arc(w / 2, h / 2, r, 0, Math.PI * 2);
    c.stroke();
    label(c, letter, w / 2, h / 2 + 1, r * 1.1);
  };
}

export const STAMPS: Record<string, StampDef> = {
  incline: {
    label: 'Κεκλιμένο επίπεδο', w: 320, h: 180,
    draw(c, w, h) {
      path(c, [[0, h], [w, h], [w, h * 0.25], [0, h]], true);
      // σώμα πάνω στο επίπεδο
      const ang = Math.atan2(-h * 0.75, w);
      c.save();
      c.translate(w * 0.55, h - h * 0.75 * 0.55);
      c.rotate(ang);
      c.strokeRect(-w * 0.09, -h * 0.26, w * 0.18, h * 0.26);
      c.restore();
      c.beginPath();
      c.arc(0, h, w * 0.16, ang, 0);
      c.stroke();
      label(c, 'φ', w * 0.21, h - h * 0.09, h * 0.14);
    },
  },
  block: {
    label: 'Σώμα', w: 120, h: 90,
    draw(c, w, h) {
      c.strokeRect(1, 1, w - 2, h - 2);
      label(c, 'm', w / 2, h / 2, h * 0.4);
    },
  },
  spring: {
    label: 'Οριζόντιο ελατήριο', w: 340, h: 100,
    draw(c, w, h) {
      path(c, [[10, 0], [10, h]]);
      hatch(c, 10, 6, 10, h - 6, 6, -10, 10);
      path(c, [[0, h], [w, h]]);
      path(c, [[10, h * 0.55], [30, h * 0.55], ...zigzag(30, w * 0.62, h * 0.55, h * 0.2, 14).slice(1), [w * 0.68, h * 0.55]]);
      c.strokeRect(w * 0.68, h * 0.2, w * 0.24, h * 0.8 - 1);
      label(c, 'm', w * 0.8, h * 0.6, h * 0.3);
    },
  },
  springV: {
    label: 'Κατακόρυφο ελατήριο', w: 150, h: 330,
    draw(c, w, h) {
      const cx = w / 2, top = 2, y0 = h * 0.08, y1 = h * 0.68, amp = w * 0.16, n = 14;
      path(c, [[w * 0.1, top], [w * 0.9, top]]);
      hatch(c, w * 0.15, top, w * 0.85, top, 6, 8, -8);
      const pts = [[cx, top], [cx, y0]];
      for (let i = 0; i < n; i++) pts.push([cx + (i % 2 ? amp : -amp), y0 + ((y1 - y0) * (i + 0.5)) / n]);
      pts.push([cx, y1], [cx, h * 0.74]);
      path(c, pts);
      c.strokeRect(cx - w * 0.3, h * 0.74, w * 0.6, h * 0.26 - 1);
      label(c, 'm', cx, h * 0.87, h * 0.1);
    },
  },
  springIncline: {
    label: 'Ελατήριο σε κεκλιμένο', w: 380, h: 240,
    draw(c, w, h) {
      const rise = h * 0.72;
      path(c, [[0, h], [w, h], [w, h - rise], [0, h]], true);
      const ang = Math.atan2(rise, -w);
      const L = Math.hypot(w, rise);
      const bh = h * 0.2, bw = L * 0.17, s0 = L * 0.06, s1 = L * 0.5;
      c.save();
      // x κατά μήκος του επιπέδου προς τα κάτω, y κάθετα προς τα έξω
      c.translate(w, h - rise);
      c.rotate(ang);
      path(c, [[0, 0], [0, bh * 1.25]]);
      path(c, [[0, bh / 2], [s0, bh / 2], ...zigzag(s0, s1, bh / 2, bh * 0.32, 12).slice(1), [s1 + L * 0.04, bh / 2]]);
      c.strokeRect(s1 + L * 0.04, 0, bw, bh);
      c.restore();
      // το γράμμα μένει όρθιο: υπολογίζουμε τη θέση του έξω από την περιστροφή
      const mx = s1 + L * 0.04 + bw / 2, my = bh / 2;
      label(c, 'm', w + mx * Math.cos(ang) - my * Math.sin(ang), h - rise + mx * Math.sin(ang) + my * Math.cos(ang), bh * 0.6);
      c.beginPath();
      c.arc(0, h, w * 0.15, -Math.atan2(rise, w), 0);
      c.stroke();
      label(c, 'φ', w * 0.2, h - h * 0.07, h * 0.12);
    },
  },
  pulley: {
    label: 'Τροχαλία', w: 200, h: 300,
    draw(c, w, h) {
      const r = w * 0.28, cy = h * 0.22;
      path(c, [[w * 0.15, 0], [w * 0.85, 0]]);
      hatch(c, w * 0.2, 0, w * 0.8, 0, 6, 8, -8);
      path(c, [[w / 2, 0], [w / 2, cy]]);
      c.beginPath();
      c.arc(w / 2, cy, r, 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      c.arc(w / 2, cy, 3, 0, Math.PI * 2);
      c.fill();
      path(c, [[w / 2 - r, cy], [w / 2 - r, h * 0.62]]);
      path(c, [[w / 2 + r, cy], [w / 2 + r, h * 0.78]]);
      c.strokeRect(w / 2 - r - w * 0.14, h * 0.62, w * 0.28, h * 0.16);
      c.strokeRect(w / 2 + r - w * 0.14, h * 0.78, w * 0.28, h * 0.2);
      label(c, 'm₁', w / 2 - r, h * 0.7, h * 0.07);
      label(c, 'm₂', w / 2 + r, h * 0.88, h * 0.07);
    },
  },
  pendulum: {
    label: 'Εκκρεμές', w: 200, h: 280,
    draw(c, w, h) {
      path(c, [[w * 0.2, 0], [w * 0.8, 0]]);
      hatch(c, w * 0.25, 0, w * 0.75, 0, 5, 8, -8);
      const bx = w * 0.82, by = h * 0.82, r = w * 0.09;
      path(c, [[w / 2, 0], [bx, by]]);
      c.save();
      c.setLineDash([8, 6]);
      c.lineWidth *= 0.6;
      path(c, [[w / 2, 0], [w / 2, h * 0.95]]);
      c.restore();
      c.beginPath();
      c.arc(bx, by, r, 0, Math.PI * 2);
      c.fill();
      label(c, 'θ', w * 0.57, h * 0.3, h * 0.08);
    },
  },
  resistor: {
    label: 'Αντιστάτης', w: 220, h: 60,
    draw(c, w, h) {
      path(c, [[0, h / 2], [w * 0.22, h / 2], ...zigzag(w * 0.22, w * 0.78, h / 2, h * 0.32, 7).slice(1), [w, h / 2]]);
    },
  },
  battery: {
    label: 'Πηγή', w: 160, h: 90,
    draw(c, w, h) {
      path(c, [[0, h / 2], [w * 0.44, h / 2]]);
      path(c, [[w * 0.56, h / 2], [w, h / 2]]);
      path(c, [[w * 0.44, h * 0.1], [w * 0.44, h * 0.9]]);
      c.save();
      c.lineWidth *= 2;
      path(c, [[w * 0.56, h * 0.3], [w * 0.56, h * 0.7]]);
      c.restore();
      label(c, '+', w * 0.32, h * 0.2, h * 0.3);
      label(c, '−', w * 0.7, h * 0.2, h * 0.3);
    },
  },
  capacitor: {
    label: 'Πυκνωτής', w: 160, h: 90,
    draw(c, w, h) {
      path(c, [[0, h / 2], [w * 0.44, h / 2]]);
      path(c, [[w * 0.56, h / 2], [w, h / 2]]);
      path(c, [[w * 0.44, h * 0.1], [w * 0.44, h * 0.9]]);
      path(c, [[w * 0.56, h * 0.1], [w * 0.56, h * 0.9]]);
    },
  },
  lamp: {
    label: 'Λαμπτήρας', w: 160, h: 80,
    draw(c, w, h) {
      const r = h * 0.42, q = r * Math.SQRT1_2;
      path(c, [[0, h / 2], [w / 2 - r, h / 2]]);
      path(c, [[w / 2 + r, h / 2], [w, h / 2]]);
      c.beginPath();
      c.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      c.stroke();
      path(c, [[w / 2 - q, h / 2 - q], [w / 2 + q, h / 2 + q]]);
      path(c, [[w / 2 - q, h / 2 + q], [w / 2 + q, h / 2 - q]]);
    },
  },
  switch: {
    label: 'Διακόπτης', w: 180, h: 70,
    draw(c, w, h) {
      const y = h * 0.75;
      path(c, [[0, y], [w * 0.3, y]]);
      path(c, [[w * 0.7, y], [w, y]]);
      path(c, [[w * 0.3, y], [w * 0.66, h * 0.15]]);
      for (const x of [w * 0.3, w * 0.7]) {
        c.beginPath();
        c.arc(x, y, 4, 0, Math.PI * 2);
        c.fill();
      }
    },
  },
  ammeter: { label: 'Αμπερόμετρο', w: 160, h: 80, draw: meter('A') },
  voltmeter: { label: 'Βολτόμετρο', w: 160, h: 80, draw: meter('V') },
};

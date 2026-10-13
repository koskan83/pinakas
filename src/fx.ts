/**
 * Ήχοι και πανηγυρισμοί για το Δημοτικό. Οι ήχοι φτιάχνονται επιτόπου από τον browser (Web Audio):
 * δεν υπάρχουν αρχεία ήχου, άρα δουλεύουν και χωρίς ίντερνετ.
 */

const KEY = 'grafida.fx';

export interface FxPrefs {
  /** Ήχοι γενικά. */
  sound: boolean;
  /** Το μικρό «κλικ» σε κάθε κουμπί εργαλείου. */
  click: boolean;
}

export function loadFx(): FxPrefs {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<FxPrefs>;
    return { sound: p.sound !== false, click: p.click !== false };
  } catch {
    return { sound: true, click: true };
  }
}

export function saveFx(p: FxPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* χωρίς αποθήκευση */
  }
}

let ac: AudioContext | null = null;
let master: GainNode | null = null;
function ctx(): AudioContext | null {
  try {
    if (!ac) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      master = ac.createGain();
      // χαμηλά από προεπιλογή: η ένταση ρυθμίζεται από τον πίνακα
      master.gain.value = 0.35;
      master.connect(ac.destination);
    }
    if (ac.state === 'suspended') void ac.resume();
    return ac;
  } catch {
    return null;
  }
}

/** Ένας τόνος: συχνότητα (προαιρετικά γλιστρά σε άλλη), διάρκεια, ένταση, καθυστέρηση. */
function tone(f: number, dur: number, o: { type?: OscillatorType; gain?: number; at?: number; to?: number } = {}): void {
  const a = ctx();
  if (!a || !master) return;
  const t = a.currentTime + (o.at ?? 0);
  const osc = a.createOscillator(), g = a.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(f, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.gain ?? 0.5, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** Σύντομος θόρυβος (χτύπημα, τρίψιμο)· `freq` είναι το ύψος του φίλτρου. */
function noise(dur: number, o: { gain?: number; at?: number; freq?: number; to?: number } = {}): void {
  const a = ctx();
  if (!a || !master) return;
  const t = a.currentTime + (o.at ?? 0);
  const n = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, n, a.sampleRate), data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource(), flt = a.createBiquadFilter(), g = a.createGain();
  src.buffer = buf;
  flt.type = 'bandpass';
  flt.frequency.setValueAtTime(o.freq ?? 1200, t);
  if (o.to) flt.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  g.gain.setValueAtTime(o.gain ?? 0.4, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(flt).connect(g).connect(master);
  src.start(t);
}

const SOUNDS: Record<string, () => void> = {
  click: () => tone(900, 0.04, { type: 'triangle', gain: 0.18 }),
  new: () => { tone(520, 0.08, { gain: 0.3 }); tone(780, 0.1, { gain: 0.3, at: 0.07 }); },
  tok: () => { tone(260, 0.07, { to: 150, gain: 0.45 }); noise(0.04, { gain: 0.15, freq: 900 }); },
  wipe: () => noise(0.16, { gain: 0.25, freq: 2400, to: 500 }),
  good: () => { tone(660, 0.09, { gain: 0.35 }); tone(990, 0.14, { gain: 0.35, at: 0.08 }); },
  bad: () => tone(220, 0.22, { type: 'sawtooth', to: 140, gain: 0.22 }),
  lose: () => { tone(392, 0.22, { type: 'triangle', gain: 0.35 }); tone(330, 0.22, { type: 'triangle', gain: 0.35, at: 0.2 }); tone(262, 0.5, { type: 'triangle', to: 196, gain: 0.35, at: 0.4 }); },
  equal: () => { tone(1047, 0.7, { gain: 0.35 }); tone(1568, 0.9, { gain: 0.22, at: 0.02 }); },
  dice: () => { for (let i = 0; i < 6; i++) noise(0.035, { gain: 0.3, freq: 1500 + Math.random() * 1500, at: i * 0.075 + Math.random() * 0.02 }); },
  drum: () => {
    for (let i = 0; i < 12; i++) noise(0.05, { gain: 0.16 + i * 0.012, freq: 260, at: i * 0.06 });
    tone(1319, 0.5, { gain: 0.3, at: 0.78 });
    noise(0.3, { gain: 0.12, freq: 6000, at: 0.78 });
  },
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i === 4 ? 0.6 : 0.16, { type: 'triangle', gain: 0.4, at: i * 0.11 })),
  cheer: () => { tone(784, 0.1, { gain: 0.35 }); tone(1047, 0.12, { gain: 0.35, at: 0.09 }); tone(1568, 0.35, { gain: 0.3, at: 0.18 }); },
};

let lastTok = 0;
/** Παίζει τον ήχο ενός γεγονότος, αν οι ρυθμίσεις το επιτρέπουν. */
export function playFx(ev: string, prefs: FxPrefs): void {
  if (!prefs.sound || (ev === 'click' && !prefs.click)) return;
  // στο σύρσιμο με κυβάκια τα «τοκ» δεν στοιβάζονται
  if (ev === 'tok' || ev === 'wipe') {
    const now = performance.now();
    if (now - lastTok < 45) return;
    lastTok = now;
  }
  SOUNDS[ev]?.();
}

const COLORS = ['#f43f5e', '#f59e0b', '#fde047', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];

/** Κομφετί που πετάγεται από το σημείο (x, y) της οθόνης και πέφτει. Δεν πιάνει αγγίγματα και σβήνει μόνο του. */
export function confetti(x = innerWidth / 2, y = innerHeight * 0.35, amount = 140): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.createElement('canvas');
  cv.className = 'confetti';
  const dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = innerWidth * dpr;
  cv.height = innerHeight * dpr;
  document.body.append(cv);
  const c = cv.getContext('2d')!;
  c.scale(dpr, dpr);
  const ps = Array.from({ length: amount }, () => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5, sp = 5 + Math.random() * 11;
    return { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3, s: 6 + Math.random() * 8, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.5, col: COLORS[Math.floor(Math.random() * COLORS.length)] };
  });
  const t0 = performance.now(), LIFE = 2400;
  let last = t0;
  const step = (now: number): void => {
    const dt = Math.min(3, (now - last) / 16.7), age = now - t0;
    last = now;
    c.clearRect(0, 0, innerWidth, innerHeight);
    c.globalAlpha = Math.min(1, (LIFE - age) / 500);
    for (const p of ps) {
      p.vy += 0.32 * dt;
      p.vx *= 0.99;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.r += p.vr * dt;
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.r);
      c.fillStyle = p.col;
      c.fillRect(-p.s / 2, -p.s * 0.3 * Math.cos(p.r * 2), p.s, p.s * 0.6);
      c.restore();
    }
    if (age < LIFE) requestAnimationFrame(step);
    else cv.remove();
  };
  requestAnimationFrame(step);
}

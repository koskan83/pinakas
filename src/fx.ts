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
  pop: () => { tone(380, 0.07, { to: 820, gain: 0.4 }); tone(1180, 0.12, { type: 'triangle', gain: 0.25, at: 0.06 }); },
  split: () => { noise(0.08, { gain: 0.3, freq: 2600, to: 900 }); tone(700, 0.1, { to: 330, gain: 0.3, at: 0.03 }); },
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
  const munch = /^(munch|sniff)(\d+)(x?)$/.exec(ev);
  if (munch) {
    // συγχρονισμένα με την κίνηση στο εργαλείο της ορθογραφίας: πρώτο δάγκωμα στα 0,8 s, μετά ένα κάθε 0,8 s·
    // στον πρώτο έλεγχο το τερατάκι πρώτα μυρίζει (δύο ρουθουνίσματα) και όλα πάνε 0,3 s πιο πίσω
    const sniff = munch[1] === 'sniff', t0 = sniff ? 1.1 : 0.8;
    if (sniff) for (const at of [0, 0.22]) noise(0.14, { gain: 0.22, freq: 1800, to: 3200, at });
    for (let i = 0; i < Number(munch[2]); i++) {
      const at = t0 + i * 0.8;
      // «χραπ», δύο μασήματα και κατάποση
      noise(0.1, { gain: 0.55, freq: 1100, to: 300, at });
      tone(190, 0.11, { type: 'square', to: 85, gain: 0.2, at });
      for (const d of [0.13, 0.25]) {
        noise(0.06, { gain: 0.3, freq: 650, to: 260, at: at + d });
        tone(140, 0.06, { type: 'square', to: 100, gain: 0.1, at: at + d });
      }
      tone(240, 0.1, { to: 520, gain: 0.22, at: at + 0.4 });
    }
    // «x»: δέκατο λάθος, μετά τα γράμματα τρώει κι εσένα (βλ. spellFeast): γρύλισμα όσο φουσκώνει, ΧΑΜ, μάσημα, ρέψιμο
    if (munch[3]) {
      const f = t0 - 0.45 + Number(munch[2]) * 0.8 + 0.4;
      tone(70, 1.3, { type: 'sawtooth', to: 180, gain: 0.22, at: f });
      tone(140, 1.3, { type: 'triangle', to: 360, gain: 0.15, at: f });
      // ένα «ΧΑΜ» σε κάθε κλείσιμο του στόματος (SPELL_CHOMP = 0,6 s)
      for (const d of [1.3, 1.9, 2.5]) {
        noise(0.35, { gain: 0.85, freq: 900, to: 150, at: f + d });
        tone(160, 0.4, { type: 'square', to: 40, gain: 0.38, at: f + d });
      }
      for (let i = 0; i < 6; i++) tone(105 - i * 6, 0.1, { type: 'sawtooth', gain: 0.35, at: f + 2.75 + i * 0.085 });
      tone(600, 0.08, { to: 950, gain: 0.25, at: f + 3.5 });
    }
    return;
  }
  SOUNDS[ev]?.();
}

/**
 * Κρυφό πλαίσιο από το οποίο ζητείται η φωνή του διαδικτύου: η υπηρεσία απαντά μόνο σε αιτήματα χωρίς «Referer»,
 * και αυτό ορίζεται ανά έγγραφο· έτσι δεν αλλάζει τίποτα για τα υπόλοιπα αιτήματα της εφαρμογής.
 */
let voiceFrame: HTMLIFrameElement | null = null;
function netAudio(url: string): HTMLAudioElement | null {
  if (!voiceFrame) {
    voiceFrame = document.createElement('iframe');
    voiceFrame.hidden = true;
    voiceFrame.srcdoc = '<meta name="referrer" content="no-referrer">';
    document.body.append(voiceFrame);
    return null;
  }
  const win = voiceFrame.contentWindow as (Window & { Audio?: typeof Audio }) | null;
  return win?.Audio ? new win.Audio(url) : null;
}
let speaking: HTMLAudioElement | null = null, sayNo = 0;
/**
 * Λέει δυνατά ένα κείμενο (ορθογραφία: η λέξη που πρέπει να γραφτεί). `lang` π.χ. 'el-GR'.
 * Με τη φωνή της συσκευής αν έχει για αυτή τη γλώσσα· αλλιώς (συχνό σε Linux και σε Chrome χωρίς ελληνικά) με φωνή από το διαδίκτυο.
 * false αν δεν ακούστηκε με κανέναν από τους δύο τρόπους.
 */
export async function say(text: string, lang: string): Promise<boolean> {
  const synth = typeof speechSynthesis === 'undefined' ? null : speechSynthesis, no = ++sayNo;
  const is = (v: SpeechSynthesisVoice, l: string): boolean => v.lang.replace('_', '-').toLowerCase().startsWith(l.toLowerCase());
  const voices = synth?.getVoices() ?? [], voice = voices.find((v) => is(v, lang)) ?? voices.find((v) => is(v, lang.slice(0, 2)));
  speaking?.pause();
  if (synth && (voice || !voices.length)) {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    if (voice) u.voice = voice;
    u.rate = 0.8;
    // άδεια λίστα φωνών: ή δεν έχει φορτώσει ακόμη (η συσκευή διαλέγει από τη γλώσσα) ή η συσκευή δεν έχει καμία·
    // αν δεν αρχίσει να μιλά σε λίγο, η λέξη ζητείται από το διαδίκτυο
    const started = voice ? null : new Promise<boolean>((done) => {
      u.onstart = () => done(true);
      u.onerror = () => done(false);
      setTimeout(() => done(false), 700);
    });
    synth.speak(u);
    if (!started || (await started)) return true;
    // στο μεταξύ ζητήθηκε άλλη λέξη: αυτή δεν λέγεται πια
    if (no !== sayNo) return true;
    synth.cancel();
  }
  const audio = netAudio(`https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang.startsWith('en') ? 'en-GB' : lang.slice(0, 2)}&q=${encodeURIComponent(text)}`);
  if (!audio) return false;
  speaking = audio;
  try {
    await audio.play();
    return true;
  } catch {
    return false;
  }
}
// οι φωνές της συσκευής και το πλαίσιο της φωνής του διαδικτύου ετοιμάζονται από νωρίς
if (typeof speechSynthesis !== 'undefined') speechSynthesis.getVoices();
if (typeof document !== 'undefined') netAudio('');

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

/** Αναγνώριση χειρόγραφου με εξωτερική υπηρεσία (Gemini ή Claude). Το κλειδί μένει μόνο σε αυτή τη συσκευή. */

export type Provider = 'gemini' | 'claude';
export type RecKind = 'text' | 'math';
/** Τι ζητάμε από την υπηρεσία: μεταγραφή (κείμενο ή τύπος) ή λύση της άσκησης. */
export type AiTask = RecKind | 'solve' | 'check' | 'graph' | 'spell' | 'figure' | 'letters';

export interface AiSettings {
  provider: Provider;
  keys: Record<Provider, string>;
  models: Record<Provider, string>;
}

export const MODELS: Record<Provider, string[]> = {
  gemini: ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-2.5-flash'],
  claude: ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'],
};

const KEY = 'grafida.ai';

export function loadAi(): AiSettings {
  const s: AiSettings = {
    provider: 'gemini',
    keys: { gemini: '', claude: '' },
    models: { gemini: MODELS.gemini[0], claude: MODELS.claude[0] },
  };
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (p.provider === 'gemini' || p.provider === 'claude') s.provider = p.provider;
    Object.assign(s.keys, p.keys);
    Object.assign(s.models, p.models);
  } catch {
    /* χωρίς αποθηκευμένες ρυθμίσεις */
  }
  return s;
}

export function saveAi(s: AiSettings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

const PROMPT: Record<AiTask, string> = {
  text:
    'The image shows handwriting from a classroom whiteboard, usually in Greek (sometimes English). ' +
    'Transcribe exactly what is written. Do not translate, correct, complete or comment. ' +
    'Keep line breaks. Write simple inline maths with Unicode (x², √, ·, ≤). ' +
    'Reply with the transcription only, no quotes. If nothing is readable reply with an empty message.',
  math:
    'The image shows a handwritten mathematical or physics formula from a classroom whiteboard. ' +
    'Transcribe exactly what is written as LaTeX. Do not solve, simplify, complete or correct it. ' +
    'For several lines use \\begin{aligned} ... \\end{aligned} with \\\\ between lines. Put any words inside \\text{}. ' +
    'Reply with the LaTeX only: no $ delimiters, no code fences, no explanation. If nothing is readable reply with an empty message.',
  solve:
    'The image shows a mathematics or physics exercise from a Greek secondary-school classroom whiteboard ' +
    '(an equation, inequality, system, derivative, integral, limit, determinant, expression to compute or simplify, etc.). ' +
    'Solve it the way a teacher would write it on the board: the main steps only, one per line, ending with the final answer. ' +
    'Do not repeat the given exercise as the first line. At most 10 lines. ' +
    'Reply as LaTeX inside \\begin{aligned} ... \\end{aligned} with \\\\ between lines and & before the main relation sign of each line. ' +
    'Any words must be in Greek, very short, inside \\text{}. Use a decimal comma. ' +
    'Reply with the LaTeX only: no $ delimiters, no code fences, no explanation. ' +
    'Exception: if it is a multiple-choice, true/false or theory question rather than a calculation, do not use LaTeX. ' +
    'Reply instead with a first line containing only the word TEXT, then at most three short lines of plain Greek text ' +
    '(maths in Unicode): the correct option (its number or letter and its wording in brief) and a justification of at most 15 words. ' +
    'If nothing is readable or there is nothing to solve reply with an empty message.',
  check:
    'The image shows a student\'s handwritten solution to a mathematics or physics exercise on a Greek secondary-school classroom whiteboard, ' +
    'usually several lines, each following from the previous one. Check it line by line. ' +
    'Reply in Greek, in plain text (no LaTeX, no Markdown), with maths in Unicode (x², √, ·, ≤, ≠). ' +
    'If every step and the final answer are correct, reply with exactly one line starting with "✓ " and a very short confirmation. ' +
    'Otherwise reply with at most three short lines: the first starts with "✗ " and says in which line (counting from the top) the first mistake is; ' +
    'the second says in at most 12 words what went wrong; the third gives the correct form of that one line only. ' +
    'Do not write out the rest of the solution and do not comment on handwriting or style. ' +
    'If instead the image shows a multiple-choice or true/false question, printed or handwritten, where one option has been marked by hand ' +
    '(circled, ticked, underlined or crossed), judge that marked option: reply "✓ " plus a very short confirmation if it is the correct one, ' +
    'otherwise "✗ " plus which option was marked, then a second line with the correct option, then a third line with a reason of at most 15 words. ' +
    'If no option is marked, reply with "✗ Δεν έχει σημειωθεί απάντηση" and on the second line the correct option. ' +
    'If nothing is readable or there is nothing to check reply with an empty message.',
  spell:
    'The image shows Greek words or sentences handwritten by a primary-school pupil on a classroom whiteboard (or printed text). ' +
    'Check the spelling, including accents (τόνοι) and final sigma. Ignore handwriting quality, capitalisation style and punctuation. ' +
    'Reply in Greek, in plain text only. If everything is spelled correctly reply with exactly one line starting with "✓ " and a two-word praise. ' +
    'Otherwise the first line starts with "✗ " and says how many words need fixing, followed by one line per wrong word ' +
    '(at most 5), in the form: wrong → correct. No explanations, no grammar rules. ' +
    'If nothing is readable reply with an empty message.',
  graph:
    'The image shows a function or an equation in two variables from a Greek secondary-school classroom whiteboard, handwritten or printed ' +
    '(for example f(x) = x² − 3x + 2, y = −200x, υ = 10 − 2t with 0 ≤ t ≤ 5, or a piecewise function). It will be plotted by a program. ' +
    'Reply with plain lines only, no explanation, no LaTeX, no code fences:\n' +
    'F: the right-hand side as an expression of x. If the independent variable has another name (t, θ, …) rewrite it as x. ' +
    'If the equation is not solved for the dependent variable (e.g. 2x + y = 4) solve it first.\n' +
    'D: only if the domain is restricted in the image (e.g. "x ≥ 0", "0 ≤ t ≤ 5", a piecewise condition, "t ≥ 0" implied by the word time is NOT enough): ' +
    'two numbers "from ; to", using the word inf for no bound (e.g. "D: 0 ; inf", "D: -2 ; 3"). Otherwise omit the D line.\n' +
    'X: the original name of the independent variable. Y: the original name of the dependent variable (y, f(x) becomes y, υ, s, …).\n' +
    'For a piecewise function or several functions give one F line per branch, each followed by its own D line (at most 4).\n' +
    'Syntax allowed in F: numbers with a decimal point, x, + − * /, ^ for powers, parentheses, √( ), | | for absolute value, ' +
    'π, e, ln( ), log( ) and the Greek names ημ( ), συν( ), εφ( ), σφ( ) for sin, cos, tan, cot. Never write sin, cos, tan, sqrt, abs or exp. ' +
    'Other single letters (a, b, λ) may stay as parameters. Example reply:\nF: 10-2x\nD: 0 ; 5\nX: t\nY: υ\n' +
    'If the image contains no function that can be plotted reply with an empty message.',
  letters:
    'The image shows a Greek or English word or short sentence handwritten by a primary-school pupil during a spelling (dictation) exercise. ' +
    'A program will compare it letter by letter with the correct spelling, so transcribe EXACTLY the letters the pupil wrote, ' +
    'keeping every spelling mistake: a wrong vowel (ι, η, υ, ει, οι; ο, ω; ε, αι), a missing, extra or doubled letter, σ instead of ς. ' +
    'Never correct, complete or normalise anything, even when the intended word is obvious: a corrected transcription makes the exercise useless. ' +
    'Write an accent (τόνος) only on a letter where the pupil actually drew one, and none where the pupil left it out. ' +
    'Reply with the transcription only, in lowercase letters of the language the pupil wrote in, on one line, no quotes, no punctuation. If nothing is readable reply with an empty message.',
  figure:
    'The image shows the statement of a physics exercise (sometimes geometry) from a Greek secondary-school classroom whiteboard, printed or handwritten. ' +
    'A program will draw the figure a teacher would sketch on the board next to it, before solving: the bodies and surfaces the statement describes, ' +
    'the given vectors (forces, velocities) and the names of the given quantities. Do NOT solve the exercise, do not show results or anything the students must find themselves ' +
    '(for example do not draw the resultant, and in a force diagram draw only forces the statement names). ' +
    'If the statement needs no figure (a plain calculation, unit conversion, theory or multiple-choice question, or a formula to apply) reply with exactly: NONE\n' +
    'Otherwise reply with plain lines only, no explanation, no code fences, at most 30 lines. ' +
    'Coordinates are numbers on a canvas 100 wide and 70 high, x to the right, y DOWNWARDS (y = 0 is the top). Keep everything between 5 and 95 horizontally and 5 and 65 vertically. Commands:\n' +
    'L x1 y1 x2 y2 : straight line (ground, incline, rope, rod, wall, ray).\n' +
    'D x1 y1 x2 y2 : dashed line (height, reference level, normal, axis, trajectory guide).\n' +
    'A x1 y1 x2 y2 colour : arrow from (x1,y1) to (x2,y2) for a vector. colour is one of red (forces), blue (velocity, acceleration, displacement), green (fields, other).\n' +
    'R x1 y1 x2 y2 : rectangle with sides parallel to the canvas (a box on horizontal ground, a container, a resistor).\n' +
    'C cx cy r : circle (a ball, a pulley, a wheel, a charge, a planet).\n' +
    'P x1 y1 x2 y2 x3 y3 ... : polyline through 3 to 12 points; repeat the first point at the end to close it ' +
    '(a triangle for an inclined plane, a tilted box on an incline, a curved path approximated by points, a zigzag spring).\n' +
    'T x y text : a short label centred at (x,y): a symbol or a symbol with its given value, e.g. "m = 2 kg", "F = 10 N", "υ₀", "θ = 30°", "h = 5 m", "A", "B". ' +
    'Greek letters and Unicode subscripts are allowed, no LaTeX. Put each label next to what it names, not on top of lines.\n' +
    'Keep it simple and schematic, like a clean textbook sketch: usually 4 to 15 commands. Make it large: use most of the canvas. Tilted boxes must sit exactly on the incline line. ' +
    'Example for "a box of mass 2 kg is pulled on horizontal ground by a horizontal force of 10 N":\n' +
    'L 5 50 95 50\nR 35 34 59 50\nT 47 42 m = 2 kg\nA 59 42 85 42 red\nT 74 36 F = 10 N\n' +
    'If nothing is readable reply with an empty message.',
};

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function clean(t: string): string {
  return t.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').replace(/^\$+|\$+$/g, '').trim();
}

/** Στέλνει την εικόνα (PNG) για αναγνώριση. Επιστρέφει κείμενο ή LaTeX· κενό αν δεν διαβάστηκε τίποτα. */
export async function recognize(png: Blob, kind: AiTask, s: AiSettings): Promise<string> {
  const key = s.keys[s.provider];
  if (!key) throw new Error('Δεν έχει οριστεί κλειδί');
  const data = await toBase64(png);
  const model = s.models[s.provider];
  let res: Response;
  if (s.provider === 'gemini') {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: 'image/png', data } }, { text: PROMPT[kind] }] }],
        generationConfig: { temperature: 0 },
      }),
    });
  } else {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: kind === 'solve' ? 3000 : kind === 'check' ? 2000 : 1024,
        messages: [{
          role: 'user',
          content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data } }, { type: 'text', text: PROMPT[kind] }],
        }],
      }),
    });
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const msg = body?.error?.message ?? '';
    if (res.status === 429) throw new Error('Έφτασες το όριο χρήσης της υπηρεσίας. Δοκίμασε ξανά σε λίγο.');
    if (res.status === 401 || res.status === 403) throw new Error('Το κλειδί δεν έγινε δεκτό.');
    throw new Error(`Σφάλμα ${res.status}${msg ? `: ${msg}` : ''}`);
  }
  const json = await res.json();
  const parts: { text?: string }[] = s.provider === 'gemini' ? json.candidates?.[0]?.content?.parts ?? [] : json.content ?? [];
  const raw = parts.map((p) => p.text ?? '').join('');
  // ο έλεγχος λύσης είναι σκέτο κείμενο: δεν έχει περιτύλιγμα LaTeX να καθαριστεί
  return kind === 'check' || kind === 'graph' || kind === 'spell' || kind === 'letters' ? raw.trim() : kind === 'figure' ? raw.replace(/```[a-z]*/gi, '').trim() : clean(raw);
}

export interface GraphReply {
  fns: { expr: string; dom?: [number | null, number | null] }[];
  lx?: string;
  ly?: string;
}

/** Διαβάζει την απάντηση για γραφική παράσταση (γραμμές «F:», «D:», «X:», «Y:»). */
export function parseGraphReply(text: string): GraphReply {
  const out: GraphReply = { fns: [] };
  const bound = (v: string): number | null => {
    const t = v.trim().replace('−', '-').replace(',', '.');
    if (!t || /inf|∞/i.test(t)) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };
  for (const raw of text.split('\n')) {
    const m = /^\s*([FDXY])\s*:\s*(.+?)\s*$/i.exec(raw.replace(/[`*]/g, ''));
    if (!m) continue;
    const k = m[1].toUpperCase(), v = m[2];
    if (k === 'F' && out.fns.length < 4) out.fns.push({ expr: v.slice(v.lastIndexOf('=') + 1).trim() });
    else if (k === 'D' && out.fns.length) {
      const [a, b] = v.split(';');
      const lo = bound(a ?? ''), hi = bound(b ?? '');
      if (lo !== null || hi !== null) out.fns[out.fns.length - 1].dom = lo !== null && hi !== null && lo > hi ? [hi, lo] : [lo, hi];
    } else if (k === 'X') out.lx = v.slice(0, 4);
    else if (k === 'Y') out.ly = v.slice(0, 6);
  }
  if (out.lx === 'x') delete out.lx;
  if (out.ly === 'y') delete out.ly;
  return out;
}

/** Ένα κομμάτι του σχήματος που ζητήθηκε από το AI, σε καμβά 100 × 70 (y προς τα κάτω). */
export type FigCmd =
  | { k: 'line'; pts: [number, number, number, number]; dash?: boolean }
  | { k: 'arrow'; pts: [number, number, number, number]; color: 'red' | 'blue' | 'green' }
  | { k: 'rect'; pts: [number, number, number, number] }
  | { k: 'circle'; x: number; y: number; r: number }
  | { k: 'poly'; pts: [number, number][] }
  | { k: 'text'; x: number; y: number; text: string };

/**
 * Διαβάζει την απάντηση για σχήμα (γραμμές «L», «D», «A», «R», «C», «P», «T»). null όταν η εκφώνηση δεν χρειάζεται σχήμα («NONE»)·
 * ό,τι δεν καταλαβαίνει ή πέφτει πολύ έξω από τον καμβά το αφήνει.
 */
export function parseFigureReply(text: string): FigCmd[] | null {
  if (/^\s*NONE\b/i.test(text)) return null;
  const out: FigCmd[] = [];
  const ok = (v: number): boolean => Number.isFinite(v) && v >= -20 && v <= 120;
  for (const raw of text.split('\n')) {
    const m = /^\s*([LDARCPT])\s*:?\s+(.+?)\s*$/.exec(raw.replace(/[`*]/g, ''));
    if (!m || out.length >= 40) continue;
    const k = m[1];
    if (k === 'T') {
      const t = /^(-?[\d.,]+)\s+(-?[\d.,]+)\s+(.+)$/.exec(m[2]);
      if (!t) continue;
      const x = Number(t[1].replace(',', '.')), y = Number(t[2].replace(',', '.'));
      const label = t[3].replace(/^["«]|["»]$/g, '').trim().slice(0, 40);
      if (ok(x) && ok(y) && label) out.push({ k: 'text', x, y, text: label });
      continue;
    }
    const nums: number[] = [];
    let color: 'red' | 'blue' | 'green' = 'red';
    for (const w of m[2].split(/[\s;]+/)) {
      const n = Number(w.replace(/,$/, '').replace('−', '-'));
      if (w !== '' && Number.isFinite(n)) nums.push(n);
      else if (/^(red|blue|green)$/i.test(w)) color = w.toLowerCase() as typeof color;
    }
    if (!nums.every(ok)) continue;
    if (k === 'C') {
      if (nums.length >= 3 && nums[2] > 0 && nums[2] <= 50) out.push({ k: 'circle', x: nums[0], y: nums[1], r: nums[2] });
    } else if (k === 'P') {
      const pts: [number, number][] = [];
      for (let i = 0; i + 1 < nums.length && pts.length < 14; i += 2) pts.push([nums[i], nums[i + 1]]);
      if (pts.length >= 3) out.push({ k: 'poly', pts });
    } else if (nums.length >= 4) {
      const pts: [number, number, number, number] = [nums[0], nums[1], nums[2], nums[3]];
      if (pts[0] === pts[2] && pts[1] === pts[3]) continue;
      if (k === 'A') out.push({ k: 'arrow', pts, color });
      else if (k === 'R') out.push({ k: 'rect', pts });
      else out.push({ k: 'line', pts, ...(k === 'D' ? { dash: true } : {}) });
    }
  }
  return out;
}

// ---------- LaTeX → εικόνα ----------

interface MathJaxApi {
  startup: { promise: Promise<void> };
  tex2svg(tex: string, opts: { display: boolean }): HTMLElement;
}

let mj: Promise<MathJaxApi> | null = null;
function mathjax(): Promise<MathJaxApi> {
  mj ??= (async () => {
    const w = window as unknown as { MathJax: unknown };
    w.MathJax = { startup: { typeset: false }, svg: { fontCache: 'none' } };
    await import('mathjax/es5/tex-svg.js');
    const api = w.MathJax as MathJaxApi;
    await api.startup.promise;
    return api;
  })();
  return mj;
}

/** Μετατρέπει LaTeX σε εικόνα SVG (data URL). `em` = μέγεθος γραμματοσειράς σε μονάδες πίνακα. */
export async function texToImage(tex: string, color: string, em: number): Promise<{ src: string; w: number; h: number }> {
  const api = await mathjax();
  const svg = api.tex2svg(tex, { display: true }).querySelector('svg');
  if (!svg) throw new Error('Ο τύπος δεν μπόρεσε να σχεδιαστεί');
  if (svg.querySelector('[data-mjx-error]')) throw new Error('Ο τύπος που επέστρεψε η υπηρεσία δεν είναι έγκυρος');
  // το viewBox του MathJax είναι σε χιλιοστά του em
  const vb = (svg.getAttribute('viewBox') ?? '0 0 1000 1000').split(/\s+/).map(Number);
  const w = (vb[2] / 1000) * em;
  const h = (vb[3] / 1000) * em;
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(h));
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.removeAttribute('style');
  const xml = new XMLSerializer().serializeToString(svg).replace(/currentColor/g, color);
  return { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`, w, h };
}

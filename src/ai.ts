/** Αναγνώριση χειρόγραφου με εξωτερική υπηρεσία (Gemini ή Claude). Το κλειδί μένει μόνο σε αυτή τη συσκευή. */

export type Provider = 'gemini' | 'claude';
export type RecKind = 'text' | 'math';
/** Τι ζητάμε από την υπηρεσία: μεταγραφή (κείμενο ή τύπος) ή λύση της άσκησης. */
export type AiTask = RecKind | 'solve' | 'check';

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
  return kind === 'check' ? raw.trim() : clean(raw);
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

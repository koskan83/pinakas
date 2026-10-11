/** Μικρός, ασφαλής μεταγλωττιστής μαθηματικών εκφράσεων του x (χωρίς eval). */

/** Τιμές παραμέτρων (a, b, …) που ορίζονται με δρομείς. */
export type Params = Record<string, number>;
export type Fn = (x: number, p?: Params) => number;

const FUNCS: Record<string, (v: number) => number> = {
  'ημ': Math.sin,
  'συν': Math.cos,
  'εφ': Math.tan,
  'σφ': (v) => 1 / Math.tan(v),
  'ρίζα': Math.sqrt, 'ριζα': Math.sqrt,
  ln: Math.log,
  log: Math.log10,
};
const CONSTS: Record<string, number> = { 'π': Math.PI, e: Math.E };
/** Αγγλικά ονόματα που δεν δεχόμαστε, με το ελληνικό που τους αντιστοιχεί. */
const ENGLISH: Record<string, string> = { sin: 'ημ', cos: 'συν', tan: 'εφ', cot: 'σφ', sqrt: '√', abs: '|x|', exp: 'e^x', pi: 'π' };

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'par'; v: string } | { t: 'op'; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  const s = src.replace(/\s+/g, '').replace(/[·×]/g, '*').replace(/[:÷]/g, '/').replace(/−/g, '-');
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    const num = /^\d+([.,]\d+)?|^[.,]\d+/.exec(s.slice(i));
    if (num) {
      out.push({ t: 'num', v: parseFloat(num[0].replace(',', '.')) });
      i += num[0].length;
    } else if (/[a-zA-Zα-ωΑ-Ωάέήίόύώ]/.test(ch)) {
      let j = i;
      while (j < s.length && /[a-zA-Zα-ωΑ-Ωάέήίόύώ]/.test(s[j])) j++;
      let word = s.slice(i, j).toLowerCase();
      const en = Object.keys(ENGLISH).find((w) => word.includes(w));
      if (en) throw new Error(`γράψε «${ENGLISH[en]}» αντί για «${en}»`);
      // «2xsin» δεν υπάρχει ως λέξη: κόβουμε το μακρύτερο γνωστό πρόθεμα, αλλιώς ένα γράμμα
      const known = [...Object.keys(FUNCS), ...Object.keys(CONSTS), 'x'].sort((a, b) => b.length - a.length);
      while (word.length) {
        const k = known.find((w) => word.startsWith(w));
        // ό,τι δεν είναι γνωστό όνομα είναι παράμετρος ενός γράμματος (a, b, λ …)
        if (k) out.push({ t: 'id', v: k });
        else out.push({ t: 'par', v: word[0] });
        word = word.slice(k ? k.length : 1);
      }
      i = j;
    } else if ('+-*/^()|²³√'.includes(ch)) {
      out.push({ t: 'op', v: ch });
      i++;
    } else {
      throw new Error(`Άγνωστο σύμβολο «${ch}»`);
    }
  }
  return out;
}

/** Μετατρέπει π.χ. «f(x)=x²-3x+2» σε συνάρτηση. Πετάει Error αν η έκφραση δεν είναι έγκυρη. */
export function compile(src: string): Fn {
  const toks = tokenize(src.slice(src.lastIndexOf('=') + 1));
  if (toks.length === 0) throw new Error('Κενή έκφραση');
  let p = 0;
  const peek = (): Tok | undefined => toks[p];
  const isOp = (v: string): boolean => toks[p]?.t === 'op' && toks[p].v === v;
  const eat = (v: string): void => {
    if (!isOp(v)) throw new Error(`Λείπει «${v}»`);
    p++;
  };

  function expr(): Fn {
    let l = term();
    while (isOp('+') || isOp('-')) {
      const op = toks[p++].v;
      const a = l, b = term();
      l = op === '+' ? (x, q) => a(x, q) + b(x, q) : (x, q) => a(x, q) - b(x, q);
    }
    return l;
  }
  function startsPrimary(): boolean {
    const t = peek();
    return !!t && (t.t !== 'op' || t.v === '(' || t.v === '√');
  }
  function term(): Fn {
    let l = unary();
    for (;;) {
      if (isOp('*') || isOp('/')) {
        const op = toks[p++].v;
        const a = l, b = unary();
        l = op === '*' ? (x, q) => a(x, q) * b(x, q) : (x, q) => a(x, q) / b(x, q);
      } else if (startsPrimary()) {
        const a = l, b = power();
        l = (x, q) => a(x, q) * b(x, q);
      } else {
        return l;
      }
    }
  }
  function unary(): Fn {
    if (isOp('-')) {
      p++;
      const a = unary();
      return (x, q) => -a(x, q);
    }
    if (isOp('+')) {
      p++;
      return unary();
    }
    return power();
  }
  function power(): Fn {
    let b = primary();
    while (isOp('²') || isOp('³')) {
      const n = toks[p++].v === '²' ? 2 : 3;
      const a = b;
      b = (x, q) => a(x, q) ** n;
    }
    if (isOp('^')) {
      p++;
      const a = b, e = unary();
      return (x, q) => a(x, q) ** e(x, q);
    }
    return b;
  }
  function primary(): Fn {
    const t = toks[p++];
    if (!t) throw new Error('Η έκφραση είναι ημιτελής');
    if (t.t === 'num') {
      const v = t.v;
      return () => v;
    }
    if (t.t === 'par') {
      const name = t.v;
      return (_x, q) => q?.[name] ?? 1;
    }
    if (t.t === 'id') {
      if (t.v === 'x') return (x) => x;
      if (t.v in CONSTS) {
        const v = CONSTS[t.v];
        return () => v;
      }
      const f = FUNCS[t.v];
      // sin(x)^2 = (sin x)^2, αλλά sin x^2 = sin(x^2)
      let a: Fn;
      if (isOp('(')) {
        p++;
        a = expr();
        eat(')');
      } else {
        a = power();
      }
      return (x, q) => f(a(x, q));
    }
    if (t.v === '(') {
      const a = expr();
      eat(')');
      return a;
    }
    if (t.v === '|') {
      const a = expr();
      eat('|');
      return (x, q) => Math.abs(a(x, q));
    }
    if (t.v === '√') {
      const a = power();
      return (x, q) => Math.sqrt(a(x, q));
    }
    throw new Error(`Δεν περίμενα «${t.v}»`);
  }

  const f = expr();
  if (p < toks.length) throw new Error(`Δεν περίμενα «${toks[p].v}»`);
  return f;
}

/** Οι παράμετροι (γράμματα εκτός του x) που εμφανίζονται στην έκφραση, με τη σειρά που γράφτηκαν. */
export function paramsOf(src: string): string[] {
  try {
    const names = tokenize(src.slice(src.lastIndexOf('=') + 1)).filter((t) => t.t === 'par').map((t) => t.v as string);
    return [...new Set(names)];
  } catch {
    return [];
  }
}

const cache = new Map<string, Fn | null>();
/** Όπως η compile, αλλά με μνήμη και null αντί για σφάλμα. */
export function compileCached(src: string): Fn | null {
  let f = cache.get(src);
  if (f === undefined) {
    try {
      f = compile(src);
    } catch {
      f = null;
    }
    cache.set(src, f);
  }
  return f;
}

export interface KeyPoint {
  x: number;
  y: number;
  kind: 'root' | 'ext' | 'cross';
}

/** Ρίζες, ακρότατα και σημεία τομής των συναρτήσεων μέσα στο παράθυρο των αξόνων (αριθμητικά, κατά προσέγγιση). */
export function keyPoints(fns: Fn[], p: Params, xmin: number, xmax: number, ymin: number, ymax: number): KeyPoint[] {
  const N = 600;
  const h = (xmax - xmin) / N;
  const out: KeyPoint[] = [];
  const add = (x: number, y: number, kind: KeyPoint['kind']): void => {
    if (!Number.isFinite(y) || y < ymin - 1e-9 || y > ymax + 1e-9 || out.length >= 40) return;
    if (out.some((o) => Math.abs(o.x - x) < h * 2 && Math.abs(o.y - y) < (ymax - ymin) / 200)) return;
    out.push({ x, y, kind });
  };
  const bisect = (g: (x: number) => number, a: number, b: number): number | null => {
    let ga = g(a);
    for (let i = 0; i < 50; i++) {
      const m = (a + b) / 2, gm = g(m);
      if (!Number.isFinite(gm)) return null;
      if (ga < 0 === gm < 0) { a = m; ga = gm; } else b = m;
    }
    return (a + b) / 2;
  };
  /** Σημεία όπου η g αλλάζει πρόσημο (όχι ασύμπτωτες). */
  const zeros = (g: (x: number) => number, exact: boolean, hit: (x: number) => void): void => {
    // η παράγωγος συχνά μηδενίζεται ακριβώς σε ακέραιο x: μετατοπίζουμε λίγο το πλέγμα για να μην το χάσουμε
    const x0 = exact ? xmin : xmin - h * 0.3183;
    let px = x0, pg = g(px);
    for (let i = 1; i <= N + (exact ? 0 : 1); i++) {
      const x = x0 + i * h, gx = g(x);
      if (Number.isFinite(pg) && Number.isFinite(gx)) {
        if (pg === 0) {
          if (exact && gx !== 0) hit(px);
        } else if (gx !== 0 && pg < 0 !== gx < 0) {
          const r = bisect(g, px, x);
          if (r !== null && Math.abs(g(r)) < 1e-6 * (1 + Math.abs(pg) + Math.abs(gx))) hit(r);
        }
      }
      px = x;
      pg = gx;
    }
  };
  const e = h / 50;
  for (const f of fns) {
    zeros((x) => f(x, p), true, (r) => add(r, 0, 'root'));
    zeros((x) => f(x + e, p) - f(x - e, p), false, (r) => r >= xmin && r <= xmax && add(r, f(r, p), 'ext'));
  }
  for (let i = 0; i < fns.length; i++)
    for (let j = i + 1; j < fns.length; j++) zeros((x) => fns[i](x, p) - fns[j](x, p), true, (r) => add(r, fns[i](r, p), 'cross'));
  return out;
}

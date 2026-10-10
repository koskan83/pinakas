/** Μικρός, ασφαλής μεταγλωττιστής μαθηματικών εκφράσεων του x (χωρίς eval). */

export type Fn = (x: number) => number;

const FUNCS: Record<string, (v: number) => number> = {
  sin: Math.sin, 'ημ': Math.sin,
  cos: Math.cos, 'συν': Math.cos,
  tan: Math.tan, 'εφ': Math.tan,
  sqrt: Math.sqrt, 'ρίζα': Math.sqrt, 'ριζα': Math.sqrt,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
};
const CONSTS: Record<string, number> = { pi: Math.PI, 'π': Math.PI, e: Math.E };

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

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
      // «2xsin» δεν υπάρχει ως λέξη: κόβουμε το μακρύτερο γνωστό πρόθεμα, αλλιώς ένα γράμμα
      const known = [...Object.keys(FUNCS), ...Object.keys(CONSTS), 'x'].sort((a, b) => b.length - a.length);
      while (word.length) {
        const k = known.find((w) => word.startsWith(w));
        if (!k) throw new Error(`Άγνωστο σύμβολο «${word}»`);
        out.push({ t: 'id', v: k });
        word = word.slice(k.length);
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
      l = op === '+' ? (x) => a(x) + b(x) : (x) => a(x) - b(x);
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
        l = op === '*' ? (x) => a(x) * b(x) : (x) => a(x) / b(x);
      } else if (startsPrimary()) {
        const a = l, b = power();
        l = (x) => a(x) * b(x);
      } else {
        return l;
      }
    }
  }
  function unary(): Fn {
    if (isOp('-')) {
      p++;
      const a = unary();
      return (x) => -a(x);
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
      b = (x) => a(x) ** n;
    }
    if (isOp('^')) {
      p++;
      const a = b, e = unary();
      return (x) => a(x) ** e(x);
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
      return (x) => f(a(x));
    }
    if (t.v === '(') {
      const a = expr();
      eat(')');
      return a;
    }
    if (t.v === '|') {
      const a = expr();
      eat('|');
      return (x) => Math.abs(a(x));
    }
    if (t.v === '√') {
      const a = power();
      return (x) => Math.sqrt(a(x));
    }
    throw new Error(`Δεν περίμενα «${t.v}»`);
  }

  const f = expr();
  if (p < toks.length) throw new Error(`Δεν περίμενα «${toks[p].v}»`);
  return f;
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

// WSM Information Retrieval Engine
// Author: Sourav Mishra | ID: B124133 | CSE-B
// Supervisor: Dr. Rakesh Chandra Balabantaray
// (c) 2026 Sourav Mishra. All rights reserved.

import { STOP, tokenize, soundex } from "./preprocessing";

export type Doc = { name: string; text: string };
type Postings = Map<number, number[]>;

export class DocIndex {
  names: string[] = [];
  raw: string[] = [];
  pos = new Map<string, Postings>(); // positional inverted index (L2)
  zt = new Map<string, Set<number>>(); // zone index: title (L6)
  zb = new Map<string, Set<number>>(); // zone index: body (L6)
  perm = new Map<string, string>(); // permuterm index (L3)
  sdx = new Map<string, Set<string>>(); // soundex index (L3)
  vocab = new Set<string>();
  idf = new Map<string, number>();
  vec = new Map<number, Map<string, number>>(); // tf-idf vectors (L7)
  mag: number[] = [];

  get n() {
    return this.names.length;
  }

  private clear() {
    this.names = [];
    this.raw = [];
    this.pos = new Map();
    this.zt = new Map();
    this.zb = new Map();
    this.perm = new Map();
    this.sdx = new Map();
    this.vocab = new Set();
    this.idf = new Map();
    this.vec = new Map();
    this.mag = [];
  }

  build(input: Doc[]) {
    this.clear();
    const docs = [...input].sort((a, b) => a.name.localeCompare(b.name));
    const tf: Map<string, number>[] = [];
    const add = (m: Map<string, Set<number>>, t: string, id: number) => {
      let s = m.get(t);
      if (!s) m.set(t, (s = new Set()));
      s.add(id);
    };
    docs.forEach((d, id) => {
      this.names.push(d.name);
      this.raw.push(d.text);
      const lines = d.text.split("\n");
      const body = lines.length > 1 ? lines.slice(1).join("\n") : d.text;
      tokenize(lines[0], true).forEach((t) => add(this.zt, t, id));
      tokenize(body, true).forEach((t) => add(this.zb, t, id));
      const counts = new Map<string, number>();
      tokenize(d.text).forEach((t, p) => {
        let m = this.pos.get(t);
        if (!m) this.pos.set(t, (m = new Map()));
        let l = m.get(id);
        if (!l) m.set(id, (l = []));
        l.push(p);
        this.vocab.add(t);
        if (!STOP.has(t)) counts.set(t, (counts.get(t) ?? 0) + 1);
      });
      tf.push(counts);
    });
    const N = docs.length;
    this.vocab.forEach((t) => {
      const code = soundex(t);
      if (code) {
        let s = this.sdx.get(code);
        if (!s) this.sdx.set(code, (s = new Set()));
        s.add(t);
      }
      const a = t + "$";
      for (let i = 0; i < a.length; i++) this.perm.set(a.slice(i) + a.slice(0, i), t);
      if (!STOP.has(t)) this.idf.set(t, Math.log((N + 1) / (this.pos.get(t)!.size + 1)) + 1);
    });
    tf.forEach((counts, id) => {
      const v = new Map<string, number>();
      let sq = 0;
      counts.forEach((c, t) => {
        const w = (1 + Math.log(c)) * this.idf.get(t)!;
        v.set(t, w);
        sq += w * w;
      });
      this.vec.set(id, v);
      this.mag[id] = Math.sqrt(sq);
    });
    return N;
  }
}

/** Variable Byte encoding of a gap list (L5). */
export const vbEncode = (nums: number[]): number[] => {
  const out: number[] = [];
  for (const x of nums) {
    let n = x;
    const b: number[] = [];
    do {
      b.unshift(n % 128);
      n = Math.floor(n / 128);
    } while (n > 0);
    b[b.length - 1] += 128;
    out.push(...b);
  }
  return out;
};

export const vbDecode = (bytes: number[]): number[] => {
  const out: number[] = [];
  let n = 0;
  for (const b of bytes) {
    if (b < 128) n = n * 128 + b;
    else {
      out.push(n * 128 + b - 128);
      n = 0;
    }
  }
  return out;
};

/** Elias gamma code for n >= 1 (L5). */
export const gammaEncode = (n: number): string => {
  const b = n.toString(2);
  return "1".repeat(b.length - 1) + "0" + b.slice(1);
};

export const gammaDecode = (s: string): number[] => {
  const out: number[] = [];
  let i = 0;
  while (i < s.length) {
    let len = 0;
    while (s[i] === "1") {
      len++;
      i++;
    }
    i++;
    out.push(parseInt("1" + s.slice(i, i + len), 2));
    i += len;
  }
  return out;
};
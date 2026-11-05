// WSM Information Retrieval Engine
// Author: Sourav Mishra | ID: B124133 | CSE-B
// Supervisor: Dr. Rakesh Chandra Balabantaray
// (c) 2026 Sourav Mishra. All rights reserved.

import { DocIndex } from "./indexing";
import { tokenize, soundex, editDistance } from "./preprocessing";

export type Hit = { doc: number; score: number };
const NONE = new Map<number, number[]>();

export class Core {
  constructor(private x: DocIndex) {}

  private post(t: string) {
    return this.x.pos.get(t) ?? NONE;
  }
  private docsOf(t: string) {
    return new Set(this.post(t).keys());
  }
  private docsOfTerms(ts: string[]) {
    const s = new Set<number>();
    ts.forEach((t) => this.post(t).forEach((_, d) => s.add(d)));
    return s;
  }
  private plain(s: Iterable<number>): Hit[] {
    return [...s].sort((a, b) => a - b).map((doc) => ({ doc, score: 1 }));
  }

  /** Permuterm wildcard resolution (L3). */
  wildcard(q: string): string[] {
    q = q.toLowerCase();
    if (!q.includes("*")) return this.x.vocab.has(q) ? [q] : [];
    const p = q.split("*");
    if (p.length === 2) {
      const key = `${p[1]}$${p[0]}`;
      const r = new Set<string>();
      this.x.perm.forEach((orig, rot) => {
        if (rot.startsWith(key)) r.add(orig);
      });
      return [...r];
    }
    const re = new RegExp("^" + p.map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
    return [...this.x.vocab].filter((t) => re.test(t));
  }
  wildcardSearch(q: string) {
    return this.plain(this.docsOfTerms(this.wildcard(q)));
  }

  soundexSearch(word: string) {
    const terms = this.x.sdx.get(soundex(word)) ?? new Set<string>();
    return this.plain(this.docsOfTerms([...terms]));
  }

  /** Boolean retrieval, evaluated left to right (L1). */
  boolean(q: string): Hit[] {
    let res = null as Set<number> | null;
    let op = "AND";
    for (const tok of q.split(/\s+/)) {
      const u = tok.toUpperCase();
      if (u === "AND" || u === "OR" || u === "NOT") {
        op = u;
        continue;
      }
      let m: Set<number>;
      if (tok.includes("*")) m = this.docsOfTerms(this.wildcard(tok));
      else {
        const c = tokenize(tok);
        if (!c.length) continue;
        m = this.docsOf(c[0]);
      }
      const cur = res as Set<number> | null;
      if (cur === null) res = op === "NOT" ? new Set([...Array(this.x.n).keys()].filter((d) => !m.has(d))) : m;
      else if (op === "AND") res = new Set([...cur].filter((d) => m.has(d)));
      else if (op === "OR") res = new Set([...cur, ...m]);
      else res = new Set([...cur].filter((d) => !m.has(d)));
    }
    return this.plain(res ?? []);
  }

  /** Exact phrase via positional index (L2). */
  phrase(q: string): Hit[] {
    const t = tokenize(q);
    if (!t.length) return [];
    let c = this.docsOf(t[0]);
    for (const w of t.slice(1)) {
      const s = this.docsOf(w);
      c = new Set([...c].filter((d) => s.has(d)));
    }
    return this.plain(
      [...c].filter((d) => this.post(t[0]).get(d)!.some((p) => t.every((w, i) => this.post(w).get(d)!.includes(p + i))))
    );
  }

  /** Proximity: a /k b (L2). */
  proximity(a: string, b: string, k: number): Hit[] {
    const A = this.post(a.toLowerCase());
    const B = this.post(b.toLowerCase());
    return this.plain([...A.keys()].filter((d) => B.has(d) && A.get(d)!.some((p) => B.get(d)!.some((r) => Math.abs(p - r) <= k))));
  }

  /** Weighted linear zone scoring (L6). */
  zone(ts: string[], wTitle = 0.6, wBody = 0.4): Hit[] {
    const m = new Map<number, number>();
    ts.forEach((t) => {
      this.x.zt.get(t)?.forEach((d) => m.set(d, (m.get(d) ?? 0) + wTitle));
      this.x.zb.get(t)?.forEach((d) => m.set(d, (m.get(d) ?? 0) + wBody));
    });
    return [...m].map(([doc, s]) => ({ doc, score: s / ts.length })).sort((a, b) => b.score - a.score);
  }

  private rank(q: Map<string, number>): Hit[] {
    let qm = 0;
    q.forEach((v) => (qm += v * v));
    qm = Math.sqrt(qm);
    if (!qm) return [];
    const out: Hit[] = [];
    this.x.vec.forEach((v, d) => {
      const dm = this.x.mag[d];
      if (!dm) return;
      let dot = 0;
      q.forEach((w, t) => (dot += w * (v.get(t) ?? 0)));
      if (dot > 0) out.push({ doc: d, score: dot / (qm * dm) });
    });
    return out.sort((a, b) => b.score - a.score);
  }

  /** Cosine similarity in tf-idf space (L6, L7). */
  vsm(tokens: string[]): Hit[] {
    const c = new Map<string, number>();
    tokens.forEach((t) => c.set(t, (c.get(t) ?? 0) + 1));
    const q = new Map<string, number>();
    c.forEach((n, t) => {
      if (this.x.idf.has(t)) q.set(t, (1 + Math.log(n)) * this.x.idf.get(t)!);
    });
    return this.rank(q);
  }

  /** Rocchio relevance feedback (L9). */
  rocchio(tokens: string[], rel: number[], non: number[], a = 1, b = 0.75, g = 0.15): Hit[] {
    const q = new Map<string, number>();
    tokens.forEach((t) => {
      if (this.x.idf.has(t)) q.set(t, a * this.x.idf.get(t)!);
    });
    const mix = (docs: number[], k: number) =>
      docs.forEach((d) => this.x.vec.get(d)!.forEach((v, t) => q.set(t, (q.get(t) ?? 0) + (k / docs.length) * v)));
    mix(rel, b);
    mix(non, -g);
    [...q].forEach(([t, v]) => v <= 0 && q.delete(t));
    return this.rank(q);
  }

  /** Pseudo relevance feedback: top-k assumed relevant (L9). */
  prf(tokens: string[], k = 2): Hit[] {
    const r = this.vsm(tokens);
    if (!r.length) return [];
    return this.rocchio(tokens, r.slice(0, k).map((h) => h.doc), r.slice(k).map((h) => h.doc));
  }

  /** Key-word-in-context snippet (L8). */
  kwic(doc: number, qTokens: string[], size = 25): string {
    const words = this.x.raw[doc].split(/\s+/).filter(Boolean);
    const set = new Set(qTokens);
    const i = words.findIndex((w) => tokenize(w).some((t) => set.has(t)));
    if (i < 0) return words.slice(0, size).join(" ") + "…";
    const s = Math.max(0, i - 10);
    return (s > 0 ? "… " : "") + words.slice(s, s + size).join(" ") + " …";
  }

  /** "Did you mean": nearest vocabulary word by edit distance (L3). */
  spell(q: string): string {
    return tokenize(q)
      .map((t) => {
        if (this.x.vocab.has(t) || !this.x.vocab.size) return t;
        let best = t;
        let bd = Infinity;
        this.x.vocab.forEach((w) => {
          const d = editDistance(t, w);
          if (d < bd) {
            bd = d;
            best = w;
          }
        });
        return best;
      })
      .join(" ");
  }

  /** Precision, recall, F1 (L8). */
  static evaluate(retrieved: number[], relevant: number[]) {
    const rel = new Set(relevant);
    const tp = retrieved.filter((d) => rel.has(d)).length;
    const p = retrieved.length ? tp / retrieved.length : 0;
    const r = relevant.length ? tp / relevant.length : 0;
    return { precision: p, recall: r, f1: p + r ? (2 * p * r) / (p + r) : 0 };
  }
}
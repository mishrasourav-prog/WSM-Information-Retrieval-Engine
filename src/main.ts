// WSM Information Retrieval Engine
// Author: Sourav Mishra | ID: B124133 | CSE-B
// Supervisor: Dr. Rakesh Chandra Balabantaray
// (c) 2026 Sourav Mishra. All rights reserved.

import "./style.css";
import { DocIndex, vbEncode, vbDecode, gammaEncode, gammaDecode } from "./indexing";
import { Core, Hit } from "./searchCore";
import { tokenize, soundex } from "./preprocessing";

const files = import.meta.glob("../documents_data/*.txt", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const idx = new DocIndex();
const core = new Core(idx);

const MODES = ["Vector Space (Cosine)", "Boolean", "Exact Phrase", "Proximity (/k)", "Zone Scoring (Title/Body)", "Wildcard", "Soundex (Phonetic)"];
const SCORED = [0, 4];

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
<main>
  <header>
    <h1>WSM Information Retrieval Engine</h1>
    <p class="byline">Sourav Mishra · ID B124133 · CSE-B</p>
    <p id="status">Loading…</p>
  </header>
  <section class="bar">
    <input id="q" placeholder="Enter a query" autocomplete="off" />
    <select id="mode">${MODES.map((m, i) => `<option value="${i}">${m}</option>`).join("")}</select>
    <label class="k">k <input id="k" type="number" min="1" value="3" /></label>
    <button id="go">Search</button>
  </section>
  <section class="bar tools">
    <button id="rocchio">Rocchio RF</button>
    <button id="prf">Pseudo RF</button>
    <button id="spell">Did you mean?</button>
    <button id="comp">Gap compression</button>
    <label class="file">Load .txt files<input id="file" type="file" accept=".txt" multiple hidden /></label>
    <button id="reset" hidden>Use sample documents</button>
  </section>
  <pre id="note" hidden></pre>
  <section class="panel">
    <table>
      <thead><tr><th>#</th><th>Document</th><th>Score</th><th>Snippet</th></tr></thead>
      <tbody id="rows"></tbody>
    </table>
  </section>
  <section class="panel"><h2 id="title">Document</h2><pre id="preview">Select a result to read it.</pre></section>
  <footer>
    <strong>WSM Information Retrieval Engine</strong>
    <span>Developed by Sourav Mishra (ID: B124133), CSE-B</span>
    <span>Under the guidance of Dr. Rakesh Chandra Balabantaray</span>
  </footer>
</main>`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

let qTokens: string[] = [];
let hl = new Set<string>(); // terms to highlight
let hits: Hit[] = [];
let sel: number | null = null;
let scored = true;

/** Escape text and wrap highlighted terms in <mark>. */
const hlText = (text: string) =>
  text
    .split(/([a-z0-9]+)/i)
    .map((p) => (hl.has(p.toLowerCase()) ? `<mark>${esc(p)}</mark>` : esc(p)))
    .join("");

const note = (msg: string) => {
  $("note").hidden = !msg;
  $("note").textContent = msg;
};

function load(docs: { name: string; text: string }[], custom = false) {
  const n = idx.build(docs);
  hits = [];
  sel = null;
  $("rows").innerHTML = "";
  $("preview").textContent = "Select a result to read it.";
  $("title").textContent = "Document";
  const names = docs.map((d) => d.name);
  const label = custom
    ? "Your files: " + (names.length > 3 ? `${names.slice(0, 3).join(", ")} +${names.length - 3} more` : names.join(", "))
    : "Sample documents";
  $("status").innerHTML = n
    ? `Now searching: <strong>${esc(label)}</strong> · ${n} document${n > 1 ? "s" : ""} · ${idx.vocab.size} terms`
    : "No documents loaded";
  $("reset").hidden = !custom;
  note("");
}

function show(h: Hit[], isScored = scored) {
  hits = h;
  sel = null;
  scored = isScored;
  $("rows").innerHTML = h.length
    ? h
        .map(
          (x, i) => `<tr data-d="${x.doc}"><td>${i + 1}</td><td>${esc(idx.names[x.doc])}</td>
          <td>${scored ? x.score.toFixed(4) : "match"}</td><td>${hlText(core.kwic(x.doc, [...hl]))}</td></tr>`
        )
        .join("")
    : `<tr><td colspan="4" class="empty">No documents matched.</td></tr>`;
}

function search() {
  const q = $<HTMLInputElement>("q").value.trim();
  if (!q || !idx.n) return;
  const m = Number($<HTMLSelectElement>("mode").value);
  const k = Math.max(1, Number($<HTMLInputElement>("k").value) || 3);
  qTokens = tokenize(q.replace(/\*/g, " "), true);
  const first = tokenize(q);
  const r: Hit[] =
    m === 1 ? core.boolean(q)
    : m === 2 ? core.phrase(q)
    : m === 3 ? (first.length >= 2 ? core.proximity(first[0], first[1], k) : [])
    : m === 4 ? core.zone(qTokens)
    : m === 5 ? core.wildcardSearch(q)
    : m === 6 ? core.soundexSearch(first[0] ?? "")
    : core.vsm(qTokens);
  const terms = new Set<string>(qTokens);
  if (m === 1 || m === 5 || m === 6) terms.clear();
  if (m === 1)
    q.split(/\s+/).forEach((t) => {
      if (["AND", "OR", "NOT"].includes(t.toUpperCase())) return;
      (t.includes("*") ? core.wildcard(t) : tokenize(t)).forEach((w) => terms.add(w));
    });
  else if (m === 2 || m === 3) first.forEach((w) => terms.add(w));
  else if (m === 5) core.wildcard(q).forEach((w) => terms.add(w));
  else if (m === 6) idx.sdx.get(soundex(first[0] ?? ""))?.forEach((w) => terms.add(w));
  hl = terms;
  note("");
  show(r, SCORED.includes(m));
}

$("go").onclick = search;
$("q").addEventListener("keydown", (e) => e.key === "Enter" && search());

$("rows").addEventListener("click", (e) => {
  const tr = (e.target as HTMLElement).closest("tr[data-d]") as HTMLElement | null;
  if (!tr) return;
  sel = Number(tr.dataset.d);
  document.querySelectorAll("#rows tr").forEach((r) => r.classList.toggle("sel", r === tr));
  $("title").textContent = idx.names[sel];
  const pre = $("preview");
  pre.innerHTML = hlText(idx.raw[sel]);
  const first = pre.querySelector("mark") as HTMLElement | null;
  pre.scrollTop = first ? Math.max(0, first.offsetTop - 40) : 0;
});

$("rocchio").onclick = () => {
  if (sel === null) return note("Select a result row first. It will be treated as relevant feedback.");
  const chosen = sel;
  const non = hits.map((h) => h.doc).filter((d) => d !== chosen);
  const name = idx.names[chosen];
  show(core.rocchio(qTokens, [chosen], non), true);
  note(`Rocchio: refined ranking using "${name}" as relevant.`);
};

$("prf").onclick = () => {
  if (!qTokens.length) return note("Run a search first.");
  show(core.prf(qTokens, 2), true);
  note("Pseudo relevance feedback: top 2 results assumed relevant.");
};

$("spell").onclick = () => {
  const input = $<HTMLInputElement>("q");
  if (!input.value.trim()) return;
  const s = core.spell(input.value);
  if (s === tokenize(input.value).join(" ")) return note("No spelling suggestion needed.");
  input.value = s;
  search();
  note(`Did you mean: "${s}"? Query replaced.`);
};

$("comp").onclick = () => {
  let best = "";
  let df = 0;
  idx.pos.forEach((p, t) => {
    if (p.size > df) {
      df = p.size;
      best = t;
    }
  });
  if (!best) return note("Load documents first.");
  const ids = [...idx.pos.get(best)!.keys()].sort((a, b) => a - b).map((d) => d + 1);
  const gaps = ids.map((d, i) => (i ? d - ids[i - 1] : d));
  const vb = vbEncode(gaps);
  const gm = gaps.map(gammaEncode).join("");
  note(
    [
      `Postings list of "${best}" (docIDs start at 1)`,
      `DocIDs:        ${ids.join(", ")}`,
      `Gaps:          ${gaps.join(", ")}`,
      `VB bytes:      ${vb.join(", ")}`,
      `VB decoded:    ${vbDecode(vb).join(", ")}`,
      `Gamma bits:    ${gm}`,
      `Gamma decoded: ${gammaDecode(gm).join(", ")}`,
    ].join("\n")
  );
};

const SAMPLE = Object.entries(files).map(([p, text]) => ({ name: p.split("/").pop()!, text }));

$<HTMLInputElement>("file").onchange = async (e) => {
  const input = e.target as HTMLInputElement;
  const f = [...(input.files ?? [])];
  if (f.length) {
    load(await Promise.all(f.map(async (x) => ({ name: x.name, text: await x.text() }))), true);
    note(`Loaded ${f.length} file${f.length > 1 ? "s" : ""}: ${f.map((x) => x.name).join(", ")}\nSearches now run only on these files.`);
  }
  input.value = "";
};

$("reset").onclick = () => {
  load(SAMPLE);
  note("Switched back to the sample documents.");
};

load(SAMPLE);
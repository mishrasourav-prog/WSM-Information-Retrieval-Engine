# WSM Information Retrieval Engine

| | |
|---|---|
| **Name** | Sourav Mishra |
| **ID** | B124133 |
| **Branch** | CSE-B |
| **Project** | WSM Information Retrieval Engine |
| **Under Professor** | Dr. Rakesh Chandra Balabantaray |

&copy; 2026 Sourav Mishra. All rights reserved.

---

## Overview (TypeScript + Vite)

A browser-based information retrieval engine. All indexing and search run
client-side, so it deploys as a static site. Documents are the `.txt` files in
`documents_data/` (first line = title, rest = body). You can also load your own
`.txt` files from the UI.

## Structure
```
wsm-search-engine/
├── documents_data/      sample corpus
├── src/
│   ├── preprocessing.ts tokenizer, stop words, Soundex, edit distance
│   ├── indexing.ts      positional/zone/permuterm/Soundex/tf-idf indexes, VB + Gamma
│   ├── searchCore.ts    all retrieval models, Rocchio, PRF, KWIC, spell check
│   ├── main.ts          UI
│   └── style.css
├── index.html
├── package.json
└── tsconfig.json
```

## Run
```
npm install
npm run dev        # http://localhost:5173
npm run build      # outputs dist/
```

## Deploy
Static host, no backend needed. Vercel / Netlify: build command `npm run build`,
output directory `dist`. GitHub Pages: publish `dist`.

## Test cases
- Vector Space: `computer science algorithms`
- Boolean: `caesar AND brutus NOT calpurnia`
- Exact Phrase: `stanford university`
- Proximity (k = 3): `gates microsoft`
- Zone Scoring: `stanford`
- Wildcard: `mon*` or `hel*o`
- Soundex: `Herman`
- Rocchio RF: search, click a row, press "Rocchio RF"
- Pseudo RF: search, press "Pseudo RF"
- Spell check: type `algoritms`, press "Did you mean?"
- Compression: press "Gap compression"
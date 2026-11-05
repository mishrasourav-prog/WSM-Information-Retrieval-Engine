// WSM Information Retrieval Engine
// Author: Sourav Mishra | ID: B124133 | CSE-B
// Supervisor: Dr. Rakesh Chandra Balabantaray
// (c) 2026 Sourav Mishra. All rights reserved.

export const STOP = new Set(
  "a about above after again against all am an and any are as at be because been before being below between both but by could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself me more most my myself no nor not of off on once only or other ought our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why with would you your yours yourself yourselves".split(" ")
);

/** Case folding + token extraction (L2). */
export const tokenize = (text: string, removeStops = false): string[] => {
  const t = text.toLowerCase().match(/\b[a-z0-9]+\b/g) ?? [];
  return removeStops ? t.filter((w) => !STOP.has(w)) : t;
};

const CODES: Record<string, string> = {};
[["BFPV", "1"], ["CGJKQSXZ", "2"], ["DT", "3"], ["L", "4"], ["MN", "5"], ["R", "6"]].forEach(
  ([letters, d]) => letters.split("").forEach((c) => (CODES[c] = d))
);

/** Soundex phonetic code (L3). H and W do not separate duplicate codes. */
export function soundex(word: string): string {
  const w = word.toUpperCase().replace(/[^A-Z]/g, "");
  if (!w) return "";
  let out = w[0];
  let prev = CODES[w[0]] ?? "";
  for (const c of w.slice(1)) {
    const d = CODES[c] ?? "";
    if (d && d !== prev) out += d;
    if (c !== "H" && c !== "W") prev = d;
  }
  return (out + "000").slice(0, 4);
}

/** Levenshtein distance by dynamic programming (L3). */
export function editDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => {
    const row: number[] = new Array(b.length + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
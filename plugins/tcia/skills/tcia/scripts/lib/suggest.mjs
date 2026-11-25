// Suggestions for values that are not in the catalog (D10.4).

import { normalize, codePoints } from './text.mjs';
import { categoryEntries, APPROXIMATION_CATEGORY } from './catalog.mjs';

// suggest(value, category, scope, catalog) -> { suggestion, approximation }
export function suggest(value, category, scope, catalog) {
  const { suggestion, approximation } = suggestDetailed(value, category, scope, catalog);
  return { suggestion, approximation };
}

// Same as suggest(), plus `via`: 'alias' | 'id' | 'approximation' | 'distance' | null.
export function suggestDetailed(value, category, scope, catalog) {
  const x = normalize(value);
  const entries = categoryEntries(catalog, category, scope);

  // 1. Alias (or the id itself written another way, e.g. "pick up").
  for (const entry of entries) {
    if (entry.aliases.some((a) => normalize(a) === x)) {
      return { suggestion: entry.id, approximation: null, via: 'alias' };
    }
  }
  for (const entry of entries) {
    if (normalize(entry.id) === x && entry.id !== value) {
      return { suggestion: entry.id, approximation: null, via: 'id' };
    }
  }

  // 2. Approximation of that category.
  const approxCategory = APPROXIMATION_CATEGORY[category];
  if (approxCategory) {
    for (const ap of catalog.approximations) {
      if (ap.category !== approxCategory) continue;
      const words = [...(ap.es || []), ...(ap.en || [])].map(normalize);
      if (words.includes(x)) {
        return { suggestion: null, approximation: { to: ap.to, note: ap.note }, via: 'approximation' };
      }
    }
  }

  // 3. Edit distance against ids and aliases.
  const candidates = [];
  for (const entry of entries) {
    candidates.push({ id: entry.id, text: normalize(entry.id) });
    for (const a of entry.aliases) candidates.push({ id: entry.id, text: normalize(a) });
  }
  const best = closestCandidate(x, candidates);
  if (best) return { suggestion: best, approximation: null, via: 'distance' };

  // 4. Nothing.
  return { suggestion: null, approximation: null, via: null };
}

// Step 3 only, against a plain list of known ids or field names (E_REF,
// unknown fields). Returns the closest known value or null.
export function closest(value, known) {
  return closestCandidate(
    normalize(value),
    known.map((k) => ({ id: k, text: normalize(k) })),
  );
}

function closestCandidate(x, candidates) {
  const threshold = codePoints(x) <= 4 ? 1 : 2;
  let bestId = null;
  let bestDistance = Infinity;
  for (const c of candidates) {
    const d = distance(x, c.text);
    if (d < bestDistance) {
      bestDistance = d;
      bestId = c.id;
    }
  }
  return bestDistance <= threshold ? bestId : null;
}

// Levenshtein distance in code points, counting a swap of two adjacent
// characters as one edit (optimal string alignment), so "wlak" -> "walk" is 1.
export function distance(a, b) {
  const s = [...a];
  const t = [...b];
  const m = s.length;
  const n = t.length;
  const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

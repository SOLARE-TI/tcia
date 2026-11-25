// Text helpers shared by the validator, the builder and the tests (D6, D9, D10.6).

// Length in Unicode code points.
export function codePoints(text) {
  return [...String(text)].length;
}

// Alias normalization (D6): NFKD, strip combining marks, lowercase, every
// character outside a-z0-9 becomes a space, collapse spaces, trim.
export function normalize(s) {
  return String(s)
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Greedy word wrap, identical in validator and engine (D10.6).
// Collapse whitespace, trim, split on spaces; a word joins the current line
// when the line is empty or when len(line) + 1 + len(word) <= lineChars.
export function wrapText(text, lineChars) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (clean === '') return [];
  const lines = [];
  let line = '';
  for (const word of clean.split(' ')) {
    if (line === '') {
      line = word;
    } else if (codePoints(line) + 1 + codePoints(word) <= lineChars) {
      line += ' ' + word;
    } else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
}

// readSeconds(text) = clamp(base + perChar * n, min, max), n = code points (D9).
export function readSeconds(text, catalog) {
  const r = catalog.timing.readTime;
  const n = codePoints(text);
  return clamp(r.base + r.perChar * n, r.min, r.max);
}

export function clamp(x, min, max) {
  return Math.min(max, Math.max(min, x));
}

// Rounding used in every report (D9).
export function round3(x) {
  return Math.round(x * 1000) / 1000;
}

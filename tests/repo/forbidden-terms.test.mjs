// A12: no file contains a forbidden term (D17). The list holds only SHA-256
// hashes; on a hit the test prints the file, the line and 12 hash characters,
// never the word.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ROOT, readJson } from '../validator/helpers.mjs';
import { repoFiles, isBinary } from './walk.mjs';

const list = readJson(path.join(ROOT, 'tests/repo/forbidden-terms.sha256.json'));
const hashes = new Set(list.hashes);
const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

// D17: NFKD, strip combining marks, split camelCase, lowercase, every char
// outside a-z0-9 becomes a space, split into words.
export function words(line) {
  return line
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function grams(ws) {
  const out = [];
  for (let i = 0; i < ws.length; i++) {
    for (let n = 1; n <= 3 && i + n <= ws.length; n++) out.push(ws.slice(i, i + n).join(' '));
  }
  return out;
}

test('self-test hash', () => {
  assert.equal(list.algorithm, 'sha256');
  assert.equal(sha256(list.selfTest.gram), list.selfTest.sha256);
  assert.equal(list.hashes.length, list.count);
});

test('the scanner splits camelCase and accents as D17 says', () => {
  assert.deepEqual(words('TciaSelfTest, Ñandú-run'), ['tcia', 'self', 'test', 'nandu', 'run']);
  assert.ok(grams(words('one two three four')).includes('two three four'));
});

test('A12: no file contains a forbidden term', () => {
  const hits = [];
  for (const rel of repoFiles({ includeIgnored: true })) {
    const buffer = fs.readFileSync(path.join(ROOT, rel));
    if (isBinary(buffer)) continue;
    buffer.toString('utf8').split('\n').forEach((line, i) => {
      for (const g of grams(words(line))) {
        const h = sha256(g);
        if (hashes.has(h)) hits.push(`${rel}:${i + 1} ${h.slice(0, 12)}`);
      }
    });
  }
  assert.deepEqual(hits, []);
});

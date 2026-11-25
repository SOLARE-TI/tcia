// normalize, wrapText and readSeconds (D6, D9, D10.6).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, wrapText, readSeconds, codePoints } from '../../plugins/tcia/skills/tcia/scripts/lib/text.mjs';
import { catalog } from './helpers.mjs';

test('normalize: accents, case, punctuation and spaces', () => {
  assert.equal(normalize('Dragón'), 'dragon');
  assert.equal(normalize('  Mortal  hacia   atrás! '), 'mortal hacia atras');
  assert.equal(normalize('pick_up'), 'pick up');
  assert.equal(normalize('T-Shirt & Jeans'), 't shirt jeans');
  assert.equal(normalize('Ñandú'), 'nandu');
  assert.equal(normalize('360'), '360');
  assert.equal(normalize('¿¡!?'), '');
});

test('wrapText: greedy, 24 per line', () => {
  assert.deepEqual(wrapText('Rocky, today I jump the ramp!', 24), ['Rocky, today I jump the', 'ramp!']);
  assert.deepEqual(wrapText('  many    spaces\n\tand tabs ', 24), ['many spaces and tabs']);
  assert.deepEqual(wrapText('', 24), []);
  assert.deepEqual(wrapText('abcdefghijklmnopqrstuvwxyzabc short', 24), ['abcdefghijklmnopqrstuvwxyzabc', 'short']);
  // A word fits exactly when len(line) + 1 + len(word) == lineChars.
  assert.deepEqual(wrapText('aaaaaaaaaaa bbbbbbbbbbbb', 24), ['aaaaaaaaaaa bbbbbbbbbbbb']);
  assert.deepEqual(wrapText('aaaaaaaaaaa bbbbbbbbbbbbb', 24), ['aaaaaaaaaaa', 'bbbbbbbbbbbbb']);
});

test('wrapText counts code points, not UTF-16 units', () => {
  const emoji = '😀'.repeat(12);
  assert.deepEqual(wrapText(`${emoji} ${emoji}`, 24), [emoji, emoji]);
  assert.equal(codePoints(emoji), 12);
});

test('readSeconds: 0.9 + 0.055 per code point, clamped to 1.4-6', () => {
  assert.equal(readSeconds('Hi', catalog), 1.4);
  assert.ok(Math.abs(readSeconds('Rocky, today I jump the ramp!', catalog) - 2.495) < 1e-9);
  assert.equal(readSeconds('x'.repeat(200), catalog), 6);
  assert.ok(Math.abs(readSeconds('ñññññññññññññññññññ', catalog) - (0.9 + 0.055 * 19)) < 1e-9);
});

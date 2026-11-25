// A19: at least 5 good scripts (the contract example and 4 more) pass.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from '../../plugins/tcia/skills/tcia/scripts/lib/validate.mjs';
import { catalog, schema, example, readJson } from './helpers.mjs';

const GOOD = fileURLToPath(new URL('./fixtures/good/', import.meta.url));
const files = fs.readdirSync(GOOD).filter((f) => f.endsWith('.tcia.json')).sort();

test('there are at least 5 good fixtures', () => {
  assert.ok(files.length >= 5, `found ${files.length}`);
});

test('the contract example passes with no errors and no warnings', () => {
  const r = validate(example(), { catalog, schema });
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

for (const f of files) {
  test(`good fixture ${f}`, () => {
    const script = readJson(path.join(GOOD, f));
    const r = validate(script, { catalog, schema });
    assert.deepEqual(r.errors, [], r.errors.map((e) => `${e.code} ${e.message}`).join('\n'));
    assert.equal(r.ok, true);
    assert.deepEqual(r.warnings, []);
    assert.equal(r.stats.paths, r.stats.outcomes.length);
    assert.ok(r.stats.secondsMin <= r.stats.secondsMax);
    for (const e of script.endings) assert.ok(r.stats.endingsReach[e.id] > 0, `ending ${e.id} reachable`);
  });
}

test('the good fixtures use es, en and pt (with meta.ui)', () => {
  const langs = files.map((f) => readJson(path.join(GOOD, f)).meta);
  assert.ok(langs.some((m) => m.lang === 'es'));
  assert.ok(langs.some((m) => m.lang === 'en'));
  assert.ok(langs.some((m) => m.lang === 'pt' && m.ui));
});

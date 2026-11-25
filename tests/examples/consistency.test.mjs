// A46: the validator's stats.outcomes and the engine's outcomes() agree on
// combinations, endings and seconds (±0.01) for the contract example and the
// five examples.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validate } from '../../plugins/tcia/skills/tcia/scripts/lib/validate.mjs';
import { ROOT, catalog, schema, example, exampleDirs, exampleScript } from '../validator/helpers.mjs';

const CORE = path.join(ROOT, 'engine', 'src', 'core.mjs');

const scripts = [['contract example', example()], ...exampleDirs().map((slug) => [slug, exampleScript(slug)])];

for (const [name, script] of scripts) {
  test(`A46: validator and engine agree on ${name}`, async () => {
    const core = await import(pathToFileURL(CORE).href);
    const mine = validate(script, { catalog, schema }).stats.outcomes;
    const theirs = core.outcomes(core.prepare(script, catalog));
    assert.equal(theirs.length, mine.length);
    mine.forEach((o, i) => {
      assert.deepEqual(theirs[i].choices, o.choices, `combination ${i}`);
      assert.equal(theirs[i].ending, o.ending, `ending ${i}`);
      assert.ok(Math.abs(theirs[i].seconds - o.seconds) <= 0.01, `seconds ${i}: ${theirs[i].seconds} vs ${o.seconds}`);
    });
  });
}

// A16: the schema uses only the keywords of D10.2, and the contract example
// is valid with no warnings.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSchema, SUPPORTED_KEYWORDS } from '../../plugins/tcia/skills/tcia/scripts/lib/schema.mjs';
import { validate } from '../../plugins/tcia/skills/tcia/scripts/lib/validate.mjs';
import { catalog, schema, example, VALIDATE, EXAMPLE, runNode, lastLine } from '../validator/helpers.mjs';

const D10_2 = [
  '$schema', '$id', '$defs', '$ref', 'title', 'description', 'type', 'properties', 'required',
  'additionalProperties', 'items', 'minItems', 'maxItems', 'enum', 'const', 'pattern',
  'minLength', 'maxLength', 'minimum', 'maximum', 'oneOf',
];

// Walks schema nodes (not property names or $defs names) and collects keywords.
function keywords(node, found = new Set()) {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) return found;
  for (const [key, value] of Object.entries(node)) {
    found.add(key);
    if (key === 'properties' || key === '$defs') {
      for (const child of Object.values(value)) keywords(child, found);
    } else if (key === 'items' || key === 'not') {
      keywords(value, found);
    } else if (key === 'oneOf') {
      value.forEach((child) => keywords(child, found));
    }
  }
  return found;
}

test('the schema uses only D10.2 keywords', () => {
  const extra = [...keywords(schema)].filter((k) => !D10_2.includes(k));
  assert.deepEqual(extra, []);
});

test('the checker supports exactly the D10.2 keywords', () => {
  assert.deepEqual([...SUPPORTED_KEYWORDS].sort(), [...D10_2].sort());
});

test('additionalProperties is only ever false', () => {
  const walk = (node) => {
    if (node === null || typeof node !== 'object') return;
    if ('additionalProperties' in node && !Array.isArray(node)) assert.equal(node.additionalProperties, false);
    Object.values(node).forEach(walk);
  };
  walk(schema);
});

test('the contract example passes the schema, with no errors and no warnings', () => {
  assert.deepEqual(checkSchema(example(), schema), []);
  const r = validate(example(), { catalog, schema });
  assert.equal(r.ok, true);
  assert.deepEqual(r.warnings, []);
});

test('A16: validate.mjs on the example exits 0 and ends with OK:', () => {
  const r = runNode(VALIDATE, [EXAMPLE]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(lastLine(r.stdout), /^OK:/);
});

test('checker: $ref recursion through conditions', () => {
  const s = example();
  s.endings[0].when = { not: { any: [{ all: [{ var: 'bold', op: '~', value: 1 }] }] } };
  const errors = checkSchema(s, schema);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].path, '/endings/0/when/not/any/0/all/0/op');
  assert.equal(errors[0].keyword, 'enum');
});

test('checker: oneOf reports the branch whose required keys are present', () => {
  const s = example();
  s.endings[0].when = { choice: 'd1', is: 'flip', extra: 1 };
  const errors = checkSchema(s, schema);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].message, '/endings/0/when: unknown field "extra".');
  const t = example();
  t.endings[0].when = 'always';
  assert.deepEqual(checkSchema(t, schema).map((e) => e.message), ['/endings/0/when: does not match any allowed form.']);
});

test('checker: integer, number and type names', () => {
  const s = example();
  s.state[0].initial = 1.5;
  s.scenes[0].beats[0].duration = 2;
  s.scenes[0].cast = 'nico';
  const messages = checkSchema(s, schema).map((e) => e.message);
  assert.ok(messages.includes('/state/0/initial: expected integer, got number.'));
  assert.ok(messages.includes('/scenes/0/cast: expected array, got string.'));
  assert.equal(messages.length, 2);
});

test('checker: lengths in code points', () => {
  const s = example();
  s.meta.slug = 'a'.repeat(61);
  assert.deepEqual(checkSchema(s, schema).map((e) => e.message), ['/meta/slug: text must have 0–60 characters (has 61).']);
});

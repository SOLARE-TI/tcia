// A20: suggestions for values outside the catalog (D10.4).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggest, closest, distance } from '../../plugins/tcia/skills/tcia/scripts/lib/suggest.mjs';
import { validate } from '../../plugins/tcia/skills/tcia/scripts/lib/validate.mjs';
import { catalog, schema, example } from './helpers.mjs';

// A20 goes through the validator: E_CATALOG for values that fit the id
// pattern, E_SCHEMA (with the same hint) for aliases with accents, spaces or
// capitals.
const firstError = (mutate) => {
  const s = example();
  mutate(s);
  return validate(s, { catalog, schema }).errors[0];
};

test('A20: wlak -> walk (edit distance)', () => {
  const e = firstError((s) => { s.scenes[0].beats[0].action = 'wlak'; });
  assert.equal(e.code, 'E_CATALOG');
  assert.equal(e.suggestion, 'walk');
  assert.match(e.message, /Did you mean "walk"\?/);
});

test('A20: caminar -> walk (Spanish alias)', () => {
  const e = firstError((s) => { s.scenes[0].beats[0].action = 'caminar'; });
  assert.equal(e.code, 'E_CATALOG');
  assert.equal(e.suggestion, 'walk');
  assert.match(e.message, /Did you mean "walk" \("caminar" is an alias\)\?/);
});

test('A20: anochecer -> dusk (light alias)', () => {
  const e = firstError((s) => { s.meta.light = 'anochecer'; });
  assert.equal(e.code, 'E_CATALOG');
  assert.equal(e.path, '/meta/light');
  assert.equal(e.suggestion, 'dusk');
});

test('A20: Anochecer -> dusk (capitalized alias: E_SCHEMA with the hint)', () => {
  const e = firstError((s) => { s.meta.light = 'Anochecer'; });
  assert.equal(e.code, 'E_SCHEMA');
  assert.equal(e.path, '/meta/light');
  assert.equal(e.suggestion, 'dusk');
  assert.equal(e.approximation, null);
  assert.match(e.message, /has the wrong format \(.*\)\. Did you mean "dusk" \("Anochecer" is an alias\)\?$/);
});

test('A20: dance -> approximation jump.spin', () => {
  const e = firstError((s) => { s.scenes[0].beats[1].action = 'dance'; });
  assert.equal(e.code, 'E_CATALOG');
  assert.equal(e.suggestion, null);
  assert.deepEqual(e.approximation.to, { action: 'jump', variant: 'spin' });
  assert.match(e.message, /Closest: \{"action":"jump","variant":"spin"\}\. There is no dance action/);
});

test('A20: dragón -> no suggestion, real-beings note (E_SCHEMA: accents fail the id pattern)', () => {
  const e = firstError((s) => { s.characters[1].kind = 'dragón'; });
  assert.equal(e.code, 'E_SCHEMA');
  assert.equal(e.path, '/characters/1/kind');
  assert.equal(e.suggestion, null);
  assert.equal(e.approximation.to, null);
  assert.match(e.message, /^\/characters\/1\/kind: "dragón" has the wrong format \(.*\)\. Only real beings are allowed/);
});

test('A20: dragon -> approximation with no target and the real-beings note (E_CATALOG)', () => {
  const e = firstError((s) => { s.characters[1].kind = 'dragon'; });
  assert.equal(e.code, 'E_CATALOG');
  assert.equal(e.path, '/characters/1/kind');
  assert.equal(e.suggestion, null);
  const fantasy = catalog.approximations.find((a) => a.category === 'kind' && a.fantasy);
  assert.deepEqual(e.approximation, { to: null, note: fantasy.note });
  assert.match(e.message, /^\/characters\/1\/kind: "dragon" is not a valid kind\. Only real beings are allowed/);
  assert.doesNotMatch(e.message, /Closest:/);
});

test('A20: centro -> center (position alias)', () => {
  const e = firstError((s) => { s.scenes[0].cast[0].at = 'centro'; });
  assert.equal(e.code, 'E_CATALOG');
  assert.equal(e.suggestion, 'center');
});

test('E_SCHEMA pattern errors on catalog fields carry the alias hint', () => {
  const cases = [
    [(s) => { s.scenes[0].beats[1].action = 'Caminar'; }, '/scenes/0/beats/1/action', 'walk', '"Caminar" is an alias'],
    [(s) => { s.scenes[0].beats[1].action = 'pick up'; }, '/scenes/0/beats/1/action', 'pick_up', 'Did you mean "pick_up"?'],
    [(s) => { s.scenes[1].beats[1].variant = 'mortal atrás'; }, '/scenes/1/beats/1/variant', 'backflip', 'is an alias'],
    [(s) => { s.characters[0].look.hair_color = 'Rubio'; }, '/characters/0/look/hair_color', 'blonde', 'is an alias'],
    [(s) => { s.scenes[0].cast[0].at = 'en el centro'; }, '/scenes/0/cast/0/at', 'center', 'is an alias'],
    [(s) => { s.sets[0].base = 'Playa'; }, '/sets/0/base', 'beach', 'is an alias'],
  ];
  for (const [mutate, p, id, text] of cases) {
    const e = firstError(mutate);
    assert.equal(e.code, 'E_SCHEMA');
    assert.equal(e.path, p);
    assert.equal(e.suggestion, id);
    assert.ok(e.message.includes('has the wrong format') && e.message.includes(text), e.message);
  }
  // Fields that do not hold catalog ids keep the plain V5 message.
  const plain = firstError((s) => { s.meta.lang = 'Español'; });
  assert.equal(plain.suggestion, null);
  assert.match(plain.message, /has the wrong format \(Language of balloons.*\)\.$/);
});

test('scoped categories: variants of one action, attribute values, palettes', () => {
  assert.equal(suggest('voltereta', 'variant', 'jump', catalog).suggestion, 'flip');
  assert.equal(suggest('voltereta', 'variant', 'walk', catalog).suggestion, null);
  assert.equal(suggest('rubio', 'attribute', 'person.hair_color', catalog).suggestion, 'blonde');
  assert.equal(suggest('casco', 'attribute', 'person.accessory', catalog).suggestion, 'helmet');
  assert.equal(suggest('rayas', 'attribute', 'cat.pattern', catalog).suggestion, 'stripes');
  assert.equal(suggest('rosado', 'palette', 'clothing', catalog).suggestion, 'pink');
  assert.equal(suggest('nevado', 'pieceVariant', 'mountain', catalog).suggestion, 'snowy');
  assert.equal(suggest('altisimo', 'height', null, catalog).suggestion, 'high');
  assert.equal(suggest('pick up', 'action', null, catalog).suggestion, 'pick_up');
});

test('approximations of other categories', () => {
  assert.deepEqual(suggest('amanecer', 'light', null, catalog).approximation.to, { light: 'sunset' });
  assert.deepEqual(suggest('escuela', 'base', null, catalog).approximation.to, { base: 'park' });
  assert.deepEqual(suggest('caballo', 'kind', null, catalog).approximation.to, { kind: 'dog', look: { size: 'large' } });
  assert.deepEqual(suggest('juguete', 'item', null, catalog).approximation.to, { item: 'ball' });
  assert.deepEqual(suggest('tired', 'emotion', null, catalog).approximation.to, { emotion: 'sad', intensity: 1 });
});

test('thresholds: 1 edit up to 4 characters, 2 edits above; nothing when too far', () => {
  assert.equal(suggest('rum', 'action', null, catalog).suggestion, 'run');
  assert.equal(suggest('xyz', 'action', null, catalog).suggestion, null);
  assert.equal(suggest('jumpp', 'action', null, catalog).suggestion, 'jump');
  assert.equal(suggest('thinkkk', 'action', null, catalog).suggestion, 'think');
  assert.deepEqual(suggest('qqqqqqqq', 'action', null, catalog), { suggestion: null, approximation: null });
});

test('ties go to the first id in catalog order', () => {
  // "tale" is one edit from "talk" and two from others; "wak" is one edit from "walk" only.
  assert.equal(suggest('wak', 'action', null, catalog).suggestion, 'walk');
});

test('distance counts an adjacent swap as one edit', () => {
  assert.equal(distance('wlak', 'walk'), 1);
  assert.equal(distance('abc', 'abc'), 0);
  assert.equal(distance('', 'abc'), 3);
  assert.equal(distance('kitten', 'sitting'), 3);
});

test('closest() uses only edit distance against known ids', () => {
  assert.equal(closest('parc', ['park', 'beach']), 'park');
  assert.equal(closest('caminar', ['walk']), null);
});

test('E_CATALOG message carries the alias hint and the valid list', () => {
  const s = example();
  s.scenes[0].beats[1].action = 'caminar';
  delete s.scenes[0].beats[1].height;
  s.scenes[0].beats[1].to = 'center';
  const e = validate(s, { catalog, schema }).errors.find((x) => x.code === 'E_CATALOG');
  assert.equal(e.suggestion, 'walk');
  assert.equal(e.approximation, null);
  assert.equal(e.message,
    '/scenes/0/beats/1/action: "caminar" is not a valid action. Did you mean "walk" ("caminar" is an alias)? Valid: walk, run, jump, wave, talk, point, sit, pick_up, give, fall, hug, think.');
});

test('E_CATALOG message carries the approximation', () => {
  const s = example();
  s.scenes[0].beats[1].action = 'dance';
  const e = validate(s, { catalog, schema }).errors.find((x) => x.code === 'E_CATALOG');
  assert.equal(e.suggestion, null);
  assert.deepEqual(e.approximation.to, { action: 'jump', variant: 'spin' });
  assert.match(e.message, /^\/scenes\/0\/beats\/1\/action: "dance" is not a valid action\. Closest: \{"action":"jump","variant":"spin"\}\. There is no dance action/);
});

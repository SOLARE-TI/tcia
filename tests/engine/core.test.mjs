import test from 'node:test';
import assert from 'node:assert/strict';
import { prepare, evalCondition, wrapText, readSeconds, keyToOption, FORMAT } from '../../engine/src/core.mjs';
import { loadCatalog, loadExample } from './helpers/load.mjs';

const catalog = loadCatalog();

test('FORMAT is 1', () => { assert.equal(FORMAT, 1); });

test('prepare fills look defaults: kind defaults first, then the attribute set', () => {
  const s = loadExample();
  s.characters.push({ id: 'gran', name: 'Gran', kind: 'old_woman' });
  const story = prepare(s, catalog);
  const g = story.characters.gran.look;
  assert.equal(g.hair, 'bun');
  assert.equal(g.hair_color, 'white');
  assert.equal(g.outfit, 'dress');
  assert.equal(g.skin, 'medium');
  assert.equal(g.height, 'medium');
  assert.equal(story.characters.gran.heightPx, 470);
  assert.equal(story.characters.rocky.rig, 'quadruped');
});

test('prepare: sets without pieces use the base defaults; pieces get layer, variant and colour', () => {
  const s = loadExample();
  s.sets.push({ id: 'town', base: 'city' });
  const story = prepare(s, catalog);
  assert.equal(story.sets.town.pieces.length, catalog.bases.city.defaultPieces.length);
  const park = story.sets.park.pieces;
  assert.equal(park.find((p) => p.piece === 'ramp').layer, 'back');
  assert.equal(park.find((p) => p.piece === 'cloud').layer, 'sky');
  assert.equal(park.find((p) => p.piece === 'tree').variant, 'round');
});

test('prepare: facing defaults towards the centre and items held start in the hand', () => {
  const s = loadExample();
  delete s.scenes[0].cast[1].facing;
  const story = prepare(s, catalog);
  const sc = story.scenes.warmup;
  assert.equal(sc.initialActors.rocky.facing, 1);
  assert.equal(sc.initialActors.rocky.holding, 'ball');
});

test('prepare throws TypeError on structurally impossible input', () => {
  assert.throws(() => prepare(null, catalog), TypeError);
  assert.throws(() => prepare({ tcia: 1 }, catalog), TypeError);
  const s = loadExample();
  s.scenes[0].set = 'nowhere';
  assert.throws(() => prepare(s, catalog), TypeError);
  const t = loadExample();
  t.characters[0].kind = 'dragon';
  assert.throws(() => prepare(t, catalog), TypeError);
});

test('evalCondition: choice, var (all operators), all, any, not', () => {
  const ctx = { choices: { d1: 'flip' }, vars: { bold: 2 } };
  assert.equal(evalCondition({ choice: 'd1', is: 'flip' }, ctx), true);
  assert.equal(evalCondition({ choice: 'd1', is: 'safe' }, ctx), false);
  const ops = { '==': [2, true], '!=': [2, false], '>=': [2, true], '<=': [1, false], '>': [1, true], '<': [3, true] };
  for (const [op, [value, want]] of Object.entries(ops)) assert.equal(evalCondition({ var: 'bold', op, value }, ctx), want, op);
  assert.equal(evalCondition({ all: [{ choice: 'd1', is: 'flip' }, { var: 'bold', op: '>', value: 5 }] }, ctx), false);
  assert.equal(evalCondition({ any: [{ choice: 'd1', is: 'safe' }, { var: 'bold', op: '==', value: 2 }] }, ctx), true);
  assert.equal(evalCondition({ not: { choice: 'd1', is: 'flip' } }, ctx), false);
  assert.equal(evalCondition({ var: 'missing', op: '==', value: 0 }, ctx), true);
});

test('wrapText (D10.6): collapse, greedy, code points, long words stay whole', () => {
  assert.deepEqual(wrapText('  Rocky,   today I jump the ramp!  ', 24), ['Rocky, today I jump the', 'ramp!']);
  assert.deepEqual(wrapText('a b c', 3), ['a b', 'c']);
  assert.deepEqual(wrapText('ñandú ñandú ñandú', 11), ['ñandú ñandú', 'ñandú']);
  assert.deepEqual(wrapText('Supercalifragilisticexpi ok', 24), ['Supercalifragilisticexpi', 'ok']);
  assert.deepEqual(wrapText('', 24), []);
});

test('readSeconds (D9): clamp(0.9 + 0.055 n, 1.4, 6.0) with n in code points', () => {
  assert.equal(readSeconds('Woof!', catalog), 1.4);
  assert.ok(Math.abs(readSeconds('Rocky, today I jump the ramp!', catalog) - 2.495) < 1e-9);
  assert.equal(readSeconds('x'.repeat(200), catalog), 6);
  assert.ok(Math.abs(readSeconds('😀'.repeat(20), catalog) - (0.9 + 0.055 * 20)) < 1e-9);
});

test('keyToOption (A37)', () => {
  assert.equal(keyToOption('1', 2), 0);
  assert.equal(keyToOption('Digit2', 2), 1);
  assert.equal(keyToOption('Numpad3', 3), 2);
  assert.equal(keyToOption('4', 3), -1);
  assert.equal(keyToOption('3', 2), -1);
  assert.equal(keyToOption('Enter', 3), -1);
  assert.equal(keyToOption('0', 3), -1);
});

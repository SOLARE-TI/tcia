import test from 'node:test';
import assert from 'node:assert/strict';
import { registry } from '../../engine/src/registry.mjs';
import { loadCatalog } from './helpers/load.mjs';
import { drawAll } from './helpers/drawn.mjs';
import { hasShape, fxValues } from './helpers/svgcheck.mjs';

const catalog = loadCatalog();

test('A33: every catalog id has a registry entry that draws polygons in Node', () => {
  const drawn = drawAll(catalog);
  const missing = drawn.filter((d) => !d.tree).map((d) => d.id);
  assert.deepEqual(missing, [], 'missing registry entries');
  const empty = drawn.filter((d) => !hasShape(d.tree)).map((d) => d.id);
  assert.deepEqual(empty, [], 'entries that draw no polygon or path');
  // the 34 variants in the 3 rigs, 6 emotions x 3, 11 faces, 15 effects, 9 kinds ...
  assert.equal(drawn.filter((d) => d.id.startsWith('actions.')).length, 34 * 3);
});

test('A33: emotions in the registry match the catalog levels', () => {
  for (const [e, def] of Object.entries(catalog.emotions)) {
    for (const lv of ['1', '2', '3']) {
      assert.deepEqual(registry.emotions[e][lv], { face: def.levels[lv].face, effects: def.levels[lv].effects }, e + ' ' + lv);
    }
  }
});

test('A33: each effect drawing shows its own data-fx', () => {
  for (const e of Object.keys(catalog.effects)) {
    const tree = registry.effects[e](catalog);
    assert.ok(fxValues(tree, true).has(e), e + ' is visible in its own drawing');
  }
});

test('the registry knows no ids outside the catalog', () => {
  const extra = [];
  for (const a of Object.keys(registry.actions)) { if (!catalog.actions[a]) extra.push(a); else for (const v of Object.keys(registry.actions[a].variants)) if (!catalog.actions[a].variants[v]) extra.push(a + '.' + v); }
  for (const k of ['faces', 'effects', 'kinds', 'bases', 'lights', 'items', 'positions', 'pieces']) {
    for (const id of Object.keys(registry[k])) if (!catalog[k][id]) extra.push(k + '.' + id);
  }
  assert.deepEqual(extra, []);
});

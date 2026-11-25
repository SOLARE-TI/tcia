// A15: the catalog is consistent (D6).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from '../../plugins/tcia/skills/tcia/scripts/lib/text.mjs';
import { catalog } from '../validator/helpers.mjs';

const HEX = /^#[0-9A-F]{6}$/i;
const POSTURES = ['standing', 'sitting', 'lying'];

const aliasesOf = (entry) => [...((entry && entry.aliases && entry.aliases.es) || []), ...((entry && entry.aliases && entry.aliases.en) || [])];

// Every alias scope of D6, as [name, [{ id, aliases }]].
function scopes() {
  const list = [];
  const fromObject = (name, obj) =>
    list.push([name, Object.entries(obj).map(([id, v]) => ({ id, aliases: aliasesOf(v) }))]);
  for (const key of ['positions', 'lights', 'kinds', 'items', 'bases', 'layers', 'pieces', 'actions', 'emotions']) {
    fromObject(key, catalog[key]);
  }
  for (const [name, palette] of Object.entries(catalog.palettes)) fromObject(`palettes.${name}`, palette);
  for (const [id, action] of Object.entries(catalog.actions)) fromObject(`actions.${id}.variants`, action.variants);
  fromObject('actions.jump.heights', catalog.actions.jump.heights);
  for (const [id, piece] of Object.entries(catalog.pieces)) {
    list.push([`pieces.${id}.variants`, piece.variants.map((v) => ({
      id: v,
      aliases: [...((piece.variantAliases?.[v]?.es) || []), ...((piece.variantAliases?.[v]?.en) || [])],
    }))]);
  }
  for (const [set, attrs] of Object.entries(catalog.attributeSets)) {
    for (const [attr, def] of Object.entries(attrs)) {
      if (def.values) fromObject(`attributeSets.${set}.${attr}`, def.values);
    }
  }
  return list;
}

test('counts', () => {
  assert.equal(Object.keys(catalog.actions).length, 12);
  assert.equal(Object.values(catalog.actions).reduce((n, a) => n + Object.keys(a.variants).length, 0), 34);
  assert.equal(Object.keys(catalog.emotions).length, 6);
  assert.equal(Object.keys(catalog.kinds).length, 9);
  assert.equal(Object.keys(catalog.lights).length, 4);
  assert.equal(Object.keys(catalog.bases).length, 8);
  assert.equal(Object.keys(catalog.pieces).length, 34);
  assert.equal(Object.keys(catalog.items).length, 10);
  assert.equal(Object.keys(catalog.positions).length, 9);
  assert.equal(Object.keys(catalog.faces).length, 11);
  assert.equal(Object.keys(catalog.effects).length, 15);
  assert.equal(catalog.approximations.length, 38);
});

test('every alias-bearing entry has es and en aliases', () => {
  for (const key of ['positions', 'lights', 'kinds', 'items', 'bases', 'layers', 'pieces', 'actions', 'emotions']) {
    for (const [id, v] of Object.entries(catalog[key])) {
      assert.ok(v.aliases?.es?.length > 0 && v.aliases?.en?.length > 0, `${key}.${id}`);
    }
  }
  for (const [id, action] of Object.entries(catalog.actions)) {
    for (const [v, def] of Object.entries(action.variants)) {
      assert.ok(def.aliases?.es?.length > 0 && def.aliases?.en?.length > 0, `actions.${id}.variants.${v}`);
    }
  }
});

test('aliases: one id per normalized alias in each scope, never equal to their own id', () => {
  for (const [name, entries] of scopes()) {
    const owner = new Map();
    for (const { id, aliases } of entries) {
      for (const alias of aliases) {
        const n = normalize(alias);
        assert.notEqual(n, normalize(id), `${name}: alias "${alias}" equals its id`);
        if (owner.has(n)) assert.equal(owner.get(n), id, `${name}: "${alias}" points to ${owner.get(n)} and ${id}`);
        owner.set(n, id);
      }
    }
  }
});

test('approximations do not repeat ids or aliases of their category', () => {
  const byCategory = { action: 'actions', emotion: 'emotions', kind: 'kinds', base: 'bases', light: 'lights', item: 'items' };
  for (const ap of catalog.approximations) {
    const key = byCategory[ap.category];
    assert.ok(key, `unknown approximation category ${ap.category}`);
    const taken = new Set();
    for (const [id, v] of Object.entries(catalog[key])) {
      taken.add(normalize(id));
      for (const a of aliasesOf(v)) taken.add(normalize(a));
    }
    for (const word of [...ap.es, ...ap.en]) {
      assert.ok(!taken.has(normalize(word)), `${ap.category} approximation "${word}" repeats a catalog id or alias`);
    }
    assert.equal(typeof ap.note, 'string');
  }
});

test('approximation targets are valid catalog entries', () => {
  for (const ap of catalog.approximations) {
    const to = ap.to;
    if (to === null) continue;
    if (to.action) {
      const action = catalog.actions[to.action];
      assert.ok(action, `action ${to.action}`);
      if (to.variant) assert.ok(action.variants[to.variant], `variant ${to.action}.${to.variant}`);
      if (to.height) assert.ok(catalog.actions.jump.heights[to.height], `height ${to.height}`);
    }
    if (to.emotion) assert.ok(catalog.emotions[to.emotion], `emotion ${to.emotion}`);
    if (to.intensity !== undefined) assert.ok([1, 2, 3].includes(to.intensity));
    if (to.kind) {
      const kind = catalog.kinds[to.kind];
      assert.ok(kind, `kind ${to.kind}`);
      for (const [attr, value] of Object.entries(to.look || {})) {
        assert.ok(catalog.attributeSets[kind.attributeSet][attr].values[value], `look ${attr}=${value}`);
      }
    }
    if (to.base) assert.ok(catalog.bases[to.base], `base ${to.base}`);
    if (to.light) assert.ok(catalog.lights[to.light], `light ${to.light}`);
    if (to.item) assert.ok(catalog.items[to.item], `item ${to.item}`);
  }
});

test('palettes: three hex tones each', () => {
  for (const [name, palette] of Object.entries(catalog.palettes)) {
    for (const [id, entry] of Object.entries(palette)) {
      assert.equal(entry.tones.length, 3, `${name}.${id}`);
      for (const t of entry.tones) assert.match(t, HEX, `${name}.${id}`);
    }
  }
  assert.equal(Object.keys(catalog.palettes.clothing).length, 13);
  assert.equal(Object.keys(catalog.palettes.skin).length, 6);
  assert.equal(Object.keys(catalog.palettes.hair).length, 8);
  assert.equal(Object.keys(catalog.palettes.coat).length, 7);
  assert.equal(Object.keys(catalog.palettes.materials).length, 20);
});

test('attribute sets: defaults and palettes exist', () => {
  for (const [set, attrs] of Object.entries(catalog.attributeSets)) {
    for (const [attr, def] of Object.entries(attrs)) {
      if (def.palette) {
        assert.ok(catalog.palettes[def.palette], `${set}.${attr} palette`);
        assert.ok(catalog.palettes[def.palette][def.default], `${set}.${attr} default`);
      } else {
        assert.ok(def.values[def.default], `${set}.${attr} default`);
      }
    }
  }
  for (const [id, v] of Object.entries(catalog.attributeSets.person.outfit.values)) {
    assert.equal(typeof v.usesBottomColor, 'boolean', `outfit ${id}`);
  }
});

test('kinds: rig, attribute set, heights and defaults', () => {
  for (const [id, kind] of Object.entries(catalog.kinds)) {
    assert.ok(['biped', 'quadruped', 'bird'].includes(kind.rig), id);
    const attrs = catalog.attributeSets[kind.attributeSet];
    assert.ok(attrs, `${id} attribute set`);
    const by = attrs[kind.heightBy];
    assert.ok(by && by.values, `${id} heightBy`);
    assert.deepEqual(Object.keys(kind.heightPx).sort(), Object.keys(by.values).sort(), `${id} heightPx`);
    for (const [attr, value] of Object.entries(kind.defaults)) {
      const def = attrs[attr];
      assert.ok(def, `${id} default ${attr}`);
      const valid = def.palette ? catalog.palettes[def.palette][value] : def.values[value];
      assert.ok(valid, `${id} default ${attr}=${value}`);
    }
  }
});

test('positions: order, x and on-stage flags', () => {
  const list = Object.entries(catalog.positions);
  list.forEach(([id, p], i) => {
    assert.equal(p.order, i, id);
    assert.equal(typeof p.x, 'number');
  });
  assert.equal(catalog.positions.offstage_left.onstage, false);
  assert.equal(catalog.positions.offstage_right.onstage, false);
  assert.equal(list.filter(([, p]) => p.onstage).length, 7);
});

test('lights: indoor is the only one not allowed outdoors', () => {
  for (const [id, light] of Object.entries(catalog.lights)) {
    assert.equal(light.sky.length, 3, id);
    for (const c of light.sky) assert.match(c, HEX);
    assert.equal(light.outdoorAllowed, id !== 'indoor', id);
  }
});

test('pieces: layers, variants, colors and materials', () => {
  for (const [id, piece] of Object.entries(catalog.pieces)) {
    assert.ok(piece.layers.length > 0, id);
    for (const l of piece.layers) assert.ok(catalog.layers[l], `${id} layer ${l}`);
    assert.ok(piece.layers.includes(piece.defaultLayer), `${id} defaultLayer`);
    for (const m of piece.materials) assert.ok(catalog.palettes.materials[m], `${id} material ${m}`);
    if (piece.colorable) assert.ok(catalog.palettes.clothing[piece.defaultColor], `${id} defaultColor`);
    if (piece.variantAliases) assert.deepEqual(Object.keys(piece.variantAliases).sort(), [...piece.variants].sort(), `${id} variantAliases`);
    assert.ok(piece.seat === null || typeof piece.seat === 'number', `${id} seat`);
  }
});

test('bases: materials and default pieces are valid', () => {
  for (const [id, base] of Object.entries(catalog.bases)) {
    for (const key of ['ground', 'groundAccent', 'farMaterial']) {
      if (base[key] !== null) assert.ok(catalog.palettes.materials[base[key]], `${id}.${key}`);
    }
    for (const dp of base.defaultPieces) {
      const piece = catalog.pieces[dp.piece];
      assert.ok(piece, `${id}: piece ${dp.piece}`);
      assert.ok(catalog.positions[dp.at]?.onstage, `${id}: ${dp.piece} at ${dp.at}`);
      if (dp.layer) assert.ok(piece.layers.includes(dp.layer), `${id}: ${dp.piece} layer ${dp.layer}`);
      if (dp.variant) assert.ok(piece.variants.includes(dp.variant), `${id}: ${dp.piece} variant ${dp.variant}`);
      if (dp.color) {
        assert.ok(piece.colorable, `${id}: ${dp.piece} colorable`);
        assert.ok(catalog.palettes.clothing[dp.color], `${id}: color ${dp.color}`);
      }
    }
  }
  assert.equal(catalog.bases.room.outdoor, false);
});

test('actions: params, postures, durations and variants', () => {
  for (const [id, action] of Object.entries(catalog.actions)) {
    assert.ok(action.variants[action.defaultVariant], `${id} defaultVariant`);
    for (const p of ['to', 'target', 'item', 'height', 'say']) {
      assert.ok(['required', 'optional', 'forbidden'].includes(action.params[p]), `${id}.params.${p}`);
    }
    for (const p of action.startPostures) assert.ok(POSTURES.includes(p), `${id} startPostures`);
    if (action.resultPosture !== null) assert.ok(POSTURES.includes(action.resultPosture), `${id} resultPosture`);
    for (const p of action.targetPostures || []) assert.ok(POSTURES.includes(p), `${id} targetPostures`);
    for (const k of action.targetKinds || []) assert.ok(['character', 'position'].includes(k), `${id} targetKinds`);
    assert.ok(action.duration.min <= action.duration.max, `${id} duration`);
    if (action.duration.default !== undefined) {
      assert.ok(action.duration.default >= action.duration.min && action.duration.default <= action.duration.max, `${id} default duration`);
    }
    if (action.motion === 'travel') {
      for (const [v, def] of Object.entries(action.variants)) assert.equal(typeof def.secondsPerMark, 'number', `${id}.${v}`);
    }
    assert.ok(['speech', 'thought'].includes(action.balloon), `${id} balloon`);
    for (const [v, def] of Object.entries(action.variants)) {
      for (const p of def.requires || []) assert.ok(p in action.params, `${id}.${v} requires ${p}`);
      for (const p of Object.keys(def.params || {})) assert.ok(p in action.params, `${id}.${v} params ${p}`);
    }
  }
  assert.ok(catalog.actions.jump.heights[catalog.actions.jump.defaultHeight]);
});

test('emotions point to existing faces and effects', () => {
  for (const [id, emotion] of Object.entries(catalog.emotions)) {
    assert.deepEqual(Object.keys(emotion.levels), ['1', '2', '3'], id);
    for (const level of Object.values(emotion.levels)) {
      assert.ok(catalog.faces[level.face], `${id} face ${level.face}`);
      for (const e of level.effects) assert.ok(catalog.effects[e], `${id} effect ${e}`);
    }
  }
  for (const [id, effect] of Object.entries(catalog.effects)) {
    assert.ok(['loop', 'burst'].includes(effect.phase), id);
    if (effect.phase === 'burst') assert.equal(typeof effect.seconds, 'number', id);
  }
});

test('ui texts for es and en', () => {
  for (const lang of ['es', 'en']) {
    for (const k of ['start', 'restart', 'decision']) assert.equal(typeof catalog.ui[lang][k], 'string');
  }
  assert.equal(catalog.ui.en.restart, 'Start over');
  assert.equal(catalog.ui.es.restart, 'Empezar de nuevo');
});

// A43: the five examples together cover the catalog (D15, as resolved).
// A44: stories 1 and 2 have the acrobatics, emotions and hero look of D15.
// A62 (mechanical part): every scene of every example has a visible gag.
//
// How values are counted: effective values (defaults filled in) of what a
// story shows. Enumerated look attributes count per attribute set and
// attribute; palette colors count per palette (any attribute that uses it),
// because one story holds at most 6 characters.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectiveLook } from '../../plugins/tcia/skills/tcia/scripts/lib/catalog.mjs';
import { catalog, exampleDirs, exampleScript } from '../validator/helpers.mjs';

const TEST_STORIES = ['test-people-actions', 'test-animals-places', 'test-flow-max'];
const HERO_STORIES = exampleDirs().filter((s) => !TEST_STORIES.includes(s));
const ACROBATICS = ['jump.flip', 'jump.backflip', 'jump.spin', 'jump.cartwheel', 'jump.split', 'run.dash'];

function allScenes(script) {
  return [
    ...script.scenes,
    ...script.decisions.flatMap((d) => d.options.flatMap((o) => o.scenes || [])),
    ...script.endings.flatMap((e) => e.scenes),
  ];
}

// Everything a story shows, as sets of keys.
function usage(script) {
  const u = {
    actionVariant: new Set(), actionRig: new Set(), emotion: new Set(), light: new Set(), base: new Set(),
    kind: new Set(), attribute: new Set(), palette: new Set(), pieceVariant: new Set(), layer: new Set(),
    position: new Set(), item: new Set(), height: new Set(),
  };
  const characters = new Map(script.characters.map((c) => [c.id, c]));
  const sets = new Map(script.sets.map((s) => [s.id, s]));
  for (const c of script.characters) {
    const kind = catalog.kinds[c.kind];
    u.kind.add(c.kind);
    const look = effectiveLook(catalog, c);
    for (const [attr, value] of Object.entries(look)) {
      const def = catalog.attributeSets[kind.attributeSet][attr];
      if (attr === 'bottom_color' && catalog.attributeSets.person.outfit.values[look.outfit]?.usesBottomColor === false) continue;
      if (def.palette) u.palette.add(`${def.palette}.${value}`);
      else u.attribute.add(`${kind.attributeSet}.${attr}.${value}`);
    }
  }
  for (const scene of allScenes(script)) {
    u.light.add(scene.light || script.meta.light);
    const set = sets.get(scene.set);
    u.base.add(set.base);
    const pieces = set.pieces || catalog.bases[set.base].defaultPieces;
    for (const p of pieces) {
      u.pieceVariant.add(`${p.piece}.${p.variant || 'default'}`);
      u.layer.add(p.layer || catalog.pieces[p.piece].defaultLayer);
    }
    for (const c of scene.cast) {
      u.position.add(c.at);
      if (c.emotion) u.emotion.add(`${c.emotion}.${c.intensity || 2}`);
    }
    for (const it of scene.items || []) u.item.add(it.item);
    for (const b of scene.beats) {
      if (b.emotion) u.emotion.add(`${b.emotion}.${b.intensity || 2}`);
      if (b.to) u.position.add(b.to);
      if (!b.action) continue;
      const action = catalog.actions[b.action];
      u.actionVariant.add(`${b.action}.${b.variant || action.defaultVariant}`);
      u.actionRig.add(`${b.action}.${catalog.kinds[characters.get(b.actor).kind].rig}`);
      if (b.action === 'jump') u.height.add(b.height || action.defaultHeight);
    }
  }
  return u;
}

function expected() {
  const e = {
    actionVariant: [], actionRig: [], emotion: [], light: Object.keys(catalog.lights), base: Object.keys(catalog.bases),
    kind: Object.keys(catalog.kinds), attribute: [], palette: [], pieceVariant: [], layer: Object.keys(catalog.layers),
    position: Object.keys(catalog.positions), item: Object.keys(catalog.items), height: Object.keys(catalog.actions.jump.heights),
  };
  for (const [id, a] of Object.entries(catalog.actions)) {
    for (const v of Object.keys(a.variants)) e.actionVariant.push(`${id}.${v}`);
    for (const rig of ['biped', 'quadruped', 'bird']) e.actionRig.push(`${id}.${rig}`);
  }
  for (const id of Object.keys(catalog.emotions)) for (const i of [1, 2, 3]) e.emotion.push(`${id}.${i}`);
  const palettes = new Set();
  for (const [set, attrs] of Object.entries(catalog.attributeSets)) {
    for (const [attr, def] of Object.entries(attrs)) {
      if (def.palette) palettes.add(def.palette);
      else for (const v of Object.keys(def.values)) e.attribute.push(`${set}.${attr}.${v}`);
    }
  }
  for (const p of palettes) for (const c of Object.keys(catalog.palettes[p])) e.palette.push(`${p}.${c}`);
  for (const [id, p] of Object.entries(catalog.pieces)) {
    if (p.variants.length === 0) e.pieceVariant.push(`${id}.default`);
    else for (const v of p.variants) e.pieceVariant.push(`${id}.${v}`);
  }
  return e;
}

function missing(stories) {
  const merged = {};
  for (const slug of stories) {
    for (const [k, set] of Object.entries(usage(exampleScript(slug)))) {
      merged[k] = merged[k] || new Set();
      for (const v of set) merged[k].add(v);
    }
  }
  const out = {};
  for (const [k, list] of Object.entries(expected())) {
    const gap = list.filter((v) => !merged[k].has(v));
    if (gap.length) out[k] = gap;
  }
  return out;
}

// A43 (as resolved on 2026-11-25): coverage counts over the five examples
// together. Stories 3-5 alone cannot hold it: 11 person accessories, 7 coat
// colors and 2 bird sizes need 20 characters, and three stories hold 18.
test('A43: the five examples together cover the catalog', () => {
  assert.equal(exampleDirs().length, 5);
  assert.deepEqual(missing(exampleDirs()), {});
});

test('A43: story 3 has the 6 person kinds, reactions, together, a stand-up and the 10 items', () => {
  const s = exampleScript('test-people-actions');
  const kinds = new Set(s.characters.map((c) => c.kind));
  for (const k of ['man', 'woman', 'boy', 'girl', 'old_man', 'old_woman']) assert.ok(kinds.has(k), k);
  const beats = allScenes(s).flatMap((sc) => sc.beats);
  assert.ok(beats.some((b) => !b.action && b.emotion), 'reaction beat');
  assert.ok(beats.some((b) => b.together === true), 'together');
  assert.equal(new Set(allScenes(s).flatMap((sc) => (sc.items || []).map((i) => i.item))).size, 10);
  // A stand-up: someone sitting or lying who then does an action that starts standing.
  let standUp = false;
  for (const scene of allScenes(s)) {
    const posture = new Map(scene.cast.map((c) => [c.who, c.posture || 'standing']));
    for (const b of scene.beats) {
      if (!b.action) continue;
      const a = catalog.actions[b.action];
      if (!a.startPostures.includes(posture.get(b.actor))) standUp = true;
      if (a.resultPosture) posture.set(b.actor, a.resultPosture);
      else if (!a.startPostures.includes(posture.get(b.actor))) posture.set(b.actor, 'standing');
    }
  }
  assert.ok(standUp, 'automatic stand-up');
});

test('A43: story 5 has 27 paths, 4 endings with the 5 condition types and branches of 0, 1 and 2 scenes', () => {
  const s = exampleScript('test-flow-max');
  assert.equal(s.scenes.length, 12);
  assert.equal(s.decisions.length, 3);
  assert.ok(s.decisions.every((d) => d.options.length === 3));
  assert.equal(s.endings.length, 4);
  const kinds = new Set();
  const walk = (c) => {
    if (!c) return;
    for (const k of ['choice', 'var', 'all', 'any', 'not']) if (k in c) kinds.add(k);
    (c.all || []).forEach(walk);
    (c.any || []).forEach(walk);
    if (c.not) walk(c.not);
  };
  s.endings.forEach((e) => walk(e.when));
  assert.deepEqual([...kinds].sort(), ['all', 'any', 'choice', 'not', 'var']);
  const sizes = new Set(s.decisions.flatMap((d) => d.options.map((o) => (o.scenes || []).length)));
  for (const n of [0, 1, 2]) assert.ok(sizes.has(n), `branch of ${n}`);
  assert.ok(s.decisions.some((d) => d.after === s.scenes[s.scenes.length - 1].id), 'decision after the last scene');
  assert.ok(s.meta.ui);
});

test('A44: two hero stories', () => {
  assert.equal(HERO_STORIES.length, 2);
  const langs = HERO_STORIES.map((slug) => exampleScript(slug).meta.lang).sort();
  assert.deepEqual(langs, ['en', 'es']);
});

for (const slug of HERO_STORIES) {
  test(`A44: ${slug}: acrobatics, intensity-3 emotions, hero look, invented names`, () => {
    const s = exampleScript(slug);
    const beats = allScenes(s).flatMap((sc) => sc.beats);
    const tricks = new Set(beats.filter((b) => b.action).map((b) => `${b.action}.${b.variant || catalog.actions[b.action].defaultVariant}`)
      .filter((k) => ACROBATICS.includes(k)));
    assert.ok(tricks.size >= 4, `acrobatics: ${[...tricks].join(', ')}`);
    const strong = new Set([
      ...beats.filter((b) => b.emotion && b.intensity === 3).map((b) => b.emotion),
      ...allScenes(s).flatMap((sc) => sc.cast).filter((c) => c.emotion && c.intensity === 3).map((c) => c.emotion),
    ]);
    assert.ok(strong.size >= 4, `intensity 3: ${[...strong].join(', ')}`);

    const hero = s.characters[0];
    assert.equal(hero.kind, 'boy');
    const look = effectiveLook(catalog, hero);
    assert.ok(!['overalls', 'suit', 'dress'].includes(look.outfit), `two-piece outfit (${look.outfit})`);
    assert.equal(look.accessory, 'helmet');
    assert.notEqual(look.accessory_color, 'white');
    assert.ok(['circle', 'oval', 'square'].includes(look.head), look.head);
    assert.ok(['spiky', 'short', 'curly'].includes(look.hair), look.hair);

    for (const c of s.characters) {
      assert.match(c.name, /^\p{Lu}/u, `${c.id}: proper name`);
      assert.ok(!catalog.kinds[c.name.toLowerCase()], `${c.id}: name is not a kind`);
    }
  });
}

test('A44: both hero stories have the same protagonist', () => {
  const [a, b] = HERO_STORIES.map((slug) => exampleScript(slug).characters[0]);
  assert.equal(a.name, b.name);
  assert.equal(a.kind, b.kind);
  assert.deepEqual(effectiveLook(catalog, a), effectiveLook(catalog, b));
});

// A62, mechanical part: every scene shows at least one physical gag or an
// exaggerated reaction. (Joke lines also count for the skill, but a test
// cannot judge them, so the examples must not rely on them alone.)
const PHYSICAL = new Set(['fall.trip', 'fall.slip', 'fall.faint', 'jump.flip', 'jump.backflip', 'jump.spin', 'jump.cartwheel',
  'jump.split', 'run.dash', 'run.panic', 'sit.flop', 'talk.shout', 'walk.stomp', 'hug.bear', 'point.accuse']);
function gagOf(scene) {
  for (const [i, b] of scene.beats.entries()) {
    if (b.action) {
      const key = `${b.action}.${b.variant || catalog.actions[b.action].defaultVariant}`;
      if (PHYSICAL.has(key) || (b.action === 'jump' && b.height === 'high')) return `beat ${i}: ${key}`;
    }
    if (!b.action && (b.intensity || 2) >= 2) return `beat ${i}: reaction ${b.emotion} ${b.intensity || 2}`;
    if (b.intensity === 3) return `beat ${i}: ${b.emotion} 3`;
  }
  return null;
}

for (const slug of exampleDirs()) {
  test(`A62: every scene of ${slug} has a gag`, () => {
    const without = allScenes(exampleScript(slug)).filter((sc) => gagOf(sc) === null).map((sc) => sc.id);
    assert.deepEqual(without, []);
  });
}

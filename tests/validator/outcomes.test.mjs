// A26: outcomes and seconds of the contract example match D9.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { outcomes, sceneSecondsMap } from '../../plugins/tcia/skills/tcia/scripts/lib/outcomes.mjs';
import { validate } from '../../plugins/tcia/skills/tcia/scripts/lib/validate.mjs';
import { catalog, schema, example } from './helpers.mjs';

const TOL = 0.01;
const near = (a, b, label) => assert.ok(Math.abs(a - b) <= TOL, `${label}: ${a} vs ${b}`);

test('scene seconds match D9', () => {
  const map = sceneSecondsMap(example(), catalog);
  const expected = { warmup: 7.395, the_jump: 4.66, flip_practice: 5.2, end_legend: 2.36, end_brave: 2.4, end_buddies: 6.33 };
  for (const [id, s] of Object.entries(expected)) near(map.get(id), s, id);
});

test('A26: the four outcomes of the example', () => {
  const expected = [
    { choices: { d1: 'flip', d2: 'again' }, ending: 'legend', seconds: 22.815 },
    { choices: { d1: 'flip', d2: 'rest' }, ending: 'brave', seconds: 22.855 },
    { choices: { d1: 'safe', d2: 'again' }, ending: 'brave', seconds: 16.855 },
    { choices: { d1: 'safe', d2: 'rest' }, ending: 'buddies', seconds: 20.785 },
  ];
  for (const list of [outcomes(example(), catalog), validate(example(), { catalog, schema }).stats.outcomes]) {
    assert.equal(list.length, 4);
    list.forEach((o, i) => {
      assert.deepEqual(o.choices, expected[i].choices);
      assert.deepEqual(Object.keys(o.choices), ['d1', 'd2']);
      assert.equal(o.ending, expected[i].ending);
      near(o.seconds, expected[i].seconds, `outcome ${i}`);
    });
  }
});

test('stats of the example', () => {
  const s = validate(example(), { catalog, schema }).stats;
  assert.deepEqual(Object.keys(s), [
    'mainScenes', 'branchScenes', 'endingScenes', 'decisions', 'endings', 'paths',
    'secondsMin', 'secondsMax', 'outcomes', 'endingsReach',
  ]);
  assert.equal(s.mainScenes, 2);
  assert.equal(s.branchScenes, 1);
  assert.equal(s.endingScenes, 3);
  assert.equal(s.paths, 4);
  near(s.secondsMin, 16.855, 'min');
  near(s.secondsMax, 22.855, 'max');
  assert.deepEqual(s.endingsReach, { legend: 1, brave: 2, buddies: 1 });
});

test('outcomes follow story order even if decisions were listed out of order', () => {
  const s = example();
  s.decisions.reverse();
  const list = outcomes(s, catalog);
  assert.deepEqual(Object.keys(list[0].choices), ['d1', 'd2']);
  assert.deepEqual(list.map((o) => o.ending), ['legend', 'brave', 'brave', 'buddies']);
});

test('stand-up, together groups and reading time feed the durations', () => {
  const s = example();
  // A reaction beat lasts timing.reaction.default.
  s.scenes[0].beats = [{ actor: 'nico', emotion: 'happy' }];
  near(sceneSecondsMap(s, catalog).get('warmup'), 1.2 + 0.8, 'reaction');
  // Sitting talk needs no stand-up; sitting jump does (+0.5).
  s.scenes[0].cast[0].posture = 'sitting';
  s.scenes[0].beats = [{ actor: 'nico', action: 'jump' }];
  near(sceneSecondsMap(s, catalog).get('warmup'), 1.1 + 0.5 + 0.8, 'stand-up');
  // A group lasts as long as its longest beat.
  s.scenes[0].cast[0].posture = 'standing';
  s.scenes[0].beats = [
    { actor: 'nico', action: 'walk', to: 'far_right' },
    { actor: 'rocky', action: 'wave', together: true },
  ];
  near(sceneSecondsMap(s, catalog).get('warmup'), 5 * 0.55 + 0.8, 'group');
});

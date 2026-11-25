import test from 'node:test';
import assert from 'node:assert/strict';
import { prepare, outcomes, sceneSeconds, EMOTION_DELAY } from '../../engine/src/core.mjs';
import { loadCatalog, loadExample } from './helpers/load.mjs';

const catalog = loadCatalog();
const near = (a, b) => Math.abs(a - b) <= 0.01;

test('scene durations of the contract example match D9', () => {
  const story = prepare(loadExample(), catalog);
  const want = { warmup: 7.395, the_jump: 4.66, flip_practice: 5.2, end_legend: 2.36, end_brave: 2.4, end_buddies: 6.33 };
  for (const [id, s] of Object.entries(want)) assert.ok(near(sceneSeconds(story, id), s), id + ': ' + sceneSeconds(story, id));
});

test('outcomes of the contract example match D9 (A36), in story order', () => {
  const got = outcomes(prepare(loadExample(), catalog));
  const want = [
    [{ d1: 'flip', d2: 'again' }, 'legend', 22.815],
    [{ d1: 'flip', d2: 'rest' }, 'brave', 22.855],
    [{ d1: 'safe', d2: 'again' }, 'brave', 16.855],
    [{ d1: 'safe', d2: 'rest' }, 'buddies', 20.785]
  ];
  assert.equal(got.length, 4);
  want.forEach(([choices, ending, seconds], i) => {
    assert.deepEqual(got[i].choices, choices);
    assert.deepEqual(Object.keys(got[i].choices), Object.keys(choices));
    assert.equal(got[i].ending, ending);
    assert.ok(near(got[i].seconds, seconds), got[i].seconds + ' vs ' + seconds);
  });
});

test('the pause before a reaction lives inside the beat (A59): durations do not move', () => {
  assert.ok(EMOTION_DELAY >= 0.15 && EMOTION_DELAY <= 0.3);
  const s = loadExample();
  s.scenes[0].beats.push({ actor: 'nico', emotion: 'surprised', intensity: 3 });
  const story = prepare(s, catalog);
  assert.ok(near(sceneSeconds(story, 'warmup'), 7.395 + catalog.timing.reaction.default));
});

test('walk and run durations use marks; jump uses base + perMark; stand-up adds 0.5', () => {
  const story = prepare(loadExample(), catalog);
  const b = story.scenes.the_jump.beats;
  assert.ok(near(b[0].eff, 0.4));
  assert.ok(near(b[2].eff, 0.56));
  const fp = story.scenes.flip_practice.beats;
  assert.equal(fp[2].standUp, 0.5);
  assert.ok(near(fp[2].eff, 1.9));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { prepare, outcomes, createPlayer } from '../../engine/src/core.mjs';
import { loadCatalog, allScripts, combos, playPath } from './helpers/load.mjs';

const catalog = loadCatalog();

test('A45: every combination of choices reaches `ended` with the ending that outcomes() gives', () => {
  for (const s of allScripts()) {
    const story = prepare(s.script, catalog);
    const outs = outcomes(story);
    const all = combos(story);
    assert.equal(outs.length, all.length, s.name);
    all.forEach((picks, i) => {
      const { player, events } = playPath(createPlayer, story, picks, 1 / 15);
      assert.equal(player.state, 'ended', s.name + ' ' + picks);
      assert.deepEqual(player.choices, outs[i].choices, s.name + ' choices');
      assert.equal(player.endingId, outs[i].ending, s.name + ' ending for ' + JSON.stringify(outs[i].choices));
      assert.equal(events.filter((e) => e.type === 'ending').length, 1);
      assert.equal(events[events.length - 1].type, 'ended');
    });
  }
});

test('every ending of every script is reachable', () => {
  for (const s of allScripts()) {
    const story = prepare(s.script, catalog);
    const reached = new Set(outcomes(story).map((o) => o.ending));
    for (const e of story.endings) assert.ok(reached.has(e.id), s.name + ': ' + e.id);
  }
});

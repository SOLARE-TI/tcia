import test from 'node:test';
import assert from 'node:assert/strict';
import { prepare, createPlayer } from '../../engine/src/core.mjs';
import { loadCatalog, loadExample } from './helpers/load.mjs';

const catalog = loadCatalog();
const story = () => prepare(loadExample(), catalog);

function runUntil(p, state, dt) {
  let ev = [];
  for (let i = 0; i < 100000 && p.state !== state; i++) ev = ev.concat(p.advance(dt || 0.05));
  return ev;
}

test('starts at the title and does not advance the story there', () => {
  const p = createPlayer(story());
  assert.equal(p.state, 'title');
  assert.equal(p.sceneId, 'warmup');
  p.advance(100);
  assert.equal(p.state, 'title');
  assert.equal(p.sceneTime, 0);
});

test('start -> playing; the first decision opens after the scene, its tail and the delay', () => {
  const p = createPlayer(story());
  p.start();
  assert.equal(p.state, 'playing');
  const ev = runUntil(p, 'deciding', 0.01);
  assert.deepEqual(ev.filter((e) => e.type !== 'choice').map((e) => e.type), ['scene', 'decision']);
  assert.equal(p.decisionId, 'd1');
  assert.deepEqual(p.options, [{ id: 'flip', label: 'Go for the flip!' }, { id: 'safe', label: 'Play it safe' }]);
  // fade 0.4 + scene 7.395 + delay 0.3
  assert.ok(Math.abs(p.clock - (0.4 + 7.395 + 0.3)) < 0.03, String(p.clock));
});

test('in deciding, advance(10000) does not change the state (A37); choose validates its index', () => {
  const p = createPlayer(story());
  p.start();
  runUntil(p, 'deciding');
  p.advance(10000);
  assert.equal(p.state, 'deciding');
  assert.equal(p.sceneId, 'warmup');
  assert.throws(() => p.choose(5), RangeError);
  assert.throws(() => p.choose(-1), RangeError);
  assert.throws(() => p.choose(0.5), RangeError);
  const q = createPlayer(story());
  assert.throws(() => q.choose(0), RangeError);
});

test('choices are remembered, effects add up, branches play, the ending is chosen and announced', () => {
  const p = createPlayer(story());
  p.start();
  runUntil(p, 'deciding');
  p.choose(0);
  assert.deepEqual(p.choices, { d1: 'flip' });
  assert.equal(p.vars.bold, 1);
  const ev = runUntil(p, 'deciding');
  assert.deepEqual(ev.filter((e) => e.type === 'scene').map((e) => e.id), ['flip_practice', 'the_jump']);
  assert.deepEqual(ev[0], { type: 'choice', decision: 'd1', option: 'flip' });
  p.choose(0);
  const ev2 = runUntil(p, 'ended');
  assert.deepEqual(ev2.map((e) => e.type), ['choice', 'ending', 'scene', 'ended']);
  assert.equal(p.endingId, 'legend');
  assert.equal(p.sceneId, 'end_legend');
  p.advance(1000);
  assert.equal(p.state, 'ended');
});

test('restart() resets variables and choices and plays from the first main scene (no title)', () => {
  const p = createPlayer(story());
  p.start();
  runUntil(p, 'deciding');
  p.choose(0);
  runUntil(p, 'deciding');
  p.choose(1);
  runUntil(p, 'ended');
  p.restart();
  assert.equal(p.state, 'playing');
  assert.equal(p.sceneId, 'warmup');
  assert.deepEqual(p.choices, {});
  assert.deepEqual(p.vars, { bold: 0 });
  assert.equal(p.endingId, null);
  assert.deepEqual(p.advance(0.01), [{ type: 'scene', id: 'warmup' }]);
});

test('frame() gives what the drawing needs', () => {
  const p = createPlayer(story());
  p.start();
  p.advance(0.4 + 1.0);
  const f = p.frame();
  assert.equal(f.sceneId, 'warmup');
  assert.equal(f.light, 'day');
  assert.equal(f.set, 'park');
  assert.equal(f.actors.length, 2);
  const nico = f.actors.find((a) => a.id === 'nico');
  assert.equal(nico.act.action, 'talk');
  assert.ok(nico.act.p > 0 && nico.act.p < 1);
  assert.equal(f.balloon.text, 'Rocky, today I jump the ramp!');
  assert.deepEqual(f.balloon.lines, ['Rocky, today I jump the', 'ramp!']);
  assert.equal(f.items[0].holder, 'rocky');
});

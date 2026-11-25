import test from 'node:test';
import assert from 'node:assert/strict';
import { prepare, sampleScene, travelProgress, lerp, EMOTION_DELAY } from '../../engine/src/core.mjs';
import { RIGS, idlePose, reactionPose, TAKE_PAUSE } from '../../engine/src/pose.mjs';
import { registry } from '../../engine/src/registry.mjs';
import { buildCharacter } from '../../engine/src/draw/scene.mjs';
import { loadCatalog, loadExample } from './helpers/load.mjs';

const catalog = loadCatalog();
const SAMPLE_KIND = { biped: 'boy', quadruped: 'dog', bird: 'bird' };
const dimsOf = {};
for (const rig of RIGS) {
  const kind = SAMPLE_KIND[rig];
  const k = catalog.kinds[kind];
  const set = catalog.attributeSets[k.attributeSet];
  const look = {};
  for (const a of Object.keys(set)) look[a] = k.defaults[a] || set[a].default;
  dimsOf[rig] = buildCharacter({ id: 'x', kind, rig, look }, { catalog, light: catalog.lights.day, faces: ['neutral'], fx: {}, key: 'x' }).dims;
}

// default duration of an action variant (walk/run over 2 marks, jump in place or 2 marks with `to`)
function defaultDuration(action, variant, travel) {
  const act = catalog.actions[action];
  const v = act.variants[variant];
  if (action === 'walk' || action === 'run') return Math.min(act.duration.max, Math.max(act.duration.min, 2 * v.secondsPerMark));
  if (action === 'jump') return act.duration.base + act.duration.perMark * (travel ? 2 : 0);
  return v.defaultDuration !== undefined ? v.defaultDuration : act.duration.default;
}

function samples(action, variant, rig, extra) {
  const travel = !!(extra && extra.travel);
  const dur = defaultDuration(action, variant, travel);
  const fn = registry.actions[action].variants[variant][rig];
  const out = [];
  const n = Math.floor(dur * 60 + 1e-9);
  const ts = [];
  for (let k = 0; k <= n; k++) ts.push(k / 60);
  if (ts[ts.length - 1] < dur) ts.push(dur);
  for (const t of ts) {
    const p = Math.min(1, t / dur);
    const pose = fn(Object.assign({ p, t, dur, dist: travel || action === 'walk' || action === 'run' ? 480 : 0, heightPx: 220, dims: dimsOf[rig], targetDx: 300, targetUp: 250, partnerDx: 240, seatTo: 0 }, extra || {}));
    out.push({ t, p, pose });
  }
  return { dur, out };
}

const ALL = [];
for (const a of Object.keys(catalog.actions)) for (const v of Object.keys(catalog.actions[a].variants)) for (const r of RIGS) ALL.push([a, v, r]);

test('A35: jump, fall and sit.flop squash and stretch in the three rigs', () => {
  const cases = [];
  for (const v of Object.keys(catalog.actions.jump.variants)) cases.push(['jump', v]);
  for (const v of Object.keys(catalog.actions.fall.variants)) cases.push(['fall', v]);
  cases.push(['sit', 'flop']);
  for (const [a, v] of cases) {
    for (const rig of RIGS) {
      const { out } = samples(a, v, rig, a === 'jump' && v === 'cartwheel' ? { travel: true } : undefined);
      const ant = out.filter((s) => s.pose.phase === 'anticipation').map((s) => s.pose.sy);
      const minA = Math.min(...ant);
      const maxS = Math.max(...out.map((s) => s.pose.sy));
      const label = a + '.' + v + '/' + rig;
      assert.ok(ant.length > 0, label + ': has an anticipation');
      assert.ok(minA >= 0.75 && minA <= 0.92, label + ': anticipation min sy ' + minA);
      assert.ok(maxS >= 1.08 && maxS <= 1.3, label + ': max sy ' + maxS);
      for (const s of out) assert.ok(Math.abs(s.pose.sx * s.pose.sy - 1) <= 0.05, label + ' volume at ' + s.t);
    }
  }
});

test('A55: every action x variant x rig anticipates, exaggerates, wobbles and settles', () => {
  for (const [a, v, rig] of ALL) {
    const { out } = samples(a, v, rig, a === 'jump' && v === 'cartwheel' ? { travel: true } : undefined);
    const label = a + '.' + v + '/' + rig;
    const first = out.filter((s) => s.p < 0.25);
    const later = out.filter((s) => s.p >= 0.25);
    const last = out.filter((s) => s.p >= 0.8);
    assert.ok(first.some((s) => s.pose.sy < 0.97), label + ' (a) anticipation');
    assert.ok(later.some((s) => s.pose.sy > 1.03), label + ' (b) exaggeration');
    // crossing 1: the last 20 % holds values on both sides of 1 (a sample may land exactly on 1)
    const below = last.some((s) => s.pose.sy < 1 - 1e-6);
    const above = last.some((s) => s.pose.sy > 1 + 1e-6);
    assert.ok(below && above, label + ' (c) crosses 1 in the last 20 %');
    const end = out[out.length - 1].pose.sy;
    assert.ok(end >= 0.99 && end <= 1.01, label + ' (c) ends at ' + end);
    for (const s of out) assert.ok(Math.abs(s.pose.sx * s.pose.sy - 1) <= 0.05, label + ' (d) volume');
  }
});

test('A55 (e): walk, run and jump with `to` accelerate and brake (root x is not linear)', () => {
  const travelling = ALL.filter(([a]) => a === 'walk' || a === 'run' || a === 'jump');
  for (const [a, v, rig] of travelling) {
    const { out } = samples(a, v, rig, { travel: true });
    const D = 480;
    let maxDev = 0;
    for (const s of out) {
      const x = lerp(0, D, travelProgress(a, s.p)) + (s.pose.x || 0);
      maxDev = Math.max(maxDev, Math.abs(x - lerp(0, D, s.p)));
    }
    assert.ok(maxDev >= 0.03 * D, a + '.' + v + '/' + rig + ' deviation ' + maxDev);
  }
});

test('A56: legs tremble before a high jump (root x oscillates >= 2 times, amplitude >= 3 px)', () => {
  for (const v of Object.keys(catalog.actions.jump.variants)) {
    for (const rig of RIGS) {
      const { out } = samples('jump', v, rig, { heightPx: 360 });
      const xs = out.filter((s) => s.pose.phase === 'anticipation').map((s) => s.pose.x || 0);
      let changes = 0;
      for (let i = 1; i < xs.length; i++) if (xs[i - 1] * xs[i] < 0) changes++;
      assert.ok(changes >= 4, 'jump.' + v + '/' + rig + ' oscillations ' + changes / 2);
      assert.ok(Math.max(...xs.map(Math.abs)) >= 3, 'jump.' + v + '/' + rig + ' amplitude');
    }
  }
});

function idleRun(rig) {
  const frames = [];
  for (let k = 0; k <= 600; k++) {
    const p = idlePose(rig, { posture: 'standing', dims: dimsOf[rig], clock: k / 60, seed: 'scene:actor-' + rig, timing: catalog.timing.idle });
    frames.push(p);
  }
  return frames;
}

test('A57: idle is alive (breathing with bounce, blinks, wandering eyes, a tic) and deterministic', () => {
  const T = catalog.timing.idle;
  for (const rig of RIGS) {
    const f = idleRun(rig);
    const sy = f.map((p) => p.sy);
    assert.ok((Math.max(...sy) - Math.min(...sy)) / 2 >= T.breathScale, rig + ' breath amplitude');
    const per = Math.round(T.breathPeriod * 60);
    for (let k = 0; k + per < sy.length; k++) assert.ok(Math.abs(sy[k] - sy[k + per]) < 1e-6, rig + ' breath period');
    let blinks = 0;
    for (let k = 1; k < f.length; k++) if (f[k].face.eyes === 'closed' && f[k - 1].face.eyes !== 'closed') blinks++;
    assert.ok(blinks >= 2, rig + ' blinks ' + blinks);
    const looks = new Set(f.map((p) => JSON.stringify(p.face.look)));
    assert.ok(looks.size >= 2, rig + ' looks');
    const joints = ['head', 'lean', 'ears', 'tailWag'];
    const rest = f[0];
    let tic = false;
    for (const j of joints) {
      const vals = f.map((p) => p[j] || 0);
      const base = rest[j] || 0;
      const far = vals.findIndex((v) => Math.abs(v - base) >= 5);
      if (far >= 0 && vals.slice(far).some((v) => Math.abs(v - base) < 0.5)) tic = true;
    }
    if (rig === 'biped' && !tic) {
      const a = f.map((p) => p.aF[0]);
      const far = a.findIndex((v) => Math.abs(v - a[0]) >= 5);
      if (far >= 0 && a.slice(far).some((v) => Math.abs(v - a[0]) < 0.5)) tic = true;
    }
    assert.ok(tic, rig + ' tic');
    assert.equal(JSON.stringify(idleRun(rig)), JSON.stringify(f), rig + ' deterministic');
  }
});

test('A59: reaction beats hold the root still during the pause, then take', () => {
  assert.ok(TAKE_PAUSE >= 0.15 && TAKE_PAUSE <= 0.3);
  for (const rig of RIGS) {
    for (let t = 0; t < TAKE_PAUSE; t += 1 / 60) {
      const p = reactionPose(rig, { t, dur: 1.2, dims: dimsOf[rig] }, 'surprised');
      assert.ok(Math.abs(p.x || 0) <= 1 && Math.abs(p.y || 0) <= 1, rig + ' still at ' + t);
    }
    const later = [];
    for (let t = TAKE_PAUSE; t <= 1.2; t += 1 / 60) later.push(reactionPose(rig, { t, dur: 1.2, dims: dimsOf[rig] }, 'surprised').sy);
    assert.ok(Math.min(...later) < 0.97 && Math.max(...later) > 1.03, rig + ' take');
  }
});

test('A59: the new face and its bursts arrive 0.15–0.3 s into the beat (reactions and actions)', () => {
  const s = loadExample();
  s.scenes[0].beats.push({ actor: 'nico', emotion: 'surprised', intensity: 3 });
  s.scenes[0].beats.push({ actor: 'rocky', action: 'wave', emotion: 'scared', intensity: 3 });
  const story = prepare(s, catalog);
  const sc = story.scenes.warmup;
  for (const idx of [4, 5]) {
    const b = sc.beats[idx];
    const at = (dt) => sampleScene(story, 'warmup', b.start + dt, b.start + dt).actors.find((a) => a.id === b.actor);
    assert.notEqual(at(0.14).emotion, b.emotion, 'still the old face at 0.14 s');
    assert.equal(at(0.14).bursts.length > 0 && at(0.14).bursts.some((x) => x.t >= 0 && x.emotion === b.emotion), false);
    assert.equal(at(0.3).emotion, b.emotion, 'new face by 0.3 s');
    assert.ok(EMOTION_DELAY >= 0.15 && EMOTION_DELAY <= 0.3);
  }
});

// Annex «Estilo afinado y fluidez» (A72, A75, A76, A77): continuous limbs, blends, continuity and feet
// that do not slide, measured on the drawing data of every path of the contract example and the examples.
import test from 'node:test';
import assert from 'node:assert/strict';
import { prepare, sampleScene, TITLE_SCENE } from '../../engine/src/core.mjs';
import { buildSceneView, rigUpdate } from '../../engine/src/draw/scene.mjs';
import { BLEND_MS, MAX_JOINT_STEP_PX, MAX_FOOT_SLIP, SPIKE_RATIO, SPIKE_MIN_PX, MAX_REST_KNEE_DEG, TURN_HOP_S, buildPoseTable } from '../../engine/src/pose.mjs';
import { FACET_CONTRAST, walkTree, parseTransform, mApply } from '../../engine/src/draw/svg.mjs';
import { MAX_BODY_OVERLAP, MAX_TAIL_PX } from '../../engine/src/draw/balloon.mjs';
import { registry } from '../../engine/src/registry.mjs';
import { loadCatalog, allScripts } from './helpers/load.mjs';
import { eachPlayFrame, faceSizes, gaitScript } from './helpers/scenes.mjs';
import { jointProblems, LIMBS } from './helpers/joints.mjs';

const catalog = loadCatalog();
const GY = catalog.stage.groundY;
const B = BLEND_MS / 1000;
// the contract example and the five examples (A76 says «todos los caminos» of those)
const SCRIPTS = allScripts().filter((s) => !s.name.startsWith('fixtures/'));
// one character of each kind crossing the stage with every walk and run variant (A77: all variants, 3 rigs)
const GAITS = ['boy', 'girl', 'dog', 'cat', 'bird'].map((k) => ({ name: 'gaits/' + k, script: gaitScript(k) }));

// the drawn balloon of this instant as two moving points: where its tail leaves it, and the tail's tip
function balloonPoints(view, f, upd) {
  const bl = f.balloon;
  if (!bl) return null;
  const node = view.balloonNodes[bl.beat];
  const u = upd[node.k];
  if (!u || u.display === 'none') return null;
  const M = parseTransform(u.transform);
  const m = /^translate\(([^,]+),([^)]+)\)/.exec(u.transform);
  let tip;
  if (bl.kind === 'thought') { const d = upd[node.k + ':dot2']; tip = mApply(M, [Number(d.cx), Number(d.cy)]); }
  else tip = mApply(M, String(upd[node.k + ':tail'].points).trim().split(/\s+/)[2].split(',').map(Number));
  return { key: 'balloon' + bl.beat, base: [Number(m[1]), Number(m[2])], tip };
}

const median = (a) => { const b = a.slice().sort((x, y) => x - y); const n = b.length; return n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2; };

// spikes in one track of steps: a step far above the median of the three before and the three after
function spikesIn(steps, where) {
  const out = [];
  for (let i = 0; i < steps.length; i++) {
    const v = steps[i].v;
    if (v <= SPIKE_MIN_PX) continue;
    const nb = [];
    for (let j = i - 3; j <= i + 3; j++) if (j !== i && j >= 0 && j < steps.length) nb.push(steps[j].v);
    if (nb.length < 3) continue;
    const m = median(nb);
    if (v > SPIKE_RATIO * m) out.push(where + ' ' + steps[i].at + ': ' + v.toFixed(1) + ' px, neighbours ' + m.toFixed(1));
  }
  return out;
}

function prefixOf(sv, upd) {
  const r = upd[sv.key + ':R:ver'];
  return sv.key + ':' + (r && r.display === 'none' ? 'L' : 'R') + ':';
}

// one pass at 60 fps over every distinct scene play
let scanned = null;
function scan() {
  if (scanned) return scanned;
  const res = { frames: 0, plays: 0, worst: { v: 0 }, steps: [], slips: [], worstSlip: { v: 0 }, joints: [], limbCount: [], gaitRigs: new Set(), spikes: [], tracks: 0, worstSpike: { v: 0 } };
  for (const s of SCRIPTS.concat(GAITS)) {
    const story = prepare(s.script, catalog);
    let prev = null;
    let prev2 = null;
    let prevPlay = -1;
    let n = 0;
    // per play: the steps of every joint and balloon point, for the spike check
    let tracks = {};
    let prevPts = {};
    const flush = () => {
      for (const [key, steps] of Object.entries(tracks)) {
        res.tracks++;
        const sp = spikesIn(steps, s.name + ' ' + key);
        res.spikes.push(...sp);
        for (let i = 0; i < steps.length; i++) {
          const nb = [];
          for (let j = i - 3; j <= i + 3; j++) if (j !== i && j >= 0 && j < steps.length) nb.push(steps[j].v);
          if (nb.length >= 3 && steps[i].v > SPIKE_MIN_PX) { const r = steps[i].v / Math.max(1e-6, median(nb)); if (r > res.worstSpike.v) res.worstSpike = { v: r, where: s.name + ' ' + key + ' ' + steps[i].at + ' ' + steps[i].v.toFixed(1) + ' px' }; }
        }
      }
      tracks = {};
      prevPts = {};
    };
    const step = (key, p, at) => {
      const q = prevPts[key];
      if (q) (tracks[key] = tracks[key] || []).push({ v: Math.hypot(p[0] - q[0], p[1] - q[1]), at });
      prevPts[key] = p;
    };
    res.plays += eachPlayFrame(story, 1 / 60, (f, view, upd, play) => {
      res.frames++;
      if (play.index !== prevPlay) flush();
      const at = f.sceneId + ' @' + f.t.toFixed(3);
      const J = view.lastJoints;
      // (a joint that is hidden for a while starts a new track when it shows again)
      const seen = {};
      for (const id of Object.keys(J)) for (const k of Object.keys(J[id].joints)) { const key = id + '.' + k; seen[key] = 1; step(key, J[id].joints[k], at); }
      // the balloon itself (its tip rides on the speaker's head, like a joint of it)
      const bp = balloonPoints(view, f, upd);
      if (bp) { seen[bp.key + '.base'] = 1; step(bp.key + '.base', bp.base, at); }
      for (const key of Object.keys(prevPts)) if (!seen[key]) delete prevPts[key];
      if (prev && prevPlay === play.index) {
        for (const id of Object.keys(J)) {
          const a = J[id];
          const b = prev[id];
          if (!b) continue;
          // A76: every joint, in viewBox coordinates
          for (const k of Object.keys(a.joints)) {
            const q0 = b.joints[k];
            if (!q0) continue;
            const d = Math.hypot(a.joints[k][0] - q0[0], a.joints[k][1] - q0[1]);
            if (d > res.worst.v) res.worst = { v: d, where: s.name + ' ' + f.sceneId + ' @' + f.t.toFixed(3) + ' ' + id + '.' + k };
            if (d > MAX_JOINT_STEP_PX) res.steps.push(s.name + ' ' + f.sceneId + ' @' + f.t.toFixed(3) + ' ' + id + '.' + k + ' ' + d.toFixed(1) + ' px');
          }
          // A77: a foot that rests on the ground in both frames, during a walk or a run
          if (a.act && (a.act.action === 'walk' || a.act.action === 'run') && b.act && b.act.beat === a.act.beat) {
            res.gaitRigs.add(view.actors[id].view.rig);
            for (const ft of Object.keys(a.soles)) {
              const p = a.soles[ft];
              const q = b.soles[ft];
              // a resting foot: down in this frame, the one before and the one before that (the frame it
              // touches down is still the end of its swing)
              const pp = prev2 && prev2[id] && prev2[id].soles[ft];
              if (!q || !pp || p[1] < GY - 0.5 || q[1] < GY - 0.5 || pp[1] < GY - 0.5) continue;
              const v = Math.abs(p[0] - q[0]) * 60;
              const where = s.name + ' ' + f.sceneId + ' @' + f.t.toFixed(3) + ' ' + id + '.' + ft + ' ' + a.act.action + '.' + a.act.variant;
              if (v > res.worstSlip.v) res.worstSlip = { v, where };
              if (v > MAX_FOOT_SLIP) res.slips.push(where + ' ' + v.toFixed(1) + ' px/s');
            }
          }
        }
      }
      // A72 on the frames, each 1/15 s
      if (n++ % 4 === 0) {
        for (const id of Object.keys(J)) {
          const sv = view.actors[id];
          const pre = prefixOf(sv, upd);
          const ver = sv.view.tree.children[pre.endsWith(':L:') ? 1 : 0];
          res.joints.push(...jointProblems(sv.view.rig, ver, pre, upd, s.name + ' ' + f.sceneId + ' @' + f.t.toFixed(2) + ' ' + id));
        }
      }
      prev2 = prevPlay === play.index ? prev : null;
      prev = J;
      prevPlay = play.index;
    }, { joints: true });
    flush();
  }
  scanned = res;
  return res;
}

test('the constants of the annexes (A67, A74–A78), printed for §9', (t) => {
  t.diagnostic('FACET_CONTRAST = ' + FACET_CONTRAST + ' (0..1; engine/src/draw/svg.mjs)');
  t.diagnostic('BLEND_MS = ' + BLEND_MS + ' ms (engine/src/pose.mjs)');
  t.diagnostic('MAX_JOINT_STEP_PX = ' + MAX_JOINT_STEP_PX + ' viewBox px between frames at 60 fps (engine/src/pose.mjs)');
  t.diagnostic('MAX_FOOT_SLIP = ' + MAX_FOOT_SLIP + ' viewBox px per second (engine/src/pose.mjs)');
  t.diagnostic('MAX_BODY_OVERLAP = ' + MAX_BODY_OVERLAP + ' (share of a body box under a balloon box plus its tail box; engine/src/draw/balloon.mjs)');
  t.diagnostic('SPIKE_RATIO = ' + SPIKE_RATIO + ', SPIKE_MIN_PX = ' + SPIKE_MIN_PX + ' px (engine/src/pose.mjs)');
  t.diagnostic('MAX_TAIL_PX = ' + MAX_TAIL_PX + ' px (engine/src/draw/balloon.mjs)');
  t.diagnostic('MAX_REST_KNEE_DEG = ' + MAX_REST_KNEE_DEG + ' degrees between thigh and shin (engine/src/pose.mjs)');
  assert.ok(MAX_REST_KNEE_DEG > 0 && MAX_REST_KNEE_DEG < 45);
  assert.ok(FACET_CONTRAST >= 0 && FACET_CONTRAST <= 1);
  assert.ok(BLEND_MS >= 150 && BLEND_MS <= 250);
  assert.ok(MAX_JOINT_STEP_PX > 0 && MAX_FOOT_SLIP > 0 && MAX_BODY_OVERLAP > 0 && MAX_BODY_OVERLAP < 1);
});

test('A72: in every pose of every kind, limbs are one silhouette each, joints share their numbers and roots sit in the body', () => {
  const table = buildPoseTable(catalog);
  const errs = [];
  for (const kind of Object.keys(registry.kinds)) {
    const view = registry.kinds[kind](catalog);
    const rig = view.rig;
    // one data-limb element per limb and facing
    for (const ver of [0, 1]) {
      const names = [];
      walkTree(view.tree.children[ver], (n) => { if (n.attrs && n.attrs['data-limb']) names.push(n.attrs['data-limb']); });
      assert.deepEqual(names.slice().sort(), LIMBS[rig].slice().sort(), kind + ': limbs');
    }
    const seen = {};
    for (const a of Object.keys(catalog.actions)) {
      for (const v of Object.keys(catalog.actions[a].variants)) {
        for (const p of [0, 0.15, 0.3, 0.5, 0.7, 0.9, 1]) {
          const pose = table[a].variants[v][rig]({ p, t: p * 1.2, dur: 1.2, dist: 480, heightPx: 220, dims: view.dims, targetDx: 300, targetUp: 250, partnerDx: 240, seatTo: 0 });
          for (const ver of ['R', 'L']) {
            pose.ver = ver;
            const out = rigUpdate(view, pose).out;
            const pre = view.key + ':' + ver + ':';
            errs.push(...jointProblems(rig, view.tree.children[ver === 'R' ? 0 : 1], pre, out, kind + ' ' + a + '.' + v + ' p=' + p + ' ' + ver));
            for (const key of Object.keys(out)) if (key.endsWith(':ink')) (seen[key] = seen[key] || new Set()).add(out[key].points);
          }
        }
      }
    }
    // each limb is recomputed: its silhouette changes between frames
    for (const [key, set] of Object.entries(seen)) assert.ok(set.size > 1, kind + ': ' + key + ' never changes');
  }
  assert.deepEqual(errs.slice(0, 10), []);
});

test('A72: the same holds in the frames of every path (each 1/15 s)', () => {
  const r = scan();
  assert.deepEqual(r.joints.slice(0, 10), []);
});

// joints of one actor at one instant, in the character's own frame (so a turn or a step does not count);
// `raw` draws it without the blend between beats
function jointsAt(view, story, sid, id, t, raw) {
  const f = sampleScene(story, sid, t, t);
  if (raw) for (const a of f.actors) if (a.id === id) a.segStart = 0;
  view.update(f);
  const J = view.lastJoints[id];
  return J ? J.local : null;
}

test('A75: over the whole BLEND_MS window of every boundary, joints go from the outgoing pose to the arriving one without overshoot', (t) => {
  let checked = 0;
  const errs = [];
  const sum = (A, Bx, keys) => keys.reduce((acc, k) => acc + Math.hypot(A[k][0] - Bx[k][0], A[k][1] - Bx[k][1]), 0);
  for (const s of SCRIPTS) {
    const story = prepare(s.script, catalog);
    for (const sid of Object.keys(story.scenes)) {
      const sc = story.scenes[sid];
      const view = buildSceneView(story, sid);
      view.trackJoints = true;
      const bounds = new Set();
      for (let tt = 0; tt < sc.duration; tt += 1 / 60) for (const a of sampleScene(story, sid, tt, tt).actors) if (a.segStart > 0) bounds.add(a.id + '@' + a.segStart.toFixed(6));
      for (const key of bounds) {
        const [id, tbs] = key.split('@');
        const tb = Number(tbs);
        if (tb + B > sc.duration) continue;
        view.reset();
        const J0 = jointsAt(view, story, sid, id, tb - 1 / 60, false);
        if (!J0) continue;
        // the window frame by frame (drawn in order, as the page does), and the arriving pose unblended
        const win = [];
        for (let i = 1; i <= Math.round(B * 60); i++) {
          const tt = tb + (i - 0.5) / 60;
          const Jm = jointsAt(view, story, sid, id, tt, false);
          const Jr = jointsAt(view, story, sid, id, tt, true);
          if (Jm && Jr) win.push({ Jm, Jr });
        }
        if (!win.length) continue;
        const keys = Object.keys(J0).filter((k) => win.every((w) => w.Jm[k] && w.Jr[k]));
        const total = sum(win[0].Jr, J0, keys);
        if (total < 6 * keys.length * 0.2) continue;
        checked++;
        const first = win[0];
        const last = win[win.length - 1];
        // starts at the old pose, ends at the new one, and never strays outside the two
        if (sum(first.Jm, J0, keys) > 0.25 * total) errs.push(s.name + ' ' + sid + ' ' + id + ' @' + tb.toFixed(2) + ': the first frame is already far from the outgoing pose');
        if (sum(last.Jm, last.Jr, keys) > 0.25 * sum(last.Jr, J0, keys) + keys.length) errs.push(s.name + ' ' + sid + ' ' + id + ' @' + tb.toFixed(2) + ': the last frame is still far from the arriving pose');
        for (const w of win) {
          const span = sum(w.Jr, J0, keys);
          if (sum(w.Jm, J0, keys) + sum(w.Jm, w.Jr, keys) > 1.35 * span + 2 * keys.length) { errs.push(s.name + ' ' + sid + ' ' + id + ' @' + tb.toFixed(2) + ': a frame of the blend overshoots'); break; }
        }
      }
    }
  }
  t.diagnostic('boundaries checked: ' + checked + ' (BLEND_MS = ' + BLEND_MS + ' ms, every frame of the window)');
  assert.ok(checked > 20);
  assert.deepEqual(errs.slice(0, 10), []);
});

test('A75: every change of face interpolates eyes and mouth (width, height) over BLEND_MS, after the A59 pause', (t) => {
  let checked = 0;
  const errs = [];
  for (const s of SCRIPTS) {
    const story = prepare(s.script, catalog);
    for (const sid of Object.keys(story.scenes)) {
      const sc = story.scenes[sid];
      let view = null;
      for (const id of sc.cast) {
        const marks = sc.emotionMarks[id];
        for (let i = 1; i < marks.length; i++) {
          const m0 = marks[i - 1];
          const m = marks[i];
          const f0 = catalog.emotions[m0.emotion].levels[String(m0.intensity)].face;
          const f1 = catalog.emotions[m.emotion].levels[String(m.intensity)].face;
          if (f0 === f1 || m.t + B > sc.duration) continue;
          if (!view) view = buildSceneView(story, sid);
          const at = (tt) => { const f = sampleScene(story, sid, tt, tt); return faceSizes(view, id, view.update(f)); };
          const before = at(m.t - 0.02);
          const after = at(m.t + B + 0.001);
          const mids = [at(m.t + B * 0.3), at(m.t + B * 0.7)];
          for (const part of ['eyes', 'mouth']) {
            for (const d of [0, 1]) {
              if (!before[part] || !after[part]) continue;
              const lo = Math.min(before[part][d], after[part][d]);
              const hi = Math.max(before[part][d], after[part][d]);
              if (hi - lo < 2) continue;
              checked++;
              for (const q of mids) {
                if (!q[part]) continue;
                if (!(q[part][d] > lo + 0.05 && q[part][d] < hi - 0.05)) errs.push(s.name + ' ' + sid + ' ' + id + ' ' + f0 + '->' + f1 + ' ' + part + (d ? ' height ' : ' width ') + q[part][d].toFixed(1) + ' not in ' + lo.toFixed(1) + '..' + hi.toFixed(1));
              }
            }
          }
        }
      }
    }
  }
  t.diagnostic('face sizes checked: ' + checked);
  assert.ok(checked > 20);
  assert.deepEqual(errs.slice(0, 10), []);
});

test('A76: at 60 fps on every path no joint moves more than MAX_JOINT_STEP_PX between frames (except at scene changes)', (t) => {
  const r = scan();
  t.diagnostic('MAX_JOINT_STEP_PX = ' + MAX_JOINT_STEP_PX + ' px; frames ' + r.frames + ' in ' + r.plays + ' scene plays; worst step ' + r.worst.v.toFixed(1) + ' px (' + r.worst.where + ')');
  assert.deepEqual(r.steps.slice(0, 10), []);
});

test('no one-frame spikes: no joint or balloon steps more than SPIKE_RATIO times its neighbours (all paths, 60 fps)', (t) => {
  const r = scan();
  t.diagnostic('SPIKE_RATIO = ' + SPIKE_RATIO + ', SPIKE_MIN_PX = ' + SPIKE_MIN_PX + ' px; tracks ' + r.tracks + '; worst ratio among steps over ' + SPIKE_MIN_PX + ' px: ' + (r.worstSpike.v ? r.worstSpike.v.toFixed(2) + ' (' + r.worstSpike.where + ')' : 'none'));
  assert.deepEqual(r.spikes.slice(0, 10), []);
});

test('A77: a resting foot never slides faster than MAX_FOOT_SLIP during walks and runs (3 rigs, every variant)', (t) => {
  const r = scan();
  t.diagnostic('MAX_FOOT_SLIP = ' + MAX_FOOT_SLIP + ' px/s; worst ' + r.worstSlip.v.toFixed(1) + ' px/s (' + r.worstSlip.where + ')');
  assert.deepEqual([...r.gaitRigs].sort(), ['biped', 'bird', 'quadruped']);
  assert.deepEqual(r.slips.slice(0, 10), []);
});

test('A77: in every step cycle the root advances as much as the step (±15 %)', (t) => {
  const errs = [];
  const cycles = { biped: 0, quadruped: 0, bird: 0 };
  let worst = 0;
  for (const s of SCRIPTS.concat(GAITS)) {
    const story = prepare(s.script, catalog);
    for (const sid of Object.keys(story.scenes)) {
      const sc = story.scenes[sid];
      const gait = sc.beats.filter((b) => b.action === 'walk' || b.action === 'run');
      if (!gait.length) continue;
      const view = buildSceneView(story, sid);
      view.trackJoints = true;
      for (const b of gait) {
        const rig = story.characters[b.actor].rig;
        const fr = [];
        // 240 Hz, so a landing is placed within a quarter of a 60 fps frame
        for (let tt = b.start; tt <= b.end + 1e-9; tt += 1 / 240) { view.update(sampleScene(story, sid, tt, tt)); const J = view.lastJoints[b.actor]; if (J) fr.push(J); }
        if (!fr.length) continue;
        // a cycle is counted while the body travels; the hop of a turn (first 0.15 s) is not a step
        const turnEnd = b.facingTo !== b.facingFrom ? b.start + 0.2 : b.start;
        const inside = (x, i) => Math.abs(x - b.fromX) > 1 && Math.abs(x - b.toX) > 1 && b.start + i / 240 > turnEnd;
        for (const ft of Object.keys(fr[0].soles)) {
          const lands = [];
          for (let i = 1; i < fr.length; i++) {
            const p = fr[i - 1].soles[ft];
            const q = fr[i].soles[ft];
            if (p && q && p[1] < GY - 0.5 && q[1] >= GY - 0.5 && inside(fr[i].rootX, i)) lands.push({ x: q[0], r: fr[i].rootX });
          }
          // (the last landing of each foot is the one that brings it to rest: not a full cycle)
          for (let k = 0; k + 2 < lands.length; k++) {
            const dx = Math.abs(lands[k + 1].x - lands[k].x);
            const dr = Math.abs(lands[k + 1].r - lands[k].r);
            if (dx < 2) continue;
            cycles[rig]++;
            const e = Math.abs(dr - dx) / dx;
            if (e > worst) worst = e;
            if (e > 0.15) errs.push(s.name + ' ' + sid + ' ' + b.actor + ' ' + b.action + '.' + b.variant + ' ' + ft + ': step ' + dx.toFixed(1) + ' px, root ' + dr.toFixed(1) + ' px');
          }
        }
      }
    }
  }
  t.diagnostic('step cycles: ' + JSON.stringify(cycles) + '; worst mismatch ' + (worst * 100).toFixed(1) + ' %');
  for (const rig of Object.keys(cycles)) assert.ok(cycles[rig] > 0, rig + ' has no step cycles');
  assert.deepEqual(errs.slice(0, 10), []);
});

// ---------- A78: knees almost straight at rest ----------
// Knee flexion is the angle between thigh and shin, measured in the character's own frame: the whole-body
// squash and stretch (breathing, the landing of a happy bounce) scales the drawing, it does not bend the
// knee. Birds have no knee: their legs are one straight segment (A72 checks it is a single limb).
const KNEES = {
  biped: [['hipF', 'kneeF', 'ankleF', 'footF'], ['hipB', 'kneeB', 'ankleB', 'footB']],
  quadruped: ['FF', 'FB', 'BF', 'BB'].map((k) => ['hip' + k, 'knee' + k, 'paw' + k, 'paw' + k])
};
function kneeDeg(J, leg) {
  const h = J[leg[0]];
  const k = J[leg[1]];
  const a = J[leg[2]];
  if (!h || !k || !a) return null;
  const u = [k[0] - h[0], k[1] - h[1]];
  const v = [a[0] - k[0], a[1] - k[1]];
  const c = (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(u[0], u[1]) * Math.hypot(v[0], v[1]));
  return (Math.acos(clampUnit(c)) * 180) / Math.PI;
}
function clampUnit(x) { return Math.max(-1, Math.min(1, x)); }

test('A78: standing at rest the knees stay within MAX_REST_KNEE_DEG (title, idle with every emotion but fear, the resting leg all through a walk)', (t) => {
  t.diagnostic('MAX_REST_KNEE_DEG = ' + MAX_REST_KNEE_DEG + '° (engine/src/pose.mjs)');
  t.diagnostic('TURN_HOP_S = ' + TURN_HOP_S + ' s (engine/src/pose.mjs): the hop of a walk that starts by turning round is not a step');
  t.diagnostic('settling window left out after a walk or run beat: 0 s inside the beat (part 3 measures every frame from the start of the walk to its end); the frames after its end are not measured by this test (part 3 stops there; part 2 measures a character that never walks or runs)');
  // The only cases left out (spec A78): scared, whose idle tremble bends the knees on purpose; walk.sneak,
  // crouched on purpose (D13.3); and the frames of a jump's explicit anticipation (no jump is sampled here:
  // the title, idles and walks have none).
  // 1. the title screen of the contract example and the 5 examples: every character, every knee
  let title = { v: 0 };
  for (const s of SCRIPTS) {
    const story = prepare(s.script, catalog);
    const view = buildSceneView(story, TITLE_SCENE);
    view.trackJoints = true;
    for (let clock = 0; clock < 3; clock += 1 / 60) {
      view.update(sampleScene(story, TITLE_SCENE, 0, clock));
      for (const [id, J] of Object.entries(view.lastJoints)) {
        for (const leg of KNEES[story.characters[id].rig] || []) {
          const a = kneeDeg(J.local, leg);
          if (a !== null && a > title.v) title = { v: a, where: s.name + ' ' + id + '.' + leg[1] };
        }
      }
    }
  }
  t.diagnostic('title: worst ' + title.v.toFixed(1) + '° (' + title.where + ')');
  assert.ok(title.v <= MAX_REST_KNEE_DEG, 'title: ' + title.where + ' ' + title.v.toFixed(1) + '°');

  // 2. idle with every emotion but scared and every intensity (1, 2, 3), every kind with knees, at 60 fps
  // for 10 s (someone else walks to and fro, so the character stays idle all that time)
  let idle = { v: 0 };
  const one = (id) => [{ id, set: 's', cast: [{ who: 'x', at: 'center' }], beats: [{ actor: 'x', emotion: 'happy' }] }];
  const toAndFro = [];
  for (let k = 0; k < 3; k++) toAndFro.push({ actor: 'y', action: 'walk', to: 'far_right', duration: 2 }, { actor: 'y', action: 'walk', to: 'far_left', duration: 2 });
  for (const kind of Object.keys(catalog.kinds)) {
    const rig = catalog.kinds[kind].rig;
    if (!KNEES[rig]) continue;
    for (const e of Object.keys(catalog.emotions)) {
      if (e === 'scared') continue;
      for (const i of [1, 2, 3]) {
        const script = {
          tcia: 1, meta: { title: 'Knees', slug: 'knees', lang: 'en', light: 'day' },
          characters: [{ id: 'x', name: 'X', kind }, { id: 'y', name: 'Y', kind: 'boy' }],
          sets: [{ id: 's', base: 'plain' }],
          scenes: [{ id: 'one', set: 's', cast: [{ who: 'x', at: 'center', emotion: e, intensity: i }, { who: 'y', at: 'far_left' }], beats: toAndFro }].concat(one('two')),
          decisions: [{ id: 'd1', after: 'one', options: [{ id: 'a', label: 'A', rejoin: 'two' }, { id: 'b', label: 'B', rejoin: 'two' }] },
            { id: 'd2', after: 'two', options: [{ id: 'a', label: 'A', rejoin: '@endings' }, { id: 'b', label: 'B', rejoin: '@endings' }] }],
          endings: [{ id: 'e1', title: 'E1', scenes: one('e1s') }]
        };
        const story = prepare(script, catalog);
        assert.ok(story.scenes.one.duration >= 10, 'the idle scene lasts 10 s');
        const view = buildSceneView(story, 'one');
        view.trackJoints = true;
        for (let f = 0; f <= 600; f++) {
          const tt = f / 60;
          view.update(sampleScene(story, 'one', tt, tt));
          const J = view.lastJoints.x;
          if (!J) continue;
          for (const leg of KNEES[rig]) {
            const a = kneeDeg(J.local, leg);
            if (a !== null && a > idle.v) idle = { v: a, where: kind + ' ' + e + ' ' + i + ' ' + leg[1] + ' @' + tt.toFixed(3) };
          }
        }
      }
    }
  }
  t.diagnostic('idle: worst ' + idle.v.toFixed(1) + '° (' + idle.where + ')');
  assert.ok(idle.v <= MAX_REST_KNEE_DEG, 'idle: ' + idle.where + ' ' + idle.v.toFixed(1) + '°');

  // 3. walking (every variant but sneak), over the whole beat (start, steps, end and settling), at 60 fps:
  // in every frame where a foot rests on the ground (its sole within half a pixel of it), its knee is within
  // the cap; and in every step the knee of the leg that swings bends more than it. A step is a foot leaving
  // the ground and landing again farther on (20 px or more); the little hop of a walk that starts by
  // turning round (TURN_HOP_S) lifts both feet in place and is not a step.
  let stance = { v: 0 };
  let swingLeast = { v: Infinity };
  let steps = 0;
  const over = [];
  const flat = [];
  for (const s of SCRIPTS.concat(GAITS)) {
    const story = prepare(s.script, catalog);
    for (const sid of Object.keys(story.scenes)) {
      const beats = story.scenes[sid].beats.filter((b) => b.action === 'walk' && b.variant !== 'sneak' && KNEES[story.characters[b.actor].rig]);
      if (!beats.length) continue;
      const view = buildSceneView(story, sid);
      view.trackJoints = true;
      for (const b of beats) {
        const legs = KNEES[story.characters[b.actor].rig];
        const swing = legs.map(() => null);
        const turns = b.facingFrom !== b.facingTo;
        // (the frame at the beat's end already belongs to the next beat)
        for (let f = 0; b.start + f / 60 < b.end - 1e-9; f++) {
          const tt = b.start + f / 60;
          view.update(sampleScene(story, sid, tt, tt));
          const J = view.lastJoints[b.actor];
          if (!J) continue;
          legs.forEach((leg, li) => {
            const a = kneeDeg(J.local, leg);
            const sole = J.soles[leg[3]];
            if (a === null || !sole) return;
            const where = s.name + ' ' + sid + ' ' + b.actor + ' walk.' + b.variant + ' ' + leg[1] + ' @' + tt.toFixed(3) + (J.act ? ' ' + J.act.phase : '');
            if (sole[1] >= GY - 0.5) {
              if (a > stance.v) stance = { v: a, where };
              if (a > MAX_REST_KNEE_DEG) over.push(where + ' ' + a.toFixed(1) + '°');
              const sw = swing[li];
              if (sw && !sw.hop && Math.abs(sole[0] - sw.x0) >= 20) {
                // a step ends as the foot lands: its knee must have bent more than the cap on the way
                steps++;
                if (sw.v < swingLeast.v) swingLeast = sw;
                if (sw.v <= MAX_REST_KNEE_DEG) flat.push(sw.where + ' ' + sw.v.toFixed(1) + '°');
              }
              swing[li] = null;
            } else if (!swing[li]) swing[li] = { v: a, where, x0: sole[0], hop: turns && tt - b.start < TURN_HOP_S + 1e-6 };
            else if (a > swing[li].v) Object.assign(swing[li], { v: a, where });
          });
        }
      }
    }
  }
  t.diagnostic('walking, resting leg: worst ' + stance.v.toFixed(1) + '° (' + stance.where + '); ' + over.length + ' frames over the cap');
  t.diagnostic('walking, swinging leg: ' + steps + ' steps; the least bent ' + swingLeast.v.toFixed(1) + '° (' + swingLeast.where + ')');
  assert.deepEqual(over.slice(0, 12), [], 'resting knees over MAX_REST_KNEE_DEG');
  assert.deepEqual(flat.slice(0, 12), [], 'steps whose swinging knee bends no more than MAX_REST_KNEE_DEG');
});

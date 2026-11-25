// Annex «Composición» (A66–A70, R1–R5) measured in Node on the drawing data: buttons, balloons, drawing
// order, poses on the ground, the title screen and the pause before a reaction. The DOM side of A66,
// A70 and A71 lives in browser.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { prepare, createPlayer, sampleScene, TITLE_SCENE } from '../../engine/src/core.mjs';
import { buildSceneView, rigUpdate, rootMatrix } from '../../engine/src/draw/scene.mjs';
import { buildPoseTable, TAKE_PAUSE } from '../../engine/src/pose.mjs';
import { h, measure, boxesCross, boxCross, boxArea, parseTransform, mApply, walkTree, applyUpdates } from '../../engine/src/draw/svg.mjs';
import { MAX_BODY_OVERLAP, MAX_TAIL_PX } from '../../engine/src/draw/balloon.mjs';
import { TCIA_BANDS, tciaBandFor } from '../../engine/src/dom.mjs';
import { registry } from '../../engine/src/registry.mjs';
import { loadCatalog, allScripts, combos } from './helpers/load.mjs';
import { eachPlayFrame } from './helpers/scenes.mjs';

const catalog = loadCatalog();
const GY = catalog.stage.groundY;
const I = [1, 0, 0, 1, 0, 0];
const SCRIPTS = allScripts().filter((s) => !s.name.startsWith('fixtures/'));
const TAIL_REACH = 60;

function distToBox(p, b) {
  const dx = Math.max(b[0] - p[0], 0, p[0] - b[2]);
  const dy = Math.max(b[1] - p[1], 0, p[1] - b[3]);
  return Math.hypot(dx, dy);
}

// tip of a drawn balloon's tail (speech) or of its last dot (thought), in viewBox coordinates
function tailTip(node, kind, upd) {
  const u = upd[node.k];
  const M = parseTransform(u.transform);
  if (kind === 'thought') {
    const d = upd[node.k + ':dot2'];
    return mApply(M, [Number(d.cx), Number(d.cy) + 7]);
  }
  const p = String(upd[node.k + ':tail'].points).trim().split(/\s+/)[2].split(',').map(Number);
  return mApply(M, p);
}

// one pass each 1/15 s over every distinct scene play of every path
let scanned = null;
function scan() {
  if (scanned) return scanned;
  const res = { frames: 0, balloons: { frames: 0, beats: new Set(), errs: [], worstBody: 0, worstTip: 0, worstTail: 0 }, order: [], fx: [], ground: [], groundFrames: 0 };
  for (const s of SCRIPTS) {
    const story = prepare(s.script, catalog);
    eachPlayFrame(story, 1 / 15, (f, view, upd) => {
      res.frames++;
      const at = s.name + ' ' + f.sceneId + ' @' + f.t.toFixed(2);
      const boxes = view.boxes();
      const byId = {};
      for (const b of boxes) byId[b.id] = b;
      // A67: the balloon of this instant
      const bl = f.balloon;
      if (bl && byId[bl.actor]) {
        const node = view.balloonNodes[bl.beat];
        const plan = view.balloonPlan[bl.beat];
        const box = measure(node, I, upd).box;
        // the balloon and its tail (or dots), each by its own box, for the share over a body
        const parts = { tail: null, body: null };
        for (const c of node.children) {
          if (!c || typeof c !== 'object' || c.tag === 'text') continue;
          const isTail = c.k === node.k + ':tail' || c.k === node.k + ':cover' || (c.k && c.k.startsWith(node.k + ':dot'));
          const m = measure(h('g', { transform: upd[node.k].transform }, [c]), I, upd).box;
          if (!m) continue;
          const k = isTail ? 'tail' : 'body';
          parts[k] = parts[k] ? [Math.min(parts[k][0], m[0]), Math.min(parts[k][1], m[1]), Math.max(parts[k][2], m[2]), Math.max(parts[k][3], m[3])] : m;
        }
        const R = res.balloons;
        R.frames++;
        R.beats.add(s.name + ' ' + f.sceneId + ' ' + bl.beat);
        if (!plan || !(plan.evaluated >= 2)) R.errs.push(at + ': balloon evaluated ' + (plan && plan.evaluated) + ' places');
        // the balloon itself stays on the canvas (its tail may point out, at a speaker leaving it)
        const pb = parts.body;
        if (pb[0] < 0 || pb[1] < 0 || pb[2] > 1920 || pb[3] > 1080) R.errs.push(at + ': balloon outside the canvas ' + pb.map(Math.round));
        for (const b of boxes) {
          // the balloon and its tail, each by its own box
          if (boxesCross(parts.body, b.head) || boxesCross(parts.tail, b.head)) R.errs.push(at + ': balloon of ' + bl.actor + ' covers the head of ' + b.id);
          // share of the body box under the balloon and under its tail; over the speaker's own body only the
          // balloon counts: its tail is meant to reach the speaker
          const o = (boxCross(parts.body, b.body) + (b.id === bl.actor ? 0 : boxCross(parts.tail, b.body))) / boxArea(b.body);
          if (o > R.worstBody) R.worstBody = o;
          if (o > MAX_BODY_OVERLAP) R.errs.push(at + ': balloon over the body of ' + b.id + ' ' + (o * 100).toFixed(1) + ' %');
        }
        const tip = tailTip(node, bl.kind, upd);
        const own = distToBox(tip, byId[bl.actor].head);
        // the tail leaves the balloon where it is anchored (the first translate of its transform)
        const anchor = /^translate\(([^,]+),([^)]+)\)/.exec(upd[node.k].transform);
        const tail = Math.hypot(tip[0] - Number(anchor[1]), tip[1] - Number(anchor[2]));
        const hb = byId[bl.actor].head;
        const headInside = hb[0] >= 0 && hb[2] <= 1920 && hb[1] >= 0;
        if (headInside && tail > R.worstTail) R.worstTail = tail;
        if (headInside && tail > MAX_TAIL_PX) R.errs.push(at + ': tail of ' + tail.toFixed(1) + ' px');
        if (own > R.worstTip) R.worstTip = own;
        const inCanvas = byId[bl.actor].head[2] > 0 && byId[bl.actor].head[0] < 1920 && byId[bl.actor].head[3] > 0;
        if (own > TAIL_REACH && inCanvas) R.errs.push(at + ': tail tip ' + own.toFixed(1) + ' px from the head of ' + bl.actor);
        for (const b of boxes) if (b.id !== bl.actor && distToBox(tip, b.head) <= own) R.errs.push(at + ': tail tip nearer to ' + b.id + ' than to ' + bl.actor);
      }
      // A68: pieces, then characters; acting characters last; effects off the other heads
      applyUpdates(view.tree, upd);
      let lastPiece = -1;
      let firstChar = Infinity;
      let i = 0;
      walkTree(view.tree, (n) => {
        i++;
        if (n.attrs && n.attrs['data-piece'] !== undefined) lastPiece = i;
        if (n.k && /^a:[^:]+:root$/.test(n.k) && i < firstChar) firstChar = i;
      });
      if (firstChar !== Infinity && lastPiece > firstChar) res.order.push(at + ': a piece is drawn after a character');
      const cast = view.tree.children.find((c) => c.attrs['data-layer'] === 'cast').children.map((c) => c.k.split(':')[1]);
      const acting = new Set(f.actors.filter((a) => a.act).map((a) => a.id));
      const firstActing = cast.findIndex((id) => acting.has(id));
      if (firstActing >= 0 && cast.slice(firstActing).some((id) => !acting.has(id))) res.order.push(at + ': an actor of the current beat is behind a still character (' + cast.join(',') + ')');
      for (const b of boxes) {
        const sv = view.actors[b.id];
        const own = measure(sv.view.tree, I, upd).fx.concat(measure(sv.fxNode, I, upd).fx);
        for (const e of own) {
          if (!e.b) continue;
          for (const o of boxes) if (o.id !== b.id && boxesCross(e.b, o.head)) res.fx.push(at + ': ' + e.fx + ' of ' + b.id + ' crosses the head of ' + o.id);
        }
      }
      // A69: lying, or sitting on the floor
      for (const a of f.actors) {
        const floor = a.posture === 'lying' || (a.posture === 'sitting' && !(a.seatH > 0));
        if (!floor || !byId[a.id]) continue;
        res.groundFrames++;
        if (byId[a.id].head[3] > GY + 2) res.ground.push(at + ': head of ' + a.id + ' (' + a.posture + ') reaches y=' + byId[a.id].head[3].toFixed(1));
      }
    });
  }
  scanned = res;
  return res;
}

test('A66 (R1): at every decision and ending the button band crosses no character box', (t) => {
  let n = 0;
  const errs = [];
  for (const s of SCRIPTS) {
    const story = prepare(s.script, catalog);
    for (const picks of combos(story)) {
      const p = createPlayer(story);
      p.start();
      let k = 0;
      const views = {};
      const check = (what) => {
        const f = p.frame();
        const view = views[f.sceneId] || (views[f.sceneId] = buildSceneView(story, f.sceneId));
        view.update(f);
        const boxes = view.boxes();
        const band = TCIA_BANDS[tciaBandFor(boxes)];
        n++;
        for (const b of boxes) for (const r of [b.body, b.head]) if (r[3] > band[0] && r[1] < band[1]) errs.push(s.name + ' ' + what + ' ' + f.sceneId + ': ' + b.id + ' reaches the button band');
      };
      while (p.state !== 'ended') {
        if (p.state === 'deciding') { check('decision ' + p.decisionId); p.choose(picks[k++] || 0); continue; }
        p.advance(1 / 15);
      }
      check('ending ' + p.endingId);
    }
  }
  t.diagnostic('decision and ending screens checked: ' + n);
  assert.deepEqual(errs.slice(0, 10), []);
});

test('A67 (R2): balloons pick among candidates, never cover a head, stay inside, and their tail points at the speaker', (t) => {
  const R = scan().balloons;
  t.diagnostic('MAX_BODY_OVERLAP = ' + MAX_BODY_OVERLAP + ' (share of a body box under the balloon box plus its tail box); worst seen ' + (R.worstBody * 100).toFixed(1) + ' %');
  t.diagnostic('tail tip at most ' + TAIL_REACH + ' px from the speaker\'s head; worst seen ' + R.worstTip.toFixed(1) + ' px; ' + R.beats.size + ' beats with say, ' + R.frames + ' frames');
  t.diagnostic('MAX_TAIL_PX = ' + MAX_TAIL_PX + ' px (with the speaker\'s head on the canvas); worst seen ' + R.worstTail.toFixed(1) + ' px');
  assert.ok(R.beats.size > 10);
  assert.deepEqual(R.errs.slice(0, 10), []);
});

test('A68 (R3): characters in front of every piece, actors of the beat in front, effects off the other heads', () => {
  const r = scan();
  assert.deepEqual(r.order.slice(0, 10), []);
  assert.deepEqual(r.fx.slice(0, 10), []);
});

test('A69 (R4): lying or sitting on the floor, head, face and hair stay above the ground line (2 px)', (t) => {
  const r = scan();
  t.diagnostic('frames on the ground: ' + r.groundFrames);
  assert.deepEqual(r.ground.slice(0, 10), []);
});

test('A69 (R4): the last pose of every fall, in every rig, head shape and hairstyle, keeps the head above the ground', (t) => {
  const table = buildPoseTable(catalog);
  const errs = [];
  let n = 0;
  const looks = [];
  for (const kind of Object.keys(catalog.kinds)) {
    const k = catalog.kinds[kind];
    if (k.rig !== 'biped') { looks.push([kind, {}]); continue; }
    const set = catalog.attributeSets[k.attributeSet];
    for (const head of Object.keys(set.head.values)) for (const hair of Object.keys(set.hair.values)) looks.push([kind, { head, hair }]);
  }
  for (const [kind, look] of looks) {
    const view = registry.kinds[kind](catalog, look);
    for (const v of Object.keys(catalog.actions.fall.variants)) {
      const pose = table.fall.variants[v][view.rig]({ p: 1, t: 1.2, dur: 1.2, dims: view.dims, heightPx: 0, dist: 0 });
      for (const ver of ['R', 'L']) {
        pose.ver = ver;
        const ru = rigUpdate(view, pose);
        ru.out[view.key + ':' + ver + ':ver'] = { display: null };
        const M = rootMatrix(960 + (pose.x || 0), GY + (pose.y || 0), (ver === 'R' ? 1 : -1) * (pose.sx || 1), pose.sy || 1, pose.rot || 0, pose.pivot || 0);
        const m = measure(view.tree.children[ver === 'R' ? 0 : 1], M, ru.out);
        n++;
        if (m.head[3] > GY + 2) errs.push(kind + ' ' + JSON.stringify(look) + ' fall.' + v + ' ' + ver + ': head reaches y=' + m.head[3].toFixed(1));
      }
    }
  }
  t.diagnostic('final fall poses checked: ' + n);
  assert.deepEqual(errs.slice(0, 10), []);
});

test('A70 (R5): the title frame has every character standing still in a row on the ground line', () => {
  for (const s of SCRIPTS) {
    const story = prepare(s.script, catalog);
    const p = createPlayer(story);
    const f = p.frame();
    assert.equal(f.sceneId, TITLE_SCENE, s.name);
    assert.deepEqual(f.actors.map((a) => a.id).sort(), Object.keys(story.characters).sort(), s.name + ': cast');
    for (const a of f.actors) assert.ok(a.posture === 'standing' && !a.act && !a.passive && !a.speaking, s.name + ': ' + a.id + ' is not standing still');
    const view = buildSceneView(story, TITLE_SCENE);
    view.update(f);
    const boxes = view.boxes().slice();
    assert.equal(boxes.length, f.actors.length, s.name + ': every character is visible');
    for (const b of boxes) {
      assert.ok(Math.abs(b.body[3] - GY) <= 1, s.name + ': feet of ' + b.id + ' at y=' + b.body[3].toFixed(1));
      assert.ok(b.body[0] >= 0 && b.body[1] >= 0 && b.body[2] <= 1920 && b.body[3] <= 1080, s.name + ': ' + b.id + ' outside the canvas');
    }
    boxes.sort((a, b) => a.body[0] - b.body[0]);
    for (let i = 1; i < boxes.length; i++) assert.ok(boxes[i - 1].body[2] <= boxes[i].body[0], s.name + ': ' + boxes[i - 1].id + ' and ' + boxes[i].id + ' overlap');
  }
});

// one character with a loud emotion, then a reaction beat: during its pause nothing of the old loop moves
function pauseScript(kind, emotion) {
  const one = (id) => [{ id, set: 's', cast: [{ who: 'x', at: 'center' }], beats: [{ actor: 'x', emotion: 'happy' }] }];
  return {
    tcia: 1, meta: { title: 'Pause', slug: 'pause', lang: 'en', light: 'day' },
    characters: [{ id: 'x', name: 'X', kind }, { id: 'y', name: 'Y', kind: 'dog' }],
    sets: [{ id: 's', base: 'plain' }],
    scenes: [{ id: 'one', set: 's', cast: [{ who: 'x', at: 'center', emotion, intensity: 3 }, { who: 'y', at: 'right' }], beats: [
      { actor: 'x', emotion, intensity: 3, duration: 2 }, { actor: 'x', emotion: 'surprised', intensity: 2 },
      { actor: 'x', emotion, intensity: 3, duration: 1.5 }, { actor: 'x', emotion: 'happy', intensity: 1 }
    ] }].concat(one('two')),
    decisions: [{ id: 'd1', after: 'one', options: [{ id: 'a', label: 'A', rejoin: 'two' }, { id: 'b', label: 'B', rejoin: 'two' }] },
      { id: 'd2', after: 'two', options: [{ id: 'a', label: 'A', rejoin: '@endings' }, { id: 'b', label: 'B', rejoin: '@endings' }] }],
    endings: [{ id: 'e1', title: 'E1', when: { choice: 'd1', is: 'a' }, scenes: one('e1s') },
      { id: 'e2', title: 'E2', when: { choice: 'd2', is: 'a' }, scenes: one('e2s') }, { id: 'e3', title: 'E3', scenes: one('e3s') }]
  };
}

test('R5 (A59): in the pause before a reaction the root moves ≤ 1 px and the old emotion\'s effects freeze (angry 3, scared 3)', (t) => {
  let pauses = 0;
  for (const kind of ['boy', 'dog', 'bird']) {
    for (const emotion of ['angry', 'scared']) {
      const story = prepare(pauseScript(kind, emotion), catalog);
      const sc = story.scenes.one;
      const view = buildSceneView(story, 'one');
      const sv = view.actors.x;
      // every effect drawn for the character: [root key of the effect, keys inside it]
      const fxGroups = [];
      const collect = (n) => {
        if (!n || typeof n !== 'object') return;
        if (n.attrs['data-fx'] !== undefined && n.k) {
          const keys = [];
          walkTree(n, (c) => { if (c.k) keys.push(c.k); });
          fxGroups.push({ root: n.k, keys });
          return;
        }
        for (const c of n.children) collect(c);
      };
      collect(sv.view.tree);
      collect(sv.fxNode);
      assert.ok(fxGroups.length > 5, kind + ': effects found');
      for (const b of sc.beats) {
        if (!b.reaction) continue;
        pauses++;
        let first = null;
        for (let tt = b.start + 1e-3; tt < b.start + TAKE_PAUSE - 1e-3; tt += 1 / 120) {
          const upd = view.update(sampleScene(story, 'one', tt, tt));
          const m = /translate\(([^,]+),([^)]+)\)/.exec(upd[sv.key + ':root'].transform);
          const fx = {};
          // the visible effects of the character (head effects and motion lines), as drawn
          for (const g of fxGroups) {
            const u = upd[g.root];
            if (!u || u.display === 'none') continue;
            for (const k of g.keys) if (upd[k]) fx[k] = JSON.stringify(upd[k]);
          }
          const cur = { x: Number(m[1]), y: Number(m[2]), fx };
          if (!first) { first = cur; continue; }
          const label = kind + ' ' + emotion + ' 3 -> beat ' + b.index + ' @' + (tt - b.start).toFixed(3);
          assert.ok(Math.hypot(cur.x - first.x, cur.y - first.y) <= 1, label + ': root moved ' + Math.hypot(cur.x - first.x, cur.y - first.y).toFixed(2) + ' px');
          assert.deepEqual(Object.keys(fx).sort(), Object.keys(first.fx).sort(), label + ': effects appeared or went away during the pause');
          for (const k of Object.keys(fx)) assert.equal(fx[k], first.fx[k], label + ': ' + k + ' moved during the pause');
        }
      }
    }
  }
  t.diagnostic('pauses checked: ' + pauses);
  assert.ok(pauses >= 6);
});

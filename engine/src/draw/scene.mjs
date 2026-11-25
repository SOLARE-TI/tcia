// Scene view: builds every drawing of a scene once (scenery, cast, items, balloons, effects) and, for
// each frame from the player, returns the attribute updates { key: { attr: value } }. No DOM here.
// Composition rules (anexo «Composición»): characters in front of every piece, the actors of the
// current beats in front of the others, balloons placed away from every head, effects that never
// cross another character's head. Fluidity (anexo «Estilo afinado y fluidez»): poses and faces blend.
import { clamp, smooth, lerp, seededRandom, prepare, sampleScene, getScene, TITLE_SCENE } from '../core.mjs';
import { restPose, blendPose, posturePose, reactionPose, idlePose, settleAfter, applyEmotion, buildPoseTable, EMOTION_AMP, BLEND_MS, TAKE_PAUSE, GAIT_KEYS, settleFeet } from '../pose.mjs';
import { h, kg, num, mMul, mTrans, mScale, mRot, mApply, walkTree, pts, ngon, applyUpdates, measure, parseTransform, boxesCross, boxCross, boxArea, boxUnion } from './svg.mjs';
import { FACE_CLOSED, faceOpenness } from './face.mjs';
import { buildPerson, bipedUpdate } from './person.mjs';
import { buildQuadruped, quadUpdate, buildBird, birdUpdate } from './animal.mjs';
import { buildHeadFx, animHeadFx, buildMotionFx, animMotionFx } from './effects.mjs';
import { drawItem } from './items.mjs';
import { drawPiece, drawSky, drawBase } from './scenery.mjs';
import { buildBalloon, placeBalloon, balloonBoxes, balloonExtent, trackOffset, MAX_BODY_OVERLAP, MAX_TAIL_PX } from './balloon.mjs';

const POSE_CACHE = new WeakMap();
function poseTable(catalog) {
  let t = POSE_CACHE.get(catalog);
  if (!t) { t = buildPoseTable(catalog); POSE_CACHE.set(catalog, t); }
  return t;
}

export function rigUpdate(view, pose) {
  if (view.rig === 'biped') return bipedUpdate(view, pose);
  if (view.rig === 'quadruped') return quadUpdate(view, pose);
  return birdUpdate(view, pose);
}

// where a pose sits in the viewBox: root at (X, Y), squash, then the rotation about the pivot
export function rootMatrix(X, Y, sx, sy, rot, pivot) {
  return mMul(mMul(mMul(mMul(mTrans(X, Y), mScale(sx, sy)), mTrans(0, -pivot)), mRot(rot)), mTrans(0, pivot));
}

// Build a character, then measure how far its lying poses would sink, so they can rest on the ground
// with the head, the face and the hair above it (R4).
export function buildCharacter(ch, ctx) {
  let view;
  if (ch.rig === 'biped') view = buildPerson(ch, ctx);
  else if (ch.rig === 'quadruped') view = buildQuadruped(ch, ctx);
  else view = buildBird(ch, ctx);
  const GY = ctx.catalog.stage.groundY;
  const verR = view.tree.children[0];
  view.dims.lieLift = {};
  for (const lie of ['back', 'front', 'faint']) {
    const pose = posturePose(view.rig, 'lying', 0, lie, view.dims);
    pose.ver = 'R';
    const u = rigUpdate(view, pose);
    const M = rootMatrix(0, GY + (pose.y || 0), 1, 1, pose.rot || 0, pose.pivot || 0);
    const m = measure(verR, M, u.out);
    view.dims.lieLift[lie] = m.box ? Math.max(0, m.box[3] - GY) + 3 : 0;
  }
  // the static drawing already stands at rest, so its limbs, hands, feet and head are joined
  for (const ver of ['R', 'L']) {
    const pose = restPose(view.rig);
    pose.ver = ver;
    applyUpdates(view.tree, rigUpdate(view, pose).out);
  }
  return view;
}

function findKey(tree, key) {
  let found = null;
  walkTree(tree, (n) => { if (!found && n.k === key) found = n; });
  return found;
}

// face and effect geometry for an actor view (head-centred coordinates)
function fxGeometry(view) {
  const A = view.face;
  const d = view.dims;
  let r;
  let w;
  let headH;
  if (view.rig === 'biped') { r = d.headH / 2; w = d.headW / 2; headH = d.legL + d.torsoH + d.headH * 0.42; }
  else if (view.rig === 'quadruped') { r = d.headR; w = d.headR; headH = -d.neck[1]; }
  else { r = d.headR; w = d.headR; headH = -d.head[1]; }
  return {
    r, w, er: A.er, eye: [A.cx + A.ed, A.ey], eye2: [A.cx - A.ed, A.ey],
    mouth: [A.mx !== undefined ? A.mx : A.cx + A.ed * 0.3, A.my], ground: headH - A.my, hair: view.hair, hasRed1: view.rig === 'biped'
  };
}

export function standingHeight(view) {
  return view.dims.H;
}

// what an actor needs pre-built in this scene: faces, effects and the items it may hold
function actorNeeds(story, scene, id) {
  const cat = story.catalog;
  const faces = new Set(['neutral', 'wide']);
  const fx = new Set();
  for (const m of scene.emotionMarks[id]) {
    const lv = cat.emotions[m.emotion].levels[String(m.intensity)];
    faces.add(lv.face);
    for (const e of lv.effects) fx.add(e);
  }
  const items = new Set();
  const init = scene.initialActors[id];
  if (init.holding) items.add(init.holding);
  for (const iid of scene.items) for (const ev of scene.itemTracks[iid]) { if (ev.actor === id || ev.to === id) items.add(iid); }
  return { faces: Array.from(faces), fx: Array.from(fx), items: Array.from(items) };
}

function shadowNode(key, w, light) {
  const n = h('polygon', { points: pts(ngon(0, 0, w / 2, w * 0.09, 16)), fill: light.shadow.color, opacity: num(light.shadow.opacity) });
  return kg(key, {}, [n]);
}

// clouds go between the sky bands (and stars) and the sun or moon, so the celestial body stays readable
function skyWithClouds(sky, clouds) {
  const isBody = (n) => n.attrs['data-part'] === 'sun' || n.attrs['data-part'] === 'sunrays' || n.attrs['data-part'] === 'moon';
  return [h('g', sky.attrs, sky.children.filter((n) => !isBody(n)).concat(clouds, sky.children.filter(isBody)))];
}

export function buildSceneView(story, sceneId) {
  const cat = story.catalog;
  const scene = getScene(story, sceneId);
  const set = story.sets[scene.set];
  const light = cat.lights[scene.light];
  const stage = cat.stage;
  const ctx = { catalog: cat, light, far: false, farFade: stage.farFade };
  const fctx = Object.assign({}, ctx, { far: true });
  const GY = stage.groundY;

  // scenery
  const skyPieces = [];
  const farPieces = [];
  const backPieces = [];
  const frontPieces = [];
  const pieceShadows = [];
  set.pieces.forEach((p, i) => {
    const r = seededRandom('piece:' + scene.set + ':' + i);
    const flip = p.flip ? -1 : 1;
    if (p.layer === 'sky') {
      const y = 150 + r() * 170;
      skyPieces.push(h('g', { transform: 'translate(' + num(p.x) + ',' + num(y) + ') scale(' + num(flip * (0.85 + r() * 0.3)) + ',1)' }, [drawPiece(p.piece, p.variant, p.color, ctx)]));
    } else if (p.layer === 'far') {
      farPieces.push(h('g', { transform: 'translate(' + num(p.x) + ',' + num(stage.horizonY + 4) + ') scale(' + num(flip * stage.farScale) + ',' + num(stage.farScale) + ')' }, [drawPiece(p.piece, p.variant, p.color, fctx)]));
    } else {
      const node = h('g', { transform: 'translate(' + num(p.x) + ',' + num(GY) + ')' + (flip < 0 ? ' scale(-1,1)' : ''), 'data-piece-layer': p.layer }, [drawPiece(p.piece, p.variant, p.color, ctx)]);
      const def = cat.pieces[p.piece];
      if (p.piece !== 'rug' && p.piece !== 'water' && p.piece !== 'window') pieceShadows.push(h('g', { transform: 'translate(' + num(p.x) + ',' + num(GY) + ')' }, [h('polygon', { points: pts(ngon(0, 0, def.width * 0.55, def.width * 0.07, 16)), fill: light.shadow.color, opacity: num(light.shadow.opacity) })]));
      (p.layer === 'front' ? frontPieces : backPieces).push(node);
    }
  });
  const base = drawBase(set.base, ctx, fctx);

  // cast
  const actors = {};
  const actorNodes = [];
  const shadowNodes = [];
  const fxNodes = [];
  for (const id of scene.cast) {
    const ch = story.characters[id];
    const need = actorNeeds(story, scene, id);
    const fxFlags = {};
    for (const e of need.fx) fxFlags[e] = true;
    const key = 'a:' + id;
    const view = buildCharacter(ch, Object.assign({}, ctx, { faces: need.faces, fx: fxFlags, key }));
    const geo = fxGeometry(view);
    const faceBoxes = {};
    for (const ver of ['R', 'L']) {
      const pre = key + ':' + ver + ':';
      const slot = findKey(view.tree, pre + 'headfx');
      if (slot) slot.children.push(...buildHeadFx(Object.assign({ pre }, geo), need.fx, ctx));
      const held = findKey(view.tree, pre + 'held');
      if (held) {
        for (const iid of need.items) {
          const it = scene.initialItems[iid];
          const off = view.rig === 'biped' ? 'translate(' + num(view.dims.armW * 0.35) + ',' + num(view.dims.armW * 1.1) + ')' : '';
          held.children.push(kg(pre + 'held:' + iid, { display: 'none', transform: off || undefined }, [drawItem(it.item, ctx)]));
        }
      }
      // eye and mouth boxes of every face, for the morph when the emotion changes (A75)
      for (const f of need.faces) {
        const fb = {};
        for (const part of ['eyes', 'mouth']) {
          const n = findKey(view.tree, pre + part + ':' + f);
          const m = n ? measure(n, [1, 0, 0, 1, 0, 0], {}) : null;
          if (m && m.box) fb[part] = m.box;
        }
        faceBoxes[ver + f] = fb;
      }
    }
    const M = { H: view.dims.H, R: geo.r, legW: view.rig === 'biped' ? view.dims.legW : (view.dims.legW || 6) };
    const fxg = kg(key + ':fx', {}, buildMotionFx(key + ':fx:', M, ctx));
    const shW = view.rig === 'biped' ? view.dims.torsoW * 1.3 : (view.rig === 'quadruped' ? view.dims.BL * 1.05 : view.dims.H * 0.8);
    const sh = shadowNode(key + ':shadow', shW, light);
    actors[id] = { id, view, geo, need, key, M, ch, seed: sceneId + ':' + id, faceBoxes, fxNode: fxg };
    actorNodes.push(view.tree);
    shadowNodes.push(sh);
    fxNodes.push(fxg);
  }

  // items in the world (on the ground or flying)
  const itemNodes = [];
  for (const iid of scene.items) {
    const it = scene.initialItems[iid];
    itemNodes.push(kg('item:' + iid, { display: 'none' }, [drawItem(it.item, ctx)]));
  }

  // balloons
  const balloonNodes = {};
  const balloonList = [];
  for (const bl of scene.balloons) {
    const node = buildBalloon('bl:' + bl.beat, bl.kind, bl.lines, cat);
    balloonNodes[bl.beat] = node;
    balloonList.push(node);
  }

  const castLayer = kg('layer:cast', { 'data-layer': 'cast' }, actorNodes);
  const tree = h('g', { 'data-scene': sceneId }, [
    h('g', { 'data-layer': 'sky' }, skyWithClouds(drawSky(scene.light, ctx, scene.set), skyPieces)),
    h('g', { 'data-layer': 'far' }, base.children.filter((c) => c.attrs['data-base-far']).concat(farPieces)),
    h('g', { 'data-layer': 'ground' }, base.children.filter((c) => !c.attrs['data-base-far'])),
    h('g', { 'data-layer': 'shadows' }, pieceShadows.concat(shadowNodes)),
    h('g', { 'data-layer': 'back' }, backPieces),
    h('g', { 'data-layer': 'front' }, frontPieces),
    h('g', { 'data-layer': 'fx' }, fxNodes),
    castLayer,
    h('g', { 'data-layer': 'items' }, itemNodes),
    h('g', { 'data-layer': 'balloons' }, balloonList)
  ]);

  const poses = poseTable(cat);
  const view = { sceneId, tree, actors, balloonNodes, scene, story, poses, blendCache: new Map(), lastPose: {}, blendFrom: {}, balloonPlan: {}, lastBoxes: [], title: sceneId === TITLE_SCENE };
  if (view.title) view.titleLayout = titleLayout(view);
  view.update = (frame) => updateScene(view, frame);
  view.boxes = () => view.lastBoxes;
  // forget what was drawn (when the scene is shown again, or after planning the balloons)
  view.reset = () => { view.blendCache.clear(); view.lastPose = {}; view.blendFrom = {}; };
  planBalloons(view);
  view.reset();
  return view;
}

// ---------- title screen: every character in a row, feet on the ground line, boxes apart (R5) ----------

function titleLayout(view) {
  const cat = view.story.catalog;
  const GY = cat.stage.groundY;
  const ids = view.scene.cast;
  const widths = [];
  for (const id of ids) {
    const sv = view.actors[id];
    const pose = idlePose(sv.view.rig, { posture: 'standing', dims: sv.view.dims, clock: 0, seed: 'title', timing: cat.timing.idle });
    pose.ver = 'R';
    const u = rigUpdate(sv.view, pose);
    const m = measure(sv.view.tree.children[0], mTrans(0, GY), u.out);
    const box = m.box || [-50, GY - 100, 50, GY];
    // room for arms, tics and breathing
    widths.push({ id, left: -box[0] + 26, right: box[2] + 26 });
  }
  const gap = 36;
  let total = gap * (ids.length - 1);
  for (const w of widths) total += w.left + w.right;
  const scale = Math.min(1, 1820 / Math.max(1, total));
  let x = 960 - (total * scale) / 2;
  const out = {};
  widths.forEach((w, i) => {
    const cx = x + w.left * scale;
    out[w.id] = { x: cx, facing: cx < 960 ? 1 : -1, scale };
    x += (w.left + w.right + gap) * scale;
    if (i === 0 && ids.length === 1) out[w.id].facing = 1;
  });
  return out;
}

// ---------- per-frame solving ----------

function emotionFx(cat, actor, clockOverride, t) {
  const loops = {};
  const bursts = {};
  const lv = cat.emotions[actor.emotion].levels[String(actor.intensity)];
  const amp = EMOTION_AMP[actor.intensity] || 1;
  // when the emotion changes, the old loops (droop, shake, bounce...) fade out and the new ones fade in
  // during BLEND_MS, so the body never jumps
  let w = 1;
  if (actor.emotionPrev && t !== undefined) w = smooth(clamp((t - (actor.emotionSince || 0)) / (BLEND_MS / 1000), 0, 1));
  for (const e of lv.effects) if (cat.effects[e].phase === 'loop') loops[e] = amp * w;
  if (w < 1) {
    const plv = cat.emotions[actor.emotionPrev].levels[String(actor.intensityPrev)];
    const pamp = EMOTION_AMP[actor.intensityPrev] || 1;
    for (const e of plv.effects) if (cat.effects[e].phase === 'loop') loops[e] = (loops[e] || 0) + pamp * (1 - w);
  }
  for (const b of actor.bursts) {
    const blv = cat.emotions[b.emotion].levels[String(b.intensity)];
    for (const e of blv.effects) {
      const def = cat.effects[e];
      if (def.phase === 'burst' && b.t >= 0 && b.t < def.seconds) bursts[e] = { u: b.t / def.seconds, amp: EMOTION_AMP[b.intensity] || 1, t: b.t };
    }
  }
  return { loops, bursts, face: lv.face, amp, clock: clockOverride === undefined ? actor.clock : clockOverride };
}

// talking, thinking, waving or pointing while sitting or lying: the upper body acts, the posture stays
const UPPER_BODY = { talk: true, think: true, wave: true, point: true };
const UPPER_KEYS = {
  biped: ['aF', 'aB', 'wF', 'wB', 'hand'],
  quadruped: ['mouth', 'ears', 'tailWag'],
  bird: ['wingF', 'wingB', 'beak']
};

function onPosture(rig, base, act) {
  const out = base;
  // lying down, the limbs keep the posture (a gesture would go into the ground); the face still acts
  for (const k of UPPER_KEYS[rig]) {
    if (act[k] === undefined || (base.lie && k !== 'hand' && k !== 'mouth' && k !== 'beak')) continue;
    out[k] = Array.isArray(act[k]) ? act[k].slice() : act[k];
  }
  if (!base.lie) out.head = (base.head || 0) + (act.head || 0) * 0.5;
  out.face = Object.assign({}, base.face, act.face);
  out.fx = act.fx;
  out.phase = act.phase;
  out.sy = act.sy;
  out.sx = act.sx;
  return out;
}

// during the pause before a reaction (A59) the effects of the previous emotion freeze where they are
function frozenClock(a) {
  if (a.act && a.act.reaction && a.act.t < TAKE_PAUSE) return a.clock - a.act.t;
  return a.clock;
}

function rawPose(view, a, sv, frame) {
  const rig = a.rig;
  const dims = sv.view.dims;
  const cat = view.story.catalog;
  const timing = cat.timing.idle;
  const poses = view.poses;
  let pose;
  let idle = false;
  const byId = frame.byId;
  if (a.act && !a.act.reaction) {
    const act = a.act;
    const tgt = act.targetId && byId && byId[act.targetId] ? byId[act.targetId] : null;
    const c = {
      p: act.p, t: Math.max(0, act.t), dur: act.dur, dist: act.dist, heightPx: act.heightPx, dims, turning: act.turning,
      targetDx: act.targetX !== null ? (act.targetX - a.x) * a.facing : undefined,
      targetUp: tgt ? tgt.heightPx * 0.85 : 200,
      partnerDx: act.targetX !== null ? Math.abs(act.targetX - act.fromX) : 240,
      seatTo: act.seatTo
    };
    pose = poses[act.action].variants[act.variant][rig](c);
    if (!act.standUp && a.posture !== 'standing' && UPPER_BODY[act.action]) pose = onPosture(rig, posturePose(rig, a.posture, a.seatH, a.lie, dims), pose);
    if (act.standUp) {
      const from = posturePose(rig, act.standUp.from, act.standUp.seatH, act.standUp.lie, dims);
      const k = smooth(act.standUp.p);
      pose = blendPose(from, pose, k);
      pose.y = (pose.y || 0) - Math.sin(k * Math.PI) * 26;
      pose.sy = 1 + 0.08 * Math.sin(k * Math.PI);
      pose.sx = 1 / pose.sy;
      pose.fx = {};
    }
  } else if (a.act && a.act.reaction) {
    pose = reactionPose(rig, { p: a.act.p, t: a.act.t, dur: a.act.dur, dims }, a.emotion);
    if (a.posture !== 'standing') {
      const base = posturePose(rig, a.posture, a.seatH, a.lie, dims);
      base.sy = pose.sy; base.sx = pose.sx; base.face = Object.assign({}, base.face, pose.face);
      pose = base;
    }
  } else if (a.passive) {
    const pp = a.passive;
    if (pp.type === 'hugged') {
      pose = poses.hug.variants[pp.variant][rig]({ p: pp.p, t: Math.max(0, pp.t), dur: pp.dur, dims, partnerDx: Math.abs(pp.partnerX - a.x), passive: true });
      pose.sy = 1; pose.sx = 1;
    } else {
      pose = idlePose(rig, { posture: a.posture, seatH: a.seatH, lie: a.lie, dims, clock: a.clock, seed: sv.seed, timing });
      if (rig === 'biped' && a.posture !== 'lying') {
        const k = Math.sin(clamp((pp.p - 0.3) / 0.6, 0, 1) * Math.PI * 0.5) * (pp.p > 0.92 ? 1 - (pp.p - 0.92) / 0.08 : 1);
        pose.aF = [lerp(pose.aF[0], 75, k), lerp(pose.aF[1], 30, k)];
      } else if (rig === 'quadruped') pose.mouth = pp.p > 0.6 ? 0.5 : 0;
    }
  } else {
    pose = idlePose(rig, { posture: a.posture, seatH: a.seatH, lie: a.lie, dims, clock: a.clock, seed: sv.seed, timing });
    idle = true;
    if (a.lastAct) settleAfter(pose, rig, a.lastAct.action, a.lastAct.ended);
  }
  const emo = emotionFx(cat, a, frozenClock(a), frame.t);
  const freeze = a.act && a.act.reaction && a.act.t < TAKE_PAUSE;
  applyEmotion(pose, rig, freeze ? { loops: emo.loops, bursts: {} } : emo, emo.clock, idle);
  if (pose.sy > 1.35) pose.sy = 1.35;
  if (pose.sy < 0.7) pose.sy = 0.7;
  pose.sx = 1 / pose.sy;
  return { pose, idle, emo };
}

// the pose at the end of the previous segment (cached once per boundary)
function prevSegmentPose(view, a, sv, frame) {
  const key = a.id + '@' + a.segStart.toFixed(4);
  let pr = view.blendCache.get(key);
  if (pr) return pr;
  const t0 = a.segStart - 1e-4;
  const f0 = sampleScene(view.story, view.sceneId, t0, a.clock - (frame.t - t0));
  const a0 = f0.actors.find((x) => x.id === a.id);
  const by = {};
  for (const x of f0.actors) by[x.id] = x;
  f0.byId = by;
  pr = rawPose(view, a0, sv, f0).pose;
  if (view.blendCache.size > 400) view.blendCache.clear();
  view.blendCache.set(key, pr);
  return pr;
}

function solvePose(view, a, sv, frame) {
  const r = rawPose(view, a, sv, frame);
  // the core decides beat edges with a 1e-9 tolerance: use the same here
  const since = Math.max(0, frame.t - (a.segStart || 0) + 1e-9);
  const B = BLEND_MS / 1000;
  if (!view.title && a.segStart > 0 && since < B + TAKE_PAUSE) {
    const prev = blendSource(view, a, sv, frame);
    const reaction = a.act && a.act.reaction;
    if (since < B) {
      const k = smooth(since / B);
      const mixed = blendPose(prev, r.pose, k);
      for (const key of ['phase', 'fx', 'face', 'legs', 'wheel', 'hand', 'spin', 'gaitFeet', 'gaitInfo', 'hopInfo', 'kneeGuard']) mixed[key] = r.pose[key];
      // a walk or a run keeps its own feet: resting feet stay put while the body starts to move
      mixed.sy = lerp(prev.sy || 1, r.pose.sy || 1, k);
      mixed.sx = 1 / mixed.sy;
      if (r.pose.gaitFeet || r.pose.hopInfo) {
        for (const key of GAIT_KEYS) if (r.pose[key] !== undefined) mixed[key] = r.pose[key];
      }
      r.pose = mixed;
    }
    if (reaction) {
      // the root holds still through the pause, then eases into the take
      const rk = since < TAKE_PAUSE ? 0 : smooth((since - TAKE_PAUSE) / B);
      for (const key of ['x', 'y', 'rot', 'pivot']) r.pose[key] = lerp(prev[key] || 0, r.pose[key] || 0, rk);
    }
  }
  // the feet of a walk or a run are placed in the world: set them again for the final squash and height
  if (r.pose.gaitFeet) settleFeet(r.pose, sv.view.rig, sv.view.dims);
  view.lastPose[a.id] = { t: frame.t, segStart: a.segStart, pose: r.pose };
  return r;
}

// Where a blend starts: the pose drawn last for this character, when it was drawn just before (the page
// always plays forward), so nobody jumps at a beat boundary, acting or not; otherwise (a still, a seek)
// the pose the previous segment ends with.
function blendSource(view, a, sv, frame) {
  const held = view.blendFrom[a.id];
  if (held && held.segStart === a.segStart) return held.pose;
  const last = view.lastPose[a.id];
  let pose;
  if (last && last.segStart !== a.segStart && frame.t >= last.t && frame.t - last.t < 0.25) pose = last.pose;
  else pose = prevSegmentPose(view, a, sv, frame);
  view.blendFrom[a.id] = { segStart: a.segStart, pose };
  return pose;
}

function solveActor(view, a, frame) {
  const cat = view.story.catalog;
  const GY = cat.stage.groundY;
  const sv = view.actors[a.id];
  const v = sv.view;
  const visible = a.onstage || !!a.act;
  if (!visible) return { visible: false, sv, a };
  const { pose, idle, emo } = solvePose(view, a, sv, frame);
  let facing = a.facing;
  let tscale = 1;
  let x = a.x;
  if (view.title && view.titleLayout[a.id]) {
    const L = view.titleLayout[a.id];
    x = L.x; facing = L.facing; tscale = L.scale;
  }
  // facing: turn (core) times spin (pose) is a separate multiplier, so the squash keeps sx = 1/sy
  const m = a.turn * (pose.spin === undefined ? 1 : pose.spin);
  const S = (facing >= 0 ? 1 : -1) * (m >= 0 ? 1 : -1);
  const mag = Math.max(0.01, Math.abs(m));
  const ver = S > 0 ? 'R' : 'L';
  pose.ver = ver;
  const X = x + (pose.x || 0) * (facing >= 0 ? 1 : -1);
  const Y = GY + (pose.y || 0) * tscale;
  const pivot = pose.pivot || 0;
  const rot = pose.rot || 0;
  const sx = S * mag * pose.sx * tscale;
  const sy = pose.sy * tscale;
  // on the floor (lying, sitting on the ground, falling) the squash is anchored at the ground line, so
  // a stretch never pushes the head or the hair below it (R4); otherwise at the feet
  const grounded = a.posture === 'lying' || (a.posture === 'sitting' && !(a.seatH > 0)) || (a.act && a.act.action === 'fall');
  const O = grounded ? GY : Y;
  const lift = Math.round((Y - O) * 10) / 10;
  const rootTf = 'translate(' + num(X) + ',' + num(O) + ') scale(' + num4(sx) + ',' + num4(sy) + ')' + (lift ? ' translate(0,' + num(lift) + ')' : '') + (rot ? ' rotate(' + num(rot) + ',0,' + num(-pivot) + ')' : '');
  // measured with the numbers as drawn, so boxes in Node and in the page agree to the last digit
  const rootM = parseTransform(rootTf);
  const ru = rigUpdate(v, pose);
  return { visible: true, sv, a, pose, idle, emo, ver, X, Y, rootM, rootTf, ru, facing, tscale };
}

function measureActor(s) {
  const verNode = s.sv.view.tree.children[s.ver === 'R' ? 0 : 1];
  const u = s.ru.out[verNode.k];
  if (u && u.display === null) return measure(verNode, s.rootM, s.ru.out);
  // the facing in use is the one shown, whatever the drawing says on its own
  const upd = Object.assign({}, s.ru.out);
  upd[verNode.k] = { display: null };
  return measure(verNode, s.rootM, upd);
}

function frameById(frame) {
  const byId = {};
  for (const a of frame.actors) byId[a.id] = a;
  frame.byId = byId;
  return byId;
}

// actors whose beat is in progress go last (drawn in front), the others keep the cast order
function castOrder(view, frame) {
  const still = [];
  const acting = [];
  for (const id of view.scene.cast) {
    const a = frame.byId[id];
    (a && a.act ? acting : still).push('a:' + id + ':root');
  }
  return still.concat(acting).join(',');
}

function updateScene(view, frame) {
  const cat = view.story.catalog;
  const GY = cat.stage.groundY;
  const out = {};
  const byId = frameById(frame);
  const solved = {};
  for (const a of frame.actors) {
    const s = solveActor(view, a, frame);
    solved[a.id] = s;
    const sv = s.sv;
    out[sv.key + ':root'] = { display: s.visible ? null : 'none' };
    out[sv.key + ':shadow'] = { display: s.visible ? null : 'none' };
    out[sv.key + ':fx'] = { display: s.visible ? null : 'none' };
    if (!s.visible) continue;
    const { pose, idle, emo, ver, X, rootM } = s;
    const a2 = a;
    out[sv.key + ':root'].transform = s.rootTf;
    out[sv.key + ':R:ver'] = { display: ver === 'R' ? null : 'none' };
    out[sv.key + ':L:ver'] = { display: ver === 'L' ? null : 'none' };
    Object.assign(out, s.ru.out);
    const pre = s.ru.pre;
    if (a2.rig === 'biped') {
      out[pre + 'handFfinger'] = { display: pose.hand === 'point' ? null : 'none' };
      out[pre + 'wheel'] = { display: pose.legs === 'blur' ? null : 'none', transform: 'rotate(' + num(((pose.wheel || 0) * 360) % 360) + ')' };
      for (const k of ['legF', 'legB', 'shortsF', 'shortsB', 'footF', 'footB']) {
        for (const suf of [':ink', ':fill', ':hi', '']) { const kk = pre + k + suf; if (out[kk]) out[kk].display = pose.legs === 'blur' ? 'none' : null; }
      }
    }
    if (a2.rig === 'bird') {
      const open = (pose.beak || 0) > 0.4 || faceOpenness(emo.face) > 0.6 || (a2.speaking && a2.speaking.kind === 'speech' && Math.floor(a2.speaking.age * 8) % 2 === 0);
      out[pre + 'beak0'] = { display: open ? 'none' : null };
      out[pre + 'beak1'] = { display: open ? null : 'none' };
    }
    updateFace(out, sv, a2, pose, emo, pre, frame, cat);
    const F = Object.assign({ pre }, sv.geo);
    for (const e of sv.need.fx) {
      const loopAmp = emo.loops[e];
      const b = emo.bursts[e];
      const st = { on: !!(loopAmp || b), t: emo.clock - (a2.emotionSince || 0) + 10, u: b ? b.u : 0, amp: b ? b.amp : (loopAmp || 1), clock: emo.clock, idle };
      animHeadFx(F, e, st, out);
    }
    // world-level comic effects (drawn behind the cast)
    const fsign = s.facing >= 0 ? 1 : -1;
    const hp = mApply(rootM, s.ru.joints.head);
    out[sv.key + ':fx'].transform = 'translate(' + num(X) + ',' + num(GY) + ') scale(' + fsign + ',1)';
    const la = a2.lastAct;
    const lyingAfterFall = a2.posture === 'lying' && la && la.action === 'fall' && la.ended < 3.5;
    const fx = pose.fx || {};
    const ms = {
      speed: fx.speed || 0,
      dust: fx.dust || (idle && la && ((la.action === 'run' && la.ended < 0.35) || (la.action === 'jump' && la.ended < 0.2))) ? 1 : 0,
      dustT: a2.clock, skid: fx.skid || (idle && la && la.action === 'run' && la.ended < 0.35) ? 1 : 0,
      shout: fx.shout || 0, bark: fx.bark || 0,
      impact: a2.act && a2.act.action === 'fall' && pose.phase === 'follow' ? clamp((a2.act.p - 0.8) / 0.2, 0, 0.99) : -1,
      dizzy: fx.dizzy || lyingAfterFall ? a2.clock : -1,
      idea: fx.idea !== undefined ? fx.idea : -1,
      tremble: fx.tremble || 0,
      head: [(hp[0] - X) * fsign, hp[1] - GY], clock: a2.clock
    };
    animMotionFx(sv.key + ':fx:', sv.M, ms, out);
    // shadow
    const lift = clamp(-(pose.y || 0) / 420, 0, 0.6);
    const lying = a2.posture === 'lying' || Math.abs((pose.rot || 0) % 180) > 45;
    out[sv.key + ':shadow'].transform = 'translate(' + num(X) + ',' + num(GY) + ') scale(' + num((1 - lift) * (lying ? 1.5 : 1) * s.tscale) + ',' + num(1 - lift) + ')';
    for (const iid of sv.need.items) {
      for (const vv of ['R', 'L']) out[sv.key + ':' + vv + ':held:' + iid] = { display: vv === ver && a2.holding && a2.holding.id === iid ? null : 'none' };
    }
  }
  out['layer:cast'] = { $order: castOrder(view, frame) };
  if (view.trackJoints) view.lastJoints = trackedJoints(view, solved);
  // boxes of every visible character (body and head), measured on this frame's drawing
  const boxes = [];
  const meas = {};
  for (const id of view.scene.cast) {
    const s = solved[id];
    if (!s || !s.visible) continue;
    const m = measureActor({ sv: s.sv, ver: s.ver, rootM: s.rootM, ru: { out } });
    meas[id] = m;
    boxes.push({ id, body: m.box, head: m.head });
  }
  // effects never cross the head of another character (A68)
  for (const id of Object.keys(meas)) {
    const own = meas[id].fx.concat(measure(view.actors[id].fxNode, [1, 0, 0, 1, 0, 0], out).fx);
    for (const f of own) {
      if (!f.key || !f.b) continue;
      for (const other of boxes) {
        if (other.id === id) continue;
        const hd = other.head;
        if (boxesCross(f.b, [hd[0] - 2, hd[1] - 2, hd[2] + 2, hd[3] + 2])) { out[f.key] = Object.assign(out[f.key] || {}, { display: 'none' }); break; }
      }
    }
  }
  view.lastBoxes = boxes;
  // items in the world
  for (const it of frame.items) {
    const key = 'item:' + it.id;
    const size = cat.items[it.item].size;
    if (it.flight) {
      const A = solved[it.flight.from];
      const B = solved[it.flight.to];
      const handOf = (s) => (s && s.visible ? mApply(mMul(s.rootM, s.ru.joints.handM || s.ru.joints.mouthM), s.sv.view.rig === 'biped' ? [s.sv.view.dims.armW * 0.35, s.sv.view.dims.armW * 1.1] : [0, 0]) : [0, GY]);
      const pa = handOf(A);
      const pb = handOf(B);
      const u = smooth(it.flight.u);
      const x = lerp(pa[0], pb[0], u);
      const y = lerp(pa[1], pb[1], u) - it.flight.arc * 4 * u * (1 - u);
      out[key] = { display: null, transform: 'translate(' + num(x) + ',' + num(y) + ') rotate(' + num(it.flight.arc ? u * 360 : 0) + ')' };
    } else if (!it.holder && it.x !== null) {
      out[key] = { display: null, transform: 'translate(' + num(it.x + 40) + ',' + num(GY - size / 2 + 4) + ')' };
    } else out[key] = { display: 'none' };
  }
  // balloon (one at a time), placed by the plan made when the scene was built
  for (const k of Object.keys(view.balloonNodes)) out['bl:' + k] = { display: 'none' };
  const bl = frame.balloon;
  if (bl && view.balloonNodes[bl.beat] && solved[bl.actor] && solved[bl.actor].visible && meas[bl.actor]) {
    const plan = view.balloonPlan[bl.beat] || { cx: 960, top: 24 };
    const a = byId[bl.actor];
    const off = trackOffset(plan.track, bl.age);
    const k = plan.k || [1, 1];
    placeBalloon(view.balloonNodes[bl.beat], bl.kind, plan, [off[0] * k[0], off[1] * k[1]], meas[bl.actor].head, bl.age, bl.left, out);
  }
  return out;
}

// joints in viewBox coordinates, plus the sole of every foot (tests of A72, A76, A77)
function trackedJoints(view, solved) {
  const res = {};
  for (const id of Object.keys(solved)) {
    const s = solved[id];
    if (!s.visible) continue;
    const J = s.ru.joints;
    const pts0 = {};
    const local = {};
    const hidden = s.pose.legs === 'blur';
    for (const k of Object.keys(J)) {
      const v = J[k];
      if (!Array.isArray(v) || /M$/.test(k)) continue;
      if (hidden && /^(hip|knee|ankle)/.test(k)) continue;
      if (Array.isArray(v[0])) v.forEach((q, i) => { pts0[k + i] = mApply(s.rootM, q); local[k + i] = q; });
      else { pts0[k] = mApply(s.rootM, v); local[k] = v; }
    }
    const d = s.sv.view.dims;
    const soles = {};
    const sy = s.rootM[3];
    if (s.sv.view.rig === 'biped' && !hidden) { for (const f of ['F', 'B']) soles['foot' + f] = mApply(s.rootM, [J['ankle' + f][0], J['ankle' + f][1] + d.ankleY]); }
    if (s.sv.view.rig === 'quadruped') { for (const f of ['FF', 'FB', 'BF', 'BB']) soles['paw' + f] = mApply(s.rootM, [J['paw' + f][0], J['paw' + f][1] + d.legW / 2 + 4.5]); }
    if (s.sv.view.rig === 'bird') { for (const f of ['F', 'B']) soles['foot' + f] = mApply(s.rootM, [J['foot' + f][0], J['foot' + f][1] + d.legW / 2 + 4.5]); }
    res[id] = { joints: pts0, local, soles, rootX: s.X, rootY: s.Y, act: s.a.act ? { action: s.a.act.action, variant: s.a.act.variant, beat: s.a.act.beat, phase: s.pose.phase } : null, sy };
  }
  return res;
}

function num4(v) { const x = Math.round(v * 1000) / 1000; return (Object.is(x, -0) ? 0 : x).toString(); }

const TALK_SEQ = [0, 2, 1, 2, 0, 1];

function scaleAbout(box, sx, sy) {
  const cx = (box[0] + box[2]) / 2;
  const cy = (box[1] + box[3]) / 2;
  return 'translate(' + num(cx) + ',' + num(cy) + ') scale(' + num4(sx) + ',' + num4(sy) + ') translate(' + num(-cx) + ',' + num(-cy) + ')';
}

function updateFace(out, sv, a, pose, emo, pre, frame, cat) {
  const faces = sv.need.faces;
  let face = emo.face;
  const pf = pose.face || {};
  if (pf.eyes === 'wide' && faces.indexOf('wide') >= 0 && face === 'neutral') face = 'wide';
  // when the emotion changes (at the end of the A59 pause) the new face starts at the old eye and mouth
  // sizes and grows or shrinks to its own during BLEND_MS (A75)
  const B = BLEND_MS / 1000;
  const since = frame.t - (a.emotionSince || 0);
  let oldFace = null;
  if (a.emotionPrev && since >= 0 && since < B) {
    const lv = cat.emotions[a.emotionPrev].levels[String(a.intensityPrev)];
    oldFace = lv ? lv.face : null;
  }
  const showFace = face;
  const fbNew = sv.faceBoxes[(pre.indexOf(':L:') >= 0 ? 'L' : 'R') + face] || {};
  const fbOld = oldFace && oldFace !== face ? sv.faceBoxes[(pre.indexOf(':L:') >= 0 ? 'L' : 'R') + oldFace] : null;
  const size = (b, i) => Math.max(1, b[i + 2] - b[i]);
  for (const part of ['eyes', 'mouth']) {
    const b1 = fbNew[part];
    const b0 = fbOld ? fbOld[part] : null;
    if (!b1 || !b0) { out[pre + part + ':' + face] = { transform: null }; continue; }
    const u = smooth(since / B);
    const kx = lerp(size(b0, 0) / size(b1, 0), 1, u);
    const ky = lerp(size(b0, 1) / size(b1, 1), 1, u);
    out[pre + part + ':' + face] = { transform: scaleAbout(b1, kx, ky) };
  }
  for (const f of faces) out[pre + 'face:' + f] = { display: f === showFace ? null : 'none' };
  const closed = pf.eyes === 'closed' && !FACE_CLOSED[showFace];
  const popping = !!emo.bursts.eyes_pop;
  const jaw = !!emo.bursts.jaw_drop;
  out[pre + 'eyes:' + showFace] = Object.assign(out[pre + 'eyes:' + showFace] || {}, { display: closed || popping ? 'none' : null });
  out[pre + 'blink'] = { display: closed && !popping ? null : 'none' };
  let talk = null;
  if (a.speaking && a.speaking.kind === 'speech' && !jaw) {
    if (pf.talk === 'shout') talk = 'shout';
    else if (pf.talk === 'whisper') talk = 'whisper';
    else talk = 'talk' + TALK_SEQ[Math.floor(a.speaking.age * 8) % TALK_SEQ.length];
  } else if (a.rig === 'quadruped' && (pose.mouth || 0) > 0.3) talk = pose.mouth > 0.7 ? 'talk2' : 'talk1';
  if (a.rig !== 'bird') {
    for (const k of ['talk0', 'talk1', 'talk2', 'shout', 'whisper']) out[pre + k] = { display: k === talk ? null : 'none' };
    out[pre + 'mouth:' + showFace] = Object.assign(out[pre + 'mouth:' + showFace] || {}, { display: talk || jaw ? 'none' : null });
  }
  let look = pf.look || [0, 0];
  if (pf.eyes === 'up') look = [0.3, -1];
  if (showFace === 'worried') look = [Math.sin(emo.clock * 5 * Math.PI * 2) > 0 ? 1 : -1, 0];
  const er = sv.view.face.er;
  out[pre + showFace + ':pupils'] = { transform: 'translate(' + num(look[0] * er * 0.35) + ',' + num(look[1] * er * 0.35) + ')' };
}

// ---------- balloons: choose a place, for the whole beat, away from every head (R2) ----------

const FOLLOW_SMOOTH = 1;
// how much of the head's motion the balloon follows, across and up and down (all, half, one way, none)
const FOLLOWS = [[1, 1], [0.5, 0.5], [1, 0], [0, 1], [0.5, 1], [1, 0.5], [0.5, 0], [0, 0.5], [0, 0]];

function planBalloons(view) {
  const story = view.story;
  const cat = story.catalog;
  const scene = view.scene;
  for (const bl of scene.balloons) {
    const node = view.balloonNodes[bl.beat];
    const samples = [];
    const step = 1 / 15;
    for (let t = bl.start; t < bl.end + 1e-9; t += step) samples.push(Math.min(t, bl.end - 1e-4));
    if (samples[samples.length - 1] < bl.end - 2e-4) samples.push(bl.end - 1e-4);
    const frames = [];
    for (const t of samples) {
      const f = sampleScene(story, view.sceneId, t, t);
      frameById(f);
      const per = [];
      let speaker = null;
      for (const a of f.actors) {
        const s = solveActor(view, a, f);
        if (!s.visible) continue;
        const m = measureActor(s);
        // idle hops and jitters change with the clock: pad the boxes a little
        const pad = 6;
        const headB = m.head ? [m.head[0] - pad, m.head[1] - pad - (s.idle ? 36 : 0), m.head[2] + pad, m.head[3] + pad] : null;
        per.push({ id: a.id, head: headB, raw: m.head, body: m.box });
        if (a.id === bl.actor) speaker = { x: a.x, head: headB, raw: m.head };
      }
      if (speaker && speaker.head) frames.push({ per, speaker, age: t - bl.start });
    }
    // between two samples a head can move or spin: each padded head also covers its neighbours
    const swept = frames.map((fr, i) => fr.per.map((o) => {
      if (!o.head) return o.head;
      let b = o.head;
      for (const j of [i - 1, i + 1]) {
        const q = frames[j] && frames[j].per.find((x) => x.id === o.id);
        if (q && q.raw) b = boxUnion(b, [q.raw[0] - 6, q.raw[1] - 6, q.raw[2] + 6, q.raw[3] + 6]);
      }
      return b;
    }));
    frames.forEach((fr, i) => fr.per.forEach((o, k) => {
      if (fr.speaker.head === o.head) fr.speaker.head = swept[i][k];
      o.head = swept[i][k];
    }));
    // the balloon follows the speaker's head, smoothly: the head's centre (a 1-2-1 average over the
    // neighbouring samples),
    // relative to where it starts (so a jump or a run takes the balloon along and the tail stays short)
    const centres = frames.map((fr) => [(fr.speaker.raw[0] + fr.speaker.raw[2]) / 2, (fr.speaker.raw[1] + fr.speaker.raw[3]) / 2]);
    const smoothC = centres.map((c, i) => {
      let x = 0;
      let y = 0;
      let n = 0;
      for (let j = Math.max(0, i - FOLLOW_SMOOTH); j <= Math.min(centres.length - 1, i + FOLLOW_SMOOTH); j++) {
        const wgt = j === i ? 2 : 1;
        x += centres[j][0] * wgt; y += centres[j][1] * wgt; n += wgt;
      }
      return [x / n, y / n];
    });
    const track = { ages: frames.map((fr) => fr.age), offs: smoothC.map((c) => [c[0] - smoothC[0][0], c[1] - smoothC[0][1]]) };
    frames.forEach((fr, i) => {
      fr.off = track.offs[i];
      // how far the head moves to the next sample: in between, the tail can stretch by about that much
      const nx = centres[Math.min(centres.length - 1, i + 1)];
      const pv = centres[Math.max(0, i - 1)];
      fr.drift = Math.max(Math.hypot(nx[0] - centres[i][0], nx[1] - centres[i][1]), Math.hypot(pv[0] - centres[i][0], pv[1] - centres[i][1]));
    });
    const plan = chooseBalloon(view, node, bl, frames);
    plan.track = track;
    view.balloonPlan[bl.beat] = plan;
  }
}

function distToBox(p, b) {
  return Math.hypot(Math.max(b[0] - p[0], 0, p[0] - b[2]), Math.max(b[1] - p[1], 0, p[1] - b[3]));
}

// Candidates: above the head, higher than its highest point, or at the top, each centred, to the left
// or to the right, with the tail pointing down at the head; and beside the head, left or right, with
// the tail pointing at its side. Each one is tried on every sampled frame of the beat.
function chooseBalloon(view, node, bl, frames) {
  const w = node.bw;
  const hh = node.bh;
  if (!frames.length) return { cx: 960, top: 24, evaluated: 1, level: 'top', side: 'center' };
  const first = frames[0].speaker;
  const headW = first.raw[2] - first.raw[0];
  const hx0 = (first.raw[0] + first.raw[2]) / 2;
  const highest = Math.min(...frames.map((q) => q.speaker.head[1]));
  const cands = [];
  for (const level of ['above', 'higher', 'top']) {
    for (const side of ['center', 'left', 'right']) {
      const dx = side === 'center' ? 0 : (side === 'left' ? -1 : 1) * (w / 2 + headW / 2 + 24);
      const top = level === 'above' ? first.head[1] - 40 - hh : (level === 'higher' ? highest - 60 - hh : 24);
      cands.push({ cx: hx0 + dx, top: Math.max(24, top), level, side });
    }
  }
  // beside the head, its middle level with the head's middle at the start, on average, or at its highest
  const ext = balloonExtent(w, hh, bl.kind);
  const mids = frames.map((q) => (q.speaker.raw[1] + q.speaker.raw[3]) / 2);
  const levels = { beside: mids[0], 'beside-mean': mids.reduce((a, b) => a + b, 0) / mids.length, 'beside-high': Math.min(...mids) };
  for (const side of ['left', 'right']) {
    const cx = side === 'left' ? first.raw[0] - 30 - ext[0] : first.raw[2] + 30 + ext[0];
    for (const level of Object.keys(levels)) cands.push({ cx, top: levels[level] - hh / 2, level, side });
  }
  let best = null;
  let evaluated = 0;
  const tryPlan = (plan, order) => {
    evaluated++;
    let headHits = 0;
    let tipBad = 0;
    let worst = 0;
    let outside = 0;
    let reach = 0;
    for (const fr of frames) {
      const off = fr.off ? [fr.off[0] * plan.k[0], fr.off[1] * plan.k[1]] : [0, 0];
      const B = balloonBoxes(w, hh, bl.kind, plan, off, fr.speaker.raw, 1.05);
      // (a head leaving the canvas cannot be followed: the balloon stays on the canvas)
      const inside = fr.speaker.raw[0] >= 0 && fr.speaker.raw[2] <= 1920 && fr.speaker.raw[1] >= 0;
      // (with room for the way the head moves between two samples)
      if (B.tailLen + 0.3 * (fr.drift || 0) > MAX_TAIL_PX - 15 && inside) tipBad++;
      // the balloon stays on the canvas (its tail may point out, at a speaker leaving it)
      if (B.box[0] < 0 || B.box[2] > 1920 || B.box[1] < 0 || B.box[3] > 1080) outside++;
      const own = distToBox(B.tip, fr.speaker.raw);
      // a head out of the canvas cannot be reached: then the tail only has to point its way
      const inCanvas = fr.speaker.raw[2] > 0 && fr.speaker.raw[0] < 1920 && fr.speaker.raw[3] > 0;
      if (own > 60 && inCanvas) tipBad++;
      reach += (B.tail[2] - B.tail[0]) + (B.tail[3] - B.tail[1]);
      for (const o of fr.per) {
        const mine = o.head === fr.speaker.head;
        // the balloon and its tail, each by its own box, never over a head; the tail comes close to its own
        // head (checked against the head itself), never to another
        if (boxesCross(B.box, o.head) || boxesCross(B.tail, mine ? o.raw : o.head)) headHits++;
        // (clearly nearer its own head: between two samples the heads keep moving)
        if (!mine && o.raw && distToBox(B.tip, o.raw) <= own + 30) tipBad++;
        // the share of a body box under the balloon and under its tail, each by its own box (over the
        // speaker's own body only the balloon counts: its tail is meant to reach it)
        if (o.body) worst = Math.max(worst, (boxCross(B.box, o.body) + (mine ? 0 : boxCross(B.tail, o.body))) / Math.max(1, boxArea(o.body)));
      }
    }
    // breaking a rule weighs far more than anything else; then a short tail, then the order of preference
    const score = (headHits + tipBad) * 1e6 + outside * 1e5 + (worst > MAX_BODY_OVERLAP ? 1e4 : 0) + worst * 100 + (reach / frames.length) * 0.01 + order * 0.5;
    const r = { score, plan, headHits, tipBad, worst, outside };
    tried.push(r);
    if (!best || score < best.score) best = r;
  };
  const tried = [];
  // each place, with the balloon following the head all the way, half way, or staying put
  let order = 0;
  for (const c of cands) for (const k of FOLLOWS) tryPlan(Object.assign({ k }, c), order++);
  // nothing clean near the head (a crowd, a big jump): search the whole free sky and the sides
  if (best.headHits || best.tipBad || best.outside || best.worst > MAX_BODY_OVERLAP) {
    for (let dx = -800; dx <= 800; dx += 100) {
      for (let top = 24; top + hh < 900; top += 60) for (const k of FOLLOWS) tryPlan({ k, cx: hx0 + dx, top, level: 'free', side: dx < 0 ? 'left' : (dx > 0 ? 'right' : 'center') }, 60);
    }
  }
  // still nothing clean: nudge the few places that only just fail
  if (best.headHits || best.tipBad || best.outside || best.worst > MAX_BODY_OVERLAP) {
    const near = tried.filter((r) => !r.headHits && !r.outside && r.worst <= MAX_BODY_OVERLAP).sort((a, b) => a.tipBad - b.tipBad).slice(0, 6);
    for (const r of near) {
      for (const dxn of [-50, -25, 25, 50]) for (const dyn of [-30, -15, 0, 15, 30]) tryPlan(Object.assign({}, r.plan, { cx: r.plan.cx + dxn, top: r.plan.top + dyn }), 80);
    }
  }
  const P = best.plan;
  return { cx: P.cx, top: P.top, k: P.k, level: P.level, side: P.side, evaluated, headHits: best.headHits, tipBad: best.tipBad, worstBody: best.worst, frames: frames.length };
}

// ---------- stills (Node): build a scene, sample it at time t and return the finished tree ----------

export function renderFrameTree(view, frame) {
  return applyUpdates(view.tree, view.update(frame));
}

export function renderStill(catalog, script, sceneId, t, clock) {
  const story = prepare(script, catalog);
  const sid = sceneId || story.main[0];
  const view = buildSceneView(story, sid);
  const frame = sampleScene(story, sid, t, clock === undefined ? t : clock);
  return renderFrameTree(view, frame);
}


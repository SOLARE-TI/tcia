// Animals: dogs and cats (rig "quadruped") and birds (rig "bird"). Same idea as people: heads and bodies
// are built once per scene and per facing; legs, necks and tails are continuous shapes written every frame.
import { clamp, lerp } from '../core.mjs';
import { h, kg, part, multiPart, paint, ngon, INK, mix, num, inkLine, mMul, mTrans, mRot, mApply, matStr, limb, limbPoints, snap, roundPoly } from './svg.mjs';
import { drawFace, drawBlink, drawTalkMouths } from './face.mjs';
import { shadeTones, ikJoint } from './person.mjs';

// ---------- quadruped ----------

export function quadDims(kindId, look, catalog) {
  const kind = catalog.kinds[kindId];
  const H = kind.heightPx[look.size] || kind.heightPx.medium || kind.heightPx.small;
  const cat = kindId === 'cat';
  const legL = H * (cat ? 0.3 : 0.3);
  const BL = H * (cat ? 0.92 : 0.9);
  const BH = H * (cat ? 0.34 : 0.4);
  const bodyCY = -(legL + BH * 0.32);
  const legW = H * (cat ? 0.12 : 0.135);
  // standing, a leg is almost straight: hip to paw is 97 % of its two segments (a slight bend at the knee)
  const seg = (legL - (legW / 2 + 4.5)) / 2 / 0.97;
  return {
    rig: 'quadruped', H, cat, legL, seg, BL, BH, bodyCY,
    hipF: [BL * 0.28, -legL], hipB: [-BL * 0.3, -legL],
    neck: [BL * 0.4, bodyCY - BH * 0.3], headR: H * (cat ? 0.29 : 0.3),
    legW, tailRoot: [-BL * 0.4, bodyCY - BH * 0.18],
    headOff: [H * 0.06, -H * (cat ? 0.17 : 0.15)]
  };
}

function quadFaceAnchor(d, ctx) {
  const r = d.headR;
  const snout = !d.cat;
  return {
    cx: r * 0.22, ey: -r * 0.18, ed: r * 0.3, er: r * 0.24, by: -r * 0.18 - r * 0.42,
    my: snout ? r * 0.52 : r * 0.42, mx: snout ? r * 0.86 : r * 0.42, mw: r * (snout ? 0.6 : 0.5), lw: Math.max(2.2, r * 0.05),
    white: paint(['#FFFFFF'], ctx)[0], whiteShade: paint(['#D9DEE6'], ctx)[0],
    mouth: paint(ctx.catalog.palettes.materials.mouth.tones, ctx), brow: INK, beak: false
  };
}

function quadVersion(ch, d, P, lx, ctx, pre) {
  const look = ch.look;
  const o = { lx, sw: 3.5 };
  const far = shadeTones(P.coat);
  const leg = (side, tones) => limb(pre + 'leg' + side, 'leg' + side, d.legW, tones);
  const pr = d.legW / 2 + 4.5;
  const paw = (side, tones) => kg(pre + 'paw' + side, {}, [part('paw' + side, roundPoly([[-pr * 1.05, -pr], [pr * 1.55, -pr], [pr * 1.55, pr], [-pr * 1.05, pr]], pr * 0.5, 3), tones, Object.assign({ flat: true, flatTone: 0 }, o))]);
  // body
  const BL = d.BL;
  const BH = d.BH;
  const cy = d.bodyCY;
  const body = roundPoly(d.cat
    ? [[-BL * 0.5, cy - BH * 0.2], [-BL * 0.3, cy - BH * 0.5], [BL * 0.28, cy - BH * 0.52], [BL * 0.5, cy - BH * 0.18], [BL * 0.44, cy + BH * 0.42], [BL * 0.16, cy + BH * 0.52], [-BL * 0.3, cy + BH * 0.5], [-BL * 0.5, cy + BH * 0.2]]
    : [[-BL * 0.5, cy - BH * 0.24], [-BL * 0.28, cy - BH * 0.5], [BL * 0.26, cy - BH * 0.56], [BL * 0.5, cy - BH * 0.2], [BL * 0.46, cy + BH * 0.36], [BL * 0.18, cy + BH * 0.5], [-BL * 0.32, cy + BH * 0.48], [-BL * 0.52, cy + BH * 0.18]], BH * 0.18, 3);
  const bodyKids = [part('body', body, P.coat, o)];
  if (look.pattern === 'spots') {
    bodyKids.push(multiPart('spots', [ngon(-BL * 0.18, cy - BH * 0.12, BL * 0.1, BH * 0.22, 16), ngon(BL * 0.16, cy - BH * 0.22, BL * 0.07, BH * 0.15, 16), ngon(-BL * 0.38, cy + BH * 0.1, BL * 0.06, BH * 0.14, 16)], P.mark, { lx, flat: true, flatTone: 1, outline: false }));
  }
  if (look.pattern === 'stripes') {
    const stripes = [];
    for (const f of [-0.32, -0.14, 0.04, 0.22]) stripes.push([[BL * f, cy - BH * 0.5], [BL * (f + 0.07), cy - BH * 0.48], [BL * (f + 0.03), cy + BH * 0.05], [BL * (f - 0.02), cy + BH * 0.05]]);
    bodyKids.push(multiPart('stripes', stripes, P.mark, { lx, flat: true, flatTone: 2, outline: false }));
  }
  if (look.accessory === 'collar' || look.accessory === 'bandana') {
    const r0 = d.headR;
    const nx = d.neck[0];
    const ny = d.neck[1];
    const band = [[nx - r0 * 0.4, ny - r0 * 0.22], [nx + r0 * 0.3, ny - r0 * 0.36], [nx + r0 * 0.38, ny - r0 * 0.12], [nx - r0 * 0.34, ny + r0 * 0.04]];
    bodyKids.push(part('accessory', band, P.acc, Object.assign({ flat: true }, o)));
    if (look.accessory === 'bandana') bodyKids.push(part('accessory_tip', [[nx - r0 * 0.2, ny - r0 * 0.1], [nx + r0 * 0.3, ny - r0 * 0.2], [nx + r0 * 0.1, ny + r0 * 0.42]], P.acc, o));
    else bodyKids.push(part('tag', ngon(nx + r0 * 0.05, ny + r0 * 0.06, r0 * 0.11, r0 * 0.11, 16), ['#FFE27A', '#F7C948', '#D19E2A'], { lx, sw: 2.5 }));
  }
  // head
  const r = d.headR;
  const head = [];
  const earsK = pre + 'ears';
  const pointy = d.cat || look.ears === 'pointy';
  const earBack = pointy
    ? [[-r * 0.62, -r * 0.5], [-r * 0.5, -r * 1.42], [-r * 0.1, -r * 0.8]]
    : roundPoly([[-r * 0.62, -r * 0.62], [-r * 0.2, -r * 0.84], [-r * 0.5, r * 0.36], [-r * 0.86, r * 0.22]], r * 0.12, 3);
  const earFront = pointy
    ? [[r * 0.0, -r * 0.82], [r * 0.24, -r * 1.48], [r * 0.5, -r * 0.62]]
    : roundPoly([[-r * 0.38, -r * 0.86], [r * 0.02, -r * 0.9], [-r * 0.16, r * 0.3], [-r * 0.5, r * 0.36], [-r * 0.6, r * 0.04]], r * 0.12, 3);
  head.push(kg(earsK + 'B', {}, [part('earB', earBack, shadeTones(P.coat), o)]));
  const skull = roundPoly(d.cat
    ? [[-r * 0.8, -r * 0.4], [-r * 0.3, -r * 0.88], [r * 0.4, -r * 0.86], [r * 0.82, -r * 0.3], [r * 0.8, r * 0.38], [r * 0.3, r * 0.72], [-r * 0.4, r * 0.7], [-r * 0.84, r * 0.26]]
    : [[-r * 0.78, -r * 0.42], [-r * 0.3, -r * 0.9], [r * 0.38, -r * 0.88], [r * 0.74, -r * 0.4], [r * 0.7, r * 0.3], [r * 0.2, r * 0.62], [-r * 0.46, r * 0.62], [-r * 0.84, r * 0.2]], r * 0.16, 3);
  head.push(part('head', skull, P.coat, Object.assign({ k: pre + 'headskin' }, o)));
  if (!d.cat) {
    const snout = roundPoly([[r * 0.3, r * 0.02], [r * 1.12, r * 0.08], [r * 1.18, r * 0.5], [r * 0.9, r * 0.68], [r * 0.3, r * 0.62]], r * 0.1, 3);
    head.push(part('snout', snout, P.muzzle, o));
    head.push(part('nose', roundPoly([[r * 0.98, r * 0.04], [r * 1.24, r * 0.06], [r * 1.22, r * 0.28], [r * 1.04, r * 0.3]], r * 0.05, 2), ['#4A4A52', '#2E2E35', '#1C1C21'], { lx, sw: 2.5 }));
  } else {
    head.push(part('muzzle', ngon(r * 0.46, r * 0.32, r * 0.3, r * 0.22, 16), P.muzzle, o));
    head.push(part('nose', [[r * 0.4, r * 0.12], [r * 0.62, r * 0.12], [r * 0.51, r * 0.26]], P.nose, { lx, sw: 2, flat: true }));
    head.push(h('g', { 'data-part': 'whiskers' }, [
      inkLine([[r * 0.6, r * 0.34], [r * 1.25, r * 0.22]], 2.5), inkLine([[r * 0.6, r * 0.42], [r * 1.25, r * 0.5]], 2.5),
      inkLine([[r * 0.2, r * 0.34], [-r * 0.3, r * 0.22]], 2.5)
    ]));
  }
  const A = quadFaceAnchor(d, ctx);
  A.lid = P.coat[1];
  A.k = pre;
  if (ctx.fx.red_face) {
    const red = paint(ctx.catalog.palettes.clothing.red.tones, ctx);
    const rg = part('redface0', skull, red, o);
    rg.k = pre + 'red0';
    rg.attrs.display = 'none';
    rg.attrs['data-fx'] = 'red_face';
    head.push(rg);
  }
  if (ctx.fx.pale_face) {
    const pale = paint(ctx.catalog.palettes.materials.effect.tones, ctx);
    const pg = part('paleface', skull, [pale[0], mix(pale[0], pale[1], 0.5), pale[1]], o);
    pg.k = pre + 'pale';
    pg.attrs.display = 'none';
    pg.attrs['data-fx'] = 'pale_face';
    head.push(pg);
  }
  for (const f of ctx.faces) head.push(drawFace(f, A));
  head.push(drawBlink(A));
  head.push(...drawTalkMouths(A));
  head.push(kg(earsK + 'F', {}, [part('earF', earFront, pointy ? P.coat : shadeTones(P.coat), o)]));
  const inner = 'translate(' + num(d.headOff[0]) + ',' + num(d.headOff[1]) + ')';
  const headG = kg(pre + 'head', {}, [h('g', { transform: inner, 'data-box': 'head' }, head),
    h('g', { transform: inner }, [kg(pre + 'headfx', {}, []), kg(pre + 'held', { transform: 'translate(' + num(d.cat ? r * 0.55 : r * 1.0) + ',' + num(r * 0.62) + ')' }, [])])]);
  const tail = limb(pre + 'tail', 'tail', d.legW * (d.cat ? 0.55 : 0.72), P.coat);
  const neck = limb(pre + 'neckl', 'neck', r * 0.75, P.coat);
  const bodyG = kg(pre + 'body', {}, bodyKids);
  const ver = kg(pre + 'ver', {}, [leg('FB', far), paw('FB', far), leg('BB', far), paw('BB', far), tail, neck, bodyG, headG, leg('BF', P.coat), paw('BF', P.coat), leg('FF', P.coat), paw('FF', P.coat)]);
  ver.face = A;
  return ver;
}

export function buildQuadruped(ch, ctx) {
  const cat = ctx.catalog;
  const look = ch.look;
  const d = quadDims(ch.kind, look, cat);
  const coat = paint(cat.palettes.coat[look.coat].tones, ctx);
  const light = look.coat === 'black' || look.coat === 'brown';
  const markKey = { white: 'black', cream: 'brown', tan: 'brown', brown: 'black', black: 'white', gray: 'black', orange: 'brown' }[look.coat] || 'brown';
  const P = {
    coat,
    muzzle: light ? paint(cat.palettes.coat.tan.tones, ctx) : paint(cat.palettes.coat.white.tones, ctx),
    mark: ch.kind === 'cat' ? coat.map((c) => c) : paint(cat.palettes.coat[markKey].tones, ctx),
    acc: paint(cat.palettes.clothing[look.accessory_color].tones, ctx),
    nose: paint(cat.palettes.clothing.pink.tones, ctx)
  };
  if (ch.kind === 'cat' && look.pattern === 'stripes') P.mark = [coat[2], coat[2], mix(coat[2], INK, 0.3)];
  const key = ctx.key || ch.id;
  const verR = quadVersion(ch, d, P, 1, ctx, key + ':R:');
  const verL = quadVersion(ch, d, P, -1, ctx, key + ':L:');
  verL.attrs.display = 'none';
  return { rig: 'quadruped', key, dims: d, tree: kg(key + ':root', {}, [verR, verL]), ch, face: verR.face, headCY: 0, hair: P.coat };
}

function bodyMatrix(d, pose) {
  const drop = d.legL * clamp(pose.crouch || 0, -0.1, 0.8) + (pose.sitting || 0) * d.legL * 0.5;
  const pitch = (pose.pitch || 0);
  const pv = d.hipB;
  let m = mTrans(0, drop);
  m = mMul(m, mTrans(pv[0], pv[1]));
  m = mMul(m, mRot(-pitch));
  m = mMul(m, mTrans(-pv[0], -pv[1]));
  return m;
}

export function quadUpdate(view, pose) {
  const d = view.dims;
  const out = {};
  const ver = pose.ver || 'R';
  const lx = ver === 'L' ? -1 : 1;
  const pre = view.key + ':' + ver + ':';
  const bm = bodyMatrix(d, pose);
  const J = {};
  out[pre + 'body'] = { transform: matStr(bm) };
  // neck and head: the head group sits on the last point of the neck
  const r = d.headR;
  J.neckBase = snap(mApply(bm, [d.neck[0] - r * 0.25, d.neck[1] + r * 0.35]));
  J.neckTop = snap(mApply(bm, d.neck));
  limbPoints(out, pre + 'neckl', [J.neckBase, J.neckTop], r * 0.75, lx);
  const headRot = (pose.head || 0) - 0.4 * (pose.pitch || 0);
  out[pre + 'head'] = { transform: 'translate(' + num(J.neckTop[0]) + ',' + num(J.neckTop[1]) + ') rotate(' + num(headRot) + ')' };
  const HM = mMul(mTrans(J.neckTop[0], J.neckTop[1]), mRot(headRot));
  J.head = mApply(HM, d.headOff);
  J.mouthM = mMul(HM, mTrans(d.headOff[0] + (d.cat ? r * 0.55 : r * 1.0), d.headOff[1] + r * 0.62));
  const ear = pose.ears || 0;
  out[pre + 'earsF'] = { transform: 'rotate(' + num(ear * (d.cat ? -8 : -18)) + ')' };
  out[pre + 'earsB'] = out[pre + 'earsF'];
  // tail: a short curve from its root, following the body
  const ang = 180 - ((pose.tail === undefined ? 25 : pose.tail) + (pose.tailWag || 0));
  const curl = d.cat ? 26 : 12;
  const segL = d.cat ? d.BL * 0.22 : d.BL * 0.17;
  const tp = [d.tailRoot];
  for (let i = 0; i < 3; i++) {
    const a = ((ang - curl * i) * Math.PI) / 180;
    const q = tp[tp.length - 1];
    tp.push([q[0] + Math.cos(a) * segL, q[1] - Math.sin(a) * segL]);
  }
  // upright on the ground, nothing reaches below it (R4): the tail lies on the floor instead
  // (the farther the body turns over, the less this holds, so nothing jumps when it starts to turn)
  const floor = -(pose.y || 0);
  const gw = clamp(1 - Math.abs(pose.rot || 0) / 20, 0, 1);
  const tw = d.legW * (d.cat ? 0.55 : 0.72);
  const TP = tp.map((p) => { const q = mApply(bm, p); q[1] = lerp(q[1], Math.min(q[1], floor - tw / 2 - 2), gw); return snap(q); });
  limbPoints(out, pre + 'tail', TP, tw, lx);
  J.tail = TP;
  // legs by IK from the hips (which ride on the body)
  const sit = pose.sitting || 0;
  const rear = pose.rear || 0;
  const legs = [['FF', d.hipF, pose.fFF, 1], ['FB', [d.hipF[0] - d.legW * 0.5, d.hipF[1]], pose.fFB, 1], ['BF', d.hipB, pose.fBF, -1], ['BB', [d.hipB[0] + d.legW * 0.5, d.hipB[1]], pose.fBB, -1]];
  for (const [side, hip, tgt0, fwd] of legs) {
    const hp = mApply(bm, hip);
    const tgt = tgt0 || [0, 0];
    let fx = hip[0] + tgt[0] * d.legL;
    let fy = -tgt[1] * d.legL;
    if (side[0] === 'B' && sit > 0) { fx = hip[0] + d.legL * 0.55 * sit + tgt[0] * d.legL; fy = -tgt[1] * d.legL; }
    if (side[0] === 'F' && rear > 0 && !(tgt0 && (tgt0[0] || tgt0[1]))) { fx = hp[0] + d.legL * 0.5; fy = hp[1] + d.legL * 0.7; }
    const k = ikJoint(hp[0], hp[1], fx, fy - (d.legW / 2 + 4.5), d.seg, d.seg, fwd);
    k.knee[1] = lerp(k.knee[1], Math.min(k.knee[1], floor - d.legW / 2 - 2), gw);
    const H0 = snap(hp);
    const K0 = snap(k.knee);
    const E0 = snap(k.end);
    limbPoints(out, pre + 'leg' + side, [H0, K0, E0], d.legW, lx);
    out[pre + 'paw' + side] = { transform: 'translate(' + num(E0[0]) + ',' + num(E0[1]) + ')' };
    J['hip' + side] = H0; J['knee' + side] = K0; J['paw' + side] = E0;
  }
  return { pre, out, joints: J };
}

// ---------- bird ----------

export function birdDims(kindId, look, catalog) {
  const kind = catalog.kinds[kindId];
  const H = kind.heightPx[look.size] || kind.heightPx.small;
  return {
    rig: 'bird', H, bodyC: [0, -H * 0.5], bodyR: [H * 0.36, H * 0.3], head: [H * 0.2, -H * 0.82], headR: H * 0.24,
    legTop: -(H * 0.26 + Math.max(5, H * 0.06) / 2 + 4.5), legL: H * 0.26, legW: Math.max(5, H * 0.06), shoulder: [H * 0.02, -H * 0.62]
  };
}

function birdVersion(ch, d, P, lx, ctx, pre) {
  const o = { lx, sw: 3 };
  const far = shadeTones(P.plume);
  const fr = d.legW / 2 + 4.5;
  const foot = (side, tones) => kg(pre + 'foot' + side, {}, [part('foot' + side, roundPoly([[-fr * 1.3, -fr], [fr * 2.6, -fr], [fr * 2.4, fr], [-fr * 1.3, fr]], fr * 0.4, 2), tones, Object.assign({ flat: true, flatTone: 0 }, o))]);
  const bc = d.bodyC;
  const R = d.bodyR;
  const wingShape = roundPoly([[-R[0] * 0.2, -R[1] * 0.1], [R[0] * 0.3, -R[1] * 0.2], [R[0] * 0.1, R[1] * 0.7], [-R[0] * 0.9, R[1] * 0.9], [-R[0] * 1.2, R[1] * 0.6]], R[0] * 0.12, 2);
  const wingB = kg(pre + 'wingB', {}, [part('wingB', wingShape, far, o)]);
  const wingF = kg(pre + 'wingF', {}, [part('wingF', wingShape, shadeTones([P.plume[0], P.plume[1], P.plume[2]]).map((c, i) => (i === 0 ? P.plume[1] : c)), o)]);
  const kids = [];
  kids.push(kg(pre + 'wingposB', { transform: 'translate(' + num(d.shoulder[0] - d.H * 0.06) + ',' + num(d.shoulder[1] - 2) + ')' }, [wingB]));
  const tail = kg(pre + 'tail', {}, [part('tail', [[0, 0], [-d.H * 0.42, -d.H * 0.22], [-d.H * 0.46, d.H * 0.02], [-d.H * 0.04, d.H * 0.12]], far, o)]);
  kids.push(kg(pre + 'tailpos', { transform: 'translate(' + num(-R[0] * 0.7) + ',' + num(bc[1] - R[1] * 0.1) + ')' }, [tail]));
  kids.push(part('body', ngon(bc[0], bc[1], R[0], R[1], 20, -Math.PI / 2 + 0.3), P.plume, o));
  kids.push(part('belly', ngon(bc[0] + R[0] * 0.25, bc[1] + R[1] * 0.2, R[0] * 0.55, R[1] * 0.62, 16), P.belly, Object.assign({ flat: true, flatTone: 0, outline: false }, o)));
  kids.push(kg(pre + 'wingposF', { transform: 'translate(' + num(d.shoulder[0]) + ',' + num(d.shoulder[1]) + ')' }, [wingF]));
  // head
  const hr = d.headR;
  const head = [];
  const skull = ngon(0, 0, hr, hr, 20, -Math.PI / 2 + 0.2);
  head.push(part('head', skull, P.plume, Object.assign({ k: pre + 'headskin' }, o)));
  head.push(part('crest', [[-hr * 0.2, -hr * 0.9], [-hr * 0.5, -hr * 1.5], [hr * 0.1, -hr * 0.95], [hr * 0.05, -hr * 1.45], [hr * 0.35, -hr * 0.85]], P.plume, Object.assign({ flat: true, flatTone: 2 }, o)));
  const beakClosed = kg(pre + 'beak0', {}, [part('beak', [[hr * 0.7, -hr * 0.3], [hr * 1.75, hr * 0.05], [hr * 0.7, hr * 0.35]], P.beak, o)]);
  const beakOpen = kg(pre + 'beak1', { display: 'none' }, [
    part('beakTop', [[hr * 0.7, -hr * 0.35], [hr * 1.7, -hr * 0.2], [hr * 0.75, hr * 0.05]], P.beak, o),
    part('beakBottom', [[hr * 0.72, hr * 0.12], [hr * 1.5, hr * 0.55], [hr * 0.7, hr * 0.42]], shadeTones(P.beak), o)
  ]);
  const A = {
    cx: hr * 0.12, ey: -hr * 0.12, ed: hr * 0.28, er: hr * 0.27, by: -hr * 0.12 - hr * 0.48, my: hr * 0.3, mw: hr * 0.6, lw: Math.max(2, hr * 0.06),
    white: paint(['#FFFFFF'], ctx)[0], whiteShade: paint(['#D9DEE6'], ctx)[0], mouth: paint(ctx.catalog.palettes.materials.mouth.tones, ctx),
    brow: INK, beak: true, lid: P.plume[1], k: pre
  };
  if (ctx.fx.red_face) {
    const red = paint(ctx.catalog.palettes.clothing.red.tones, ctx);
    const rg = part('redface0', skull, red, o);
    rg.k = pre + 'red0';
    rg.attrs.display = 'none';
    rg.attrs['data-fx'] = 'red_face';
    head.push(rg);
  }
  if (ctx.fx.pale_face) {
    const pale = paint(ctx.catalog.palettes.materials.effect.tones, ctx);
    const pg = part('paleface', skull, [pale[0], mix(pale[0], pale[1], 0.5), pale[1]], o);
    pg.k = pre + 'pale';
    pg.attrs.display = 'none';
    pg.attrs['data-fx'] = 'pale_face';
    head.push(pg);
  }
  head.push(beakClosed, beakOpen);
  for (const f of ctx.faces) head.push(drawFace(f, A));
  head.push(drawBlink(A));
  const headG = kg(pre + 'head', {}, [h('g', { 'data-box': 'head' }, head), h('g', {}, [kg(pre + 'headfx', {}, []), kg(pre + 'held', { transform: 'translate(' + num(hr * 1.45) + ',' + num(hr * 0.15) + ')' }, [])])]);
  const bodyG = kg(pre + 'body', {}, kids);
  const legW = d.legW;
  const ver = kg(pre + 'ver', {}, [limb(pre + 'legB', 'legB', legW, shadeTones(P.beak)), foot('B', shadeTones(P.beak)), limb(pre + 'legF', 'legF', legW, P.beak), foot('F', P.beak),
    limb(pre + 'neckl', 'neck', hr * 0.9, P.plume), bodyG, headG]);
  ver.face = A;
  return ver;
}

export function buildBird(ch, ctx) {
  const cat = ctx.catalog;
  const d = birdDims(ch.kind, ch.look, cat);
  const plume = paint(cat.palettes.clothing[ch.look.plumage].tones, ctx);
  const beakKey = ch.look.plumage === 'orange' || ch.look.plumage === 'yellow' ? 'red' : 'orange';
  const P = { plume, belly: [mix(plume[0], '#FFFFFF', 0.55), mix(plume[0], '#FFFFFF', 0.4), plume[0]], beak: paint(cat.palettes.clothing[beakKey].tones, ctx) };
  const key = ctx.key || ch.id;
  const verR = birdVersion(ch, d, P, 1, ctx, key + ':R:');
  const verL = birdVersion(ch, d, P, -1, ctx, key + ':L:');
  verL.attrs.display = 'none';
  return { rig: 'bird', key, dims: d, tree: kg(key + ':root', {}, [verR, verL]), ch, face: verR.face, headCY: 0, hair: P.plume };
}

function birdBodyMatrix(d, pose) {
  const drop = d.legL * clamp(pose.crouch || 0, 0, 1) + (pose.tuck || 0) * d.legL * 0.95;
  let m = mTrans(0, drop);
  m = mMul(m, mTrans(d.bodyC[0], d.bodyC[1]));
  m = mMul(m, mRot(-(pose.pitch || 0)));
  return mMul(m, mTrans(-d.bodyC[0], -d.bodyC[1]));
}

export function birdUpdate(view, pose) {
  const d = view.dims;
  const out = {};
  const ver = pose.ver || 'R';
  const lx = ver === 'L' ? -1 : 1;
  const pre = view.key + ':' + ver + ':';
  const bm = birdBodyMatrix(d, pose);
  const J = {};
  out[pre + 'body'] = { transform: matStr(bm) };
  out[pre + 'wingF'] = { transform: 'rotate(' + num(-(pose.wingF || 0)) + ')' };
  out[pre + 'wingB'] = { transform: 'rotate(' + num(-(pose.wingB || 0) * 0.9) + ')' };
  out[pre + 'tail'] = { transform: 'rotate(' + num(-(pose.tail || 0) + 10) + ')' };
  // neck and head
  J.neckBase = snap(mApply(bm, [d.head[0] - d.headR * 0.3, d.head[1] + d.headR * 0.9]));
  J.neckTop = snap(mApply(bm, d.head));
  limbPoints(out, pre + 'neckl', [J.neckBase, J.neckTop], d.headR * 0.9, lx);
  const headRot = (pose.head || 0) - 0.5 * (pose.pitch || 0);
  out[pre + 'head'] = { transform: 'translate(' + num(J.neckTop[0]) + ',' + num(J.neckTop[1]) + ') rotate(' + num(headRot) + ')' };
  const HM = mMul(mTrans(J.neckTop[0], J.neckTop[1]), mRot(headRot));
  J.head = J.neckTop;
  J.mouthM = mMul(HM, mTrans(d.headR * 1.45, d.headR * 0.15));
  // legs: straight, from the body to the feet; a crouch shortens them as much as the body drops, so the
  // feet stay on the ground (tucked legs, in flight, get shorter still)
  const tuck = pose.tuck || 0;
  const crouch = clamp(pose.crouch || 0, 0, 1);
  const len = d.legL * clamp(1 - tuck * 0.9 - crouch, 0.08, 1);
  for (const [side, x, ang] of [['F', d.H * 0.06, pose.lF || 0], ['B', -d.H * 0.06, pose.lB || 0]]) {
    const hp = snap(mApply(bm, [x, d.legTop]));
    const a = (-ang * Math.PI) / 180;
    const end = snap([hp[0] - Math.sin(a) * len, hp[1] + Math.cos(a) * len]);
    limbPoints(out, pre + 'leg' + side, [hp, end], d.legW, lx);
    out[pre + 'foot' + side] = { transform: 'translate(' + num(end[0]) + ',' + num(end[1]) + ')' };
    J['hip' + side] = hp; J['foot' + side] = end;
  }
  return { pre, out, joints: J };
}

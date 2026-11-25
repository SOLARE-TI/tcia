// People (rig "biped"): geometric caricature bodies built from faceted polygons.
// Built once per scene for each facing (light stays up-left); each frame only joint transforms change.
import { clamp, lerp } from '../core.mjs';
import { h, kg, part, multiPart, paint, chamfer, ngon, scalePts, INK, mix, num, inkLine, bbox, clipHalf, ribbon, mMul, mTrans, mRot, mApply, limb, limbPoints, snap, roundPoly } from './svg.mjs';
import { drawFace, drawBlink, drawTalkMouths } from './face.mjs';

const PERSON_SHAPES = {
  man: { head: 0.33, torso: 0.29, width: 0.33, arm: 0.064, leg: 0.078, shoes: 'black', eye: 0.13 },
  woman: { head: 0.33, torso: 0.28, width: 0.29, arm: 0.056, leg: 0.068, shoes: 'red', eye: 0.14 },
  boy: { head: 0.43, torso: 0.24, width: 0.32, arm: 0.072, leg: 0.088, shoes: 'white', eye: 0.15 },
  girl: { head: 0.43, torso: 0.24, width: 0.3, arm: 0.068, leg: 0.082, shoes: 'white', eye: 0.155 },
  old_man: { head: 0.3, torso: 0.32, width: 0.31, arm: 0.06, leg: 0.072, shoes: 'brown', eye: 0.12 },
  old_woman: { head: 0.3, torso: 0.31, width: 0.3, arm: 0.056, leg: 0.068, shoes: 'purple', eye: 0.125 }
};

export function shadeTones(t) { return [t[1], t[2], mix(t[2], INK, 0.28)]; }

export function personDims(kindId, look, catalog) {
  const kind = catalog.kinds[kindId];
  const S = PERSON_SHAPES[kindId];
  const H = kind.heightPx[look.height] || kind.heightPx.medium;
  const build = catalog.attributeSets.person.build.values[look.build] || { widthFactor: 1 };
  const wf = build.widthFactor;
  const headH = H * S.head;
  const shapeW = { circle: 1, oval: 0.84, square: 0.96, tall_rect: 0.72, triangle_down: 1.12, trapezoid: 1 }[look.head] || 0.9;
  const headW = headH * shapeW;
  const torsoH = H * S.torso;
  const legL = H - headH * 0.9 - torsoH;
  const torsoW = H * S.width * wf;
  const armW = H * S.arm * (0.85 + 0.15 * wf);
  const legW = H * S.leg * (0.85 + 0.15 * wf);
  const armLen = torsoH * (S.head > 0.4 ? 1.18 : 1.02);
  const legWp = H * S.leg * (0.85 + 0.15 * (catalog.attributeSets.person.build.values[look.build] || { widthFactor: 1 }).widthFactor);
  const legCap = (legWp + 7) / 2;
  const footH = Math.max(14, H * 0.045, legCap * 2 + 2);
  const footL = H * (S.head > 0.4 ? 0.13 : 0.11);
  // standing, a leg is almost straight: hip to ankle is 97 % of its two segments (a slight bend at the knee)
  const seg = (legL - (legCap + 1)) / 2 / 0.97;
  return {
    rig: 'biped', H, headH, headW, torsoH, torsoW, legL, armW, legW, armLen, upper: armLen * 0.5, fore: armLen * 0.48,
    thigh: seg, shin: seg, footH, footL, shape: S, child: S.head > 0.4, hipSep: torsoW * 0.16,
    shoulderY: -torsoH * 0.88, shoulderF: torsoW * 0.18, shoulderB: -torsoW * 0.2, ankleY: legCap + 1, legCap
  };
}

function headPoly(shape, w, hh) {
  const W = w / 2;
  const Hh = hh / 2;
  switch (shape) {
    case 'circle': return ngon(0, 0, W, Hh, 20, -Math.PI / 2 + Math.PI / 20);
    case 'oval': return ngon(0, 0, W, Hh, 20, -Math.PI / 2 + Math.PI / 20);
    case 'square': return roundPoly([[-W, -Hh], [W, -Hh], [W, Hh], [-W, Hh]], w * 0.2, 4);
    case 'tall_rect': return roundPoly([[-W, -Hh], [W, -Hh], [W, Hh], [-W, Hh]], w * 0.18, 4);
    case 'triangle_down': return roundPoly([[-W, -Hh], [W, -Hh], [W * 0.1, Hh]], w * 0.16, 4);
    case 'trapezoid': return roundPoly([[-W * 0.72, -Hh], [W * 0.72, -Hh], [W * 0.92, Hh], [-W * 0.92, Hh]], w * 0.16, 4);
    default: return ngon(0, 0, W, Hh, 20);
  }
}

function handPart(name, r, tones, lx, key) {
  const mitt = [[-r * 0.8, -r * 0.2], [r * 0.7, -r * 0.4], [r * 1.05, r * 0.4], [r * 0.7, r * 1.25], [-r * 0.5, r * 1.3], [-r * 1.0, r * 0.6]];
  const thumb = [[r * 0.6, -r * 0.1], [r * 1.35, -r * 0.1], [r * 1.2, r * 0.45], [r * 0.75, r * 0.45]];
  const g = h('g', {}, [part(name, mitt, tones, { lx, sw: 3 }), part(name + '_thumb', thumb, tones, { lx, sw: 3, flat: true })]);
  const finger = [[r * 0.2, r * 0.9], [r * 2.4, r * 0.75], [r * 2.45, r * 1.25], [r * 0.2, r * 1.35]];
  const pointer = part(name + '_finger', finger, tones, { lx, sw: 3, flat: true, flatTone: 0 });
  pointer.k = key + 'finger';
  pointer.attrs.display = 'none';
  g.children.push(pointer);
  return g;
}

// a chunky shoe around the ankle: it covers the round end of the leg and its sole sits on the ground
function shoePart(name, d, tones, lx) {
  const L = d.footL;
  const a = d.ankleY;
  const back = Math.max(L * 0.36, d.legCap + 2);
  const p = [[-back * 0.85, -a * 0.95], [L * 0.32, -a * 0.95], [L * 0.75, -a * 0.1], [L * 0.78, a], [-back, a], [-back, -a * 0.2]];
  return part(name, roundPoly(p, a * 0.35, 2), tones, { lx, sw: 3.5 });
}

function torsoPoly(build, W, T) {
  const top = -T;
  const bot = T * 0.1;
  const Wb = W / 2;
  if (build === 'slim') return roundPoly([[-Wb, top], [Wb, top], [Wb, bot], [-Wb, bot]], W * 0.22, 4);
  if (build === 'broad') return roundPoly([[-Wb, top], [Wb, top], [Wb, bot], [-Wb, bot]], W * 0.3, 4);
  return roundPoly([[-Wb * 0.86, top], [Wb * 0.86, top], [Wb, top + T * 0.18], [Wb * 0.74, bot], [-Wb * 0.74, bot], [-Wb, top + T * 0.18]], W * 0.12, 3);
}

function hairParts(look, d, tones, lx, hp) {
  // returns { back: [...], front: [...] } in head coordinates (head centre at 0,0)
  const w = d.headW;
  const hh = d.headH;
  const top = -hh / 2;
  const back = [];
  const front = [];
  const covered = look.accessory === 'cap' || look.accessory === 'helmet' || look.accessory === 'hat';
  if (covered && look.hair !== 'bald') {
    // only what pokes out under the brim: side locks and, for spiky hair, spikes sticking out backwards
    const o0 = { lx, sw: 3.5 };
    const rim = top + hh * 0.3;
    const lock = [[-w * 0.56, rim - hh * 0.06], [-w * 0.2, rim - hh * 0.04], [-w * 0.36, rim + hh * 0.16], [-w * 0.52, rim + hh * 0.2]];
    const polys = [lock];
    if (look.hair === 'spiky') {
      polys.push([[-w * 0.5, rim - hh * 0.12], [-w * 0.86, rim - hh * 0.2], [-w * 0.56, rim + hh * 0.02], [-w * 0.84, rim + hh * 0.1], [-w * 0.5, rim + hh * 0.14]]);
      polys.push([[w * 0.3, rim - hh * 0.02], [w * 0.5, rim - hh * 0.02], [w * 0.42, rim + hh * 0.1]]);
    } else if (look.hair === 'curly' || look.hair === 'afro') {
      polys.push(ngon(-w * 0.58, rim + hh * 0.02, w * 0.14, hh * 0.12, 7));
    } else {
      polys.push([[w * 0.2, rim - hh * 0.02], [w * 0.5, rim - hh * 0.02], [w * 0.46, rim + hh * 0.08], [w * 0.26, rim + hh * 0.06]]);
    }
    if (look.hair === 'long' || look.hair === 'ponytail' || look.hair === 'braids' || look.hair === 'bun') {
      return Object.assign(hairPartsOpen(look, d, tones, lx, hp), { front: [multiPart('hair', polys, tones, o0)] });
    }
    return { back, front: [multiPart('hair', polys, tones, o0)] };
  }
  return hairPartsOpen(look, d, tones, lx, hp);
}

function hairPartsOpen(look, d, tones, lx, hp) {
  const w = d.headW;
  const hh = d.headH;
  const top = -hh / 2;
  const back = [];
  const front = [];
  const big = scalePts(hp, 1.08, 1.1, 0, 0);
  const cap = (depth) => clipHalf(big, 0, 1, top + hh * depth);
  const o = { lx, sw: 3.5 };
  switch (look.hair) {
    case 'bald': {
      front.push(part('hair', [[-w * 0.2, top + hh * 0.08], [-w * 0.06, top + hh * 0.04], [-w * 0.1, top + hh * 0.14]], ['#FFFFFF', '#FFFFFF', '#FFFFFF'], { flat: true, outline: false }));
      break;
    }
    case 'buzz': front.push(part('hair', cap(0.2), tones, Object.assign({ flat: true }, o))); break;
    case 'short': {
      const c = cap(0.25);
      const fr = [[-w * 0.3, top + hh * 0.05], [w * 0.54, top + hh * 0.08], [w * 0.5, top + hh * 0.3], [w * 0.34, top + hh * 0.2], [w * 0.16, top + hh * 0.3], [w * 0.02, top + hh * 0.2]];
      front.push(multiPart('hair', [c, fr], tones, o));
      break;
    }
    case 'spiky': {
      const c = cap(0.26);
      const sp = [];
      const n = 6;
      for (let i = 0; i <= n; i++) {
        const x = -w * 0.55 + (i * w * 1.12) / n;
        sp.push([x, top + hh * 0.16]);
        if (i < n) sp.push([x + w * 0.09 + w * 0.03, top - hh * (0.2 + 0.08 * ((i * 7) % 3)) ]);
      }
      sp.push([w * 0.56, top + hh * 0.3], [-w * 0.56, top + hh * 0.3]);
      front.push(multiPart('hair', [sp.slice(0, sp.length), c], tones, o));
      break;
    }
    case 'curly': {
      const bumps = [];
      const n = 9;
      for (let i = 0; i <= n; i++) {
        const a = Math.PI + (i / n) * Math.PI;
        const r = (i % 2 ? 1.18 : 1.05);
        bumps.push([Math.cos(a) * w * 0.56 * r, top + hh * 0.42 + Math.sin(a) * hh * 0.56 * r]);
      }
      bumps.push([w * 0.5, top + hh * 0.42], [-w * 0.5, top + hh * 0.42]);
      front.push(part('hair', bumps, tones, o));
      break;
    }
    case 'afro': {
      const n = 14;
      const blob = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = i % 2 ? 1.0 : 1.1;
        blob.push([Math.cos(a) * w * 0.82 * r, top + hh * 0.22 + Math.sin(a) * hh * 0.66 * r]);
      }
      back.push(part('hair_back', blob, tones, o));
      front.push(part('hair', cap(0.2), tones, Object.assign({ flat: true, flatTone: 1 }, o)));
      break;
    }
    case 'long': {
      const fall = [[-w * 0.56, top + hh * 0.1], [w * 0.4, top + hh * 0.05], [w * 0.3, top + hh * 0.5], [w * 0.42, hh * 0.7], [-w * 0.62, hh * 0.72], [-w * 0.64, top + hh * 0.4]];
      back.push(part('hair_back', fall, tones, o));
      const c = cap(0.3);
      const fr = [[-w * 0.1, top + hh * 0.08], [w * 0.52, top + hh * 0.18], [w * 0.5, top + hh * 0.42], [w * 0.12, top + hh * 0.26]];
      front.push(multiPart('hair', [c, fr], tones, o));
      break;
    }
    case 'ponytail': {
      const tail = ribbon([[-w * 0.4, top + hh * 0.2], [-w * 0.72, top + hh * 0.3], [-w * 0.8, top + hh * 0.6], [-w * 0.7, top + hh * 0.85]], [hh * 0.2, hh * 0.24, hh * 0.18, hh * 0.06]);
      back.push(part('hair_back', tail, tones, o));
      front.push(part('hair', cap(0.27), tones, o));
      break;
    }
    case 'bun': {
      back.push(part('hair_back', ngon(-w * 0.12, top - hh * 0.06, w * 0.24, hh * 0.18, 8), tones, o));
      front.push(part('hair', cap(0.26), tones, o));
      break;
    }
    case 'braids': {
      for (const sx of [-1, 1]) {
        const x0 = sx * w * 0.42;
        const br = ribbon([[x0, top + hh * 0.3], [x0 + sx * w * 0.08, hh * 0.15], [x0 + sx * w * 0.06, hh * 0.62]], [hh * 0.14, hh * 0.13, hh * 0.1]);
        back.push(part('hair_back' + (sx > 0 ? 'F' : 'B'), br, tones, o));
      }
      front.push(part('hair', cap(0.27), tones, o));
      break;
    }
    default: break;
  }
  return { back, front };
}

function headAccessory(look, d, tones, lx, hp, ctx) {
  const w = d.headW;
  const hh = d.headH;
  const top = -hh / 2;
  const o = { lx, sw: 3.5 };
  const big = scalePts(hp, 1.12, 1.14, 0, 0);
  switch (look.accessory) {
    case 'cap': {
      const dome = clipHalf(big, 0, 1, top + hh * 0.26);
      const visor = [[w * 0.2, top + hh * 0.2], [w * 0.86, top + hh * 0.22], [w * 0.84, top + hh * 0.3], [w * 0.2, top + hh * 0.3]];
      return [multiPart('accessory', [dome, visor], tones, o)];
    }
    case 'helmet': {
      const dome = clipHalf(scalePts(hp, 1.2, 1.2, 0, hh * 0.05), 0, 1, top + hh * 0.36);
      const bb = bbox(dome);
      const stripe = clipHalf(clipHalf(dome, 1, 0, w * 0.16), -1, 0, w * 0.04);
      const white = paint(['#FFFFFF', '#F2F4F7', '#D9DEE6'], ctx);
      return [part('accessory', dome, tones, o), part('accessory_stripe', stripe, white, { lx, flat: true, flatTone: 0, outline: false }), h('g', { 'data-part': 'strap' }, [inkLine([[-w * 0.3, bb.y1], [-w * 0.24, top + hh * 0.78]], 4)])];
    }
    case 'hat': {
      const crown = [[-w * 0.36, top - hh * 0.28], [w * 0.36, top - hh * 0.28], [w * 0.44, top + hh * 0.16], [-w * 0.44, top + hh * 0.16]];
      const brim = [[-w * 0.8, top + hh * 0.12], [w * 0.8, top + hh * 0.12], [w * 0.72, top + hh * 0.24], [-w * 0.72, top + hh * 0.24]];
      const band = [[-w * 0.43, top + hh * 0.04], [w * 0.43, top + hh * 0.04], [w * 0.44, top + hh * 0.13], [-w * 0.44, top + hh * 0.13]];
      return [multiPart('accessory', [crown, brim], tones, o), part('accessory_band', band, ['#4A4A52', '#2E2E35', '#1C1C21'], { lx, flat: true, outline: false })];
    }
    case 'headband': {
      const band = clipHalf(clipHalf(scalePts(hp, 1.04, 1.04, 0, 0), 0, 1, top + hh * 0.3), 0, -1, -(top + hh * 0.18));
      return [part('accessory', band, tones, Object.assign({ flat: true }, o))];
    }
    default: return [];
  }
}

function faceAnchor(d, look, cx, light) {
  const w = d.headW;
  const hh = d.headH;
  const top = -hh / 2;
  const tri = look.head === 'triangle_down';
  const tall = look.head === 'tall_rect';
  const er = Math.min(w, hh * 0.9) * d.shape.eye * (tri ? 1.05 : 1);
  return {
    cx: w * 0.12, ey: top + hh * (tri ? 0.36 : (tall ? 0.4 : 0.45)), ed: w * (tri ? 0.2 : 0.19), er,
    by: top + hh * (tri ? 0.36 : (tall ? 0.4 : 0.45)) - er * 1.75,
    my: top + hh * (tri ? 0.62 : 0.75), mw: w * (tri ? 0.3 : 0.36), lw: Math.max(2.5, er * 0.2),
    white: paint(['#FFFFFF'], cx)[0], whiteShade: paint(['#D9DEE6'], cx)[0],
    mouth: paint(cx.catalog.palettes.materials.mouth.tones, cx), lid: null, brow: INK, beak: false
  };
}

// ---------- outfits ----------

function outfitParts(look, d, P, lx) {
  // P: tones { top, bottom, skin, acc, white, shoe }
  const T = d.torsoH;
  const W = d.torsoW;
  const o = { lx, sw: 3.5 };
  const tp = torsoPoly(look.build, W, T);
  const out = { torso: [], over: [], skirt: null, sleeves: 'short', legs: 'pants' };
  const top = -T;
  switch (look.outfit) {
    case 'tee_shorts': out.legs = 'shorts'; out.torso.push(part('torso', tp, P.top, o)); break;
    case 'tee_pants': out.torso.push(part('torso', tp, P.top, o)); break;
    case 'hoodie_pants': {
      out.sleeves = 'long';
      out.torso.push(part('hood', [[-W * 0.46, top - T * 0.02], [-W * 0.1, top - T * 0.14], [W * 0.16, top - T * 0.02], [W * 0.05, top + T * 0.18], [-W * 0.4, top + T * 0.2]], shadeTones(P.top), o));
      out.torso.push(part('torso', tp, P.top, o));
      out.over.push(h('g', { 'data-part': 'pocket' }, [inkLine([[-W * 0.22, top + T * 0.66], [-W * 0.16, top + T * 0.52], [W * 0.3, top + T * 0.52], [W * 0.36, top + T * 0.66]], 3)]));
      out.over.push(h('g', { 'data-part': 'strings' }, [inkLine([[W * 0.08, top + T * 0.08], [W * 0.1, top + T * 0.3]], 3), inkLine([[W * 0.22, top + T * 0.06], [W * 0.25, top + T * 0.28]], 3)]));
      break;
    }
    case 'shirt_pants': {
      out.sleeves = 'long';
      out.torso.push(part('torso', tp, P.top, o));
      out.over.push(part('collar', [[-W * 0.18, top], [W * 0.02, top + T * 0.16], [W * 0.26, top], [W * 0.2, top + T * 0.08], [W * 0.02, top + T * 0.22], [-W * 0.12, top + T * 0.08]], P.white, { lx, flat: true, sw: 3 }));
      out.over.push(h('g', { 'data-part': 'buttons' }, [0.35, 0.55, 0.75].map((f) => h('circle', { cx: num(W * 0.03), cy: num(top + T * f), r: num(Math.min(5, W * 0.025)), fill: INK }))));
      break;
    }
    case 'sweater_pants': {
      out.sleeves = 'long';
      out.torso.push(part('torso', tp, P.top, o));
      out.over.push(part('collar', [[-W * 0.22, top - 2], [W * 0.28, top - 2], [W * 0.22, top + T * 0.1], [-W * 0.16, top + T * 0.1]], [P.top[0], P.top[0], P.top[1]], { lx, flat: true, flatTone: 0, sw: 3 }));
      out.over.push(h('g', { 'data-part': 'ribs' }, [inkLine([[-W * 0.38, top + T * 0.95], [W * 0.38, top + T * 0.95]], 3)]));
      break;
    }
    case 'jacket_pants': {
      out.sleeves = 'long';
      out.torso.push(part('torso', tp, P.top, o));
      out.over.push(part('shirt', [[-W * 0.16, top], [W * 0.12, top], [W * 0.06, T * 0.08], [-W * 0.12, T * 0.08]], P.white, { lx, flat: true, sw: 3 }));
      out.over.push(h('g', { 'data-part': 'lapels' }, [inkLine([[-W * 0.16, top], [-W * 0.06, top + T * 0.34], [-W * 0.12, T * 0.08]], 3), inkLine([[W * 0.12, top], [W * 0.02, top + T * 0.34], [W * 0.06, T * 0.08]], 3)]));
      break;
    }
    case 'suit': {
      out.sleeves = 'long';
      out.torso.push(part('torso', tp, P.top, o));
      out.over.push(part('shirt', [[-W * 0.14, top], [W * 0.12, top], [-W * 0.01, top + T * 0.46]], P.white, { lx, flat: true, sw: 3 }));
      out.over.push(part('tie', [[-W * 0.045, top + T * 0.04], [W * 0.025, top + T * 0.04], [W * 0.045, top + T * 0.36], [-W * 0.01, top + T * 0.46], [-W * 0.065, top + T * 0.36]], P.tie, { lx, flat: true, sw: 2.5 }));
      out.over.push(h('g', { 'data-part': 'buttons' }, [h('circle', { cx: num(-W * 0.04), cy: num(top + T * 0.62), r: '5', fill: INK }), h('circle', { cx: num(-W * 0.04), cy: num(top + T * 0.8), r: '5', fill: INK })]));
      break;
    }
    case 'overalls': {
      out.torso.push(part('torso', tp, P.top, o));
      const bib = [[-W * 0.3, top + T * 0.3], [W * 0.36, top + T * 0.3], [W * 0.4, T * 0.1], [-W * 0.36, T * 0.1]];
      out.over.push(part('bib', bib, P.bottom, o));
      out.over.push(part('straps', [[-W * 0.28, top + T * 0.32], [-W * 0.3, top + 2], [-W * 0.16, top + 2], [-W * 0.14, top + T * 0.32]], P.bottom, { lx, flat: true, sw: 3 }));
      out.over.push(h('g', { 'data-part': 'buckles' }, [h('circle', { cx: num(-W * 0.21), cy: num(top + T * 0.33), r: '5', fill: P.metal })]));
      break;
    }
    case 'dress': {
      out.legs = 'bare';
      out.torso.push(part('torso', tp, P.top, o));
      const L = d.legL;
      out.skirt = part('skirt', [[-W * 0.36, -T * 0.05], [W * 0.36, -T * 0.05], [W * 0.58, L * 0.58], [W * 0.2, L * 0.64], [-W * 0.2, L * 0.64], [-W * 0.58, L * 0.58]], P.top, o);
      d.skirt = [L * 0.64, W * 0.58];
      break;
    }
    case 'skirt_top': {
      out.legs = 'bare';
      out.torso.push(part('torso', tp, P.top, o));
      const L = d.legL;
      out.skirt = part('skirt', [[-W * 0.38, -T * 0.02], [W * 0.38, -T * 0.02], [W * 0.56, L * 0.42], [-W * 0.56, L * 0.42]], P.bottom, o);
      d.skirt = [L * 0.42, W * 0.56];
      break;
    }
    default: out.torso.push(part('torso', tp, P.top, o));
  }
  return out;
}

// ---------- the person view ----------

function buildVersion(ch, d, P, lx, ctx, pre) {
  const look = ch.look;
  const o = { lx, sw: 3.5 };
  const id = pre;
  const fit = outfitParts(look, d, P, lx);
  const farP = { top: shadeTones(P.top), bottom: shadeTones(P.bottom), skin: shadeTones(P.skin), shoe: shadeTones(P.shoe) };
  const sleeveLong = fit.sleeves === 'long';
  const S = (far) => (far ? farP : P);
  // continuous limbs (points written every frame from the skeleton)
  const armB = limb(id + 'armB', 'armB', d.armW, sleeveLong ? farP.top : farP.skin);
  const armF = limb(id + 'armF', 'armF', d.armW, sleeveLong ? P.top : P.skin);
  const sleeveB = sleeveLong ? null : limb(id + 'sleeveB', 'sleeveB', d.armW * 1.3, farP.top, true);
  const sleeveF = sleeveLong ? null : limb(id + 'sleeveF', 'sleeveF', d.armW * 1.3, P.top, true);
  const legTone = (far) => (fit.legs === 'pants' ? S(far).bottom : S(far).skin);
  const legB = limb(id + 'legB', 'legB', d.legW, legTone(true));
  const legF = limb(id + 'legF', 'legF', d.legW, legTone(false));
  const shortsB = fit.legs === 'shorts' ? limb(id + 'shortsB', 'shortsB', d.legW * 1.25, farP.bottom, true) : null;
  const shortsF = fit.legs === 'shorts' ? limb(id + 'shortsF', 'shortsF', d.legW * 1.25, P.bottom, true) : null;
  const neck = limb(id + 'neck', 'neck', d.armW * 1.2, P.skin);
  const makeHand = (side) => {
    const far = side === 'B';
    const hand = kg(id + 'hand' + side, {}, [handPart('hand' + side, d.armW * 0.8, S(far).skin, lx, id + 'hand' + side)]);
    if (!far) hand.children.push(kg(id + 'held', {}, []));
    if (far && look.accessory === 'cane') {
      const caneT = paint(ctx.catalog.palettes.materials.wood.tones, ctx);
      const len = d.legL - d.shoulderY - d.upper - d.fore - d.armW * 0.4;
      hand.children.push(part('cane', [[-4, -d.armW * 0.2], [4, -d.armW * 0.2], [5, len], [-5, len]], caneT, { lx, flat: true, sw: 3 }));
    }
    return hand;
  };
  const footB = kg(id + 'footB', {}, [shoePart('shoeB', d, farP.shoe, lx)]);
  const footF = kg(id + 'footF', {}, [shoePart('shoeF', d, P.shoe, lx)]);
  // blur wheel for run.dash (shown instead of the legs)
  const wheelPts = [];
  const R = d.legL * 0.55;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = R * (i % 2 ? 0.55 : 1);
    wheelPts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const wheel = kg(id + 'wheel', { display: 'none' }, [part('legwheel', wheelPts, legTone(false), { lx, sw: 3 })]);
  const wheelG = kg(id + 'wheelpos', {}, [wheel]);

  // head (built once; its group is placed at the top of the neck every frame)
  const hp = headPoly(look.head, d.headW, d.headH);
  const hair = hairParts(look, d, P.hair, lx, hp);
  const head = [];
  head.push(...hair.back);
  const earX = -d.headW * 0.46;
  head.push(part('ear', ngon(earX, d.headH * 0.02, d.headW * 0.09, d.headH * 0.11, 16), P.skin, o));
  head.push(part('head', hp, P.skin, Object.assign({ k: id + 'headskin' }, o)));
  const A = faceAnchor(d, look, ctx, ctx.light);
  A.lid = P.skin[1];
  A.k = id;
  const B = Object.assign({}, A);
  if (ctx.fx.red_face) {
    const red = paint(ctx.catalog.palettes.clothing.red.tones, ctx);
    [0.62, 1.2].forEach((lv, i) => {
      const clipped = clipHalf(hp, 0, -1, -(d.headH / 2 - d.headH * lv));
      if (clipped.length < 3) return;
      const rg = part('redface' + i, clipped, red, o);
      rg.k = id + 'red' + i;
      rg.attrs.display = 'none';
      rg.attrs['data-fx'] = 'red_face';
      head.push(rg);
    });
  }
  if (ctx.fx.pale_face) {
    const pale = paint(ctx.catalog.palettes.materials.effect.tones, ctx);
    const pg = part('paleface', hp, [pale[0], mix(pale[0], pale[1], 0.5), pale[1]], o);
    pg.k = id + 'pale';
    pg.attrs.display = 'none';
    pg.attrs['data-fx'] = 'pale_face';
    head.push(pg);
  }
  head.push(part('nose', [[A.cx + A.ed * 0.55, A.ey + A.er * 0.6], [A.cx + A.ed * 1.05 + d.headW * 0.05, (A.ey + A.my) / 2 + A.er * 0.3], [A.cx + A.ed * 0.45, (A.ey + A.my) / 2 + A.er * 0.4]], P.skin, { lx, sw: 2.5, flat: true, flatTone: 2 }));
  for (const f of ctx.faces) head.push(drawFace(f, B));
  head.push(drawBlink(B));
  head.push(...drawTalkMouths(B));
  head.push(...hair.front);
  if (look.accessory === 'glasses' || look.accessory === 'sunglasses') {
    const dark = look.accessory === 'sunglasses';
    const lens = (x, sc) => ngon(x, A.ey, A.er * 1.5 * sc, A.er * 1.25 * sc, 16);
    const lenses = [lens(A.cx - A.ed, 0.9), lens(A.cx + A.ed, 1)];
    const kids = [];
    for (const l of lenses) kids.push(h('polygon', { points: l.map((p) => num(p[0]) + ',' + num(p[1])).join(' '), fill: dark ? paint(['#2E2E35'], ctx)[0] : 'none', stroke: dark ? INK : P.acc[2], 'stroke-width': '5' }));
    kids.push(inkLine([[A.cx - A.ed + A.er * 1.3, A.ey - A.er * 0.3], [A.cx + A.ed - A.er * 1.45, A.ey - A.er * 0.3]], 4, dark ? INK : P.acc[2]));
    kids.push(inkLine([[A.cx - A.ed - A.er * 1.4, A.ey - A.er * 0.2], [-d.headW * 0.44, A.ey - A.er * 0.5]], 4, dark ? INK : P.acc[2]));
    if (dark) kids.push(h('polygon', { points: [[A.cx + A.ed - A.er * 0.9, A.ey - A.er * 0.7], [A.cx + A.ed - A.er * 0.3, A.ey - A.er * 0.8], [A.cx + A.ed - A.er * 0.9, A.ey - A.er * 0.1]].map((p) => num(p[0]) + ',' + num(p[1])).join(' '), fill: '#FFFFFF' }));
    head.push(h('g', { 'data-part': 'accessory' }, kids));
  }
  head.push(...headAccessory(look, d, P.acc, lx, hp, ctx));
  const headCY = -d.headH * 0.37;
  const inner = 'translate(0,' + num(headCY) + ')';
  const headG = kg(id + 'head', {}, [h('g', { transform: inner, 'data-box': 'head' }, head), h('g', { transform: inner }, [kg(id + 'headfx', {}, [])])]);

  // torso group (torso, outfit and chest accessories)
  const T = d.torsoH;
  const torsoKids = [];
  if (look.accessory === 'backpack') {
    torsoKids.push(part('accessory', roundPoly(chamfer(-d.torsoW * 0.78, -T * 0.92, d.torsoW * 0.42, T * 0.78, d.torsoW * 0.08), 8, 2), P.acc, o));
  }
  torsoKids.push(...fit.torso, ...fit.over);
  if (look.accessory === 'backpack') {
    torsoKids.push(part('strap', [[-d.torsoW * 0.2, -T * 0.98], [-d.torsoW * 0.06, -T * 0.98], [-d.torsoW * 0.04, -T * 0.3], [-d.torsoW * 0.18, -T * 0.3]], P.acc, { lx, flat: true, sw: 3 }));
  }
  if (look.accessory === 'scarf') {
    torsoKids.push(part('accessory', roundPoly([[-d.torsoW * 0.4, -T - 6], [d.torsoW * 0.42, -T - 6], [d.torsoW * 0.38, -T + T * 0.14], [-d.torsoW * 0.36, -T + T * 0.14]], 8, 2), P.acc, o));
    torsoKids.push(part('accessory_tail', [[d.torsoW * 0.06, -T + T * 0.08], [d.torsoW * 0.26, -T + T * 0.08], [d.torsoW * 0.3, -T + T * 0.56], [d.torsoW * 0.1, -T + T * 0.5]], P.acc, { lx, flat: true, flatTone: 2, sw: 3 }));
  }
  if (look.accessory === 'bow_tie') {
    const y = -T + 10;
    const x = d.torsoW * 0.08;
    torsoKids.push(part('accessory', [[x - 26, y - 13], [x, y], [x - 26, y + 13]], P.acc, { lx, sw: 3 }));
    torsoKids.push(part('accessory_r', [[x + 26, y - 13], [x, y], [x + 26, y + 13]], P.acc, { lx, sw: 3 }));
  }
  const torso = kg(id + 'torso', {}, torsoKids);
  const skirt = fit.skirt ? kg(id + 'skirt', {}, [fit.skirt]) : null;
  const kids = [armB];
  if (sleeveB) kids.push(sleeveB);
  kids.push(makeHand('B'), legB);
  if (shortsB) kids.push(shortsB);
  kids.push(footB, legF);
  if (shortsF) kids.push(shortsF);
  kids.push(footF, wheelG);
  if (skirt) kids.push(skirt);
  kids.push(neck, torso, headG, armF);
  if (sleeveF) kids.push(sleeveF);
  kids.push(makeHand('F'));
  const ver = kg(id + 'ver', {}, kids);
  ver.face = A;
  ver.headCY = headCY;
  ver.sleeves = !sleeveLong;
  ver.shorts = fit.legs === 'shorts';
  return ver;
}

export function buildPerson(ch, ctx) {
  const cat = ctx.catalog;
  const look = ch.look;
  const d = personDims(ch.kind, look, cat);
  const pal = cat.palettes;
  const P = {
    skin: paint(pal.skin[look.skin].tones, ctx),
    hair: paint(pal.hair[look.hair_color].tones, ctx),
    top: paint(pal.clothing[look.top_color].tones, ctx),
    bottom: paint(pal.clothing[look.bottom_color].tones, ctx),
    acc: paint(pal.clothing[look.accessory_color].tones, ctx),
    shoe: paint(pal.clothing[d.shape.shoes].tones, ctx),
    white: paint(pal.clothing.white.tones, ctx),
    tie: paint(pal.clothing.red.tones, ctx),
    metal: paint(pal.materials.metal.tones, ctx)[1]
  };
  const key = ctx.key || ch.id;
  const verR = buildVersion(ch, d, P, 1, ctx, key + ':R:');
  const verL = buildVersion(ch, d, P, -1, ctx, key + ':L:');
  verL.attrs.display = 'none';
  const root = kg(key + ':root', {}, [verR, verL]);
  return { rig: 'biped', key, dims: d, tree: root, ch, face: verR.face, headCY: verR.headCY, hair: P.hair, sleeves: verR.sleeves, shorts: verR.shorts };
}

// ---------- pose -> skeleton -> attribute updates ----------

// two-bone IK in SVG coordinates; the middle joint bends towards +x when fwd = 1
export function ikJoint(hx, hy, fx, fy, a, b, fwd) {
  let dx = fx - hx;
  let dy = fy - hy;
  let dist = Math.hypot(dx, dy);
  const maxD = (a + b) * 0.999;
  if (dist > maxD) { dx *= maxD / dist; dy *= maxD / dist; dist = maxD; }
  if (dist < 1e-3) dist = 1e-3;
  // a foot drawn up close to the hip: the knee keeps pointing the way it did (the direction leans
  // towards straight down), instead of swinging round as the foot passes under the hip
  const near = (a + b) * 0.4;
  let base = Math.atan2(dy, dx);
  if (dist < near) {
    let dd = Math.PI / 2 - base;
    while (dd > Math.PI) dd -= 2 * Math.PI;
    while (dd < -Math.PI) dd += 2 * Math.PI;
    base += dd * (1 - dist / near);
  }
  const cosA = clamp((a * a + dist * dist - b * b) / (2 * a * dist), -1, 1);
  const th = base - fwd * Math.acos(cosA);
  const knee = [hx + Math.cos(th) * a, hy + Math.sin(th) * a];
  const end = [hx + dx, hy + dy];
  const th2 = Math.atan2(end[1] - knee[1], end[0] - knee[0]);
  return { knee, end, r1: (th * 180) / Math.PI - 90, r2: (th2 * 180) / Math.PI - 90 };
}

function rotv(v, deg) {
  const a = (deg * Math.PI) / 180;
  return [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
}

export function bipedHipH(d, pose) { return d.legL * (1 - clamp(pose.crouch || 0, -0.1, 0.95)); }

// Joints in the version frame (inside the root transform) and the attribute updates that draw them.
export function bipedUpdate(view, pose) {
  const d = view.dims;
  const out = {};
  const ver = pose.ver || 'R';
  const lx = ver === 'L' ? -1 : 1;
  const pre = view.key + ':' + ver + ':';
  const hipH = bipedHipH(d, pose);
  const lean = pose.lean || 0;
  const TM = mMul(mTrans(0, -hipH), mRot(lean));
  const J = {};
  out[pre + 'torso'] = { transform: 'translate(0,' + num(-hipH) + ') rotate(' + num(lean) + ')' };
  // on the ground (root at the ground line, upright) nothing reaches below it (R4)
  // (the farther the body turns over, the less this holds, so nothing jumps when it starts to turn)
  const floor = -(pose.y || 0);
  const gw = clamp(1 - Math.abs(pose.rot || 0) / 20, 0, 1);
  // neck and head: the head group sits exactly on the last point of the neck
  J.neckBase = snap(mApply(TM, [0, -d.torsoH + d.armW * 0.6]));
  J.neckTop = snap(mApply(TM, [0, -d.torsoH - d.headH * 0.05]));
  limbPoints(out, pre + 'neck', [J.neckBase, J.neckTop], d.armW * 1.2, lx);
  const headRot = lean + (pose.head || 0);
  out[pre + 'head'] = { transform: 'translate(' + num(J.neckTop[0]) + ',' + num(J.neckTop[1]) + ') rotate(' + num(headRot) + ')' };
  J.head = mApply(mMul(mTrans(J.neckTop[0], J.neckTop[1]), mRot(headRot)), [0, view.headCY]);
  // arms (angles in the torso frame, forward-positive)
  const arm = (side, a, w) => {
    const sh = [side === 'F' ? d.shoulderF : d.shoulderB, d.shoulderY];
    const elbowAt = (a0) => [sh[0] + rotv([0, d.upper], -a0)[0], sh[1] + rotv([0, d.upper], -a0)[1]];
    const wristAt = (a0, a1) => { const e = elbowAt(a0); return [e[0] + rotv([0, d.fore], -(a0 + a1))[0], e[1] + rotv([0, d.fore], -(a0 + a1))[1]]; };
    const a0 = a[0];
    let a1 = a[1];
    // a hand that would go into the ground bends up at the elbow, just until it is clear (the least bend
    // that works, so it changes smoothly with the pose)
    if (gw > 0 && !pose.reachDown) {
      const lim = floor - d.armW * 2.2;
      const low = (x) => mApply(TM, wristAt(a0, x))[1] > lim;
      const top = Math.max(a1, 180 - a0);
      if (low(a1) && !low(top)) {
        let lo = a1;
        let hi = top;
        for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (low(m)) lo = m; else hi = m; }
        a1 = lerp(a1, hi, gw);
      }
    }
    const el = elbowAt(a0);
    const wr = wristAt(a0, a1);
    const S0 = snap(mApply(TM, sh));
    const E0 = snap(mApply(TM, el));
    const W0 = snap(mApply(TM, wr));
    limbPoints(out, pre + 'arm' + side, [S0, E0, W0], d.armW, lx);
    if (view.sleeves) limbPoints(out, pre + 'sleeve' + side, [S0, snap([S0[0] + (E0[0] - S0[0]) * 0.55, S0[1] + (E0[1] - S0[1]) * 0.55])], d.armW * 1.3, lx);
    const hr = lean - a0 - a1 - (w || 0);
    out[pre + 'hand' + side] = { transform: 'translate(' + num(W0[0]) + ',' + num(W0[1]) + ') rotate(' + num(hr) + ')' };
    J['shoulder' + side] = S0; J['elbow' + side] = E0; J['wrist' + side] = W0;
    if (side === 'F') J.handM = mMul(mTrans(W0[0], W0[1]), mRot(hr));
  };
  arm('F', pose.aF || [8, 8], pose.wF);
  arm('B', pose.aB || [-6, 8], pose.wB);
  // legs by IK (targets in leg-length units, y up)
  const L = d.legL;
  const legs = [['F', pose.fF || [0.12, 0], d.hipSep * 0.4, pose.toeF || 0], ['B', pose.fB || [-0.1, 0], -d.hipSep * 0.4, pose.toeB || 0]];
  for (const [side, tgt, hx, toe] of legs) {
    const k = ikJoint(hx, -hipH, tgt[0] * L, -(tgt[1] * L) - d.ankleY, d.thigh, d.shin, 1);
    const H0 = snap([hx, -hipH]);
    const K0 = snap(k.knee);
    const A0 = snap(k.end);
    limbPoints(out, pre + 'leg' + side, [H0, K0, A0], d.legW, lx);
    if (view.shorts) limbPoints(out, pre + 'shorts' + side, [H0, snap([H0[0] + (K0[0] - H0[0]) * 0.72, H0[1] + (K0[1] - H0[1]) * 0.72])], d.legW * 1.25, lx);
    out[pre + 'foot' + side] = { transform: 'translate(' + num(A0[0]) + ',' + num(A0[1]) + ') rotate(' + num(toe) + ')' };
    J['hip' + side] = H0; J['knee' + side] = K0; J['ankle' + side] = A0;
  }
  // the skirt follows the thighs half way, and bunches up rather than go into the ground
  const thigh = (s2) => (Math.atan2(-(J['knee' + s2][0] - J['hip' + s2][0]), J['knee' + s2][1] - J['hip' + s2][1]) * 180) / Math.PI;
  let skRot = lean * 0.35 + 0.5 * ((thigh('F') + thigh('B')) / 2);
  let skScale = 1;
  if (d.skirt && gw > 0) {
    const reach = (rot, k) => { const r = (Math.abs(rot) * Math.PI) / 180; return d.skirt[0] * k * Math.cos(r) + d.skirt[1] * Math.sin(r); };
    const room = hipH + floor - 3;
    // short of room (sitting on the floor): it straightens and shortens, spread around the hips
    const f = clamp((reach(skRot, 1) - room) / 40, 0, 1);
    skRot = lerp(skRot, lean * 0.35, f * gw);
    const r = (Math.abs(skRot) * Math.PI) / 180;
    if (reach(skRot, 1) > room) skScale = lerp(1, clamp((room - d.skirt[1] * Math.sin(r)) / Math.max(1, d.skirt[0] * Math.cos(r)), 0.15, 1), gw);
  }
  out[pre + 'skirt'] = { transform: 'translate(0,' + num(-hipH) + ') rotate(' + num(skRot) + ')' + (skScale < 1 ? ' scale(1,' + Math.round(skScale * 1000) / 1000 + ')' : '') };
  out[pre + 'wheelpos'] = { transform: 'translate(0,' + num(-hipH * 0.55) + ')' };
  return { pre, out, joints: J, hipH };
}

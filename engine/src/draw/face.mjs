// Cartoon faces: 11 faces (catalog.faces), blink, talk mouths and beaks. Polygons only.
import { h, kg, pts, num, ngon, shift, INK, inkLine, rotPts } from './svg.mjs';

export const FACE_IDS = ['neutral', 'smile', 'grin', 'sad', 'sob', 'annoyed', 'furious', 'wide', 'shocked', 'worried', 'terrified'];

// faces whose own eyes are already closed or squinted: no blink on top of them
export const FACE_CLOSED = { smile: true, grin: true, sob: true };
// how open the mouth is (for beaks)
const FACE_OPEN = { grin: 1, sob: 1, shocked: 1, terrified: 1, wide: 0.5, furious: 0.4 };

function poly(points, fill, extra) {
  return h('polygon', Object.assign({ points: pts(points), fill }, extra || {}));
}

function outlined(points, fill, w) {
  return h('polygon', { points: pts(points), fill, stroke: INK, 'stroke-width': num(w), 'stroke-linejoin': 'round' });
}

function circle(x, y, r, fill) {
  return h('circle', { cx: num(x), cy: num(y), r: num(Math.min(r, 14)), fill });
}

function eyeOpen(A, x, y, sc, opt) {
  const o = opt || {};
  const rx = A.er * sc * (o.big || 1);
  const ry = rx * (o.tall || 1.18);
  const white = ngon(x, y, rx, ry, 10);
  const out = [outlined(white, A.white, A.lw)];
  // lower shade sliver
  out.push(poly([white[3], white[4], white[5], white[6], white[7], [x - rx * 0.6, y + ry * 0.5], [x + rx * 0.6, y + ry * 0.5]], A.whiteShade));
  out.push(h('polygon', { points: pts(white), fill: 'none', stroke: INK, 'stroke-width': num(A.lw), 'stroke-linejoin': 'round' }));
  const pr = rx * (o.pupil || 0.5);
  const pupils = [circle(x + rx * 0.18 + (o.px || 0), y + ry * 0.05 + (o.py || 0), pr, INK)];
  if (pr > 3) pupils.push(circle(x + rx * 0.18 - pr * 0.35 + (o.px || 0), y - pr * 0.35 + (o.py || 0), Math.max(1.5, pr * 0.34), A.white));
  return { whites: out, pupils };
}

function eyesPair(A, opt) {
  const near = eyeOpen(A, A.cx + A.ed, A.ey, 1, opt);
  const far = eyeOpen(A, A.cx - A.ed, A.ey, 0.88, opt);
  const pup = kg(A.k + 'pupils', {}, far.pupils.concat(near.pupils));
  return h('g', { 'data-part': 'eyes' }, far.whites.concat(near.whites, [pup]));
}

function arcEye(A, x, y, sc, dir, thick) {
  // dir 1: happy arc (^), -1: sad arc
  const r = A.er * sc;
  const pts0 = [];
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI + (i / 6) * Math.PI;
    pts0.push([x + Math.cos(a) * r, y + dir * Math.sin(a) * r * 0.7 + dir * r * 0.2]);
  }
  return inkLine(pts0, thick || A.lw * 1.6, INK);
}

function squeezeEye(A, x, y, sc, side) {
  const r = A.er * sc;
  return inkLine([[x - r * side, y - r * 0.7], [x + r * 0.8 * side, y], [x - r * side, y + r * 0.7]], A.lw * 1.6, INK);
}

function brows(A, kind) {
  const w = A.er * 1.25;
  const t = Math.max(4, A.er * 0.32);
  const out = [];
  for (const side of [-1, 1]) {
    const x = A.cx + side * A.ed * (side < 0 ? 0.88 : 1);
    const y = A.by;
    let a = 0;
    let dy = 0;
    if (kind === 'raised') { dy = -A.er * 0.45; a = 0; }
    if (kind === 'high') { dy = -A.er * 0.8; a = 0; }
    if (kind === 'sad') { a = side * -18; dy = -A.er * 0.15; }
    if (kind === 'worried') { a = side * -24; dy = -A.er * 0.35; }
    if (kind === 'angry') { a = side * 24; dy = A.er * 0.15; }
    if (kind === 'furious') { a = side * 34; dy = A.er * 0.3; }
    if (kind === 'annoyed') { a = side * 12; dy = A.er * 0.1; }
    const bar = [[x - w / 2, y - t / 2], [x + w / 2, y - t / 2 - t * 0.2], [x + w / 2, y + t / 2], [x - w / 2, y + t / 2]];
    out.push(poly(rotPts(shift(bar, 0, dy), a, x, y + dy), A.brow));
  }
  return h('g', { 'data-part': 'brows' }, out);
}

function mouthShape(A, kind) {
  const x = A.mx !== undefined ? A.mx : A.cx + A.ed * 0.3;
  const y = A.my;
  const w = A.mw;
  const lw = A.lw;
  const M = A.mouth;
  if (A.beak) return null;
  switch (kind) {
    case 'flat': return h('g', { 'data-part': 'mouth' }, [inkLine([[x - w * 0.3, y], [x + w * 0.3, y]], lw * 1.3)]);
    case 'smile': {
      const p = [];
      for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI; p.push([x - Math.cos(a) * w * 0.38, y + Math.sin(a) * w * 0.18]); }
      return h('g', { 'data-part': 'mouth' }, [inkLine(p, lw * 1.3)]);
    }
    case 'grin': {
      const top = y - w * 0.08;
      const shape = [[x - w * 0.5, top], [x + w * 0.5, top], [x + w * 0.42, top + w * 0.25], [x + w * 0.2, top + w * 0.42], [x - w * 0.2, top + w * 0.42], [x - w * 0.42, top + w * 0.25]];
      const teeth = [[x - w * 0.46, top + 1], [x + w * 0.46, top + 1], [x + w * 0.4, top + w * 0.12], [x - w * 0.4, top + w * 0.12]];
      const tongue = [[x - w * 0.22, top + w * 0.4], [x - w * 0.12, top + w * 0.27], [x + w * 0.14, top + w * 0.27], [x + w * 0.22, top + w * 0.4]];
      return h('g', { 'data-part': 'mouth' }, [poly(shape, M[2]), poly(tongue, M[0]), poly(teeth, A.white), outlined(shape, 'none', lw)]);
    }
    case 'sad': {
      const p = [];
      for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI; p.push([x - Math.cos(a) * w * 0.32, y + w * 0.12 - Math.sin(a) * w * 0.16]); }
      return h('g', { 'data-part': 'mouth' }, [inkLine(p, lw * 1.3)]);
    }
    case 'sob': {
      const shape = [[x - w * 0.5, y - w * 0.05], [x - w * 0.2, y - w * 0.16], [x + w * 0.2, y - w * 0.08], [x + w * 0.5, y - w * 0.16], [x + w * 0.42, y + w * 0.36], [x - w * 0.42, y + w * 0.3]];
      const tongue = [[x - w * 0.3, y + w * 0.3], [x - w * 0.1, y + w * 0.16], [x + w * 0.18, y + w * 0.18], [x + w * 0.32, y + w * 0.34]];
      return h('g', { 'data-part': 'mouth' }, [poly(shape, M[2]), poly(tongue, M[0]), outlined(shape, 'none', lw)]);
    }
    case 'tight': return h('g', { 'data-part': 'mouth' }, [inkLine([[x - w * 0.16, y + w * 0.06], [x - w * 0.02, y + w * 0.01], [x + w * 0.16, y + w * 0.05]], lw * 1.4)]);
    case 'teeth': {
      const box = [[x - w * 0.45, y - w * 0.14], [x + w * 0.45, y - w * 0.14], [x + w * 0.4, y + w * 0.18], [x - w * 0.4, y + w * 0.18]];
      const lines = [inkLine([[x - w * 0.42, y + w * 0.02], [x + w * 0.42, y + w * 0.02]], lw * 0.7)];
      for (let i = -2; i <= 2; i++) lines.push(inkLine([[x + i * w * 0.15, y - w * 0.14], [x + i * w * 0.15, y + w * 0.18]], lw * 0.7));
      return h('g', { 'data-part': 'mouth' }, [poly(box, A.white)].concat(lines, [outlined(box, 'none', lw)]));
    }
    case 'o': {
      const s = ngon(x, y + w * 0.06, w * 0.13, w * 0.16, 8);
      return h('g', { 'data-part': 'mouth' }, [outlined(s, M[2], lw)]);
    }
    case 'tall': {
      const s = ngon(x, y + w * 0.16, w * 0.22, w * 0.36, 10);
      const tg = ngon(x, y + w * 0.36, w * 0.14, w * 0.1, 6);
      return h('g', { 'data-part': 'mouth' }, [poly(s, M[2]), poly(tg, M[0]), outlined(s, 'none', lw)]);
    }
    case 'wavy': {
      const p = [];
      for (let i = 0; i <= 6; i++) p.push([x - w * 0.36 + (i * w * 0.72) / 6, y + (i % 2 ? -1 : 1) * w * 0.06]);
      return h('g', { 'data-part': 'mouth' }, [inkLine(p, lw * 1.2)]);
    }
    case 'wavyOpen': {
      const topL = [];
      const botL = [];
      for (let i = 0; i <= 6; i++) {
        const xx = x - w * 0.45 + (i * w * 0.9) / 6;
        topL.push([xx, y - w * 0.1 + (i % 2 ? -1 : 1) * w * 0.05]);
        botL.push([xx, y + w * 0.3 + (i % 2 ? 1 : -1) * w * 0.05]);
      }
      const shape = topL.concat(botL.reverse());
      const teethTop = [[x - w * 0.36, y - w * 0.08], [x + w * 0.36, y - w * 0.08], [x + w * 0.32, y + w * 0.03], [x - w * 0.32, y + w * 0.03]];
      const teethBot = [[x - w * 0.32, y + w * 0.18], [x + w * 0.32, y + w * 0.18], [x + w * 0.36, y + w * 0.27], [x - w * 0.36, y + w * 0.27]];
      return h('g', { 'data-part': 'mouth' }, [poly(shape, M[2]), poly(teethTop, A.white), poly(teethBot, A.white), outlined(shape, 'none', lw)]);
    }
    default: return null;
  }
}

const FACE_SPECS = {
  neutral: { eyes: 'open', brows: 'flat', mouth: 'flat' },
  smile: { eyes: 'happy', brows: 'raised', mouth: 'smile' },
  grin: { eyes: 'squint', brows: 'high', mouth: 'grin' },
  sad: { eyes: 'down', brows: 'sad', mouth: 'sad' },
  sob: { eyes: 'squeeze', brows: 'worried', mouth: 'sob' },
  annoyed: { eyes: 'lidded', brows: 'annoyed', mouth: 'tight' },
  furious: { eyes: 'narrow', brows: 'furious', mouth: 'teeth' },
  wide: { eyes: 'wide', brows: 'raised', mouth: 'o' },
  shocked: { eyes: 'huge', brows: 'high', mouth: 'tall' },
  worried: { eyes: 'dart', brows: 'worried', mouth: 'wavy' },
  terrified: { eyes: 'pin', brows: 'worried', mouth: 'wavyOpen' }
};

function faceEyes(A, kind) {
  const nx = A.cx + A.ed;
  const fx = A.cx - A.ed;
  const y = A.ey;
  switch (kind) {
    case 'happy': return h('g', { 'data-part': 'eyes' }, [arcEye(A, fx, y, 0.88, -1), arcEye(A, nx, y, 1, -1)]);
    case 'squint': return h('g', { 'data-part': 'eyes' }, [arcEye(A, fx, y, 0.9, -1, A.lw * 2.2), arcEye(A, nx, y, 1.05, -1, A.lw * 2.2)]);
    case 'squeeze': return h('g', { 'data-part': 'eyes' }, [squeezeEye(A, fx, y, 0.88, 1), squeezeEye(A, nx, y, 1, -1)]);
    case 'down': return eyesPair(A, { py: A.er * 0.35, big: 1.32, tall: 1.3, pupil: 0.62 });
    case 'lidded': {
      const g = eyesPair(A, { py: A.er * 0.15, tall: 0.62 });
      const lids = [];
      for (const [x, sc] of [[fx, 0.88], [nx, 1]]) {
        const rx = A.er * sc;
        const ry = rx * 0.62;
        const lid = [[x - rx, y - ry], [x + rx, y - ry], [x + rx, y - ry * 0.05], [x - rx, y + ry * 0.1]];
        lids.push(poly(lid, A.lid));
        lids.push(inkLine([[x - rx, y + ry * 0.1], [x + rx, y - ry * 0.05]], A.lw * 1.2));
      }
      g.children.push(h('g', { 'data-part': 'lids' }, lids));
      return g;
    }
    case 'narrow': {
      const g = eyesPair(A, { py: A.er * 0.1, pupil: 0.45 });
      const lids = [];
      for (const [x, sc, side] of [[fx, 0.88, -1], [nx, 1, 1]]) {
        const rx = A.er * sc;
        const ry = rx * 1.18;
        const lid = [[x - rx, y - ry], [x + rx, y - ry], [x + rx, y + (side > 0 ? 0.25 : -0.35) * ry], [x - rx, y + (side > 0 ? -0.35 : 0.25) * ry]];
        lids.push(poly(lid, A.lid));
        lids.push(inkLine([lid[3], lid[2]], A.lw * 1.2));
      }
      g.children.push(h('g', { 'data-part': 'lids' }, lids));
      return g;
    }
    case 'wide': return eyesPair(A, { big: 1.38, pupil: 0.4 });
    case 'huge': return eyesPair(A, { big: 1.5, pupil: 0.2 });
    case 'pin': return eyesPair(A, { big: 1.55, pupil: 0.13, tall: 1.3 });
    case 'dart': return eyesPair(A, { big: 1.32, pupil: 0.34, tall: 1.3 });
    default: return eyesPair(A, {});
  }
}

// One face: eyes, brows and mouth. Keys: <k>eyes:<id>, <k>mouth:<id>, <k>pupils.
export function drawFace(faceId, A) {
  const spec = FACE_SPECS[faceId] || FACE_SPECS.neutral;
  const B = Object.assign({}, A, { k: A.k + faceId + ':' });
  const eyes = faceEyes(B, spec.eyes);
  eyes.k = A.k + 'eyes:' + faceId;
  const kids = [brows(B, spec.brows), eyes];
  const m = mouthShape(B, spec.mouth);
  if (m) { m.k = A.k + 'mouth:' + faceId; kids.push(m); }
  return kg(A.k + 'face:' + faceId, {}, kids);
}

export function faceOpenness(faceId) { return FACE_OPEN[faceId] || 0; }

// closed eyes for blinks and faints
export function drawBlink(A) {
  const g = kg(A.k + 'blink', { display: 'none' }, [
    inkLine([[A.cx - A.ed - A.er * 0.85, A.ey + 2], [A.cx - A.ed + A.er * 0.85, A.ey + 2]], A.lw * 1.4),
    inkLine([[A.cx + A.ed - A.er, A.ey + 2], [A.cx + A.ed + A.er, A.ey + 2]], A.lw * 1.4)
  ]);
  g.attrs['data-part'] = 'blink';
  return g;
}

// talk mouths: 0 small, 1 medium, 2 wide; plus shout and whisper
export function drawTalkMouths(A) {
  if (A.beak) return [];
  const x = A.mx !== undefined ? A.mx : A.cx + A.ed * 0.3;
  const y = A.my;
  const w = A.mw;
  const M = A.mouth;
  const make = (key, rx, ry, dy) => {
    const s = ngon(x, y + dy, rx, ry, 8);
    const tg = [[x - rx * 0.6, y + dy + ry * 0.55], [x, y + dy + ry * 0.1], [x + rx * 0.6, y + dy + ry * 0.55]];
    const g = kg(A.k + key, { display: 'none', 'data-part': 'talk' }, [
      h('polygon', { points: pts(s), fill: M[2] }), h('polygon', { points: pts(tg), fill: M[0] }),
      h('polygon', { points: pts(s), fill: 'none', stroke: INK, 'stroke-width': num(A.lw), 'stroke-linejoin': 'round' })
    ]);
    return g;
  };
  return [
    make('talk0', w * 0.2, w * 0.08, w * 0.02),
    make('talk1', w * 0.28, w * 0.18, w * 0.08),
    make('talk2', w * 0.36, w * 0.28, w * 0.14),
    make('shout', w * 0.55, w * 0.48, w * 0.3),
    make('whisper', w * 0.1, w * 0.07, 0)
  ];
}

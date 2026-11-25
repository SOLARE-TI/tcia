// Speech and thought balloons (D13.5). Built once per scene; each frame moves, scales and re-aims the tail.
import { clamp } from '../core.mjs';
import { h, kg, pts, num, INK } from './svg.mjs';

export function balloonSize(lines, T) {
  let maxChars = 0;
  for (const l of lines) { let n = 0; for (const ch of l) { if (ch) n++; } if (n > maxChars) maxChars = n; }
  return {
    w: maxChars * 0.6 * T.balloonFontSize + 2 * T.balloonPadding,
    h: lines.length * T.balloonLineHeight + 2 * T.balloonPadding
  };
}

// a cloud of round bumps (4 points each), so the outline reads soft (A74)
function bumpyCloud(w, hh) {
  const out = [];
  const nb = Math.max(9, Math.round((w + hh) / 70));
  const steps = 4;
  for (let j = 0; j < nb; j++) {
    for (let i = 0; i < steps; i++) {
      const u = i / steps;
      const a = ((j + u) / nb) * Math.PI * 2;
      const r = 1 + 0.11 * Math.sin(Math.PI * u);
      out.push([Math.cos(a) * (w / 2 + 10) * r, -hh / 2 + Math.sin(a) * (hh / 2 + 10) * r]);
    }
  }
  return out;
}

// local origin: bottom centre of the balloon body
export function buildBalloon(key, kind, lines, catalog) {
  const T = catalog.text;
  const sz = balloonSize(lines, T);
  const w = sz.w;
  const hh = sz.h;
  const kids = [];
  const white = '#FFFFFF';
  if (kind === 'thought') {
    for (let i = 0; i < 3; i++) {
      const c = h('circle', { cx: '0', cy: '0', r: num([14, 10, 7][i]), fill: white, stroke: INK, 'stroke-width': '4' });
      c.k = key + ':dot' + i;
      kids.push(c);
    }
    kids.push(h('polygon', { points: pts(bumpyCloud(w, hh)), fill: white, stroke: INK, 'stroke-width': '4', 'stroke-linejoin': 'round' }));
  } else {
    const tail = h('polygon', { points: '0,0 1,0 0,1', fill: white, stroke: INK, 'stroke-width': '4', 'stroke-linejoin': 'round' });
    tail.k = key + ':tail';
    kids.push(tail);
    const c = 18;
    kids.push(h('polygon', { points: pts([[-w / 2 + c, -hh], [w / 2 - c, -hh], [w / 2, -hh + c], [w / 2, -c], [w / 2 - c, 0], [-w / 2 + c, 0], [-w / 2, -c], [-w / 2, -hh + c]]), fill: white, stroke: INK, 'stroke-width': '4', 'stroke-linejoin': 'round' }));
    const cover = h('polygon', { points: '0,0 1,0 0,1', fill: white });
    cover.k = key + ':cover';
    kids.push(cover);
  }
  lines.forEach((line, i) => {
    kids.push(h('text', {
      x: '0', y: num(-hh + T.balloonPadding + i * T.balloonLineHeight + T.balloonLineHeight * 0.74),
      'text-anchor': 'middle', 'font-family': T.fontStack, 'font-size': num(T.balloonFontSize), 'font-weight': '700', fill: INK
    }, [line]));
  });
  const g = kg(key, { display: 'none', 'data-part': 'balloon', 'data-balloon': kind }, kids);
  g.bw = w;
  g.bh = hh;
  return g;
}

// Most of one character's body box that a balloon may cover: the area of the body box under the balloon's
// box plus the area under its tail's box, as a share of the body box. Heads are never covered; the tail
// stops TAIL_GAP px from the speaker's head (and over the speaker's own body only the balloon counts).
export const MAX_BODY_OVERLAP = 0.12;
export const TAIL_GAP = 14;
// Longest tail, in viewBox px from where it leaves the balloon to its tip: the balloon follows its
// speaker (smoothly), so a jump or a dash does not stretch the tail across the stage.
export const MAX_TAIL_PX = 230;

// the balloon's offset at age seconds into its beat, along the smoothed track of the speaker's head
// (Catmull-Rom between the planned samples, so it moves without jerks)
export function trackOffset(track, age) {
  if (!track || !track.ages.length) return [0, 0];
  const A = track.ages;
  const O = track.offs;
  if (age <= A[0]) return O[0].slice();
  const n = A.length;
  if (age >= A[n - 1]) return O[n - 1].slice();
  let i = 0;
  while (i < n - 2 && A[i + 1] <= age) i++;
  const u = (age - A[i]) / Math.max(1e-6, A[i + 1] - A[i]);
  const p0 = O[Math.max(0, i - 1)];
  const p1 = O[i];
  const p2 = O[i + 1];
  const p3 = O[Math.min(n - 1, i + 2)];
  const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
  return [cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])];
}

// half-extents of the drawn body around its centre (a thought cloud bulges past its text box)
export function balloonExtent(w, hh, kind) {
  if (kind === 'thought') return [(w / 2 + 10) * 1.11 + 2, (hh / 2 + 10) * 1.11 + 2];
  return [w / 2 + 2, hh / 2 + 2];
}

// One layout for planning and drawing: the balloon at scale s for a plan { dx, top } and a speaker at x
// with head box head. The tail leaves the bottom edge on the speaker's side and ends TAIL_GAP px from
// the head, at the point of the head nearest to it: over the head when the balloon is above, beside it
// when the balloon is beside. Local origin: bottom centre of the body.
export function balloonLayout(w, hh, kind, plan, off, head, s) {
  const sc = s || 1;
  const ext = balloonExtent(w, hh, kind);
  const cx = clamp(plan.cx + off[0], 24 + ext[0], 1896 - ext[0]);
  const top = clamp(plan.top + off[1], 24 + ext[1] - hh / 2, 1056 - hh / 2 - ext[1]);
  const by = top + hh;
  const hx = (head[0] + head[2]) / 2;
  // where the tail leaves the body (local, at full size); the balloon pops in and out around that
  // point, so the tail keeps its length whatever the pop scale
  const base = [clamp((hx - cx) * 0.6, -w / 2 + 40, w / 2 - 40), kind === 'thought' ? ext[1] - hh / 2 - 6 : -4];
  const bw = [cx + base[0], by + base[1]];
  const g = [head[0] - TAIL_GAP, head[1] - TAIL_GAP, head[2] + TAIL_GAP, head[3] + TAIL_GAP];
  let tipW = [clamp(bw[0], g[0], g[2]), clamp(bw[1], g[1], g[3])];
  if (tipW[0] === bw[0] && tipW[1] === bw[1]) tipW = [bw[0], g[1]];
  // local point -> world: bw + sc * (p - base)
  const W = (p) => [bw[0] + sc * (p[0] - base[0]), bw[1] + sc * (p[1] - base[1])];
  const tip = [base[0] + (tipW[0] - bw[0]) / sc, base[1] + (tipW[1] - bw[1]) / sc];
  const b0 = W([-ext[0], -hh / 2 - ext[1]]);
  const b1 = W([ext[0], ext[1] - hh / 2]);
  const body = [b0[0], b0[1], b1[0], b1[1]];
  // the tail (or the dots) exactly as drawn, plus half its outline, in the world
  let tail;
  const dots = [];
  const add = (q) => { tail = tail ? [Math.min(tail[0], q[0]), Math.min(tail[1], q[1]), Math.max(tail[2], q[2]), Math.max(tail[3], q[3])] : q; };
  if (kind === 'thought') {
    const rs = [14, 10, 7];
    const fr = [0.3, 0.62, 1];
    const len = Math.max(1, Math.hypot(tip[0] - base[0], tip[1] - base[1]));
    const ux = (tip[0] - base[0]) / len;
    const uy = (tip[1] - base[1]) / len;
    for (let i = 0; i < 3; i++) {
      const d = Math.max(0, Math.min(len * fr[i], len - rs[i]));
      dots.push([base[0] + ux * d, base[1] + uy * d]);
      const c = W(dots[i]);
      const r = (rs[i] + 2) * sc;
      add([c[0] - r, c[1] - r, c[0] + r, c[1] + r]);
    }
  } else {
    for (const p of [[base[0] - 24, -9], [base[0] + 24, 4], tip]) { const q = W(p); add([q[0] - 2, q[1] - 2, q[0] + 2, q[1] + 2]); }
  }
  return { cx, by, s: sc, base, bw, tip, tipW, body, tail, dots, tailLen: Math.hypot(tipW[0] - bw[0], tipW[1] - bw[1]) };
}

// boxes of a placed balloon (its body, its tail or dots, both) at scale s (the pop-in peaks at 1.05)
export function balloonBoxes(w, hh, kind, plan, off, head, s) {
  const g = balloonLayout(w, hh, kind, plan, off, head, s);
  const box = g.body;
  const tail = g.tail;
  return { box, tail, all: [Math.min(box[0], tail[0]), Math.min(box[1], tail[1]), Math.max(box[2], tail[2]), Math.max(box[3], tail[3])], tip: g.tipW, tailLen: g.tailLen };
}

export function placeBalloon(node, kind, plan, off, head, age, left, out) {
  const key = node.k;
  let s = 1;
  if (age < 0.12) s = 0.6 + (1.05 - 0.6) * (age / 0.12);
  else if (age < 0.18) s = 1.05 - 0.05 * ((age - 0.12) / 0.06);
  if (left < 0.12) s = Math.min(s, Math.max(0.05, left / 0.12));
  // the scale as written, so the tail lands exactly where it is aimed
  s = Math.round(s * 1000) / 1000;
  const g = balloonLayout(node.bw, node.bh, kind, plan, off, head, s);
  out[key] = { display: null, transform: 'translate(' + num(g.bw[0]) + ',' + num(g.bw[1]) + ') scale(' + s + ') translate(' + num(-g.base[0]) + ',' + num(-g.base[1]) + ')' };
  const lx = g.tip[0];
  const ly = g.tip[1];
  const b = g.base;
  if (kind === 'thought') {
    // three dots from the cloud to the tip, the last one ending on it
    for (let i = 0; i < 3; i++) out[key + ':dot' + i] = { cx: num(g.dots[i][0]), cy: num(g.dots[i][1]) };
  } else {
    const x = b[0];
    out[key + ':tail'] = { points: pts([[x - 22, -4], [x + 22, -4], [lx, ly]]) };
    out[key + ':cover'] = { points: pts([[x - 19, -7], [x + 19, -7], [x + 17, 2], [x - 17, 2]]) };
  }
  node.lastPlan = { g, s };
}

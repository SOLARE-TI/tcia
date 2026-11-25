// Virtual SVG tree, colors and low-poly faceting. No DOM: every drawing is a {tag, attrs, children} tree.
import { clamp } from '../core.mjs';

export const INK = '#1F1D2B';

export function h(tag, attrs, children) {
  const at = attrs || {};
  if (at.stroke && at.stroke !== 'none') {
    if (!at['stroke-linejoin']) at['stroke-linejoin'] = 'round';
    if (!at['stroke-linecap']) at['stroke-linecap'] = 'round';
  }
  return { tag, attrs: at, children: children || [] };
}

// Contrast of the facets, 0..1: 0 = one flat fill per part, 1 = the palette's light and shade tones as they are.
// Every facet tone comes from it (A74).
export const FACET_CONTRAST = 0.45;
let contrast = FACET_CONTRAST;

// draw with another contrast (the tests draw with 0 to check that every part turns flat)
export function withFacetContrast(c, fn) {
  const old = contrast;
  contrast = c;
  try { return fn(); } finally { contrast = old; }
}

// tone i of a palette triple (0 light, 1 base, 2 shade) as a facet: between the base and that tone;
// k (0..1) softens it further for large areas such as the ground
export function facetTone(tones, i, k) {
  if (i === 1 || contrast <= 0) return tones[1];
  return mix(tones[1], tones[i], contrast * (k === undefined ? 1 : k));
}

// A keyed group: the DOM layer keeps a handle to it and animates its attributes every frame.
export function kg(key, attrs, children) {
  const n = h('g', attrs, children);
  n.k = key;
  return n;
}

export function num(n) {
  const r = Math.round(n * 10) / 10;
  return (Object.is(r, -0) ? 0 : r).toString();
}

export function pts(arr) {
  let s = '';
  for (let i = 0; i < arr.length; i++) s += (i ? ' ' : '') + num(arr[i][0]) + ',' + num(arr[i][1]);
  return s;
}

// ---------- colors ----------

export function hexRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function rgbHex(c) {
  let s = '#';
  for (let i = 0; i < 3; i++) s += clamp(Math.round(c[i]), 0, 255).toString(16).padStart(2, '0');
  return s.toUpperCase();
}

export function mix(a, b, t) {
  const x = hexRgb(a);
  const y = hexRgb(b);
  return rgbHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

// c' = round(c + (tint - c) * strength), per channel (D13.2)
export function tint(color, light) {
  if (!light || !light.tint || !light.tint.strength) return color;
  return mix(color, light.tint.color, light.tint.strength);
}

export function tintTones(tones, light) { return tones.map((c) => tint(c, light)); }

// Colour context: light plus whether the drawing sits on the far layer (then it fades into sky[2]).
export function paint(tones, cx) {
  let t = tintTones(tones, cx && cx.light);
  if (cx && cx.far) t = t.map((c) => mix(c, cx.light.sky[2], cx.farFade));
  return t;
}

// ---------- geometry ----------

// round shapes get at least 16 vertices (smooth silhouettes); exact keeps n (octagon shadows, gems)
export function ngon(cx, cy, rx, ry, n, rot, exact) {
  const out = [];
  const r0 = rot === undefined || rot === null ? -Math.PI / 2 : rot;
  if (!exact) n = Math.max(n, 16);
  for (let i = 0; i < n; i++) {
    const a = r0 + (i * 2 * Math.PI) / n;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}

export function rect(x, y, w, hh) { return [[x, y], [x + w, y], [x + w, y + hh], [x, y + hh]]; }

// rectangle with cut corners (octagon)
export function chamfer(x, y, w, hh, c) {
  c = Math.min(c, w / 2, hh / 2);
  return [[x + c, y], [x + w - c, y], [x + w, y + c], [x + w, y + hh - c], [x + w - c, y + hh], [x + c, y + hh], [x, y + hh - c], [x, y + c]];
}

// soften a polygon: every corner becomes a small arc (radius r, steps segments)
export function roundPoly(poly, r, steps) {
  const n = poly.length;
  const st = steps || 3;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = poly[i];
    const a = poly[(i + n - 1) % n];
    const b = poly[(i + 1) % n];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]) || 1;
    const lb = Math.hypot(b[0] - p[0], b[1] - p[1]) || 1;
    const rr = Math.min(r, la * 0.45, lb * 0.45);
    const p0 = [p[0] + ((a[0] - p[0]) / la) * rr, p[1] + ((a[1] - p[1]) / la) * rr];
    const p1 = [p[0] + ((b[0] - p[0]) / lb) * rr, p[1] + ((b[1] - p[1]) / lb) * rr];
    for (let k = 0; k <= st; k++) {
      const t = k / st;
      // quadratic Bézier through the corner, sampled
      const x = (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p[0] + t * t * p1[0];
      const y = (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p[1] + t * t * p1[1];
      out.push([x, y]);
    }
  }
  return out;
}

export function shift(poly, dx, dy) { return poly.map((p) => [p[0] + dx, p[1] + dy]); }
export function scalePts(poly, sx, sy, ox, oy) {
  ox = ox || 0; oy = oy || 0;
  return poly.map((p) => [ox + (p[0] - ox) * sx, oy + (p[1] - oy) * sy]);
}
export function mirrorX(poly) { return poly.map((p) => [-p[0], p[1]]).reverse(); }
export function rotPts(poly, deg, ox, oy) {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  ox = ox || 0; oy = oy || 0;
  return poly.map((p) => [ox + (p[0] - ox) * c - (p[1] - oy) * s, oy + (p[0] - ox) * s + (p[1] - oy) * c]);
}

export function centroid(poly) {
  let x = 0;
  let y = 0;
  for (const p of poly) { x += p[0]; y += p[1]; }
  return [x / poly.length, y / poly.length];
}

export function bbox(poly) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const p of poly) {
    if (p[0] < x0) x0 = p[0];
    if (p[1] < y0) y0 = p[1];
    if (p[0] > x1) x1 = p[0];
    if (p[1] > y1) y1 = p[1];
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

// keep the part of a convex polygon where nx*x + ny*y <= d (Sutherland–Hodgman, one plane)
export function clipHalf(poly, nx, ny, d) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = nx * a[0] + ny * a[1] - d;
    const db = nx * b[0] + ny * b[1] - d;
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

// polygon outline of a thick bent stroke (for limbs, tails, streams): list of centre points and widths
export function ribbon(points, widths) {
  const left = [];
  const right = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    let dx = b[0] - a[0];
    let dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    const w = (Array.isArray(widths) ? widths[i] : widths) / 2;
    left.push([p[0] - dy * w, p[1] + dx * w]);
    right.push([p[0] + dy * w, p[1] - dx * w]);
  }
  return left.concat(right.reverse());
}

// ---------- faceting ----------

// Direction towards the light: up and to the left (D13.2). Mirrored builds pass lx = -1.
const LIGHT_X = -0.6;
const LIGHT_Y = -0.8;

function toneFor(nx, ny, lx, hiT, loT) {
  const d = nx * LIGHT_X * lx + ny * LIGHT_Y;
  if (d > hiT) return 0;
  if (d < loT) return 2;
  return 1;
}

function edgeNormals(poly) {
  const c = centroid(poly);
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    let nx = b[1] - a[1];
    let ny = -(b[0] - a[0]);
    const l = Math.hypot(nx, ny) || 1;
    nx /= l; ny /= l;
    const mx = (a[0] + b[0]) / 2 - c[0];
    const my = (a[1] + b[1]) / 2 - c[1];
    if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }
    out.push([nx, ny]);
  }
  return out;
}

function projectOnSeg(p, r0, r1) {
  const dx = r1[0] - r0[0];
  const dy = r1[1] - r0[1];
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-6) return [r0[0], r0[1]];
  const t = clamp(((p[0] - r0[0]) * dx + (p[1] - r0[1]) * dy) / l2, 0, 1);
  return [r0[0] + dx * t, r0[1] + dy * t];
}

// Facet polygons of a convex-ish shape. Returns [{poly, tone}] with consecutive equal tones merged.
export function facets(poly, opts) {
  const o = opts || {};
  const lx = o.lx === -1 ? -1 : 1;
  const hiT = o.hi === undefined ? 0.42 : o.hi;
  const loT = o.lo === undefined ? -0.5 : o.lo;
  const n = poly.length;
  const normals = edgeNormals(poly);
  const tones = normals.map((nn) => toneFor(nn[0], nn[1], lx, hiT, loT));
  const bb = bbox(poly);
  const c = centroid(poly);
  const size = Math.max(bb.w, bb.h);
  let r0;
  let r1;
  if (o.ridge) { r0 = o.ridge[0]; r1 = o.ridge[1]; }
  else {
    const off = o.apexOffset === undefined ? 0.1 : o.apexOffset;
    const ap = o.apex || [c[0] - LIGHT_X * lx * off * size, c[1] - LIGHT_Y * off * size];
    r0 = ap; r1 = ap;
  }
  const proj = poly.map((p) => projectOnSeg(p, r0, r1));
  // start at a tone change so runs do not wrap around
  let start = 0;
  for (let i = 0; i < n; i++) { if (tones[i] !== tones[(i + n - 1) % n]) { start = i; break; } }
  const out = [];
  let i = 0;
  while (i < n) {
    const e0 = (start + i) % n;
    const tone = tones[e0];
    let j = i;
    while (j + 1 < n && tones[(start + j + 1) % n] === tone) j++;
    const rim = [];
    const inner = [];
    for (let k = i; k <= j + 1; k++) {
      const vi = (start + k) % n;
      rim.push(poly[vi]);
      inner.push(proj[vi]);
    }
    const shape = rim.concat(dedupe(inner.reverse()));
    out.push({ poly: shape, tone });
    i = j + 1;
  }
  return out;
}

function dedupe(list) {
  const out = [];
  for (const p of list) {
    const q = out[out.length - 1];
    if (!q || Math.abs(q[0] - p[0]) > 0.05 || Math.abs(q[1] - p[1]) > 0.05) out.push(p);
  }
  return out;
}

// One drawable part: facets in their 2–3 flat tones, then the ink silhouette (D13.2).
function faceted(kids, poly, tones, o) {
  // the full silhouette in the base tone goes underneath, so no seams show between facets
  if (o.flat) {
    kids.push(h('polygon', { points: pts(poly), fill: o.flatTone === undefined || o.flatTone === 1 ? tones[1] : facetTone(tones, o.flatTone) }));
    return;
  }
  const base = h('polygon', { points: pts(poly), fill: tones[1] });
  base.silhouette = true;
  kids.push(base);
  if (contrast <= 0) return;
  for (const f of facets(poly, o)) {
    if (f.tone === 1) continue;
    const col = facetTone(tones, f.tone);
    const n = h('polygon', { points: pts(f.poly), fill: col, stroke: col, 'stroke-width': '1' });
    n.facet = true;
    kids.push(n);
  }
}

export function part(name, poly, tones, opts) {
  const o = opts || {};
  const kids = [];
  faceted(kids, poly, tones, o);
  if (o.outline !== false) {
    kids.push(h('polygon', { points: pts(poly), fill: 'none', stroke: o.ink || INK, 'stroke-width': num(o.sw || 4) }));
  }
  const attrs = { 'data-part': name };
  if (o.transform) attrs.transform = o.transform;
  const g = h('g', attrs, kids);
  if (o.k) g.k = o.k;
  return g;
}

// A part made of several polygons that share the same tone set (each faceted on its own).
export function multiPart(name, polys, tones, opts) {
  const o = opts || {};
  const kids = [];
  for (const poly of polys) {
    faceted(kids, poly, tones, o);
    if (o.outline !== false) kids.push(h('polygon', { points: pts(poly), fill: 'none', stroke: o.ink || INK, 'stroke-width': num(o.sw || 4) }));
  }
  const attrs = { 'data-part': name };
  if (o.transform) attrs.transform = o.transform;
  const g = h('g', attrs, kids);
  if (o.k) g.k = o.k;
  return g;
}

// Flat shape with no ink outline (marks, glints, lines)
export function flat(poly, color, extra) {
  return h('polygon', Object.assign({ points: pts(poly), fill: color }, extra || {}));
}

export function inkLine(points, width, color) {
  return h('polyline', { points: pts(points), fill: 'none', stroke: color || INK, 'stroke-width': num(width || 4), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
}

// ---------- continuous limbs ----------
// One limb = one silhouette (the ink polyline, marked data-limb), its base fill on top and a light strip.
// The points come from the skeleton every frame, so elbows and knees bend without gaps or steps.
// A sleeve or a shorts leg (cloth) is drawn the same way over its limb, marked data-cloth instead.
export function limb(key, name, width, tones, cloth) {
  const w = num(width);
  const mark = {};
  mark[cloth ? 'data-cloth' : 'data-limb'] = name;
  const ink = h('polyline', Object.assign({ points: '0,0 0,0', fill: 'none', stroke: INK, 'stroke-width': num(width + 7) }, mark));
  ink.k = key + ':ink';
  const fill = h('polyline', { points: '0,0 0,0', fill: 'none', stroke: tones[1], 'stroke-width': w });
  fill.k = key + ':fill';
  const kids = [ink, fill];
  if (contrast > 0) {
    const hi = h('polyline', { points: '0,0 0,0', fill: 'none', stroke: facetTone(tones, 0), 'stroke-width': num(width * 0.34) });
    hi.k = key + ':hi';
    hi.facet = true;
    kids.push(hi);
  }
  const g = h('g', { 'data-part': name }, kids);
  g.limbKey = key;
  g.limbWidth = width;
  return g;
}

// write a limb's points (already rounded strings are shared by the joints that touch them)
export function limbPoints(out, key, points, width, lx) {
  const s = pts(points);
  out[key + ':ink'] = { points: s };
  out[key + ':fill'] = { points: s };
  if (FACET_CONTRAST > 0) {
    const off = width * 0.18;
    const dx = -0.6 * (lx === -1 ? -1 : 1) * off;
    const dy = -0.8 * off;
    out[key + ':hi'] = { points: pts(points.map((p) => [p[0] + dx, p[1] + dy])) };
  }
}

// round to the precision the SVG is written with, so two parts that touch share the same numbers
export function snap(p) { return [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]; }

// ---------- 2D affine matrices for forward kinematics ----------

export function mIdent() { return [1, 0, 0, 1, 0, 0]; }
export function mMul(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]
  ];
}
export function mTrans(x, y) { return [1, 0, 0, 1, x, y]; }
export function mRot(deg) {
  const a = (deg * Math.PI) / 180;
  return [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];
}
export function mScale(sx, sy) { return [sx, 0, 0, sy, 0, 0]; }
export function matStr(m) {
  const r = (v) => { const x = Math.round(v * 10000) / 10000; return (Object.is(x, -0) ? 0 : x).toString(); };
  return 'matrix(' + r(m[0]) + ',' + r(m[1]) + ',' + r(m[2]) + ',' + r(m[3]) + ',' + num(m[4]) + ',' + num(m[5]) + ')';
}
export function mApply(m, p) { return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]]; }

// walk a vnode tree
export function walkTree(node, fn) {
  fn(node);
  for (const c of node.children) if (c && typeof c === 'object') walkTree(c, fn);
}

function escText(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// serialize a vnode tree to SVG markup (tests and stills)
export function serialize(node) {
  if (typeof node === 'string') return escText(node);
  let s = '<' + node.tag;
  for (const k of Object.keys(node.attrs)) {
    const v = node.attrs[k];
    if (v === undefined || v === null) continue;
    s += ' ' + k + '="' + escText(v).replace(/"/g, '&quot;') + '"';
  }
  if (!node.children.length) return s + '/>';
  s += '>';
  for (const c of node.children) s += serialize(c);
  return s + '</' + node.tag + '>';
}

// apply per-key attribute updates to a tree (Node-side stills; the DOM layer does the same on real nodes)
// $order (a comma-separated list of child keys) reorders a keyed group's children: z-order
export function applyOrder(node, order) {
  const keys = String(order).split(',');
  const byKey = new Map();
  for (const c of node.children) if (c && c.k) byKey.set(c.k, c);
  const placed = keys.map((k) => byKey.get(k)).filter(Boolean);
  const rest = node.children.filter((c) => !c || !c.k || keys.indexOf(c.k) < 0);
  node.children = rest.concat(placed);
}

export function applyUpdates(tree, updates) {
  walkTree(tree, (n) => {
    if (n.k && updates[n.k]) {
      const u = updates[n.k];
      for (const a of Object.keys(u)) {
        if (a === '$order') { applyOrder(n, u[a]); continue; }
        if (u[a] === null || u[a] === undefined) delete n.attrs[a];
        else n.attrs[a] = u[a];
      }
    }
  });
  return tree;
}

// ---------- boxes measured on the drawing data (Node and browser alike) ----------

const TF_CACHE = new Map();

export function parseTransform(str) {
  if (!str) return null;
  let m = TF_CACHE.get(str);
  if (m) return m;
  m = mIdent();
  const re = /(translate|rotate|scale|matrix)\(([^)]*)\)/g;
  let r;
  while ((r = re.exec(str))) {
    const v = r[2].split(/[\s,]+/).filter(Boolean).map(Number);
    if (r[1] === 'translate') m = mMul(m, mTrans(v[0], v[1] || 0));
    else if (r[1] === 'scale') m = mMul(m, mScale(v[0], v.length > 1 ? v[1] : v[0]));
    else if (r[1] === 'rotate') {
      if (v.length > 2) m = mMul(mMul(mMul(m, mTrans(v[1], v[2])), mRot(v[0])), mTrans(-v[1], -v[2]));
      else m = mMul(m, mRot(v[0]));
    } else m = mMul(m, [v[0], v[1], v[2], v[3], v[4], v[5]]);
  }
  if (TF_CACHE.size > 20000) TF_CACHE.clear();
  TF_CACHE.set(str, m);
  return m;
}

function parsePts(s) {
  const out = [];
  const parts = String(s).trim().split(/\s+/);
  for (const p of parts) { const i = p.indexOf(','); out.push([Number(p.slice(0, i)), Number(p.slice(i + 1))]); }
  return out;
}

export function boxUnion(a, b) {
  if (!a) return b ? b.slice() : null;
  if (!b) return a;
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}

export function boxesCross(a, b) { return !!(a && b) && a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]; }

export function boxArea(a) { return a ? Math.max(0, a[2] - a[0]) * Math.max(0, a[3] - a[1]) : 0; }

export function boxCross(a, b) {
  if (!boxesCross(a, b)) return 0;
  return (Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * (Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
}

function addPts(acc, M, list, pad) {
  let x0 = acc.b ? acc.b[0] : Infinity;
  let y0 = acc.b ? acc.b[1] : Infinity;
  let x1 = acc.b ? acc.b[2] : -Infinity;
  let y1 = acc.b ? acc.b[3] : -Infinity;
  const sx = Math.hypot(M[0], M[1]);
  const pp = (pad || 0) * sx;
  for (const p of list) {
    const x = M[0] * p[0] + M[2] * p[1] + M[4];
    const y = M[1] * p[0] + M[3] * p[1] + M[5];
    if (x - pp < x0) x0 = x - pp;
    if (y - pp < y0) y0 = y - pp;
    if (x + pp > x1) x1 = x + pp;
    if (y + pp > y1) y1 = y + pp;
  }
  acc.b = [x0, y0, x1, y1];
}

// parsed points of each drawn polygon, kept while its points string stays the same
const PTS_CACHE = new WeakMap();

function shapePoints(n, u) {
  const t = n.tag;
  if (t === 'polygon' || t === 'polyline') {
    const s = u && u.points !== undefined ? u.points : n.attrs.points;
    const c = PTS_CACHE.get(n);
    if (c && c.s === s) return c.p;
    const p = parsePts(s);
    PTS_CACHE.set(n, { s, p });
    return p;
  }
  if (t === 'circle') {
    const cx = Number(u && u.cx !== undefined ? u.cx : n.attrs.cx);
    const cy = Number(u && u.cy !== undefined ? u.cy : n.attrs.cy);
    const r = Number(n.attrs.r);
    return [[cx - r, cy - r], [cx + r, cy - r], [cx + r, cy + r], [cx - r, cy + r]];
  }
  if (t === 'rect') {
    const x = Number(n.attrs.x); const y = Number(n.attrs.y); const w = Number(n.attrs.width); const hh = Number(n.attrs.height);
    return [[x, y], [x + w, y], [x + w, y + hh], [x, y + hh]];
  }
  return null;
}

// Walk a drawing (vnode tree) with the attribute updates of the current frame and measure, in the
// coordinates of M: the whole visible box, the head box (data-box="head") and each visible effect.
export function measure(node, M, upd, res) {
  const r = res || { box: { b: null }, head: { b: null }, fx: [] };
  walkMeasure(node, M, upd || {}, r, null, false);
  return { box: r.box.b, head: r.head.b, fx: r.fx };
}

function walkMeasure(n, M, upd, r, fxAcc, inHead) {
  if (!n || typeof n !== 'object') return;
  const u = n.k ? upd[n.k] : null;
  const disp = u && u.display !== undefined ? u.display : n.attrs.display;
  if (disp === 'none') return;
  const tf = u && u.transform !== undefined ? u.transform : n.attrs.transform;
  const m = tf ? mMul(M, parseTransform(tf)) : M;
  let acc = fxAcc;
  if (!acc && n.attrs['data-fx'] !== undefined) {
    acc = { key: n.k || null, fx: n.attrs['data-fx'], b: null };
    r.fx.push(acc);
  }
  const head = inHead || n.attrs['data-box'] === 'head';
  if (n.tag === 'g' || n.tag === 'svg') {
    for (const c of n.children) walkMeasure(c, m, upd, r, acc, head);
    return;
  }
  const list = shapePoints(n, u);
  if (!list) return;
  const stroked = n.tag === 'polyline' && n.attrs.stroke && n.attrs.stroke !== 'none';
  const pad = stroked ? Number(n.attrs['stroke-width'] || 0) / 2 : 0;
  if (acc) addPts(acc, m, list, pad);
  else {
    addPts(r.box, m, list, pad);
    if (head) addPts(r.head, m, list, pad);
  }
}

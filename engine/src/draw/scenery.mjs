// Scenery: skies for the 4 lights, the 8 bases (ground + far backdrop) and the 34 pieces.
// Pieces are drawn with their origin at the bottom centre; the scene places and scales them.
import { clamp, seededRandom } from '../core.mjs';
import { h, part, multiPart, paint, ngon, chamfer, rect, mix, num, pts, inkLine, ribbon, INK, flat, facetTone } from './svg.mjs';
import { star4 } from './effects.mjs';

function mat(ctx, name) { return paint(ctx.catalog.palettes.materials[name].tones, ctx); }
function cloth(ctx, name) { return paint(ctx.catalog.palettes.clothing[name || 'blue'].tones, ctx); }
function lightTones(ctx, color) {
  let t = [mix(color, '#FFFFFF', 0.35), color, mix(color, INK, 0.18)];
  if (ctx.far) t = t.map((c) => mix(c, ctx.light.sky[2], ctx.farFade));
  return t;
}
function glow(ctx, cx, cy, r) {
  if (!ctx.light.lampsOn) return null;
  return h('g', { 'data-part': 'glow' }, [h('polygon', { points: pts(ngon(cx, cy, r, r, 8)), fill: ctx.light.lampGlow, opacity: '0.35' })]);
}
function windowsGrid(ctx, x0, y0, w, hh, cols, rows, name) {
  const win = lightTones(ctx, ctx.light.window);
  const polys = [];
  const gx = w / cols;
  const gy = hh / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) polys.push(rect(x0 + i * gx + gx * 0.2, y0 + j * gy + gy * 0.18, gx * 0.6, gy * 0.6));
  return multiPart(name || 'windows', polys, win, { flat: true, flatTone: 1, sw: 3 });
}

// ---------- pieces ----------

const PIECE_DRAW = {
  tree(ctx, W, H, v) {
    const tall = v === 'tall';
    const trunk = [[-W * 0.07, 0], [W * 0.07, 0], [W * 0.05, -H * 0.5], [-W * 0.05, -H * 0.5]];
    const canopy = tall ? ngon(0, -H * 0.62, W * 0.34, H * 0.38, 9) : [[-W * 0.5, -H * 0.55], [-W * 0.38, -H * 0.86], [-W * 0.05, -H], [W * 0.34, -H * 0.94], [W * 0.5, -H * 0.62], [W * 0.38, -H * 0.36], [0, -H * 0.3], [-W * 0.38, -H * 0.34]];
    return [part('trunk', trunk, mat(ctx, 'trunk'), {}), part('canopy', canopy, mat(ctx, 'leaf'), { apexOffset: 0.15 })];
  },
  pine(ctx, W, H) {
    const t = mat(ctx, 'pine');
    const tiers = [];
    for (let i = 0; i < 3; i++) {
      const y0 = -H * (0.18 + i * 0.25);
      const w = W * (0.5 - i * 0.11);
      tiers.push([[-w, y0], [w, y0], [0, y0 - H * 0.42]]);
    }
    return [part('trunk', [[-W * 0.08, 0], [W * 0.08, 0], [W * 0.08, -H * 0.2], [-W * 0.08, -H * 0.2]], mat(ctx, 'trunk'), {}), multiPart('pine', tiers, t, {})];
  },
  palm(ctx, W, H) {
    const trunkPts = [[0, 0], [W * 0.06, -H * 0.3], [W * 0.18, -H * 0.6], [W * 0.3, -H * 0.82]];
    const top = trunkPts[3];
    const fronds = [];
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI + (i / 5) * Math.PI;
      const tip = [top[0] + Math.cos(a) * W * 0.55, top[1] + Math.sin(a) * H * 0.16 + (Math.abs(Math.cos(a)) > 0.6 ? H * 0.12 : 0)];
      fronds.push([[top[0], top[1] - 6], [ (top[0] + tip[0]) / 2, (top[1] + tip[1]) / 2 - H * 0.07], tip, [(top[0] + tip[0]) / 2, (top[1] + tip[1]) / 2 + 6]]);
    }
    return [part('trunk', ribbon(trunkPts, [W * 0.13, W * 0.11, W * 0.1, W * 0.09]), mat(ctx, 'trunk'), {}),
      multiPart('fronds', fronds, mat(ctx, 'leaf'), { sw: 3 }),
      h('g', { 'data-part': 'coconuts' }, [h('circle', { cx: num(top[0] - 8), cy: num(top[1] + 12), r: '12', fill: mat(ctx, 'trunk')[2] }), h('circle', { cx: num(top[0] + 12), cy: num(top[1] + 14), r: '12', fill: mat(ctx, 'trunk')[2] })])];
  },
  bush(ctx, W, H) {
    const pl = [];
    for (let i = 0; i <= 8; i++) { const a = Math.PI + (i / 8) * Math.PI; const r = i % 2 ? 1 : 0.88; pl.push([Math.cos(a) * W * 0.5 * r, -H * 0.1 + Math.sin(a) * H * 0.9 * r]); }
    pl.push([W * 0.42, 0], [-W * 0.42, 0]);
    return [part('bush', pl, mat(ctx, 'leaf'), {})];
  },
  flowers(ctx, W, H, v, color) {
    const leaves = [];
    for (let i = 0; i < 4; i++) { const x = -W * 0.36 + i * W * 0.24; leaves.push([[x - W * 0.08, 0], [x + W * 0.08, 0], [x + W * 0.02, -H * 0.55]]); }
    const heads = [];
    for (let i = 0; i < 5; i++) { const x = -W * 0.4 + i * W * 0.2; heads.push(ngon(x, -H * (0.6 + (i % 2) * 0.25), W * 0.08, W * 0.08, 6)); }
    return [multiPart('leaves', leaves, mat(ctx, 'leaf'), { sw: 3 }), multiPart('blooms', heads, cloth(ctx, color), { sw: 3 })];
  },
  rock(ctx, W, H) {
    return [part('rock', [[-W * 0.5, 0], [-W * 0.42, -H * 0.62], [-W * 0.1, -H], [W * 0.3, -H * 0.86], [W * 0.5, -H * 0.3], [W * 0.46, 0]], mat(ctx, 'rock'), {})];
  },
  log(ctx, W, H) {
    return [part('log', [[-W * 0.5, -H * 0.05], [W * 0.42, -H * 0.05], [W * 0.42, -H * 0.95], [-W * 0.5, -H * 0.95]], mat(ctx, 'trunk'), {}),
      part('log_end', ngon(W * 0.42, -H * 0.5, H * 0.3, H * 0.46, 8), mat(ctx, 'wood'), {})];
  },
  hill(ctx, W, H) {
    return [part('hill', [[-W * 0.5, 0], [-W * 0.36, -H * 0.55], [-W * 0.14, -H * 0.92], [W * 0.1, -H], [W * 0.32, -H * 0.72], [W * 0.5, 0]], mat(ctx, 'grass'), { apexOffset: 0.05 })];
  },
  mountain(ctx, W, H, v) {
    const m = [[-W * 0.5, 0], [-W * 0.12, -H * 0.9], [0, -H], [W * 0.14, -H * 0.86], [W * 0.5, 0]];
    const out = [part('mountain', m, mat(ctx, 'rock'), { apexOffset: 0 })];
    if (v === 'snowy') out.push(part('snow', [[-W * 0.12, -H * 0.9], [0, -H], [W * 0.14, -H * 0.86], [W * 0.2, -H * 0.66], [W * 0.08, -H * 0.72], [-W * 0.02, -H * 0.62], [-W * 0.1, -H * 0.7], [-W * 0.2, -H * 0.64]], mat(ctx, 'snow'), {}));
    return out;
  },
  cloud(ctx, W, H) {
    const c = lightTones(ctx, ctx.light.cloud);
    const bumps = [[-0.3, 0.42, 0.22], [-0.05, 0.62, 0.28], [0.24, 0.5, 0.24]];
    const polys = [[[-W * 0.5, 0], [-W * 0.42, -H * 0.42], [W * 0.42, -H * 0.42], [W * 0.5, 0]]];
    for (const [bx, by, br] of bumps) polys.push(ngon(W * bx, -H * by, W * br, H * by * 0.9, 8));
    return [multiPart('cloud', polys, [c[0], c[0], c[1]], { sw: 3, outline: false }), h('g', { 'data-part': 'cloud_line' }, [inkLine([[-W * 0.5, 0], [W * 0.5, 0]], 4, c[2])])];
  },
  water(ctx, W, H, v) {
    const t = mat(ctx, 'water');
    if (v === 'stream') return [part('water', [[-W * 0.5, 0], [-W * 0.46, -H * 0.5], [W * 0.5, -H * 0.62], [W * 0.46, 0]], t, { sw: 3 }), h('g', { 'data-part': 'ripples' }, [inkLine([[-W * 0.3, -H * 0.3], [-W * 0.1, -H * 0.3]], 3, t[0]), inkLine([[W * 0.1, -H * 0.35], [W * 0.3, -H * 0.35]], 3, t[0])])];
    return [part('water', ngon(0, -H * 0.4, W * 0.5, H * 0.42, 10), t, { sw: 3 }), h('g', { 'data-part': 'ripples' }, [inkLine([[-W * 0.2, -H * 0.45], [W * 0.05, -H * 0.45]], 3, t[0])])];
  },
  sand(ctx, W, H) {
    return [part('sand', [[-W * 0.5, 0], [-W * 0.3, -H * 0.7], [W * 0.05, -H], [W * 0.36, -H * 0.6], [W * 0.5, 0]], mat(ctx, 'sand'), {})];
  },
  building(ctx, W, H, v, color) {
    let w = W;
    let hh = H;
    if (v === 'short') hh = H * 0.55;
    if (v === 'wide') { w = W * 1.4; hh = H * 0.62; }
    const walls = cloth(ctx, color);
    const cols = v === 'wide' ? 5 : 3;
    const rows = v === 'tall' ? 6 : 3;
    return [part('building', rect(-w / 2, -hh, w, hh), walls, { apexOffset: 0 }),
      part('roof', rect(-w / 2 - 10, -hh - 18, w + 20, 22), mat(ctx, 'concrete'), { flat: true, flatTone: 2, sw: 3 }),
      windowsGrid(ctx, -w / 2 + w * 0.06, -hh + hh * 0.06, w * 0.88, hh * 0.82, cols, rows)];
  },
  house(ctx, W, H, v, color) {
    const two = v === 'two_story';
    const hh = two ? H * 0.72 : H * 0.5;
    const walls = cloth(ctx, color);
    const roof = [[-W * 0.56, -hh], [0, -H], [W * 0.56, -hh]];
    const out = [part('house', rect(-W / 2, -hh, W, hh), walls, { apexOffset: 0 }), part('roof', roof, mat(ctx, 'brick'), {}),
      part('door', rect(-W * 0.1, -H * 0.3, W * 0.2, H * 0.3), mat(ctx, 'wood'), { flat: true, sw: 3 })];
    const win = [rect(-W * 0.4, -H * 0.36, W * 0.2, H * 0.17), rect(W * 0.2, -H * 0.36, W * 0.2, H * 0.17)];
    if (two) win.push(rect(-W * 0.4, -H * 0.64, W * 0.2, H * 0.15), rect(W * 0.2, -H * 0.64, W * 0.2, H * 0.15));
    out.push(multiPart('windows', win, lightTones(ctx, ctx.light.window), { flat: true, sw: 3 }));
    return out;
  },
  shop(ctx, W, H, v, color) {
    const walls = cloth(ctx, color);
    const aw = [];
    const n = 6;
    for (let i = 0; i < n; i++) if (i % 2 === 0) aw.push([[-W * 0.52 + (i * W * 1.04) / n, -H * 0.72], [-W * 0.52 + ((i + 1) * W * 1.04) / n, -H * 0.72], [-W * 0.52 + ((i + 1) * W * 1.04) / n, -H * 0.58], [-W * 0.52 + (i * W * 1.04) / n, -H * 0.58]]);
    return [part('shop', rect(-W / 2, -H, W, H), walls, { apexOffset: 0 }),
      part('awning', [[-W * 0.52, -H * 0.72], [W * 0.52, -H * 0.72], [W * 0.52, -H * 0.58], [-W * 0.52, -H * 0.58]], cloth(ctx, 'white'), { flat: true, flatTone: 0, sw: 3 }),
      multiPart('awning_stripes', aw, walls, { flat: true, flatTone: 2, outline: false }),
      multiPart('shop_window', [rect(-W * 0.42, -H * 0.5, W * 0.46, H * 0.32)], lightTones(ctx, ctx.light.window), { flat: true, sw: 3 }),
      part('door', rect(W * 0.12, -H * 0.5, W * 0.26, H * 0.5), mat(ctx, 'wood'), { flat: true, sw: 3 })];
  },
  lamp_post(ctx, W, H) {
    const m = mat(ctx, 'metal');
    const out = [];
    const g = glow(ctx, 0, -H * 0.93, W * 1.6);
    if (g) out.push(g);
    out.push(part('pole', [[-W * 0.14, 0], [W * 0.14, 0], [W * 0.08, -H * 0.88], [-W * 0.08, -H * 0.88]], m, { flat: true, sw: 3 }));
    out.push(part('lamp', [[-W * 0.4, -H * 0.86], [W * 0.4, -H * 0.86], [W * 0.26, -H], [-W * 0.26, -H]], m, { sw: 3 }));
    out.push(part('bulb', rect(-W * 0.22, -H * 0.97, W * 0.44, H * 0.08), lightTones(ctx, ctx.light.lampsOn ? ctx.light.lampGlow : ctx.light.window), { flat: true, sw: 2.5 }));
    return out;
  },
  bench(ctx, W, H) {
    const w = mat(ctx, 'wood');
    const m = mat(ctx, 'metal');
    return [multiPart('bench_legs', [rect(-W * 0.42, -H * 0.8, W * 0.06, H * 0.8), rect(W * 0.36, -H * 0.8, W * 0.06, H * 0.8)], m, { flat: true, sw: 3 }),
      multiPart('bench', [rect(-W / 2, -H * 0.86, W, H * 0.14), rect(-W / 2, -H * 1.18, W, H * 0.12)], w, { sw: 3 })];
  },
  fence(ctx, W, H) {
    const posts = [];
    for (let i = 0; i < 5; i++) { const x = -W / 2 + i * (W / 4); posts.push([[x - 9, 0], [x + 9, 0], [x + 9, -H * 0.85], [x, -H], [x - 9, -H * 0.85]]); }
    const rails = [rect(-W / 2, -H * 0.72, W, H * 0.12), rect(-W / 2, -H * 0.36, W, H * 0.12)];
    return [multiPart('rails', rails, mat(ctx, 'wood'), { flat: true, sw: 3 }), multiPart('posts', posts, mat(ctx, 'wood'), { sw: 3 })];
  },
  trash_can(ctx, W, H) {
    const m = mat(ctx, 'metal');
    return [part('can', [[-W * 0.42, 0], [W * 0.42, 0], [W * 0.5, -H * 0.86], [-W * 0.5, -H * 0.86]], m, {}),
      part('lid', [[-W * 0.56, -H * 0.84], [W * 0.56, -H * 0.84], [W * 0.4, -H], [-W * 0.4, -H]], m, { flat: true, flatTone: 2, sw: 3 })];
  },
  hydrant(ctx, W, H, v, color) {
    const c = cloth(ctx, color);
    return [part('hydrant', [[-W * 0.34, 0], [W * 0.34, 0], [W * 0.3, -H * 0.72], [W * 0.16, -H * 0.92], [0, -H], [-W * 0.16, -H * 0.92], [-W * 0.3, -H * 0.72]], c, {}),
      part('nozzle', rect(-W * 0.5, -H * 0.6, W, H * 0.14), c, { flat: true, flatTone: 2, sw: 3 })];
  },
  car(ctx, W, H, v, color) {
    const c = cloth(ctx, color);
    const body = [[-W * 0.5, -H * 0.18], [-W * 0.48, -H * 0.5], [-W * 0.28, -H * 0.56], [-W * 0.16, -H * 0.95], [W * 0.22, -H * 0.95], [W * 0.36, -H * 0.56], [W * 0.5, -H * 0.5], [W * 0.5, -H * 0.18]];
    const wheels = [ngon(-W * 0.28, -H * 0.16, H * 0.17, H * 0.17, 8), ngon(W * 0.3, -H * 0.16, H * 0.17, H * 0.17, 8)];
    return [part('car', body, c, {}), multiPart('car_windows', [[[-W * 0.12, -H * 0.88], [W * 0.02, -H * 0.88], [W * 0.02, -H * 0.6], [-W * 0.22, -H * 0.6]], [[W * 0.08, -H * 0.88], [W * 0.2, -H * 0.88], [W * 0.3, -H * 0.6], [W * 0.08, -H * 0.6]]], mat(ctx, 'glass'), { flat: true, flatTone: 0, sw: 3 }),
      multiPart('wheels', wheels, paint(ctx.catalog.palettes.clothing.black.tones, ctx), { sw: 3 })];
  },
  ramp(ctx, W, H) {
    return [part('ramp', [[-W * 0.5, 0], [W * 0.5, -H], [W * 0.5, 0]], mat(ctx, 'wood'), {}),
      h('g', { 'data-part': 'ramp_planks' }, [inkLine([[-W * 0.1, -H * 0.4], [-W * 0.1, 0]], 3), inkLine([[W * 0.2, -H * 0.7], [W * 0.2, 0]], 3)])];
  },
  crate(ctx, W, H) {
    return [part('crate', rect(-W / 2, -H, W, H), mat(ctx, 'wood'), { apexOffset: 0 }),
      h('g', { 'data-part': 'crate_planks' }, [inkLine([[-W / 2, -H], [W / 2, 0]], 4), inkLine([[-W / 2, -H * 0.5], [W / 2, -H * 0.5]], 3)])];
  },
  beach_umbrella(ctx, W, H, v, color) {
    const c = cloth(ctx, color);
    const canopy = [[-W * 0.5, -H * 0.72], [-W * 0.3, -H * 0.92], [0, -H], [W * 0.3, -H * 0.92], [W * 0.5, -H * 0.72]];
    const stripes = [[[-W * 0.3, -H * 0.92], [-W * 0.1, -H * 0.98], [-W * 0.16, -H * 0.72], [-W * 0.34, -H * 0.72]], [[W * 0.1, -H * 0.98], [W * 0.3, -H * 0.92], [W * 0.34, -H * 0.72], [W * 0.16, -H * 0.72]]];
    return [part('pole', [[-5, 0], [5, 0], [5, -H * 0.98], [-5, -H * 0.98]], mat(ctx, 'wood'), { flat: true, sw: 3 }),
      part('umbrella', canopy, c, {}), multiPart('umbrella_stripes', stripes, cloth(ctx, 'white'), { flat: true, flatTone: 0, outline: false })];
  },
  window(ctx, W, H) {
    const lift = H * 0.35;
    const g = cloth(ctx, 'white');
    return [part('window_frame', rect(-W / 2, -H - lift, W, H), mat(ctx, 'wood'), { flat: true, sw: 4 }),
      part('glass', rect(-W * 0.42, -H * 0.93 - lift, W * 0.84, H * 0.86), lightTones(ctx, ctx.light.window), { apexOffset: 0.2 }),
      h('g', { 'data-part': 'window_bars' }, [inkLine([[0, -H * 0.93 - lift], [0, -H * 0.07 - lift]], 5, g[2]), inkLine([[-W * 0.42, -H * 0.5 - lift], [W * 0.42, -H * 0.5 - lift]], 5, g[2])])];
  },
  door(ctx, W, H, v, color) {
    const c = cloth(ctx, color);
    return [part('door', rect(-W / 2, -H, W, H), c, { apexOffset: 0 }),
      multiPart('door_panels', [rect(-W * 0.36, -H * 0.9, W * 0.72, H * 0.34), rect(-W * 0.36, -H * 0.48, W * 0.72, H * 0.34)], c, { flat: true, flatTone: 2, sw: 3 }),
      h('g', { 'data-part': 'knob' }, [h('circle', { cx: num(W * 0.32), cy: num(-H * 0.5), r: '9', fill: paint(['#FFE27A'], ctx)[0], stroke: INK, 'stroke-width': '3' })])];
  },
  table(ctx, W, H) {
    const w = mat(ctx, 'wood');
    return [multiPart('table_legs', [rect(-W * 0.44, -H * 0.86, W * 0.07, H * 0.86), rect(W * 0.37, -H * 0.86, W * 0.07, H * 0.86)], w, { flat: true, flatTone: 2, sw: 3 }),
      part('table', rect(-W / 2, -H, W, H * 0.16), w, {})];
  },
  chair(ctx, W, H) {
    const w = mat(ctx, 'wood');
    return [multiPart('chair_legs', [rect(-W * 0.4, -H * 0.5, W * 0.1, H * 0.5), rect(W * 0.3, -H * 0.5, W * 0.1, H * 0.5)], w, { flat: true, flatTone: 2, sw: 3 }),
      multiPart('chair', [rect(-W * 0.48, -H * 0.56, W * 0.96, H * 0.08), rect(-W * 0.48, -H, W * 0.14, H * 0.46)], w, { sw: 3 })];
  },
  sofa(ctx, W, H, v, color) {
    const c = cloth(ctx, color);
    return [part('sofa_back', rect(-W * 0.46, -H, W * 0.92, H * 0.6), c, { flat: true, flatTone: 2, sw: 3.5 }),
      part('sofa', rect(-W * 0.5, -H * 0.53, W, H * 0.4), c, {}),
      multiPart('sofa_arms', [rect(-W * 0.52, -H * 0.72, W * 0.12, H * 0.6), rect(W * 0.4, -H * 0.72, W * 0.12, H * 0.6)], c, { flat: true, flatTone: 0, sw: 3.5 }),
      multiPart('sofa_feet', [rect(-W * 0.44, -H * 0.13, 18, H * 0.13), rect(W * 0.44 - 18, -H * 0.13, 18, H * 0.13)], mat(ctx, 'wood'), { flat: true, sw: 3 })];
  },
  bed(ctx, W, H, v, color) {
    return [part('bed_frame', [[-W * 0.5, 0], [-W * 0.5, -H], [-W * 0.42, -H], [-W * 0.42, -H * 0.5], [W * 0.5, -H * 0.5], [W * 0.5, 0]], mat(ctx, 'wood'), { sw: 3.5 }),
      part('pillow', chamfer(-W * 0.4, -H * 0.82, W * 0.2, H * 0.22, 8), cloth(ctx, 'white'), { flat: true, flatTone: 0, sw: 3 }),
      part('blanket', [[-W * 0.22, -H * 0.72], [W * 0.5, -H * 0.72], [W * 0.5, -H * 0.38], [-W * 0.22, -H * 0.38]], cloth(ctx, color), {})];
  },
  shelf(ctx, W, H) {
    const w = mat(ctx, 'wood');
    const books = [];
    const cols = ['red', 'blue', 'yellow', 'green'];
    const out = [part('shelf', rect(-W / 2, -H, W, H), w, { flat: true, flatTone: 2, sw: 3.5 }),
      multiPart('boards', [0.3, 0.62, 0.94].map((f) => rect(-W / 2, -H * f, W, 12)), w, { flat: true, flatTone: 0, sw: 3 })];
    for (let i = 0; i < 4; i++) books.push(multiPart('books' + i, [rect(-W * 0.4 + i * W * 0.2, -H * 0.3 - H * 0.2, W * 0.14, H * 0.2), rect(-W * 0.38 + i * W * 0.2, -H * 0.62 - H * 0.18, W * 0.14, H * 0.18)], cloth(ctx, cols[i]), { flat: true, sw: 2.5 }));
    return out.concat(books);
  },
  floor_lamp(ctx, W, H) {
    const out = [];
    const g = glow(ctx, 0, -H * 0.85, W * 1.6);
    if (g) out.push(g);
    out.push(part('lamp_pole', [[-W * 0.4, 0], [W * 0.4, 0], [W * 0.06, -H * 0.06], [W * 0.06, -H * 0.75], [-W * 0.06, -H * 0.75], [-W * 0.06, -H * 0.06]], mat(ctx, 'metal'), { flat: true, sw: 3 }));
    out.push(part('lampshade', [[-W * 0.5, -H * 0.72], [W * 0.5, -H * 0.72], [W * 0.3, -H], [-W * 0.3, -H]], lightTones(ctx, ctx.light.lampsOn ? ctx.light.lampGlow : '#F6E7CF'), {}));
    return out;
  },
  rug(ctx, W, H, v, color) {
    return [part('rug', [[-W * 0.5, 0], [-W * 0.42, -H], [W * 0.42, -H], [W * 0.5, 0]], cloth(ctx, color), { flat: true, sw: 3 }),
      h('g', { 'data-part': 'rug_stripe' }, [inkLine([[-W * 0.36, -H * 0.5], [W * 0.36, -H * 0.5]], 4, cloth(ctx, color)[0])])];
  },
  potted_plant(ctx, W, H) {
    const leaves = [];
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.45; leaves.push([[0, -H * 0.38], [Math.cos(a) * W * 0.6 - 8, -H * 0.38 + Math.sin(a) * H * 0.6], [Math.cos(a) * W * 0.66, -H * 0.38 + Math.sin(a) * H * 0.66], [Math.cos(a) * W * 0.6 + 8, -H * 0.38 + Math.sin(a) * H * 0.6]]); }
    return [multiPart('plant', leaves, mat(ctx, 'leaf'), { sw: 3 }), part('pot', [[-W * 0.36, -H * 0.4], [W * 0.36, -H * 0.4], [W * 0.26, 0], [-W * 0.26, 0]], mat(ctx, 'brick'), {})];
  }
};

export const PIECE_IDS = Object.keys(PIECE_DRAW);

// a piece in local coordinates (bottom centre at 0,0) for a context { catalog, light, far, farFade }
// lit pieces whose drawing has no lamp of its own get a soft halo around their windows when lampsOn
const LIT_HALO = { building: [0.55, 0.6], house: [0.36, 0.5], shop: [0.4, 0.42], window: [0.62, 0.48] };

export function drawPiece(pieceId, variant, color, ctx) {
  const def = ctx.catalog.pieces[pieceId];
  let kids = PIECE_DRAW[pieceId](ctx, def.width, def.height, variant, color || def.defaultColor);
  const halo = LIT_HALO[pieceId];
  if (halo && def.lit && ctx.light.lampsOn) {
    const hh = pieceId === 'window' ? def.height * 1.35 : (variant === 'short' ? def.height * 0.55 : (variant === 'wide' ? def.height * 0.62 : def.height));
    const g = glow(ctx, 0, -hh * halo[1], def.width * halo[0]);
    if (g) kids = [g].concat(kids);
  }
  return h('g', { 'data-piece': pieceId }, kids.filter(Boolean));
}

// ---------- skies ----------

export function drawSky(lightId, ctx, seedKey) {
  const L = ctx.catalog.lights[lightId];
  const horizon = ctx.catalog.stage.horizonY;
  const b1 = horizon * 0.36;
  const b2 = horizon * 0.68;
  const jag = (y, n, amp, seed) => {
    const r = seededRandom(seed);
    const out = [];
    for (let i = 0; i <= n; i++) out.push([(i * 1920) / n, y + (r() - 0.5) * amp]);
    return out;
  };
  const top = jag(b1, 8, 30, 'sky1');
  const mid = jag(b2, 10, 36, 'sky2');
  const kids = [
    h('rect', { x: '0', y: '0', width: '1920', height: num(horizon + 300), fill: L.sky[2] }),
    flat([[0, 0], [1920, 0]].concat(mid.slice().reverse()), L.sky[1]),
    flat([[0, 0], [1920, 0]].concat(top.slice().reverse()), L.sky[0])
  ];
  const sky = h('g', { 'data-part': 'sky' }, kids);
  const out = [sky];
  if (L.stars) {
    const r = seededRandom('stars:' + (seedKey || ''));
    const polys = [];
    for (let i = 0; i < 26; i++) {
      const x = 40 + r() * 1840;
      const y = 30 + r() * (horizon - 140);
      const s = 6 + r() * 8;
      polys.push(h('polygon', { points: pts(star4(x, y, s, s * 0.3)), fill: '#FFF8D6' }));
    }
    out.push(h('g', { 'data-part': 'stars' }, polys));
  }
  if (L.celestial) {
    const c = L.celestial;
    const tones = [mix(c.color, '#FFFFFF', 0.45), c.color, mix(c.color, '#F2826B', c.kind === 'sun' ? 0.25 : 0)];
    if (c.kind === 'sun') {
      const rays = [];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        rays.push(h('polygon', { points: pts([[c.x + Math.cos(a - 0.12) * c.r * 1.15, c.y + Math.sin(a - 0.12) * c.r * 1.15], [c.x + Math.cos(a) * c.r * 1.55, c.y + Math.sin(a) * c.r * 1.55], [c.x + Math.cos(a + 0.12) * c.r * 1.15, c.y + Math.sin(a + 0.12) * c.r * 1.15]]), fill: c.color }));
      }
      out.push(h('g', { 'data-part': 'sunrays' }, rays));
      out.push(part('sun', ngon(c.x, c.y, c.r, c.r, 12), tones, { sw: 4 }));
    } else {
      const moon = [];
      for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + (i / 8) * Math.PI; moon.push([c.x + Math.cos(a) * c.r, c.y + Math.sin(a) * c.r]); }
      for (let i = 8; i >= 0; i--) { const a = -Math.PI / 2 + (i / 8) * Math.PI; moon.push([c.x + Math.cos(a) * c.r * 0.35 - c.r * 0.05, c.y + Math.sin(a) * c.r * 0.92]); }
      out.push(part('moon', moon, tones, { sw: 4 }));
    }
  }
  return h('g', { 'data-light': lightId }, out);
}

// ---------- bases: far backdrop and ground ----------

function groundTop(baseId, ctx) {
  if (baseId === 'beach') return 720;
  if (baseId === 'room') return 720;
  return ctx.catalog.stage.horizonY;
}

function farBackdrop(baseId, fctx) {
  const hz = fctx.catalog.stage.horizonY;
  const r = seededRandom('far:' + baseId);
  switch (baseId) {
    case 'city': {
      const out = [];
      let x = -40;
      while (x < 1960) {
        const w = 90 + r() * 110;
        const hh = 90 + r() * 170;
        out.push(rect(x, hz - hh, w - 10, hh + 4));
        x += w;
      }
      return [multiPart('skyline', out, mat(fctx, 'concrete'), { sw: 3 })];
    }
    case 'forest': {
      const out = [];
      for (let x = -40; x < 1980; x += 70 + r() * 30) { const hh = 110 + r() * 90; out.push([[x - 50, hz + 4], [x, hz - hh], [x + 50, hz + 4]]); }
      return [multiPart('treeline', out, mat(fctx, 'pine'), { sw: 3 })];
    }
    case 'beach': {
      const t = mat(fctx, 'water');
      return [part('sea', [[0, hz - 6], [1920, hz - 10], [1920, 724], [0, 724]], t, { ridge: [[0, 680], [1920, 680]], sw: 3 }),
        h('g', { 'data-part': 'waves' }, [inkLine([[200, 670], [300, 664], [400, 670]], 4, t[0]), inkLine([[900, 690], [1000, 684], [1100, 690]], 4, t[0]), inkLine([[1500, 668], [1600, 662], [1700, 668]], 4, t[0])])];
    }
    case 'mountain': {
      const peaks = [];
      const caps = [];
      for (let i = 0; i < 5; i++) {
        const cx = 180 + i * 400 + r() * 80;
        const hh = 200 + r() * 140;
        const w = 300 + r() * 100;
        peaks.push([[cx - w, hz + 4], [cx, hz - hh], [cx + w, hz + 4]]);
        caps.push([[cx - w * 0.22, hz - hh * 0.78], [cx, hz - hh], [cx + w * 0.22, hz - hh * 0.78], [cx + w * 0.08, hz - hh * 0.72], [cx - w * 0.06, hz - hh * 0.8]]);
      }
      return [multiPart('peaks', peaks, mat(fctx, 'rock'), { sw: 3 }), multiPart('snowcaps', caps, mat(fctx, 'snow'), { flat: true, flatTone: 0, sw: 3 })];
    }
    case 'park': {
      return [multiPart('hills', [[[-100, hz + 4], [200, hz - 120], [520, hz - 150], [800, hz + 4]], [[1100, hz + 4], [1400, hz - 110], [1700, hz - 140], [2020, hz + 4]]], mat(fctx, 'grass'), { sw: 3 })];
    }
    case 'countryside': {
      const hills = [[[-100, hz + 4], [300, hz - 160], [700, hz + 4]], [[500, hz + 4], [1000, hz - 120], [1450, hz + 4]], [[1250, hz + 4], [1650, hz - 170], [2050, hz + 4]]];
      return [multiPart('rolling_hills', hills, mat(fctx, 'grass'), { sw: 3 }),
        h('g', { 'data-part': 'fields' }, [inkLine([[180, hz - 60], [420, hz - 20]], 4, mat(fctx, 'dirt')[0]), inkLine([[1500, hz - 70], [1750, hz - 30]], 4, mat(fctx, 'dirt')[0])])];
    }
    case 'room': {
      const wall = mat(fctx, 'wall');
      return [part('wall', [[0, 0], [1920, 0], [1920, 724], [0, 724]], wall, { flat: true, flatTone: 0, outline: false }),
        multiPart('wall_shade', [[[0, 0], [260, 0], [200, 640], [0, 640]], [[1700, 0], [1920, 0], [1920, 640], [1760, 640]]], wall, { flat: true, flatTone: 1, outline: false }),
        multiPart('wainscot', [rect(0, 640, 1920, 84)], wall, { flat: true, flatTone: 2, sw: 4 }),
        h('g', { 'data-part': 'wall_lines' }, [inkLine([[480, 0], [480, 640]], 3, wall[2]), inkLine([[1440, 0], [1440, 640]], 3, wall[2])])];
    }
    default: return [];
  }
}

function groundTris(top, tones, seed) {
  const r = seededRandom(seed);
  const cols = 6;
  const xs = [];
  for (let i = 0; i <= cols; i++) xs.push((i * 1920) / cols + (i > 0 && i < cols ? (r() - 0.5) * 120 : 0));
  const yMid = top + (1080 - top) * 0.45;
  const tris = [];
  const toneOf = [];
  for (let i = 0; i < cols; i++) {
    const m = yMid + (r() - 0.5) * 60;
    const a = [xs[i], top];
    const b = [xs[i + 1], top];
    const c = [xs[i + 1], 1080];
    const d = [xs[i], 1080];
    const e = [(xs[i] + xs[i + 1]) / 2 + (r() - 0.5) * 80, m];
    tris.push([a, b, e], [b, c, e], [c, d, e], [d, a, e]);
    toneOf.push(i % 2 ? 1 : 0, 1, i % 2 ? 2 : 1, 1);
  }
  const polys = [];
  tris.forEach((t, i) => {
    const n = h('polygon', { points: pts(t), fill: tones[toneOf[i]], stroke: tones[toneOf[i]], 'stroke-width': '1', 'stroke-linejoin': 'round' });
    n.facet = tones[toneOf[i]] !== tones[1];
    polys.push(n);
  });
  return polys;
}

export function drawBase(baseId, ctx, fctx) {
  const B = ctx.catalog.bases[baseId];
  const out = [];
  const farKids = farBackdrop(baseId, baseId === 'room' ? ctx : fctx);
  if (farKids.length) out.push(h('g', { 'data-base-far': B.far }, farKids));
  const top = groundTop(baseId, ctx);
  const gt = mat(ctx, B.ground);
  const groundKids = groundTris(top, [facetTone(gt, 0, 0.66), gt[1], facetTone(gt, 2, 0.5)], 'ground:' + baseId);
  groundKids.push(inkLine([[0, top], [1920, top]], 4));
  out.push(h('g', { 'data-part': 'ground' }, groundKids));
  const acc = B.groundAccent ? mat(ctx, B.groundAccent) : null;
  if (baseId === 'city') {
    out.push(part('road', [[0, 975], [1920, 975], [1920, 1080], [0, 1080]], acc, { ridge: [[0, 1030], [1920, 1030]], sw: 4 }));
    const dashes = [];
    for (let x = 40; x < 1920; x += 200) dashes.push(rect(x, 1022, 110, 12));
    out.push(multiPart('road_lines', dashes, paint(ctx.catalog.palettes.clothing.yellow.tones, ctx), { flat: true, outline: false }));
    out.push(part('curb', rect(0, 958, 1920, 18), mat(ctx, 'concrete'), { flat: true, flatTone: 2, sw: 3 }));
    const tiles = [];
    for (let x = 120; x < 1920; x += 240) tiles.push(inkLine([[x, top + 40], [x - 30, 958]], 3, gt[2]));
    out.push(h('g', { 'data-part': 'tiles' }, tiles));
  } else if (baseId === 'beach') {
    out.push(part('shore', [[0, 718], [1920, 714], [1920, 748], [1300, 756], [700, 742], [0, 752]], acc, { flat: true, flatTone: 0, sw: 3 }));
    out.push(h('g', { 'data-part': 'foam' }, [inkLine([[0, 752], [700, 742], [1300, 756], [1920, 748]], 5, '#FFFFFF')]));
  } else if (baseId === 'mountain') {
    out.push(multiPart('ground_rocks', [ngon(300, 990, 60, 26, 6), ngon(1250, 1020, 80, 30, 7), ngon(1700, 950, 40, 18, 6)], acc, { sw: 3 }));
  } else if (baseId === 'room') {
    const lines = [];
    for (let y = 760; y < 1080; y += 60) lines.push(inkLine([[0, y], [1920, y]], 3, gt[2]));
    out.push(h('g', { 'data-part': 'floorboards' }, lines));
  } else if (acc && (B.groundAccent === 'dirt')) {
    out.push(part('path', [[0, 870], [700, 864], [1300, 872], [1920, 866], [1920, 936], [1200, 944], [600, 938], [0, 944]], acc, { ridge: [[0, 905], [1920, 905]], sw: 3 }));
  }
  return h('g', { 'data-base': baseId }, out);
}

// The 10 hand items (catalog.items), centred on (0, 0). Faceted like everything else.
import { h, part, multiPart, paint, ngon, chamfer, inkLine, rect } from './svg.mjs';
import { star4 } from './effects.mjs';

function T(ctx, group, name) {
  const pal = ctx.catalog.palettes;
  return paint(pal[group][name].tones, ctx);
}

const ITEM_DRAW = {
  ball(s, c) {
    const r = s / 2;
    return [part('ball', ngon(0, 0, r, r, 10), T(c, 'clothing', 'red'), {}),
      part('ball_band', [[-r * 0.95, -r * 0.12], [r * 0.95, -r * 0.12], [r * 0.95, r * 0.12], [-r * 0.95, r * 0.12]], T(c, 'clothing', 'white'), { flat: true, flatTone: 0, sw: 2.5 })];
  },
  book(s, c) {
    const w = s;
    const hh = s * 0.75;
    return [part('book_pages', [[-w * 0.44, -hh * 0.42], [w * 0.5, -hh * 0.42], [w * 0.5, hh * 0.46], [-w * 0.44, hh * 0.46]], T(c, 'clothing', 'white'), { flat: true, flatTone: 0, sw: 3 }),
      part('book', [[-w * 0.5, -hh * 0.5], [w * 0.42, -hh * 0.5], [w * 0.42, hh * 0.4], [-w * 0.5, hh * 0.4]], T(c, 'clothing', 'blue'), { sw: 3.5 })];
  },
  flower(s, c) {
    const r = s * 0.2;
    const petals = [];
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; petals.push(ngon(Math.cos(a) * r * 1.2, -s * 0.22 + Math.sin(a) * r * 1.2, r * 0.75, r * 0.75, 6)); }
    return [part('stem', [[-3, -s * 0.15], [3, -s * 0.15], [3, s * 0.5], [-3, s * 0.5]], T(c, 'materials', 'leaf'), { flat: true, sw: 2.5 }),
      part('leaf', [[0, s * 0.2], [s * 0.3, s * 0.05], [s * 0.18, s * 0.28]], T(c, 'materials', 'leaf'), { sw: 2.5 }),
      multiPart('petals', petals, T(c, 'clothing', 'pink'), { sw: 2.5 }),
      part('flower_eye', ngon(0, -s * 0.22, r * 0.6, r * 0.6, 6), T(c, 'clothing', 'yellow'), { sw: 2.5 })];
  },
  letter(s, c) {
    const w = s;
    const hh = s * 0.66;
    return [part('letter', rect(-w / 2, -hh / 2, w, hh), T(c, 'clothing', 'white'), { sw: 3 }),
      h('g', { 'data-part': 'letter_flap' }, [inkLine([[-w / 2, -hh / 2], [0, hh * 0.08], [w / 2, -hh / 2]], 3)]),
      part('seal', ngon(0, hh * 0.08, s * 0.1, s * 0.1, 6), T(c, 'clothing', 'red'), { flat: true, sw: 2 })];
  },
  key(s, c) {
    const g = T(c, 'clothing', 'yellow');
    return [part('key', ngon(-s * 0.28, 0, s * 0.22, s * 0.22, 8), g, { sw: 3 }),
      part('key_shaft', [[-s * 0.08, -s * 0.07], [s * 0.5, -s * 0.07], [s * 0.5, s * 0.07], [-s * 0.08, s * 0.07]], g, { flat: true, sw: 3 }),
      part('key_teeth', [[s * 0.28, s * 0.05], [s * 0.36, s * 0.05], [s * 0.36, s * 0.2], [s * 0.28, s * 0.2]], g, { flat: true, flatTone: 2, sw: 2 })];
  },
  apple(s, c) {
    const r = s / 2;
    return [part('apple', [[0, -r * 0.62], [r * 0.6, -r * 0.9], [r, -r * 0.25], [r * 0.75, r * 0.7], [0, r * 0.95], [-r * 0.75, r * 0.7], [-r, -r * 0.25], [-r * 0.6, -r * 0.9]], T(c, 'clothing', 'red'), {}),
      part('apple_leaf', [[0, -r * 0.8], [r * 0.5, -r * 1.25], [r * 0.15, -r * 0.75]], T(c, 'materials', 'leaf'), { flat: true, sw: 2.5 }),
      part('apple_stem', [[-2, -r * 0.62], [2, -r * 0.62], [3, -r * 1.15], [-1, -r * 1.15]], T(c, 'materials', 'trunk'), { flat: true, sw: 2 })];
  },
  gift(s, c) {
    const w = s;
    return [part('gift', chamfer(-w / 2, -w * 0.4, w, w * 0.9, 3), T(c, 'clothing', 'purple'), { sw: 3.5 }),
      multiPart('ribbon', [[[-w * 0.08, -w * 0.4], [w * 0.08, -w * 0.4], [w * 0.08, w * 0.5], [-w * 0.08, w * 0.5]], [[-w / 2, -w * 0.05], [w / 2, -w * 0.05], [w / 2, w * 0.09], [-w / 2, w * 0.09]], [[0, -w * 0.4], [-w * 0.3, -w * 0.62], [-w * 0.26, -w * 0.4]], [[0, -w * 0.4], [w * 0.3, -w * 0.62], [w * 0.26, -w * 0.4]]], T(c, 'clothing', 'yellow'), { flat: true, sw: 2.5 })];
  },
  cup(s, c) {
    const w = s * 0.8;
    return [part('cup_handle', [[w * 0.4, -s * 0.2], [w * 0.72, -s * 0.2], [w * 0.72, s * 0.18], [w * 0.4, s * 0.18], [w * 0.4, s * 0.06], [w * 0.58, s * 0.06], [w * 0.58, -s * 0.08], [w * 0.4, -s * 0.08]], T(c, 'clothing', 'white'), { flat: true, sw: 3 }),
      part('cup', [[-w / 2, -s * 0.4], [w / 2, -s * 0.4], [w * 0.4, s * 0.45], [-w * 0.4, s * 0.45]], T(c, 'clothing', 'white'), { sw: 3.5 }),
      part('coffee', [[-w * 0.46, -s * 0.38], [w * 0.46, -s * 0.38], [w * 0.44, -s * 0.26], [-w * 0.44, -s * 0.26]], T(c, 'clothing', 'brown'), { flat: true, outline: false })];
  },
  map(s, c) {
    const w = s;
    const hh = s * 0.72;
    const panels = [[[-w / 2, -hh / 2], [-w / 6, -hh * 0.42], [-w / 6, hh * 0.58], [-w / 2, hh / 2]], [[-w / 6, -hh * 0.42], [w / 6, -hh / 2], [w / 6, hh / 2], [-w / 6, hh * 0.58]], [[w / 6, -hh / 2], [w / 2, -hh * 0.42], [w / 2, hh * 0.58], [w / 6, hh / 2]]];
    return [multiPart('map', panels, T(c, 'materials', 'sand'), { sw: 3 }),
      h('g', { 'data-part': 'map_mark' }, [inkLine([[-w * 0.3, hh * 0.2], [-w * 0.05, -hh * 0.05], [w * 0.15, hh * 0.1]], 3, T(c, 'clothing', 'red')[1]), inkLine([[w * 0.2, -hh * 0.2], [w * 0.34, -hh * 0.04]], 4, T(c, 'clothing', 'red')[2]), inkLine([[w * 0.34, -hh * 0.2], [w * 0.2, -hh * 0.04]], 4, T(c, 'clothing', 'red')[2])])];
  },
  phone(s, c) {
    const w = s * 0.55;
    return [part('phone', chamfer(-w / 2, -s / 2, w, s, 5), T(c, 'clothing', 'black'), { sw: 3 }),
      part('screen', chamfer(-w * 0.38, -s * 0.4, w * 0.76, s * 0.72, 3), T(c, 'materials', 'glass'), { flat: true, flatTone: 0, outline: false }),
      part('screen_glint', star4(w * 0.15, -s * 0.2, s * 0.09, s * 0.03), T(c, 'clothing', 'white'), { flat: true, flatTone: 0, outline: false })];
  }
};

export const ITEM_IDS = Object.keys(ITEM_DRAW);

export function drawItem(itemId, ctx) {
  const size = ctx.catalog.items[itemId].size;
  const fn = ITEM_DRAW[itemId];
  return h('g', { 'data-item': itemId }, fn(size, ctx));
}


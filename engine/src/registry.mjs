// registry: every catalog id -> the engine code that implements it (D13.9). The lists are written here on
// purpose (not read from the catalog), so the coverage test (A33) catches an id the engine does not know.
import { makePoseFn, RIGS } from './pose.mjs';
import { drawFace, FACE_IDS } from './draw/face.mjs';
import { buildCharacter, renderStill } from './draw/scene.mjs';
import { drawPiece, drawSky, drawBase } from './draw/scenery.mjs';
import { drawItem } from './draw/items.mjs';
import { h, INK } from './draw/svg.mjs';

const ACTION_VARIANTS = {
  walk: ['normal', 'sneak', 'strut', 'stomp'], run: ['normal', 'dash', 'panic'],
  jump: ['normal', 'flip', 'backflip', 'spin', 'cartwheel', 'split'], wave: ['normal', 'big'],
  talk: ['normal', 'shout', 'whisper'], point: ['normal', 'accuse', 'up'], sit: ['normal', 'flop'],
  pick_up: ['normal', 'snatch'], give: ['normal', 'toss'], fall: ['trip', 'slip', 'faint'],
  hug: ['normal', 'bear'], think: ['normal', 'idea']
};

const EMOTION_LEVELS = {
  happy: [['smile', []], ['grin', ['bounce']], ['grin', ['bounce', 'sparkles']]],
  sad: [['sad', ['droop']], ['sad', ['droop', 'tears']], ['sob', ['droop', 'tear_streams']]],
  angry: [['annoyed', []], ['furious', ['red_face', 'shake']], ['furious', ['red_face', 'shake', 'steam']]],
  surprised: [['wide', []], ['shocked', ['jump_back', 'jaw_drop']], ['shocked', ['jump_back', 'jaw_drop', 'eyes_pop']]],
  scared: [['worried', ['sweat_drops']], ['worried', ['sweat_drops', 'tremble']], ['terrified', ['tremble', 'sweat_drops', 'pale_face', 'hair_stand']]],
  neutral: [['neutral', []], ['neutral', []], ['neutral', []]]
};

// which emotion level shows each effect (used to draw an effect in context)
const EFFECT_SOURCE = {
  bounce: ['happy', 2], sparkles: ['happy', 3], droop: ['sad', 1], tears: ['sad', 2], tear_streams: ['sad', 3],
  red_face: ['angry', 2], shake: ['angry', 2], steam: ['angry', 3], jump_back: ['surprised', 2], jaw_drop: ['surprised', 2],
  eyes_pop: ['surprised', 3], sweat_drops: ['scared', 1], tremble: ['scared', 2], pale_face: ['scared', 3], hair_stand: ['scared', 3]
};

const KIND_IDS = ['man', 'woman', 'boy', 'girl', 'old_man', 'old_woman', 'dog', 'cat', 'bird'];
const BASE_IDS = ['city', 'forest', 'beach', 'mountain', 'park', 'countryside', 'room', 'plain'];
const LIGHT_IDS = ['day', 'sunset', 'dusk', 'indoor'];
const ITEM_LIST = ['ball', 'book', 'flower', 'letter', 'key', 'apple', 'gift', 'cup', 'map', 'phone'];
const POSITION_IDS = ['offstage_left', 'far_left', 'left', 'center_left', 'center', 'center_right', 'right', 'far_right', 'offstage_right'];
const HEIGHT_IDS = ['low', 'mid', 'high'];
const PIECE_VARIANTS = {
  tree: ['round', 'tall'], pine: [], palm: [], bush: [], flowers: [], rock: [], log: [], hill: [], mountain: ['snowy', 'bare'],
  cloud: [], water: ['pond', 'stream'], sand: [], building: ['tall', 'short', 'wide'], house: ['small', 'two_story'], shop: [],
  lamp_post: [], bench: [], fence: [], trash_can: [], hydrant: [], car: [], ramp: [], crate: [], beach_umbrella: [], window: [],
  door: [], table: [], chair: [], sofa: [], bed: [], shelf: [], floor_lamp: [], rug: [], potted_plant: []
};
const SKIN = ['pale', 'light', 'medium', 'tan', 'brown', 'deep'];
const HAIR_COLORS = ['black', 'dark_brown', 'brown', 'auburn', 'red', 'blonde', 'gray', 'white'];
const CLOTHING = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'navy', 'purple', 'pink', 'brown', 'gray', 'black', 'white'];
const COATS = ['white', 'cream', 'tan', 'brown', 'black', 'gray', 'orange'];
const ATTRIBUTE_VALUES = {
  person: {
    height: ['short', 'medium', 'tall'], build: ['slim', 'average', 'broad'], skin: SKIN,
    head: ['circle', 'oval', 'square', 'tall_rect', 'triangle_down', 'trapezoid'],
    hair: ['bald', 'buzz', 'short', 'spiky', 'curly', 'afro', 'long', 'ponytail', 'bun', 'braids'], hair_color: HAIR_COLORS,
    outfit: ['tee_shorts', 'tee_pants', 'hoodie_pants', 'shirt_pants', 'sweater_pants', 'jacket_pants', 'dress', 'skirt_top', 'suit', 'overalls'],
    top_color: CLOTHING, bottom_color: CLOTHING,
    accessory: ['none', 'cap', 'helmet', 'hat', 'headband', 'glasses', 'sunglasses', 'scarf', 'bow_tie', 'backpack', 'cane'], accessory_color: CLOTHING
  },
  dog: { size: ['small', 'medium', 'large'], coat: COATS, pattern: ['solid', 'spots'], ears: ['floppy', 'pointy'], accessory: ['none', 'collar', 'bandana'], accessory_color: CLOTHING },
  cat: { size: ['small', 'medium'], coat: COATS, pattern: ['solid', 'stripes'], accessory: ['none', 'collar'], accessory_color: CLOTHING },
  bird: { size: ['small', 'medium'], plumage: CLOTHING }
};
const SAMPLE_KIND = { person: 'boy', dog: 'dog', cat: 'cat', bird: 'bird' };

function defaultLook(catalog, kind) {
  const k = catalog.kinds[kind];
  const set = catalog.attributeSets[k.attributeSet];
  const look = {};
  for (const a of Object.keys(set)) look[a] = k.defaults[a] || set[a].default;
  return look;
}

function stillScript(cast, beats, opts) {
  const o = opts || {};
  return {
    tcia: 1, meta: { title: 'Registry', slug: 'registry', lang: 'en', light: o.light || 'day' },
    characters: cast.map((c) => ({ id: c.id, name: c.id, kind: c.kind, look: c.look || {} })),
    sets: [{ id: 's', base: o.base || 'plain', pieces: o.pieces || [] }],
    scenes: [{ id: 'one', set: 's', cast: cast.map((c) => ({ who: c.id, at: c.at || 'center', emotion: c.emotion, intensity: c.intensity })), beats },
      { id: 'two', set: 's', cast: [{ who: cast[0].id, at: 'center' }], beats: [{ actor: cast[0].id, emotion: 'neutral' }] }],
    decisions: [{ id: 'd1', after: 'one', options: [{ id: 'a', label: 'A', rejoin: 'two' }, { id: 'b', label: 'B', rejoin: 'two' }] },
      { id: 'd2', after: 'two', options: [{ id: 'a', label: 'A', rejoin: '@endings' }, { id: 'b', label: 'B', rejoin: '@endings' }] }],
    endings: [{ id: 'e1', title: 'E1', when: { choice: 'd1', is: 'a' }, scenes: [{ id: 'e1s', set: 's', cast: [{ who: cast[0].id, at: 'center' }], beats: [{ actor: cast[0].id, emotion: 'happy' }] }] },
      { id: 'e2', title: 'E2', when: { choice: 'd2', is: 'a' }, scenes: [{ id: 'e2s', set: 's', cast: [{ who: cast[0].id, at: 'center' }], beats: [{ actor: cast[0].id, emotion: 'happy' }] }] },
      { id: 'e3', title: 'E3', scenes: [{ id: 'e3s', set: 's', cast: [{ who: cast[0].id, at: 'center' }], beats: [{ actor: cast[0].id, emotion: 'happy' }] }] }]
  };
}

// a still of one effect, at a moment where it is showing
function effectStill(catalog, effect) {
  const src = EFFECT_SOURCE[effect];
  const script = stillScript([{ id: 'x', kind: 'boy' }], [{ actor: 'x', emotion: src[0], intensity: src[1], duration: 2 }]);
  // bursts show early in the beat; loops are sampled in the idle that follows it
  const t = catalog.effects[effect].phase === 'burst' ? 0.55 : 2.25;
  return renderStill(catalog, script, 'one', t, t);
}

function faceSample(face) {
  const A = { cx: 8, ey: -10, ed: 24, er: 16, by: -38, my: 34, mw: 60, lw: 3.5, white: '#FFFFFF', whiteShade: '#D9DEE6', mouth: ['#E8737A', '#C2414F', '#8E2A36'], brow: INK, beak: false, lid: '#EDBB93', k: 'f:' };
  return h('g', { 'data-face': face }, [drawFace(face, A)]);
}

function buildRegistry() {
  const actions = {};
  for (const a of Object.keys(ACTION_VARIANTS)) {
    actions[a] = { variants: {} };
    for (const v of ACTION_VARIANTS[a]) {
      actions[a].variants[v] = {};
      for (const r of RIGS) actions[a].variants[v][r] = makePoseFn(a, v, r);
    }
  }
  const emotions = {};
  for (const e of Object.keys(EMOTION_LEVELS)) {
    emotions[e] = {};
    EMOTION_LEVELS[e].forEach((lv, i) => { emotions[e][i + 1] = { face: lv[0], effects: lv[1].slice() }; });
  }
  const faces = {};
  for (const f of FACE_IDS) faces[f] = () => faceSample(f);
  const effects = {};
  for (const e of Object.keys(EFFECT_SOURCE)) effects[e] = (catalog) => effectStill(catalog, e);
  const kinds = {};
  for (const k of KIND_IDS) {
    kinds[k] = (catalog, look, light) => buildCharacter({ id: 'k', kind: k, rig: catalog.kinds[k].rig, look: Object.assign(defaultLook(catalog, k), look || {}) },
      { catalog, light: catalog.lights[light || 'day'], far: false, faces: ['neutral'], fx: {}, key: 'k' });
  }
  const attributes = {};
  for (const set of Object.keys(ATTRIBUTE_VALUES)) {
    attributes[set] = {};
    for (const attr of Object.keys(ATTRIBUTE_VALUES[set])) {
      attributes[set][attr] = {};
      for (const value of ATTRIBUTE_VALUES[set][attr]) {
        attributes[set][attr][value] = (catalog) => {
          const kind = SAMPLE_KIND[set] === 'boy' && attr === 'height' ? 'man' : SAMPLE_KIND[set];
          const look = {};
          look[attr] = value;
          if (attr === 'accessory_color' || attr === 'accessory') look.accessory = attr === 'accessory' ? value : (set === 'person' ? 'cap' : (set === 'bird' ? undefined : 'collar'));
          return kinds[kind](catalog, look).tree;
        };
      }
    }
  }
  const bases = {};
  for (const b of BASE_IDS) bases[b] = (catalog, light) => { const L = catalog.lights[light || (b === 'room' ? 'indoor' : 'day')]; return drawBase(b, { catalog, light: L, far: false, farFade: catalog.stage.farFade }, { catalog, light: L, far: true, farFade: catalog.stage.farFade }); };
  const pieces = {};
  for (const p of Object.keys(PIECE_VARIANTS)) {
    pieces[p] = {};
    const vs = PIECE_VARIANTS[p].length ? PIECE_VARIANTS[p] : ['default'];
    for (const v of vs) pieces[p][v] = (catalog, opts) => { const o = opts || {}; const L = catalog.lights[o.light || 'day']; return drawPiece(p, v === 'default' ? null : v, o.color || null, { catalog, light: L, far: o.layer === 'far', farFade: catalog.stage.farFade }); };
  }
  const lights = {};
  for (const l of LIGHT_IDS) lights[l] = (catalog) => drawSky(l, { catalog, light: catalog.lights[l], far: false, farFade: catalog.stage.farFade }, 'registry');
  const items = {};
  for (const i of ITEM_LIST) items[i] = (catalog) => drawItem(i, { catalog, light: catalog.lights.day, far: false, farFade: catalog.stage.farFade });
  const positions = {};
  for (const p of POSITION_IDS) positions[p] = (catalog) => renderStill(catalog, stillScript([{ id: 'x', kind: 'girl', at: p === 'offstage_left' || p === 'offstage_right' ? 'center' : p }], p.indexOf('offstage') === 0 ? [{ actor: 'x', action: 'walk', to: p }] : [{ actor: 'x', emotion: 'happy' }]), 'one', 0.6, 0.6);
  const heights = {};
  for (const hId of HEIGHT_IDS) heights[hId] = (catalog) => renderStill(catalog, stillScript([{ id: 'x', kind: 'boy' }], [{ actor: 'x', action: 'jump', height: hId }]), 'one', 0.55, 0.55);
  return { actions, emotions, faces, effects, kinds, attributes, bases, pieces, lights, items, positions, heights };
}

export const registry = buildRegistry();

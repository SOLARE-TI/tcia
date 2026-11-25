// TCIA engine logic: script normalization, scene timelines (D8, D9), player state machine,
// conditions, path walking and text helpers. No DOM here: Node tests import this file directly.

export const FORMAT = 1;
export const ENGINE_VERSION = '0.1.0';

// ---------- small math helpers shared by every module ----------

export const TAU = Math.PI * 2;

export function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
export function easeOut(t) { t = clamp(t, 0, 1); return 1 - (1 - t) * (1 - t); }
export function easeIn(t) { t = clamp(t, 0, 1); return t * t; }
export function round3(x) { return Math.round(x * 1000) / 1000; }
export function cpLength(s) { let n = 0; for (const ch of String(s)) { if (ch) n++; } return n; }

// FNV-1a 32-bit hash and mulberry32 PRNG: deterministic "randomness" (blinks, stars).
export function fnv1a(str) {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededRandom(key) { return mulberry32(fnv1a(key)); }

// ---------- text ----------

export function wrapText(text, lineChars) {
  const words = String(text).replace(/\s+/g, ' ').trim().split(' ').filter((w) => w.length > 0);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (cur === '') cur = w;
    else if (cpLength(cur) + 1 + cpLength(w) <= lineChars) cur += ' ' + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}

export function readSeconds(text, catalog) {
  const r = catalog.timing.readTime;
  return clamp(r.base + r.perChar * cpLength(text), r.min, r.max);
}

export function keyToOption(key, count) {
  const m = /^(?:Digit|Numpad)?([1-9])$/.exec(String(key));
  if (!m) return -1;
  const i = Number(m[1]) - 1;
  return i < count ? i : -1;
}

// ---------- conditions ----------

export function evalCondition(cond, ctx) {
  if (cond === undefined || cond === null) return true;
  const choices = (ctx && ctx.choices) || {};
  const vars = (ctx && ctx.vars) || {};
  if (typeof cond !== 'object') throw new TypeError('TCIA: bad condition');
  if ('choice' in cond) return choices[cond.choice] === cond.is;
  if ('var' in cond) {
    const v = Number(vars[cond.var] || 0);
    const w = Number(cond.value);
    switch (cond.op) {
      case '==': return v === w;
      case '!=': return v !== w;
      case '>=': return v >= w;
      case '<=': return v <= w;
      case '>': return v > w;
      case '<': return v < w;
      default: throw new TypeError('TCIA: bad operator ' + cond.op);
    }
  }
  if ('all' in cond) return cond.all.every((c) => evalCondition(c, ctx));
  if ('any' in cond) return cond.any.some((c) => evalCondition(c, ctx));
  if ('not' in cond) return !evalCondition(cond.not, ctx);
  throw new TypeError('TCIA: bad condition');
}

// ---------- action phases (shared with pose.mjs) ----------

// Fractions of the motion spent in anticipation and follow-through (D13.3: 15–25 % and 10–20 %).
export const PHASES = {
  walk: [0.15, 0.12], run: [0.18, 0.12], jump: [0.22, 0.18], wave: [0.15, 0.12],
  talk: [0.15, 0.1], point: [0.18, 0.15], sit: [0.2, 0.15], pick_up: [0.2, 0.15],
  give: [0.2, 0.15], fall: [0.2, 0.2], hug: [0.18, 0.15], think: [0.15, 0.1], react: [0.2, 0.2]
};

export function phaseOf(action, p) {
  const ph = PHASES[action] || [0.2, 0.15];
  const a = ph[0];
  const f = ph[1];
  if (p < a) return { phase: 'anticipation', u: p / a, a, f };
  if (p > 1 - f) return { phase: 'follow', u: (p - (1 - f)) / f, a, f };
  return { phase: 'main', u: (p - a) / (1 - a - f), a, f };
}

// Horizontal travel progress (0..1) for moving actions: the body travels during the main phase.
export function travelProgress(action, p) {
  const ph = phaseOf(action, p);
  if (ph.phase === 'anticipation') return 0;
  if (ph.phase === 'follow') return 1;
  if (action === 'jump') return ph.u;
  // walk / run: gentle ease at both ends, constant speed in the middle
  const u = ph.u;
  const e = 0.12;
  if (u < e) return (u * u) / (2 * e) / (1 - e);
  if (u > 1 - e) return 1 - ((1 - u) * (1 - u)) / (2 * e) / (1 - e);
  return (u - e / 2) / (1 - e);
}

// ---------- normalization ----------

const IN_PLACE_GESTURES = { wave: true, talk: true, point: true, think: true };

// Pause between the start of a beat and the new emotion showing (double take). Inside the beat: D9 is unchanged.
export const EMOTION_DELAY = 0.2;

function needArray(v, what) {
  if (!Array.isArray(v)) throw new TypeError('TCIA: ' + what + ' must be an array');
  return v;
}

function resolveLook(ch, kind, catalog) {
  const set = catalog.attributeSets[kind.attributeSet];
  if (!set) throw new TypeError('TCIA: unknown attribute set ' + kind.attributeSet);
  const given = ch.look || {};
  const look = {};
  for (const attr of Object.keys(set)) {
    let v = given[attr];
    if (v === undefined) v = kind.defaults[attr];
    if (v === undefined) v = set[attr].default;
    look[attr] = v;
  }
  return look;
}

function resolvePieces(set, base, catalog) {
  const src = Array.isArray(set.pieces) ? set.pieces : base.defaultPieces;
  return src.map((p) => {
    const def = catalog.pieces[p.piece];
    const pos = catalog.positions[p.at];
    if (!def || !pos) throw new TypeError('TCIA: bad piece in set ' + set.id);
    return {
      piece: p.piece,
      at: p.at,
      x: pos.x + (p.dx || 0),
      layer: p.layer || def.defaultLayer,
      variant: p.variant || (def.variants.length ? def.variants[0] : 'default'),
      color: def.colorable ? (p.color || def.defaultColor) : null,
      flip: !!p.flip,
      seat: def.seat
    };
  });
}

function defaultFacing(x) { return x > 960 ? -1 : 1; }

function seatHeightAt(story, setId, pos) {
  const set = story.sets[setId];
  for (const p of set.pieces) {
    if (p.at === pos && p.seat !== null && p.seat !== undefined && (p.layer === 'back' || p.layer === 'front')) return p.seat;
  }
  return 0;
}

// ---------- scene compilation (D8, D9) ----------

function baseDuration(story, beat, fromX, toX) {
  const cat = story.catalog;
  if (!beat.action) {
    return beat.duration !== undefined ? beat.duration : cat.timing.reaction.default;
  }
  if (beat.duration !== undefined) return beat.duration;
  const act = cat.actions[beat.action];
  const variant = beat.variant || act.defaultVariant;
  const vdef = act.variants[variant] || {};
  if (beat.action === 'walk' || beat.action === 'run') {
    const marks = Math.abs(toX - fromX) / cat.stage.markSpacing;
    return clamp(marks * vdef.secondsPerMark, act.duration.min, act.duration.max);
  }
  if (beat.action === 'jump') {
    const marks = Math.abs(toX - fromX) / cat.stage.markSpacing;
    const d = act.duration;
    return clamp(d.base + d.perMark * marks, d.min, d.max);
  }
  if (vdef.defaultDuration !== undefined) return vdef.defaultDuration;
  return act.duration.default;
}

function cloneActorState(s) {
  return { pos: s.pos, x: s.x, facing: s.facing, posture: s.posture, seatH: s.seatH, lie: s.lie,
    holding: s.holding, emotion: s.emotion, intensity: s.intensity };
}

function compileScene(story, scene, role) {
  const cat = story.catalog;
  if (!scene || typeof scene !== 'object') throw new TypeError('TCIA: bad scene');
  const set = story.sets[scene.set];
  if (!set) throw new TypeError('TCIA: scene ' + scene.id + ' uses unknown set ' + scene.set);
  const light = scene.light || story.meta.light;
  if (!cat.lights[light]) throw new TypeError('TCIA: unknown light ' + light);
  const state = {};
  const cast = [];
  for (const m of needArray(scene.cast, 'cast')) {
    const ch = story.characters[m.who];
    const pos = cat.positions[m.at];
    if (!ch || !pos) throw new TypeError('TCIA: bad cast member in scene ' + scene.id);
    const posture = m.posture || 'standing';
    const s = {
      pos: m.at, x: pos.x,
      facing: m.facing ? (m.facing === 'left' ? -1 : 1) : defaultFacing(pos.x),
      posture, seatH: posture === 'sitting' ? seatHeightAt(story, scene.set, m.at) : 0,
      lie: null, holding: null,
      emotion: m.emotion || 'neutral',
      intensity: m.intensity || 2
    };
    state[m.who] = s;
    cast.push(m.who);
  }
  const itemState = {};
  const items = [];
  for (const it of (scene.items || [])) {
    if (!cat.items[it.item]) throw new TypeError('TCIA: unknown item ' + it.item);
    if (it.held_by) {
      if (!state[it.held_by]) throw new TypeError('TCIA: item held by someone not in the cast');
      itemState[it.id] = { item: it.item, pos: null, x: null, holder: it.held_by };
      state[it.held_by].holding = it.id;
    } else {
      const pos = cat.positions[it.at];
      if (!pos) throw new TypeError('TCIA: bad item position');
      itemState[it.id] = { item: it.item, pos: it.at, x: pos.x, holder: null };
    }
    items.push(it.id);
  }
  const initialActors = {};
  for (const id of cast) initialActors[id] = cloneActorState(state[id]);
  const initialItems = {};
  for (const id of items) initialItems[id] = Object.assign({}, itemState[id]);

  // group beats
  const groups = [];
  for (const b of needArray(scene.beats, 'beats')) {
    if (!state[b.actor]) throw new TypeError('TCIA: beat actor not in cast in scene ' + scene.id);
    if (b.together && groups.length) groups[groups.length - 1].push(b);
    else groups.push([b]);
  }

  const beats = [];
  const tracks = {};
  for (const id of cast) tracks[id] = [];
  const itemTracks = {};
  for (const id of items) itemTracks[id] = [];
  const balloons = [];
  const emotionMarks = {};
  for (const id of cast) emotionMarks[id] = [{ t: 0, emotion: state[id].emotion, intensity: state[id].intensity, burst: false }];

  let T = 0;
  const groupList = [];
  for (const g of groups) {
    const snap = {};
    for (const id of cast) snap[id] = cloneActorState(state[id]);
    const snapItems = {};
    for (const id of items) snapItems[id] = Object.assign({}, itemState[id]);
    let gdur = 0;
    const compiled = [];
    for (const b of g) {
      const s = snap[b.actor];
      const action = b.action || null;
      const act = action ? cat.actions[action] : null;
      if (action && !act) throw new TypeError('TCIA: unknown action ' + action);
      const variant = action ? (b.variant || act.defaultVariant) : null;
      if (action && !act.variants[variant]) throw new TypeError('TCIA: unknown variant ' + variant);
      let toPos = s.pos;
      let toX = s.x;
      if (b.to !== undefined) {
        const p = cat.positions[b.to];
        if (!p) throw new TypeError('TCIA: unknown position ' + b.to);
        toPos = b.to; toX = p.x;
      }
      const base = baseDuration(story, b, s.x, toX);
      const standUp = !!(action && act.startPostures.indexOf(s.posture) < 0);
      const standSec = standUp ? cat.timing.standUpSeconds : 0;
      const read = b.say !== undefined ? readSeconds(b.say, cat) : 0;
      const eff = Math.max(base, read) + standSec;
      const motionDur = (action && IN_PLACE_GESTURES[action]) ? (eff - standSec) : base;
      // target
      let targetId = null;
      let targetX = null;
      let targetIsChar = false;
      if (b.target !== undefined) {
        if (state[b.target]) { targetId = b.target; targetX = snap[b.target].x; targetIsChar = true; }
        else if (cat.positions[b.target]) { targetId = b.target; targetX = cat.positions[b.target].x; }
        else throw new TypeError('TCIA: unknown target ' + b.target);
      }
      // facing
      let facingTo = s.facing;
      if (toX !== s.x) facingTo = toX > s.x ? 1 : -1;
      else if (targetX !== null && targetX !== s.x) facingTo = targetX > s.x ? 1 : -1;
      // lying down and staying there (talking, waving...), nobody turns round: the whole body would flip
      if (s.posture === 'lying' && !standSec) facingTo = s.facing;
      const cb = {
        index: beats.length, actor: b.actor, action, variant, reaction: !action,
        start: T, end: T + eff, eff, base, standUp: standSec, motionStart: T + standSec, motionDur,
        fromPos: s.pos, fromX: s.x, toPos, toX, dist: toX - s.x,
        heightPx: action === 'jump' ? act.heights[b.height || act.defaultHeight].px : 0,
        height: action === 'jump' ? (b.height || act.defaultHeight) : null,
        targetId, targetX, targetIsChar, item: null,
        facingFrom: s.facing, facingTo,
        postureFrom: s.posture, seatFrom: s.seatH, lieFrom: s.lie,
        emotion: b.emotion || null, intensity: null,
        say: b.say !== undefined ? b.say : null,
        balloon: b.say !== undefined ? (act && act.balloon === 'thought' ? 'thought' : 'speech') : null,
        seatTo: 0, lieTo: null, receiver: null, itemId: null, itemKind: null
      };
      // results
      const r = state[b.actor];
      if (cb.emotion) { r.emotion = cb.emotion; r.intensity = b.intensity || 2; }
      else if (b.intensity) r.intensity = b.intensity;
      cb.emotionAfter = r.emotion;
      cb.intensity = r.intensity;
      if (b.emotion || b.intensity) {
        // comic timing: the new face and its bursts arrive after a short pause inside the beat (A59)
        emotionMarks[b.actor].push({ t: T + EMOTION_DELAY, emotion: r.emotion, intensity: r.intensity, burst: !!b.emotion });
      }
      if (standUp) { r.posture = 'standing'; r.seatH = 0; r.lie = null; }
      r.facing = facingTo;
      if (action === 'walk' || action === 'run' || action === 'jump') {
        r.pos = toPos; r.x = toX; r.posture = 'standing'; r.seatH = 0; r.lie = null;
      }
      if (action === 'sit') {
        r.posture = 'sitting';
        r.seatH = seatHeightAt(story, scene.set, s.pos);
        cb.seatTo = r.seatH;
      }
      if (action === 'fall') {
        r.posture = 'lying';
        r.lie = variant === 'trip' ? 'front' : (variant === 'faint' ? 'faint' : 'back');
        cb.lieTo = r.lie;
      }
      if (action === 'pick_up') {
        const iid = b.item;
        if (!itemState[iid]) throw new TypeError('TCIA: unknown item instance ' + iid);
        cb.itemId = iid; cb.itemKind = itemState[iid].item;
        itemState[iid].holder = b.actor; itemState[iid].pos = null; itemState[iid].x = null;
        r.holding = iid;
        itemTracks[iid].push({ type: 'pick', beat: cb.index, actor: b.actor });
      }
      if (action === 'give') {
        const iid = s.holding;
        if (!iid || !targetIsChar) throw new TypeError('TCIA: give without item or target');
        cb.itemId = iid; cb.itemKind = itemState[iid].item; cb.receiver = targetId;
        r.holding = null;
        state[targetId].holding = iid;
        itemState[iid].holder = targetId;
        itemTracks[iid].push({ type: 'give', beat: cb.index, actor: b.actor, to: targetId });
      }
      if (action === 'hug') {
        if (!targetIsChar) throw new TypeError('TCIA: hug without target');
        cb.receiver = targetId;
      }
      cb.after = cloneActorState(r);
      compiled.push(cb);
      beats.push(cb);
      tracks[b.actor].push({ beat: cb.index, passive: null });
      if (cb.receiver) tracks[cb.receiver].push({ beat: cb.index, passive: action === 'hug' ? 'hugged' : 'receive' });
      if (cb.say !== null) {
        balloons.push({ beat: cb.index, actor: b.actor, kind: cb.balloon, text: cb.say,
          lines: wrapText(cb.say, cat.text.balloonLineChars), start: cb.start, end: cb.end });
      }
      gdur = Math.max(gdur, eff);
    }
    groupList.push({ start: T, dur: gdur, beats: compiled.map((c) => c.index) });
    T += gdur;
  }
  const finalActors = {};
  for (const id of cast) finalActors[id] = cloneActorState(state[id]);
  return {
    id: scene.id, role, set: scene.set, light,
    content: T, duration: T + cat.timing.sceneTailSeconds,
    cast, items, initialActors, initialItems, finalActors,
    groups: groupList, beats, tracks, itemTracks, balloons, emotionMarks
  };
}

export function prepare(script, catalog) {
  if (!script || typeof script !== 'object' || Array.isArray(script)) throw new TypeError('TCIA: the script must be an object');
  if (!catalog || typeof catalog !== 'object' || !catalog.actions || !catalog.positions) throw new TypeError('TCIA: the catalog is missing');
  if (script.tcia !== FORMAT) throw new TypeError('TCIA: unsupported script format ' + script.tcia);
  const meta = script.meta;
  if (!meta || typeof meta !== 'object') throw new TypeError('TCIA: meta is missing');
  const story = {
    format: FORMAT, catalog,
    meta: { title: String(meta.title || ''), slug: meta.slug, lang: meta.lang || 'en', light: meta.light },
    ui: null, vars: [], characters: {}, sets: {}, scenes: {}, main: [], decisions: [], decisionAfter: {}, endings: []
  };
  if (!catalog.lights[story.meta.light]) throw new TypeError('TCIA: unknown light ' + story.meta.light);
  story.ui = meta.ui || catalog.ui[story.meta.lang] || catalog.ui.en;
  for (const v of (script.state || [])) story.vars.push({ var: v.var, initial: v.initial | 0 });
  for (const ch of needArray(script.characters, 'characters')) {
    const kind = catalog.kinds[ch.kind];
    if (!kind) throw new TypeError('TCIA: unknown kind ' + ch.kind);
    const look = resolveLook(ch, kind, catalog);
    story.characters[ch.id] = {
      id: ch.id, name: ch.name, kind: ch.kind, rig: kind.rig, group: kind.group, look,
      heightPx: kind.heightPx[look[kind.heightBy]] || kind.heightPx[Object.keys(kind.heightPx)[0]]
    };
  }
  for (const s of needArray(script.sets, 'sets')) {
    const base = catalog.bases[s.base];
    if (!base) throw new TypeError('TCIA: unknown base ' + s.base);
    story.sets[s.id] = { id: s.id, base: s.base, outdoor: base.outdoor, pieces: resolvePieces(s, base, catalog) };
  }
  const addScene = (sc, role) => {
    const c = compileScene(story, sc, role);
    story.scenes[c.id] = c;
    return c.id;
  };
  for (const sc of needArray(script.scenes, 'scenes')) story.main.push(addScene(sc, 'main'));
  const decs = needArray(script.decisions, 'decisions').map((d) => {
    const afterIndex = story.main.indexOf(d.after);
    if (afterIndex < 0) throw new TypeError('TCIA: decision ' + d.id + ' is after an unknown scene');
    return {
      id: d.id, after: d.after, afterIndex,
      options: needArray(d.options, 'options').map((o) => ({
        id: o.id, label: o.label, effects: (o.effects || []).map((e) => ({ var: e.var, add: e.add })),
        scenes: (o.scenes || []).map((sc) => addScene(sc, 'branch')), rejoin: o.rejoin
      }))
    };
  });
  decs.sort((a, b) => a.afterIndex - b.afterIndex);
  story.decisions = decs;
  decs.forEach((d, i) => { story.decisionAfter[d.after] = i; });
  for (const e of needArray(script.endings, 'endings')) {
    story.endings.push({ id: e.id, title: e.title, when: e.when, scenes: needArray(e.scenes, 'ending scenes').map((sc) => addScene(sc, 'ending')) });
  }
  if (story.main.length === 0 || story.endings.length === 0) throw new TypeError('TCIA: the story needs scenes and endings');
  const first = story.scenes[story.main[0]];
  story.titleScene = compileScene(story, {
    id: TITLE_SCENE, set: first.set, light: first.light,
    cast: Object.keys(story.characters).map((id) => ({ who: id, at: 'center', facing: 'right' })), beats: []
  }, 'title');
  return story;
}

export function initialVars(story) {
  const vars = {};
  for (const v of story.vars) vars[v.var] = v.initial;
  return vars;
}

export function pickEnding(story, choices, vars) {
  for (const e of story.endings) {
    if (e.when === undefined || e.when === null || evalCondition(e.when, { choices, vars })) return e;
  }
  return null;
}

function sceneCost(story, id) {
  return story.scenes[id].duration + 2 * story.catalog.timing.sceneFadeSeconds;
}

// Every combination of choices, decisions in story order, options in their order (D10.5).
export function outcomes(story) {
  const out = [];
  const decs = story.decisions;
  const walk = (k, picks) => {
    if (k === decs.length) {
      const choices = {};
      const vars = initialVars(story);
      let seconds = 0;
      let di = 0;
      for (let i = 0; i < story.main.length; i++) {
        seconds += sceneCost(story, story.main[i]);
        if (di < decs.length && decs[di].afterIndex === i) {
          const opt = decs[di].options[picks[di]];
          choices[decs[di].id] = opt.id;
          for (const e of opt.effects) vars[e.var] = (vars[e.var] || 0) + e.add;
          for (const sid of opt.scenes) seconds += sceneCost(story, sid);
          di++;
        }
      }
      const ending = pickEnding(story, choices, vars);
      if (ending) for (const sid of ending.scenes) seconds += sceneCost(story, sid);
      out.push({ choices, ending: ending ? ending.id : null, seconds: round3(seconds) });
      return;
    }
    for (let o = 0; o < decs[k].options.length; o++) walk(k + 1, picks.concat([o]));
  };
  walk(0, []);
  return out;
}

export function sceneSeconds(story, id) { return round3(story.scenes[id].duration); }

// ---------- scene sampling: what every actor, item and balloon does at time t ----------

function emotionAt(scene, actorId, t) {
  const marks = scene.emotionMarks[actorId];
  let cur = marks[0];
  let prev = marks[0];
  const bursts = [];
  for (const m of marks) {
    if (m.t <= t + 1e-9) {
      if (m !== marks[0]) prev = cur;
      cur = m;
      if (m.burst) bursts.push(m);
    }
  }
  return { emotion: cur.emotion, intensity: cur.intensity, since: cur.t, prev: cur === marks[0] ? null : prev, bursts };
}

export function getScene(story, id) {
  if (id === TITLE_SCENE) return story.titleScene;
  return story.scenes[id];
}

// The title screen shows every character of the story, standing in a row on the set of the first scene.
export const TITLE_SCENE = '@title';

export function sampleScene(story, sceneId, t, clock) {
  const scene = getScene(story, sceneId);
  if (!scene) throw new TypeError('TCIA: unknown scene ' + sceneId);
  const cat = story.catalog;
  const actors = [];
  for (const id of scene.cast) {
    const ch = story.characters[id];
    const init = scene.initialActors[id];
    let st = { pos: init.pos, x: init.x, facing: init.facing, posture: init.posture, seatH: init.seatH, lie: init.lie, holding: init.holding };
    let act = null;
    let passive = null;
    let lastAct = null;
    let segStart = 0;
    for (const tr of scene.tracks[id]) {
      const b = scene.beats[tr.beat];
      if (b.start > t + 1e-9) break;
      if (tr.passive) {
        if (t < b.end) { passive = { type: tr.passive, beat: b }; segStart = b.start; }
        else segStart = Math.max(segStart, b.end);
        continue;
      }
      segStart = t < b.end - 1e-9 ? b.start : b.end;
      if (t < b.end - 1e-9) {
        act = b;
        st = { pos: b.fromPos, x: b.fromX, facing: b.facingFrom, posture: b.postureFrom, seatH: b.seatFrom, lie: b.lieFrom, holding: st.holding };
      } else {
        const a = b.after;
        st = { pos: a.pos, x: a.x, facing: a.facing, posture: a.posture, seatH: a.seatH, lie: a.lie, holding: st.holding };
        lastAct = { action: b.action, variant: b.variant, since: t - (b.motionStart + b.motionDur), ended: t - b.end, heightPx: b.heightPx };
      }
    }
    const emo = emotionAt(scene, id, t);
    const frame = {
      id, kind: ch.kind, rig: ch.rig, heightPx: ch.heightPx,
      pos: st.pos, x: st.x, facing: st.facing, turn: 1, posture: st.posture, seatH: st.seatH, lie: st.lie,
      onstage: cat.positions[st.pos] ? cat.positions[st.pos].onstage : true,
      emotion: emo.emotion, intensity: emo.intensity, emotionSince: emo.since,
      bursts: emo.bursts.map((m) => ({ t: t - m.t, emotion: m.emotion, intensity: m.intensity })),
      act: null, passive: null, holding: null, speaking: null, clock, lastAct: act ? null : lastAct,
      segStart, emotionPrev: emo.prev ? emo.prev.emotion : null, intensityPrev: emo.prev ? emo.prev.intensity : null
    };
    if (act) {
      const local = t - act.start;
      // a beat without stand-up never counts as standing up, even a float step before its start
      const standing = act.standUp > 0 && local < act.standUp;
      const mt = local - act.standUp;
      const p = act.motionDur > 0 ? clamp(mt / act.motionDur, 0, 1) : 1;
      frame.act = {
        beat: act.index, action: act.action, variant: act.variant, reaction: act.reaction,
        local, t: mt, p, dur: act.motionDur, eff: act.eff,
        standUp: standing ? { from: act.postureFrom, lie: act.lieFrom, seatH: act.seatFrom, p: clamp(local / act.standUp, 0, 1) } : null,
        dist: act.dist, heightPx: act.heightPx, height: act.height,
        targetId: act.targetId, targetX: act.targetX, targetIsChar: act.targetIsChar,
        seatTo: act.seatTo, lieTo: act.lieTo, itemKind: act.itemKind, receiver: act.receiver,
        fromX: act.fromX, toX: act.toX, turning: act.facingTo !== act.facingFrom, start: act.start
      };
      // horizontal travel
      if (act.action === 'walk' || act.action === 'run' || act.action === 'jump') {
        if (!standing) frame.x = lerp(act.fromX, act.toX, travelProgress(act.action, p));
        frame.onstage = true;
      }
      // facing turn: sx 1 -> 0.1 -> -1 in 0.15 s at the start of the beat
      if (act.facingTo !== act.facingFrom) {
        const tt = local;
        // 1 -> 0.1 -> -1 (D13.3), passing through 0 so nothing jumps when the drawing flips
        // (as a cosine, so the drawing eases into the turn and out of it)
        if (tt < 0.075) { frame.facing = act.facingFrom; frame.turn = Math.cos((Math.PI * tt) / 0.15); }
        else if (tt < 0.15) { frame.facing = act.facingTo; frame.turn = -Math.cos((Math.PI * tt) / 0.15); }
        else frame.facing = act.facingTo;
      }
      if (!standing) { frame.posture = act.postureFrom === 'standing' || act.standUp ? 'standing' : act.postureFrom; }
      if (act.standUp && !standing) { frame.seatH = 0; frame.lie = null; }
    }
    if (passive) {
      const b = passive.beat;
      const local = t - b.motionStart;
      frame.passive = {
        type: passive.type, by: b.actor, variant: b.variant, action: b.action,
        p: b.motionDur > 0 ? clamp(local / b.motionDur, 0, 1) : 1, t: local, dur: b.motionDur,
        partnerX: b.fromX
      };
    }
    actors.push(frame);
  }
  // items
  const items = [];
  const byId = {};
  for (const a of actors) byId[a.id] = a;
  for (const iid of scene.items) {
    const init = scene.initialItems[iid];
    let holder = init.holder;
    let x = init.x;
    let flight = null;
    for (const ev of scene.itemTracks[iid]) {
      const b = scene.beats[ev.beat];
      if (b.start > t + 1e-9) break;
      const local = t - b.motionStart;
      const p = b.motionDur > 0 ? local / b.motionDur : 1;
      if (ev.type === 'pick') {
        holder = p >= 0.45 ? ev.actor : null;
      } else if (ev.type === 'give') {
        const toss = b.variant === 'toss';
        const p0 = toss ? 0.3 : 0.4;
        const p1 = toss ? 0.85 : 0.75;
        if (p < p0) holder = ev.actor;
        else if (p < p1) { holder = null; flight = { from: ev.actor, to: ev.to, u: (p - p0) / (p1 - p0), arc: toss ? 200 : 0 }; }
        else { holder = ev.to; flight = null; }
      }
    }
    if (holder && byId[holder]) byId[holder].holding = { id: iid, item: init.item };
    items.push({ id: iid, item: init.item, holder, x, flight });
  }
  // balloon (never more than one at a time, D8)
  let balloon = null;
  for (const bl of scene.balloons) {
    if (t >= bl.start - 1e-9 && t < bl.end - 1e-9) {
      balloon = { beat: bl.beat, actor: bl.actor, kind: bl.kind, lines: bl.lines, text: bl.text, age: t - bl.start, left: bl.end - t };
      if (byId[bl.actor]) byId[bl.actor].speaking = { kind: bl.kind, age: t - bl.start, beat: bl.beat };
    }
  }
  return { sceneId, t, clock, set: scene.set, light: scene.light, actors, items, balloon };
}

// ---------- player ----------

export function createPlayer(story) {
  const cat = story.catalog;
  const FADE = cat.timing.sceneFadeSeconds;
  const DELAY = cat.timing.decisionDelaySeconds;
  const ENDINGS = { endings: true };
  const P = {
    state: 'title', sceneId: story.main[0], sceneTime: 0,
    decisionId: null, options: null, choices: {}, vars: initialVars(story), endingId: null,
    clock: 0, phase: 'title', phaseTime: 0, fade: 0
  };
  let pending = [];
  let upcoming = [];
  let current = { id: story.main[0], role: 'main', mainIndex: 0 };

  function sceneDur(id) { return story.scenes[id].duration; }

  function enter(ref) {
    current = ref;
    P.sceneId = ref.id;
    P.sceneTime = 0;
    P.phase = 'in';
    P.phaseTime = 0;
    P.fade = 1;
    pending.push({ type: 'scene', id: ref.id });
  }

  function popNext() {
    while (upcoming.length) {
      const ref = upcoming.shift();
      if (ref === ENDINGS) {
        const e = pickEnding(story, P.choices, P.vars);
        if (!e) { finish(); return; }
        P.endingId = e.id;
        pending.push({ type: 'ending', id: e.id });
        upcoming = e.scenes.map((id, i) => ({ id, role: 'ending', last: i === e.scenes.length - 1 }));
        continue;
      }
      enter(ref);
      return;
    }
    finish();
  }

  function finish() {
    P.state = 'ended';
    P.phase = 'ended';
    P.fade = 0;
    P.sceneTime = story.scenes[P.sceneId].duration;
    pending.push({ type: 'ended' });
  }

  function afterContent() {
    // the content (with its tail) of the current scene is over
    if (current.role === 'main') {
      const di = story.decisionAfter[current.id];
      if (di !== undefined) { P.phase = 'delay'; P.phaseTime = 0; return; }
      upcoming = current.mainIndex + 1 < story.main.length
        ? [{ id: story.main[current.mainIndex + 1], role: 'main', mainIndex: current.mainIndex + 1 }]
        : [ENDINGS];
    }
    if (current.role === 'ending' && current.last) { finish(); return; }
    P.phase = 'out';
    P.phaseTime = 0;
  }

  function openDecision() {
    const d = story.decisions[story.decisionAfter[current.id]];
    P.state = 'deciding';
    P.phase = 'deciding';
    P.decisionId = d.id;
    P.options = d.options.map((o) => ({ id: o.id, label: o.label }));
    P.fade = 0;
    pending.push({ type: 'decision', id: d.id });
  }

  function reset() {
    P.choices = {};
    P.vars = initialVars(story);
    P.endingId = null;
    P.decisionId = null;
    P.options = null;
    upcoming = [];
  }

  P.start = function start() {
    if (P.state !== 'title') return [];
    reset();
    P.state = 'playing';
    enter({ id: story.main[0], role: 'main', mainIndex: 0 });
    return [];
  };

  P.restart = function restart() {
    reset();
    P.state = 'playing';
    enter({ id: story.main[0], role: 'main', mainIndex: 0 });
    return [];
  };

  P.choose = function choose(i) {
    if (P.state !== 'deciding') throw new RangeError('TCIA: there is no open decision');
    const d = story.decisions[story.decisionAfter[current.id]];
    if (!Number.isInteger(i) || i < 0 || i >= d.options.length) throw new RangeError('TCIA: option ' + i + ' is out of range');
    const o = d.options[i];
    P.choices[d.id] = o.id;
    for (const e of o.effects) P.vars[e.var] = (P.vars[e.var] || 0) + e.add;
    pending.push({ type: 'choice', decision: d.id, option: o.id });
    upcoming = o.scenes.map((id) => ({ id, role: 'branch' }));
    if (o.rejoin === '@endings' || current.mainIndex + 1 >= story.main.length) upcoming.push(ENDINGS);
    else upcoming.push({ id: story.main[current.mainIndex + 1], role: 'main', mainIndex: current.mainIndex + 1 });
    P.decisionId = null;
    P.options = null;
    P.state = 'playing';
    P.phase = 'out';
    P.phaseTime = 0;
  };

  P.advance = function advance(dt) {
    dt = Number(dt);
    if (!(dt > 0) || !Number.isFinite(dt)) dt = 0;
    P.clock += dt;
    let guard = 0;
    while (P.state === 'playing' && dt > 0 && guard++ < 10000) {
      if (P.phase === 'in') {
        const need = FADE - P.phaseTime;
        if (dt < need) { P.phaseTime += dt; dt = 0; }
        else { dt -= need; P.phase = 'content'; P.phaseTime = 0; }
        P.fade = P.phase === 'in' ? 1 - P.phaseTime / FADE : 0;
      } else if (P.phase === 'content') {
        const need = sceneDur(P.sceneId) - P.sceneTime;
        if (dt < need) { P.sceneTime += dt; dt = 0; }
        else { dt -= need; P.sceneTime = sceneDur(P.sceneId); afterContent(); }
        if (P.phase === 'content') P.fade = 0;
      } else if (P.phase === 'delay') {
        const need = DELAY - P.phaseTime;
        if (dt < need) { P.phaseTime += dt; dt = 0; }
        else { dt -= need; openDecision(); }
      } else if (P.phase === 'out') {
        const need = FADE - P.phaseTime;
        if (dt < need) { P.phaseTime += dt; dt = 0; P.fade = P.phaseTime / FADE; }
        else { dt -= need; P.fade = 1; popNext(); }
      } else break;
    }
    const ev = pending;
    pending = [];
    return ev;
  };

  P.frame = function frame() {
    const f = P.state === 'title' ? sampleScene(story, TITLE_SCENE, 0, P.clock) : sampleScene(story, P.sceneId, P.sceneTime, P.clock);
    f.state = P.state;
    f.fade = P.state === 'playing' ? P.fade : 0;
    f.phase = P.phase;
    return f;
  };

  return P;
}

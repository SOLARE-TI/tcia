// The TCIA validator (D10): validate(script, { catalog, schema }) ->
// { ok, errors, warnings, stats }.

import { checkSchema } from './schema.mjs';
import { join, documentOrder, orderOf } from './pointer.mjs';
import { codePoints, wrapText } from './text.mjs';
import { closest, suggestDetailed } from './suggest.mjs';
import { categoryEntries, categoryLabel, effectiveLook, effectiveParams } from './catalog.mjs';
import { simulateScene } from './simulate.mjs';
import { combinations, endingFor, evalCondition, describeChoices, ENDINGS_MARK } from './flow.mjs';
import { outcomes } from './outcomes.mjs';

export const ERROR_CODES = [
  'E_USAGE', 'E_NODE_VERSION', 'E_JSON', 'E_FORMAT', 'E_SCHEMA',
  'E_COUNT_SCENES', 'E_COUNT_DECISIONS', 'E_COUNT_OPTIONS', 'E_COUNT_ENDINGS',
  'E_DUPLICATE_ID', 'E_ID_CLASH', 'E_REF', 'E_CATALOG', 'E_LOOK_KEY', 'E_PIECE', 'E_LIGHT_BASE',
  'E_UI_MISSING', 'E_TEXT_LENGTH', 'E_TEXT_BLANK', 'E_BALLOON_LENGTH', 'E_BALLOON_WORD',
  'E_BALLOON_LINES', 'E_BEAT_EMPTY', 'E_REACTION', 'E_PARAM', 'E_DURATION', 'E_TARGET',
  'E_POSITION_SHARED', 'E_OFFSTAGE', 'E_MOVE', 'E_DISTANCE', 'E_ITEM', 'E_POSTURE', 'E_TOGETHER',
  'E_DECISION_AFTER', 'E_DECISION_ORDER', 'E_REJOIN', 'E_WHEN_MISSING', 'E_NO_ENDING',
  'E_UNREACHABLE_ENDING',
];

export const WARNING_CODES = [
  'W_UNUSED_CHARACTER', 'W_UNUSED_SET', 'W_UNUSED_VAR', 'W_IGNORED_ATTR', 'W_LONG_PATH',
];

const LONG_PATH_SECONDS = 360;
const REACTION_ONLY_FORBIDDEN = ['variant', 'to', 'item', 'height', 'say'];
const PARAMS = ['to', 'target', 'item', 'height', 'say'];

function makeError(code, path, message, extra = {}) {
  return {
    code,
    path,
    message,
    suggestion: extra.suggestion ?? null,
    approximation: extra.approximation ?? null,
  };
}

function isPlainObject(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function typeName(x) {
  if (x === null) return 'null';
  if (Array.isArray(x)) return 'an array';
  return `a ${typeof x}`;
}

function article(word) {
  return /^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`;
}

function isBlank(s) {
  return /^\s*$/u.test(s);
}

// Parses JSON text first (V3), then validates.
export function validateSource(text, options) {
  let script;
  try {
    script = JSON.parse(String(text).replace(/^﻿/, ''));
  } catch (e) {
    return {
      ok: false,
      errors: [makeError('E_JSON', '', `Not valid JSON: ${e.message}`)],
      warnings: [],
      stats: null,
      script: undefined,
    };
  }
  return { ...validate(script, options), script };
}

export function validate(script, { catalog, schema }) {
  const errors = [];
  const warnings = [];
  const done = () => finish(script, errors, warnings, null);

  // V4: format, before the schema.
  if (!isPlainObject(script) || script.tcia !== 1) {
    let found;
    if (!isPlainObject(script)) found = typeName(script);
    else if (!('tcia' in script)) found = 'nothing';
    else found = JSON.stringify(script.tcia);
    const path = isPlainObject(script) && 'tcia' in script ? '/tcia' : '';
    errors.push(makeError('E_FORMAT', path, `Unsupported format: "tcia" must be 1 (found ${found}).`));
    return done();
  }

  // V5-V6: schema.
  for (const e of checkSchema(script, schema)) errors.push(fromSchemaError(e, script, catalog));
  if (errors.length > 0) return done();

  // V7-V24: identity, references, catalog, texts, parameters.
  const scenes = collectScenes(script);
  semanticA(script, catalog, scenes, errors);
  const phaseA = errors.slice();

  // V25-V31: simulate scenes that had no error in phase A.
  for (const info of scenes) {
    if (phaseA.some((e) => e.path === info.path || e.path.startsWith(info.path + '/'))) continue;
    errors.push(...simulateScene(info.scene, info.path, catalog).errors);
  }

  // V32-V37: flow.
  const flowBlocked = phaseA.some((e) =>
    e.path.startsWith('/state') ||
    ((e.path.startsWith('/decisions') || e.path.startsWith('/endings')) && !/\/scenes\/\d+/.test(e.path)) ||
    (e.code === 'E_DUPLICATE_ID' && /\/scenes\/\d+\/id$/.test(e.path)));
  if (!flowBlocked) flowChecks(script, scenes, errors);

  // Warnings.
  collectWarnings(script, catalog, scenes, warnings);

  // Statistics.
  let stats = null;
  if (errors.length === 0) {
    stats = buildStats(script, catalog, scenes);
    if (stats.secondsMax > LONG_PATH_SECONDS) {
      warnings.push(makeWarning('W_LONG_PATH', '', `The longest path lasts ${stats.secondsMax}s; consider shorter scenes.`));
    }
  }
  return finish(script, errors, warnings, stats);
}

function makeWarning(code, path, message) {
  return { code, path, message };
}

function finish(script, errors, warnings, stats) {
  const order = documentOrder(script);
  const sortByDoc = (list) =>
    list.map((x, i) => ({ x, i, k: orderOf(order, x.path) }))
      .sort((a, b) => a.k - b.k || a.i - b.i)
      .map((e) => e.x);
  return {
    ok: errors.length === 0,
    errors: sortByDoc(errors),
    warnings: sortByDoc(warnings),
    stats,
  };
}

// V5 / V6.
// " Did you mean ...?" / " Closest: ... <note>" after a value outside the catalog.
function suggestionText(value, s) {
  if (s.via === 'alias') return ` Did you mean "${s.suggestion}" ("${value}" is an alias)?`;
  if (s.suggestion) return ` Did you mean "${s.suggestion}"?`;
  if (s.approximation) {
    return (s.approximation.to !== null ? ` Closest: ${JSON.stringify(s.approximation.to)}.` : '') + ` ${s.approximation.note}`;
  }
  return '';
}

function resolve(doc, tokens) {
  let node = doc;
  for (const t of tokens) {
    if (node === null || typeof node !== 'object') return undefined;
    node = node[t];
  }
  return node;
}

// Which catalog category a pointer holds, so that a catalog value that fails
// the schema pattern (an alias with accents, spaces or capitals) still gets
// the closest id. Returns { category, scope } or null.
function catalogFieldOf(path, script, catalog) {
  const t = path.split('/').slice(1);
  const at = (n) => resolve(script, t.slice(0, n));
  if (t[0] === 'meta' && t[1] === 'light' && t.length === 2) return { category: 'light' };
  if (t[0] === 'characters' && t.length === 3 && t[2] === 'kind') return { category: 'kind' };
  if (t[0] === 'characters' && t.length === 4 && t[2] === 'look') {
    const kind = catalog.kinds[(at(2) || {}).kind];
    if (!kind || !catalog.attributeSets[kind.attributeSet][t[3]]) return null;
    return { category: 'attribute', scope: `${kind.attributeSet}.${t[3]}` };
  }
  if (t[0] === 'sets' && t.length === 3 && t[2] === 'base') return { category: 'base' };
  if (t[0] === 'sets' && t[2] === 'pieces' && t.length === 5) {
    const field = t[4];
    if (field === 'piece') return { category: 'piece' };
    if (field === 'at') return { category: 'position' };
    if (field === 'layer') return { category: 'layer' };
    if (field === 'color') return { category: 'palette', scope: 'clothing' };
    if (field === 'variant') {
      const piece = catalog.pieces[(at(4) || {}).piece];
      return piece && piece.variants.length ? { category: 'pieceVariant', scope: (at(4) || {}).piece } : null;
    }
    return null;
  }
  // Scenes: main, branch and ending.
  const p = path;
  const m = /^(\/scenes\/\d+|\/decisions\/\d+\/options\/\d+\/scenes\/\d+|\/endings\/\d+\/scenes\/\d+)\/(.+)$/.exec(p);
  if (!m) return null;
  const rest = m[2].split('/');
  if (rest.length === 1 && rest[0] === 'light') return { category: 'light' };
  if (rest[0] === 'cast' && rest.length === 3) {
    if (rest[2] === 'at') return { category: 'position' };
    if (rest[2] === 'emotion') return { category: 'emotion' };
    return null;
  }
  if (rest[0] === 'items' && rest.length === 3) {
    if (rest[2] === 'item') return { category: 'item' };
    if (rest[2] === 'at') return { category: 'position' };
    return null;
  }
  if (rest[0] === 'beats' && rest.length === 3) {
    const beat = resolve(script, t.slice(0, t.length - 1)) || {};
    switch (rest[2]) {
      case 'action': return { category: 'action' };
      case 'variant': return catalog.actions[beat.action] ? { category: 'variant', scope: beat.action } : null;
      case 'to': return { category: 'position' };
      case 'target': return { category: 'position' };
      case 'height': return { category: 'height' };
      case 'emotion': return { category: 'emotion' };
      default: return null;
    }
  }
  return null;
}

function fromSchemaError(e, script, catalog) {
  if (e.keyword === 'pattern') {
    const field = catalogFieldOf(e.path, script, catalog);
    const value = resolve(script, e.path.split('/').slice(1));
    if (field && typeof value === 'string') {
      const s = suggestDetailed(value, field.category, field.scope, catalog);
      return makeError('E_SCHEMA', e.path, e.message + suggestionText(value, s),
        { suggestion: s.suggestion, approximation: s.approximation });
    }
  }
  if (e.keyword === 'minItems' || e.keyword === 'maxItems') {
    const n = e.count;
    if (e.path === '/scenes') {
      return makeError('E_COUNT_SCENES', e.path,
        `The main column has ${n} scenes; it needs ${e.min} to ${e.max}. Main scenes come from the user: ask them, do not add or remove scenes.`);
    }
    if (e.path === '/decisions') {
      return makeError('E_COUNT_DECISIONS', e.path, `The story has ${n} decisions; it needs ${e.min} or ${e.max}.`);
    }
    if (e.path === '/endings') {
      return makeError('E_COUNT_ENDINGS', e.path, `The story has ${n} endings; it needs ${e.min} or ${e.max}.`);
    }
    const m = /^\/decisions\/(\d+)\/options$/.exec(e.path);
    if (m) {
      const d = script.decisions[Number(m[1])];
      const name = isPlainObject(d) && typeof d.id === 'string' && d.id !== '' ? d.id : `#${m[1]}`;
      return makeError('E_COUNT_OPTIONS', e.path, `Decision ${name} has ${n} options; it needs ${e.min} or ${e.max}.`);
    }
  }
  return makeError('E_SCHEMA', e.path, e.message, { suggestion: e.suggestion });
}

function collectScenes(script) {
  const list = [];
  script.scenes.forEach((scene, i) => list.push({ scene, path: join('/scenes', i), role: 'main' }));
  script.decisions.forEach((d, i) =>
    d.options.forEach((o, j) =>
      (o.scenes || []).forEach((scene, k) =>
        list.push({ scene, path: join('/decisions', i, 'options', j, 'scenes', k), role: 'branch' }))));
  script.endings.forEach((e, i) =>
    e.scenes.forEach((scene, k) => list.push({ scene, path: join('/endings', i, 'scenes', k), role: 'ending' })));
  return list;
}

// V7-V24.
function semanticA(script, catalog, scenes, errors) {
  const T = catalog.text;
  const positionIds = Object.keys(catalog.positions);
  const characterIds = script.characters.map((c) => c.id);
  const setIds = script.sets.map((s) => s.id);
  const varIds = (script.state || []).map((v) => v.var);
  const mainIds = script.scenes.map((s) => s.id);
  const allSceneIds = scenes.map((s) => s.scene.id);
  const decisionIds = script.decisions.map((d) => d.id);
  const onstage = (pos) => Boolean(catalog.positions[pos] && catalog.positions[pos].onstage);

  const err = (code, path, message, extra) => errors.push(makeError(code, path, message, extra));

  const unique = (list, kind) => {
    const first = new Map();
    for (const { id, path } of list) {
      if (first.has(id)) err('E_DUPLICATE_ID', path, `${kind} id "${id}" is used twice (first at ${first.get(id)}).`);
      else first.set(id, path);
    }
  };

  const inCatalog = (value, category, scope, path) => {
    const entries = categoryEntries(catalog, category, scope);
    if (entries.some((e) => e.id === value)) return true;
    const s = suggestDetailed(value, category, scope, catalog);
    let message = `${path}: "${value}" is not a valid ${categoryLabel(category, scope)}.` + suggestionText(value, s);
    if (entries.length <= 12) message += ` Valid: ${entries.map((e) => e.id).join(', ')}.`;
    err('E_CATALOG', path, message, { suggestion: s.suggestion, approximation: s.approximation });
    return false;
  };

  const ref = (value, known, what, path, exists = known) => {
    if (exists.includes(value)) return true;
    const guess = closest(value, known);
    const shown = known.length === 0 ? 'none' : known.slice(0, 8).join(', ') + (known.length > 8 ? ', …' : '');
    err('E_REF', path, `${path}: "${value}" is not ${article(what)} (known: ${shown}).` + (guess ? ` Did you mean "${guess}"?` : ''),
      { suggestion: guess });
    return false;
  };

  const text = (value, path, field, max) => {
    if (isBlank(value)) {
      err('E_TEXT_BLANK', path, `${path}: text is blank.`);
      return;
    }
    const n = codePoints(value);
    if (max !== undefined && n > max) err('E_TEXT_LENGTH', path, `${path}: ${field} has ${n} characters; the maximum is ${max}.`);
  };

  const balloon = (say, path) => {
    if (isBlank(say)) {
      err('E_TEXT_BLANK', path, `${path}: text is blank.`);
      return;
    }
    let bad = false;
    const n = codePoints(say);
    if (n > T.balloonMaxChars) {
      err('E_BALLOON_LENGTH', path, `${path}: balloon has ${n} characters; the maximum is ${T.balloonMaxChars}. Split it into two beats.`);
      bad = true;
    }
    const long = say.split(/\s+/).find((w) => codePoints(w) > T.balloonLineChars);
    if (long !== undefined) {
      err('E_BALLOON_WORD', path,
        `${path}: the word "${long}" has ${codePoints(long)} characters; balloon lines hold ${T.balloonLineChars}. Use a shorter word.`);
      bad = true;
    }
    if (!bad) {
      const lines = wrapText(say, T.balloonLineChars).length;
      if (lines > T.balloonMaxLines) {
        err('E_BALLOON_LINES', path, `${path}: balloon needs ${lines} lines; the maximum is ${T.balloonMaxLines}. Shorten it.`);
      }
    }
  };

  // meta
  const meta = script.meta;
  text(meta.title, '/meta/title', 'title', T.titleMaxChars);
  inCatalog(meta.light, 'light', null, '/meta/light');
  if (!catalog.ui[meta.lang] && !meta.ui) {
    err('E_UI_MISSING', '/meta/lang', `meta.lang "${meta.lang}" has no built-in UI texts; add meta.ui with start, restart and decision.`);
  }
  if (meta.ui) {
    for (const k of ['start', 'restart', 'decision']) text(meta.ui[k], join('/meta/ui', k), `ui.${k}`, T.uiMaxChars);
  }

  // state
  unique((script.state || []).map((v, i) => ({ id: v.var, path: join('/state', i, 'var') })), 'Variable');

  // characters
  unique(script.characters.map((c, i) => ({ id: c.id, path: join('/characters', i, 'id') })), 'Character');
  script.characters.forEach((c, i) => {
    const cp = join('/characters', i);
    if (positionIds.includes(c.id)) {
      err('E_ID_CLASH', join(cp, 'id'), `Character id "${c.id}" is also a stage position; rename the character.`);
    }
    text(c.name, join(cp, 'name'), 'name', T.nameMaxChars);
    if (inCatalog(c.kind, 'kind', null, join(cp, 'kind')) && c.look) {
      const setName = catalog.kinds[c.kind].attributeSet;
      const attrs = catalog.attributeSets[setName];
      for (const [key, value] of Object.entries(c.look)) {
        const p = join(cp, 'look', key);
        if (!attrs[key]) {
          err('E_LOOK_KEY', p, `${p}: kind "${c.kind}" has no attribute "${key}" (it has: ${Object.keys(attrs).join(', ')}).`);
        } else {
          inCatalog(value, 'attribute', `${setName}.${key}`, p);
        }
      }
    }
  });

  // sets
  unique(script.sets.map((s, i) => ({ id: s.id, path: join('/sets', i, 'id') })), 'Set');
  script.sets.forEach((s, i) => {
    const sp = join('/sets', i);
    inCatalog(s.base, 'base', null, join(sp, 'base'));
    (s.pieces || []).forEach((pc, k) => {
      const pp = join(sp, 'pieces', k);
      const pieceOk = inCatalog(pc.piece, 'piece', null, join(pp, 'piece'));
      const piece = pieceOk ? catalog.pieces[pc.piece] : null;
      if (inCatalog(pc.at, 'position', null, join(pp, 'at')) && !onstage(pc.at)) {
        err('E_PIECE', join(pp, 'at'), `Pieces must be on stage; "${pc.at}" is off stage.`);
      }
      if (pc.layer !== undefined && inCatalog(pc.layer, 'layer', null, join(pp, 'layer')) && piece && !piece.layers.includes(pc.layer)) {
        err('E_PIECE', join(pp, 'layer'), `Piece "${pc.piece}" cannot go in layer "${pc.layer}" (allowed: ${piece.layers.join(', ')}).`);
      }
      if (pc.variant !== undefined && piece) {
        if (piece.variants.length === 0) err('E_PIECE', join(pp, 'variant'), `Piece "${pc.piece}" has no variants.`);
        else inCatalog(pc.variant, 'pieceVariant', pc.piece, join(pp, 'variant'));
      }
      if (pc.color !== undefined && piece) {
        if (!piece.colorable) err('E_PIECE', join(pp, 'color'), `Piece "${pc.piece}" cannot be colored.`);
        else inCatalog(pc.color, 'palette', 'clothing', join(pp, 'color'));
      }
    });
  });

  // scenes (main, branch and ending share one id space)
  unique(scenes.map((info) => ({ id: info.scene.id, path: join(info.path, 'id') })), 'Scene');
  for (const info of scenes) {
    const { scene, path: sp } = info;
    const setOk = ref(scene.set, setIds, 'set', join(sp, 'set'));
    const lightOk = scene.light === undefined || inCatalog(scene.light, 'light', null, join(sp, 'light'));
    const light = scene.light !== undefined ? scene.light : meta.light;
    if (setOk && lightOk && catalog.lights[light]) {
      const set = script.sets.find((s) => s.id === scene.set);
      const base = catalog.bases[set.base];
      if (base && base.outdoor && !catalog.lights[light].outdoorAllowed) {
        const p = scene.light !== undefined ? join(sp, 'light') : sp;
        err('E_LIGHT_BASE', p,
          `${p}: light "${light}" only works in base "room"; set "${set.id}" uses base "${set.base}". Use day, sunset or dusk.`);
      }
    }

    const castIds = scene.cast.map((c) => c.who);
    unique(scene.cast.map((c, j) => ({ id: c.who, path: join(sp, 'cast', j, 'who') })), 'Cast member');
    scene.cast.forEach((c, j) => {
      const cp = join(sp, 'cast', j);
      ref(c.who, characterIds, 'character', join(cp, 'who'));
      inCatalog(c.at, 'position', null, join(cp, 'at'));
      if (c.emotion !== undefined) inCatalog(c.emotion, 'emotion', null, join(cp, 'emotion'));
    });

    const items = scene.items || [];
    const itemIds = items.map((it) => it.id);
    unique(items.map((it, k) => ({ id: it.id, path: join(sp, 'items', k, 'id') })), 'Item');
    items.forEach((it, k) => {
      const ip = join(sp, 'items', k);
      inCatalog(it.item, 'item', null, join(ip, 'item'));
      const hasAt = it.at !== undefined;
      const hasHolder = it.held_by !== undefined;
      if (hasAt === hasHolder) err('E_ITEM', ip, `${ip}: an item needs exactly one of "at" or "held_by".`);
      if (hasAt && inCatalog(it.at, 'position', null, join(ip, 'at')) && !onstage(it.at)) {
        err('E_ITEM', join(ip, 'at'), `${join(ip, 'at')}: items on the ground must be on stage.`);
      }
      if (hasHolder) ref(it.held_by, castIds, 'cast member of this scene', join(ip, 'held_by'));
    });

    const target = (beat, bp, kinds, name) => {
      const tp = join(bp, 'target');
      const isCast = castIds.includes(beat.target);
      const isPosition = positionIds.includes(beat.target);
      if (!isCast && !isPosition) {
        ref(beat.target, [...castIds, ...positionIds], 'cast member of this scene or position', tp);
        return;
      }
      if (beat.target === beat.actor) {
        err('E_TARGET', tp, `${tp}: a character cannot target itself.`);
      } else if ((isPosition && !kinds.includes('position')) || (isCast && !kinds.includes('character'))) {
        err('E_TARGET', tp, `${tp}: target of "${name}" must be ${kinds.map(article).join(' or ')}.`);
      }
    };

    const duration = (beat, bp, range, name) => {
      if (beat.duration === undefined) return;
      if (beat.duration < range.min || beat.duration > range.max) {
        const p = join(bp, 'duration');
        err('E_DURATION', p, `${p}: duration ${beat.duration}s is outside ${range.min}–${range.max}s for "${name}".`);
      }
    };

    scene.beats.forEach((beat, n) => {
      const bp = join(sp, 'beats', n);
      ref(beat.actor, castIds, 'cast member of this scene', join(bp, 'actor'));
      if (beat.action === undefined) {
        if (beat.emotion === undefined) {
          err('E_BEAT_EMPTY', bp, `${bp}: a beat needs an action, or an emotion for a reaction beat.`);
        } else {
          for (const f of REACTION_ONLY_FORBIDDEN) {
            if (beat[f] !== undefined) {
              const p = join(bp, f);
              err('E_REACTION', p,
                `${p}: a reaction beat (no action) only accepts emotion, intensity, target, duration and together; remove "${f}".`);
            }
          }
        }
        if (beat.target !== undefined) target(beat, bp, ['character', 'position'], 'reaction');
        duration(beat, bp, catalog.timing.reaction, 'reaction');
      } else if (inCatalog(beat.action, 'action', null, join(bp, 'action'))) {
        const action = catalog.actions[beat.action];
        const variantId = beat.variant !== undefined ? beat.variant : action.defaultVariant;
        const variantOk = beat.variant === undefined || inCatalog(beat.variant, 'variant', beat.action, join(bp, 'variant'));
        const { params, changedByVariant } = variantOk
          ? effectiveParams(action, variantId)
          : { params: action.params, changedByVariant: new Set() };
        for (const param of PARAMS) {
          const rule = params[param] || 'forbidden';
          const who = changedByVariant.has(param)
            ? `action "${beat.action}" with variant "${variantId}"`
            : `action "${beat.action}"`;
          if (rule === 'required' && beat[param] === undefined) {
            err('E_PARAM', bp, `${bp}: ${who} requires "${param}".`);
          } else if (rule === 'forbidden' && beat[param] !== undefined) {
            const p = join(bp, param);
            err('E_PARAM', p, `${p}: ${who} does not take "${param}".`);
          }
        }
        if (beat.to !== undefined && params.to !== 'forbidden') inCatalog(beat.to, 'position', null, join(bp, 'to'));
        if (beat.height !== undefined && params.height !== 'forbidden') inCatalog(beat.height, 'height', null, join(bp, 'height'));
        if (beat.item !== undefined && params.item !== 'forbidden') ref(beat.item, itemIds, 'item of this scene', join(bp, 'item'));
        if (beat.target !== undefined && params.target !== 'forbidden') target(beat, bp, action.targetKinds || ['character'], beat.action);
        duration(beat, bp, action.duration, beat.action);
      }
      if (beat.emotion !== undefined) inCatalog(beat.emotion, 'emotion', null, join(bp, 'emotion'));
      if (beat.say !== undefined && beat.action !== undefined) balloon(beat.say, join(bp, 'say'));
    });
  }

  // decisions
  unique(script.decisions.map((d, i) => ({ id: d.id, path: join('/decisions', i, 'id') })), 'Decision');
  script.decisions.forEach((d, i) => {
    const dp = join('/decisions', i);
    ref(d.after, mainIds, 'scene', join(dp, 'after'), allSceneIds);
    unique(d.options.map((o, j) => ({ id: o.id, path: join(dp, 'options', j, 'id') })), 'Option');
    d.options.forEach((o, j) => {
      const op = join(dp, 'options', j);
      text(o.label, join(op, 'label'), 'label', T.labelMaxChars);
      (o.effects || []).forEach((e, k) => ref(e.var, varIds, 'state variable', join(op, 'effects', k, 'var')));
      if (o.rejoin !== ENDINGS_MARK) ref(o.rejoin, [...mainIds, ENDINGS_MARK], 'main scene or @endings', join(op, 'rejoin'));
    });
  });

  // endings
  const condition = (c, p) => {
    if ('choice' in c) {
      if (ref(c.choice, decisionIds, 'decision', join(p, 'choice'))) {
        const d = script.decisions.find((x) => x.id === c.choice);
        ref(c.is, d.options.map((o) => o.id), `option of decision "${d.id}"`, join(p, 'is'));
      }
    } else if ('var' in c) {
      ref(c.var, varIds, 'state variable', join(p, 'var'));
    } else if ('all' in c) {
      c.all.forEach((x, k) => condition(x, join(p, 'all', k)));
    } else if ('any' in c) {
      c.any.forEach((x, k) => condition(x, join(p, 'any', k)));
    } else if ('not' in c) {
      condition(c.not, join(p, 'not'));
    }
  };
  unique(script.endings.map((e, i) => ({ id: e.id, path: join('/endings', i, 'id') })), 'Ending');
  script.endings.forEach((e, i) => {
    const ep = join('/endings', i);
    text(e.title, join(ep, 'title'), 'ending title', T.endingTitleMaxChars);
    if (e.when !== undefined) condition(e.when, join(ep, 'when'));
  });

  // notes
  const notes = script.notes || {};
  (notes.approximations || []).forEach((a, i) => {
    for (const k of ['requested', 'used', 'reason']) {
      if (a[k] !== undefined) text(a[k], join('/notes/approximations', i, k), k);
    }
  });
  (notes.invented || []).forEach((t, i) => text(t, join('/notes/invented', i), 'note'));
  if (notes.comment !== undefined) text(notes.comment, '/notes/comment', 'comment');
}

// V32-V37.
function flowChecks(script, scenes, errors) {
  const err = (code, path, message) => errors.push(makeError(code, path, message));
  const mainIndex = new Map(script.scenes.map((s, i) => [s.id, i]));
  const branchIds = new Set(scenes.filter((s) => s.role === 'branch').map((s) => s.scene.id));
  const endingSceneIds = new Set(scenes.filter((s) => s.role === 'ending').map((s) => s.scene.id));

  // V32
  const taken = new Set();
  script.decisions.forEach((d, i) => {
    const p = join('/decisions', i, 'after');
    if (branchIds.has(d.after)) {
      err('E_DECISION_AFTER', p, `${p}: a decision must follow a main scene; "${d.after}" is a branch scene.`);
    } else if (endingSceneIds.has(d.after)) {
      err('E_DECISION_AFTER', p, `${p}: a decision must follow a main scene; "${d.after}" is an ending scene.`);
    } else if (taken.has(d.after)) {
      err('E_DECISION_AFTER', p, `${p}: two decisions follow "${d.after}"; only one is allowed per main scene.`);
    } else {
      taken.add(d.after);
    }
  });

  // V33
  let previous = null;
  for (const d of script.decisions) {
    if (!mainIndex.has(d.after)) continue;
    if (previous && mainIndex.get(d.after) < mainIndex.get(previous.after)) {
      err('E_DECISION_ORDER', '/decisions',
        `Decisions must be listed in story order: "${d.id}" comes before "${previous.id}" in the main column.`);
      break;
    }
    previous = d;
  }

  // V34
  script.decisions.forEach((d, i) => {
    if (!mainIndex.has(d.after)) return;
    const k = mainIndex.get(d.after);
    const expected = k === script.scenes.length - 1 ? ENDINGS_MARK : script.scenes[k + 1].id;
    d.options.forEach((o, j) => {
      if (o.rejoin === expected) return;
      const p = join('/decisions', i, 'options', j, 'rejoin');
      err('E_REJOIN', p,
        `${p}: option "${d.id}.${o.id}" must rejoin at "${expected}", not "${o.rejoin}". Branches always return to the next main scene, or to @endings after the last one.`);
    });
  });

  // V35
  let whenMissing = false;
  script.endings.forEach((e, i) => {
    if (i < script.endings.length - 1 && e.when === undefined) {
      const p = join('/endings', i);
      err('E_WHEN_MISSING', p, `${p}: only the last ending may omit "when".`);
      whenMissing = true;
    }
  });
  if (whenMissing) return;

  // V36
  const combos = combinations(script).map((c) => ({ ...c, ending: endingFor(script, c) }));
  const lost = combos.filter((c) => c.ending < 0);
  lost.slice(0, 10).forEach((c) => err('E_NO_ENDING', '/endings',
    `Choices ${describeChoices(c.choices)} reach no ending. Make the last ending unconditional or widen a condition.`));
  if (lost.length > 10) err('E_NO_ENDING', '/endings', `…and ${lost.length - 10} more combinations.`);

  // V37
  script.endings.forEach((e, i) => {
    if (combos.some((c) => c.ending === i)) return;
    const p = join('/endings', i);
    const satisfying = combos.filter((c) => evalCondition(e.when, c));
    if (satisfying.length === 0) {
      err('E_UNREACHABLE_ENDING', p, `Ending "${e.id}" is never shown: no combination satisfies it.`);
    } else {
      const takers = [...new Set(satisfying.map((c) => c.ending))].sort((a, b) => a - b).map((k) => script.endings[k].id);
      err('E_UNREACHABLE_ENDING', p,
        `Ending "${e.id}" is never shown: every combination that satisfies it is taken by an earlier ending (${takers.join(', ')}).`);
    }
  });
}

function collectWarnings(script, catalog, scenes, warnings) {
  const warn = (code, path, message) => warnings.push(makeWarning(code, path, message));
  const usedCharacters = new Set();
  const usedSets = new Set();
  for (const { scene } of scenes) {
    usedSets.add(scene.set);
    for (const c of scene.cast) usedCharacters.add(c.who);
  }
  script.characters.forEach((c, i) => {
    if (!usedCharacters.has(c.id)) warn('W_UNUSED_CHARACTER', join('/characters', i), `Character "${c.id}" appears in no scene.`);
  });
  script.sets.forEach((s, i) => {
    if (!usedSets.has(s.id)) warn('W_UNUSED_SET', join('/sets', i), `Set "${s.id}" is used by no scene.`);
  });

  const changed = new Set();
  for (const d of script.decisions) for (const o of d.options) for (const e of o.effects || []) changed.add(e.var);
  const tested = new Set();
  const walk = (c) => {
    if (!c) return;
    if ('var' in c) tested.add(c.var);
    (c.all || []).forEach(walk);
    (c.any || []).forEach(walk);
    if ('not' in c) walk(c.not);
  };
  script.endings.forEach((e) => walk(e.when));
  (script.state || []).forEach((v, i) => {
    const p = join('/state', i);
    if (!changed.has(v.var)) warn('W_UNUSED_VAR', p, `State variable "${v.var}" is never changed.`);
    if (!tested.has(v.var)) warn('W_UNUSED_VAR', p, `State variable "${v.var}" is never tested.`);
  });

  script.characters.forEach((c, i) => {
    if (!c.look || c.look.bottom_color === undefined) return;
    const kind = catalog.kinds[c.kind];
    if (!kind || kind.attributeSet !== 'person') return;
    const look = effectiveLook(catalog, c);
    const outfit = catalog.attributeSets.person.outfit.values[look.outfit];
    if (outfit && outfit.usesBottomColor === false) {
      const p = join('/characters', i, 'look', 'bottom_color');
      warn('W_IGNORED_ATTR', p, `${p}: bottom_color is ignored with outfit "${look.outfit}".`);
    }
  });
}

function buildStats(script, catalog, scenes) {
  const outs = outcomes(script, catalog);
  const endingsReach = {};
  for (const e of script.endings) endingsReach[e.id] = outs.filter((o) => o.ending === e.id).length;
  const seconds = outs.map((o) => o.seconds);
  return {
    mainScenes: script.scenes.length,
    branchScenes: scenes.filter((s) => s.role === 'branch').length,
    endingScenes: scenes.filter((s) => s.role === 'ending').length,
    decisions: script.decisions.length,
    endings: script.endings.length,
    paths: outs.length,
    secondsMin: Math.min(...seconds),
    secondsMax: Math.max(...seconds),
    outcomes: outs,
    endingsReach,
  };
}

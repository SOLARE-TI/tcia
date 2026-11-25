// Stage simulation of one scene (D8) and its duration (D9). The engine runs
// the same rules; the validator uses this to find impossible stagings and to
// compute path lengths.

import { join } from './pointer.mjs';
import { clamp, readSeconds } from './text.mjs';

const MOVERS = new Set(['walk', 'run']);
const WITH_PARTNER = new Set(['give', 'hug']);

function error(code, path, message) {
  return { code, path, message, suggestion: null, approximation: null };
}

// simulateScene(scene, scenePath, catalog) -> { errors, seconds }
// Assumes the scene passed the structural checks (references and catalog ids).
export function simulateScene(scene, scenePath, catalog) {
  const errors = [];
  const P = catalog.positions;
  const onstage = (pos) => Boolean(P[pos] && P[pos].onstage);
  const spacing = catalog.stage.markSpacing;
  const timing = catalog.timing;

  // Initial state.
  const actors = {};
  scene.cast.forEach((c) => {
    actors[c.who] = {
      pos: c.at,
      posture: c.posture || 'standing',
      holding: null,
      emotion: c.emotion || 'neutral',
      intensity: c.intensity || 2,
    };
  });
  const items = {};
  (scene.items || []).forEach((it, k) => {
    if (it.held_by !== undefined) {
      const holder = actors[it.held_by];
      if (holder.holding !== null) {
        errors.push(error('E_ITEM', join(scenePath, 'items', k, 'held_by'),
          `${join(scenePath, 'items', k, 'held_by')}: "${it.held_by}" already holds "${holder.holding}".`));
      } else {
        holder.holding = it.id;
      }
      items[it.id] = { at: null, heldBy: it.held_by };
    } else {
      items[it.id] = { at: it.at, heldBy: null };
    }
  });

  // Occupancy at the start.
  const seenAt = new Map();
  scene.cast.forEach((c, j) => {
    if (!onstage(c.at)) return;
    if (seenAt.has(c.at)) {
      errors.push(error('E_POSITION_SHARED', join(scenePath, 'cast', j),
        `${scene.id}: "${seenAt.get(c.at)}" and "${c.who}" are both at "${c.at}" at the start.`));
    } else {
      seenAt.set(c.at, c.who);
    }
  });

  // Groups.
  const groups = [];
  scene.beats.forEach((beat, i) => {
    if (beat.together === true && i === 0) {
      const p = join(scenePath, 'beats', i, 'together');
      errors.push(error('E_TOGETHER', p, `${p}: the first beat of a scene cannot be together.`));
    }
    if (beat.together === true && groups.length > 0) groups[groups.length - 1].push(i);
    else groups.push([i]);
  });

  let seconds = 0;
  for (const group of groups) {
    const start = {};
    for (const [id, a] of Object.entries(actors)) start[id] = { ...a };
    const startItems = {};
    for (const [id, it] of Object.entries(items)) startItems[id] = { ...it };

    const participants = new Map();
    let balloonBeat = null;
    let groupSeconds = 0;
    const plans = [];

    for (const i of group) {
      const beat = scene.beats[i];
      const bp = join(scenePath, 'beats', i);
      const action = beat.action !== undefined ? catalog.actions[beat.action] : null;
      const variantId = beat.variant !== undefined ? beat.variant : action ? action.defaultVariant : null;
      const variant = action ? action.variants[variantId] : null;
      const a = start[beat.actor];
      const plan = { beat, i, bp, action, ok: true, standUp: false };

      // One beat per character per group; one balloon per group.
      const who = [beat.actor];
      if (action && WITH_PARTNER.has(beat.action) && beat.target !== undefined) who.push(beat.target);
      for (const w of who) {
        if (participants.has(w)) {
          errors.push(error('E_TOGETHER', bp,
            `${bp}: "${w}" takes part in two beats of the same group (beats ${participants.get(w)} and ${i}).`));
        } else {
          participants.set(w, i);
        }
      }
      if (beat.say !== undefined) {
        if (balloonBeat !== null) {
          const sp = join(bp, 'say');
          errors.push(error('E_TOGETHER', sp, `${sp}: only one beat per group may have a balloon.`));
        } else {
          balloonBeat = i;
        }
      }

      // Off stage.
      if (!onstage(a.pos) && (!MOVERS.has(beat.action) || beat.say !== undefined)) {
        errors.push(error('E_OFFSTAGE', bp,
          `${bp}: "${beat.actor}" is off stage (${a.pos}); only walk or run, without say, can bring them in.`));
        plan.ok = false;
      }
      const t = beat.target !== undefined ? start[beat.target] : undefined;
      if (t && !onstage(t.pos)) {
        const tp = join(bp, 'target');
        errors.push(error('E_OFFSTAGE', tp, `${tp}: "${beat.target}" is off stage and cannot be a target.`));
        plan.ok = false;
      }

      // Posture: stand up first when the action cannot start from here.
      if (action && !action.startPostures.includes(a.posture)) plan.standUp = true;

      // Action rules.
      let marks = 0;
      if (action && plan.ok) {
        const toPath = join(bp, 'to');
        if (action.motion === 'travel') {
          if (beat.to === a.pos) {
            errors.push(error('E_MOVE', toPath, `${toPath}: "${beat.actor}" is already at "${a.pos}".`));
            plan.ok = false;
          }
        } else if (action.motion === 'optional_travel' && beat.to !== undefined) {
          if (!onstage(beat.to)) {
            errors.push(error('E_OFFSTAGE', toPath, `${toPath}: jump cannot leave the stage; use walk or run.`));
            plan.ok = false;
          } else if (beat.to === a.pos) {
            errors.push(error('E_MOVE', toPath, `${toPath}: "${beat.actor}" is already at "${a.pos}".`));
            plan.ok = false;
          } else {
            const n = Math.abs(P[beat.to].order - P[a.pos].order);
            if (n > action.maxDistance) {
              errors.push(error('E_MOVE', toPath, `${toPath}: jump covers ${n} marks; the maximum is ${action.maxDistance}.`));
              plan.ok = false;
            }
          }
        }
        if (beat.action === 'sit' && a.posture === 'sitting') {
          errors.push(error('E_POSTURE', bp, `${bp}: "${beat.actor}" is already sitting.`));
          plan.ok = false;
        }
        if (beat.action === 'pick_up') {
          const ip = join(bp, 'item');
          const it = startItems[beat.item];
          if (a.holding !== null) {
            errors.push(error('E_ITEM', ip, `${ip}: "${beat.actor}" already holds "${a.holding}".`));
            plan.ok = false;
          } else if (!it || it.at !== a.pos) {
            errors.push(error('E_ITEM', ip, `${ip}: item "${beat.item}" is not on the ground at "${a.pos}".`));
            plan.ok = false;
          }
        }
        if (WITH_PARTNER.has(beat.action) && t) {
          const tp = join(bp, 'target');
          if (beat.action === 'give') {
            if (a.holding === null) {
              errors.push(error('E_ITEM', bp, `${bp}: "${beat.actor}" holds nothing to give.`));
              plan.ok = false;
            }
            if (t.holding !== null) {
              errors.push(error('E_ITEM', tp, `${tp}: "${beat.target}" already holds "${t.holding}".`));
              plan.ok = false;
            }
          }
          const postures = action.targetPostures || [];
          if (!postures.includes(t.posture)) {
            errors.push(error('E_POSTURE', tp, `${tp}: "${beat.target}" must be ${postures.join(' or ')} for "${beat.action}".`));
            plan.ok = false;
          }
          const range = (variant && variant.distance) || action.distance;
          if (range && onstage(t.pos) && onstage(a.pos)) {
            const n = Math.abs(P[t.pos].order - P[a.pos].order);
            if (n < range[0] || n > range[1]) {
              errors.push(error('E_DISTANCE', tp,
                `${tp}: "${beat.actor}" and "${beat.target}" are ${n} marks apart; "${beat.action}" (${variantId}) needs ${range[0]}–${range[1]}.`));
              plan.ok = false;
            }
          }
        }
        if (beat.to !== undefined && P[beat.to] && P[a.pos]) {
          marks = Math.abs(P[beat.to].x - P[a.pos].x) / spacing;
        }
      }

      // Duration (D9).
      let base;
      if (beat.duration !== undefined) base = beat.duration;
      else if (!action) base = timing.reaction.default;
      else if (action.motion === 'travel') base = clamp(marks * variant.secondsPerMark, action.duration.min, action.duration.max);
      else if (action.motion === 'optional_travel') {
        const d = action.duration;
        base = clamp(d.base + d.perMark * marks, d.min, d.max);
      } else base = variant.defaultDuration !== undefined ? variant.defaultDuration : action.duration.default;
      let effective = beat.say !== undefined ? Math.max(base, readSeconds(beat.say, catalog)) : base;
      if (plan.standUp) effective += timing.standUpSeconds;
      groupSeconds = Math.max(groupSeconds, effective);

      plans.push(plan);
    }

    // Apply the group.
    const moved = new Map();
    for (const plan of plans) {
      const { beat, action } = plan;
      const actor = actors[beat.actor];
      if (action) {
        if (plan.standUp) actor.posture = 'standing';
        if (beat.to !== undefined && (action.motion === 'travel' || action.motion === 'optional_travel') && P[beat.to]) {
          if (actor.pos !== beat.to) moved.set(beat.actor, plan);
          actor.pos = beat.to;
        }
        if (action.resultPosture) actor.posture = action.resultPosture;
        if (plan.ok && beat.action === 'pick_up') {
          actor.holding = beat.item;
          items[beat.item] = { at: null, heldBy: beat.actor };
        }
        if (plan.ok && beat.action === 'give') {
          const target = actors[beat.target];
          target.holding = actor.holding;
          items[actor.holding] = { at: null, heldBy: beat.target };
          actor.holding = null;
        }
      }
      if (beat.emotion !== undefined) {
        actor.emotion = beat.emotion;
        actor.intensity = beat.intensity !== undefined ? beat.intensity : 2;
      } else if (beat.intensity !== undefined) {
        actor.intensity = beat.intensity;
      }
    }

    // Occupancy after the group (only new collisions, caused by a move).
    for (const [mover, plan] of moved) {
      const pos = actors[mover].pos;
      if (!onstage(pos)) continue;
      for (const c of scene.cast) {
        if (c.who === mover || actors[c.who].pos !== pos) continue;
        if (moved.has(c.who) && scene.cast.findIndex((x) => x.who === c.who) > scene.cast.findIndex((x) => x.who === mover)) continue;
        errors.push(error('E_POSITION_SHARED', plan.bp,
          `${scene.id}: "${c.who}" and "${mover}" are both at "${pos}" after beat ${plan.i}.`));
        break;
      }
    }

    seconds += groupSeconds;
  }

  seconds += timing.sceneTailSeconds;
  return { errors, seconds };
}

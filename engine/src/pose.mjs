// Poses: from an actor at an instant (action, variant, phase, progress, emotion) to joint values and
// root squash/stretch. No DOM. Forward is +x (the drawing mirrors for actors facing left).
import { clamp, lerp, smooth, easeIn, phaseOf, seededRandom, fnv1a, TAU, travelProgress, PHASES } from './core.mjs';

export const RIGS = ['biped', 'quadruped', 'bird'];

// Fluidity (anexo «Estilo afinado y fluidez»)
// Poses blend into the next one during BLEND_MS at every boundary between beats and between phases.
export const BLEND_MS = 200;
// No joint moves more than this, in viewBox px, between two frames at 60 fps (except across scene cuts).
// The fastest motions that are meant to be fast set it: a high jump's take-off (the root alone climbs
// about 36 px per frame with the D9 timing and a 360 px jump) with the arms swinging up, and flips.
// Snaps between poses, which this limit exists to catch, measured 150 to 300 px before blending.
export const MAX_JOINT_STEP_PX = 110;
// A one-frame spike: a joint (or a balloon) that moves more than SPIKE_RATIO times the median step of the
// three frames before and the three after, and more than SPIKE_MIN_PX in absolute terms. None is allowed.
export const SPIKE_RATIO = 3;
export const SPIKE_MIN_PX = 30;
// Standing at rest (the title, idle with any emotion but fear), a knee bends at most this much, in degrees
// between thigh and shin (the spec allows 36 at most): the legs are almost straight (97 % of their length,
// about 28 degrees). Walking, a leg whose foot is on the ground keeps within it all through the beat, from
// the start to the settling (guardRestingKnees); only the leg that swings bends more. A sneak crouches on
// purpose and is not held to it.
export const MAX_REST_KNEE_DEG = 36;
// A walk or a run that starts by turning round does it in a little hop this long (s), both feet off the
// ground and back in place: it is not a step.
export const TURN_HOP_S = 0.15;
// A foot (or paw) resting on the ground never slides faster than this, in viewBox px per second
// (half a pixel per frame at 60 fps). Gait feet are placed in the world; what is left is rounding and the
// small settle of a bird landing from a hop.
export const MAX_FOOT_SLIP = 30;


function wave01(t, hz) { return Math.sin(t * hz * TAU); }

export function restPose(rig) {
  const p = { rig, x: 0, y: 0, rot: 0, pivot: 0, sx: 1, sy: 1, spin: 1, phase: 'idle', fx: {}, face: {} };
  if (rig === 'biped') {
    Object.assign(p, { crouch: 0, lean: 0, head: 0, aF: [10, 12], aB: [-20, 14], wF: 0, wB: 0, fF: [0.1, 0], fB: [-0.08, 0], toeF: 0, toeB: 0, hand: null, legs: null });
  } else if (rig === 'quadruped') {
    Object.assign(p, { crouch: 0, pitch: 0, head: 0, tail: 25, tailWag: 0, ears: 0, fFF: [0.04, 0], fFB: [-0.04, 0], fBF: [0.04, 0], fBB: [-0.04, 0], mouth: 0, sitting: 0, lying: 0, rear: 0 });
  } else {
    Object.assign(p, { crouch: 0, pitch: 0, head: 0, wingF: 0, wingB: 0, tail: 10, lF: 8, lB: -8, beak: 0, tuck: 0 });
  }
  return p;
}

// volume-preserving squash: sx = 1/sy (A35)
function setSquash(p, sy) { p.sy = sy; p.sx = 1 / sy; return p; }

function copyPose(p) {
  const q = {};
  for (const k of Object.keys(p)) {
    const v = p[k];
    q[k] = Array.isArray(v) ? v.slice() : (v && typeof v === 'object' ? Object.assign({}, v) : v);
  }
  return q;
}

const ANGLES = { rot: true };

export function blendPose(a, b, t) {
  const out = copyPose(t < 0.5 ? a : b);
  out.face = Object.assign({}, a.face, b.face);
  for (const k of Object.keys(a)) {
    let va = a[k];
    const vb = b[k];
    if (typeof va === 'number' && typeof vb === 'number') {
      // whole turns are the same pose: blend angles the short way round
      if (ANGLES[k]) { while (va - vb > 180) va -= 360; while (vb - va > 180) va += 360; }
      out[k] = lerp(va, vb, t);
    } else if (Array.isArray(va) && Array.isArray(vb) && va.length === vb.length) out[k] = va.map((x, i) => lerp(x, vb[i], t));
  }
  out.sx = 1 / out.sy;
  return out;
}

// ---------- shared squash curves ----------

function jumpSquash(ph) {
  if (ph.phase === 'anticipation') return 1 - 0.18 * smooth(ph.u);
  if (ph.phase === 'main') {
    const u = ph.u;
    if (u < 0.12) return lerp(0.82, 1.22, u / 0.12);
    if (u < 0.5) return lerp(1.22, 1.0, (u - 0.12) / 0.38);
    if (u < 0.88) return 1;
    return lerp(1, 1.1, (u - 0.88) / 0.12);
  }
  // rubber bounce on landing: squash, overshoot, settle
  const u = ph.u;
  if (u < 0.22) return lerp(1.1, 0.8, u / 0.22);
  if (u < 0.55) return lerp(0.8, 1.07, smooth((u - 0.22) / 0.33));
  if (u < 0.8) return lerp(1.07, 0.98, smooth((u - 0.55) / 0.25));
  return lerp(0.98, 1, smooth((u - 0.8) / 0.2));
}

function fallSquash(ph, variant) {
  if (ph.phase === 'anticipation') return 1 - (variant === 'faint' ? 0.12 : 0.15) * smooth(ph.u);
  if (ph.phase === 'main') {
    const u = ph.u;
    const s0 = variant === 'faint' ? 0.88 : 0.85;
    if (u < 0.15) return lerp(s0, 1.16, u / 0.15);
    if (u < 0.55) return lerp(1.16, 1, (u - 0.15) / 0.4);
    return 1;
  }
  const u = ph.u;
  if (u < 0.2) return lerp(1, 0.8, u / 0.2);
  if (u < 0.6) return lerp(0.8, 1.06, (u - 0.2) / 0.4);
  return lerp(1.06, 1, (u - 0.6) / 0.4);
}

function flopSquash(ph) {
  if (ph.phase === 'anticipation') return 1 - 0.16 * smooth(ph.u);
  if (ph.phase === 'main') {
    const u = ph.u;
    if (u < 0.2) return lerp(0.84, 1.14, u / 0.2);
    if (u < 0.6) return lerp(1.14, 1, (u - 0.2) / 0.4);
    if (u < 0.75) return lerp(1, 0.78, (u - 0.6) / 0.15);
    return lerp(0.78, 1.06, (u - 0.75) / 0.25);
  }
  if (ph.u < 0.4) return lerp(1.06, 0.97, smooth(ph.u / 0.4));
  return lerp(0.97, 1, smooth((ph.u - 0.4) / 0.6));
}

// Generic comic envelope for every other action (A55): anticipation dip, exaggerated stretch,
// then a damped wobble that crosses 1 and settles exactly on 1.
const ENVELOPE = {
  walk: [0.06, 0.06], run: [0.1, 0.1], wave: [0.06, 0.08], talk: [0.05, 0.06], point: [0.06, 0.07],
  sit: [0.07, 0.07], pick_up: [0.08, 0.07], give: [0.06, 0.07], hug: [0.06, 0.08], think: [0.05, 0.06]
};

export function comicEnvelope(p, dip, peak) {
  if (p < 0.18) return 1 - dip * Math.sin((p / 0.18) * Math.PI * 0.5);
  if (p < 0.32) return lerp(1 - dip, 1 + peak, smooth((p - 0.18) / 0.14));
  if (p < 0.5) return lerp(1 + peak, 1 + peak * 0.25, smooth((p - 0.32) / 0.18));
  if (p < 0.8) return lerp(1 + peak * 0.25, 1, smooth((p - 0.5) / 0.3));
  const v = (p - 0.8) / 0.2;
  return 1 - 0.045 * Math.sin(v * 3 * Math.PI) * (1 - v * 0.6);
}

// generic gesture squash (small)
function gestureSquash(ph, amt) {
  if (ph.phase === 'anticipation') return 1 - amt * smooth(ph.u);
  if (ph.phase === 'main') return lerp(1 - amt, 1 + amt * 0.8, Math.min(1, ph.u * 4)) + (ph.u > 0.25 ? -amt * 0.8 * smooth((ph.u - 0.25) / 0.75) : 0);
  return 1;
}

function jumpHeight(ph, h) {
  if (ph.phase !== 'main') return 0;
  const u = ph.u;
  return -h * 4 * u * (1 - u);
}

// ---------- biped ----------

// Gait by distance: a foot on the ground keeps its place in the world; a swing carries it one stride
// ahead. Steps are spread over the distance actually travelled, so the root and the steps stay in step.
const SWING_FRAMES = 10;

// the moment (0..1 of the action) when the travelled distance reaches a, found by bisection
function closeStart(action, D, a) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (D * travelProgress(action, m) < a) lo = m; else hi = m; }
  return Math.min(hi, 0.98);
}

function gait(c, action, legs, opts) {
  const L = c.dims.legL;
  const D = Math.abs(c.dist || 0);
  const pp = clamp(c.p, 0, 1);
  const d = D * travelProgress(action, pp);
  // A foot rests on the ground for duty of its cycle and swings for the rest: a walk keeps a little
  // double support (duty > 0.5), a run flies between steps (duty < 0.5). The step is as long as a resting
  // foot can hold (duty x step within reach), so the legs swing over several frames, never in a flick.
  // the faster the body goes, the more it flies: a swing lasts at least SWING_FRAMES frames at 60 fps
  let vmax = 0;
  for (let k = 0; k < 40; k++) vmax = Math.max(vmax, travelProgress(action, (k + 1) / 40) - travelProgress(action, k / 40));
  vmax *= (D * 40) / Math.max(0.1, c.dur || 1);
  const span = (vmax * SWING_FRAMES) / 60;
  const reach = Math.max(1, opts.reach);
  const want = Math.min(opts.duty, Math.max(0.1, 1 / (1 + span / (1.9 * reach))));
  // an even number of steps, as close as can be to the wanted length; then the resting share that fits
  const N = Math.max(2, 2 * Math.round(D / (2 * Math.max(20, (reach * 0.95) / want))));
  const s = D > 0 ? D / N : 1;
  const duty = Math.min(opts.duty, Math.max(0.1, (reach * 0.95) / s));
  const w = (1 - duty) * s;
  const ph = phaseOf(action, pp);
  // a swinging foot travels only once it is a pixel off the ground (and stops before it sets down)
  const A = opts.lift * L;
  const marginFor = (amp) => (amp > 2 ? clamp(Math.acos(1 - 2 / amp) / (2 * Math.PI), 0.02, 0.2) : 0.2);
  const m = marginFor(A);
  const mc = marginFor(A * 0.6);
  const i = Math.min(N, Math.floor(d / s + 1e-9) + 1);
  const out = { d, D, s, N, i, q: clamp((d - (i - 1) * s) / s, 0, 1), theta: Math.PI * (d / s), feet: {} };
  for (const leg of legs) {
    // a foot lands half a step ahead of where it left, once per two steps; the last one lands at rest
    const landing = (k) => (k >= N ? D + leg.rest * L : leg.base * L + k * s + s / 2);
    let wx = leg.rest * L;
    let lift = 0;
    for (let k = 1; k <= N && D > 0; k++) {
      if (k % 2 !== leg.parity) continue;
      // a foot leaves when the hip is duty of a step past it (for its first step, past its rest place)
      const a = Math.max(0, Math.min((k - 0.5) * s - w, wx + duty * s));
      const b = Math.min(D, (k - 0.5) * s + w);
      if (d >= b - 1e-9) { wx = landing(k); continue; }
      if (d > a + 1e-9 && b > a) {
        const q = (d - a) / (b - a);
        // the foot peels off and sets down gently (no kick at the knee as the leg leaves straight), and
        // travels only once it is up, so it never slides on the ground
        wx = lerp(wx, landing(k), smooth(clamp((q - m) / (1 - 2 * m), 0, 1)));
        lift = 0.5 * (1 - Math.cos(2 * Math.PI * q)) * opts.lift * L;
      }
      break;
    }
    if (D > 0 && N % 2 !== leg.parity) {
      // the other foot closes the stance: it leaves when the hip has passed it and arrives at rest as
      // the body settles, over the end of the travel and the follow-through
      const a = Math.min(D, (N - 0.5 + duty) * s);
      if (d > a - 1e-9 && pp > closeStart(action, D, a)) {
        const p0 = closeStart(action, D, a);
        // (a quadruped's closing paws, when the body still has ground to cover, keep pace with it and land as
        // it stops, so they never trail out of reach; otherwise they close over the settling time)
        const q = opts.paced && D - a > 0.05 * s ? clamp((d - a) / (D - a), 0, 1) : clamp((pp - p0) / Math.max(1e-6, 1 - p0), 0, 1);
        wx = lerp(landing(N - 1), D + leg.rest * L, smooth(clamp((q - mc) / (1 - 2 * mc), 0, 1)));
        lift = 0.5 * (1 - Math.cos(2 * Math.PI * q)) * opts.lift * 0.6 * L;
      }
    }
    out.feet[leg.key] = { x: wx - d, lift };
  }
  return out;
}

// How high the hips can ride over the feet that are down: a resting leg stays almost straight, so the
// body dips a little as the feet spread (a walk's natural bob) and only the swinging leg bends.
// feet: [{ x, lift, hx }] relative to the root; reach: the leg's straight length (hip to ankle or paw)
function hipOverFeet(feet, reach, base, rest) {
  let h = rest;
  for (const f of feet) {
    // (a foot farther than the leg can reach counts as just within it, so nothing jumps)
    const dx = Math.min(Math.abs(f.x - f.hx), reach * 0.95);
    // a foot that starts to lift lets go of the hip quickly (it no longer holds the body up)
    h = Math.min(h, base + 3 * f.lift + Math.sqrt(reach * reach - dx * dx));
  }
  return h;
}

// horizontal reach of a leg whose hip is hipH above the foot, with two segments of length seg
function legReach(seg, hipH) {
  const r = 2 * seg * 0.97;
  return hipH >= r ? 0 : Math.sqrt(r * r - hipH * hipH);
}

// local foot target (leg-length units) that lands at world offset x and height lift once the root
// is squashed (sx, sy) and lifted by pose.y: a resting foot stays exactly where it is
function footTarget(p, L, f) {
  return [f.x / (p.sx || 1) / L, (f.lift + (p.y || 0)) / ((p.sy || 1) * L)];
}

function bipedWalkCycle(p, c, ph, variant, run) {
  const L = c.dims.legL;
  const lift = { normal: 0.2, sneak: 0.12, strut: 0.32, stomp: 0.26, dash: 0.3, panic: 0.34 }[variant] || 0.2;
  const dm = c.dims;
  const legLen = (dm.thigh + dm.shin) * 0.97;
  // walking, the hip dips at most ~7 % as the feet spread; running (knees bent) the body flies between steps;
  // sneaking, it creeps low
  const low = run ? 0.15 : (variant === 'sneak' ? 0.22 : 0);
  const reach = low ? legReach(dm.thigh, L * (1 - low) - dm.ankleY) : legLen * 0.37;
  const G = gait(c, run ? 'run' : 'walk', [{ key: 'fB', rest: -0.08, base: 0, parity: 1 }, { key: 'fF', rest: 0.1, base: 0, parity: 0 }],
    { reach, duty: run ? (variant === 'panic' ? 0.36 : 0.32) : 0.5, lift: lift * (run ? 1.2 : 1) });
  const hx = dm.hipSep * 0.4;
  // the resting leg stays almost straight: the hips ride over it (and fly a little when both feet are up)
  const hipRide = hipOverFeet([{ x: G.feet.fF.x, lift: G.feet.fF.lift, hx }, { x: G.feet.fB.x, lift: G.feet.fB.lift, hx: -hx }], legLen, dm.ankleY, L);
  const pp = clamp(c.p, 0, 1);
  const amp = G.D > 0 ? smooth(clamp(pp / 0.3, 0, 1)) * smooth(clamp((1 - pp) / 0.3, 0, 1)) : 0;
  const sw = Math.cos(G.theta) * amp;
  // running, the body keeps low and steady (the strides are chosen to be within reach at that height),
  // and never higher than the resting feet allow; walking, it rides over the resting leg
  // (running, it stays low until both feet are back under it at the very end)
  const hold = smooth(clamp(pp / 0.3, 0, 1)) * (1 - smooth(clamp((pp - 0.92) / 0.08, 0, 1)));
  p.crouch = run ? low * hold : clamp(1 - Math.min(hipRide, L * (1 - low * amp)) / L, 0, 0.6);
  if (run) {
    p.lean = (variant === 'panic' ? -4 : 16) * amp;
    p.aF = [lerp(10, -sw * 50 + 10, amp), lerp(12, 95, amp)];
    p.aB = [lerp(-20, sw * 50 + 10, amp), lerp(14, 95, amp)];
    p.head = -6 * amp;
  } else {
    p.aF = [lerp(10, -sw * 26 + 6, amp), 14 + Math.max(0, -sw) * 18];
    p.aB = [lerp(-20, sw * 26 + 6, amp), 14 + Math.max(0, sw) * 18];
  }
  if (variant === 'sneak') {
    p.lean = 14;
    p.aF = [70 + Math.sin(G.theta) * 8 * amp, 120];
    p.aB = [55 - Math.sin(G.theta) * 8 * amp, 125];
    p.wF = -40; p.wB = -40;
    p.toeF = 18; p.toeB = 18;
    p.head = 8;
  }
  if (variant === 'strut') {
    p.lean = -9;
    p.head = -10;
    p.aF = [p.aF[0] * (1 + 0.6 * amp), 30];
    p.aB = [p.aB[0] * (1 + 0.6 * amp), 30];
  }
  if (variant === 'stomp') {
    p.lean = 6;
    p.hand = 'fist';
    p.aF = [p.aF[0] * 0.6 + 20, 80];
    p.aB = [p.aB[0] * 0.6 + 20, 80];
    if (amp > 0.5 && (G.q < 0.08 || G.q > 0.92)) p.fx.dust = 1;
  }
  if (variant === 'dash') {
    // the legs turn into a blur as soon as the body really moves, and come back once it has nearly stopped
    if (amp > 0.05) p.legs = 'blur';
    // the arms stay swept back to the end: the next beat's blend brings them round, slowly enough
    const rise = smooth(clamp(pp / 0.3, 0, 1));
    p.lean = 26 * rise;
    p.aF = [lerp(10, -60, rise), lerp(12, 40, rise)];
    p.aB = [lerp(-20, -70, rise), lerp(14, 30, rise)];
    p.y = -L * 0.06 * amp;
    p.wheel = (G.d / (L * 1.2)) % 1;
  }
  if (variant === 'panic') {
    const f = Math.sin(c.t * 4 * TAU) * amp;
    p.aF = [lerp(10, 150 + f * 25, amp), 30 + f * 25];
    p.aB = [lerp(-20, 150 - f * 25, amp), 30 - f * 25];
    p.head = Math.sin(c.t * 5 * TAU) * 6 * amp;
    p.lean = -4 * amp;
    if (ph.phase === 'main') p.fx.sweat = 1;
  }
  // anticipation and follow-through: lean against the motion, then overshoot (walking, the dip is the
  // body's squash: the resting legs stay straight, A78)
  if (ph.phase === 'anticipation') {
    p.lean = (p.lean || 0) - 10 * Math.sin(ph.u * Math.PI);
    if (run || variant === 'sneak') p.crouch = (p.crouch || 0) + 0.08 * Math.sin(ph.u * Math.PI);
  }
  p.kneeGuard = !run && variant !== 'sneak';
  if (ph.phase === 'follow') p.lean = (p.lean || 0) + 12 * Math.sin(ph.u * Math.PI);
  // a little hop while turning round at the start of the beat, so no foot slides while it turns
  if (c.turning && c.t < TURN_HOP_S) p.y = (p.y || 0) - Math.sin((c.t / TURN_HOP_S) * Math.PI) * 14;
  const turnLift = c.turning && c.t < TURN_HOP_S ? Math.sin((c.t / TURN_HOP_S) * Math.PI) * 10 : 0;
  p.gaitFeet = { fF: { x: G.feet.fF.x, lift: G.feet.fF.lift + turnLift }, fB: { x: G.feet.fB.x, lift: G.feet.fB.lift + turnLift } };
  p.gaitInfo = { s: G.s, N: G.N, D: G.D };
}

function bipedJump(p, c, ph, variant) {
  const L = c.dims.legL;
  const hpx = c.heightPx || 220;
  setSquash(p, jumpSquash(ph));
  if (ph.phase === 'anticipation') {
    const k = smooth(ph.u);
    p.crouch = 0.32 * k;
    p.lean = 18 * k;
    p.aF = [lerp(10, -22, k), lerp(12, 30, k)];
    p.aB = [lerp(-20, -28, k), lerp(14, 30, k)];
    p.head = 6 * k;
  } else if (ph.phase === 'main') {
    const u = ph.u;
    p.y = jumpHeight(ph, variant === 'cartwheel' ? Math.max(60, hpx * 0.45) : hpx);
    const tuck = Math.sin(u * Math.PI);
    p.aF = [lerp(128, 105, tuck), -10];
    p.aB = [lerp(165, 120, tuck), 10];
    p.fF = [0.15, 0.25 * tuck];
    p.fB = [-0.15, 0.15 * tuck];
    p.crouch = 0.05;
    p.lean = -6;
    if (variant === 'flip' || variant === 'backflip') {
      const dir = variant === 'flip' ? 1 : -1;
      p.rot = dir * 360 * clamp((u - 0.05) / 0.9, 0, 1);
      p.pivot = c.dims.H * 0.5;
      p.fF = [0.35, 0.7 * tuck];
      p.fB = [0.25, 0.62 * tuck];
      p.aF = [lerp(170, 60, tuck), lerp(20, 80, tuck)];
      p.aB = [lerp(160, 50, tuck), lerp(20, 80, tuck)];
      p.crouch = 0.25 * tuck;
      p.head = 15 * tuck;
    } else if (variant === 'spin') {
      p.spin = Math.cos(clamp((u - 0.1) / 0.8, 0, 1) * 2 * TAU);
      // arms straight up, close to the axis, so the turn reads without hands flying around
      p.aF = [lerp(128, 172, Math.min(1, u * 4)), lerp(-10, 0, Math.min(1, u * 4))];
      p.aB = [lerp(165, 172, Math.min(1, u * 4)), 0];
      p.fF = [0.06, 0.2 * tuck];
      p.fB = [-0.02, 0.05];
    } else if (variant === 'cartwheel') {
      p.rot = 360 * u;
      p.pivot = L * 0.95;
      p.aF = [175, 0];
      p.aB = [175, 0];
      p.fF = [0.55, 0.15];
      p.fB = [-0.55, 0.15];
      p.lean = 0;
    } else if (variant === 'split') {
      const k = Math.sin(clamp((u - 0.15) / 0.7, 0, 1) * Math.PI);
      p.fF = [lerp(0.15, 0.95, k), lerp(0.1, 0.62, k)];
      p.fB = [lerp(-0.15, -0.95, k), lerp(0.1, 0.62, k)];
      p.aF = [lerp(125, 120, k), -15];
      p.aB = [lerp(150, 170, k), 0];
      p.crouch = 0.1 * k;
      p.face.mouth = 2;
    } else {
      p.fF = [0.18, 0.35 * tuck];
      p.fB = [-0.12, 0.2 * tuck];
    }
    if (u > 0.85) { p.aF = [lerp(p.aF[0], 60, (u - 0.85) / 0.15), 30]; p.aB = [lerp(p.aB[0], 50, (u - 0.85) / 0.15), 30]; }
    // the arms swing up from where the anticipation left them, over the first part of the flight
    const sw = smooth(Math.min(1, u / 0.45));
    p.aF = [lerp(-22, p.aF[0], sw), lerp(30, p.aF[1], sw)];
    p.aB = [lerp(-28, p.aB[0], sw), lerp(30, p.aB[1], sw)];
    p.lean = lerp(18, p.lean || 0, sw);
    p.crouch = lerp(0.32, p.crouch || 0, smooth(Math.min(1, u / 0.25)));
  } else {
    const k = 1 - smooth(ph.u);
    p.crouch = 0.3 * Math.sin(Math.min(1, ph.u * 1.6) * Math.PI) * 0.9;
    p.aF = [lerp(10, 60, k), 20];
    p.aB = [lerp(-20, 50, k), 20];
    p.lean = 10 * k;
    if (variant === 'split' || variant === 'cartwheel') { p.aF = [lerp(10, 150, k), 10]; p.aB = [lerp(-20, 140, k), 10]; }
  }
}

function bipedWave(p, c, ph, variant) {
  // the arms come only half way down by the end: the next beat's blend lowers the rest, gently
  const k = ph.phase === 'anticipation' ? smooth(ph.u) : (ph.phase === 'follow' ? 1 - 0.5 * smooth(ph.u) : 1);
  const osc = ph.phase === 'main' ? wave01(c.t, 3) : 0;
  p.aF = [lerp(10, 122, k), lerp(12, 30 + osc * 28, k)];
  p.wF = osc * 18 * k;
  p.head = -6 * k;
  if (variant === 'big') {
    p.aB = [lerp(-20, 155, k), lerp(14, 35 - osc * 28, k)];
    p.wB = -osc * 18 * k;
    p.y = ph.phase === 'main' ? -Math.abs(Math.sin(c.t * 3 * Math.PI)) * 22 : 0;
    p.face.mouth = 1;
  }
  setSquash(p, gestureSquash(ph, 0.05));
}

function bipedTalk(p, c, ph, variant) {
  const k = ph.phase === 'anticipation' ? smooth(ph.u) : (ph.phase === 'follow' ? 1 - smooth(ph.u) : 1);
  const g = ph.phase === 'main' ? Math.sin(c.t * 1.6 * TAU) : 0;
  if (variant === 'shout') {
    p.lean = 16 * k;
    p.head = -8 * k;
    p.aF = [lerp(10, -30, k), lerp(12, 70, k)];
    p.aB = [lerp(-20, -40, k), lerp(14, 70, k)];
    p.hand = 'fist';
    p.crouch = 0.08 * k;
    if (ph.phase === 'main') p.fx.shout = 1;
    p.face.talk = 'shout';
    setSquash(p, 1 + 0.06 * k * (0.5 + 0.5 * Math.sin(c.t * 12 * TAU)));
    p.sx = 1 / p.sy;
  } else if (variant === 'whisper') {
    // the hand comes only half way down by the end: the next beat's blend lowers the rest, gently
    if (ph.phase === 'follow') { const kf = 1 - 0.5 * smooth(ph.u); p.aF = [lerp(10, 125, kf), lerp(12, 140, kf)]; }
    p.lean = 14 * k;
    p.x = 26 * k;
    if (ph.phase !== 'follow') p.aF = [lerp(10, 125, k), lerp(12, 140, k)];
    p.wF = 20 * k;
    p.crouch = 0.06 * k;
    p.face.talk = 'whisper';
  } else {
    p.aF = [lerp(10, 45 + g * 12, k), lerp(12, 75 + g * 10, k)];
    p.wF = -25 * k;
    p.head = Math.sin(c.t * 2.2 * TAU) * 4 * k;
    p.face.talk = 'talk';
  }
}

function aimAngle(c, shoulderUp, shoulderFwd) {
  const tx = (c.targetDx === undefined ? 300 : c.targetDx) - shoulderFwd;
  const ty = (c.targetUp === undefined ? 200 : c.targetUp) - shoulderUp;
  return clamp((Math.atan2(Math.max(20, tx), -ty) * 180) / Math.PI, 40, 175);
}

function bipedPoint(p, c, ph, variant) {
  const d = c.dims;
  const k = ph.phase === 'anticipation' ? smooth(ph.u) : (ph.phase === 'follow' ? 1 - smooth(ph.u) : 1);
  let a = variant === 'up' ? 140 : aimAngle(c, d.legL + d.torsoH * 0.88, d.shoulderF);
  if (variant === 'accuse') {
    p.lean = 10 * k;
    a += ph.phase === 'main' ? Math.sin(c.t * 14 * TAU) * 4 : 0;
    p.face.brow = 1;
  }
  if (variant === 'up') { p.lean = -6 * k; p.head = -12 * k; p.face.eyes = 'up'; }
  p.aF = [lerp(10, a, k), lerp(12, 0, k)];
  p.hand = k > 0.5 ? 'point' : null;
  if (ph.phase === 'anticipation') p.aF = [lerp(10, -20, Math.sin(ph.u * Math.PI)), 40];
}

function sittingPose(p, c, seatH) {
  const L = c.dims.legL;
  // on the floor the thighs (and shorts) rest on the ground, not in it
  const hip = Math.max(0, seatH) + Math.max(L * 0.1, c.dims.legW * 0.75 + 6);
  p.crouch = clamp(1 - hip / L, 0, 0.92);
  if (seatH > 4) { p.fF = [0.5, Math.max(0, seatH / L * 0.15)]; p.fB = [0.42, Math.max(0, seatH / L * 0.15)]; }
  else { p.fF = [0.95, 0.06]; p.fB = [0.85, 0.06]; }
  p.lean = -4;
  p.aF = [24, 40];
  p.aB = [18, 40];
  p.seated = 1;
  return p;
}

function bipedSit(p, c, ph, variant) {
  const seat = c.seatTo || 0;
  const target = sittingPose(restPose('biped'), c, seat);
  if (variant === 'flop') {
    setSquash(p, flopSquash(ph));
    if (ph.phase === 'anticipation') { p.crouch = 0.1 * smooth(ph.u); }
    else if (ph.phase === 'main') {
      const u = ph.u;
      if (u < 0.4) { p.y = -Math.sin((u / 0.4) * Math.PI * 0.5) * 50; p.aF = [lerp(10, 150, u / 0.4), 20]; p.aB = [lerp(-20, 140, u / 0.4), 20]; }
      else {
        const k = smooth((u - 0.4) / 0.35);
        const b = blendPose(restPose('biped'), target, k);
        Object.assign(p, { crouch: b.crouch, fF: b.fF, fB: b.fB, lean: b.lean });
        p.y = lerp(-50, 0, k);
        p.aF = [lerp(150, 60, k), 30];
        p.aB = [lerp(140, 50, k), 30];
      }
    } else Object.assign(p, { crouch: target.crouch, fF: target.fF, fB: target.fB, lean: target.lean, aF: target.aF, aB: target.aB });
    return;
  }
  setSquash(p, gestureSquash(ph, 0.04));
  if (ph.phase === 'anticipation') { p.lean = 8 * smooth(ph.u); }
  else {
    const k = ph.phase === 'main' ? smooth(ph.u) : 1;
    const b = blendPose(restPose('biped'), target, k);
    Object.assign(p, { crouch: b.crouch, fF: b.fF, fB: b.fB, lean: b.lean + 12 * Math.sin(k * Math.PI), aF: b.aF, aB: b.aB });
  }
}

function bipedPick(p, c, ph, variant) {
  let k;
  if (ph.phase === 'anticipation') k = 0.3 * smooth(ph.u);
  else if (ph.phase === 'main') k = ph.u < 0.45 ? lerp(0.3, 1, smooth(ph.u / 0.45)) : lerp(1, 0, smooth((ph.u - 0.45) / 0.55));
  else k = 0;
  p.crouch = 0.42 * k;
  p.lean = 48 * k;
  p.aF = [lerp(10, 40, k), lerp(12, 10, k)];
  p.aB = [lerp(-20, 20, k), 20];
  p.head = 10 * k;
  p.fF = [lerp(0.1, 0.28, k), 0];
  if (ph.phase === 'main' && ph.u >= 0.45) {
    const r = smooth((ph.u - 0.45) / 0.55);
    p.aF = [lerp(40, 95, r), lerp(10, 80, r)];
  }
  if (ph.phase === 'follow') { p.aF = [lerp(95, 45, smooth(ph.u)), lerp(80, 60, smooth(ph.u))]; }
  if (variant === 'snatch' && ph.phase !== 'follow') p.fx.speed = 0.6;
  setSquash(p, ph.phase === 'follow' ? 1 + 0.05 * Math.sin(ph.u * Math.PI) : 1 - 0.06 * k);
}

function bipedGive(p, c, ph, variant) {
  const k = ph.phase === 'anticipation' ? smooth(ph.u) : (ph.phase === 'follow' ? 1 - smooth(ph.u) : 1);
  if (variant === 'toss') {
    if (ph.phase === 'anticipation') { p.aF = [lerp(10, -50, k), 40]; p.lean = -8 * k; }
    else if (ph.phase === 'main') { const u = smooth(Math.min(1, ph.u * 2)); p.aF = [lerp(-50, 140, u), lerp(40, 10, u)]; p.lean = lerp(-8, 10, u); }
    else p.aF = [lerp(140, 10, smooth(ph.u)), 12];
  } else {
    p.aF = [lerp(10, 80, k), lerp(12, 8, k)];
    p.lean = 10 * k;
    p.x = 14 * k;
  }
  setSquash(p, gestureSquash(ph, 0.04));
}

function bipedReceive(p, c, pp) {
  // the receiver reaches for the item near its arrival
  const k = Math.sin(clamp((pp.p - 0.35) / 0.6, 0, 1) * Math.PI * 0.5);
  const back = pp.p > 0.9 ? 1 - (pp.p - 0.9) / 0.1 : 1;
  p.aF = [lerp(10, 75, k * back), lerp(12, 30, k * back)];
}

function lieLift(dims, lie) { return dims && dims.lieLift ? (dims.lieLift[lie] || 0) : 0; }

function lyingPose(p, c, lie) {
  const back = lie !== 'front';
  p.rot = back ? -90 : 90;
  p.pivot = 0;
  p.y = -lieLift(c.dims, lie);
  // on the back, a dazed arm up in the air; face down, the arms lie along the body: never across the face
  p.aF = back ? [105, 35] : [12, 10];
  p.aB = back ? [62, 25] : [-14, 10];
  p.fF = [0.05, 0];
  p.fB = [-0.05, 0];
  // the head turns back up so the face reads above the ground
  p.head = back ? 78 : -78;
  p.lie = lie;
  if (lie === 'faint') { p.face.eyes = 'closed'; p.aF = [125, 45]; p.aB = [55, 30]; }
  return p;
}

function bipedFall(p, c, ph, variant) {
  const lie = variant === 'trip' ? 'front' : (variant === 'faint' ? 'faint' : 'back');
  const target = lyingPose(restPose('biped'), c, lie);
  setSquash(p, fallSquash(ph, variant));
  if (ph.phase === 'anticipation') {
    const k = smooth(ph.u);
    if (variant === 'trip') { p.lean = 14 * k; p.fB = [lerp(-0.08, -0.4, k), 0.12 * k]; p.aF = [lerp(10, 90, k), 30]; p.aB = [lerp(-20, 80, k), 30]; }
    else if (variant === 'slip') { p.fF = [lerp(0.1, 0.45, k), 0.15 * k]; p.lean = -12 * k; p.aF = [lerp(10, 120, k), 20]; p.aB = [lerp(-20, 140, k), 20]; p.face.eyes = 'wide'; }
    else { p.lean = Math.sin(ph.u * TAU) * 10; p.face.eyes = 'closed'; p.crouch = 0.08 * k; }
  } else if (ph.phase === 'main') {
    const u = ph.u;
    if (variant === 'faint') {
      const wob = u < 0.5 ? Math.sin((u / 0.5) * TAU * 2) * 12 * (1 - u) : 0;
      const k = smooth(clamp((u - 0.4) / 0.6, 0, 1));
      p.rot = lerp(wob, target.rot, easeIn(k));
      p.pivot = 0;
      p.y = lerp(0, target.y, k);
      p.head = lerp(0, target.head, k);
      p.aF = [lerp(10, target.aF[0], k), 20];
      p.aB = [lerp(-20, target.aB[0], k), 10];
      p.face.eyes = 'closed';
      p.crouch = 0.06 * (1 - k);
    } else {
      const k = easeIn(smooth(u));
      p.rot = lerp(0, target.rot, k);
      p.pivot = 0;
      p.head = lerp(0, target.head, k);
      p.y = lerp(0, target.y, k) + (variant === 'slip' ? -Math.sin(u * Math.PI) * 70 : -Math.sin(u * Math.PI) * 25);
      if (variant === 'slip') { p.fF = [0.7, 0.5 * Math.sin(u * Math.PI)]; p.fB = [0.5, 0.35 * Math.sin(u * Math.PI)]; p.aF = [150, 20]; p.aB = [170, 20]; p.face.eyes = 'wide'; }
      else { p.aF = [lerp(90, 160, k), 10]; p.aB = [lerp(80, 150, k), 10]; p.fB = [-0.25, 0.2]; }
    }
  } else {
    Object.assign(p, { rot: target.rot, pivot: 0, y: target.y, aF: target.aF, aB: target.aB, fF: target.fF, fB: target.fB, head: target.head });
    if (variant === 'faint') p.face.eyes = 'closed';
    if (ph.u < 0.4) p.fx.impact = 1;
  }
}

function bipedHug(p, c, ph, variant, passive) {
  const dist = Math.abs(c.partnerDx || 240);
  const reach = dist * 0.35;
  let k;
  if (ph.phase === 'anticipation') k = 0;
  else if (ph.phase === 'main') k = smooth(Math.min(1, ph.u * 2.5));
  else k = 1 - smooth(ph.u);
  p.x = reach * k - (ph.phase === 'anticipation' ? 10 * Math.sin(ph.u * Math.PI) : 0);
  p.aF = [lerp(10, 85, k), lerp(12, 75, k)];
  p.aB = [lerp(-20, 80, k), lerp(14, 70, k)];
  p.lean = 6 * k;
  p.face.eyes = k > 0.6 ? 'closed' : null;
  if (variant === 'bear' && ph.phase === 'main') {
    const lift = Math.sin(ph.u * Math.PI);
    p.spin = Math.cos(clamp((ph.u - 0.25) / 0.6, 0, 1) * TAU);
    if (passive) p.y = -40 * lift;
    else p.lean = -10 * lift;
  }
  setSquash(p, gestureSquash(ph, 0.05));
}

function bipedThink(p, c, ph, variant) {
  const k = ph.phase === 'anticipation' ? smooth(ph.u) : (ph.phase === 'follow' ? 1 - smooth(ph.u) : 1);
  p.aF = [lerp(10, 62, k), lerp(12, 150, k)];
  p.wF = 20 * k;
  p.aB = [lerp(-20, 30, k), lerp(14, 90, k)];
  p.head = -10 * k;
  p.face.eyes = k > 0.5 ? 'up' : null;
  if (variant === 'idea' && ph.phase === 'main' && ph.u > 0.4) {
    const r = smooth((ph.u - 0.4) / 0.15);
    p.aF = [lerp(62, 135, r), lerp(150, 5, r)];
    p.hand = 'point';
    p.head = lerp(-10, -16, r);
    p.y = -18 * Math.sin(clamp((ph.u - 0.4) / 0.2, 0, 1) * Math.PI);
    p.fx.idea = (ph.u - 0.4) * c.dur;
    p.face.eyes = 'wide';
  }
}

function reactK(ph) {
  if (ph.phase === 'anticipation') return 0.3 * smooth(ph.u);
  if (ph.phase === 'main') return lerp(0.3, 1, smooth(Math.min(1, ph.u * 3)));
  return 1 - 0.3 * smooth(ph.u);
}

function bipedReact(p, c, ph, emotion) {
  const k = reactK(ph);
  if (emotion === 'surprised') { p.aF = [lerp(10, 118, k), lerp(12, -22, k)]; p.aB = [lerp(-20, 150, k), lerp(14, -10, k)]; p.lean = -10 * k; p.wF = -30 * k; }
  else if (emotion === 'scared') { p.aF = [lerp(10, 78, k), lerp(12, 70, k)]; p.aB = [lerp(-20, 70, k), lerp(14, 80, k)]; p.lean = -12 * k; p.crouch = 0.12 * k; }
  else if (emotion === 'angry') { p.aF = [lerp(10, 30, k), lerp(12, 100, k)]; p.aB = [lerp(-20, 20, k), lerp(14, 100, k)]; p.hand = 'fist'; p.lean = 10 * k; }
  else if (emotion === 'happy') { p.aF = [lerp(10, 128, k), lerp(12, -18, k)]; p.aB = [lerp(-20, 155, k), -10]; }
  else if (emotion === 'sad') { p.head = 8 * k; p.lean = 10 * k; p.aF = [lerp(10, 2, k), lerp(12, 2, k)]; p.aB = [lerp(-20, -2, k), lerp(14, 2, k)]; p.crouch = 0.06 * k; }
  // the little dip before the take, and its way back up, in one curve
  if (ph.phase === 'anticipation') p.crouch = (p.crouch || 0) + 0.1 * smooth(ph.u);
  else if (ph.phase === 'main') p.crouch = (p.crouch || 0) + 0.1 * (1 - smooth(Math.min(1, ph.u * 3)));
}

// ---------- quadruped ----------

function quadGait(p, c, ph, variant, run) {
  const L = c.dims.legL;
  const dm = c.dims;
  const pw = dm.legW / 2 + 4.5;
  const legLen = dm.seg * 2 * 0.97;
  // a gallop runs low with bent legs and flies between strides; a walk keeps the legs almost straight
  const low = run ? 0.2 : (variant === 'sneak' ? 0.3 : 0);
  const reach = low ? legReach(dm.seg, L * (1 - low) - pw) : legLen * 0.37;
  const G = gait(c, run ? 'run' : 'walk', [
    { key: 'fFB', rest: -0.04, base: -0.04, parity: 1 }, { key: 'fBF', rest: 0.04, base: 0.04, parity: 1 },
    { key: 'fFF', rest: 0.04, base: 0.04, parity: 0 }, { key: 'fBB', rest: -0.04, base: -0.04, parity: 0 }
  ], { reach, duty: run ? 0.2 : 0.3, lift: run ? 0.14 : 0.2, paced: !run });
  // (a quadruped's paw targets are measured from its own hip)
  // walking, the front and the back of the body each ride over their own resting legs (the body tilts a
  // little), so every leg on the ground stays almost straight
  const legsOf = (keys) => keys.map((k) => ({ x: G.feet[k].x, lift: G.feet[k].lift, hx: 0 }));
  const hipF = hipOverFeet(legsOf(['fFF', 'fFB']), legLen, pw, L);
  const hipB = hipOverFeet(legsOf(['fBF', 'fBB']), legLen, pw, L);
  const pp = clamp(c.p, 0, 1);
  const amp = G.D > 0 ? smooth(clamp(pp / 0.3, 0, 1)) * smooth(clamp((1 - pp) / 0.3, 0, 1)) : 0;
  const hold = smooth(clamp(pp / 0.3, 0, 1)) * (1 - smooth(clamp((pp - 0.92) / 0.08, 0, 1)));
  const capH = L * (1 - low * amp);
  const hB = Math.min(hipB, capH);
  const hF = Math.min(hipF, capH);
  // (running or sneaking, the body keeps one steady crouch; walking it rides over the resting legs)
  const steady = run || variant === 'sneak';
  // (sneaking, the body is already low when the first paw leaves, so every resting paw stays in reach)
  // (and it stands up again once the paws are back under it, so the next beat starts on straight legs)
  const crept = smooth(clamp(pp / 0.2, 0, 1)) * (1 - smooth(clamp((pp - 0.86) / 0.14, 0, 1)));
  // (and lower still if a resting paw would otherwise trail out of reach)
  const sneakLow = Math.max(low * crept, clamp(1 - Math.min(hF, hB) / L, 0, 0.6));
  p.crouch = run ? low * hold : (variant === 'sneak' ? sneakLow : clamp(1 - hB / L, 0, 0.6));
  const walkPitch = steady ? 0 : (Math.asin(clamp((hF - hB) / Math.max(1, dm.hipF[0] - dm.hipB[0]), -0.15, 0.15)) * 180) / Math.PI;
  if (run) {
    p.pitch = Math.sin(G.theta) * 6 * amp;
    p.ears = -amp;
    p.tail = lerp(25, 5, amp);
  } else {
    p.tailWag = Math.sin(c.t * 4 * TAU) * 14 * amp;
  }
  if (variant === 'sneak') { p.tail = -10; p.head = 10; p.ears = -1; }
  p.pitch = (p.pitch || 0) + walkPitch;
  if (variant === 'strut') { p.tail = 70; p.head = -12; p.pitch = 6 * amp; p.tailWag = Math.sin(c.t * 5 * TAU) * 20; }
  if (variant === 'stomp') { p.tail = 40; p.tailWag = 0; if (amp > 0.5 && (G.q < 0.08 || G.q > 0.92)) p.fx.dust = 1; }
  if (variant === 'dash') {
    // flying gallop: legs stretched fore and aft, body racing just above the ground
    p.tail = lerp(25, 0, amp); p.pitch = -4 * amp;
    const fly = amp;
    // the paws leave the ground before they stretch out, so none slides while it is still down
    const fx2 = fly * fly;
    const st = Math.sin(c.t * 6 * TAU) * 0.08 * fx2;
    G.feet.fFF = { x: lerp(G.feet.fFF.x, 0.75 * L, fx2) + st * L, lift: lerp(G.feet.fFF.lift, 0.35 * L, fly) };
    G.feet.fFB = { x: lerp(G.feet.fFB.x, 0.6 * L, fx2) + st * L, lift: lerp(G.feet.fFB.lift, 0.3 * L, fly) };
    G.feet.fBF = { x: lerp(G.feet.fBF.x, -0.75 * L, fx2) - st * L, lift: lerp(G.feet.fBF.lift, 0.35 * L, fly) };
    G.feet.fBB = { x: lerp(G.feet.fBB.x, -0.6 * L, fx2) - st * L, lift: lerp(G.feet.fBB.lift, 0.3 * L, fly) };
    p.y = -L * 0.3 * fly;
  }
  if (variant === 'panic') { p.ears = amp; p.tail = lerp(25, 80, amp); p.mouth = 0.8 * amp; if (ph.phase === 'main') p.fx.sweat = 1; p.head = Math.sin(c.t * 5 * TAU) * 6 * amp; }
  if (ph.phase === 'anticipation') {
    if (run || variant === 'sneak') p.crouch = (p.crouch || 0) + 0.15 * Math.sin(ph.u * Math.PI);
    else p.head = (p.head || 0) + 8 * Math.sin(ph.u * Math.PI);
  }
  if (ph.phase === 'follow') p.pitch = (p.pitch || 0) - 6 * Math.sin(ph.u * Math.PI);
  p.kneeGuard = !run && variant !== 'sneak';
  if (c.turning && c.t < TURN_HOP_S) p.y = (p.y || 0) - Math.sin((c.t / TURN_HOP_S) * Math.PI) * 10;
  const turnLift = c.turning && c.t < TURN_HOP_S ? Math.sin((c.t / TURN_HOP_S) * Math.PI) * 8 : 0;
  p.gaitFeet = {};
  for (const k of ['fFF', 'fFB', 'fBF', 'fBB']) p.gaitFeet[k] = { x: G.feet[k].x, lift: G.feet[k].lift + turnLift };
  p.gaitInfo = { s: G.s, N: G.N, D: G.D };
}

function quadJump(p, c, ph, variant) {
  setSquash(p, jumpSquash(ph));
  const hpx = c.heightPx || 220;
  if (ph.phase === 'anticipation') { p.crouch = 0.35 * smooth(ph.u); p.pitch = 8 * smooth(ph.u); p.tail = 60; }
  else if (ph.phase === 'main') {
    const u = ph.u;
    const tuck = Math.sin(u * Math.PI);
    p.y = jumpHeight(ph, variant === 'cartwheel' ? Math.max(60, hpx * 0.45) : hpx);
    p.pitch = lerp(20, -20, u);
    p.fFF = [0.3 * tuck, 0.4 * tuck]; p.fFB = [0.2 * tuck, 0.35 * tuck];
    p.fBF = [-0.3 * tuck, 0.3 * tuck]; p.fBB = [-0.2 * tuck, 0.3 * tuck];
    p.tail = 70; p.ears = 1;
    if (variant === 'flip' || variant === 'backflip') { p.rot = (variant === 'flip' ? 1 : -1) * 360 * clamp((u - 0.05) / 0.9, 0, 1); p.pivot = c.dims.H * 0.5; p.pitch = 0; }
    if (variant === 'spin') p.spin = Math.cos(u * 2 * TAU);
    if (variant === 'cartwheel') { p.rot = 360 * smooth(u); p.pivot = c.dims.H * 0.45; }
    if (variant === 'split') { const k = Math.sin(clamp((u - 0.15) / 0.7, 0, 1) * Math.PI); p.fFF = [0.8 * k, 0.5 * k]; p.fFB = [0.7 * k, 0.45 * k]; p.fBF = [-0.8 * k, 0.5 * k]; p.fBB = [-0.7 * k, 0.45 * k]; p.pitch = 0; p.mouth = 0.6; }
  } else { p.crouch = 0.25 * Math.sin(Math.min(1, ph.u * 1.6) * Math.PI); p.pitch = -6 * (1 - ph.u); }
}

function quadSitPose(p, seat) {
  p.sitting = 1;
  p.pitch = 32;
  p.y = -(seat || 0);
  p.tail = -5;
  return p;
}

function quadLyingPose(p, dims, lie) {
  // on its back, paws up; the head turns back upright and the lowest point rests on the ground
  p.lying = 1;
  p.lie = lie || 'back';
  p.rot = 180;
  p.pivot = 0;
  p.y = -lieLift(dims, lie || 'back');
  p.head = 180;
  p.fFF = [0.25, 0.3]; p.fFB = [0.1, 0.35]; p.fBF = [-0.2, 0.35]; p.fBB = [-0.35, 0.3];
  p.tail = -55;
  p.mouth = 0.4;
  return p;
}

function quadPose(action, variant, c, ph, passive) {
  const p = restPose('quadruped');
  const k = ph.phase === 'anticipation' ? smooth(ph.u) : (ph.phase === 'follow' ? 1 - smooth(ph.u) : 1);
  const osc = ph.phase === 'main' ? Math.sin(c.t * 3 * TAU) : 0;
  switch (action) {
    case 'walk': quadGait(p, c, ph, variant, false); break;
    case 'run': quadGait(p, c, ph, variant, true); break;
    case 'jump': quadJump(p, c, ph, variant); break;
    case 'wave':
      p.rear = variant === 'big' ? 0.5 * k : 0;
      p.pitch = 10 * k + (variant === 'big' ? 25 * k : 0);
      p.fFF = [0.5 * k, (0.6 + osc * 0.2) * k];
      if (variant === 'big') { p.fFB = [0.45 * k, (0.5 - osc * 0.2) * k]; p.y = ph.phase === 'main' ? -Math.abs(Math.sin(c.t * 3 * Math.PI)) * 16 : 0; }
      p.tailWag = Math.sin(c.t * 5 * TAU) * 20;
      setSquash(p, gestureSquash(ph, 0.05));
      break;
    case 'talk':
      p.mouth = ph.phase === 'main' ? 0.5 + 0.5 * Math.sin(c.t * 8 * TAU) : 0;
      p.head = -10 * k + (variant === 'whisper' ? 14 * k : 0);
      if (variant === 'shout') { p.crouch = 0.12 * k; p.pitch = -6 * k; p.mouth = ph.phase === 'main' ? 0.8 + 0.2 * Math.sin(c.t * 10 * TAU) : 0; p.fx.shout = ph.phase === 'main' ? 1 : 0; }
      else if (ph.phase === 'main') p.fx.bark = 1;
      if (variant === 'whisper') { p.x = 20 * k; p.mouth *= 0.4; p.ears = -1; }
      break;
    case 'point':
      p.fFF = [0.85 * k, 0.55 * k];
      p.pitch = 6 * k;
      p.head = variant === 'up' ? -30 * k : -4 * k;
      p.tail = 0;
      p.ears = 1;
      if (variant === 'up') p.fFF = [0.4 * k, 0.9 * k];
      if (variant === 'accuse' && ph.phase === 'main') p.fFF = [0.85, 0.55 + Math.sin(c.t * 14 * TAU) * 0.05];
      break;
    case 'sit': {
      if (variant === 'flop') {
        setSquash(p, flopSquash(ph));
        if (ph.phase === 'main' && ph.u < 0.4) p.y = -Math.sin((ph.u / 0.4) * Math.PI * 0.5) * 40;
        else if (ph.phase !== 'anticipation') { const kk = ph.phase === 'main' ? smooth((ph.u - 0.4) / 0.35) : 1; p.sitting = kk; p.pitch = 32 * kk; p.y = lerp(-40, -(c.seatTo || 0), kk); }
        else p.crouch = 0.15 * smooth(ph.u);
      } else {
        const kk = ph.phase === 'anticipation' ? 0 : (ph.phase === 'main' ? smooth(ph.u) : 1);
        p.sitting = kk; p.pitch = 32 * kk; p.y = -(c.seatTo || 0) * kk; p.tail = lerp(25, -5, kk);
        setSquash(p, gestureSquash(ph, 0.04));
      }
      break;
    }
    case 'pick_up': {
      let kk;
      if (ph.phase === 'anticipation') kk = 0.3 * smooth(ph.u);
      else if (ph.phase === 'main') kk = ph.u < 0.45 ? lerp(0.3, 1, smooth(ph.u / 0.45)) : lerp(1, 0, smooth((ph.u - 0.45) / 0.55));
      else kk = 0;
      p.pitch = -18 * kk; p.head = 40 * kk; p.crouch = 0.12 * kk;
      if (variant === 'snatch' && ph.phase !== 'follow') p.fx.speed = 0.6;
      break;
    }
    case 'give': {
      const dist = Math.abs(c.partnerDx || 240);
      p.x = (variant === 'toss' ? 0 : dist * 0.25) * k;
      p.head = variant === 'toss' && ph.phase === 'main' ? lerp(20, -35, smooth(Math.min(1, ph.u * 2))) : 10 * k;
      p.mouth = ph.phase === 'main' && ph.u > 0.4 ? 0.6 : 0;
      break;
    }
    case 'fall': {
      setSquash(p, fallSquash(ph, variant));
      if (ph.phase === 'anticipation') { p.pitch = variant === 'slip' ? 15 * smooth(ph.u) : -12 * smooth(ph.u); p.ears = 1; }
      else if (ph.phase === 'main') {
        const kk = easeIn(smooth(ph.u));
        const lie = variant === 'faint' ? 'faint' : 'back';
        p.rot = lerp(0, 180, kk) + (variant === 'faint' ? Math.sin(ph.u * TAU * 2) * 10 * (1 - ph.u) : 0);
        p.pivot = 0;
        p.head = 180 * kk;
        p.tail = lerp(25, -55, kk);
        p.y = -lieLift(c.dims, lie) * kk - Math.sin(ph.u * Math.PI) * 40;
        p.fFF = [0.25 * kk, 0.3 * kk]; p.fBB = [-0.35 * kk, 0.3 * kk];
        if (variant === 'faint') p.face = { eyes: 'closed' };
      } else { quadLyingPose(p, c.dims, variant === 'faint' ? 'faint' : 'back'); if (variant === 'faint') p.face = { eyes: 'closed' }; if (ph.u < 0.4) p.fx.impact = 1; }
      break;
    }
    case 'hug': {
      const dist = Math.abs(c.partnerDx || 240);
      let kk;
      if (ph.phase === 'anticipation') kk = 0; else if (ph.phase === 'main') kk = smooth(Math.min(1, ph.u * 2.5)); else kk = 1 - smooth(ph.u);
      p.x = dist * 0.35 * kk;
      if (!passive) { p.rear = kk; p.pitch = 55 * kk; p.fFF = [0.5 * kk, 0.3 * kk]; p.fFB = [0.45 * kk, 0.25 * kk]; }
      p.tailWag = Math.sin(c.t * 4 * TAU) * 18 * (0.3 + 0.7 * kk);
      p.face = { eyes: kk > 0.6 ? 'closed' : null };
      if (variant === 'bear' && ph.phase === 'main') { p.spin = Math.cos(clamp((ph.u - 0.25) / 0.6, 0, 1) * TAU); if (passive) p.y = -40 * Math.sin(ph.u * Math.PI); }
      setSquash(p, gestureSquash(ph, 0.05));
      break;
    }
    case 'think':
      p.head = -14 * k; p.face.eyes = k > 0.5 ? 'up' : null; p.ears = 0.5 * k;
      if (variant === 'idea' && ph.phase === 'main' && ph.u > 0.4) { p.ears = 1; p.fx.idea = (ph.u - 0.4) * c.dur; p.face.eyes = 'wide'; p.tail = 70; p.y = -14 * Math.sin(clamp((ph.u - 0.4) / 0.2, 0, 1) * Math.PI); }
      break;
    default: break;
  }
  return p;
}

// ---------- bird ----------

function birdPose(action, variant, c, ph, passive) {
  const p = restPose('bird');
  const k = ph.phase === 'anticipation' ? smooth(ph.u) : (ph.phase === 'follow' ? 1 - smooth(ph.u) : 1);
  const flap = (hz) => Math.sin(c.t * hz * TAU);
  switch (action) {
    case 'walk': {
      // hops: while the feet rest on the ground the body stays put, then it hops one hop-length ahead
      const D = Math.abs(c.dist || 0);
      const dd = D * travelProgress('walk', clamp(c.p, 0, 1));
      const hops = Math.max(2, Math.round(D / 60));
      const hl = D > 0 ? D / hops : 1;
      const hi = Math.min(hops, Math.floor(dd / hl + 1e-9) + 1);
      const q = clamp((dd - (hi - 1) * hl) / hl, 0, 1);
      const rest = 0.3;
      // it travels first and drops the last bit straight down, so the feet land without sliding
      const e = q < rest ? 0 : smooth(clamp((q - rest) / (0.88 - rest), 0, 1));
      const air = q < rest ? 0 : Math.sin(((q - rest) / (1 - rest)) * Math.PI);
      p.x = D > 0 ? (hi - 1) * hl + e * hl - dd : 0;
      p.y = -air * (variant === 'strut' ? 30 : 18);
      p.lF = 8 - 28 * air;
      p.lB = -8 - 25 * air;
      p.pitch = variant === 'strut' ? -10 : (variant === 'sneak' ? 15 : 5);
      if (variant === 'sneak') { p.crouch = 0.4; }
      if (variant === 'stomp' && q < 0.1 && dd > 0) p.fx.dust = 1;
      // a little hop while turning round, so no foot slides while it turns
      if (c.turning && c.t < TURN_HOP_S) p.y -= Math.sin((c.t / TURN_HOP_S) * Math.PI) * 14;
      p.hopInfo = { hl, hops, D };
      break;
    }
    case 'run': {
      // flies low: rises at the start and lands at the end, smoothly
      const pp = clamp(c.p, 0, 1);
      const fly = smooth(clamp(pp / 0.3, 0, 1)) * smooth(clamp((1 - pp) / 0.3, 0, 1));
      const moving = fly > 0.5;
      p.y = -fly * (c.dims.H * 0.9 + Math.sin(c.t * 2 * TAU) * 8);
      const f = flap(variant === 'dash' ? 6 : 5);
      p.wingF = fly * (40 + f * 40);
      p.wingB = fly * (40 + f * 40);
      p.pitch = -12 * fly;
      p.tuck = fly;
      if (c.turning && c.t < TURN_HOP_S) p.y -= Math.sin((c.t / TURN_HOP_S) * Math.PI) * 14;
      p.hopInfo = { fly };
      if (variant === 'dash' && moving) p.fx.speed = 1;
      if (variant === 'panic') { p.wingF = fly * (60 + f * 50); p.beak = 0.8 * fly; if (moving) p.fx.sweat = 1; p.head = Math.sin(c.t * 5 * TAU) * 8 * fly; }
      if (ph.phase === 'anticipation') { p.crouch = 0.3 * Math.sin(ph.u * Math.PI); setSquash(p, 1 - 0.06 * Math.sin(ph.u * Math.PI)); }
      break;
    }
    case 'jump': {
      setSquash(p, jumpSquash(ph));
      const hpx = c.heightPx || 220;
      if (ph.phase === 'anticipation') { p.crouch = 0.4 * smooth(ph.u); p.wingF = -10; }
      else if (ph.phase === 'main') {
        const u = ph.u;
        p.y = jumpHeight(ph, variant === 'cartwheel' ? Math.max(60, hpx * 0.45) : hpx);
        const f = flap(6);
        p.wingF = 50 + f * 45; p.wingB = 50 + f * 45; p.tuck = Math.sin(u * Math.PI);
        if (variant === 'flip' || variant === 'backflip') { p.rot = (variant === 'flip' ? 1 : -1) * 360 * clamp((u - 0.05) / 0.9, 0, 1); p.pivot = c.dims.H * 0.5; }
        if (variant === 'spin') p.spin = Math.cos(clamp((u - 0.1) / 0.8, 0, 1) * 2 * TAU);
        if (variant === 'cartwheel') { p.rot = 360 * smooth(u); p.pivot = c.dims.H * 0.5; p.spin = Math.cos(smooth(u) * TAU); }
        if (variant === 'split') { const kk = Math.sin(clamp((u - 0.15) / 0.7, 0, 1) * Math.PI); p.wingF = lerp(60, 110, kk); p.wingB = lerp(60, 110, kk); p.lF = 40 * kk; p.lB = -40 * kk; p.beak = 0.7 * kk; }
      } else p.crouch = 0.3 * Math.sin(Math.min(1, ph.u * 1.6) * Math.PI);
      break;
    }
    case 'wave': {
      const f = ph.phase === 'main' ? flap(3) : 0;
      p.wingF = (70 + f * 35) * k;
      if (variant === 'big') { p.wingB = (70 - f * 35) * k; p.y = ph.phase === 'main' ? -Math.abs(Math.sin(c.t * 3 * Math.PI)) * 14 : 0; }
      setSquash(p, gestureSquash(ph, 0.05));
      break;
    }
    case 'talk':
      p.beak = ph.phase === 'main' ? 0.5 + 0.5 * Math.sin(c.t * 8 * TAU) : 0;
      p.head = -8 * k;
      if (variant === 'shout') { p.beak = ph.phase === 'main' ? 1 : 0; p.pitch = -10 * k; p.wingF = 30 * k; p.wingB = 30 * k; p.fx.shout = ph.phase === 'main' ? 1 : 0; }
      if (variant === 'whisper') { p.x = 16 * k; p.beak *= 0.4; p.wingF = 25 * k; }
      break;
    case 'point':
      p.wingF = (variant === 'up' ? 150 : 95) * k;
      if (variant === 'accuse' && ph.phase === 'main') p.wingF += Math.sin(c.t * 14 * TAU) * 6;
      p.head = variant === 'up' ? -25 * k : 0;
      break;
    case 'sit': {
      if (variant === 'flop') {
        setSquash(p, flopSquash(ph));
        if (ph.phase === 'main' && ph.u < 0.4) { p.y = -Math.sin((ph.u / 0.4) * Math.PI * 0.5) * 30; p.wingF = 60; p.wingB = 60; }
        else if (ph.phase !== 'anticipation') { const kk = ph.phase === 'main' ? smooth((ph.u - 0.4) / 0.35) : 1; p.tuck = kk; p.y = lerp(-30, -(c.seatTo || 0), kk); }
        else p.crouch = 0.2 * smooth(ph.u);
      } else {
        const kk = ph.phase === 'anticipation' ? 0 : (ph.phase === 'main' ? smooth(ph.u) : 1);
        p.tuck = kk; p.y = -(c.seatTo || 0) * kk;
        setSquash(p, gestureSquash(ph, 0.04));
      }
      break;
    }
    case 'pick_up': {
      let kk;
      if (ph.phase === 'anticipation') kk = 0.3 * smooth(ph.u);
      else if (ph.phase === 'main') kk = ph.u < 0.45 ? lerp(0.3, 1, smooth(ph.u / 0.45)) : lerp(1, 0, smooth((ph.u - 0.45) / 0.55));
      else kk = 0;
      p.pitch = 45 * kk; p.head = 30 * kk;
      if (variant === 'snatch' && ph.phase !== 'follow') p.fx.speed = 0.6;
      break;
    }
    case 'give': {
      const dist = Math.abs(c.partnerDx || 240);
      p.x = (variant === 'toss' ? 0 : dist * 0.25) * k;
      p.head = variant === 'toss' && ph.phase === 'main' ? lerp(20, -30, smooth(Math.min(1, ph.u * 2))) : 10 * k;
      p.wingF = 30 * k;
      break;
    }
    case 'fall': {
      setSquash(p, fallSquash(ph, variant));
      if (ph.phase === 'anticipation') { p.wingF = 60 * smooth(ph.u); p.wingB = 50 * smooth(ph.u); }
      else if (ph.phase === 'main') { const kk = easeIn(smooth(ph.u)); p.rot = lerp(0, 90, kk) + Math.sin(ph.u * TAU * 1.5) * 25 * (1 - ph.u); p.pivot = 0; p.head = -90 * kk; p.y = -lieLift(c.dims, variant === 'faint' ? 'faint' : 'back') * kk - Math.sin(ph.u * Math.PI) * 30; p.wingF = 80; p.wingB = 70; if (variant === 'faint') p.face.eyes = 'closed'; }
      else { p.rot = 90; p.pivot = 0; p.head = -90; p.y = -lieLift(c.dims, variant === 'faint' ? 'faint' : 'back'); p.wingF = 20; if (variant === 'faint') p.face.eyes = 'closed'; if (ph.u < 0.4) p.fx.impact = 1; }
      break;
    }
    case 'hug': {
      const dist = Math.abs(c.partnerDx || 240);
      let kk;
      if (ph.phase === 'anticipation') kk = 0; else if (ph.phase === 'main') kk = smooth(Math.min(1, ph.u * 2.5)); else kk = 1 - smooth(ph.u);
      p.x = dist * 0.35 * kk;
      p.wingF = 110 * kk; p.wingB = 100 * kk;
      p.face.eyes = kk > 0.6 ? 'closed' : null;
      if (variant === 'bear' && ph.phase === 'main') { p.spin = Math.cos(clamp((ph.u - 0.25) / 0.6, 0, 1) * TAU); if (passive) p.y = -40 * Math.sin(ph.u * Math.PI); }
      setSquash(p, gestureSquash(ph, 0.05));
      break;
    }
    case 'think':
      p.head = -18 * k; p.face.eyes = k > 0.5 ? 'up' : null;
      if (variant === 'idea' && ph.phase === 'main' && ph.u > 0.4) { p.wingF = 120; p.fx.idea = (ph.u - 0.4) * c.dur; p.face.eyes = 'wide'; p.y = -12 * Math.sin(clamp((ph.u - 0.4) / 0.2, 0, 1) * Math.PI); }
      break;
    default: break;
  }
  return p;
}

// ---------- registry of pose functions: POSES[action][variant][rig](ctx) ----------

function bipedPose(action, variant, c, ph, passive) {
  const p = restPose('biped');
  switch (action) {
    case 'walk': bipedWalkCycle(p, c, ph, variant, false); break;
    case 'run': bipedWalkCycle(p, c, ph, variant, true); break;
    case 'jump': bipedJump(p, c, ph, variant); break;
    case 'wave': bipedWave(p, c, ph, variant); break;
    case 'talk': bipedTalk(p, c, ph, variant); break;
    case 'point': bipedPoint(p, c, ph, variant); break;
    case 'sit': bipedSit(p, c, ph, variant); break;
    case 'pick_up': bipedPick(p, c, ph, variant); p.reachDown = 1; break;
    case 'give': bipedGive(p, c, ph, variant); break;
    case 'fall': bipedFall(p, c, ph, variant); break;
    case 'hug': bipedHug(p, c, ph, variant, passive); break;
    case 'think': bipedThink(p, c, ph, variant); break;
    default: break;
  }
  return p;
}

// ctx: { p (0..1), t (s since motion start), dur, dist, heightPx, dims, targetDx, targetUp, partnerDx, seatTo }
const ACROBATIC = { flip: true, backflip: true, spin: true, cartwheel: true };

export const GAIT_KEYS = ['fF', 'fB', 'fFF', 'fFB', 'fBF', 'fBB', 'x', 'y', 'lF', 'lB'];

// hip x (root frame) of each quadruped leg, as quadUpdate places them
function quadHipX(d, key) {
  if (key === 'fFF') return d.hipF[0];
  if (key === 'fFB') return d.hipF[0] - d.legW * 0.5;
  if (key === 'fBF') return d.hipB[0];
  return d.hipB[0] + d.legW * 0.5;
}

export function settleFeet(pose, rig, dims) {
  if (!pose.gaitFeet) return;
  const L = dims.legL;
  for (const k of Object.keys(pose.gaitFeet)) {
    const f = pose.gaitFeet[k];
    if (rig === 'quadruped') {
      const hx = quadHipX(dims, k);
      pose[k] = [((hx + f.x) / (pose.sx || 1) - hx) / L, (f.lift + (pose.y || 0)) / ((pose.sy || 1) * L)];
    } else pose[k] = footTarget(pose, L, f);
  }
  guardRestingKnees(pose, rig, dims);
}

// Walking (A78), a leg whose foot is on the ground stays almost straight all through the beat, from the
// start to the settling: the body never sits lower than such a foot allows for a knee of
// MAX_REST_KNEE_DEG (less a little room). The settling is the body's (squash, lean, pitch), not a bent
// resting leg. A foot that starts to lift (past the last half pixel) lets go of the body quickly, so nothing jumps.
const KNEE_ROOM_DEG = 2;
function guardRestingKnees(pose, rig, dims) {
  if (!pose.kneeGuard || (rig !== 'biped' && rig !== 'quadruped')) return;
  const L = dims.legL;
  const cosCap = Math.cos(((MAX_REST_KNEE_DEG - KNEE_ROOM_DEG) * Math.PI) / 180);
  let top = Infinity;
  if (rig === 'biped') {
    const a = dims.thigh;
    const b = dims.shin;
    const dmin = Math.sqrt(a * a + b * b + 2 * a * b * cosCap);
    for (const [k, hx] of [['fF', dims.hipSep * 0.4], ['fB', -dims.hipSep * 0.4]]) {
      const tgt = pose[k];
      const f = pose.gaitFeet[k];
      if (!tgt || !f) continue;
      const dx = tgt[0] * L - hx;
      // the lowest hip height (above the root) that keeps this knee within the cap
      const h = tgt[1] * L + dims.ankleY + Math.sqrt(Math.max(0, dmin * dmin - dx * dx)) - 3 * Math.max(0, f.lift - 0.6);
      top = Math.min(top, 1 - h / L);
    }
    if (top < (pose.crouch || 0)) pose.crouch = top;
    return;
  }
  const seg = dims.seg;
  const dmin = 2 * seg * Math.sqrt((1 + cosCap) / 2);
  const pw = dims.legW / 2 + 4.5;
  const pv = dims.hipB;
  const rmax = 2 * seg * 0.99;
  // For a pitch, how far the front or the back of the body may drop (px): at most what keeps each resting
  // knee within the cap (hi), at least what lets each planted paw still reach the ground (lo). A paw that
  // lifts lets go of both, gradually, so nothing jumps (and one about to land, still far ahead of the body
  // that is catching up, does not pull the body down for the last frame).
  const bounds = (keys, pitch) => {
    const th = (-pitch * Math.PI) / 180;
    const co = Math.cos(th);
    const si = Math.sin(th);
    let lo = -0.1 * L;
    let hi = 0.8 * L;
    for (const k of keys) {
      const tgt = pose[k];
      const f = pose.gaitFeet[k];
      if (!tgt || !f) continue;
      const hx = quadHipX(dims, k);
      const hy = k[1] === 'F' ? dims.hipF[1] : dims.hipB[1];
      // the hip as the body's pitch carries it (before the crouch drops it)
      const rx = pv[0] + co * (hx - pv[0]) - si * (hy - pv[1]);
      const ry = pv[1] + si * (hx - pv[0]) + co * (hy - pv[1]);
      const ex = hx + tgt[0] * L;
      const ey = -tgt[1] * L - pw;
      const dx = ex - rx;
      hi = Math.min(hi, ey - ry - Math.sqrt(Math.max(0, dmin * dmin - dx * dx)) + 3 * Math.max(0, f.lift - 0.6));
      if (Math.abs(dx) < rmax) lo = Math.max(lo, ey - ry - Math.sqrt(rmax * rmax - dx * dx) - 10 * f.lift);
    }
    return [lo, hi];
  };
  // (into [lo, hi]; if the two cross, the knee wins)
  const fit = (x, r) => Math.min(Math.max(x, r[0]), r[1]);
  // The crouch keeps the body's own height as far as the back legs and then the front legs allow; what the
  // front legs still miss, the pitch makes up (the body levels out, or tips, just as much as it takes).
  const lever = Math.max(1, dims.hipF[0] - pv[0]);
  let pitch = pose.pitch || 0;
  let drop = clamp(pose.crouch || 0, -0.1, 0.8) * L;
  const drop0 = drop;
  for (let pass = 0; pass < 3; pass++) {
    const F = bounds(['fFF', 'fFB'], pitch);
    drop = fit(fit(drop0, F), bounds(['fBF', 'fBB'], pitch));
    const miss = fit(drop, F) - drop;
    if (Math.abs(miss) < 1e-3) break;
    // raising the nose by a small angle lifts the front hips by about lever x angle
    pitch += clamp((-miss / (lever * Math.cos((pitch * Math.PI) / 180))) * (180 / Math.PI), -20, 20);
  }
  pose.pitch = pitch;
  pose.crouch = drop / L;
}

export function makePoseFn(action, variant, rig) {
  const raw = rawPoseFn(action, variant, rig);
  return function poseFn(ctx) {
    const pose = raw(ctx);
    // smooth the joints across phase boundaries (anticipation -> main -> follow) during BLEND_MS;
    // squash, effects and the gait stay those of the current instant
    const dur = Math.max(0.05, ctx.dur || 1);
    const W = Math.min(0.25, BLEND_MS / 1000 / dur);
    const ph = PHASES[action] || [0.2, 0.15];
    const pp = clamp(ctx.p, 0, 1);
    for (const bnd of [ph[0], 1 - ph[1]]) {
      if (pp >= bnd && pp < bnd + W) {
        const prev = raw(Object.assign({}, ctx, { p: bnd - 1e-6, t: (bnd - 1e-6) * dur }));
        const mixed = blendPose(prev, pose, smooth((pp - bnd) / W));
        for (const k of ['sy', 'sx', 'phase', 'fx', 'face', 'legs', 'wheel', 'hand', 'gaitInfo', 'gaitFeet', 'hopInfo', 'spin', 'kneeGuard']) mixed[k] = pose[k];
        if (action === 'walk' || action === 'run' || pose.gaitFeet) for (const k of GAIT_KEYS) if (pose[k] !== undefined) mixed[k] = pose[k];
        return mixed;
      }
    }
    return pose;
  };
}

function rawPoseFn(action, variant, rig) {
  return function poseFn(ctx) {
    const pp = clamp(ctx.p, 0, 1);
    const ph = phaseOf(action, pp);
    let pose;
    if (rig === 'biped') pose = bipedPose(action, variant, ctx, ph, ctx.passive);
    else if (rig === 'quadruped') pose = quadPose(action, variant, ctx, ph, ctx.passive);
    else pose = birdPose(action, variant, ctx, ph, ctx.passive);
    pose.phase = ph.phase;
    // squash and stretch: jump, fall and sit.flop keep their own curves (A35); the rest use the envelope (A55)
    const special = action === 'jump' || action === 'fall' || (action === 'sit' && variant === 'flop');
    if (!special && !ctx.passive) {
      const env = ENVELOPE[action] || [0.05, 0.06];
      const boost = variant === 'shout' || variant === 'big' || variant === 'panic' || variant === 'dash' || variant === 'snatch' ? 1.4 : 1;
      pose.sy = comicEnvelope(pp, env[0] * boost, env[1] * boost);
    }
    pose.sx = 1 / pose.sy;
    // comic secondary effects
    const fx = pose.fx;
    if (action === 'run') {
      if (ph.phase === 'anticipation' || (ph.phase === 'main' && ph.u < 0.3)) fx.dust = 1;
      if (ph.phase === 'main') fx.speed = 1;
      if (ph.phase === 'follow') {
        fx.skid = 1; fx.dust = 1;
        const k = Math.sin(ph.u * Math.PI);
        if (rig === 'biped') pose.lean = lerp(pose.lean || 0, -14, k);
        else pose.pitch = lerp(pose.pitch || 0, 10, k);
      }
    }
    if (action === 'walk' && ph.phase === 'follow' && variant === 'stomp') fx.dust = 1;
    if (action === 'jump') {
      if (ph.phase === 'main' && ACROBATIC[variant]) fx.speed = 1;
      if (ph.phase === 'follow') fx.dust = 1;
      if (ph.phase === 'anticipation' && (ctx.heightPx || 0) >= 300) {
        // legs tremble before a big jump
        pose.x = (pose.x || 0) + 5 * Math.sin((ctx.t || 0) * 12 * TAU);
        fx.tremble = 1;
      }
    }
    if (action === 'fall' && ph.phase === 'follow') { fx.dust = 1; fx.dizzy = 1; }
    if (action === 'sit' && variant === 'flop' && ph.phase === 'main' && ph.u > 0.6 && ph.u < 0.95) fx.dust = 1;
    if (action === 'pick_up' && variant === 'snatch' && ph.phase !== 'follow') fx.speed = 1;
    settleFeet(pose, rig, ctx.dims);
    return pose;
  };
}

export function buildPoseTable(catalog) {
  const table = {};
  for (const a of Object.keys(catalog.actions)) {
    table[a] = { variants: {} };
    for (const v of Object.keys(catalog.actions[a].variants)) {
      table[a].variants[v] = {};
      for (const r of RIGS) table[a].variants[v][r] = makePoseFn(a, v, r);
    }
  }
  return table;
}

// ---------- idle, postures, reactions and emotion modifiers ----------

export function posturePose(rig, posture, seatH, lie, dims) {
  const p = restPose(rig);
  if (posture === 'sitting') {
    if (rig === 'biped') sittingPose(p, { dims }, seatH);
    else if (rig === 'quadruped') quadSitPose(p, seatH);
    else { p.tuck = 1; p.y = -(seatH || 0); }
  } else if (posture === 'lying') {
    if (rig === 'biped') lyingPose(p, { dims }, lie);
    else if (rig === 'quadruped') { quadLyingPose(p, dims, lie === 'faint' ? 'faint' : 'back'); if (lie === 'faint') p.face = { eyes: 'closed' }; }
    else { p.rot = 90; p.pivot = 0; p.head = -90; p.y = -lieLift(dims, lie === 'faint' ? 'faint' : 'back'); p.wingF = 20; if (lie === 'faint') p.face.eyes = 'closed'; }
    p.lie = lie || 'back';
  }
  return p;
}

export const TAKE_PAUSE = 0.2;

// Reaction beat ("take"): a short frozen pause first (double take), then squash, stretch and settle.
export function reactionPose(rig, c, emotion) {
  const dur = Math.max(0.3, c.dur || 1.2);
  const t = c.t === undefined ? clamp(c.p, 0, 1) * dur : c.t;
  if (t < TAKE_PAUSE) {
    const p0 = restPose(rig);
    p0.phase = 'pause';
    p0.face.look = [t < TAKE_PAUSE * 0.5 ? 1 : -0.4, 0];
    return p0;
  }
  const pp = clamp((t - TAKE_PAUSE) / Math.max(0.1, dur - TAKE_PAUSE), 0, 1);
  const ph = phaseOf('react', pp);
  const p = restPose(rig);
  if (rig === 'biped') bipedReact(p, c, ph, emotion);
  else {
    const k = reactK(ph);
    if (rig === 'quadruped') { p.ears = (emotion === 'sad' ? -1 : 1) * k; p.tail = lerp(25, emotion === 'sad' ? -20 : (emotion === 'happy' ? 70 : 40), k); p.mouth = (emotion === 'surprised' || emotion === 'scared' ? 0.7 : 0) * k; }
    else { p.wingF = (emotion === 'sad' ? 0 : 60) * k; p.wingB = (emotion === 'sad' ? 0 : 50) * k; }
  }
  setSquash(p, comicEnvelope(pp, 0.1, 0.12));
  p.phase = ph.phase;
  return p;
}

// ---------- living idle (A57): breathing with a bounce, blinks, wandering eyes and small tics ----------

const LOOKS = [[0, 0], [1, 0], [-1, 0], [0.6, -0.7], [-0.6, -0.5], [1, 0.4]];

function schedule(seedKey, first, minGap, maxGap, horizon) {
  const rnd = seededRandom(seedKey);
  const out = [];
  let t = first[0] + rnd() * (first[1] - first[0]);
  while (t < horizon) { out.push({ t, r: rnd() }); t += minGap + rnd() * (maxGap - minGap); }
  return out;
}

const SCHED_CACHE = {};
function cachedSchedule(key, first, minGap, maxGap) {
  if (!SCHED_CACHE[key]) SCHED_CACHE[key] = schedule(key, first, minGap, maxGap, 240);
  return SCHED_CACHE[key];
}

export function idleState(seedKey, clock, timing) {
  const T = clock % 240;
  const blinks = cachedSchedule(seedKey + '#b', [0.4, 1.6], timing.blinkMin, timing.blinkMax);
  let blink = false;
  for (const b of blinks) { if (T >= b.t && T < b.t + timing.blinkSeconds) { blink = true; break; } if (b.t > T) break; }
  const looks = cachedSchedule(seedKey + '#l', [0.8, 1.8], 1.4, 3.0);
  let look = LOOKS[0];
  for (const l of looks) { if (l.t <= T) look = LOOKS[1 + Math.floor(l.r * (LOOKS.length - 1))]; else break; }
  const tics = cachedSchedule(seedKey + '#t', [1.2, 3.5], 3.0, 6.0);
  let tic = 0;
  let ticKind = 0;
  for (const tc of tics) {
    if (T >= tc.t && T < tc.t + 0.7) { tic = Math.sin(((T - tc.t) / 0.7) * Math.PI); ticKind = Math.floor(tc.r * 3); break; }
    if (tc.t > T) break;
  }
  return { blink, look, tic, ticKind };
}

// breathing: a bouncy wave (fast rise, soft fall) with amplitude >= breathScale
export function breathe(clock, timing, phase) {
  const x = ((clock + (phase || 0)) / timing.breathPeriod) % 1;
  const w = Math.sin(x * TAU) + 0.25 * Math.sin(x * 2 * TAU);
  return 1 + timing.breathScale * 1.35 * w;
}

export function idlePose(rig, o) {
  // o: { posture, seatH, lie, dims, clock, seed, timing }
  const p = posturePose(rig, o.posture || 'standing', o.seatH || 0, o.lie || null, o.dims);
  const st = idleState(o.seed, o.clock, o.timing);
  p.phase = 'idle';
  setSquash(p, breathe(o.clock, o.timing, (fnv1a(o.seed) % 1000) / 400));
  if (st.blink && !p.face.eyes) p.face.eyes = 'closed';
  p.face.look = st.look;
  // lying down there is no tic: a stretch or a nod would go into the ground
  if (st.tic > 0 && !p.lie) {
    const a = st.tic;
    if (rig === 'biped') {
      if (st.ticKind === 0) p.head = (p.head || 0) - 10 * a;
      else if (st.ticKind === 1) { p.aF = [p.aF[0] + 14 * a, p.aF[1] + 20 * a]; p.head = (p.head || 0) + 6 * a; }
      else p.lean = (p.lean || 0) + 7 * a;
    } else if (rig === 'quadruped') {
      if (st.ticKind === 0) p.head = (p.head || 0) - 12 * a;
      else if (st.ticKind === 1) p.ears = (p.ears || 0) + a;
      else p.tailWag = 22 * a * Math.sin(o.clock * 3 * TAU);
      if (st.ticKind !== 0) p.head = (p.head || 0) + 6 * a;
    } else {
      p.head = (p.head || 0) + (st.ticKind === 1 ? 16 : -16) * a;
    }
  }
  return p;
}

// small damped wobble right after an action ends (settling), in the free time before the next beat
export function settleAfter(p, rig, action, since) {
  if (!(since >= 0) || since > 0.6) return p;
  const d = Math.exp(-since * 7) * Math.sin(since * 22);
  const amp = action === 'run' ? 8 : (action === 'jump' || action === 'fall' ? 6 : 3);
  if (rig === 'biped') p.lean = (p.lean || 0) + (action === 'run' ? -amp : amp) * d;
  else p.pitch = (p.pitch || 0) + amp * d;
  p.head = (p.head || 0) + amp * 0.6 * d;
  const sy = p.sy * (1 + 0.035 * d);
  p.sy = sy;
  p.sx = 1 / sy;
  return p;
}

export const EMOTION_AMP = [0, 0.6, 1, 1.6];

// modifiers applied on top of any pose for "loop" emotion effects and bursts
export function applyEmotion(p, rig, fx, clock, idle) {
  // fx: { loops: {name: amp}, bursts: {name: {u, amp}} }
  const L = fx.loops;
  // lying down, the limbs and the lean keep the posture: a gesture would go into the ground (R4);
  // while a fall turns the body over, the lean fades out with the turn
  const free = !p.lie;
  // seated, the arms and legs keep the sitting pose too (the emotion shows in the face, the head and the root)
  const limbsFree = free && !p.seated;
  const upright = p.lie ? 0 : Math.cos((Math.min(90, Math.abs(p.rot || 0)) * Math.PI) / 180);
  if (L.droop) {
    // lying down the head stays turned up off the ground
    if (!p.lie) p.head = (p.head || 0) + 9 * Math.min(1.1, L.droop);
    if (rig === 'biped') {
      p.lean = (p.lean || 0) + 5 * L.droop * upright;
      if (idle && limbsFree) { const k = Math.min(1, L.droop); p.aF = [lerp(p.aF[0], 2, k), lerp(p.aF[1], 4, k)]; p.aB = [lerp(p.aB[0], -4, k), lerp(p.aB[1], 4, k)]; }
    }
    const dk = upright * Math.min(1, L.droop);
    if (rig === 'quadruped') { p.tail = lerp(p.tail === undefined ? 25 : p.tail, -25, dk); p.ears = lerp(p.ears || 0, -1, dk); }
    if (rig === 'bird') { p.wingF = lerp(p.wingF || 0, -5, dk); p.tail = lerp(p.tail || 0, -10, dk); }
  }
  // while walking or running the jitters leave the root alone, so resting feet never slide
  const planted = !!(p.gaitFeet || p.hopInfo);
  if (L.shake) {
    if (!planted) p.x = (p.x || 0) + Math.sin(clock * 30 * TAU) * 3 * L.shake;
    if (rig === 'biped' && idle && limbsFree) {
      const k = Math.min(1, L.shake);
      if (k > 0.5) p.hand = 'fist';
      p.aF = [lerp(p.aF[0], 22, k), lerp(p.aF[1], 95, k)];
      p.aB = [lerp(p.aB[0], 18, k), lerp(p.aB[1], 95, k)];
    }
    if (rig === 'quadruped' && idle && free) {
      const k = Math.min(1, L.shake);
      // (legs straight: an angry dog stands tall and stiff; only fear bends the knees)
      p.ears = lerp(p.ears || 0, -1, k); p.tail = lerp(p.tail === undefined ? 25 : p.tail, 10, k);
    }
  }
  if (L.tremble) {
    if (!planted) p.x = (p.x || 0) + Math.sin(clock * 23 * TAU) * 2.5 * L.tremble;
    if (rig === 'biped' && idle && limbsFree) {
      const k = Math.min(1, L.tremble);
      p.crouch = Math.max(p.crouch || 0, 0.1 * k);
      p.fF = [lerp(p.fF ? p.fF[0] : 0.12, 0.04 + Math.sin(clock * 12 * TAU) * 0.04, k), 0];
      p.fB = [lerp(p.fB ? p.fB[0] : -0.1, -0.02 - Math.sin(clock * 12 * TAU) * 0.04, k), 0];
      p.aF = [lerp(p.aF[0], 40, k), lerp(p.aF[1], 120, k)];
      p.aB = [lerp(p.aB[0], 35, k), lerp(p.aB[1], 120, k)];
    }
    if (rig === 'quadruped' && idle && free) {
      const k = Math.min(1, L.tremble);
      p.crouch = lerp(p.crouch || 0, 0.15, k); p.tail = lerp(p.tail === undefined ? 25 : p.tail, -20, k); p.ears = lerp(p.ears || 0, -1, k);
    }
  }
  if (L.bounce && idle) {
    const ph = (clock * 1.6) % 1;
    const hop = Math.sin(ph * Math.PI);
    p.y = (p.y || 0) - hop * 22 * L.bounce;
    // squashed on landing, stretched in the air: one continuous curve (no jump at the landing)
    const land = smooth(clamp(1 - Math.min(ph, 1 - ph) / 0.1, 0, 1));
    const sq = 1 - 0.07 * L.bounce * land + 0.04 * L.bounce * hop;
    p.sy = (p.sy || 1) * sq;
    p.sx = 1 / p.sy;
    if (rig === 'biped' && limbsFree) {
      const k = Math.min(1, L.bounce);
      p.aF = [lerp(p.aF[0], 30 + hop * 40, k), lerp(p.aF[1], 30, k)];
      p.aB = [lerp(p.aB[0], 20 + hop * 40, k), lerp(p.aB[1], 30, k)];
    }
    if (rig === 'quadruped' && free) p.tailWag = Math.sin(clock * 6 * TAU) * 25;
  }
  const B = fx.bursts;
  if (B.jump_back) {
    const u = B.jump_back.u;
    const s = Math.sin(u * Math.PI);
    p.x = (p.x || 0) - 50 * s * B.jump_back.amp;
    p.y = (p.y || 0) - 34 * s * B.jump_back.amp;
    // arms thrown up and back down again, smoothly
    if (rig === 'biped' && free) { p.aF = [lerp(p.aF[0], 120, s), lerp(p.aF[1], -20, s)]; p.aB = [lerp(p.aB[0], 150, s), lerp(p.aB[1], -10, s)]; p.lean = lerp(p.lean || 0, -12, s); }
    if (rig === 'bird' && free) { p.wingF = lerp(p.wingF || 0, 90, s); p.wingB = lerp(p.wingB || 0, 90, s); }
  }
  return p;
}


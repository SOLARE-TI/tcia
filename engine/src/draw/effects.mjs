// Emotion effects (catalog.effects) and comic secondary effects (dust, speed lines, skids, dizzy stars...).
// Everything is built once per scene; each frame only moves, scales or shows/hides particles.
import { clamp, lerp, smooth, TAU } from '../core.mjs';
import { h, kg, part, paint, ngon, INK, num, pts, ribbon, inkLine, mix } from './svg.mjs';


export function star4(cx, cy, R, r) {
  const out = [];
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 4;
    const rr = i % 2 ? r : R;
    out.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return out;
}

export function dropPoly(cx, cy, s) {
  return [[cx, cy - s * 1.3], [cx + s * 0.55, cy - s * 0.2], [cx + s * 0.6, cy + s * 0.35], [cx + s * 0.25, cy + s * 0.7], [cx - s * 0.25, cy + s * 0.7], [cx - s * 0.6, cy + s * 0.35], [cx - s * 0.55, cy - s * 0.2]];
}

function tf(x, y, s, rot) {
  let t = 'translate(' + num(x) + ',' + num(y) + ')';
  if (rot) t += ' rotate(' + num(rot) + ')';
  if (s !== undefined && s !== 1) t += ' scale(' + num(Math.max(0.001, s)) + ')';
  return t;
}

function fxColors(ctx) {
  const m = ctx.catalog.palettes.materials;
  const c = ctx.catalog.palettes.clothing;
  return {
    water: paint(m.effect.tones, ctx),
    steam: paint(m.cloud.tones, ctx),
    star: paint(c.yellow.tones, ctx),
    white: paint(['#FFFFFF', '#F2F4F7', '#D9DEE6'], ctx),
    gloom: paint(c.navy.tones, ctx),
    dust: paint(m.concrete.tones, ctx).map((x) => mix(x, '#FFFFFF', 0.35)),
    red: paint(c.red.tones, ctx),
    mouth: paint(m.mouth.tones, ctx)
  };
}

// ---------- head effects: F = { pre, r (head half height), w (half width), eye: [x,y], eye2, mouth: [x,y], ground, hair tones, ctx } ----------

const HEAD_FX = {
  sparkles: {
    build(F, C) {
      const kids = [];
      for (let i = 0; i < 4; i++) kids.push(kg(F.pre + 'spk' + i, { display: 'none' }, [part('sparkle', star4(0, 0, F.r * 0.32, F.r * 0.09), C.star, { flat: true, flatTone: 0, sw: 3 })]));
      return kids;
    },
    anim(F, s, out) {
      for (let i = 0; i < 4; i++) {
        const k = F.pre + 'spk' + i;
        const u = clamp((s.u - i * 0.12) / 0.6, 0, 1);
        if (!s.on || u <= 0 || u >= 1) { out[k] = { display: 'none' }; continue; }
        const a = -Math.PI * 0.85 + i * 0.55;
        const d = F.r * (1.25 + 0.35 * u) * (0.8 + 0.2 * s.amp);
        out[k] = { display: null, transform: tf(Math.cos(a) * d * 1.1, Math.sin(a) * d, Math.sin(u * Math.PI) * (0.7 + 0.3 * s.amp), u * 90) };
      }
    }
  },
  tears: {
    build(F, C) {
      const kids = [];
      for (let i = 0; i < 3; i++) kids.push(kg(F.pre + 'tear' + i, { display: 'none' }, [part('tear', dropPoly(0, 0, F.r * 0.1), C.water, { flat: true, flatTone: 1, sw: 2.5 })]));
      return kids;
    },
    anim(F, s, out) {
      for (let i = 0; i < 3; i++) {
        const k = F.pre + 'tear' + i;
        if (!s.on) { out[k] = { display: 'none' }; continue; }
        const per = 0.9;
        const u = ((s.t + i * 0.33) % per) / per;
        const e = i % 2 ? F.eye2 : F.eye;
        out[k] = { display: null, transform: tf(e[0] + (i % 2 ? -1 : 1) * F.r * 0.05, e[1] + F.r * 0.2 + u * u * F.r * 1.4, (0.8 + 0.4 * s.amp) * (1 - u * 0.3)) };
      }
    }
  },
  tear_streams: {
    build(F, C) {
      const kids = [];
      for (let side = 0; side < 2; side++) {
        for (let f = 0; f < 3; f++) {
          const e = side ? F.eye2 : F.eye;
          const dir = side ? -1 : 1;
          const len = F.r * (0.9 + f * 0.25);
          const ptsA = [];
          for (let i = 0; i <= 6; i++) {
            const u = i / 6;
            ptsA.push([e[0] + dir * (F.r * 0.15 + u * len), e[1] + F.r * 0.05 - Math.sin(u * Math.PI * 0.8) * F.r * 0.35 + u * u * F.r * 0.9]);
          }
          const rb = ribbon(ptsA, ptsA.map((_, i) => F.r * (0.13 + 0.06 * (i / 6))));
          const g = kg(F.pre + 'stream' + side + f, { display: 'none' }, [part('stream', rb, C.water, { flat: true, flatTone: 1, sw: 3 }), part('streamdrops', dropPoly(ptsA[6][0] + dir * F.r * 0.1, ptsA[6][1] + F.r * 0.15, F.r * 0.08), C.water, { flat: true, flatTone: 0, sw: 2 })]);
          kids.push(g);
        }
      }
      return kids;
    },
    anim(F, s, out) {
      const f = Math.floor(s.t * 12) % 3;
      for (let side = 0; side < 2; side++) for (let i = 0; i < 3; i++) out[F.pre + 'stream' + side + i] = { display: s.on && i === f ? null : 'none' };
    }
  },
  sweat_drops: {
    build(F, C) {
      const kids = [];
      for (let i = 0; i < 3; i++) kids.push(kg(F.pre + 'sweat' + i, { display: 'none' }, [part('sweat', dropPoly(0, 0, F.r * 0.11), C.water, { flat: true, flatTone: 0, sw: 2.5 })]));
      return kids;
    },
    anim(F, s, out) {
      for (let i = 0; i < 3; i++) {
        const k = F.pre + 'sweat' + i;
        if (!s.on) { out[k] = { display: 'none' }; continue; }
        const per = 0.75;
        const u = ((s.t + i * 0.25) % per) / per;
        const side = i === 1 ? -1 : 1;
        const x0 = side * F.w * 0.9;
        const y0 = -F.r * (0.55 - i * 0.12);
        out[k] = { display: null, transform: tf(x0 + side * u * F.r * 0.9, y0 - Math.sin(u * Math.PI) * F.r * 0.5 + u * F.r * 0.3, (0.7 + 0.4 * s.amp) * (1 - u * 0.4), side * u * 40) };
      }
    }
  },
  steam: {
    build(F, C) {
      const kids = [];
      for (let i = 0; i < 3; i++) kids.push(kg(F.pre + 'steam' + i, { display: 'none' }, [part('steam', ngon(0, 0, F.r * 0.26, F.r * 0.2, 7), C.steam, { sw: 3 })]));
      return kids;
    },
    anim(F, s, out) {
      for (let i = 0; i < 3; i++) {
        const k = F.pre + 'steam' + i;
        if (!s.on) { out[k] = { display: 'none' }; continue; }
        const per = 0.8;
        const u = ((s.t + i * 0.27) % per) / per;
        const side = i - 1;
        out[k] = { display: null, transform: tf(side * F.w * 0.45 + side * u * F.r * 0.4, -F.r * 1.05 - u * F.r * 1.1 * (0.7 + 0.3 * s.amp), (0.5 + u * 0.9) * (0.8 + 0.25 * s.amp)), opacity: num(1 - u * 0.7) };
      }
    }
  },
  jump_back: {
    build(F) {
      const lines = [];
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.42;
        lines.push(inkLine([[Math.cos(a) * F.r * 1.25, Math.sin(a) * F.r * 1.25], [Math.cos(a) * F.r * 1.6, Math.sin(a) * F.r * 1.6]], Math.max(3, F.r * 0.06)));
      }
      const g = kg(F.pre + 'takelines', { display: 'none' }, lines);
      g.attrs['data-part'] = 'takelines';
      return [g];
    },
    anim(F, s, out) {
      out[F.pre + 'takelines'] = { display: s.on && s.u < 0.8 ? null : 'none', transform: tf(0, 0, 0.8 + 0.4 * Math.sin(s.u * Math.PI)) };
    }
  },
  jaw_drop: {
    build(F, C) {
      const g = kg(F.pre + 'jaw', { display: 'none' }, []);
      const mouth = h('polygon', { points: '0,0 1,0 1,1', fill: C.mouth[2], stroke: INK, 'stroke-width': '4', 'stroke-linejoin': 'round' });
      mouth.k = F.pre + 'jawpoly';
      const tongue = h('polygon', { points: '0,0 1,0 1,1', fill: C.mouth[0] });
      tongue.k = F.pre + 'jawtongue';
      g.children.push(h('g', { 'data-part': 'jaw' }, [mouth, tongue]));
      return [g];
    },
    anim(F, s, out) {
      const k = F.pre + 'jaw';
      if (!s.on) { out[k] = { display: 'none' }; return; }
      const u = s.u;
      const open = u < 0.25 ? smooth(u / 0.25) : (u < 0.7 ? 1 : 1 - smooth((u - 0.7) / 0.3));
      const maxLen = s.amp >= 1.5 ? F.ground : F.r * (0.9 + 0.6 * s.amp);
      const len = Math.max(4, open * maxLen);
      const m = F.mouth;
      const w = F.r * 0.32;
      const P = [[m[0] - w, m[1] - F.r * 0.06], [m[0] + w, m[1] - F.r * 0.06], [m[0] + w * 0.8, m[1] + len], [m[0] - w * 0.8, m[1] + len]];
      const T = [[m[0] - w * 0.55, m[1] + len * 0.9], [m[0], m[1] + len * 0.72], [m[0] + w * 0.55, m[1] + len * 0.9]];
      out[k] = { display: null };
      out[F.pre + 'jawpoly'] = { points: pts(P) };
      out[F.pre + 'jawtongue'] = { points: pts(T) };
    }
  },
  eyes_pop: {
    build(F, C) {
      const kids = [];
      for (let i = 0; i < 2; i++) {
        const e = i ? F.eye2 : F.eye;
        const er = F.er * 1.9 * (i ? 0.9 : 1);
        const stalk = inkLine([[0, 0], [1, 0]], Math.max(3, er * 0.25), mix(C.white[2], INK, 0.2));
        stalk.k = F.pre + 'stalk' + i;
        const ball = kg(F.pre + 'ball' + i, {}, [
          h('polygon', { points: pts(ngon(0, 0, er, er * 1.1, 10)), fill: C.white[0], stroke: INK, 'stroke-width': num(Math.max(3, er * 0.15)), 'stroke-linejoin': 'round' }),
          h('circle', { cx: num(er * 0.2), cy: '0', r: num(Math.min(14, er * 0.35)), fill: INK })
        ]);
        const g = kg(F.pre + 'pop' + i, { display: 'none', transform: tf(e[0], e[1]) }, [stalk, ball]);
        g.attrs['data-part'] = 'popeye';
        kids.push(g);
      }
      return kids;
    },
    anim(F, s, out) {
      for (let i = 0; i < 2; i++) {
        const k = F.pre + 'pop' + i;
        if (!s.on) { out[k] = { display: 'none' }; continue; }
        const u = s.u;
        const ext = u < 0.25 ? smooth(u / 0.25) * 1.15 : (u < 0.6 ? 1 + 0.15 * Math.cos(((u - 0.25) / 0.35) * TAU * 2) * (1 - (u - 0.25) / 0.35) : 1 - smooth((u - 0.6) / 0.4));
        const d = ext * F.r * (0.9 + 0.4 * s.amp);
        out[k] = { display: null };
        out[F.pre + 'ball' + i] = { transform: tf(d, -d * 0.15, 0.6 + 0.4 * ext) };
        out[F.pre + 'stalk' + i] = { points: pts([[0, 0], [d, -d * 0.15]]) };
      }
    }
  },
  hair_stand: {
    build(F, C) {
      const sp = [];
      const n = 7;
      for (let i = 0; i <= n; i++) {
        const x = -F.w * 0.9 + (i * F.w * 1.8) / n;
        sp.push([x, 0]);
        if (i < n) sp.push([x + F.w * 0.13, -F.r * (1.0 + 0.25 * (i % 2))]);
      }
      sp.push([F.w * 0.9, F.r * 0.15], [-F.w * 0.9, F.r * 0.15]);
      const g = kg(F.pre + 'hairup', { display: 'none' }, [part('hair_stand', sp, F.hair, { sw: 3.5 })]);
      return [g];
    },
    anim(F, s, out) {
      const k = F.pre + 'hairup';
      if (!s.on) { out[k] = { display: 'none' }; return; }
      const u = s.u;
      const e = u < 0.15 ? smooth(u / 0.15) * 1.2 : lerp(1.2, 0, smooth((u - 0.15) / 0.85));
      out[k] = { display: e > 0.02 ? null : 'none', transform: 'translate(0,' + num(-F.r * 0.78) + ') scale(1,' + num(Math.max(0.02, e * (0.8 + 0.2 * s.amp))) + ')' };
    }
  },
  droop: {
    build(F, C) {
      const lines = [];
      for (let i = 0; i < 4; i++) {
        const x = -F.w * 0.45 + i * F.w * 0.3;
        lines.push(h('polygon', { points: pts([[x - 3, -F.r * 0.85], [x + 3, -F.r * 0.85], [x + 2, -F.r * (0.5 - (i % 2) * 0.1)], [x - 2, -F.r * (0.5 - (i % 2) * 0.1)]]), fill: C.gloom[1] }));
      }
      const g = kg(F.pre + 'gloom', { display: 'none', opacity: '0.7' }, lines);
      g.attrs['data-part'] = 'gloom';
      return [g];
    },
    anim(F, s, out) { out[F.pre + 'gloom'] = { display: s.on ? null : 'none' }; }
  },
  shake: {
    build(F) {
      const mk = (side) => [inkLine([[side * F.w * 1.2, -F.r * 0.3], [side * F.w * 1.4, -F.r * 0.1], [side * F.w * 1.2, F.r * 0.1]], 3.5), inkLine([[side * F.w * 1.45, -F.r * 0.4], [side * F.w * 1.7, -F.r * 0.1], [side * F.w * 1.45, F.r * 0.2]], 3.5)];
      const g = kg(F.pre + 'shakelines', { display: 'none' }, mk(1).concat(mk(-1)));
      g.attrs['data-part'] = 'shakelines';
      return [g];
    },
    anim(F, s, out) { out[F.pre + 'shakelines'] = { display: s.on && Math.floor(s.t * 10) % 2 === 0 ? null : 'none' }; }
  },
  tremble: {
    build(F) {
      const g = kg(F.pre + 'tremblelines', { display: 'none' }, [inkLine([[-F.w * 1.15, F.r * 0.2], [-F.w * 1.3, F.r * 0.35], [-F.w * 1.15, F.r * 0.5]], 3), inkLine([[F.w * 1.15, F.r * 0.2], [F.w * 1.3, F.r * 0.35], [F.w * 1.15, F.r * 0.5]], 3)]);
      g.attrs['data-part'] = 'tremblelines';
      return [g];
    },
    anim(F, s, out) { out[F.pre + 'tremblelines'] = { display: s.on && Math.floor(s.t * 14) % 2 === 0 ? null : 'none' }; }
  },
  bounce: {
    build(F) {
      const g = kg(F.pre + 'bouncelines', { display: 'none' }, [inkLine([[-F.w * 1.1, -F.r * 0.9], [-F.w * 1.35, -F.r * 1.2]], 3.5), inkLine([[F.w * 1.1, -F.r * 0.9], [F.w * 1.35, -F.r * 1.2]], 3.5), inkLine([[0, -F.r * 1.25], [0, -F.r * 1.6]], 3.5)]);
      g.attrs['data-part'] = 'bouncelines';
      return [g];
    },
    anim(F, s, out) {
      const ph = (s.clock * 1.6) % 1;
      out[F.pre + 'bouncelines'] = { display: s.on && s.idle && ph > 0.25 && ph < 0.75 ? null : 'none' };
    }
  },
  red_face: {
    build() { return []; },
    anim(F, s, out) {
      // overlays live in the head (built by the rig)
      out[F.pre + 'red0'] = { display: s.on ? null : 'none' };
      if (F.hasRed1) out[F.pre + 'red1'] = { display: s.on && s.amp > 1.2 && s.t > 0.35 ? null : 'none' };
    }
  },
  pale_face: {
    build() { return []; },
    anim(F, s, out) { out[F.pre + 'pale'] = { display: s.on ? null : 'none' }; }
  }
};

export const EFFECT_IDS = Object.keys(HEAD_FX);

export function buildHeadFx(F, ids, ctx) {
  const C = fxColors(ctx);
  const kids = [];
  for (const id of ids) {
    if (!HEAD_FX[id]) continue;
    for (const n of HEAD_FX[id].build(F, C)) { n.attrs['data-fx'] = id; kids.push(n); }
  }
  return kids;
}

export function animHeadFx(F, id, s, out) { if (HEAD_FX[id]) HEAD_FX[id].anim(F, s, out); }

// ---------- actor-level comic effects (world aligned, local forward = +x) ----------

export const MOTION_FX = ['speed', 'dust', 'skid', 'shout', 'bark', 'impact', 'dizzy', 'idea', 'tremblelegs'];

export function buildMotionFx(pre, M, ctx) {
  // M: { H (height), headY (head centre height above ground), headX, legW }
  const C = fxColors(ctx);
  const kids = [];
  const speed = [];
  for (let i = 0; i < 4; i++) {
    const y = -M.H * (0.25 + i * 0.17);
    const l = M.H * (0.35 + (i % 2) * 0.2);
    speed.push(h('polygon', { points: pts([[-M.H * 0.3, y - 3], [-M.H * 0.3 - l, y - 1.5], [-M.H * 0.3 - l, y + 1.5], [-M.H * 0.3, y + 3]]), fill: C.white[0], stroke: INK, 'stroke-width': '2' }));
  }
  const sg = kg(pre + 'speed', { display: 'none', 'data-fx': 'speed_lines' }, speed);
  sg.attrs['data-part'] = 'speedlines';
  kids.push(sg);
  for (let i = 0; i < 3; i++) kids.push(kg(pre + 'dust' + i, { display: 'none', 'data-fx': 'dust' }, [part('dust', ngon(0, 0, M.H * 0.09, M.H * 0.07, 7), C.dust, { sw: 3 })]));
  const skid = kg(pre + 'skid', { display: 'none', 'data-fx': 'skid' }, [inkLine([[-M.H * 0.1, -3], [-M.H * 0.7, -3]], 4), inkLine([[-M.H * 0.15, -12], [-M.H * 0.55, -12]], 3)]);
  skid.attrs['data-part'] = 'skid';
  kids.push(skid);
  const shout = [];
  for (let i = 0; i < 5; i++) {
    const a = (i - 2) * 0.3;
    shout.push(inkLine([[Math.cos(a) * M.H * 0.22, Math.sin(a) * M.H * 0.22], [Math.cos(a) * M.H * 0.38, Math.sin(a) * M.H * 0.38]], 5));
  }
  const shg = kg(pre + 'shout', { display: 'none' }, shout);
  shg.attrs['data-part'] = 'shoutlines';
  kids.push(shg);
  const bark = [];
  for (let i = 0; i < 3; i++) {
    const r = M.H * (0.12 + i * 0.07);
    const arc = [];
    for (let j = 0; j <= 4; j++) { const a = -0.6 + (j / 4) * 1.2; arc.push([Math.cos(a) * r, Math.sin(a) * r]); }
    bark.push(inkLine(arc, 4));
  }
  const bg = kg(pre + 'bark', { display: 'none' }, bark);
  bg.attrs['data-part'] = 'barklines';
  kids.push(bg);
  const impact = kg(pre + 'impact', { display: 'none', 'data-fx': 'dust' }, [part('impact', star4(0, 0, M.H * 0.18, M.H * 0.06).map((p, i) => (i % 2 ? p : [p[0] * 1.6, p[1] * 0.7])), C.white, { flat: true, flatTone: 0, sw: 3 })]);
  kids.push(impact);
  for (let i = 0; i < 3; i++) kids.push(kg(pre + 'dizzy' + i, { display: 'none', 'data-fx': 'dizzy' }, [part('dizzy', star4(0, 0, M.R * 0.3, M.R * 0.11), C.star, { flat: true, flatTone: 0, sw: 3 })]));
  for (let i = 0; i < 3; i++) kids.push(kg(pre + 'idea' + i, { display: 'none', 'data-fx': 'sparkles' }, [part('idea', star4(0, 0, M.R * (i ? 0.25 : 0.5), M.R * (i ? 0.07 : 0.13)), C.star, { flat: true, flatTone: 0, sw: 3.5 })]));
  const tl = kg(pre + 'tremblelegs', { display: 'none', 'data-fx': 'tremble' }, [inkLine([[-M.legW * 2.2, -M.H * 0.18], [-M.legW * 2.8, -M.H * 0.12], [-M.legW * 2.2, -M.H * 0.06]], 3.5), inkLine([[M.legW * 2.2, -M.H * 0.18], [M.legW * 2.8, -M.H * 0.12], [M.legW * 2.2, -M.H * 0.06]], 3.5)]);
  tl.attrs['data-part'] = 'tremblelegs';
  kids.push(tl);
  return kids;
}

// s: { speed, dust (0..1 strength), dustT, skid, shout, bark, impact (u), dizzy (t or -1), idea (t or -1), tremble, head: [x,y] local, clock }
export function animMotionFx(pre, M, s, out) {
  out[pre + 'speed'] = { display: s.speed > 0.05 ? null : 'none', transform: 'translate(' + num(Math.sin(s.clock * 40) * 6) + ',0) scale(' + num(0.7 + 0.3 * (s.speed || 0)) + ',1)' };
  for (let i = 0; i < 3; i++) {
    const k = pre + 'dust' + i;
    if (!(s.dust > 0)) { out[k] = { display: 'none' }; continue; }
    const per = 0.45;
    const u = ((s.dustT + i * 0.15) % per) / per;
    out[k] = { display: null, transform: tf(-M.H * (0.15 + u * 0.45) - i * M.H * 0.08, -M.H * (0.04 + u * 0.12), (0.4 + u * 0.9) * (0.6 + 0.4 * s.dust)), opacity: num(1 - u) };
  }
  out[pre + 'skid'] = { display: s.skid ? null : 'none' };
  out[pre + 'shout'] = { display: s.shout ? null : 'none', transform: tf(s.head[0] + M.R * 1.1, s.head[1], 0.9 + 0.2 * Math.sin(s.clock * 50)) };
  out[pre + 'bark'] = { display: s.bark ? null : 'none', transform: tf(s.head[0] + M.R * 1.3, s.head[1] + M.R * 0.3, 0.8 + 0.3 * ((s.clock * 4) % 1)) };
  out[pre + 'impact'] = { display: s.impact >= 0 && s.impact < 1 ? null : 'none', transform: tf(s.impactX || 0, -6, 0.5 + 0.8 * Math.sin(Math.min(1, Math.max(0, s.impact)) * Math.PI)) };
  for (let i = 0; i < 3; i++) {
    const k = pre + 'dizzy' + i;
    if (!(s.dizzy >= 0)) { out[k] = { display: 'none' }; continue; }
    const a = s.dizzy * 5 + (i * TAU) / 3;
    out[k] = { display: null, transform: tf(s.head[0] + Math.cos(a) * M.R * 1.1, s.head[1] - M.R * 0.9 + Math.sin(a) * M.R * 0.35, 0.8 + 0.25 * Math.sin(a), a * 40) };
  }
  for (let i = 0; i < 3; i++) {
    const k = pre + 'idea' + i;
    if (!(s.idea >= 0) || s.idea > 0.9) { out[k] = { display: 'none' }; continue; }
    const u = s.idea / 0.9;
    const pos = [[0, -M.R * 1.9], [M.R * 0.8, -M.R * 1.5], [-M.R * 0.7, -M.R * 1.6]][i];
    out[k] = { display: null, transform: tf(s.head[0] + pos[0], s.head[1] + pos[1], Math.sin(Math.min(1, u * 1.3) * Math.PI) * 1.2, u * 120) };
  }
  out[pre + 'tremblelegs'] = { display: s.tremble && Math.floor(s.clock * 16) % 2 === 0 ? null : 'none' };
}

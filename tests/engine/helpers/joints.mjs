// The joints each skeleton declares (A72, A73): where a limb meets the part it carries, and where its
// root sits inside the body. Checked on the drawing data, with the numbers exactly as the SVG writes them.
import { parseTransform, mMul, mApply } from '../../../engine/src/draw/svg.mjs';

// [limb, keyed group translated to the limb's last point]
const ENDS = {
  biped: [['armF', 'handF'], ['armB', 'handB'], ['legF', 'footF'], ['legB', 'footB'], ['neck', 'head']],
  quadruped: [['legFF', 'pawFF'], ['legFB', 'pawFB'], ['legBF', 'pawBF'], ['legBB', 'pawBB'], ['neckl', 'head']],
  bird: [['legF', 'footF'], ['legB', 'footB'], ['neckl', 'head']]
};
// [overlay limb, limb whose first point it shares]
const STARTS = {
  biped: [['sleeveF', 'armF'], ['sleeveB', 'armB'], ['shortsF', 'legF'], ['shortsB', 'legB']],
  quadruped: [],
  bird: []
};
// [limb whose first point is a root, silhouette part that must contain it]
const ROOTS = {
  biped: [['armF', 'torso'], ['armB', 'torso'], ['legF', 'torso'], ['legB', 'torso'], ['neck', 'torso']],
  quadruped: [['legFF', 'body'], ['legFB', 'body'], ['legBF', 'body'], ['legBB', 'body'], ['tail', 'body'], ['neckl', 'body']],
  bird: [['legF', 'body'], ['legB', 'body'], ['neckl', 'body']]
};
export const LIMBS = {
  biped: ['armF', 'armB', 'legF', 'legB', 'neck'],
  quadruped: ['legFF', 'legFB', 'legBF', 'legBB', 'tail', 'neck'],
  bird: ['legF', 'legB', 'neck']
};

function pairs(points) { return String(points).trim().split(/\s+/); }

function translateOf(tf) {
  const m = /^translate\(([^,)]+),([^)]+)\)/.exec(tf || '');
  return m ? m[1] + ',' + m[2] : null;
}

// polygons of the silhouette of a part, in the frame of `ver` (the character's drawing for one facing)
function silhouette(ver, upd, partName) {
  let found = null;
  const visit = (n, M) => {
    if (found || !n || typeof n !== 'object') return;
    const u = n.k ? upd[n.k] : null;
    const tf = u && u.transform !== undefined ? u.transform : n.attrs.transform;
    const m = tf ? mMul(M, parseTransform(tf)) : M;
    if (n.tag === 'g' && n.attrs['data-part'] === partName) {
      const polys = [];
      for (const c of n.children) {
        if (c && c.tag === 'polygon' && c.silhouette) {
          const ctf = c.attrs.transform ? mMul(m, parseTransform(c.attrs.transform)) : m;
          polys.push(pairs(c.attrs.points).map((p) => mApply(ctf, p.split(',').map(Number))));
        }
      }
      found = polys;
      return;
    }
    for (const c of n.children) visit(c, m);
  };
  visit(ver, [1, 0, 0, 1, 0, 0]);
  return found || [];
}

function inside(poly, p) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) ins = !ins;
  }
  return ins;
}

// problems with the declared joints of one drawn pose; `upd` is the frame's update map (or the rig's
// own output), `ver` the version node, `pre` its key prefix. Without `upd`, the values are read from the
// tree itself (a drawing whose updates were already applied).
export function jointProblems(rig, ver, pre, upd, where) {
  const errs = [];
  let get = (k) => upd[k];
  if (!upd) {
    const idx = new Map();
    const visit = (n) => { if (!n || typeof n !== 'object') return; if (n.k) idx.set(n.k, n.attrs); for (const c of n.children) visit(c); };
    visit(ver);
    get = (k) => idx.get(k);
    upd = {};
  }
  const pts = (limb) => { const u = get(pre + limb + ':ink'); return u && u.points ? pairs(u.points) : null; };
  const hidden = (k) => { const u = get(pre + k + ':ink') || get(pre + k); return u && u.display === 'none'; };
  for (const [limb, grp] of ENDS[rig]) {
    if (hidden(limb)) continue;
    const p = pts(limb);
    const t = translateOf(get(pre + grp) && get(pre + grp).transform);
    if (!p || !t) { errs.push(where + ': no data for ' + limb + '/' + grp); continue; }
    if (p[p.length - 1] !== t) errs.push(where + ': ' + limb + ' ends at ' + p[p.length - 1] + ' but ' + grp + ' sits at ' + t);
  }
  for (const [over, limb] of STARTS[rig]) {
    const a = pts(over);
    const b = pts(limb);
    if (!a || !b || hidden(limb)) continue;
    if (a[0] !== b[0]) errs.push(where + ': ' + over + ' starts at ' + a[0] + ', ' + limb + ' at ' + b[0]);
  }
  const sil = {};
  for (const [limb, partName] of ROOTS[rig]) {
    const p = pts(limb);
    if (!p || hidden(limb)) continue;
    if (!sil[partName]) sil[partName] = silhouette(ver, upd, partName);
    const q = p[0].split(',').map(Number);
    if (!sil[partName].some((poly) => inside(poly, q))) errs.push(where + ': root of ' + limb + ' (' + p[0] + ') is outside the ' + partName);
  }
  return errs;
}

// every character drawing in a tree: [{ rig, ver, pre }] for both facings
export function charactersIn(tree) {
  const out = [];
  const keys = new Set();
  const vers = [];
  const visit = (n) => {
    if (!n || typeof n !== 'object') return;
    if (n.k) {
      keys.add(n.k);
      const m = /^(.*):(R|L):ver$/.exec(n.k);
      if (m) vers.push({ ver: n, pre: m[1] + ':' + m[2] + ':' });
    }
    for (const c of n.children) visit(c);
  };
  visit(tree);
  for (const v of vers) {
    const rig = keys.has(v.pre + 'torso') ? 'biped' : (keys.has(v.pre + 'pawFF') ? 'quadruped' : 'bird');
    out.push({ rig, ver: v.ver, pre: v.pre });
  }
  return out;
}

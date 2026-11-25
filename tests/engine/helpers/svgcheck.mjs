// Checks for the D13.2 drawing rules (A34) and small tree utilities used by several tests.
export const ALLOWED_TAGS = new Set(['svg', 'g', 'polygon', 'polyline', 'path', 'rect', 'circle', 'text', 'tspan']);
const COLOR = /^(#[0-9A-Fa-f]{6}|none)$/;

export function walk(node, fn, visible) {
  if (!node || typeof node !== 'object') return;
  const vis = visible !== false && node.attrs.display !== 'none';
  fn(node, vis);
  for (const c of node.children) walk(c, fn, vis);
}

export function hasShape(tree) {
  let ok = false;
  walk(tree, (n) => { if (n.tag === 'polygon' || n.tag === 'path') ok = true; });
  return ok;
}

function fillsOfPart(part) {
  const fills = new Set();
  const visit = (n, top) => {
    if (!top && n.attrs['data-part'] !== undefined) return;
    const f = n.attrs.fill;
    if (f && f !== 'none') fills.add(f.toUpperCase());
    for (const c of n.children) if (typeof c === 'object') visit(c, false);
  };
  visit(part, true);
  return fills;
}

// returns a list of problems (empty when the tree follows D13.2)
export function checkTree(tree, where) {
  const errs = [];
  const at = where || 'tree';
  walk(tree, (n) => {
    if (!ALLOWED_TAGS.has(n.tag)) errs.push(at + ': element <' + n.tag + '> is not allowed');
    for (const [k, v] of Object.entries(n.attrs)) {
      if (v === undefined || v === null) continue;
      const s = String(v);
      if (s.includes('url(')) errs.push(at + ': url( in ' + k);
      if ((k === 'fill' || k === 'stroke') && !COLOR.test(s)) errs.push(at + ': ' + k + '=' + s);
    }
    // straight segments and curves (C S Q T), never arcs (A74)
    if (n.tag === 'path' && !/^[MLHVZCSQTmlhvzcsqt0-9.,\s-]*$/.test(n.attrs.d || '')) errs.push(at + ': path with commands other than M L H V C S Q T Z');
    if (n.tag === 'circle' && Number(n.attrs.r) > 14) errs.push(at + ': circle r=' + n.attrs.r);
    if (n.tag === 'g' && n.attrs['data-part'] !== undefined) {
      const f = fillsOfPart(n);
      if (f.size > 3) errs.push(at + ': part "' + n.attrs['data-part'] + '" has ' + f.size + ' fills');
    }
  });
  return errs;
}

// A73: every stroke has round joins and caps; every facet sits over its part's base silhouette or is
// stroked with its own colour, so no seams show between facets
export function checkSeams(tree, where) {
  const errs = [];
  let facets = 0;
  const visit = (n) => {
    if (!n || typeof n !== 'object') return;
    const a = n.attrs;
    if (a.stroke && a.stroke !== 'none' && (a['stroke-linejoin'] !== 'round' || a['stroke-linecap'] !== 'round')) errs.push(where + ': <' + n.tag + '> stroke without round join or cap');
    let base = false;
    for (const c of n.children) {
      if (!c || typeof c !== 'object') continue;
      if (c.silhouette) base = true;
      if (c.facet) {
        facets++;
        const same = c.attrs.stroke && c.attrs.fill && c.attrs.stroke.toUpperCase() === c.attrs.fill.toUpperCase();
        if (!base && !same && c.tag !== 'polyline') errs.push(where + ': a facet with no silhouette under it and no stroke of its colour');
      }
      visit(c);
    }
  };
  visit(tree);
  return { errs, facets };
}

// check attribute values carried by a frame's updates
export function checkUpdates(updates, where) {
  const errs = [];
  for (const [k, u] of Object.entries(updates)) {
    for (const [a, v] of Object.entries(u)) {
      if (v === null || v === undefined) continue;
      const s = String(v);
      if (s.includes('url(')) errs.push(where + ': url( in ' + k + '.' + a);
      if ((a === 'fill' || a === 'stroke') && !COLOR.test(s)) errs.push(where + ': ' + k + '.' + a + '=' + s);
      if (a === 'r' && Number(s) > 14) errs.push(where + ': r=' + s);
    }
  }
  return errs;
}

export function texts(tree) {
  const out = [];
  walk(tree, (n) => { if (n.tag === 'text') out.push(n.children.filter((c) => typeof c === 'string').join('')); });
  return out;
}

export function fxValues(tree, onlyVisible) {
  const out = new Set();
  walk(tree, (n, vis) => { if (n.attrs['data-fx'] !== undefined && (!onlyVisible || vis)) out.add(n.attrs['data-fx']); });
  return out;
}

export function indexKeys(tree) {
  const idx = new Map();
  walk(tree, (n) => { if (n.k) idx.set(n.k, n); });
  return idx;
}

export function applyIndexed(idx, updates) {
  for (const [k, u] of Object.entries(updates)) {
    const n = idx.get(k);
    if (!n) continue;
    for (const [a, v] of Object.entries(u)) { if (v === null) delete n.attrs[a]; else n.attrs[a] = v; }
  }
}

export function bboxOf(tree) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  const add = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
  walk(tree, (n) => {
    if (n.tag === 'polygon' || n.tag === 'polyline') {
      for (const pair of String(n.attrs.points).trim().split(/\s+/)) { const [x, y] = pair.split(',').map(Number); add(x, y); }
    } else if (n.tag === 'circle') {
      const cx = Number(n.attrs.cx); const cy = Number(n.attrs.cy); const r = Number(n.attrs.r);
      add(cx - r, cy - r); add(cx + r, cy + r);
    }
  });
  return { w: x1 - x0, h: y1 - y0 };
}

export function findPart(tree, name) {
  let found = null;
  walk(tree, (n) => { if (!found && n.attrs['data-part'] === name) found = n; });
  return found;
}

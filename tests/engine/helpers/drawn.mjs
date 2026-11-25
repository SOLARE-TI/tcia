// Draws every registry entry (A33) once, so coverage and SVG-rule tests share the same trees.
import { registry } from '../../../engine/src/registry.mjs';
import { RIGS } from '../../../engine/src/pose.mjs';
import { rigUpdate } from '../../../engine/src/draw/scene.mjs';
import { applyUpdates } from '../../../engine/src/draw/svg.mjs';

const SAMPLE = { biped: 'boy', quadruped: 'dog', bird: 'bird' };

export function drawPose(catalog, rig, poseFn, p) {
  const view = registry.kinds[SAMPLE[rig]](catalog);
  const pose = poseFn({ p, t: p * 1.2, dur: 1.2, dist: 480, heightPx: 220, dims: view.dims, targetDx: 300, targetUp: 250, partnerDx: 240, seatTo: 0 });
  pose.ver = 'R';
  const upd = {};
  Object.assign(upd, rigUpdate(view, pose).out);
  return applyUpdates(view.tree, upd);
}

// [{ id: 'actions.walk.normal.biped', tree }] for every catalog id
export function drawAll(catalog) {
  const out = [];
  const add = (id, tree) => out.push({ id, tree });
  for (const a of Object.keys(catalog.actions)) {
    for (const v of Object.keys(catalog.actions[a].variants)) {
      for (const r of RIGS) {
        const fn = registry.actions[a] && registry.actions[a].variants[v] && registry.actions[a].variants[v][r];
        add('actions.' + a + '.' + v + '.' + r, fn ? drawPose(catalog, r, fn, 0.5) : null);
      }
    }
  }
  for (const f of Object.keys(catalog.faces)) add('faces.' + f, registry.faces[f] ? registry.faces[f](catalog) : null);
  for (const e of Object.keys(catalog.effects)) add('effects.' + e, registry.effects[e] ? registry.effects[e](catalog) : null);
  for (const k of Object.keys(catalog.kinds)) add('kinds.' + k, registry.kinds[k] ? registry.kinds[k](catalog).tree : null);
  for (const set of Object.keys(catalog.attributeSets)) {
    for (const attr of Object.keys(catalog.attributeSets[set])) {
      const def = catalog.attributeSets[set][attr];
      const values = def.values ? Object.keys(def.values) : Object.keys(catalog.palettes[def.palette]);
      for (const v of values) {
        const fn = registry.attributes[set] && registry.attributes[set][attr] && registry.attributes[set][attr][v];
        add('attributes.' + set + '.' + attr + '.' + v, fn ? fn(catalog) : null);
      }
    }
  }
  for (const b of Object.keys(catalog.bases)) add('bases.' + b, registry.bases[b] ? registry.bases[b](catalog) : null);
  for (const l of Object.keys(catalog.lights)) add('lights.' + l, registry.lights[l] ? registry.lights[l](catalog) : null);
  for (const i of Object.keys(catalog.items)) add('items.' + i, registry.items[i] ? registry.items[i](catalog) : null);
  for (const p of Object.keys(catalog.positions)) add('positions.' + p, registry.positions[p] ? registry.positions[p](catalog) : null);
  for (const hId of Object.keys(catalog.actions.jump.heights)) add('heights.' + hId, registry.heights[hId] ? registry.heights[hId](catalog) : null);
  for (const p of Object.keys(catalog.pieces)) {
    const def = catalog.pieces[p];
    const vs = def.variants.length ? def.variants : ['default'];
    for (const v of vs) {
      for (const layer of def.layers) {
        const fn = registry.pieces[p] && registry.pieces[p][v];
        add('pieces.' + p + '.' + v + '.' + layer, fn ? fn(catalog, { layer, color: def.colorable ? def.defaultColor : null }) : null);
      }
    }
  }
  return out;
}

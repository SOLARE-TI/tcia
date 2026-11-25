import test from 'node:test';
import assert from 'node:assert/strict';
import { prepare, createPlayer } from '../../engine/src/core.mjs';
import { buildSceneView } from '../../engine/src/draw/scene.mjs';
import { FACET_CONTRAST } from '../../engine/src/draw/svg.mjs';
import { loadCatalog, allScripts, combos, playPath } from './helpers/load.mjs';
import { drawAll } from './helpers/drawn.mjs';
import { checkTree, checkUpdates, checkSeams, indexKeys, applyIndexed } from './helpers/svgcheck.mjs';
import { jointProblems, charactersIn } from './helpers/joints.mjs';

const catalog = loadCatalog();

test('A34: registry drawings use only the D13.2 elements, colours and rules', () => {
  const errs = [];
  for (const d of drawAll(catalog)) errs.push(...checkTree(d.tree, d.id));
  assert.deepEqual(errs.slice(0, 20), []);
});

test('A34: frames of every path (each 1/15 s) follow the same rules', () => {
  for (const s of allScripts()) {
    const story = prepare(s.script, catalog);
    const views = {};
    const errs = [];
    for (const picks of combos(story)) {
      playPath(createPlayer, story, picks, 1 / 15, (f) => {
        let v = views[f.sceneId];
        if (!v) {
          v = buildSceneView(story, f.sceneId);
          v.index = indexKeys(v.tree);
          views[f.sceneId] = v;
          errs.push(...checkTree(v.tree, s.name + ':' + f.sceneId));
        }
        const u = v.update(f);
        errs.push(...checkUpdates(u, s.name + ':' + f.sceneId + '@' + f.t.toFixed(2)));
        applyIndexed(v.index, u);
      });
    }
    for (const v of Object.values(views)) errs.push(...checkTree(v.tree, s.name + ':' + v.sceneId + ':after'));
    assert.deepEqual(errs.slice(0, 20), [], s.name);
  }
});

test('A73: round joins and caps on every stroke, facets over their silhouette or stroked in their own colour', (t) => {
  const errs = [];
  let facets = 0;
  for (const d of drawAll(catalog)) {
    const r = checkSeams(d.tree, d.id);
    facets += r.facets;
    errs.push(...r.errs);
  }
  t.diagnostic('FACET_CONTRAST = ' + FACET_CONTRAST + '; facet polygons checked: ' + facets);
  if (FACET_CONTRAST > 0) assert.ok(facets > 100);
  assert.deepEqual(errs.slice(0, 20), []);
});

test('A73: the two parts of every declared joint are written with the same numbers (A33 drawings and frames each 1/15 s)', (t) => {
  const errs = [];
  let n = 0;
  for (const d of drawAll(catalog)) {
    for (const c of charactersIn(d.tree)) { n++; errs.push(...jointProblems(c.rig, c.ver, c.pre, null, d.id + ' ' + c.pre)); }
  }
  for (const s of allScripts().filter((x) => !x.name.startsWith('fixtures/'))) {
    const story = prepare(s.script, catalog);
    const views = {};
    playPath(createPlayer, story, combos(story)[0], 1 / 15, (f) => {
      let v = views[f.sceneId];
      if (!v) { v = buildSceneView(story, f.sceneId); v.index = indexKeys(v.tree); v.chars = charactersIn(v.tree); views[f.sceneId] = v; }
      applyIndexed(v.index, v.update(f));
      for (const c of v.chars) {
        if (c.ver.attrs.display === 'none') continue;
        n++;
        errs.push(...jointProblems(c.rig, c.ver, c.pre, null, s.name + ' ' + f.sceneId + '@' + f.t.toFixed(2) + ' ' + c.pre));
      }
    });
  }
  t.diagnostic('character drawings checked: ' + n);
  assert.deepEqual(errs.slice(0, 20), []);
});

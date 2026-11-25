import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { prepare, createPlayer, sampleScene, wrapText } from '../../engine/src/core.mjs';
import { buildSceneView, renderStill, rigUpdate } from '../../engine/src/draw/scene.mjs';
import { registry } from '../../engine/src/registry.mjs';
import { serialize, h, applyUpdates, FACET_CONTRAST, facetTone, withFacetContrast, mix } from '../../engine/src/draw/svg.mjs';
import { buildPoseTable } from '../../engine/src/pose.mjs';
import { loadCatalog, allScripts, combos, playPath, REPO } from './helpers/load.mjs';
import { drawAll } from './helpers/drawn.mjs';
import { texts, fxValues, indexKeys, applyIndexed, walk, bboxOf, findPart } from './helpers/svgcheck.mjs';

const catalog = loadCatalog();
const fxSeen = new Set();

function allSays(script) {
  const out = new Set();
  const visit = (o) => {
    if (Array.isArray(o)) o.forEach(visit);
    else if (o && typeof o === 'object') { if (typeof o.say === 'string') for (const l of wrapText(o.say, catalog.text.balloonLineChars)) out.add(l); Object.values(o).forEach(visit); }
  };
  visit(script);
  return out;
}

test('A38: every <text> drawn on every path is a line of some `say` (no names, titles or questions)', () => {
  for (const s of allScripts()) {
    const story = prepare(s.script, catalog);
    const lines = allSays(s.script);
    const views = {};
    for (const picks of combos(story)) {
      playPath(createPlayer, story, picks, 1 / 15, (f) => {
        let v = views[f.sceneId];
        if (!v) { v = buildSceneView(story, f.sceneId); v.index = indexKeys(v.tree); views[f.sceneId] = v; }
        applyIndexed(v.index, v.update(f));
      });
    }
    for (const v of Object.values(views)) {
      for (const t of texts(v.tree)) assert.ok(lines.has(t), s.name + ': unexpected text "' + t + '"');
      for (const x of fxValues(v.tree)) fxSeen.add(x);
    }
  }
});

// one actor of each rig runs, jumps (all variants) and falls (all variants)
function stuntScript(kind) {
  const B = (o) => Object.assign({ actor: 'x' }, o);
  return {
    tcia: 1, meta: { title: 'Stunts', slug: 'stunts', lang: 'en', light: 'day' },
    characters: [{ id: 'x', name: 'X', kind }],
    sets: [{ id: 's', base: 'plain' }],
    scenes: [{ id: 'one', set: 's', cast: [{ who: 'x', at: 'far_left', facing: 'right' }], beats: [
      B({ action: 'run', to: 'center' }), B({ action: 'run', variant: 'dash', to: 'right' }), B({ action: 'run', variant: 'panic', to: 'left' }),
      B({ action: 'jump', variant: 'flip' }), B({ action: 'jump', variant: 'backflip' }), B({ action: 'jump', variant: 'spin' }),
      B({ action: 'jump', variant: 'cartwheel', to: 'center' }), B({ action: 'jump', variant: 'split' }), B({ action: 'jump', height: 'high' }),
      B({ action: 'fall' }), B({ action: 'jump', height: 'low' }), B({ action: 'fall', variant: 'slip' }), B({ action: 'jump', height: 'low' }),
      B({ action: 'fall', variant: 'faint' }), B({ action: 'talk', say: 'Ow.' })
    ] }, { id: 'two', set: 's', cast: [{ who: 'x', at: 'center' }], beats: [B({ emotion: 'happy' })] }],
    decisions: [{ id: 'd1', after: 'one', options: [{ id: 'a', label: 'A', rejoin: 'two' }, { id: 'b', label: 'B', rejoin: 'two' }] },
      { id: 'd2', after: 'two', options: [{ id: 'a', label: 'A', rejoin: '@endings' }, { id: 'b', label: 'B', rejoin: '@endings' }] }],
    endings: [{ id: 'e1', title: 'E1', when: { choice: 'd1', is: 'a' }, scenes: [{ id: 'e1s', set: 's', cast: [{ who: 'x', at: 'center' }], beats: [B({ emotion: 'happy' })] }] },
      { id: 'e2', title: 'E2', when: { choice: 'd2', is: 'a' }, scenes: [{ id: 'e2s', set: 's', cast: [{ who: 'x', at: 'center' }], beats: [B({ emotion: 'happy' })] }] },
      { id: 'e3', title: 'E3', scenes: [{ id: 'e3s', set: 's', cast: [{ who: 'x', at: 'center' }], beats: [B({ emotion: 'happy' })] }] }]
  };
}

function visibleFx(tree) {
  const out = new Set();
  walk(tree, (n, vis) => { if (vis && n.attrs['data-fx']) out.add(n.attrs['data-fx']); });
  return out;
}

test('A56: dust, speed lines, skids and dizzy stars show up where they belong, in the three rigs', () => {
  for (const kind of ['boy', 'dog', 'bird']) {
    const story = prepare(stuntScript(kind), catalog);
    const view = buildSceneView(story, 'one');
    const idx = indexKeys(view.tree);
    const sc = story.scenes.one;
    const at = (t) => { applyIndexed(idx, view.update(sampleScene(story, 'one', t, t))); return visibleFx(view.tree); };
    const seen = (from, to, fx) => { for (let t = from; t <= to; t += 1 / 60) if (at(t).has(fx)) return true; return false; };
    for (const b of sc.beats) {
      const m0 = b.motionStart;
      const m1 = b.motionStart + b.motionDur;
      const label = kind + ' ' + b.action + '.' + b.variant;
      if (b.action === 'run') {
        assert.ok(seen(b.start, m0 + 0.35 * b.motionDur, 'dust'), label + ': dust when starting');
        assert.ok(seen(m0 + 0.2 * b.motionDur, m0 + 0.85 * b.motionDur, 'speed_lines'), label + ': speed lines');
        assert.ok(seen(m0 + 0.85 * b.motionDur, Math.min(b.end + 0.3, sc.content), 'skid'), label + ': skid when braking');
      }
      if (b.action === 'jump') {
        assert.ok(seen(m0 + 0.8 * b.motionDur, Math.min(m1 + 0.15, sc.content), 'dust'), label + ': dust on landing');
        if (['flip', 'backflip', 'spin', 'cartwheel'].includes(b.variant)) assert.ok(seen(m0 + 0.25 * b.motionDur, m0 + 0.8 * b.motionDur, 'speed_lines'), label + ': speed lines');
      }
      if (b.action === 'fall') {
        assert.ok(seen(m0 + 0.8 * b.motionDur, m1, 'dust'), label + ': dust at the end of the fall');
        assert.ok(seen(m0 + 0.8 * b.motionDur, b.end + 0.5, 'dizzy'), label + ': dizzy stars after the fall');
      }
    }
  }
});

const RIG_KIND = { biped: 'boy', quadruped: 'dog', bird: 'bird' };

function faceParts(rig, face) {
  const view = registry.kinds[RIG_KIND[rig]](catalog);
  // rebuild with both faces
  const v = (function build() {
    const kind = RIG_KIND[rig];
    const k = catalog.kinds[kind];
    const set = catalog.attributeSets[k.attributeSet];
    const look = {};
    for (const a of Object.keys(set)) look[a] = k.defaults[a] || set[a].default;
    return import('../../engine/src/draw/scene.mjs').then((m) => m.buildCharacter({ id: 'f', kind, rig, look }, { catalog, light: catalog.lights.day, faces: ['neutral', face], fx: {}, key: 'f' }));
  })();
  return v.then((vv) => {
    let node = null;
    walk(vv.tree, (n) => { if (!node && n.k === 'f:R:face:' + face) node = n; });
    const eyes = findPart(node, 'eyes');
    const mouth = findPart(node, 'mouth');
    return { eyes: eyes ? bboxOf(eyes) : null, mouth: mouth ? bboxOf(mouth) : null, view };
  });
}

test('A58: every emotion reads as a caricature from intensity 1 (eyes or mouth change >= 25 %)', async () => {
  const change = (a, b) => (a && b ? Math.max(Math.abs(a.w - b.w) / Math.max(1, b.w), Math.abs(a.h - b.h) / Math.max(1, b.h)) : 0);
  for (const rig of ['biped', 'quadruped', 'bird']) {
    const n = await faceParts(rig, 'neutral');
    for (const e of Object.keys(catalog.emotions)) {
      if (e === 'neutral') continue;
      const f1 = catalog.emotions[e].levels['1'].face;
      const f = await faceParts(rig, f1);
      const c = Math.max(change(f.eyes, n.eyes), change(f.mouth, n.mouth));
      assert.ok(c >= 0.25, rig + ' ' + e + ' (' + f1 + ') changes only ' + (c * 100).toFixed(0) + ' %');
    }
  }
});

const SHEET_SKIP = process.env.TCIA_SHEET ? false : 'set TCIA_SHEET=<folder outside the repository> to write the sheet';

// one character in one pose, on the ground line (the sheet's extra rows, A69 and A72)
const poseTable = buildPoseTable(catalog);
function poseCell(kind, look, action, variant, p) {
  const view = registry.kinds[kind](catalog, look);
  const pose = poseTable[action].variants[variant][view.rig]({ p, t: p * 1.2, dur: 1.2, dist: 480, heightPx: 220, dims: view.dims, targetDx: 300, targetUp: 250, partnerDx: 240, seatTo: 0 });
  pose.ver = 'R';
  applyUpdates(view.tree, rigUpdate(view, pose).out);
  const Y = 900 + (pose.y || 0);
  const tf = 'translate(960,' + Y + ') scale(' + (pose.sx || 1) + ',' + (pose.sy || 1) + ')' + (pose.rot ? ' rotate(' + pose.rot + ',0,' + -(pose.pivot || 0) + ')' : '');
  return h('g', {}, [h('polygon', { points: '0,900 1920,900 1920,1080 0,1080', fill: '#D9DEE6' }), h('g', { transform: tf }, [view.tree])]);
}

test('A58: with TCIA_SHEET=<folder outside the repo>, writes the emotion sheet (6 x 3 x 3)', { skip: SHEET_SKIP }, () => {
  const dir = process.env.TCIA_SHEET;
  const abs = path.resolve(dir);
  assert.ok(!(abs + path.sep).startsWith(REPO + path.sep), 'TCIA_SHEET must be outside the repository');
  fs.mkdirSync(abs, { recursive: true });
  const emotions = Object.keys(catalog.emotions);
  const cell = 300;
  const crop = { boy: '700 460 520 520', dog: '760 600 400 400', bird: '860 720 200 200' };
  const cells = [];
  let row = 0;
  for (const kind of ['boy', 'dog', 'bird']) {
    for (const lv of [1, 2, 3]) {
      emotions.forEach((e, col) => {
        const s = stuntScript(kind);
        s.scenes[0].cast = [{ who: 'x', at: 'center' }];
        s.scenes[0].beats = [{ actor: 'x', emotion: e, intensity: lv, duration: 2 }];
        const tree = renderStill(catalog, s, 'one', 0.6, 0.6);
        cells.push(h('svg', { x: String(col * cell), y: String(40 + row * (cell + 30)), width: String(cell), height: String(cell), viewBox: crop[kind] }, [tree]));
        cells.push(h('text', { x: String(col * cell + 8), y: String(40 + row * (cell + 30) + cell + 22), 'font-size': '20', fill: '#1F1D2B' }, [kind + ' ' + e + ' ' + lv]));
      });
      row++;
    }
  }
  // the last pose of every fall (A69): every head shape and hairstyle, and the animals; then bent elbows
  // and knees (A72)
  const extra = [];
  const set = catalog.attributeSets.person;
  const heads = Object.keys(set.head.values);
  const hairs = Object.keys(set.hair.values);
  for (const v of Object.keys(catalog.actions.fall.variants)) {
    hairs.forEach((hair, i) => extra.push({ kind: i % 2 ? 'girl' : 'boy', look: { head: heads[i % heads.length], hair }, action: 'fall', variant: v, p: 1, tag: 'fall.' + v + ' ' + heads[i % heads.length] + '/' + hair }));
    for (const kind of ['dog', 'cat', 'bird']) extra.push({ kind, look: {}, action: 'fall', variant: v, p: 1, tag: kind + ' fall.' + v });
  }
  for (const [kind, action, variant, p] of [['boy', 'run', 'normal', 0.5], ['girl', 'jump', 'normal', 0.12], ['man', 'sit', 'flop', 1], ['boy', 'pick_up', 'normal', 0.5],
    ['dog', 'sit', 'normal', 1], ['dog', 'jump', 'normal', 0.12], ['cat', 'run', 'normal', 0.5], ['bird', 'walk', 'sneak', 0.5], ['bird', 'sit', 'normal', 1]]) {
    extra.push({ kind, look: {}, action, variant, p, tag: kind + ' ' + action + '.' + variant + ' (bent)' });
  }
  extra.forEach((e, i) => {
    const col = i % emotions.length;
    if (col === 0) row++;
    const y = 40 + (row - 1) * (cell + 30);
    cells.push(h('svg', { x: String(col * cell), y: String(y), width: String(cell), height: String(cell), viewBox: '360 380 1200 700' }, [poseCell(e.kind, e.look, e.action, e.variant, e.p)]));
    cells.push(h('text', { x: String(col * cell + 8), y: String(y + cell + 22), 'font-size': '16', fill: '#1F1D2B' }, [e.tag]));
  });
  const svg = h('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 ' + emotions.length * cell + ' ' + (40 + row * (cell + 30)), width: String(emotions.length * cell), height: String(40 + row * (cell + 30)) },
    [h('rect', { x: '0', y: '0', width: '100%', height: '100%', fill: '#FFFFFF' }), h('text', { x: '8', y: '28', 'font-size': '24', fill: '#1F1D2B' }, ['TCIA emotion sheet: 6 emotions x 3 intensities x 3 rigs; last pose of every fall; bent elbows and knees'])].concat(cells));
  fs.writeFileSync(path.join(abs, 'tcia-emotion-sheet.svg'), serialize(svg));
  fs.writeFileSync(path.join(abs, 'tcia-emotion-sheet.html'), '<!doctype html><html><body style="margin:0">' + serialize(svg) + '</body></html>');
});

test('A74: one facet contrast, printed; facet tones sit between the base and the palette\'s light and shade', (t) => {
  t.diagnostic('FACET_CONTRAST = ' + FACET_CONTRAST + ' (0 = one flat fill per part, 1 = the palette tones as they are)');
  assert.ok(FACET_CONTRAST >= 0 && FACET_CONTRAST <= 1);
  const rgb = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const between = (x, a, b) => x >= Math.min(a, b) - 1 && x <= Math.max(a, b) + 1;
  let n = 0;
  for (const group of Object.values(catalog.palettes)) {
    for (const entry of Object.values(group)) {
      const tones = entry.tones;
      if (!Array.isArray(tones) || tones.length !== 3) continue;
      n++;
      for (const i of [0, 2]) {
        const f = rgb(facetTone(tones, i));
        const base = rgb(tones[1]);
        const edge = rgb(tones[i]);
        for (let c = 0; c < 3; c++) assert.ok(between(f[c], base[c], edge[c]), tones.join(',') + ' tone ' + i);
        assert.equal(facetTone(tones, i), mix(tones[1], tones[i], FACET_CONTRAST));
      }
      withFacetContrast(0, () => { assert.equal(facetTone(tones, 0), tones[1]); assert.equal(facetTone(tones, 2), tones[1]); });
    }
  }
  assert.ok(n > 20, 'palette triples checked');
});

test('A74: drawn with contrast 0, every part has one fill per shape (no facets); with FACET_CONTRAST, the facets come back', () => {
  const count = (tree) => { let f = 0; walk(tree, (nd) => { if (nd.facet) f++; }); return f; };
  const flat = withFacetContrast(0, () => drawAll(catalog));
  let facetsFlat = 0;
  for (const d of flat) {
    if (!d.tree) continue;
    facetsFlat += count(d.tree);
    // every part: as many fills as silhouettes of different tone, nothing more
    walk(d.tree, (nd) => {
      if (nd.tag !== 'g' || nd.attrs['data-part'] === undefined) return;
      const shapes = nd.children.filter((c) => c && typeof c === 'object' && c.tag === 'polygon' && c.attrs.fill && c.attrs.fill !== 'none');
      for (const c of shapes) assert.ok(!c.facet, d.id + ': a facet drawn with contrast 0');
    });
  }
  assert.equal(facetsFlat, 0);
  const full = drawAll(catalog).reduce((a, d) => a + (d.tree ? count(d.tree) : 0), 0);
  if (FACET_CONTRAST > 0) assert.ok(full > 100, 'facets with FACET_CONTRAST');
});

test('A74: round parts have 16 vertices or more (no polygon that sits on an ellipse has fewer)', () => {
  const errs = [];
  const roundish = (points) => {
    const P = String(points).trim().split(/\s+/).map((q) => q.split(',').map(Number));
    if (P.length < 6) return null;
    let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
    for (const [x, y] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const rx = (x1 - x0) / 2; const ry = (y1 - y0) / 2;
    if (rx < 1 || ry < 1) return null;
    let dev = 0;
    for (const [x, y] of P) dev = Math.max(dev, Math.abs(Math.hypot((x - (x0 + rx)) / rx, (y - (y0 + ry)) / ry) - 1));
    return dev < 0.06 ? P.length : null;
  };
  const check = (tree, where) => walk(tree, (nd) => {
    if (nd.tag !== 'polygon') return;
    const n = roundish(nd.attrs.points);
    if (n !== null && n < 16) errs.push(where + ': a round shape with ' + n + ' vertices');
  });
  for (const d of drawAll(catalog)) if (d.tree) check(d.tree, d.id);
  for (const s of allScripts().slice(0, 6)) {
    const story = prepare(s.script, catalog);
    for (const id of Object.keys(story.scenes)) check(buildSceneView(story, id).tree, s.name + ':' + id);
  }
  assert.deepEqual(errs.slice(0, 10), []);
});

test('A61: the data-fx values drawn are exactly dust, speed_lines, dizzy, skid and the catalog effects', () => {
  for (const d of drawAll(catalog)) for (const x of fxValues(d.tree)) fxSeen.add(x);
  if (!fxSeen.size) {
    // A38 ran in another process order: collect from the contract example again
    for (const s of allScripts().slice(0, 1)) {
      const story = prepare(s.script, catalog);
      for (const id of Object.keys(story.scenes)) for (const x of fxValues(buildSceneView(story, id).tree)) fxSeen.add(x);
    }
  }
  const want = new Set(['dust', 'speed_lines', 'dizzy', 'skid'].concat(Object.keys(catalog.effects)));
  assert.deepEqual([...fxSeen].sort(), [...want].sort());
});

// Frame by frame over every path, for the composition and fluidity tests.
// A frame depends only on its scene, the time inside the scene and the clock. Paths that share their
// first choices play the same scenes with the same clock, so each distinct play is drawn once.
import { createPlayer } from '../../../engine/src/core.mjs';
import { buildSceneView } from '../../../engine/src/draw/scene.mjs';
import { walkTree, measure } from '../../../engine/src/draw/svg.mjs';
import { combos } from './load.mjs';

// onFrame(frame, view, upd, play) for every frame of every distinct scene play, stepping the Player by dt.
// A new view is built for every play, as the page does when it mounts a scene.
export function eachPlayFrame(story, dt, onFrame, opts) {
  const o = opts || {};
  const seen = new Set();
  let plays = 0;
  for (const picks of combos(story)) {
    const p = createPlayer(story);
    p.start();
    let k = 0;
    let cur = null;
    let guard = 0;
    while (p.state !== 'ended' && guard++ < 1e6) {
      if (p.state === 'deciding') { p.choose(picks[k++] || 0); continue; }
      p.advance(dt);
      const f = p.frame();
      if (!cur || cur.sceneId !== f.sceneId) {
        const key = f.sceneId + '@' + f.clock.toFixed(6) + '@' + f.t.toFixed(6);
        cur = { sceneId: f.sceneId, skip: seen.has(key), view: null, index: plays };
        seen.add(key);
        if (!cur.skip) {
          plays++;
          cur.view = buildSceneView(story, f.sceneId);
          if (o.joints) cur.view.trackJoints = true;
        }
      }
      if (cur.skip) continue;
      const upd = cur.view.update(f);
      onFrame(f, cur.view, upd, cur);
    }
  }
  return plays;
}

export function findKey(tree, key) {
  let found = null;
  walkTree(tree, (n) => { if (!found && n.k === key) found = n; });
  return found;
}

const I = [1, 0, 0, 1, 0, 0];

// width and height of the visible eyes and mouth of a character, in its own drawing units
export function faceSizes(view, id, upd) {
  const sv = view.actors[id];
  const rv = upd[sv.key + ':R:ver'];
  const ver = rv && rv.display === 'none' ? 'L' : 'R';
  const pre = sv.key + ':' + ver + ':';
  const face = sv.need.faces.find((f) => upd[pre + 'face:' + f] && upd[pre + 'face:' + f].display === null);
  const out = { face };
  if (!face) return out;
  for (const part of ['eyes', 'mouth']) {
    const key = pre + part + ':' + face;
    const u = upd[key];
    if (u && u.display === 'none') continue;
    const node = findKey(sv.view.tree, key);
    if (!node) continue;
    const m = measure(node, I, upd);
    if (m.box) out[part] = [m.box[2] - m.box[0], m.box[3] - m.box[1]];
  }
  return out;
}

// One character crosses the stage with every walk and run variant, turning round between beats.
export function gaitScript(kind) {
  const B = (o) => Object.assign({ actor: 'x' }, o);
  const one = (id) => [{ id, set: 's', cast: [{ who: 'x', at: 'center' }], beats: [B({ emotion: 'happy' })] }];
  return {
    tcia: 1, meta: { title: 'Gaits', slug: 'gaits-' + kind, lang: 'en', light: 'day' },
    characters: [{ id: 'x', name: 'X', kind }],
    sets: [{ id: 's', base: 'plain' }],
    scenes: [{ id: 'one', set: 's', cast: [{ who: 'x', at: 'far_left', facing: 'right' }], beats: [
      B({ action: 'walk', to: 'center_right' }), B({ action: 'walk', variant: 'sneak', to: 'left' }),
      B({ action: 'walk', variant: 'strut', to: 'right', emotion: 'angry', intensity: 3 }), B({ action: 'walk', variant: 'stomp', to: 'far_left' }),
      B({ action: 'run', to: 'far_right', emotion: 'scared', intensity: 3 }), B({ action: 'run', variant: 'dash', to: 'far_left' }),
      B({ action: 'run', variant: 'panic', to: 'center' })
    ] }].concat(one('two')),
    decisions: [{ id: 'd1', after: 'one', options: [{ id: 'a', label: 'A', rejoin: 'two' }, { id: 'b', label: 'B', rejoin: 'two' }] },
      { id: 'd2', after: 'two', options: [{ id: 'a', label: 'A', rejoin: '@endings' }, { id: 'b', label: 'B', rejoin: '@endings' }] }],
    endings: [{ id: 'e1', title: 'E1', when: { choice: 'd1', is: 'a' }, scenes: one('e1s') },
      { id: 'e2', title: 'E2', when: { choice: 'd2', is: 'a' }, scenes: one('e2s') },
      { id: 'e3', title: 'E3', scenes: one('e3s') }]
  };
}

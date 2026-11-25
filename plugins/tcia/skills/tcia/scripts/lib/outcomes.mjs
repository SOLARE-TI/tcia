// outcomes(script, catalog) -> [{ choices, ending, seconds }] (D10.6).
// Same shape and order as the engine's outcomes() (D14). Expects a script that
// already passed validation.

import { combinations, endingFor, pathScenes } from './flow.mjs';
import { simulateScene } from './simulate.mjs';
import { round3 } from './text.mjs';

export function sceneSecondsMap(script, catalog) {
  const map = new Map();
  const add = (scene) => map.set(scene.id, simulateScene(scene, '', catalog).seconds);
  script.scenes.forEach(add);
  for (const d of script.decisions) for (const o of d.options) (o.scenes || []).forEach(add);
  for (const e of script.endings) e.scenes.forEach(add);
  return map;
}

export function outcomes(script, catalog) {
  const seconds = sceneSecondsMap(script, catalog);
  const fade = catalog.timing.sceneFadeSeconds;
  return combinations(script).map(({ picks, choices, vars }) => {
    const index = endingFor(script, { choices, vars });
    const total = pathScenes(script, picks, index).reduce((sum, s) => sum + seconds.get(s.id) + 2 * fade, 0);
    return {
      choices,
      ending: index >= 0 ? script.endings[index].id : null,
      seconds: round3(total),
    };
  });
}

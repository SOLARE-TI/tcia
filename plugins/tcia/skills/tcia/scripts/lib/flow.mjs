// Story flow: decisions in story order, every combination of choices,
// conditions and the ending each combination reaches (D7).

export const ENDINGS_MARK = '@endings';

// Decisions sorted by the position of their `after` scene in the main column.
export function decisionsInStoryOrder(script) {
  const index = new Map(script.scenes.map((s, i) => [s.id, i]));
  return script.decisions
    .map((d, i) => ({ d, i }))
    .sort((a, b) => (index.get(a.d.after) ?? Infinity) - (index.get(b.d.after) ?? Infinity) || a.i - b.i)
    .map((x) => x.d);
}

// Every combination, first decision varying slowest (D10.5 order).
export function combinations(script) {
  const decisions = decisionsInStoryOrder(script);
  let combos = [[]];
  for (const d of decisions) {
    const next = [];
    for (const combo of combos) for (const o of d.options) next.push([...combo, { d, o }]);
    combos = next;
  }
  return combos.map((picks) => {
    const choices = {};
    const vars = {};
    for (const v of script.state || []) vars[v.var] = v.initial;
    for (const { d, o } of picks) {
      choices[d.id] = o.id;
      for (const e of o.effects || []) vars[e.var] = (vars[e.var] ?? 0) + e.add;
    }
    return { picks, choices, vars };
  });
}

export function evalCondition(cond, state) {
  if (cond === undefined) return true;
  if ('choice' in cond) return state.choices[cond.choice] === cond.is;
  if ('var' in cond) {
    const x = state.vars[cond.var];
    switch (cond.op) {
      case '==': return x === cond.value;
      case '!=': return x !== cond.value;
      case '>=': return x >= cond.value;
      case '<=': return x <= cond.value;
      case '>': return x > cond.value;
      case '<': return x < cond.value;
      default: throw new TypeError(`Unknown operator ${cond.op}`);
    }
  }
  if ('all' in cond) return cond.all.every((c) => evalCondition(c, state));
  if ('any' in cond) return cond.any.some((c) => evalCondition(c, state));
  if ('not' in cond) return !evalCondition(cond.not, state);
  throw new TypeError('Unknown condition');
}

// Index of the first ending whose `when` holds, or -1.
export function endingFor(script, state) {
  return script.endings.findIndex((e) => evalCondition(e.when, state));
}

// Scenes played for one combination: main scenes, the branch scenes of each
// chosen option right after its decision's scene, then the ending's scenes.
export function pathScenes(script, picks, endingIndex) {
  const byAfter = new Map(picks.map((p) => [p.d.after, p.o]));
  const list = [];
  for (const scene of script.scenes) {
    list.push(scene);
    const option = byAfter.get(scene.id);
    if (option) list.push(...(option.scenes || []));
  }
  if (endingIndex >= 0) list.push(...script.endings[endingIndex].scenes);
  return list;
}

export function describeChoices(choices) {
  return Object.entries(choices).map(([d, o]) => `${d}=${o}`).join(', ');
}

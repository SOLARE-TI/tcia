// Every error code of D10.3 has a bad fixture that produces it at the path
// of its .expect.json (A18), plus the count, path, balloon and rejoin
// criteria (A21-A24) and the warnings.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate, validateSource } from '../../plugins/tcia/skills/tcia/scripts/lib/validate.mjs';
import { catalog, schema, example, readJson } from './helpers.mjs';

const BAD = fileURLToPath(new URL('./fixtures/bad/', import.meta.url));
const GOOD = fileURLToPath(new URL('./fixtures/good/', import.meta.url));

// The codes of D10.3, written here on purpose (not imported) so that the test
// fails if the validator drops one.
const D10_CODES = [
  'E_USAGE', 'E_NODE_VERSION', 'E_JSON', 'E_FORMAT', 'E_SCHEMA',
  'E_COUNT_SCENES', 'E_COUNT_DECISIONS', 'E_COUNT_OPTIONS', 'E_COUNT_ENDINGS',
  'E_DUPLICATE_ID', 'E_ID_CLASH', 'E_REF', 'E_CATALOG', 'E_LOOK_KEY', 'E_PIECE',
  'E_LIGHT_BASE', 'E_UI_MISSING', 'E_TEXT_LENGTH', 'E_TEXT_BLANK', 'E_BALLOON_LENGTH',
  'E_BALLOON_WORD', 'E_BALLOON_LINES', 'E_BEAT_EMPTY', 'E_REACTION', 'E_PARAM',
  'E_DURATION', 'E_TARGET', 'E_POSITION_SHARED', 'E_OFFSTAGE', 'E_MOVE', 'E_DISTANCE',
  'E_ITEM', 'E_POSTURE', 'E_TOGETHER', 'E_DECISION_AFTER', 'E_DECISION_ORDER',
  'E_REJOIN', 'E_WHEN_MISSING', 'E_NO_ENDING', 'E_UNREACHABLE_ENDING',
];
const CLI_ONLY = new Set(['E_USAGE', 'E_NODE_VERSION']);

const opts = { catalog, schema };
const run = (script) => validate(script, opts);
const codes = (result) => result.errors.map((e) => e.code);
const find = (result, code) => result.errors.find((e) => e.code === code);

const badFixtures = fs.readdirSync(BAD).filter((f) => f.endsWith('.tcia.json')).sort();

test('every D10.3 code (except E_USAGE and E_NODE_VERSION) has a bad fixture', () => {
  const covered = new Set(badFixtures.map((f) => f.split('__')[0]));
  const missing = D10_CODES.filter((c) => !CLI_ONLY.has(c) && !covered.has(c));
  assert.deepEqual(missing, [], `codes without fixture: ${missing.join(', ')}`);
  for (const f of badFixtures) {
    assert.ok(D10_CODES.includes(f.split('__')[0]), `${f}: unknown code in file name`);
    assert.ok(fs.existsSync(path.join(BAD, f.replace('.tcia.json', '.expect.json'))), `${f}: missing .expect.json`);
  }
});

for (const file of badFixtures) {
  test(`bad fixture ${file}`, () => {
    const expect = readJson(path.join(BAD, file.replace('.tcia.json', '.expect.json')));
    const result = validateSource(fs.readFileSync(path.join(BAD, file), 'utf8'), opts);
    assert.equal(result.ok, false);
    assert.equal(result.stats, null);
    const hit = result.errors.find((e) => e.code === expect.code && e.path === expect.path);
    assert.ok(hit, `expected ${expect.code} at "${expect.path}", got:\n` +
      result.errors.map((e) => `${e.code} ${e.path} ${e.message}`).join('\n'));
    for (const e of result.errors) {
      assert.deepEqual(Object.keys(e), ['code', 'path', 'message', 'suggestion', 'approximation']);
    }
  });
}

test('errors come out in document order', () => {
  const s = example();
  s.endings[0].title = '   ';
  s.characters[0].name = '   ';
  s.scenes[1].beats[0].action = 'flyy';
  const r = run(s);
  assert.deepEqual(r.errors.map((e) => e.path), ['/characters/0/name', '/scenes/1/beats/0/action', '/endings/0/title']);
});

test('schema errors stop the semantic phases', () => {
  const s = example();
  s.meta.subtitle = 'x';
  s.scenes[0].set = 'nowhere';
  const r = run(s);
  assert.deepEqual(codes(r), ['E_SCHEMA']);
});

test('E_SCHEMA messages follow V5', () => {
  const s = example();
  delete s.meta.slug;
  s.meta.lang = 'eng';
  s.characters[0].look.titel = 'x';
  s.scenes[0].beats[0].duration = 'long';
  s.scenes[0].beats[1].intensity = 5;
  s.scenes[0].cast[0].facing = 'up';
  s.scenes[0].beats[2].say = '';
  s.notes.invented = new Array(51).fill('x');
  const r = run(s);
  const messages = r.errors.map((e) => e.message);
  assert.ok(messages.includes('/meta: missing required field "slug".'));
  assert.ok(messages.some((m) => m.startsWith('/meta/lang: "eng" has the wrong format (Language of balloons')));
  assert.ok(messages.includes('/characters/0/look: unknown field "titel".'));
  assert.ok(messages.includes('/scenes/0/beats/0/duration: expected number, got string.'));
  assert.ok(messages.includes('/scenes/0/beats/1/intensity: must be between 1 and 3 (is 5).'));
  assert.ok(messages.includes('/scenes/0/cast/0/facing: must be one of "left", "right".'));
  assert.ok(messages.includes('/scenes/0/beats/2/say: text must have 1 or more characters (has 0).'));
  assert.ok(messages.includes('/notes/invented: must have 0–50 items (has 51).'));
  assert.ok(r.errors.every((e) => e.code === 'E_SCHEMA'));
});

test('unknown field suggests the closest allowed field', () => {
  const s = example();
  s.meta.titel = s.meta.title;
  delete s.meta.title;
  const r = run(s);
  const e = r.errors.find((x) => x.message.includes('unknown field'));
  assert.equal(e.suggestion, 'title');
  assert.match(e.message, /Did you mean "title"\?$/);
});

// A21
test('A21: scene, decision, option and ending counts', () => {
  const cases = [];
  {
    const s = example();
    s.decisions = [s.decisions[0]];
    cases.push([s, 'E_COUNT_DECISIONS', 'The story has 1 decisions; it needs 2 or 3.']);
  }
  {
    const s = example();
    s.decisions = [s.decisions[0], s.decisions[1], s.decisions[1], s.decisions[1]];
    cases.push([s, 'E_COUNT_DECISIONS', 'The story has 4 decisions; it needs 2 or 3.']);
  }
  {
    const s = example();
    s.decisions[0].options = [s.decisions[0].options[0]];
    cases.push([s, 'E_COUNT_OPTIONS', 'Decision d1 has 1 options; it needs 2 or 3.']);
  }
  {
    const s = example();
    const o = s.decisions[1].options;
    s.decisions[1].options = [o[0], o[1], { ...o[1], id: 'x' }, { ...o[1], id: 'y' }];
    cases.push([s, 'E_COUNT_OPTIONS', 'Decision d2 has 4 options; it needs 2 or 3.']);
  }
  {
    const s = example();
    s.endings = s.endings.slice(1);
    cases.push([s, 'E_COUNT_ENDINGS', 'The story has 2 endings; it needs 3 or 4.']);
  }
  {
    const s = example();
    const e = s.endings[2];
    s.endings.push({ ...e, id: 'e4' }, { ...e, id: 'e5' });
    cases.push([s, 'E_COUNT_ENDINGS', 'The story has 5 endings; it needs 3 or 4.']);
  }
  {
    const s = example();
    s.scenes = [s.scenes[0]];
    cases.push([s, 'E_COUNT_SCENES',
      'The main column has 1 scenes; it needs 2 to 12. Main scenes come from the user: ask them, do not add or remove scenes.']);
  }
  {
    const s = example();
    for (let i = 0; i < 11; i++) s.scenes.push({ ...s.scenes[1], id: `extra_${i}` });
    cases.push([s, 'E_COUNT_SCENES',
      'The main column has 13 scenes; it needs 2 to 12. Main scenes come from the user: ask them, do not add or remove scenes.']);
  }
  for (const [s, code, message] of cases) {
    const e = find(run(s), code);
    assert.ok(e, `${code} expected`);
    assert.equal(e.message, message);
  }
});

// A22
test('A22: a 3x3x3 script has 27 paths and 27 outcomes', () => {
  const r = run(readJson(path.join(GOOD, 'three-by-three.tcia.json')));
  assert.equal(r.ok, true);
  assert.equal(r.stats.paths, 27);
  assert.equal(r.stats.outcomes.length, 27);
  assert.deepEqual(r.stats.outcomes[0].choices, { d1: 'a', d2: 'a', d3: 'a' });
  assert.deepEqual(r.stats.outcomes[1].choices, { d1: 'a', d2: 'a', d3: 'b' });
  assert.deepEqual(r.stats.outcomes[26].choices, { d1: 'c', d2: 'c', d3: 'c' });
  const reach = Object.values(r.stats.endingsReach).reduce((a, b) => a + b, 0);
  assert.equal(reach, 27);
});

test('A22: an ending covered by an earlier one is unreachable', () => {
  const s = example();
  s.endings[1].when = { var: 'bold', op: '>=', value: 0 };
  const e = find(run(s), 'E_UNREACHABLE_ENDING');
  assert.equal(e.path, '/endings/2');
  assert.equal(e.message, 'Ending "buddies" is never shown: every combination that satisfies it is taken by an earlier ending (legend, brave).');
});

test('A22: an ending no combination satisfies is unreachable', () => {
  const s = example();
  s.endings[0].when = { all: [{ choice: 'd1', is: 'flip' }, { choice: 'd1', is: 'safe' }] };
  const e = find(run(s), 'E_UNREACHABLE_ENDING');
  assert.equal(e.message, 'Ending "legend" is never shown: no combination satisfies it.');
});

test('A22: a combination without an ending is named in the message', () => {
  const s = example();
  s.endings[2].when = { choice: 'd2', is: 'again' };
  const r = run(s);
  const lost = r.errors.filter((e) => e.code === 'E_NO_ENDING');
  assert.equal(lost.length, 1);
  assert.equal(lost[0].message,
    'Choices d1=safe, d2=rest reach no ending. Make the last ending unconditional or widen a condition.');
});

test('E_NO_ENDING lists at most 10 combinations', () => {
  const s = readJson(path.join(GOOD, 'three-by-three.tcia.json'));
  s.endings[0].when = { all: [{ choice: 'd1', is: 'a' }, { choice: 'd2', is: 'a' }, { choice: 'd3', is: 'a' }] };
  s.endings[1].when = { all: [{ choice: 'd1', is: 'a' }, { choice: 'd2', is: 'a' }, { choice: 'd3', is: 'b' }] };
  s.endings[2].when = { all: [{ choice: 'd1', is: 'a' }, { choice: 'd2', is: 'a' }, { choice: 'd3', is: 'c' }] };
  s.endings[3].when = { all: [{ choice: 'd1', is: 'a' }, { choice: 'd2', is: 'b' }, { choice: 'd3', is: 'a' }] };
  const lost = run(s).errors.filter((e) => e.code === 'E_NO_ENDING');
  assert.equal(lost.length, 11);
  assert.equal(lost[10].message, '…and 13 more combinations.');
});

// A23
test('A23: balloon limits', () => {
  const say80 = 'Rocky, today I jump the ramp, then the bench, then the fence and then the moon!!';
  assert.equal([...say80].length, 80);
  const ok = example();
  ok.scenes[0].beats[0].say = say80;
  assert.equal(run(ok).ok, true);

  const long = example();
  long.scenes[0].beats[0].say = say80 + '!';
  assert.equal(find(run(long), 'E_BALLOON_LENGTH').message,
    '/scenes/0/beats/0/say: balloon has 81 characters; the maximum is 80. Split it into two beats.');

  const word = example();
  word.scenes[0].beats[0].say = 'Look: abcdefghijklmnopqrstuvwxy';
  assert.equal(find(run(word), 'E_BALLOON_WORD').message,
    '/scenes/0/beats/0/say: the word "abcdefghijklmnopqrstuvwxy" has 25 characters; balloon lines hold 24. Use a shorter word.');

  const lines = example();
  lines.scenes[0].beats[0].say = 'Unbelievable! Unbelievable! Unbelievable! Unbelievable! Unbelievable!';
  assert.ok([...lines.scenes[0].beats[0].say].length <= 80);
  assert.equal(find(run(lines), 'E_BALLOON_LINES').message,
    '/scenes/0/beats/0/say: balloon needs 5 lines; the maximum is 4. Shorten it.');
});

// A24
test('A24: a branch must rejoin at the next main scene', () => {
  const s = example();
  s.decisions[0].options[0].rejoin = 'warmup';
  const e = find(run(s), 'E_REJOIN');
  assert.equal(e.path, '/decisions/0/options/0/rejoin');
  assert.equal(e.message,
    '/decisions/0/options/0/rejoin: option "d1.flip" must rejoin at "the_jump", not "warmup". Branches always return to the next main scene, or to @endings after the last one.');
});

test('A24: after the last main scene only @endings is valid', () => {
  const s = example();
  s.decisions[1].options[1].rejoin = 'the_jump';
  const e = find(run(s), 'E_REJOIN');
  assert.match(e.message, /must rejoin at "@endings", not "the_jump"/);
  const t = example();
  t.decisions[0].options[1].rejoin = '@endings';
  assert.match(find(run(t), 'E_REJOIN').message, /must rejoin at "the_jump", not "@endings"/);
});

test('decision rules: one per main scene, story order', () => {
  const s = example();
  s.decisions[1].after = 'warmup';
  s.decisions[1].options.forEach((o) => { o.rejoin = 'the_jump'; });
  const e = find(run(s), 'E_DECISION_AFTER');
  assert.equal(e.message, '/decisions/1/after: two decisions follow "warmup"; only one is allowed per main scene.');
  const t = example();
  t.decisions[1].after = 'end_brave';
  assert.match(find(run(t), 'E_DECISION_AFTER').message, /"end_brave" is an ending scene\.$/);
});

test('parameters, targets and reactions', () => {
  const s = example();
  s.scenes[0].beats.push(
    { actor: 'nico', action: 'point', variant: 'up', target: 'rocky' },
    { actor: 'nico', action: 'jump', variant: 'cartwheel' },
    { actor: 'nico', action: 'talk', target: 'center', say: 'Hi' },
    { actor: 'nico', action: 'wave', height: 'low' },
    { actor: 'rocky', emotion: 'sad', target: 'far_left', to: 'left' },
  );
  const r = run(s);
  const msgs = r.errors.map((e) => e.message);
  assert.ok(msgs.includes('/scenes/0/beats/4/target: action "point" with variant "up" does not take "target".'));
  assert.ok(msgs.includes('/scenes/0/beats/5: action "jump" with variant "cartwheel" requires "to".'));
  assert.ok(msgs.includes('/scenes/0/beats/6/target: target of "talk" must be a character.'));
  assert.ok(msgs.includes('/scenes/0/beats/7/height: action "wave" does not take "height".'));
  assert.ok(msgs.includes('/scenes/0/beats/8/to: a reaction beat (no action) only accepts emotion, intensity, target, duration and together; remove "to".'));
});

test('references suggest the closest known id', () => {
  const s = example();
  s.scenes[0].beats[0].target = 'rokcy';
  s.decisions[0].after = 'warmpu';
  const r = run(s);
  const t = r.errors.find((e) => e.path === '/scenes/0/beats/0/target');
  assert.equal(t.code, 'E_REF');
  assert.equal(t.suggestion, 'rocky');
  assert.match(t.message, /^\/scenes\/0\/beats\/0\/target: "rokcy" is not a cast member of this scene or position \(known: nico, rocky, offstage_left, far_left, left, center_left, center, center_right, …\)\. Did you mean "rocky"\?$/);
  const a = r.errors.find((e) => e.path === '/decisions/0/after');
  assert.equal(a.suggestion, 'warmup');
});

test('stage simulation: occupancy, posture, items and distance', () => {
  const s = example();
  // Nico jumps onto Rocky's mark.
  s.scenes[0].beats.push({ actor: 'nico', action: 'jump', to: 'center_left' });
  assert.equal(find(run(s), 'E_POSITION_SHARED').message, 'warmup: "rocky" and "nico" are both at "center_left" after beat 4.');

  const h = example();
  h.endings[1].scenes[0].cast[1].posture = 'sitting';
  assert.equal(find(run(h), 'E_POSTURE').message, '/endings/1/scenes/0/beats/0/target: "rocky" must be standing for "hug".');

  const p = example();
  p.scenes[1].items = [{ id: 'cup', item: 'cup', at: 'far_right' }];
  p.scenes[1].beats.push({ actor: 'rocky', action: 'pick_up', item: 'cup' });
  assert.equal(find(run(p), 'E_ITEM').message, '/scenes/1/beats/4/item: item "cup" is not on the ground at "center_left".');
});

test('together: one beat per character and one balloon per group', () => {
  const s = example();
  s.scenes[0].beats[2].together = true;
  const e = run(s).errors.filter((x) => x.code === 'E_TOGETHER');
  assert.equal(e.length, 1);
  assert.equal(e[0].message, '/scenes/0/beats/2: "rocky" takes part in two beats of the same group (beats 1 and 2).');
  const b = example();
  b.scenes[0].beats[1].together = true;
  b.scenes[0].beats[1].say = 'Woof!';
  assert.equal(find(run(b), 'E_TOGETHER').message, '/scenes/0/beats/1/say: only one beat per group may have a balloon.');
});

test('indoor light needs a room, also when inherited from meta.light', () => {
  const s = example();
  s.meta.light = 'indoor';
  const e = run(s).errors.filter((x) => x.code === 'E_LIGHT_BASE');
  assert.ok(e.length >= 1);
  assert.equal(e[0].path, '/scenes/0');
  assert.equal(e[0].message, '/scenes/0: light "indoor" only works in base "room"; set "park" uses base "park". Use day, sunset or dusk.');
});

test('warnings do not block: unused character, set and variable, ignored attribute', () => {
  const s = example();
  s.characters.push({ id: 'gran', name: 'Gran', kind: 'old_woman', look: { bottom_color: 'red' } });
  s.sets.push({ id: 'beach', base: 'beach' });
  s.state.push({ var: 'luck', initial: 0 });
  const r = run(s);
  assert.equal(r.ok, true);
  assert.deepEqual(r.warnings.map((w) => [w.code, w.path, w.message]), [
    ['W_UNUSED_VAR', '/state/1', 'State variable "luck" is never changed.'],
    ['W_UNUSED_VAR', '/state/1', 'State variable "luck" is never tested.'],
    ['W_UNUSED_CHARACTER', '/characters/2', 'Character "gran" appears in no scene.'],
    ['W_IGNORED_ATTR', '/characters/2/look/bottom_color', '/characters/2/look/bottom_color: bottom_color is ignored with outfit "dress".'],
    ['W_UNUSED_SET', '/sets/1', 'Set "beach" is used by no scene.'],
  ]);
  for (const w of r.warnings) assert.deepEqual(Object.keys(w), ['code', 'path', 'message']);
});

test('W_LONG_PATH when a path lasts more than 360 s', () => {
  const s = example();
  const all = [...s.scenes, ...s.decisions[0].options[0].scenes, ...s.endings.flatMap((e) => e.scenes)];
  for (const scene of all) {
    while (scene.beats.length < 24) scene.beats.push({ actor: 'nico', action: 'think', say: 'Hmm.', duration: 7 });
  }
  const r = run(s);
  assert.equal(r.ok, true);
  const w = r.warnings.find((x) => x.code === 'W_LONG_PATH');
  assert.ok(w);
  assert.equal(w.message, `The longest path lasts ${r.stats.secondsMax}s; consider shorter scenes.`);
});

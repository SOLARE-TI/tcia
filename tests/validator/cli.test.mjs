// A25: validate.mjs exit codes and output.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { VALIDATE, EXAMPLE, example, tempDir, writeJson, runNode, lastLine } from './helpers.mjs';

test('valid script: exit 0, last line starts with OK:', () => {
  const r = runNode(VALIDATE, [EXAMPLE]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(lastLine(r.stdout), 'OK: 2 main scenes, 1 branch scene, 2 decisions, 4 paths, 3 endings, 16.855-22.855 s.');
});

test('invalid script: exit 1, findings and FAIL: line', (t) => {
  const dir = tempDir(t);
  const s = example();
  s.decisions[0].options[1].rejoin = 'warmup';
  s.sets.push({ id: 'beach', base: 'beach' });
  const file = writeJson(path.join(dir, 'bad.tcia.json'), s);
  const r = runNode(VALIDATE, [file]);
  assert.equal(r.status, 1);
  const lines = r.stdout.trimEnd().split('\n');
  assert.equal(lines[0], 'ERROR E_REJOIN /decisions/0/options/1/rejoin: option "d1.safe" must rejoin at "the_jump", not "warmup". Branches always return to the next main scene, or to @endings after the last one.');
  assert.equal(lines[1], 'WARN  W_UNUSED_SET /sets/1: Set "beach" is used by no scene.');
  assert.equal(lastLine(r.stdout), 'FAIL: 1 error, 1 warning.');
});

test('suggestion lines', (t) => {
  const dir = tempDir(t);
  const s = example();
  s.scenes[0].set = 'parc';
  const file = writeJson(path.join(dir, 'bad.tcia.json'), s);
  const r = runNode(VALIDATE, [file]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /\n {2}suggestion: park\n/);
});

test('--json: exactly ok, file, errors, warnings, stats', (t) => {
  const ok = runNode(VALIDATE, [EXAMPLE, '--json']);
  assert.equal(ok.status, 0);
  const good = JSON.parse(ok.stdout);
  assert.deepEqual(Object.keys(good), ['ok', 'file', 'errors', 'warnings', 'stats']);
  assert.equal(good.ok, true);
  assert.equal(good.file, EXAMPLE);
  assert.equal(good.stats.paths, 4);

  const dir = tempDir(t);
  const s = example();
  s.scenes[0].beats[0].action = 'wlak';
  const file = writeJson(path.join(dir, 'bad.tcia.json'), s);
  const bad = runNode(VALIDATE, ['--json', file]);
  assert.equal(bad.status, 1);
  const out = JSON.parse(bad.stdout);
  assert.deepEqual(Object.keys(out), ['ok', 'file', 'errors', 'warnings', 'stats']);
  assert.equal(out.ok, false);
  assert.equal(out.stats, null);
  assert.equal(out.errors[0].suggestion, 'walk');
  assert.deepEqual(Object.keys(out.errors[0]), ['code', 'path', 'message', 'suggestion', 'approximation']);
});

test('usage errors exit 2', (t) => {
  const none = runNode(VALIDATE, []);
  assert.equal(none.status, 2);
  assert.match(none.stdout, /E_USAGE Usage: node validate\.mjs <script\.tcia\.json> \[--json\]/);
  assert.match(lastLine(none.stdout), /^FAIL:/);

  const two = runNode(VALIDATE, [EXAMPLE, EXAMPLE]);
  assert.equal(two.status, 2);

  const flag = runNode(VALIDATE, [EXAMPLE, '--yaml']);
  assert.equal(flag.status, 2);

  const dir = tempDir(t);
  const missing = path.join(dir, 'nope.tcia.json');
  const r = runNode(VALIDATE, [missing, '--json']);
  assert.equal(r.status, 2);
  const out = JSON.parse(r.stdout);
  assert.equal(out.errors[0].code, 'E_USAGE');
  assert.equal(out.errors[0].message, `Cannot read ${missing}: no such file`);
});

test('not JSON and wrong format exit 1', (t) => {
  const dir = tempDir(t);
  const a = path.join(dir, 'a.tcia.json');
  fs.writeFileSync(a, '{ nope');
  const ra = runNode(VALIDATE, [a]);
  assert.equal(ra.status, 1);
  assert.match(ra.stdout, /^ERROR E_JSON Not valid JSON: /);
  const b = writeJson(path.join(dir, 'b.tcia.json'), { tcia: 2 });
  const rb = runNode(VALIDATE, [b]);
  assert.equal(rb.status, 1);
  assert.match(rb.stdout, /ERROR E_FORMAT \/tcia: Unsupported format: "tcia" must be 1 \(found 2\)\./);
  const c = writeJson(path.join(dir, 'c.tcia.json'), []);
  assert.match(runNode(VALIDATE, [c]).stdout, /found an array/);
});

test('at most 50 finding lines', (t) => {
  const dir = tempDir(t);
  const s = example();
  s.notes.invented = new Array(50).fill(' ');
  s.characters[0].name = ' ';
  s.meta.title = ' ';
  const file = writeJson(path.join(dir, 'many.tcia.json'), s);
  const r = runNode(VALIDATE, [file]);
  assert.equal(r.status, 1);
  const findings = r.stdout.split('\n').filter((l) => /^(ERROR|WARN)/.test(l));
  assert.equal(findings.length, 50);
  assert.match(r.stdout, /\n…and \d+ more\.\nFAIL: /);
});

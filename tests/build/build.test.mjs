// A27-A31: the builder (D11) and the injection (D12), with the real
// assets/engine.html and with fake engines from fixtures/ through --engine.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inject, scriptJson, countPlaceholders, engineFormat } from '../../plugins/tcia/skills/tcia/scripts/lib/inject.mjs';
import {
  BUILD, EXAMPLE, ENGINE, example, readJson, tempDir, writeJson, runNode,
} from '../validator/helpers.mjs';

const FIX = fileURLToPath(new URL('./fixtures/', import.meta.url));
const ENGINE_OK = path.join(FIX, 'engine-ok.html');
const TRICKY = path.join(FIX, 'tricky.tcia.json');

function scriptBlock(html) {
  const m = /<script type="application\/json" id="tcia-script">([\s\S]*?)<\/script>/.exec(html);
  assert.ok(m, 'tcia-script block');
  return m[1];
}

function assertOffline(html) {
  for (const bad of ['https://', 'src=', 'href=', '@import', 'url(']) {
    assert.equal(html.includes(bad), false, `built HTML contains ${bad}`);
  }
  const http = html.match(/http:\/\/[^\s"'<>)]*/g) || [];
  for (const h of http) assert.equal(h, 'http://www.w3.org/2000/svg', `unexpected ${h}`);
}

function buildExample(t, extra = []) {
  const out = path.join(tempDir(t), 'out');
  const r = runNode(BUILD, [EXAMPLE, '--out', out, ...extra]);
  return { r, out };
}

test('A27: builds the contract example into --out (fake engine)', (t) => {
  const { r, out } = buildExample(t, ['--engine', ENGINE_OK]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const html = path.join(out, 'nico-and-the-ramp.html');
  const json = path.join(out, 'nico-and-the-ramp.tcia.json');
  assert.ok(fs.existsSync(html));
  assert.equal(fs.readFileSync(json, 'utf8'), JSON.stringify(example(), null, 2) + '\n');
  assert.equal(r.stdout, `Built ${html}\nScript ${json}\n`);
  assert.deepEqual(fs.readdirSync(out).sort(), ['nico-and-the-ramp.html', 'nico-and-the-ramp.tcia.json']);
});

test('A27: builds the contract example with the real engine', (t) => {
  const { r, out } = buildExample(t);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(fs.existsSync(path.join(out, 'nico-and-the-ramp.html')));
  assert.ok(fs.existsSync(path.join(out, 'nico-and-the-ramp.tcia.json')));
});

test('A27: an invalid script writes nothing and exits 1', (t) => {
  const dir = tempDir(t);
  const s = example();
  s.decisions[0].options[1].rejoin = 'warmup';
  const file = writeJson(path.join(dir, 'bad.tcia.json'), s);
  const out = path.join(dir, 'out');
  const r = runNode(BUILD, [file, '--out', out, '--engine', ENGINE_OK]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /^ERROR E_REJOIN /);
  assert.match(r.stdout, /\nFAIL: 1 error, 0 warnings\.\n$/);
  assert.equal(fs.existsSync(out), false);
  const j = runNode(BUILD, [file, '--out', out, '--engine', ENGINE_OK, '--json']);
  assert.equal(j.status, 1);
  assert.deepEqual(Object.keys(JSON.parse(j.stdout)), ['ok', 'file', 'errors', 'warnings', 'stats']);
  assert.equal(fs.existsSync(out), false);
});

test('A28: tags, comments, $-patterns and U+2028 survive injection', (t) => {
  const out = path.join(tempDir(t), 'out');
  const r = runNode(BUILD, [TRICKY, '--out', out, '--engine', ENGINE_OK]);
  assert.equal(r.status, 0, r.stdout);
  const html = fs.readFileSync(path.join(out, 'tricky-texts.html'), 'utf8');
  const block = scriptBlock(html);
  assert.deepEqual(JSON.parse(block), readJson(TRICKY));
  assert.equal(block.includes('</script'), false);
  assert.equal(block.includes('<!--'), false);
  assert.equal(block.includes('\u2028'), false);
  assert.equal(block.includes('\u2029'), false);
  assert.ok(block.includes('$\\u0026') && block.includes("$'"), '$-patterns copied literally');
  assert.equal(countPlaceholders(html), 0);
});

test('A29: building twice gives identical bytes', (t) => {
  const a = buildExample(t, ['--engine', ENGINE_OK]);
  const b = buildExample(t, ['--engine', ENGINE_OK]);
  for (const name of ['nico-and-the-ramp.html', 'nico-and-the-ramp.tcia.json']) {
    assert.ok(fs.readFileSync(path.join(a.out, name)).equals(fs.readFileSync(path.join(b.out, name))), name);
  }
});

for (const [file, code, message] of [
  ['engine-no-slot.html', 'E_ENGINE_TEMPLATE', 'Engine template must contain the script placeholder exactly once (found 0).'],
  ['engine-two-slots.html', 'E_ENGINE_TEMPLATE', 'Engine template must contain the script placeholder exactly once (found 2).'],
  ['engine-format-2.html', 'E_ENGINE_FORMAT', 'Engine supports format 2; the script is format 1.'],
]) {
  test(`A30: ${file} -> ${code}, nothing written`, (t) => {
    const { r, out } = buildExample(t, ['--engine', path.join(FIX, file)]);
    assert.equal(r.status, 1);
    assert.equal(r.stdout, `ERROR ${code} ${message}\nFAIL: 1 error, 0 warnings.\n`);
    assert.equal(fs.existsSync(out), false);
  });
}

test('A31: the built HTML asks nothing from the network (fake engine)', (t) => {
  const { r, out } = buildExample(t, ['--engine', ENGINE_OK]);
  assert.equal(r.status, 0);
  assertOffline(fs.readFileSync(path.join(out, 'nico-and-the-ramp.html'), 'utf8'));
});

test('A31: the built HTML asks nothing from the network (real engine)', (t) => {
  const { r, out } = buildExample(t);
  assert.equal(r.status, 0);
  const html = fs.readFileSync(path.join(out, 'nico-and-the-ramp.html'), 'utf8');
  assertOffline(html);
  assert.deepEqual(JSON.parse(scriptBlock(html)), example());
  assert.equal(engineFormat(fs.readFileSync(ENGINE, 'utf8')), '1');
});

test('--json success object', (t) => {
  const { r, out } = buildExample(t, ['--engine', ENGINE_OK, '--json']);
  assert.equal(r.status, 0);
  const j = JSON.parse(r.stdout);
  assert.deepEqual(Object.keys(j), ['ok', 'html', 'script', 'warnings']);
  assert.equal(j.ok, true);
  assert.equal(j.html, path.join(out, 'nico-and-the-ramp.html'));
  assert.equal(j.script, path.join(out, 'nico-and-the-ramp.tcia.json'));
  assert.ok(path.isAbsolute(j.html));
  assert.deepEqual(j.warnings, []);
});

test('without --out it writes next to the script and leaves the script file alone', (t) => {
  const dir = tempDir(t);
  const file = path.join(dir, 'nico-and-the-ramp.tcia.json');
  const compact = JSON.stringify(example());
  fs.writeFileSync(file, compact);
  const r = runNode(BUILD, [file, '--engine', ENGINE_OK]);
  assert.equal(r.status, 0, r.stdout);
  assert.equal(fs.readFileSync(file, 'utf8'), compact);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['nico-and-the-ramp.html', 'nico-and-the-ramp.tcia.json']);
});

test('a script with another name gets a <slug>.tcia.json copy', (t) => {
  const dir = tempDir(t);
  const file = writeJson(path.join(dir, 'draft.tcia.json'), example());
  const r = runNode(BUILD, [file, '--engine', ENGINE_OK]);
  assert.equal(r.status, 0);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['draft.tcia.json', 'nico-and-the-ramp.html', 'nico-and-the-ramp.tcia.json']);
});

test('warnings are printed but do not stop the build', (t) => {
  const dir = tempDir(t);
  const s = example();
  s.sets.push({ id: 'beach', base: 'beach' });
  const file = writeJson(path.join(dir, 'w.tcia.json'), s);
  const r = runNode(BUILD, [file, '--out', path.join(dir, 'out'), '--engine', ENGINE_OK]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^WARN {2}W_UNUSED_SET \/sets\/1: Set "beach" is used by no scene\.\nBuilt /);
});

test('usage errors exit 2', (t) => {
  assert.equal(runNode(BUILD, []).status, 2);
  assert.equal(runNode(BUILD, [EXAMPLE, '--out']).status, 2);
  assert.equal(runNode(BUILD, [EXAMPLE, '--zip']).status, 2);
  const missingEngine = path.join(tempDir(t), 'none.html');
  const r = runNode(BUILD, [EXAMPLE, '--out', path.join(tempDir(t), 'o'), '--engine', missingEngine]);
  assert.equal(r.status, 2);
  assert.match(r.stdout, /E_USAGE Cannot read .*none\.html: no such file/);
});

test('inject(): one placeholder, replaced by a function', () => {
  const html = 'a __TCIA_SCRIPT_JSON__ b';
  assert.equal(inject(html, { s: "$' $` $$ $&" }), `a {"s":"$' $\` $$ $\\u0026"} b`);
  assert.throws(() => inject('none', {}), (e) => e.code === 'E_ENGINE_TEMPLATE');
  assert.equal(scriptJson({ t: '<a>&\u2028\u2029' }), '{"t":"\\u003ca\\u003e\\u0026\\u2028\\u2029"}');
  assert.equal(engineFormat('<meta name="tcia-format" content="1">'), '1');
  assert.equal(engineFormat('<html></html>'), null);
});

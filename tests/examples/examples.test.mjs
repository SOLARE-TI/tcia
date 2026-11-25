// A41-A42: the five examples are complete, in the right languages, valid,
// and their committed HTML is exactly what the builder produces.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VALIDATE, BUILD, EXAMPLES, exampleDirs, exampleScript, tempDir, runNode,
} from '../validator/helpers.mjs';

const FAKE_ENGINE = fileURLToPath(new URL('../build/fixtures/engine-ok.html', import.meta.url));
const slugs = exampleDirs();

// Small stop-word detector for the three languages of the examples.
const WORDS = {
  es: ['el', 'los', 'las', 'y', 'con', 'del', 'escena', 'para', 'su', 'sobre', 'haz', 'crea', 'todos', 'muy'],
  en: ['the', 'and', 'with', 'his', 'to', 'scene', 'of', 'make', 'every', 'this', 'keep'],
  pt: ['o', 'os', 'do', 'da', 'com', 'e', 'cena', 'cenas', 'quero', 'crie', 'são', 'mais', 'cada'],
};
function language(text) {
  const tokens = text.toLowerCase().split(/[^a-záéíóúñãõçâêô]+/u);
  let best = null;
  let bestScore = -1;
  for (const [lang, words] of Object.entries(WORDS)) {
    const score = tokens.filter((t) => words.includes(t)).length;
    if (score > bestScore) {
      best = lang;
      bestScore = score;
    }
  }
  return best;
}

test('A41: exactly 5 example folders, plus rebuild.mjs', () => {
  assert.equal(slugs.length, 5, slugs.join(', '));
  const loose = fs.readdirSync(EXAMPLES, { withFileTypes: true }).filter((d) => !d.isDirectory()).map((d) => d.name);
  assert.deepEqual(loose, ['rebuild.mjs']);
  for (const slug of ['test-people-actions', 'test-animals-places', 'test-flow-max']) assert.ok(slugs.includes(slug), slug);
});

test('A41: each folder has its script and request; slug matches the folder', () => {
  for (const slug of slugs) {
    const dir = path.join(EXAMPLES, slug);
    assert.ok(fs.existsSync(path.join(dir, `${slug}.tcia.json`)), `${slug}.tcia.json`);
    assert.ok(fs.readFileSync(path.join(dir, 'request.txt'), 'utf8').trim().length > 0, `${slug}/request.txt`);
    assert.equal(exampleScript(slug).meta.slug, slug);
    const extra = fs.readdirSync(dir).filter((f) => ![`${slug}.tcia.json`, `${slug}.html`, 'request.txt'].includes(f));
    assert.deepEqual(extra, [], `${slug}: unexpected files`);
  }
});

test('A41: each folder has its built HTML', () => {
  for (const slug of slugs) assert.ok(fs.existsSync(path.join(EXAMPLES, slug, `${slug}.html`)), `${slug}.html`);
});

test('A41: languages: two es, two en, one pt with meta.ui; requests in the same language', () => {
  const langs = slugs.map((slug) => exampleScript(slug).meta.lang).sort();
  assert.deepEqual(langs, ['en', 'en', 'es', 'es', 'pt']);
  for (const slug of slugs) {
    const meta = exampleScript(slug).meta;
    if (meta.lang === 'pt') assert.ok(meta.ui, `${slug}: meta.ui`);
    const request = fs.readFileSync(path.join(EXAMPLES, slug, 'request.txt'), 'utf8');
    assert.equal(language(request), meta.lang, `${slug}: request.txt language`);
  }
  assert.equal(exampleScript('test-people-actions').meta.lang, 'es');
  assert.equal(exampleScript('test-animals-places').meta.lang, 'en');
  assert.equal(exampleScript('test-flow-max').meta.lang, 'pt');
});

for (const slug of slugs) {
  test(`A42: ${slug} validates with no errors and no warnings`, () => {
    const r = runNode(VALIDATE, [path.join(EXAMPLES, slug, `${slug}.tcia.json`), '--json']);
    assert.equal(r.status, 0, r.stdout);
    const out = JSON.parse(r.stdout);
    assert.deepEqual(out.errors, []);
    assert.deepEqual(out.warnings, []);
  });

  test(`A42: ${slug} builds (fake engine)`, (t) => {
    const out = path.join(tempDir(t), 'out');
    const r = runNode(BUILD, [path.join(EXAMPLES, slug, `${slug}.tcia.json`), '--out', out, '--engine', FAKE_ENGINE]);
    assert.equal(r.status, 0, r.stdout);
    assert.ok(fs.existsSync(path.join(out, `${slug}.html`)));
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out, `${slug}.tcia.json`), 'utf8')), exampleScript(slug));
  });

  test(`A42: ${slug} builds with the real engine into the committed HTML`, (t) => {
    const out = path.join(tempDir(t), 'out');
    const r = runNode(BUILD, [path.join(EXAMPLES, slug, `${slug}.tcia.json`), '--out', out]);
    assert.equal(r.status, 0, r.stdout);
    const built = fs.readFileSync(path.join(out, `${slug}.html`));
    const committed = fs.readFileSync(path.join(EXAMPLES, slug, `${slug}.html`));
    assert.ok(built.equals(committed), `${slug}.html differs from a fresh build: run npm run build:examples`);
  });
}

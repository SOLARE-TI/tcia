import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { prepare, outcomes } from '../../engine/src/core.mjs';
import { findChrome, dumpDom, CHROME_SKIP } from './helpers/chrome.mjs';
import { inject } from './helpers/inject.mjs';
import { REPO, ENGINE_HTML, FIXTURES, loadCatalog, loadExample, allScripts, readJson } from './helpers/load.mjs';

const chrome = findChrome();
const catalog = loadCatalog();
const opts = chrome ? {} : { skip: CHROME_SKIP };

function htmlAttrs(dom) {
  const m = /<html([^>]*)>/.exec(dom);
  const out = {};
  if (!m) return out;
  for (const a of m[1].matchAll(/([a-z-]+)="([^"]*)"/g)) out[a[1]] = a[2];
  return out;
}

function decode(s) { return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"); }

function block(dom, id) {
  const m = new RegExp('<div id="' + id + '"([^>]*)>([\\s\\S]*?)</div>').exec(dom);
  return m ? { attrs: m[1], inner: m[2], hidden: /\shidden(=""|\s|$)/.test(m[1]) } : null;
}

// combinations that cover every option of every decision and every ending
function covering(story) {
  const outs = outcomes(story);
  const need = new Set();
  for (const d of story.decisions) for (const o of d.options) need.add(d.id + '=' + o.id);
  for (const e of story.endings) need.add('end=' + e.id);
  const picked = [];
  while (need.size) {
    let best = null;
    let gain = -1;
    for (const o of outs) {
      const keys = Object.entries(o.choices).map(([d, v]) => d + '=' + v).concat(['end=' + o.ending]);
      const g = keys.filter((k) => need.has(k)).length;
      if (g > gain) { gain = g; best = { o, keys }; }
    }
    if (!best || gain <= 0) break;
    best.keys.forEach((k) => need.delete(k));
    picked.push(best.o);
  }
  return picked;
}

function armAll() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcia-browser-'));
  const engine = fs.readFileSync(ENGINE_HTML, 'utf8');
  const list = [];
  for (const s of allScripts()) {
    const file = path.join(dir, s.script.meta.slug + '.html');
    fs.writeFileSync(file, inject(engine, s.script));
    list.push({ name: s.name, file, script: s.script });
  }
  // the committed example HTMLs, as they are
  const ex = path.join(REPO, 'examples');
  if (fs.existsSync(ex)) {
    for (const d of fs.readdirSync(ex).sort()) {
      const h = path.join(ex, d, d + '.html');
      const j = path.join(ex, d, d + '.tcia.json');
      if (fs.existsSync(h) && fs.existsSync(j)) list.push({ name: 'examples/' + d + '/' + d + '.html', file: h, script: JSON.parse(fs.readFileSync(j, 'utf8')) });
    }
  }
  return { dir, list };
}

test('A47: every armed story plays to its ending in Chrome with no errors and the UI texts of its language', opts, () => {
  const { dir, list } = armAll();
  try {
    for (const item of list) {
      const story = prepare(item.script, catalog);
      for (const o of covering(story)) {
        const picks = story.decisions.map((d) => d.options.findIndex((x) => x.id === o.choices[d.id]) + 1);
        const r = dumpDom(item.file, { hash: 'tcia=auto:' + picks.join('.') });
        const a = htmlAttrs(r.dom);
        const label = item.name + ' ' + JSON.stringify(o.choices);
        assert.equal(a['data-tcia-state'], 'ended', label + ' state (' + r.stderr.slice(0, 200) + ')');
        assert.equal(a['data-tcia-ending'], o.ending, label + ' ending');
        assert.equal(a['data-tcia-errors'], '0', label + ' errors');
        assert.equal(a['data-tcia-choices'], Object.entries(o.choices).map(([k, v]) => k + '=' + v).join(','), label + ' choices');
        assert.equal(a.lang, story.meta.lang);
        const btn = /<button type="button" id="tcia-restart"[^>]*>([^<]*)<\/button>/.exec(r.dom);
        assert.equal(btn && decode(btn[1]), story.ui.restart, label + ' restart text');
        const start = /<button type="button" id="tcia-start"[^>]*>([^<]*)<\/button>/.exec(r.dom);
        assert.equal(start && decode(start[1]), story.ui.start, label + ' start text');
        assert.ok(/data-tcia-frame-ms="[\d.]+"/.test(r.dom), label + ' frame-ms hook');
      }
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('A60: stop:deciding shows only 2–3 numbered buttons; stop:ended shows only the restart button', opts, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcia-browser-'));
  try {
    const script = loadExample();
    const file = path.join(dir, 'x.html');
    fs.writeFileSync(file, inject(fs.readFileSync(ENGINE_HTML, 'utf8'), script));
    for (const [hash, labels] of [['tcia=auto:1.1;stop:deciding', ['Go for the flip!', 'Play it safe']], ['tcia=auto:1.1;stop:deciding@2', ['Jump again!', 'Take a break']]]) {
      const r = dumpDom(file, { hash });
      assert.equal(htmlAttrs(r.dom)['data-tcia-state'], 'deciding', hash);
      const dec = block(r.dom, 'tcia-decision');
      assert.ok(dec && !dec.hidden, 'decision overlay visible');
      assert.match(dec.attrs, /role="group"/);
      assert.match(dec.attrs, /aria-label="Decision"/);
      const buttons = [...dec.inner.matchAll(/<button[^>]*class="choice"[^>]*><span class="num">(\d)<\/span><span class="label">([^<]*)<\/span><\/button>/g)];
      assert.deepEqual(buttons.map((b) => [b[1], decode(b[2])]), labels.map((l, i) => [String(i + 1), l]));
      assert.equal((dec.inner.match(/<button/g) || []).length, labels.length);
      assert.match(dec.inner, /animation-delay: 0\.12s/);
      assert.ok(block(r.dom, 'tcia-title').hidden && block(r.dom, 'tcia-end').hidden, 'no other overlay');
    }
    const r = dumpDom(file, { hash: 'tcia=auto:2.2;stop:ended' });
    assert.equal(htmlAttrs(r.dom)['data-tcia-state'], 'ended');
    const end = block(r.dom, 'tcia-end');
    assert.ok(end && !end.hidden);
    assert.equal(decode(end.inner.replace(/<[^>]+>/g, '').trim()), 'Start over');
    assert.equal((end.inner.match(/<button/g) || []).length, 1);
    const dec = block(r.dom, 'tcia-decision');
    assert.ok(dec.hidden && !/<button/.test(dec.inner), 'decision overlay hidden and empty');
    assert.ok(block(r.dom, 'tcia-title').hidden, 'title hidden');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

function boxesOf(dom) {
  const v = htmlAttrs(dom)['data-tcia-boxes'];
  return v ? JSON.parse(decode(v)) : null;
}

function cross(a, b) { return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]; }

// the contract example and the five examples, armed in a temporary folder
function armMain(extra) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcia-browser-'));
  const engine = fs.readFileSync(ENGINE_HTML, 'utf8');
  const list = allScripts().filter((s) => !s.name.startsWith('fixtures/')).concat(extra || []).map((s) => {
    const file = path.join(dir, s.script.meta.slug + '.html');
    fs.writeFileSync(file, inject(engine, s.script));
    return { name: s.name, file, script: s.script };
  });
  return { dir, list };
}

test('A66 + A71: at every decision and every ending the buttons cross no character, and a decision\'s buttons have one height', opts, (t) => {
  const labels = { name: 'fixtures/labels/labels-1-32.tcia.json', script: readJson(path.join(FIXTURES, 'labels', 'labels-1-32.tcia.json')) };
  const { dir, list } = armMain([labels]);
  let runs = 0;
  try {
    for (const item of list) {
      const story = prepare(item.script, catalog);
      const paths = covering(story);
      const picksOf = (o) => story.decisions.map((d) => d.options.findIndex((x) => x.id === o.choices[d.id]) + 1);
      const checks = [];
      story.decisions.forEach((d, i) => checks.push({ hash: 'tcia=auto:' + picksOf(paths[0]).join('.') + ';stop:deciding@' + (i + 1), what: 'decision ' + d.id, n: d.options.length }));
      for (const o of paths) checks.push({ hash: 'tcia=auto:' + picksOf(o).join('.') + ';stop:ended', what: 'ending ' + o.ending, n: 1 });
      for (const c of checks) {
        const r = dumpDom(item.file, { hash: c.hash });
        runs++;
        const B = boxesOf(r.dom);
        const label = item.name + ' ' + c.what;
        assert.ok(B, label + ': no data-tcia-boxes');
        assert.equal(B.buttons.length, c.n, label + ': visible buttons');
        assert.ok(B.actors.length > 0, label + ': actors');
        for (const b of B.buttons) {
          for (const a of B.actors) {
            assert.ok(!cross(b, a.body) && !cross(b, a.head), label + ': a button ' + JSON.stringify(b) + ' crosses ' + a.id + ' ' + JSON.stringify(a.body));
          }
        }
        if (c.n > 1) {
          const hs = B.buttons.map((b) => b[3] - b[1]);
          assert.ok(Math.max(...hs) - Math.min(...hs) <= 1, label + ': button heights ' + hs.join(', '));
        }
      }
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  t.diagnostic('Chrome runs: ' + runs);
});

test('A70: the title screen shows every character in a row, standing on the ground line', opts, () => {
  const { dir, list } = armMain();
  try {
    for (const item of list) {
      const r = dumpDom(item.file, { hash: 'tcia=stop:title' });
      assert.equal(htmlAttrs(r.dom)['data-tcia-state'], 'title', item.name);
      const B = boxesOf(r.dom);
      assert.ok(B, item.name + ': no data-tcia-boxes');
      assert.deepEqual(B.actors.map((a) => a.id).sort(), item.script.characters.map((c) => c.id).sort(), item.name + ': cast on the title');
      const row = B.actors.slice().sort((a, b) => a.body[0] - b.body[0]);
      for (const a of row) {
        assert.ok(Math.abs(a.body[3] - 900) <= 1, item.name + ': feet of ' + a.id + ' at y=' + a.body[3]);
        assert.ok(a.body[0] >= 0 && a.body[1] >= 0 && a.body[2] <= 1920 && a.body[3] <= 1080, item.name + ': ' + a.id + ' outside the canvas');
      }
      for (let i = 1; i < row.length; i++) assert.ok(row[i - 1].body[2] <= row[i].body[0], item.name + ': ' + row[i - 1].id + ' and ' + row[i].id + ' overlap');
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('R8: with no hash the story waits on the title screen (it never starts playing without Enter or a click)', opts, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcia-browser-'));
  try {
    const file = path.join(dir, 'x.html');
    fs.writeFileSync(file, inject(fs.readFileSync(ENGINE_HTML, 'utf8'), loadExample()));
    const r = dumpDom(file, { budgetMs: 20000 });
    assert.equal(htmlAttrs(r.dom)['data-tcia-state'], 'title');
    assert.ok(!block(r.dom, 'tcia-title').hidden, 'title overlay visible');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the bare engine (nothing injected) shows the template message and the error state', opts, () => {
  const r = dumpDom(ENGINE_HTML, {});
  assert.equal(htmlAttrs(r.dom)['data-tcia-state'], 'error');
  assert.match(r.dom, /TCIA engine template: no script was injected\./);
});

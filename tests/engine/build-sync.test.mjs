import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO, ENGINE_HTML, loadCatalog } from './helpers/load.mjs';

const MARK = '__TCIA_' + 'SCRIPT_JSON__';
const html = () => fs.readFileSync(ENGINE_HTML, 'utf8');

test('A39: `node engine/build.mjs --check` exits 0 (engine.html is exactly what the build makes)', () => {
  const r = spawnSync(process.execPath, [path.join(REPO, 'engine', 'build.mjs'), '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

test('A39: the embedded catalog equals the contract catalog', () => {
  const m = /<script type="application\/json" id="tcia-catalog">([\s\S]*?)<\/script>/.exec(html());
  assert.ok(m, 'catalog block');
  assert.deepEqual(JSON.parse(m[1]), loadCatalog());
});

test('A40: one placeholder, the D12 metas and CSP, nothing from the network, <= 350 KB', () => {
  const h = html();
  assert.equal(h.split(MARK).length - 1, 1);
  assert.ok(h.includes('<script type="application/json" id="tcia-script">' + MARK + '</script>'));
  const head = h.slice(0, h.indexOf('</head>'));
  for (const meta of [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="tcia-format" content="1">',
    '<meta name="tcia-engine" content="0.1.0">',
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:">'
  ]) assert.ok(head.includes(meta), meta);
  for (const bad of ['https://', 'src=', 'href=', '@import', 'url(']) assert.equal(h.includes(bad), false, bad);
  assert.equal(h.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '').includes('http://'), false, 'http:// outside the SVG namespace');
  assert.ok(Buffer.byteLength(h) <= 350 * 1024, Buffer.byteLength(h) + ' bytes');
  const js = /<script>([\s\S]*)<\/script>\s*<\/body>/.exec(h)[1];
  assert.equal(js.includes('<!--'), false);
});

test('A60: decision and end buttons pop in with a scale > 1; decision buttons are staggered', () => {
  const h = html();
  const css = /<style>([\s\S]*?)<\/style>/.exec(h)[1];
  const anim = (sel) => { const m = new RegExp(sel.replace(/[.#]/g, (c) => '\\' + c) + '\\s*\\{[^}]*animation:\\s*([a-z-]+)').exec(css); return m && m[1]; };
  const kf = (name) => { const m = new RegExp('@keyframes ' + name + '\\s*\\{([\\s\\S]*?\\})\\s*\\}').exec(css); return m ? m[1] : ''; };
  const maxScale = (body) => Math.max(0, ...[...body.matchAll(/scale\(([\d.]+)\)/g)].map((m) => Number(m[1])));
  for (const sel of ['.choice', '#tcia-restart']) {
    const name = anim(sel);
    assert.ok(name, sel + ' has an animation');
    assert.ok(maxScale(kf(name)) > 1, sel + ' keyframes scale above 1');
  }
  assert.match(h, /animationDelay = \(i \* 0\.12\)/);
});

#!/usr/bin/env node
// Builds plugins/tcia/skills/tcia/assets/engine.html from engine/template.html, engine/src/**/*.mjs and
// the contract catalog. `--check` compares instead of writing (exit 1 when it differs). No dependencies.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

// D5: Node.js 22 or newer
const nodeMajor = Number(String(process.versions.node).split('.')[0]);
if (!(nodeMajor >= 22)) {
  process.stderr.write('TCIA needs Node.js 22 or newer (found ' + process.version + ').\n');
  process.exit(2);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const SRC = path.join(here, 'src');
const TEMPLATE = path.join(here, 'template.html');
const CATALOG = path.join(repo, 'plugins', 'tcia', 'skills', 'tcia', 'contract', 'catalog.json');
const OUT = path.join(repo, 'plugins', 'tcia', 'skills', 'tcia', 'assets', 'engine.html');
const MAX_BYTES = 350 * 1024;
const MARK = '__TCIA_' + 'SCRIPT_JSON__';

function fail(msg) {
  process.stderr.write('engine build: ' + msg + '\n');
  process.exit(1);
}

function listModules(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listModules(p));
    else if (e.name.endsWith('.mjs')) out.push(p);
  }
  return out;
}

const IMPORT_RE = /^import \{ ?([A-Za-z0-9_$, ]+) ?\} from '(\.{1,2}\/[A-Za-z0-9_./-]+\.mjs)';$/;

export function parseModule(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const deps = [];
  const body = [];
  lines.forEach((line, i) => {
    if (/^\s*import\b/.test(line)) {
      const m = IMPORT_RE.exec(line);
      if (!m) fail(path.relative(repo, file) + ':' + (i + 1) + ': imports must be one line: import { a, b } from \'./x.mjs\';');
      deps.push(path.resolve(path.dirname(file), m[2]));
      return;
    }
    if (/\bimport\s*\(/.test(line)) fail(path.relative(repo, file) + ':' + (i + 1) + ': dynamic import() is not allowed');
    if (/^export\s+default\b/.test(line)) fail(path.relative(repo, file) + ':' + (i + 1) + ': export default is not allowed');
    if (/^export\s*\{/.test(line)) fail(path.relative(repo, file) + ':' + (i + 1) + ': export lists are not allowed');
    if (line.includes('`')) fail(path.relative(repo, file) + ':' + (i + 1) + ': template literals are not allowed (the bundle is minified line by line)');
    body.push(line.replace(/^export (?=(async )?function |const |let |class )/, ''));
  });
  return { file, deps, body: body.join('\n') };
}

function topo(mods) {
  const byFile = new Map(mods.map((m) => [m.file, m]));
  const done = new Set();
  const active = new Set();
  const order = [];
  const visit = (m) => {
    if (done.has(m.file)) return;
    if (active.has(m.file)) fail('import cycle through ' + path.relative(repo, m.file));
    active.add(m.file);
    for (const d of m.deps) {
      const dm = byFile.get(d);
      if (!dm) fail(path.relative(repo, m.file) + ' imports a missing module ' + path.relative(repo, d));
      visit(dm);
    }
    active.delete(m.file);
    done.add(m.file);
    order.push(m);
  };
  for (const m of mods) visit(m);
  return order;
}

function checkUniqueNames(order) {
  const seen = new Map();
  for (const m of order) {
    for (const line of m.body.split('\n')) {
      const mm = /^(?:async )?(?:function\*? |const |let |class )([A-Za-z0-9_$]+)/.exec(line);
      if (!mm) continue;
      const name = mm[1];
      if (seen.has(name) && seen.get(name) !== m.file) fail('top-level name "' + name + '" is declared in ' + path.relative(repo, seen.get(name)) + ' and ' + path.relative(repo, m.file));
      seen.set(name, m.file);
    }
  }
}

// same escaping as the builder's injection (D12): JSON stays valid and cannot close the <script>
export function escapeJsonForScript(json) {
  return json.replace(/[<>&\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

export function buildEngineHtml() {
  const mods = listModules(SRC).map(parseModule);
  const order = topo(mods);
  checkUniqueNames(order);
  // light, safe minification: no indentation, no full-line comments, no blank lines (no template literals in the sources)
  const slim = (body) => body.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//')).join('\n');
  let js = order.map((m) => '// ' + path.relative(here, m.file).split(path.sep).join('/') + '\n' + slim(m.body)).join('\n');
  js = "(function () {\n'use strict';\n" + js + '\ntciaBoot();\n})();\n';
  try { new vm.Script(js, { filename: 'engine.js' }); } catch (e) { fail('the bundled engine does not compile: ' + e.message); }
  const banned = ['</script', '<!--', MARK, 'https://', 'src=', 'href=', '@import', 'url('];
  for (const b of banned) if (js.includes(b)) fail('the engine source contains the forbidden text "' + b + '"');
  if (js.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '').includes('http://')) fail('the engine source contains http:// other than the SVG namespace');
  const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
  const catJson = escapeJsonForScript(JSON.stringify(catalog));
  let html = fs.readFileSync(TEMPLATE, 'utf8');
  for (const ph of ['@@TCIA_CATALOG_JSON@@', '@@TCIA_ENGINE_JS@@']) {
    if (html.split(ph).length !== 2) fail('template must contain ' + ph + ' exactly once');
  }
  html = html.replace('@@TCIA_CATALOG_JSON@@', () => catJson);
  html = html.replace('@@TCIA_ENGINE_JS@@', () => js);
  const count = html.split(MARK).length - 1;
  if (count !== 1) fail('the engine must contain the script placeholder exactly once (found ' + count + ')');
  const bytes = Buffer.byteLength(html, 'utf8');
  if (bytes > MAX_BYTES) fail('engine.html is ' + bytes + ' bytes; the limit is ' + MAX_BYTES);
  return html;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const check = process.argv.includes('--check');
  const html = buildEngineHtml();
  if (check) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
    if (cur !== html) {
      process.stderr.write('engine build: ' + path.relative(repo, OUT) + ' is out of date; run node engine/build.mjs\n');
      process.exit(1);
    }
    process.stdout.write('OK: ' + path.relative(repo, OUT) + ' is up to date (' + Buffer.byteLength(html) + ' bytes).\n');
  } else {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT + '.tmp', html);
    fs.renameSync(OUT + '.tmp', OUT);
    process.stdout.write('Built ' + path.relative(repo, OUT) + ' (' + Buffer.byteLength(html) + ' bytes).\n');
  }
}

#!/usr/bin/env node
// TCIA builder CLI (D11).
//   node build.mjs <script.tcia.json> [--out <folder>] [--json]
//   (--engine <file> exists only for tests)
// Exit codes: 0 built, 1 invalid script or engine template, 2 usage or Node.

import { checkNode } from './lib/node-version.mjs';

var USAGE = 'Usage: node build.mjs <script.tcia.json> [--out <folder>] [--json]';
var argv = process.argv.slice(2);
var asJson = argv.indexOf('--json') !== -1;

function bail(exitCode, code, message, file) {
  var error = { code: code, path: '', message: message, suggestion: null, approximation: null };
  if (asJson) {
    process.stdout.write(JSON.stringify({ ok: false, file: file === undefined ? null : file, errors: [error], warnings: [], stats: null }, null, 2) + '\n');
  } else {
    process.stdout.write('ERROR ' + code + ' ' + message + '\nFAIL: 1 error, 0 warnings.\n');
  }
  process.exit(exitCode);
}

var nodeProblem = checkNode(process.versions.node);
if (nodeProblem) bail(2, 'E_NODE_VERSION', nodeProblem);

const fs = await import('node:fs');
const path = await import('node:path');
const { fileURLToPath } = await import('node:url');
const { loadContract, DEFAULT_ENGINE } = await import('./lib/contract.mjs');
const { validateSource } = await import('./lib/validate.mjs');
const { formatText, formatWarnings, jsonReport } = await import('./lib/report.mjs');
const { inject, countPlaceholders, engineFormat } = await import('./lib/inject.mjs');

// Arguments.
let file = null;
let outDir = null;
let enginePath = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--json') continue;
  if (a === '--out' || a === '--engine') {
    const value = argv[++i];
    if (value === undefined || value.startsWith('--')) bail(2, 'E_USAGE', USAGE);
    if (a === '--out') outDir = value;
    else enginePath = value;
  } else if (a.startsWith('--') || file !== null) {
    bail(2, 'E_USAGE', USAGE);
  } else {
    file = a;
  }
}
if (file === null) bail(2, 'E_USAGE', USAGE);

// 1-2. Read and validate. Nothing is written when the script is invalid.
let source;
try {
  source = fs.readFileSync(file, 'utf8');
} catch (e) {
  bail(2, 'E_USAGE', `Cannot read ${file}: ${reason(e)}`, file);
}
const result = validateSource(source, loadContract());
if (!result.ok) {
  if (asJson) process.stdout.write(JSON.stringify(jsonReport(file, result), null, 2) + '\n');
  else process.stdout.write(formatText(result));
  process.exit(1);
}
const script = result.script;

// 3. Engine template.
const engineFile = enginePath !== null ? path.resolve(enginePath) : fileURLToPath(DEFAULT_ENGINE);
let engine;
try {
  engine = fs.readFileSync(engineFile, 'utf8');
} catch (e) {
  bail(2, 'E_USAGE', `Cannot read ${engineFile}: ${reason(e)}`, file);
}
const slots = countPlaceholders(engine);
if (slots !== 1) {
  bail(1, 'E_ENGINE_TEMPLATE', `Engine template must contain the script placeholder exactly once (found ${slots}).`, file);
}
const format = engineFormat(engine);
if (format !== String(script.tcia)) {
  bail(1, 'E_ENGINE_FORMAT', `Engine supports format ${format === null ? 'unknown' : format}; the script is format ${script.tcia}.`, file);
}

// 4. Inject.
const html = inject(engine, script);

// 5. Write <slug>.html (through a .tmp file) and <slug>.tcia.json.
const folder = outDir !== null ? path.resolve(outDir) : path.dirname(path.resolve(file));
const htmlPath = path.join(folder, `${script.meta.slug}.html`);
const jsonPath = path.join(folder, `${script.meta.slug}.tcia.json`);
try {
  fs.mkdirSync(folder, { recursive: true });
  writeAtomic(htmlPath, html);
  if (!samePath(jsonPath, path.resolve(file))) writeAtomic(jsonPath, JSON.stringify(script, null, 2) + '\n');
} catch (e) {
  bail(2, 'E_USAGE', `Cannot write to ${folder}: ${reason(e)}`, file);
}

// 6. Report.
if (asJson) {
  process.stdout.write(JSON.stringify({ ok: true, html: htmlPath, script: jsonPath, warnings: result.warnings }, null, 2) + '\n');
} else {
  process.stdout.write(formatWarnings(result.warnings) + `Built ${htmlPath}\nScript ${jsonPath}\n`);
}
process.exit(0);

function writeAtomic(target, content) {
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, target);
}

function samePath(a, b) {
  if (a === b) return true;
  try {
    return fs.realpathSync(a) === fs.realpathSync(b);
  } catch {
    return false;
  }
}

function reason(e) {
  if (e.code === 'ENOENT') return 'no such file';
  if (e.code === 'EISDIR') return 'it is a folder';
  if (e.code === 'EACCES') return 'permission denied';
  return e.message;
}

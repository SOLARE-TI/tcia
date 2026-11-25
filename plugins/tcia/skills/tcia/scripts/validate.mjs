#!/usr/bin/env node
// TCIA validator CLI (D10).
//   node validate.mjs <script.tcia.json> [--json]
// Exit codes: 0 valid (with or without warnings), 1 invalid, 2 usage or Node.

import { checkNode } from './lib/node-version.mjs';

var USAGE = 'Usage: node validate.mjs <script.tcia.json> [--json]';
var argv = process.argv.slice(2);
var asJson = argv.indexOf('--json') !== -1;

function bail(code, message, file) {
  var error = { code: code, path: '', message: message, suggestion: null, approximation: null };
  if (asJson) {
    process.stdout.write(JSON.stringify({ ok: false, file: file === undefined ? null : file, errors: [error], warnings: [], stats: null }, null, 2) + '\n');
  } else {
    process.stdout.write('ERROR ' + code + ' ' + message + '\nFAIL: 1 error, 0 warnings.\n');
  }
  process.exit(2);
}

var nodeProblem = checkNode(process.versions.node);
if (nodeProblem) bail('E_NODE_VERSION', nodeProblem);

const { readFileSync } = await import('node:fs');
const { loadContract } = await import('./lib/contract.mjs');
const { validateSource } = await import('./lib/validate.mjs');
const { formatText, jsonReport } = await import('./lib/report.mjs');

const files = argv.filter((a) => a !== '--json');
if (files.length !== 1 || files[0].startsWith('--')) bail('E_USAGE', USAGE);
const file = files[0];

let source;
try {
  source = readFileSync(file, 'utf8');
} catch (e) {
  bail('E_USAGE', `Cannot read ${file}: ${readReason(e)}`, file);
}

const result = validateSource(source, loadContract());
if (asJson) process.stdout.write(JSON.stringify(jsonReport(file, result), null, 2) + '\n');
else process.stdout.write(formatText(result));
process.exit(result.ok ? 0 : 1);

function readReason(e) {
  if (e.code === 'ENOENT') return 'no such file';
  if (e.code === 'EISDIR') return 'it is a folder';
  if (e.code === 'EACCES') return 'permission denied';
  return e.message;
}

// Shared helpers for the validator, builder, example and repo tests.
// Tests write only under os.tmpdir() and remove what they create.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const SKILL = path.join(ROOT, 'plugins', 'tcia', 'skills', 'tcia');
export const VALIDATE = path.join(SKILL, 'scripts', 'validate.mjs');
export const BUILD = path.join(SKILL, 'scripts', 'build.mjs');
export const ENGINE = path.join(SKILL, 'assets', 'engine.html');
export const EXAMPLE = path.join(SKILL, 'contract', 'example.tcia.json');
export const EXAMPLES = path.join(ROOT, 'examples');

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export const catalog = readJson(path.join(SKILL, 'contract', 'catalog.json'));
export const schema = readJson(path.join(SKILL, 'contract', 'script.schema.json'));

// A fresh copy of the contract example.
export function example() {
  return readJson(EXAMPLE);
}

export function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcia-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

export function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
  return file;
}

export function runNode(script, args = [], options = {}) {
  const { nodeArgs = [], ...rest } = options;
  return spawnSync(process.execPath, [...nodeArgs, script, ...args], { encoding: 'utf8', ...rest });
}

export function lastLine(text) {
  const lines = text.trimEnd().split('\n');
  return lines[lines.length - 1];
}


// Example folders, sorted by name.
export function exampleDirs() {
  if (!fs.existsSync(EXAMPLES)) return [];
  return fs.readdirSync(EXAMPLES, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

export function exampleScript(slug) {
  return readJson(path.join(EXAMPLES, slug, `${slug}.tcia.json`));
}

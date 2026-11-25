// A6, A11: no dependencies, no personal paths, private keys, tokens or .env
// files. The patterns are assembled from pieces so that this file does not
// match itself.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readJson } from '../validator/helpers.mjs';
import { repoFiles, isBinary } from './walk.mjs';

const all = repoFiles({ includeIgnored: true });

const join = (...parts) => parts.join('');
const PATTERNS = [
  ['personal path', new RegExp(join('\\/(ho', 'me|Us', 'ers)\\/[A-Za-z0-9._-]+\\/'))],
  ['personal path', new RegExp(join('[A-Za-z]:\\\\', 'Us', 'ers\\\\'))],
  ['private key', new RegExp(join('-----BEGIN ([A-Z]+ )?', 'PRIVATE', ' KEY-----'))],
  ['cloud key', new RegExp(join('\\b(AK', 'IA|AS', 'IA)[0-9A-Z]{16}\\b'))],
  ['GitHub token', new RegExp(join('\\bgh', '[pousr]_[A-Za-z0-9]{30,}'))],
  ['GitHub token', new RegExp(join('\\bgithub', '_pat_[A-Za-z0-9_]{20,}'))],
  ['Slack token', new RegExp(join('\\bxo', 'x[abprs]-[A-Za-z0-9-]{10,}'))],
  ['API key', new RegExp(join('\\bs', 'k-(ant-)?[A-Za-z0-9_-]{20,}'))],
  ['API key', new RegExp(join('\\bAI', 'za[0-9A-Za-z_-]{35}'))],
];

test('A6: package.json is the D5 one, with no dependencies', () => {
  assert.deepEqual(readJson(path.join(ROOT, 'package.json')), {
    name: 'tcia',
    version: '0.1.0',
    private: true,
    description: 'TCIA: a Claude Code skill that turns a story idea into an interactive lowpoly animation.',
    license: 'MIT',
    type: 'module',
    engines: { node: '>=22' },
    scripts: {
      test: 'node --test',
      'test:engine': 'node --test "tests/engine/**/*.test.mjs"',
      'test:validator': 'node --test "tests/contract/**/*.test.mjs" "tests/validator/**/*.test.mjs" "tests/build/**/*.test.mjs"',
      'test:examples': 'node --test "tests/examples/**/*.test.mjs"',
      'test:repo': 'node --test "tests/repo/**/*.test.mjs"',
      'build:engine': 'node engine/build.mjs',
      'check:engine': 'node engine/build.mjs --check',
      'build:examples': 'node examples/rebuild.mjs',
    },
  });
});

test('A6: no node_modules and no lockfiles', () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'node_modules')), false);
  const locks = ['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', 'bun.lock'];
  assert.deepEqual(all.filter((f) => locks.includes(path.basename(f))), []);
});

test('A11: no .env files', () => {
  assert.deepEqual(all.filter((f) => /^\.env(\..*)?$/.test(path.basename(f))), []);
});

test('A11: no personal paths, private keys or tokens', () => {
  const hits = [];
  for (const rel of all) {
    const buffer = fs.readFileSync(path.join(ROOT, rel));
    if (isBinary(buffer)) continue;
    buffer.toString('utf8').split('\n').forEach((line, i) => {
      for (const [what, re] of PATTERNS) if (re.test(line)) hits.push(`${rel}:${i + 1} ${what}`);
    });
  }
  assert.deepEqual(hits, []);
});

test('A11: the patterns work (self-check)', () => {
  const sample = [
    join('/ho', 'me/someone/x'),
    join('C:\\Us', 'ers\\someone\\'),
    join('-----BEGIN RSA PRI', 'VATE KEY-----'),
    join('AK', 'IA', 'ABCDEFGHIJKLMNOP'),
    join('gh', 'p_', 'a'.repeat(36)),
    join('xo', 'xb-', '1234567890ab'),
    join('s', 'k-', 'a'.repeat(30)),
  ];
  for (const s of sample) assert.ok(PATTERNS.some(([, re]) => re.test(s)), s);
});

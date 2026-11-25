// A1: the tree matches D1 and §6 (nothing missing, nothing extra).
// A7: MIT license and the manifests of D2.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readJson } from '../validator/helpers.mjs';
import { repoFiles } from './walk.mjs';

const files = repoFiles();
const SKILL = 'plugins/tcia/skills/tcia';

const REFERENCES = ['catalog-guide.md', 'comedy-guide.md', 'errors.md', 'report.md', 'script-format.md', 'story-craft.md'];

// Owned by the skill side (B) and the contract: exact files.
const EXACT = [
  '.claude-plugin/marketplace.json',
  '.gitignore',
  'CLAUDE.md',
  'LICENSE',
  'README.es.md',
  'README.md',
  'package.json',
  'plugins/tcia/.claude-plugin/plugin.json',
  `${SKILL}/SKILL.md`,
  `${SKILL}/contract/catalog.json`,
  `${SKILL}/contract/example.tcia.json`,
  `${SKILL}/contract/script.schema.json`,
  ...REFERENCES.map((f) => `${SKILL}/references/${f}`),
  `${SKILL}/scripts/build.mjs`,
  `${SKILL}/scripts/validate.mjs`,
  'examples/rebuild.mjs',
  'tests/repo/forbidden-terms.sha256.json',
  'specs/shared/2026-11-25/00_primera-version.md',
];

// Every file must match one of these.
const ALLOWED = [
  ...EXACT.map((f) => new RegExp(`^${f.replace(/[.]/g, '\\.')}$`)),
  new RegExp(`^${SKILL}/scripts/lib/[a-z0-9-]+\\.mjs$`),
  new RegExp(`^${SKILL}/assets/engine\\.html$`),
  /^engine\/build\.mjs$/,
  /^engine\/template\.html$/,
  /^engine\/src\/.+\.mjs$/,
  /^examples\/[a-z0-9-]+\/([a-z0-9-]+\.tcia\.json|[a-z0-9-]+\.html|request\.txt)$/,
  /^tests\/(engine|contract|validator|build|examples|repo)\/.+$/,
  /^specs\/.+\.md$/,
];

test('A1: no extra files', () => {
  const extra = files.filter((f) => !ALLOWED.some((re) => re.test(f)));
  assert.deepEqual(extra, []);
});

test('A1: the skill side and the contract are complete', () => {
  const missing = EXACT.filter((f) => !files.includes(f));
  assert.deepEqual(missing, []);
  for (const lib of ['validate', 'outcomes', 'text', 'suggest', 'node-version', 'inject']) {
    assert.ok(files.includes(`${SKILL}/scripts/lib/${lib}.mjs`), `scripts/lib/${lib}.mjs (D10.6)`);
  }
  for (const dir of ['contract', 'validator', 'build', 'examples', 'repo']) {
    assert.ok(files.some((f) => f.startsWith(`tests/${dir}/`) && f.endsWith('.test.mjs')), `tests/${dir}`);
  }
  assert.deepEqual(fs.readdirSync(path.join(ROOT, SKILL, 'references')).sort(), REFERENCES);
});

test('A1: the engine side is complete', () => {
  for (const f of ['engine/build.mjs', 'engine/template.html', `${SKILL}/assets/engine.html`]) {
    assert.ok(files.includes(f), f);
  }
  assert.ok(files.some((f) => /^engine\/src\/core\.mjs$/.test(f)), 'engine/src/core.mjs');
  assert.ok(files.some((f) => f.startsWith('tests/engine/') && f.endsWith('.test.mjs')), 'tests/engine');
});

test('A1: the plugin root holds only what users need', () => {
  const plugin = files.filter((f) => f.startsWith('plugins/'));
  for (const f of plugin) {
    assert.ok(f.startsWith('plugins/tcia/.claude-plugin/') || f.startsWith(`${SKILL}/`), f);
  }
  assert.equal(fs.existsSync(path.join(ROOT, 'plugins/tcia/CLAUDE.md')), false);
});

test('A7: MIT license, Solare S.A.S., 2026', () => {
  const license = fs.readFileSync(path.join(ROOT, 'LICENSE'), 'utf8');
  assert.match(license, /^MIT License\n\nCopyright \(c\) 2026 Solare S\.A\.S\.\n/);
  assert.match(license, /Permission is hereby granted, free of charge, to any person obtaining a copy/);
  assert.match(license, /THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND/);
  assert.equal(readJson(path.join(ROOT, 'plugins/tcia/.claude-plugin/plugin.json')).license, 'MIT');
});

test('D2: plugin.json and marketplace.json are exactly the spec ones', () => {
  assert.deepEqual(readJson(path.join(ROOT, 'plugins/tcia/.claude-plugin/plugin.json')), {
    name: 'tcia',
    displayName: 'TCIA (Taller Creativo IA Animation)',
    version: '0.1.0',
    description: 'Interactive 2D lowpoly cartoon animations from a story idea: Claude writes a JSON script, a validator checks it and a fixed engine turns it into one self-contained HTML file.',
    author: { name: 'Solare S.A.S.', url: 'https://github.com/SOLARE-TI' },
    homepage: 'https://github.com/SOLARE-TI/tcia',
    repository: 'https://github.com/SOLARE-TI/tcia',
    license: 'MIT',
    keywords: ['animation', 'interactive-story', 'lowpoly', 'svg', 'storytelling', 'animacion', 'historia-interactiva'],
  });
  assert.deepEqual(readJson(path.join(ROOT, '.claude-plugin/marketplace.json')), {
    name: 'tcia',
    description: 'TCIA: a Claude Code skill that turns a story idea into an interactive lowpoly animation.',
    owner: { name: 'Solare S.A.S.', url: 'https://github.com/SOLARE-TI' },
    plugins: [
      {
        name: 'tcia',
        source: './plugins/tcia',
        description: 'Story idea in, one interactive lowpoly animation (.html) out.',
        category: 'creative',
        tags: ['animation', 'storytelling', 'lowpoly'],
      },
    ],
  });
});

test('D19: .gitignore is exactly the spec one', () => {
  assert.equal(fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8'),
    'node_modules/\n.DS_Store\nThumbs.db\n*.log\n*.tmp\n.env\n.env.*\nengine/dist/\n');
});

test('D5: every JavaScript file is .mjs', () => {
  const js = files.filter((f) => /\.(c?js|ts)$/.test(f));
  assert.deepEqual(js, []);
});

test('D4: the test prompts are stored', () => {
  for (const name of ['es-completo', 'en-fantasia', 'es-una-escena', 'activacion-es', 'activacion-en']) {
    assert.ok(files.includes(`tests/repo/fixtures/prompts/${name}.txt`), name);
  }
});

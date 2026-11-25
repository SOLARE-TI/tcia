// A8-A10: SKILL.md, the READMEs and CLAUDE.md follow D3 and D18.
// A62-A65 (the parts a test can read): the comedy rule, the comedy guide,
// the gag review step and the gag list in the report template.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, SKILL, catalog, schema } from '../validator/helpers.mjs';

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const skillMd = fs.readFileSync(path.join(SKILL, 'SKILL.md'), 'utf8');
const REFERENCES = ['script-format.md', 'catalog-guide.md', 'story-craft.md', 'errors.md', 'report.md', 'comedy-guide.md'];

const FRONTMATTER = `---
name: tcia
description: 'TCIA (Taller Creativo IA Animation) turns a story idea into one self-contained .html file: a 2D lowpoly cartoon animation with speech balloons and 2-3 interactive choices that lead to 3-4 endings. Use it when the user asks, in English or Spanish, for an animation, an animated story, an interactive cartoon or a story with choices and endings, e.g. "create an animation", "make an animated story", "animate this story", "interactive story with choices", "lowpoly cartoon", "crea una animación", "haz una historia animada", "anima esta historia", "animación con decisiones", "historia interactiva con finales", "caricatura lowpoly". Claude writes only a JSON script; a bundled validator checks it and a fixed engine renders it. Desktop browsers only, no audio, real beings only.'
license: MIT
compatibility: Claude Code. Needs Node.js 22 or newer on PATH. The result opens in desktop browsers.
allowed-tools: Bash(node \${CLAUDE_SKILL_DIR}/scripts/*)
---
`;

// Share of common English words among common English + Spanish words.
const EN = new Set(['the', 'and', 'is', 'of', 'to', 'a', 'in', 'it', 'with', 'for', 'or', 'on', 'each', 'when', 'one', 'every', 'never', 'that', 'not', 'are']);
const ES = new Set(['el', 'la', 'los', 'las', 'de', 'que', 'y', 'en', 'un', 'una', 'con', 'por', 'para', 'es', 'del', 'se', 'cada', 'nunca']);
function englishShare(text) {
  const words = text.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ').toLowerCase().split(/[^a-záéíóúñ]+/u);
  const en = words.filter((w) => EN.has(w)).length;
  const es = words.filter((w) => ES.has(w)).length;
  return en / Math.max(1, en + es);
}

function section(markdown, heading) {
  const start = markdown.indexOf(`\n## ${heading}\n`);
  assert.ok(start >= 0, `section "${heading}"`);
  const rest = markdown.slice(start + 1);
  const end = rest.indexOf('\n## ', 1);
  return end < 0 ? rest : rest.slice(0, end);
}

const headings = (markdown) => markdown.split('\n').filter((l) => l.startsWith('## ')).map((l) => l.slice(3).trim());

test('A8: SKILL.md frontmatter is exactly D3', () => {
  assert.ok(skillMd.startsWith(FRONTMATTER), 'frontmatter differs from D3');
});

test('SKILL.md runs only the two scripts (no node --version, no node -e)', () => {
  const body = skillMd.slice(FRONTMATTER.length);
  const commands = [...body.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].flatMap((m) => m[1].split('\n')).map((l) => l.trim()).filter(Boolean);
  assert.deepEqual(commands, [
    'node ${CLAUDE_SKILL_DIR}/scripts/validate.mjs <file> --json',
    'node ${CLAUDE_SKILL_DIR}/scripts/build.mjs <file> --json',
  ]);
  const start = section(skillMd, 'Before you start');
  assert.match(start, /Only run these two commands/);
  assert.match(start, /check the Node\.js version themselves/);
  assert.doesNotMatch(section(skillMd, 'Workflow'), /node --version|node -e/);
});

test('beats are numbered from 1 for the user', () => {
  assert.match(section(skillMd, 'Workflow'), /counting beats from 1/);
  const report = fs.readFileSync(path.join(SKILL, 'references', 'report.md'), 'utf8');
  assert.match(report, /Number beats from 1/);
  assert.ok(!/beat <n>(?!,)/.test(report), 'every beat placeholder says it counts from 1');
});

test('no hints about where the style comes from; the style is described in own words', () => {
  const files = ['README.md', 'README.es.md', 'CLAUDE.md'].map(read)
    .concat(skillMd, ...REFERENCES.map((f) => fs.readFileSync(path.join(SKILL, 'references', f), 'utf8')));
  for (const text of files) assert.doesNotMatch(text, /TV series|series de televisi|studio|estudio de animaci/i);
  assert.match(read('README.md'), /smooth silhouettes/);
  assert.match(read('README.es.md'), /siluetas suaves/);
  assert.match(read('CLAUDE.md'), /No file names an existing work or credits the style to one\./);
});

test('A8: description length and triggers in both languages', () => {
  const description = /^description: '(.*)'$/m.exec(skillMd)[1];
  assert.ok(description.length <= 1536, `${description.length} characters`);
  assert.ok(!description.includes("'"));
  for (const t of ['create an animation', 'make an animated story', 'animate this story', 'interactive story with choices', 'lowpoly cartoon',
    'crea una animación', 'haz una historia animada', 'anima esta historia', 'animación con decisiones', 'historia interactiva con finales', 'caricatura lowpoly']) {
    assert.ok(description.includes(`"${t}"`), t);
  }
});

test('A8: SKILL.md is short, in English, with the D3 sections in order', () => {
  assert.ok(skillMd.split('\n').length < 500);
  const body = skillMd.slice(FRONTMATTER.length);
  assert.ok(englishShare(body) > 0.85, 'body in English');
  assert.deepEqual(headings(body), ['What this skill does', 'Hard rules', 'Before you start', 'Inputs', 'Workflow', 'Files to read', 'Report']);
});

test('A8: every path to contract/, references/, scripts/ and assets/ uses ${CLAUDE_SKILL_DIR}', () => {
  // The one sentence that explains where the folders are when the variable is
  // not replaced (chat on claude.ai) is allowed to name `scripts/` on its own.
  const fallback = /^`\$\{CLAUDE_SKILL_DIR\}` is the folder of this SKILL\.md\. If it is not replaced.*$/m;
  assert.match(skillMd, fallback);
  const body = skillMd.slice(FRONTMATTER.length).replace(fallback, '');
  const bad = [];
  const re = /(\S*?)\b(contract|references|scripts|assets)\//g;
  let m;
  while ((m = re.exec(body)) !== null) {
    if (!m[1].endsWith('${CLAUDE_SKILL_DIR}/')) bad.push(m[0]);
  }
  assert.deepEqual(bad, []);
});

test('D3: the exact validate and build commands, and every file to read', () => {
  assert.ok(skillMd.includes('node ${CLAUDE_SKILL_DIR}/scripts/validate.mjs <file> --json'));
  assert.ok(skillMd.includes('node ${CLAUDE_SKILL_DIR}/scripts/build.mjs <file> --json'));
  const files = section(skillMd, 'Files to read');
  for (const f of ['catalog.json', 'script.schema.json', 'example.tcia.json']) assert.ok(files.includes(`\${CLAUDE_SKILL_DIR}/contract/${f}`), f);
  for (const f of REFERENCES) assert.ok(files.includes(`\${CLAUDE_SKILL_DIR}/references/${f}`), f);
});

test('references: the six files exist and are in English', () => {
  for (const f of REFERENCES) {
    const text = fs.readFileSync(path.join(SKILL, 'references', f), 'utf8');
    if (f === 'report.md') continue; // it carries a Spanish template on purpose
    assert.ok(englishShare(text) > 0.85, `${f} in English`);
  }
});

test('A62: the hard rules require a gag in every main, branch and ending scene', () => {
  const rules = section(skillMd, 'Hard rules');
  assert.match(rules, /Every scene \(main, branch and ending\) has at least one gag/);
  for (const kind of ['physical gag', 'exaggerated reaction', 'joke']) assert.ok(rules.includes(kind), kind);
});

test('A63: short funny balloons, funny bad endings, family humor, no real violence', () => {
  const rules = section(skillMd, 'Hard rules');
  const guide = fs.readFileSync(path.join(SKILL, 'references', 'comedy-guide.md'), 'utf8');
  for (const text of [rules, guide]) {
    assert.match(text, /short and funny|Short, funny balloons/);
    assert.match(text, /funny too|Bad endings are funny/);
    assert.match(text, /Family humor/);
    assert.match(text, /[Nn]o real violence/);
  }
});

test('A64: the comedy guide maps gags to existing catalog ids', () => {
  const guide = fs.readFileSync(path.join(SKILL, 'references', 'comedy-guide.md'), 'utf8');
  assert.ok(skillMd.includes('${CLAUDE_SKILL_DIR}/references/comedy-guide.md'));
  assert.ok(englishShare(guide) > 0.85);
  for (const rule of ['Sad and scared are comic too', 'Bad endings are funny', 'Family humor', 'No real violence']) assert.ok(guide.includes(rule), rule);
  const table = section(guide, 'Gag table').split('\n').filter((l) => l.startsWith('|') && !l.startsWith('|---'));
  assert.ok(table.length >= 8, 'a gag table');
  for (const kind of ['(physical)', '(reaction)', '(line']) assert.ok(table.some((r) => r.includes(kind)), kind);
  const known = new Set([
    ...Object.keys(catalog.actions), ...Object.values(catalog.actions).flatMap((a) => Object.keys(a.variants)),
    ...Object.keys(catalog.emotions), ...Object.keys(catalog.effects), ...Object.keys(catalog.faces),
    ...Object.keys(catalog.positions), ...Object.keys(catalog.actions.jump.heights), ...Object.keys(catalog.items),
    ...Object.keys(catalog.kinds), ...Object.keys(catalog.pieces), ...Object.keys(catalog.lights), ...Object.keys(catalog.bases),
    ...Object.keys(schema.$defs.beat.properties),
  ]);
  const unknown = [];
  for (const row of table.slice(1)) {
    for (const m of row.matchAll(/`([^`]+)`/g)) {
      for (const token of m[1].split(/[ .,]+/)) {
        if (/^\d+$/.test(token) || token === '') continue;
        if (!known.has(token)) unknown.push(token);
      }
    }
  }
  assert.deepEqual(unknown, []);
});

test('A65: the workflow reviews the gags before building, and the report lists them', () => {
  const workflow = section(skillMd, 'Workflow');
  const review = workflow.indexOf('Review the gags');
  const build = workflow.indexOf('scripts/build.mjs');
  assert.ok(review > 0 && build > review, 'gag review before the build step');
  assert.match(workflow.slice(review, build), /every scene, main, branch and ending/);
  const report = fs.readFileSync(path.join(SKILL, 'references', 'report.md'), 'utf8');
  assert.match(report, /\*\*El gag de cada escena\*\*/);
  assert.match(report, /\*\*The gag of each scene\*\*/);
});

const README_EN = ['What it is', 'Examples', 'Install', 'Use', 'What you can ask for', 'Limits', 'Requirements', 'How it works', 'Contributing', 'License'];
const README_ES = ['Qué es', 'Ejemplos', 'Instalar', 'Usar', 'Qué se puede pedir', 'Límites', 'Requisitos', 'Cómo funciona', 'Contribuir', 'Licencia'];
const INSTALL = [
  '/plugin marketplace add SOLARE-TI/tcia',
  '/plugin install tcia@tcia',
  'claude plugin marketplace add SOLARE-TI/tcia',
  'claude plugin install tcia@tcia',
];

test('A9: both READMEs have the same ## headings in the D18 order and the install commands', () => {
  const en = read('README.md');
  const es = read('README.es.md');
  assert.deepEqual(headings(en), README_EN);
  assert.deepEqual(headings(es), README_ES);
  for (const c of INSTALL) {
    assert.ok(en.split('\n').includes(c), `README.md: ${c}`);
    assert.ok(es.split('\n').includes(c), `README.es.md: ${c}`);
  }
  assert.ok(en.includes('README.es.md') && es.includes('README.md'));
  assert.ok(englishShare(en) > 0.85);
  assert.ok(englishShare(es) < 0.3);
});

test('A10: CLAUDE.md is in English with the D18 table and commands', () => {
  const md = read('CLAUDE.md');
  assert.ok(englishShare(md) > 0.85);
  assert.ok(md.includes("| If you're going to… | Read… |"));
  for (const row of [
    'change how something is drawn or animated',
    'change the validator or its messages',
    'change the builder or the engine placeholder',
    'add an action variant, a piece, a kind or any catalog id',
    'change the script format',
    'edit what the skill tells Claude',
    'add or rebuild an example',
    'run the tests',
    'release a version',
  ]) assert.ok(md.includes(`| ${row} |`), row);
  for (const c of ['npm test', 'npm run test:engine', 'npm run test:validator', 'npm run test:examples', 'npm run test:repo',
    'npm run build:engine', 'npm run check:engine', 'npm run build:examples', 'claude plugin validate .', 'claude --plugin-dir ./plugins/tcia']) {
    assert.ok(md.includes(c), c);
  }
  for (const rule of ['Zero dependencies', 'Node.js 22 or newer', 'The contract does not change without a spec', 'is generated', 'under 500 lines', 'No names of existing works', 'Tests never write inside the repository']) {
    assert.ok(md.includes(rule), rule);
  }
});

test('no file says "inspired by" or "in the style of" a work', () => {
  for (const rel of ['README.md', 'README.es.md', 'CLAUDE.md']) {
    assert.doesNotMatch(read(rel), /inspired by|inspirad[oa] en|al estilo de/i, rel);
  }
  assert.doesNotMatch(skillMd, /inspired by|in the style of/i);
});

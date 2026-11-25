// Shared paths and loaders for the engine tests. Tests only write under os.tmpdir().
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(here, '..', '..', '..');
export const SKILL = path.join(REPO, 'plugins', 'tcia', 'skills', 'tcia');
export const CATALOG_PATH = path.join(SKILL, 'contract', 'catalog.json');
export const EXAMPLE_PATH = path.join(SKILL, 'contract', 'example.tcia.json');
export const ENGINE_HTML = path.join(SKILL, 'assets', 'engine.html');
export const FIXTURES = path.join(REPO, 'tests', 'engine', 'fixtures');

export function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
export function loadCatalog() { return readJson(CATALOG_PATH); }
export function loadExample() { return readJson(EXAMPLE_PATH); }

// the contract example, every examples/<slug>/<slug>.tcia.json that exists, and our own fixtures
export function allScripts() {
  const out = [{ name: 'contract/example.tcia.json', file: EXAMPLE_PATH }];
  const ex = path.join(REPO, 'examples');
  if (fs.existsSync(ex)) {
    for (const d of fs.readdirSync(ex).sort()) {
      const f = path.join(ex, d, d + '.tcia.json');
      if (fs.existsSync(f)) out.push({ name: 'examples/' + d, file: f });
    }
  }
  for (const f of fs.readdirSync(FIXTURES).sort()) if (f.endsWith('.tcia.json')) out.push({ name: 'fixtures/' + f, file: path.join(FIXTURES, f) });
  return out.map((s) => Object.assign(s, { script: readJson(s.file) }));
}

// every combination of option indexes, decisions in story order
export function combos(story) {
  let acc = [[]];
  for (const d of story.decisions) {
    const next = [];
    for (const c of acc) for (let i = 0; i < d.options.length; i++) next.push(c.concat([i]));
    acc = next;
  }
  return acc;
}

// play a whole path with the Player, choosing by index; calls onFrame(frame, player) after each step
export function playPath(createPlayer, story, picks, dt, onFrame) {
  const p = createPlayer(story);
  p.start();
  let k = 0;
  let guard = 0;
  const events = [];
  while (p.state !== 'ended' && guard++ < 200000) {
    if (p.state === 'deciding') { p.choose(picks[k++] || 0); continue; }
    events.push(...p.advance(dt));
    if (onFrame) onFrame(p.frame(), p);
  }
  return { player: p, events };
}

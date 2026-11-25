#!/usr/bin/env node
// Rebuilds every example with the builder: examples/<slug>/<slug>.html from
// examples/<slug>/<slug>.tcia.json. Run it with `npm run build:examples`
// after changing the engine or an example script.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const builder = path.join(here, '..', 'plugins', 'tcia', 'skills', 'tcia', 'scripts', 'build.mjs');

const slugs = fs.readdirSync(here, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

let failed = 0;
for (const slug of slugs) {
  const folder = path.join(here, slug);
  const script = path.join(folder, `${slug}.tcia.json`);
  const r = spawnSync(process.execPath, [builder, script, '--out', folder], { encoding: 'utf8' });
  if (r.status === 0) {
    console.log(`built  ${slug}`);
  } else {
    failed++;
    console.log(`FAILED ${slug} (exit ${r.status})`);
    process.stdout.write(r.stdout.replace(/^/gm, '  '));
    process.stderr.write(r.stderr);
  }
}
console.log(failed === 0 ? `OK: ${slugs.length} examples built.` : `FAIL: ${failed} of ${slugs.length} examples did not build.`);
process.exit(failed === 0 ? 0 : 1);

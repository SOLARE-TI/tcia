// Loads the contract files that live next to the scripts, wherever the skill
// is installed.

import { readFileSync } from 'node:fs';

const CONTRACT_DIR = new URL('../../contract/', import.meta.url);

export function loadContract() {
  return {
    catalog: JSON.parse(readFileSync(new URL('catalog.json', CONTRACT_DIR), 'utf8')),
    schema: JSON.parse(readFileSync(new URL('script.schema.json', CONTRACT_DIR), 'utf8')),
  };
}

export const DEFAULT_ENGINE = new URL('../../assets/engine.html', import.meta.url);

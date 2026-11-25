// Walks the repository for the repo tests: every file except .git/,
// node_modules/ and what .gitignore leaves out (D19 list).

import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../validator/helpers.mjs';

const IGNORED_DIRS = new Set(['.git', 'node_modules']);
const IGNORED = [/(^|\/)\.DS_Store$/, /(^|\/)Thumbs\.db$/, /\.log$/, /\.tmp$/, /^engine\/dist(\/|$)/];

// Relative paths with forward slashes, sorted.
export function repoFiles({ includeIgnored = false } = {}) {
  const out = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      const rel = path.relative(ROOT, abs).split(path.sep).join('/');
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        if (!includeIgnored && IGNORED.some((re) => re.test(rel))) continue;
        visit(abs);
      } else if (includeIgnored || !IGNORED.some((re) => re.test(rel))) {
        out.push(rel);
      }
    }
  };
  visit(ROOT);
  return out.sort();
}

export function isBinary(buffer) {
  return buffer.includes(0);
}

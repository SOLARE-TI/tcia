// Headless Chrome for the engine tests (D13.8). No dependencies; temp profiles are removed afterwards.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function findChrome() {
  if (process.env.TCIA_CHROME) return process.env.TCIA_CHROME;
  const names = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome'];
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const n of names) {
    for (const d of dirs) {
      const p = path.join(d, n);
      try { fs.accessSync(p, fs.constants.X_OK); return p; } catch (e) { /* keep looking */ }
    }
  }
  const fixed = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];
  for (const p of fixed) if (fs.existsSync(p)) return p;
  return null;
}

export const CHROME_SKIP = 'Chrome not found: set TCIA_CHROME';

function run(htmlPath, opts, extra) {
  const chrome = findChrome();
  if (!chrome) throw new Error(CHROME_SKIP);
  const o = opts || {};
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcia-chrome-'));
  const url = pathToFileURL(htmlPath).href + (o.hash ? '#' + o.hash : '');
  const args = ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--virtual-time-budget=' + (o.budgetMs || 600000), '--window-size=' + (o.width || 1920) + ',' + (o.height || 1080),
    '--user-data-dir=' + dir].concat(extra, [url]);
  try {
    const r = spawnSync(chrome, args, { encoding: 'utf8', timeout: o.timeoutMs || 180000, maxBuffer: 64 * 1024 * 1024 });
    return { dom: r.stdout || '', stderr: r.stderr || '', code: r.status };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export function dumpDom(htmlPath, opts) { return run(htmlPath, opts, ['--dump-dom']); }

export function screenshot(htmlPath, opts) {
  const o = opts || {};
  const r = run(htmlPath, o, ['--screenshot=' + o.out]);
  return { code: r.code, stderr: r.stderr, out: o.out };
}

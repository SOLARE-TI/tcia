// A13: Node.js 22 or newer.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkNode } from '../../plugins/tcia/skills/tcia/scripts/lib/node-version.mjs';
import { VALIDATE, BUILD, EXAMPLE, tempDir, runNode } from './helpers.mjs';

test('checkNode', () => {
  assert.equal(checkNode('20.11.0'), 'TCIA needs Node.js 22 or newer (found 20.11.0).');
  assert.equal(checkNode('v18.0.0'), 'TCIA needs Node.js 22 or newer (found v18.0.0).');
  assert.equal(checkNode('22.0.0'), null);
  assert.equal(checkNode('v24.1.0'), null);
  assert.equal(checkNode('garbage'), 'TCIA needs Node.js 22 or newer (found garbage).');
});

// Runs a CLI under a preload that makes it see Node 20.11.0.
function asOldNode(t, script, args) {
  const dir = tempDir(t);
  const preload = path.join(dir, 'old-node.mjs');
  fs.writeFileSync(preload,
    "Object.defineProperty(process, 'version', { value: 'v20.11.0' });\n" +
    "Object.defineProperty(process.versions, 'node', { value: '20.11.0' });\n");
  return { result: runNode(script, args, { nodeArgs: ['--import', preload] }), dir };
}

for (const [name, script] of [['validate.mjs', VALIDATE], ['build.mjs', BUILD]]) {
  test(`${name} exits 2 on old Node`, (t) => {
    const out = path.join(tempDir(t), 'out');
    const { result } = asOldNode(t, script, [EXAMPLE, ...(name === 'build.mjs' ? ['--out', out] : [])]);
    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.match(result.stdout, /ERROR E_NODE_VERSION TCIA needs Node\.js 22 or newer \(found 20\.11\.0\)\./);
    assert.equal(fs.existsSync(out), false);
  });

  test(`${name} --json exits 2 on old Node`, (t) => {
    const { result } = asOldNode(t, script, [EXAMPLE, '--json']);
    assert.equal(result.status, 2);
    const json = JSON.parse(result.stdout);
    assert.equal(json.ok, false);
    assert.equal(json.errors[0].code, 'E_NODE_VERSION');
  });
}

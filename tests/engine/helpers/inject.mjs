// Copy of the D12 injection, used only by the engine tests to arm their fixtures.
// The real one belongs to the builder (scripts/lib/inject.mjs); this copy keeps tests/engine independent.
const MARK = '__TCIA_' + 'SCRIPT_JSON__';

export function escapeForScript(json) {
  return json.replace(/[<>&\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

export function inject(engineHtml, script) {
  const n = engineHtml.split(MARK).length - 1;
  if (n !== 1) throw new Error('Engine template must contain the script placeholder exactly once (found ' + n + ').');
  const json = escapeForScript(JSON.stringify(script));
  return engineHtml.replace(MARK, () => json);
}

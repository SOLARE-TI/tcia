// Engine <-> builder interface (D12).

export const PLACEHOLDER = '__TCIA_SCRIPT_JSON__';

// Number of times the placeholder appears in the engine template.
export function countPlaceholders(engineHtml) {
  return engineHtml.split(PLACEHOLDER).length - 1;
}

// Value of <meta name="tcia-format" content="N">, or null.
export function engineFormat(engineHtml) {
  const m = /<meta\s+name="tcia-format"\s+content="([^"]*)"\s*\/?>/i.exec(engineHtml);
  return m ? m[1] : null;
}

// Script JSON that is safe inside <script type="application/json">: compact,
// keys in input order, and <, >, &, U+2028, U+2029 as JSON escape sequences.
export function scriptJson(script) {
  return JSON.stringify(script)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// inject(engineHtml, script) -> html. The replacement is a function so that
// "$&", "$'" and similar sequences in the script are copied literally.
export function inject(engineHtml, script) {
  const n = countPlaceholders(engineHtml);
  if (n !== 1) {
    const e = new Error(`Engine template must contain the script placeholder exactly once (found ${n}).`);
    e.code = 'E_ENGINE_TEMPLATE';
    throw e;
  }
  const json = scriptJson(script);
  return engineHtml.replace(PLACEHOLDER, () => json);
}

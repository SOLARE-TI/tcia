// Minimal JSON Schema checker with no dependencies (D10.2). It implements only
// the keywords that contract/script.schema.json uses.

import { join } from './pointer.mjs';
import { codePoints } from './text.mjs';
import { closest } from './suggest.mjs';

export const SUPPORTED_KEYWORDS = [
  '$schema', '$id', '$defs', '$ref', 'title', 'description',
  'type', 'properties', 'required', 'additionalProperties', 'items',
  'minItems', 'maxItems', 'enum', 'const', 'pattern', 'minLength', 'maxLength',
  'minimum', 'maximum', 'oneOf',
];

// Returns [{ keyword, path, message, suggestion, count?, min?, max? }] in
// document order of the instance.
export function checkSchema(instance, schema) {
  const errors = [];
  validateNode(instance, schema, '', schema, errors);
  return errors;
}

export function showPath(path) {
  return path === '' ? '/' : path;
}

function resolveRef(root, ref) {
  if (typeof ref !== 'string' || !ref.startsWith('#')) {
    throw new TypeError(`Only local $ref is supported (found ${ref})`);
  }
  const tokens = ref.slice(1).split('/').slice(1).map((t) => t.replace(/~1/g, '/').replace(/~0/g, '~'));
  let node = root;
  for (const t of tokens) {
    if (node === undefined || node === null) break;
    node = node[t];
  }
  if (node === undefined) throw new TypeError(`Unresolved $ref ${ref}`);
  return node;
}

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
}

function matchesType(value, type) {
  const actual = typeOf(value);
  if (type === 'number') return actual === 'number' || actual === 'integer';
  return actual === type;
}

function shownType(value) {
  const t = typeOf(value);
  return t === 'integer' ? 'number' : t;
}

function push(errors, keyword, path, message, extra = {}) {
  errors.push({ keyword, path, message, suggestion: null, ...extra });
}

function validateNode(value, node, path, root, errors) {
  if (node === true || node === undefined) return;
  if (node.$ref !== undefined) {
    validateNode(value, resolveRef(root, node.$ref), path, root, errors);
  }
  const p = showPath(path);

  if (node.type !== undefined && !matchesType(value, node.type)) {
    push(errors, 'type', path, `${p}: expected ${node.type}, got ${shownType(value)}.`);
    return;
  }

  if (node.const !== undefined && value !== node.const) {
    push(errors, 'const', path, `${p}: must be one of ${JSON.stringify(node.const)}.`);
  }
  if (node.enum !== undefined && !node.enum.includes(value)) {
    push(errors, 'enum', path, `${p}: must be one of ${node.enum.map((v) => JSON.stringify(v)).join(', ')}.`);
  }

  if (typeof value === 'string') {
    if (node.pattern !== undefined && !new RegExp(node.pattern, 'u').test(value)) {
      const why = node.description ? node.description.replace(/\.$/, '') : `pattern ${node.pattern}`;
      push(errors, 'pattern', path, `${p}: "${value}" has the wrong format (${why}).`);
    }
    const n = codePoints(value);
    const minL = node.minLength;
    const maxL = node.maxLength;
    if ((minL !== undefined && n < minL) || (maxL !== undefined && n > maxL)) {
      const range = maxL === undefined ? `${minL} or more` : `${minL ?? 0}–${maxL}`;
      push(errors, n < (minL ?? 0) ? 'minLength' : 'maxLength', path, `${p}: text must have ${range} characters (has ${n}).`);
    }
  }

  if (typeof value === 'number') {
    if ((node.minimum !== undefined && value < node.minimum) || (node.maximum !== undefined && value > node.maximum)) {
      push(errors, value < node.minimum ? 'minimum' : 'maximum', path,
        `${p}: must be between ${node.minimum} and ${node.maximum} (is ${value}).`);
    }
  }

  if (Array.isArray(value)) {
    const n = value.length;
    if ((node.minItems !== undefined && n < node.minItems) || (node.maxItems !== undefined && n > node.maxItems)) {
      push(errors, n < node.minItems ? 'minItems' : 'maxItems', path,
        `${p}: must have ${node.minItems ?? 0}–${node.maxItems} items (has ${n}).`,
        { count: n, min: node.minItems, max: node.maxItems });
    }
    if (node.items !== undefined) {
      value.forEach((item, i) => validateNode(item, node.items, join(path, i), root, errors));
    }
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const props = node.properties || {};
    for (const name of node.required || []) {
      if (!Object.prototype.hasOwnProperty.call(value, name)) {
        push(errors, 'required', path, `${p}: missing required field "${name}".`);
      }
    }
    for (const key of Object.keys(value)) {
      if (Object.prototype.hasOwnProperty.call(props, key)) {
        validateNode(value[key], props[key], join(path, key), root, errors);
      } else if (node.additionalProperties === false) {
        const guess = closest(key, Object.keys(props));
        push(errors, 'additionalProperties', path,
          `${p}: unknown field "${key}".` + (guess ? ` Did you mean "${guess}"?` : ''),
          { suggestion: guess });
      }
    }
  }

  if (node.oneOf !== undefined) {
    const results = node.oneOf.map((branch) => {
      const branchErrors = [];
      validateNode(value, branch, path, root, branchErrors);
      return branchErrors;
    });
    const passing = results.filter((r) => r.length === 0).length;
    if (passing !== 1) {
      let reported = false;
      if (passing === 0 && value !== null && typeof value === 'object' && !Array.isArray(value)) {
        const index = node.oneOf.findIndex((branch) => {
          const target = branch.$ref !== undefined ? resolveRef(root, branch.$ref) : branch;
          const required = target.required || [];
          return required.length > 0 && required.every((k) => Object.prototype.hasOwnProperty.call(value, k));
        });
        if (index >= 0) {
          errors.push(...results[index]);
          reported = true;
        }
      }
      if (!reported) push(errors, 'oneOf', path, `${p}: does not match any allowed form.`);
    }
  }
}

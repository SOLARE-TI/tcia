// JSON Pointer helpers (RFC 6901).

export function escapeToken(token) {
  return String(token).replace(/~/g, '~0').replace(/\//g, '~1');
}

export function join(base, ...tokens) {
  return base + tokens.map((t) => '/' + escapeToken(t)).join('');
}

// Pre-order walk of a parsed document: pointer -> sequence number.
// Used to sort findings in document order.
export function documentOrder(doc) {
  const order = new Map();
  let seq = 0;
  const visit = (value, path) => {
    order.set(path, seq++);
    if (Array.isArray(value)) {
      value.forEach((v, i) => visit(v, join(path, i)));
    } else if (value !== null && typeof value === 'object') {
      for (const key of Object.keys(value)) visit(value[key], join(path, key));
    }
  };
  visit(doc, '');
  return order;
}

// Sequence number of a pointer, falling back to its closest existing ancestor.
export function orderOf(order, path) {
  let p = path;
  for (;;) {
    if (order.has(p)) return order.get(p);
    if (p === '') return 0;
    p = p.slice(0, p.lastIndexOf('/'));
  }
}

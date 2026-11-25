// Node.js version gate (D5, V2). Kept free of modern syntax so that it runs
// on old Node versions and can explain what is missing.

export var MIN_NODE_MAJOR = 22;

// checkNode('20.11.0') -> message; checkNode('22.0.0') -> null.
// Accepts the version with or without a leading "v".
export function checkNode(versionString) {
  var text = String(versionString == null ? '' : versionString).trim();
  var match = /^v?(\d+)(?:\.\d+)*/.exec(text);
  var major = match ? Number(match[1]) : NaN;
  if (!(major >= MIN_NODE_MAJOR)) {
    return 'TCIA needs Node.js 22 or newer (found ' + (text || 'unknown') + ').';
  }
  return null;
}

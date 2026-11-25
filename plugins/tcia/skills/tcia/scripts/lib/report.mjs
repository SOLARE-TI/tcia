// Output of the validator and the builder (D10.5).

const MAX_LINES = 50;

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function findingLine(level, f) {
  const prefix = f.path !== '' && !f.message.startsWith(`${f.path}:`) ? `${f.path}: ` : '';
  return `${level.padEnd(5)} ${f.code} ${prefix}${f.message}`;
}

// Plain-text report: one line per finding (at most 50), then OK: or FAIL:.
export function formatText(result) {
  const lines = [];
  const findings = [
    ...result.errors.map((f) => ({ level: 'ERROR', f })),
    ...result.warnings.map((f) => ({ level: 'WARN', f })),
  ];
  findings.slice(0, MAX_LINES).forEach(({ level, f }) => {
    lines.push(findingLine(level, f));
    if (f.suggestion) lines.push(`  suggestion: ${f.suggestion}`);
    if (f.approximation && f.approximation.to) lines.push(`  approximation: ${JSON.stringify(f.approximation.to)}`);
  });
  if (findings.length > MAX_LINES) lines.push(`…and ${findings.length - MAX_LINES} more.`);
  if (result.ok) {
    const s = result.stats;
    lines.push(
      `OK: ${plural(s.mainScenes, 'main scene')}, ${plural(s.branchScenes, 'branch scene')}, ` +
      `${plural(s.decisions, 'decision')}, ${plural(s.paths, 'path')}, ${plural(s.endings, 'ending')}, ` +
      `${s.secondsMin}-${s.secondsMax} s.`,
    );
  } else {
    lines.push(`FAIL: ${plural(result.errors.length, 'error')}, ${plural(result.warnings.length, 'warning')}.`);
  }
  return lines.join('\n') + '\n';
}

// WARN lines only (used by the builder when the script is valid).
export function formatWarnings(warnings) {
  return warnings.map((f) => findingLine('WARN', f) + '\n').join('');
}

// The --json object, with exactly these keys.
export function jsonReport(file, result) {
  return {
    ok: result.ok,
    file,
    errors: result.errors,
    warnings: result.warnings,
    stats: result.stats,
  };
}

// A single-error result for usage, Node version and engine problems.
export function failure(code, message, path = '') {
  return {
    ok: false,
    errors: [{ code, path, message, suggestion: null, approximation: null }],
    warnings: [],
    stats: null,
  };
}

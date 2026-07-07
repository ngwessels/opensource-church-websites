/**
 * @param {unknown} before
 * @param {unknown} after
 * @returns {Array<{ path: string, before: unknown, after: unknown, type: 'added' | 'removed' | 'changed' }>}
 */
export function diffSnapshots(before, after) {
  /** @type {Array<{ path: string, before: unknown, after: unknown, type: 'added' | 'removed' | 'changed' }>} */
  const changes = [];
  walkDiff("", before, after, changes);
  return changes;
}

/**
 * @param {string} path
 * @param {unknown} before
 * @param {unknown} after
 * @param {Array<{ path: string, before: unknown, after: unknown, type: 'added' | 'removed' | 'changed' }>} changes
 */
function walkDiff(path, before, after, changes) {
  if (isEqual(before, after)) return;

  if (!isObject(before) || !isObject(after) || Array.isArray(before) !== Array.isArray(after)) {
    changes.push({
      path: path || "(root)",
      before,
      after,
      type:
        before === undefined
          ? "added"
          : after === undefined
            ? "removed"
            : "changed",
    });
    return;
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const max = Math.max(before.length, after.length);
    for (let index = 0; index < max; index += 1) {
      walkDiff(`${path}[${index}]`, before[index], after[index], changes);
    }
    return;
  }

  const beforeObj = /** @type {Record<string, unknown>} */ (before);
  const afterObj = /** @type {Record<string, unknown>} */ (after);
  const keys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);

  for (const key of keys) {
    const nextPath = path ? `${path}.${key}` : key;
    walkDiff(nextPath, beforeObj[key], afterObj[key], changes);
  }
}

/**
 * @param {unknown} a
 * @param {unknown} b
 */
function isEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * @param {unknown} value
 */
function isObject(value) {
  return value !== null && typeof value === "object";
}

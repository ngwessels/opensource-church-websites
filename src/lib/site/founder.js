/**
 * Resolve the original (founder) account for a site from user profile records.
 * @param {Array<{ id: string, isFounder?: boolean, createdAt?: string }>} users
 * @returns {string | null}
 */
export function getFounderUserId(users) {
  if (!users?.length) return null;

  const flagged = users.find((u) => u.isFounder === true);
  if (flagged) return flagged.id;

  const sorted = [...users].sort((a, b) =>
    String(a.createdAt || "").localeCompare(String(b.createdAt || "")),
  );
  return sorted[0]?.id ?? null;
}

/**
 * @param {Array<{ id: string, isFounder?: boolean, createdAt?: string }>} users
 * @param {string | null | undefined} uid
 */
export function isFounderUser(users, uid) {
  if (!uid) return false;
  return getFounderUserId(users) === uid;
}

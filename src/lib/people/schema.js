import { generateId } from "@/lib/sitemap/tree";

/** @returns {string} */
export function generatePersonId() {
  return generateId();
}

/**
 * @param {unknown} raw
 * @returns {import('./types').Person}
 */
export function normalizePerson(raw) {
  if (!raw || typeof raw !== "object") {
    return {
      id: generatePersonId(),
      name: "",
      role: "",
      email: "",
      phone: "",
      photoUrl: "",
    };
  }
  const p = /** @type {Record<string, unknown>} */ (raw);
  return {
    id: typeof p.id === "string" ? p.id : generatePersonId(),
    name: typeof p.name === "string" ? p.name : "",
    role: typeof p.role === "string" ? p.role : "",
    email: typeof p.email === "string" ? p.email : "",
    phone: typeof p.phone === "string" ? p.phone : "",
    photoUrl: typeof p.photoUrl === "string" ? p.photoUrl : "",
  };
}

/**
 * @param {unknown} raw
 * @param {{ filterEmpty?: boolean }} [options]
 * @returns {import('./types').PeopleModuleConfig}
 */
export function normalizePeopleConfig(raw, options = {}) {
  const { filterEmpty = false } = options;

  if (!raw || typeof raw !== "object") {
    return { title: "Staff", people: [] };
  }

  const c = /** @type {Record<string, unknown>} */ (raw);
  const people = Array.isArray(c.people) ? c.people.map(normalizePerson) : [];

  const filtered = filterEmpty
    ? people.filter((person) => person.name.trim().length > 0)
    : people;

  return {
    title: typeof c.title === "string" && c.title.trim() ? c.title.trim() : "Staff",
    people: filtered.map((person) => ({
      id: person.id,
      name: person.name.trim(),
      ...(person.role.trim() ? { role: person.role.trim() } : {}),
      ...(person.email.trim() ? { email: person.email.trim() } : {}),
      ...(person.phone.trim() ? { phone: person.phone.trim() } : {}),
      ...(person.photoUrl.trim() ? { photoUrl: person.photoUrl.trim() } : {}),
    })),
  };
}

/**
 * @returns {import('./types').Person}
 */
export function createEmptyPerson() {
  return normalizePerson(null);
}

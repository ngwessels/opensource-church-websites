import { MODULE_CATEGORIES } from "@/types/firestore";

/** Flat list of all module types for MCP validation and tooling. */
export const MODULE_TYPES = Object.values(MODULE_CATEGORIES).flat();

/** @param {string} type */
export function isModuleType(type) {
  return MODULE_TYPES.includes(type);
}

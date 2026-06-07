/** Maps legacy color-swap theme ids to new design theme ids. */
export const LEGACY_THEME_ID_MAP = {
  classic: "verona",
  modern: "condit",
  earth: "nazareth",
  slate: "kolbe",
  "crimson-faith": "calvary",
  "sacred-heart": "lucca",
  "advent-blue": "loyola",
  "coastal-breeze": "turin",
  "forest-chapel": "olivet",
  "spring-garden": "eden",
  "harvest-gold": "tabor",
  pentecost: "sinai",
  "royal-purple": "cyprus",
  "lavender-peace": "turin",
  "monastery-stone": "damascus",
  "midnight-prayer": "loyola",
  "cloud-white": "kolbe",
  "carmel-brown": "nazareth",
  "marian-blue": "verona",
  "rose-window": "lucca",
  "olive-branch": "eden",
  "ember-glow": "sinai",
  "silver-lining": "kolbe",
  "golden-dome": "calvary",
};

/**
 * Resolve a theme id, migrating legacy ids to current catalog ids.
 * @param {string} [themeId]
 * @returns {string}
 */
export function resolveThemeId(themeId) {
  if (!themeId) return "verona";
  return LEGACY_THEME_ID_MAP[themeId] || themeId;
}

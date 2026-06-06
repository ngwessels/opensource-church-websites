/** @typedef {"red"|"orange"|"gold"|"green"|"blue"|"purple"|"pink"|"brown"|"black"|"grey"|"white"} DominantColor */
/** @typedef {"light"|"dark"} ThemeMood */
/** @typedef {"centered"|"logoLeft"} HeaderLayout */
/** @typedef {"solid"|"transparent"} NavStyle */

/**
 * @typedef {Object} ThemeMeta
 * @property {DominantColor} dominantColor
 * @property {ThemeMood} mood
 */

/**
 * @typedef {Object} Theme
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {{ primary: string, secondary: string, accent: string }} colors
 * @property {{ heading: string, body: string }} fonts
 * @property {{ header: HeaderLayout, nav: NavStyle }} layout
 * @property {ThemeMeta} meta
 */

/** @type {Theme[]} */
export const THEME_CATALOG = [
  {
    id: "classic",
    name: "Classic Parish",
    description: "Traditional serif headings with deep red and navy accents.",
    colors: { primary: "#7f1d1d", secondary: "#1e3a5f", accent: "#d97706" },
    fonts: { heading: "Georgia, serif", body: "Arial, sans-serif" },
    layout: { header: "centered", nav: "solid" },
    meta: { dominantColor: "red", mood: "light" },
  },
  {
    id: "modern",
    name: "Modern Light",
    description: "Clean sans-serif with blue and teal palette.",
    colors: { primary: "#1d4ed8", secondary: "#0f766e", accent: "#f59e0b" },
    fonts: { heading: "var(--font-geist-sans), sans-serif", body: "var(--font-geist-sans), sans-serif" },
    layout: { header: "logoLeft", nav: "solid" },
    meta: { dominantColor: "blue", mood: "light" },
  },
  {
    id: "earth",
    name: "Earth Tones",
    description: "Warm browns and greens for a welcoming feel.",
    colors: { primary: "#78350f", secondary: "#365314", accent: "#ca8a04" },
    fonts: { heading: "Palatino, serif", body: "Helvetica, sans-serif" },
    layout: { header: "centered", nav: "solid" },
    meta: { dominantColor: "brown", mood: "light" },
  },
  {
    id: "slate",
    name: "Slate Minimal",
    description: "Neutral grays with a single accent color.",
    colors: { primary: "#334155", secondary: "#1e293b", accent: "#6366f1" },
    fonts: { heading: "var(--font-geist-sans), sans-serif", body: "var(--font-geist-sans), sans-serif" },
    layout: { header: "centered", nav: "transparent" },
    meta: { dominantColor: "grey", mood: "light" },
  },
  {
    id: "crimson-faith",
    name: "Crimson Faith",
    description: "Bold crimson header with gold highlights.",
    colors: { primary: "#991b1b", secondary: "#450a0a", accent: "#eab308" },
    fonts: { heading: "Times New Roman, serif", body: "Arial, sans-serif" },
    layout: { header: "centered", nav: "solid" },
    meta: { dominantColor: "red", mood: "dark" },
  },
  {
    id: "sacred-heart",
    name: "Sacred Heart",
    description: "Deep rose and burgundy with soft pink accents.",
    colors: { primary: "#9f1239", secondary: "#4c0519", accent: "#fda4af" },
    fonts: { heading: "Garamond, serif", body: "Verdana, sans-serif" },
    layout: { header: "logoLeft", nav: "solid" },
    meta: { dominantColor: "pink", mood: "dark" },
  },
  {
    id: "advent-blue",
    name: "Advent Blue",
    description: "Royal blue and silver for a contemplative tone.",
    colors: { primary: "#1e40af", secondary: "#1e3a8a", accent: "#94a3b8" },
    fonts: { heading: "Georgia, serif", body: "Arial, sans-serif" },
    layout: { header: "centered", nav: "solid" },
    meta: { dominantColor: "blue", mood: "dark" },
  },
  {
    id: "coastal-breeze",
    name: "Coastal Breeze",
    description: "Ocean blues with sandy neutrals.",
    colors: { primary: "#0369a1", secondary: "#0c4a6e", accent: "#fbbf24" },
    fonts: { heading: "var(--font-geist-sans), sans-serif", body: "var(--font-geist-sans), sans-serif" },
    layout: { header: "logoLeft", nav: "transparent" },
    meta: { dominantColor: "blue", mood: "light" },
  },
  {
    id: "forest-chapel",
    name: "Forest Chapel",
    description: "Evergreen and moss tones rooted in nature.",
    colors: { primary: "#166534", secondary: "#14532d", accent: "#a3e635" },
    fonts: { heading: "Palatino, serif", body: "Helvetica, sans-serif" },
    layout: { header: "centered", nav: "solid" },
    meta: { dominantColor: "green", mood: "dark" },
  },
  {
    id: "spring-garden",
    name: "Spring Garden",
    description: "Fresh greens with floral accent warmth.",
    colors: { primary: "#15803d", secondary: "#4d7c0f", accent: "#f472b6" },
    fonts: { heading: "Georgia, serif", body: "Arial, sans-serif" },
    layout: { header: "logoLeft", nav: "solid" },
    meta: { dominantColor: "green", mood: "light" },
  },
  {
    id: "harvest-gold",
    name: "Harvest Gold",
    description: "Amber and wheat tones for autumn warmth.",
    colors: { primary: "#b45309", secondary: "#92400e", accent: "#fde047" },
    fonts: { heading: "Times New Roman, serif", body: "Verdana, sans-serif" },
    layout: { header: "centered", nav: "solid" },
    meta: { dominantColor: "gold", mood: "light" },
  },
  {
    id: "pentecost",
    name: "Pentecost",
    description: "Fiery orange and red for celebration.",
    colors: { primary: "#c2410c", secondary: "#9a3412", accent: "#fbbf24" },
    fonts: { heading: "Georgia, serif", body: "Arial, sans-serif" },
    layout: { header: "centered", nav: "solid" },
    meta: { dominantColor: "orange", mood: "dark" },
  },
  {
    id: "royal-purple",
    name: "Royal Purple",
    description: "Liturgical purple with gold trim.",
    colors: { primary: "#6b21a8", secondary: "#581c87", accent: "#fbbf24" },
    fonts: { heading: "Garamond, serif", body: "Arial, sans-serif" },
    layout: { header: "centered", nav: "solid" },
    meta: { dominantColor: "purple", mood: "dark" },
  },
  {
    id: "lavender-peace",
    name: "Lavender Peace",
    description: "Soft violet and lilac for gentle reflection.",
    colors: { primary: "#7c3aed", secondary: "#5b21b6", accent: "#c4b5fd" },
    fonts: { heading: "var(--font-geist-sans), sans-serif", body: "var(--font-geist-sans), sans-serif" },
    layout: { header: "logoLeft", nav: "transparent" },
    meta: { dominantColor: "purple", mood: "light" },
  },
  {
    id: "monastery-stone",
    name: "Monastery Stone",
    description: "Weathered stone grays with muted warmth.",
    colors: { primary: "#57534e", secondary: "#44403c", accent: "#a8a29e" },
    fonts: { heading: "Palatino, serif", body: "Helvetica, sans-serif" },
    layout: { header: "centered", nav: "solid" },
    meta: { dominantColor: "brown", mood: "dark" },
  },
  {
    id: "midnight-prayer",
    name: "Midnight Prayer",
    description: "Deep navy night sky with silver stars.",
    colors: { primary: "#0f172a", secondary: "#020617", accent: "#38bdf8" },
    fonts: { heading: "Georgia, serif", body: "Arial, sans-serif" },
    layout: { header: "centered", nav: "solid" },
    meta: { dominantColor: "black", mood: "dark" },
  },
  {
    id: "cloud-white",
    name: "Cloud White",
    description: "Bright whites with subtle blue-gray accents.",
    colors: { primary: "#f8fafc", secondary: "#e2e8f0", accent: "#3b82f6" },
    fonts: { heading: "var(--font-geist-sans), sans-serif", body: "var(--font-geist-sans), sans-serif" },
    layout: { header: "logoLeft", nav: "transparent" },
    meta: { dominantColor: "white", mood: "light" },
  },
  {
    id: "carmel-brown",
    name: "Carmel Brown",
    description: "Rich chocolate and caramel earth tones.",
    colors: { primary: "#713f12", secondary: "#422006", accent: "#fbbf24" },
    fonts: { heading: "Times New Roman, serif", body: "Verdana, sans-serif" },
    layout: { header: "centered", nav: "solid" },
    meta: { dominantColor: "brown", mood: "light" },
  },
  {
    id: "marian-blue",
    name: "Marian Blue",
    description: "Heavenly blue and white Marian devotion palette.",
    colors: { primary: "#2563eb", secondary: "#1d4ed8", accent: "#ffffff" },
    fonts: { heading: "Garamond, serif", body: "Arial, sans-serif" },
    layout: { header: "centered", nav: "solid" },
    meta: { dominantColor: "blue", mood: "light" },
  },
  {
    id: "rose-window",
    name: "Rose Window",
    description: "Stained-glass rose with deep violet shadows.",
    colors: { primary: "#be185d", secondary: "#831843", accent: "#818cf8" },
    fonts: { heading: "Palatino, serif", body: "Helvetica, sans-serif" },
    layout: { header: "logoLeft", nav: "solid" },
    meta: { dominantColor: "pink", mood: "dark" },
  },
  {
    id: "olive-branch",
    name: "Olive Branch",
    description: "Muted olive and sage for peaceful simplicity.",
    colors: { primary: "#4d7c0f", secondary: "#3f6212", accent: "#d9f99d" },
    fonts: { heading: "Georgia, serif", body: "Arial, sans-serif" },
    layout: { header: "centered", nav: "transparent" },
    meta: { dominantColor: "green", mood: "light" },
  },
  {
    id: "ember-glow",
    name: "Ember Glow",
    description: "Warm ember orange on charcoal foundation.",
    colors: { primary: "#ea580c", secondary: "#292524", accent: "#fcd34d" },
    fonts: { heading: "var(--font-geist-sans), sans-serif", body: "var(--font-geist-sans), sans-serif" },
    layout: { header: "logoLeft", nav: "solid" },
    meta: { dominantColor: "orange", mood: "light" },
  },
  {
    id: "silver-lining",
    name: "Silver Lining",
    description: "Cool silver-gray with indigo highlights.",
    colors: { primary: "#64748b", secondary: "#475569", accent: "#6366f1" },
    fonts: { heading: "var(--font-geist-sans), sans-serif", body: "var(--font-geist-sans), sans-serif" },
    layout: { header: "centered", nav: "transparent" },
    meta: { dominantColor: "grey", mood: "dark" },
  },
  {
    id: "golden-dome",
    name: "Golden Dome",
    description: "Byzantine gold with deep imperial red.",
    colors: { primary: "#ca8a04", secondary: "#7f1d1d", accent: "#fef08a" },
    fonts: { heading: "Times New Roman, serif", body: "Arial, sans-serif" },
    layout: { header: "centered", nav: "solid" },
    meta: { dominantColor: "gold", mood: "dark" },
  },
];

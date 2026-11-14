// Theme presets and font pairs for brand sites. A preset fills in colours and fonts as a starting point;
// each brand can then adjust them in the platform console.
export const FONT_PAIRS = {
  tropical: { label: "Tropical (Outfit + Nunito Sans)", display: "Outfit", body: "Nunito Sans", css: "family=Outfit:wght@500;600;700&family=Nunito+Sans:wght@400;600;700" },
  elegant: { label: "Elegant (Playfair Display + Lato)", display: "Playfair Display", body: "Lato", css: "family=Playfair+Display:wght@600;700&family=Lato:wght@400;700" },
  modern: { label: "Modern (Manrope + Inter)", display: "Manrope", body: "Inter", css: "family=Manrope:wght@600;700;800&family=Inter:wght@400;600;700" },
} as const;
export type FontPair = keyof typeof FONT_PAIRS;
export const fontPair = (k: string) => FONT_PAIRS[(k in FONT_PAIRS ? k : "tropical") as FontPair];

export const PRESETS = {
  tropical: { label: "Tropical: lagoon, coral, sand", color: "#0e8f86", ctaColor: "#ff6f59", bgColor: "#fff8ee", fontPair: "tropical" },
  luxury: { label: "Luxury: navy, gold, ivory", color: "#1f2a44", ctaColor: "#b8912f", bgColor: "#f7f3ec", fontPair: "elegant" },
  minimal: { label: "Minimal: charcoal, blue, white", color: "#2b2f36", ctaColor: "#2563eb", bgColor: "#ffffff", fontPair: "modern" },
} as const;
export type Preset = keyof typeof PRESETS;
export const isPreset = (k: string): k is Preset => k in PRESETS;
export const HEX = /^#[0-9a-fA-F]{6}$/;

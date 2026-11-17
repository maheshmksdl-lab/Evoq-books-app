export type ThemeId = "graphite" | "copper" | "aubergine" | "petrol";

export interface ProductTheme {
  id: ThemeId;
  name: string;
  tagline: string;
  palette: { depth: string; primary: string; action: string; hover: string; soft: string; tint: string; surface: string };
}

export const DEFAULT_THEME: ThemeId = "aubergine";
export const THEME_STORAGE_KEY = "evoq-books:theme";

export const THEMES: ProductTheme[] = [
  { id: "graphite", name: "Graphite & Lime", tagline: "Crisp, grounded, ledger-green accents",
    palette: { depth: "#252D28", primary: "#4D7C0F", action: "#65A30D", hover: "#3F660D", soft: "#B4D77C", tint: "#EAF4D5", surface: "#F6F9EF" } },
  { id: "copper", name: "Burnished Copper", tagline: "Warm, established, understated",
    palette: { depth: "#482B25", primary: "#96543B", action: "#BB704B", hover: "#78432F", soft: "#D9A88D", tint: "#F2E3D9", surface: "#FAF5F1" } },
  { id: "aubergine", name: "Aubergine & Lavender", tagline: "The EVOQ Books default",
    palette: { depth: "#35243F", primary: "#654477", action: "#84609A", hover: "#533665", soft: "#C1A8D0", tint: "#EDE3F1", surface: "#F8F4FA" } },
  { id: "petrol", name: "Deep Petrol & Mint", tagline: "Calm, precise, cool-toned",
    palette: { depth: "#153B3A", primary: "#176B65", action: "#26958A", hover: "#125750", soft: "#8BCBC0", tint: "#D9EEEA", surface: "#F1F8F6" } },
];

export const PALETTE_ROLES: { key: keyof ProductTheme["palette"]; label: string; use: string }[] = [
  { key: "depth", label: "Depth", use: "Sidebar & deep surfaces" },
  { key: "primary", label: "Primary", use: "Primary actions" },
  { key: "action", label: "Action", use: "Interactive accents, focus" },
  { key: "hover", label: "Hover", use: "Hover & pressed states" },
  { key: "soft", label: "Soft", use: "Supporting graphics" },
  { key: "tint", label: "Tint", use: "Subtle highlights, selection" },
  { key: "surface", label: "Surface", use: "Product-tinted surfaces" },
];

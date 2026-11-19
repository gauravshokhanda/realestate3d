import { z } from "zod";

export const themeSchema = z.object({
  accent: z.string().regex(/^#[0-9a-f]{6}$/i, "Use a six-digit hex colour."),
  fontPair: z.enum(["serif-classic", "serif-modern", "sans-minimal", "display-bold"]),
  motion: z.enum(["glide", "editorial", "snappy", "dreamy"]),
  transition: z.enum(["dissolve", "wipe", "zoom-through"]),
  captionStyle: z.enum(["chip", "lowerThird", "minimal"]),
  overlay: z.enum(["grain", "vignette", "none"]),
  logoImage: z.string().max(500).optional(),
}).strict();
export type Theme = z.infer<typeof themeSchema>;
export const defaultTheme: Theme = {
  accent: "#D8B67A", fontPair: "serif-classic", motion: "glide", transition: "dissolve", captionStyle: "chip", overlay: "grain",
};
export function resolveTheme(development: unknown, property?: unknown): Theme {
  const defaults = themeSchema.partial().safeParse(development);
  const overrides = themeSchema.partial().safeParse(property);
  return { ...defaultTheme, ...(defaults.success ? defaults.data : {}), ...(overrides.success ? overrides.data : {}) };
}

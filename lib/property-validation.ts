import { z } from "zod";

export const reservedSlugs = ["admin", "api", "media", "_next", "login", "favicon.ico", "robots.txt", "sitemap.xml"];
export const slugSchema = z.string().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens.").refine((slug) => !reservedSlugs.includes(slug), "This slug is reserved.");
export const amenitySchema = z.object({ icon: z.enum(["Waves", "Dumbbell", "Wine", "BellRing", "Clapperboard", "Flower2"]), title: z.string(), text: z.string() });
export const presentationSchema = z.object({ brandName: z.string().optional(), overviewTitle: z.string().optional(), heroDescription: z.string().optional(), footerTagline: z.string().optional() });
export const roomSettingsSchema = z.array(z.object({ key: z.string(), hotspotX: z.number().min(0).max(100), hotspotY: z.number().min(0).max(100) }));
const variantSchema = z.object({ frameCount: z.number().int().positive(), width: z.number().int().positive(), height: z.number().int().positive(), bytes: z.number().nonnegative().optional(), fps: z.number().positive().optional(), quality: z.number().min(1).max(100).optional() });
export const manifestSchema = z.object({ version: z.literal(1), pad: z.literal(4), ext: z.literal("webp"), revision: z.string().optional(), scrollLength: z.number().positive(), trimStart: z.number().nonnegative().nullable(), trimEnd: z.number().positive().nullable(), desktop: variantSchema, mobile: variantSchema.optional() });

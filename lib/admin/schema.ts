import { z } from "zod";
import { slugSchema, amenitySchema } from "@/lib/property-validation";

const id = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
const image = z.string().max(500).startsWith("/media/properties/").endsWith(".webp").nullable();
export const createPropertySchema = z.object({ name: z.string().trim().min(1).max(120), slug: slugSchema }).strict();
export const unitInput = z.object({ id, name: z.string().trim().min(1).max(100), beds: z.number().int().min(0).max(20), baths: z.number().int().min(0).max(20), sqft: z.number().int().min(1).max(1000000), price: z.string().trim().min(1).max(100) }).strict();
export const roomInput = z.object({ id, key: slugSchema, label: z.string().trim().min(1).max(100), description: z.string().max(1000), image, hotspotX: z.number().min(0).max(100), hotspotY: z.number().min(0).max(100) }).strict();
export const propertyInput = z.object({
  id, updatedAt: z.string().datetime(), name: z.string().trim().min(1).max(120), slug: slugSchema,
  tagline: z.string().max(250), location: z.string().max(250), heroCopy: z.string().max(1000),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Enter a six-digit hex colour."),
  status: z.enum(["draft", "processing", "published"]), towerImage: image, planImage: image,
  units: z.array(unitInput).max(20), rooms: z.array(roomInput).max(8),
  amenities: z.array(amenitySchema.extend({ title: z.string().trim().min(1).max(100), text: z.string().max(1000) })).max(30),
}).strict().superRefine((data, ctx) => {
  for (const field of ["units", "rooms"] as const) if (new Set(data[field].map((item) => item.id)).size !== data[field].length) ctx.addIssue({ code: "custom", path: [field], message: "Duplicate entries are not allowed." });
  if (new Set(data.rooms.map((room) => room.key)).size !== data.rooms.length) ctx.addIssue({ code: "custom", path: ["rooms"], message: "Each room needs a unique key." });
  if (data.status === "published") {
    if (!data.towerImage) ctx.addIssue({ code: "custom", path: ["towerImage"], message: "Upload a tower image before publishing." });
    if (!data.planImage) ctx.addIssue({ code: "custom", path: ["planImage"], message: "Upload a floor-plan image before publishing." });
    if (!data.units.length) ctx.addIssue({ code: "custom", path: ["units"], message: "Add at least one unit before publishing." });
    if (!data.rooms.length) ctx.addIssue({ code: "custom", path: ["rooms"], message: "Add at least one room before publishing." });
    data.rooms.forEach((room, index) => { if (!room.image) ctx.addIssue({ code: "custom", path: ["rooms", index, "image"], message: "Upload a room image before publishing." }); });
  }
});
export type AdminProperty = z.infer<typeof propertyInput>;
export function slugify(value: string) { return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80); }

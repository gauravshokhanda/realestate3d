import { z } from "zod";
import { slugSchema } from "@/lib/property-validation";
import { polygonSchema } from "./polygon";
import { themeSchema } from "./theme";

export const idSchema = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
const nameSchema = z.string().trim().min(1, "Enter a name.").max(120);
const image = z.string().max(500).startsWith("/media/originals/").endsWith(".webp").nullable();
export const developmentCreate = z.object({ name: nameSchema, slug: slugSchema }).strict();
export const developmentSave = developmentCreate.extend({
  tagline: z.string().trim().max(250), location: z.string().trim().max(250), description: z.string().trim().max(3000),
  buildingImage: image, logoImage: image, theme: themeSchema.omit({ logoImage: true }),
  status: z.enum(["draft", "published"]), updatedAt: z.iso.datetime(),
}).strict().refine((data) => data.status !== "published" || data.buildingImage, { path: ["buildingImage"], message: "Upload a building image before publishing." });
export const developmentView = developmentSave.safeExtend({ id: idSchema });
export const mapPropertySchema = z.object({
  id: idSchema, name: nameSchema, slug: slugSchema, label: z.string().nullable(), status: z.string(),
  polygon: polygonSchema.nullable(), updatedAt: z.iso.datetime(),
});
export const propertyCreate = z.object({ name: nameSchema, polygon: polygonSchema.nullable() }).strict();
export const polygonSave = z.object({ polygon: polygonSchema.nullable(), updatedAt: z.iso.datetime() }).strict();
export type DevelopmentForm = z.infer<typeof developmentView>;
export type MapProperty = z.infer<typeof mapPropertySchema>;

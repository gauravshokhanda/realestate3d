import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { storage, mediaUrl } from "@/lib/storage";
import { syncScenes } from "@/lib/jobs/derive";
import { slugSchema } from "@/lib/property-validation";
import { AdminError } from "./http";
import { type DevelopmentForm, type MapProperty } from "./development-schema";
import { resolveTheme } from "./theme";
import { focusFor, polygonSchema, type Point } from "./polygon";
import { slugify } from "./schema";

const propertySelect = { id: true, name: true, slug: true, label: true, status: true, polygon: true, updatedAt: true } satisfies Prisma.PropertySelect;
function mapProperty(property: Prisma.PropertyGetPayload<{ select: typeof propertySelect }>): MapProperty {
  const polygon = polygonSchema.safeParse(property.polygon);
  return { ...property, updatedAt: property.updatedAt.toISOString(), polygon: polygon.success ? polygon.data : null };
}
export async function getDevelopment(id: string) {
  const record = await db.development.findUnique({ where: { id }, include: { properties: { orderBy: [{ order: "asc" }, { name: "asc" }], select: propertySelect } } });
  if (!record) return null;
  const { logoImage: themeLogo, ...theme } = resolveTheme(record.theme);
  void themeLogo;
  const form: DevelopmentForm = {
    id, name: record.name, slug: record.slug, tagline: record.tagline ?? "", location: record.location ?? "",
    description: record.description ?? "", buildingImage: record.buildingImage ? mediaUrl(record.buildingImage) : null,
    logoImage: record.logoImage ? mediaUrl(record.logoImage) : null, updatedAt: record.updatedAt.toISOString(),
    status: record.status === "published" ? "published" : "draft", theme,
  };
  return { form, properties: record.properties.map(mapProperty) };
}

async function imageKey(url: string | null, previous: string | null, id: string) {
  if (!url) return null;
  const key = url.slice("/media/".length);
  if (key !== previous && !new RegExp(`^originals/[a-z0-9-]+/${id}/images/[a-f0-9-]+\\.webp$`).test(key)) {
    throw new AdminError("Choose an image uploaded to this development.");
  }
  await storage.get(key).catch(() => { throw new AdminError("The uploaded image is missing. Upload it again."); });
  return key;
}

export async function saveDevelopment(id: string, input: Omit<DevelopmentForm, "id">) {
  const old = await db.development.findUnique({ where: { id }, select: { buildingImage: true, logoImage: true } });
  if (!old) throw new AdminError("Development not found.", 404);
  const buildingImage = await imageKey(input.buildingImage, old.buildingImage, id);
  const logoImage = await imageKey(input.logoImage, old.logoImage, id);
  await db.$transaction(async (tx) => {
    const changesImage = buildingImage !== old.buildingImage;
    if (changesImage && await tx.scene.count({
      where: { property: { developmentId: id }, key: "hero-to-plan", OR: [{ leaseOwner: { not: null } }, { status: { in: ["rebuild_queued", "uploading"] } }] },
    })) throw new AdminError("Wait for active tower video jobs before changing the building image.", 409);
    const { updatedAt, theme, ...details } = input;
    const updated = await tx.development.updateMany({ where: { id, updatedAt: new Date(updatedAt) }, data: {
      ...details, buildingImage, logoImage,
      theme: { ...theme, ...(logoImage ? { logoImage } : {}) }, updatedAt: new Date(Math.max(Date.now(), new Date(updatedAt).getTime() + 1)),
    } });
    if (!updated.count) throw new AdminError("This development changed in another session. Reload before saving.", 409);
    if (changesImage) for (const property of await tx.property.findMany({ where: { developmentId: id }, select: { id: true } })) await syncScenes(property.id, tx);
  });
  return (await getDevelopment(id))?.form;
}

export async function addMapProperty(developmentId: string, name: string, polygon: Point[] | null) {
  return db.$transaction(async (tx) => {
    const development = await tx.development.findUnique({ where: { id: developmentId }, select: { buildingImage: true, properties: { select: { slug: true, order: true } } } });
    if (!development) throw new AdminError("Development not found.", 404);
    if (polygon && !development.buildingImage) throw new AdminError("Upload a building image first.");
    const proposed = slugify(name).slice(0, 65).replace(/-$/, "");
    const base = slugSchema.safeParse(proposed).success && proposed !== "og" ? proposed : "property";
    const taken = new Set(development.properties.map((property) => property.slug));
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
    const order = Math.max(-1, ...development.properties.map((property) => property.order)) + 1;
    return mapProperty(await tx.property.create({
      data: { name, slug, order, developmentId, ...(polygon ? { polygon, focus: focusFor(polygon) } : {}) }, select: propertySelect,
    }));
  });
}

export async function savePolygon(developmentId: string, id: string, polygon: Point[] | null, updatedAt: string) {
  return db.$transaction(async (tx) => {
    const existing = await tx.property.findFirst({ where: { id, developmentId }, select: { development: { select: { buildingImage: true } } } });
    if (!existing) throw new AdminError("Property not found in this development.", 404);
    if (polygon && !existing.development.buildingImage) throw new AdminError("Upload a building image first.");
    const result = await tx.property.updateMany({
      where: { id, developmentId, updatedAt: new Date(updatedAt) }, data: {
        polygon: polygon ?? Prisma.DbNull, focus: polygon ? focusFor(polygon) : Prisma.DbNull,
        updatedAt: new Date(Math.max(Date.now(), new Date(updatedAt).getTime() + 1)),
      },
    });
    if (!result.count) throw new AdminError("This property changed in another session. Reload before saving.", 409);
    return mapProperty(await tx.property.findUniqueOrThrow({ where: { id }, select: propertySelect }));
  });
}

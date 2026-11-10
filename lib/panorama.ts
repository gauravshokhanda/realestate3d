import { z } from "zod";

const id = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
export const panoLinkSchema = z.object({ toNodeId: id, yaw: z.number().finite().min(-Math.PI * 2).max(Math.PI * 2), pitch: z.number().finite().min(-Math.PI / 2).max(Math.PI / 2), label: z.string().trim().min(1).max(100) }).strict();
export const panoNodeSchema = z.object({
  id, roomId: id, name: z.string().trim().min(1).max(100),
  image: z.string().max(500).startsWith("/media/properties/").endsWith(".webp"),
  planX: z.number().min(0).max(100).nullable(), planY: z.number().min(0).max(100).nullable(),
  startYaw: z.number().finite().min(-Math.PI * 2).max(Math.PI * 2), links: z.array(panoLinkSchema).max(16),
}).strict().superRefine((node, ctx) => {
  if ((node.planX === null) !== (node.planY === null)) ctx.addIssue({ code: "custom", path: ["planX"], message: "Place both floor-plan coordinates." });
  if (new Set(node.links.map((link) => link.toNodeId)).size !== node.links.length) ctx.addIssue({ code: "custom", path: ["links"], message: "Choose each destination once." });
});
export const panoSnapshotSchema = z.object({ revision: z.string().regex(/^[a-f0-9]{64}$/), nodes: z.array(panoNodeSchema).max(64) }).strict().superRefine(({ nodes }, ctx) => {
  const ids = new Set(nodes.map((node) => node.id));
  if (ids.size !== nodes.length) ctx.addIssue({ code: "custom", path: ["nodes"], message: "Duplicate viewpoints are not allowed." });
  nodes.forEach((node, i) => {
    if (nodes.filter((other) => other.roomId === node.roomId).length > 8) ctx.addIssue({ code: "custom", path: ["nodes", i], message: "Use at most eight viewpoints per room." });
    node.links.forEach((link, j) => { if (link.toNodeId === node.id || !ids.has(link.toNodeId)) ctx.addIssue({ code: "custom", path: ["nodes", i, "links", j], message: "Choose another viewpoint in this property." }); });
  });
});
export type PanoNodeInput = z.infer<typeof panoNodeSchema>;
export type PanoSnapshot = z.infer<typeof panoSnapshotSchema>;
export type TourNode = PanoNodeInput & { roomLabel: string; mobileImage: string };
export function mobilePanorama(image: string) { return image.replace(/\.webp$/, "-mobile.webp"); }

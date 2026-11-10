import { z } from "zod";

export const videoSettingsSchema = z.object({
  removeWatermark: z.boolean().default(false),
  delogo: z.object({ x: z.number().int().min(1).max(10000), y: z.number().int().min(1).max(10000), w: z.number().int().min(1).max(2000), h: z.number().int().min(1).max(2000) }).default({ x: 1130, y: 569, w: 62, h: 64 }),
}).strict();
export const sceneActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("edit"), prompt: z.string().trim().min(10).max(6000), settings: videoSettingsSchema }).strict(),
  z.object({ action: z.literal("extract"), trimStart: z.number().min(0).max(120).nullable(), trimEnd: z.number().min(0.04).max(120).nullable(), settings: videoSettingsSchema }).strict(),
  z.object({ action: z.literal("generate"), confirmPaid: z.literal(true) }).strict(),
  z.object({ action: z.literal("approve"), expectedRevision: z.string().min(1).max(128), note: z.string().trim().min(8).max(1000), confirmMismatch: z.literal(true) }).strict(),
]).superRefine((data, ctx) => { if (data.action === "extract" && data.trimStart !== null && data.trimEnd !== null && data.trimStart >= data.trimEnd) ctx.addIssue({ code: "custom", path: ["trimEnd"], message: "End must be after start." }); });
export const batchSchema = z.object({ action: z.literal("generate-all"), confirmPaid: z.literal(true), sceneIds: z.array(z.string().min(1).max(128)).min(1).max(9) }).strict();
export const qcApprovalSchema = z.object({ at: z.string().datetime(), actor: z.literal("admin"), note: z.string(), warning: z.string().nullable(), similarity: z.number(), revision: z.string() });
export const analysisSchema = z.object({ duration: z.number(), autoStart: z.number(), autoEnd: z.number(), similarity: z.number(), warning: z.string().nullable(), width: z.number(), height: z.number(), qcApprovals: z.array(qcApprovalSchema).default([]) });
export const sceneViewSchema = z.object({
  id: z.string(), key: z.string(), label: z.string(), fromImage: z.string(), toImage: z.string(), prompt: z.string(), mode: z.string(), status: z.string(), progress: z.number(), error: z.string().nullable(),
  videoUrl: z.string().nullable(), frameCount: z.number().nullable(), mobileFrameCount: z.number().nullable(), duration: z.number().nullable(), trimStart: z.number().nullable(), trimEnd: z.number().nullable(), attempts: z.number(),
  settings: videoSettingsSchema, analysis: analysisSchema.nullable(), thumbnails: z.array(z.string()), revision: z.string(),
});
export const videosViewSchema = z.object({ scenes: z.array(sceneViewSchema), propertyStatus: z.string(), veo: z.object({ enabled: z.boolean(), model: z.string().nullable(), reason: z.string(), duration: z.number(), resolution: z.string() }) });
export type VideoSettings = z.infer<typeof videoSettingsSchema>;
export type SceneView = z.infer<typeof sceneViewSchema>;
export type VideosView = z.infer<typeof videosViewSchema>;

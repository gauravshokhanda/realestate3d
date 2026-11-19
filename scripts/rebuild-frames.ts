import { parseArgs } from "node:util";
import { loadEnvConfig } from "./runtime-env";
loadEnvConfig();

async function rebuildFrames() {
  const { values } = parseArgs({ options: { property: { type: "string" }, missing: { type: "boolean" } } });
  const { db } = await import("../lib/db");
  const { readFrames } = await import("../lib/storage/frames");
  const { queueFrameRebuild, runQueueOnce } = await import("../lib/jobs/worker");
  try {
    const scopes = values.property?.split("/");
    if (scopes && scopes.length > 2) throw new Error("Use a property slug or development/property.");
    const property = scopes?.length === 2
      ? { slug: scopes[1], development: { slug: scopes[0] } }
      : scopes ? { OR: [{ slug: scopes[0] }, { development: { slug: scopes[0] } }] } : undefined;
    const scenes = await db.scene.findMany({ where: { status: "ready", property }, orderBy: { key: "asc" } });
    const queued: string[] = [];
    for (const scene of scenes) {
      if (values.missing && await readFrames(scene.sequencePath)) continue;
      if (!scene.videoPath) {
        console.warn(`${scene.key}: skipped, source MP4 missing.`);
        process.exitCode = 1;
        continue;
      }
      if (await queueFrameRebuild(scene.id)) queued.push(scene.id);
    }
    if (!queued.length) { console.log("No ready scenes with source MP4s to rebuild."); return; }
    for (;;) {
      if (await runQueueOnce({ sceneIds: queued })) continue;
      const pending = await db.scene.count({ where: { id: { in: queued }, status: { in: ["rebuild_queued", "rebuilding"] } } });
      if (!pending) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    const results = await db.scene.findMany({ where: { id: { in: queued } }, select: { key: true, error: true, frameCount: true, mobileFrameCount: true } });
    console.table(results);
    if (results.some((scene) => scene.error)) process.exitCode = 1;
  } finally { await db.$disconnect(); }
}
rebuildFrames().catch((error: unknown) => { console.error(error); process.exitCode = 1; });

// Activate already-verified D2 assets without replacing the database or old media.
import { PrismaClient } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, statfs, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

const workspace = path.resolve("."), target = path.join(workspace, "storage");
const source = path.resolve(process.env.D2_SOURCE_STORAGE ?? "C:/Users/PC/AureliaWorkspaceArtifacts/d2-candidate/storage");
const output = path.join(workspace, "perf/d2"), mappings = JSON.parse(await readFile(path.join(output, "asset-sizes.json"), "utf8"));
const db = new PrismaClient({ datasourceUrl: `file:${path.join(workspace, "data/app.db").replaceAll("\\", "/")}` });
const digest = (value) => createHash("sha256").update(value).digest("hex");
const files = [], scenes = [];
try {
  const space = await statfs(target); assert(space.bavail * space.bsize >= 2 * 1024 ** 3, "Storage needs at least 2 GiB free");
  const backup = path.join(output, `original-db-before-assets-${randomUUID()}.db`).replaceAll("\\", "/");
  await db.$executeRawUnsafe(`VACUUM INTO '${backup.replaceAll("'", "''")}'`);
  for (const mapping of mappings) {
    assert(/^properties\/[a-z0-9-]+\/sequences-d2\/[a-z0-9-]+$/.test(mapping.folder));
    const scene = await db.scene.findFirstOrThrow({ where: { key: mapping.scene, property: { slug: mapping.property } } });
    const originalPath = scene.sequencePath ?? `properties/${mapping.property}/sequences/${scene.key}`;
    assert([mapping.source, mapping.folder].includes(originalPath), "Original scene changed since optimization");
    const manifest = JSON.parse(await readFile(path.join(source, mapping.folder, "manifest.json"), "utf8"));
    assert.equal(scene.frameCount, manifest.desktop.frameCount); assert.equal(scene.mobileFrameCount, manifest.mobile.frameCount);
    assert.equal(scene.status, "ready"); scenes.push({ id: scene.id, original: scene.sequencePath, next: mapping.folder });
  }
  for (const folder of new Set(mappings.flatMap((m) => [m.folder, m.folder + "-mobile"]))) {
    const from = path.resolve(source, folder), to = path.resolve(target, folder);
    assert(from.startsWith(source + path.sep) && to.startsWith(target + path.sep));
    await mkdir(to, { recursive: true });
    for (const file of await readdir(from)) {
      assert(/^(frame_\d{4}\.webp|manifest\.json)$/.test(file));
      const bytes = await readFile(path.join(from, file)), destination = path.join(to, file);
      try { await writeFile(destination, bytes, { flag: "wx" }); } catch (error) { if (error.code !== "EEXIST") throw error; }
      assert.equal(digest(await readFile(destination)), digest(bytes)); files.push({ path: `${folder}/${file}`, sha256: digest(bytes), bytes: bytes.length });
    }
  }
  await db.$transaction(async (tx) => {
    for (const scene of scenes) {
      const updated = await tx.scene.updateMany({ where: { id: scene.id, sequencePath: scene.original, status: "ready", leaseOwner: null }, data: { sequencePath: scene.next } });
      assert.equal(updated.count, 1, "Concurrent scene edit; activation rolled back");
    }
  });
  await writeFile(path.join(output, "asset-activation.json"), JSON.stringify({ at: new Date().toISOString(), backup, source, target, files, scenes, oldMediaRetained: true }, null, 2));
  console.log(`Activated ${scenes.length} scene references; verified ${files.length} files. Original media retained. DB backup: ${backup}`);
} finally { await db.$disconnect(); }

import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access, copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpeg from "ffmpeg-static";
import sharp from "sharp";
import ts from "typescript";

sharp.cache(false); // Release image handles before removing fixtures on Windows.

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const source = `// Keep this comment and the unrelated scene intact.\nexport const scenes = [
  { id: 'hero-to-plan', folder: '/sequences/hero-to-plan', frameCount: 99, mobileFolder: '/sequences/hero-to-plan-mobile', mobileFrameCount: 55, pad: 4, ext: 'webp', scrollLength: 3000 },
  { id: 'other', folder: '/sequences/other', frameCount: 12, pad: 4, ext: 'webp', scrollLength: 1000 },
] satisfies Scene[];\ntype Scene = object;\n`;

async function fixture(t) {
  // Nested under the project so the copied CLI resolves the same dependencies.
  const directory = await mkdtemp(path.join(root, ".sequence-test-"));
  t.after(async () => {
    assert.equal(path.dirname(directory), path.resolve(root));
    assert(path.basename(directory).startsWith(".sequence-test-"));
    await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
  await mkdir(path.join(directory, "scripts"));
  await mkdir(path.join(directory, "prisma"));
  await copyFile(path.join(root, "scripts/import-sequence.mjs"), path.join(directory, "scripts/import-sequence.mjs"));
  await writeFile(path.join(directory, "prisma/seed-data.ts"), source);
  const video = path.join(directory, "input video.mp4");
  await exec(ffmpeg, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=320x180:rate=24", "-t", "1", "-c:v", "mpeg4", video]);
  return { directory, video, run: (...args) => exec(process.execPath, [path.join(directory, "scripts/import-sequence.mjs"), ...args], { cwd: directory }) };
}

async function readScenes(directory) {
  const content = await readFile(path.join(directory, "prisma/seed-data.ts"), "utf8");
  const compiled = ts.transpileModule(content, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
  const { scenes } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
  return { scenes, content };
}

test("imports desktop/mobile WebP frames, removes stale frames, preserves extras, and updates only the selected counts", async (t) => {
  const { directory, video, run } = await fixture(t);
  for (const suffix of ["", "-mobile"]) {
    const folder = path.join(directory, "public/sequences/hero-to-plan" + suffix);
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, "frame_9999.webp"), "stale");
    await writeFile(path.join(folder, "notes.txt"), "Keep me");
  }
  const { stdout } = await run(video, "hero-to-plan");
  assert.match(stdout, /hero-to-plan: 24 frames · [\d.]+ MB/);
  assert.match(stdout, /hero-to-plan-mobile: 15 frames · [\d.]+ MB/);
  const { scenes, content } = await readScenes(directory);
  assert.equal(scenes[0].frameCount, 24);
  assert.equal(scenes[0].mobileFrameCount, 15);
  assert.equal(scenes[1].frameCount, 12);
  assert(content.startsWith("// Keep this comment"));
  for (const [suffix, count, width] of [["", 24, 320], ["-mobile", 15, 320]]) {
    const folder = path.join(directory, "public/sequences/hero-to-plan" + suffix);
    const files = (await readdir(folder)).filter((name) => name.endsWith(".webp"));
    assert.equal(files.length, count);
    await assert.rejects(access(path.join(folder, "frame_9999.webp")));
    assert.equal(await readFile(path.join(folder, "notes.txt"), "utf8"), "Keep me");
    const metadata = await sharp(path.join(folder, "frame_0001.webp")).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, width);
    assert.equal(metadata.height, width * 9 / 16);
  }
  assert(!(await readdir(path.join(directory, "public/sequences"))).some((name) => name.startsWith(".import-")));
  await assert.rejects(access(path.join(directory, ".sequence-import.lock")));
});

test("trims source timestamps, applies delogo before scaling, and rejects invalid options", async (t) => {
  const { directory, video, run } = await fixture(t);
  await run(video, "hero-to-plan", "--start", "0.25", "--end", "0.75", "--delogo", "280:140:20:20");
  const { scenes } = await readScenes(directory);
  assert.equal(scenes[0].frameCount, 12);
  assert.equal(scenes[0].mobileFrameCount, 8);
  for (const args of [["--start", "-1"], ["--end", "0"], ["--start", "0.8", "--end", "0.2"], ["--delogo", "1:2:0:4"], ["--end"], ["--bogus", "1"], ["--end", "0.5", "--end", "0.6"]]) await assert.rejects(run(video, "hero-to-plan", ...args));
  const after = await readScenes(directory);
  assert.deepEqual(after.scenes, scenes);
});

test("unknown or unsafe scene IDs and invalid videos leave existing assets/config unchanged", async (t) => {
  const { directory, video, run } = await fixture(t);
  const folder = path.join(directory, "public/sequences/hero-to-plan");
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, "frame_0001.webp"), "original-frame");
  for (const id of ["unregistered", "../outside"]) await assert.rejects(run(video, id));
  const badVideo = path.join(directory, "bad.mp4");
  await writeFile(badVideo, "not a video");
  await assert.rejects(run(badVideo, "hero-to-plan"), /Cannot determine video duration/);
  assert.equal(await readFile(path.join(folder, "frame_0001.webp"), "utf8"), "original-frame");
  assert.equal(await readFile(path.join(directory, "prisma/seed-data.ts"), "utf8"), source);
  assert(!(await readdir(path.join(directory, "public/sequences"))).some((name) => name.startsWith(".import-")));
});

test("adds missing mobile configuration for a registered scene", async (t) => {
  const { directory, video, run } = await fixture(t);
  await run(video, "other");
  const { scenes } = await readScenes(directory);
  assert.equal(scenes[1].frameCount, 24);
  assert.equal(scenes[1].mobileFrameCount, 15);
  assert.equal(scenes[1].mobileFolder, "/sequences/other-mobile");
  assert.equal(scenes[0].frameCount, 99);
});

test("room openings crossfade from the matching hero variant and leave frame four unchanged", async (t) => {
  const { directory, video, run } = await fixture(t);
  await writeFile(path.join(directory, "prisma/seed-data.ts"), source.replaceAll("other", "plan-to-living"));
  await run(video, "hero-to-plan");
  await run(video, "plan-to-living");
  for (const [suffix, last] of [["", 24], ["-mobile", 15]]) {
    const hero = path.join(directory, "public/sequences/hero-to-plan" + suffix);
    const room = path.join(directory, "public/sequences/plan-to-living" + suffix);
    const expected = await sharp(path.join(hero, `frame_${String(last).padStart(4, "0")}.webp`)).removeAlpha().raw().toBuffer();
    const actual = await sharp(path.join(room, "frame_0001.webp")).removeAlpha().raw().toBuffer();
    assert.equal(actual.length, expected.length);
    const meanDifference = actual.reduce((sum, value, index) => sum + Math.abs(value - expected[index]), 0) / actual.length;
    assert(meanDifference < 4, `Opening frame must match the hero endpoint: mean difference ${meanDifference}`);
    assert.deepEqual(await readFile(path.join(room, "frame_0004.webp")), await readFile(path.join(hero, "frame_0004.webp")));
  }
});

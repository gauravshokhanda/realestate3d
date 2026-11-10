import ffmpeg from "ffmpeg-static";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

export async function runTestFfmpeg(args) {
  await new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], { windowsHide: true, shell: false, stdio: ["ignore", "ignore", "pipe"] });
    let errors = ""; child.stderr.on("data", (data) => { errors += data.toString(); });
    child.on("error", reject); child.on("close", (code) => code === 0 ? resolve() : reject(new Error(errors)));
  });
}
export async function uploadMatchingVideos(page, context, base, propertyId) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "aurelia-smoke-moves-"));
  try {
    const response = await context.request.get(`${base}/api/admin/properties/${propertyId}/videos`);
    const data = await response.json();
    for (const scene of data.scenes) {
      const prefix = path.join(directory, scene.key);
      for (const [suffix, url] of [["start", scene.fromImage], ["end", scene.toImage]]) {
        const bytes = await (await context.request.get(base + url)).body();
        await sharp(bytes).resize(640, 360).png().toFile(`${prefix}-${suffix}.png`);
      }
      const file = `${prefix}.mp4`;
      await runTestFfmpeg(["-loop", "1", "-framerate", "24", "-t", "2", "-i", `${prefix}-start.png`, "-loop", "1", "-framerate", "24", "-t", "2", "-i", `${prefix}-end.png`, "-filter_complex", "[0:v][1:v]xfade=transition=fade:duration=0.8:offset=0.4,format=yuv420p[v]", "-map", "[v]", "-t", "2.4", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "-threads", "2", file]);
      const card = page.locator(`[data-video-scene="${scene.key}"]`);
      await card.getByLabel(`Upload MP4 for ${scene.label}`, { exact: true }).setInputFiles({ name: `${scene.key}.mp4`, mimeType: "video/mp4", buffer: await readFile(file) });
      await page.waitForFunction(({ key }) => document.querySelector(`[data-video-scene="${key}"] .admin-badge`)?.textContent?.trim() === "ready", { key: scene.key }, { timeout: 120000 });
    }
    await page.getByText("All scenes are ready.", { exact: false }).waitFor({ timeout: 20000 });
  } finally { if (path.dirname(directory) === os.tmpdir() && path.basename(directory).startsWith("aurelia-smoke-moves-")) await rm(directory, { recursive: true, force: true }); }
}
export async function syntheticLongVideo(directory) {
  await mkdir(directory, { recursive: true });
  const target = path.join(directory, "target.png"), video = path.join(directory, "long.mp4");
  await sharp({ create: { width: 320, height: 180, channels: 3, background: "#bbaa88" } }).png().toFile(target);
  await runTestFfmpeg(["-loop", "1", "-framerate", "24", "-i", target, "-t", "14", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", video]);
  return { target, video };
}

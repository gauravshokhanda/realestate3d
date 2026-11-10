import { mkdir, readFile, writeFile } from "node:fs/promises";
import { probeVideo } from "../lib/jobs/ffmpeg";
import { analyseVideo } from "../lib/jobs/trim";

async function main() {
  const results = [];
  for (const [key, image] of [["hero-to-plan", "floor-plan"], ["plan-to-living", "living-room"], ["plan-to-kitchen", "kitchen"], ["plan-to-bedroom", "primary-bedroom"]]) {
    const file = `assets/videos/${key}.mp4`;
    const metadata = await probeVideo(file);
    const trim = await analyseVideo(file, await readFile(`assets/stills/${image}.png`), metadata.duration);
    results.push({ key, ...metadata, ...trim });
  }
  await mkdir("screenshots/phase-C", { recursive: true });
  await writeFile("screenshots/phase-C/source-trims.json", JSON.stringify(results, null, 2));
  console.log(results);
}
void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });

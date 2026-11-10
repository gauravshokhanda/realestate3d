import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const output = path.join(root, "screenshots", "frames");
await mkdir(output, { recursive: true });
const configPath = path.join(root, "prisma", "seed-data.ts");
let source = await readFile(configPath, "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { scenes } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
const reports = [];
for (const scene of scenes) {
  const variants = [];
  for (const suffix of ["", "-mobile"]) {
    const folder = path.join(root, "public", "sequences", scene.id + suffix);
    const frames = (await readdir(folder)).filter((name) => /^frame_\d+\.webp$/.test(name)).sort();
    const bytes = (await Promise.all(frames.map(async (name) => (await stat(path.join(folder, name))).size))).reduce((a, b) => a + b, 0);
    const { width, height } = await sharp(path.join(folder, frames[0])).metadata();
    variants.push({ variant: suffix ? "mobile" : "desktop", frames: frames.length, width, height, bytes, MB: Number((bytes / 1_000_000).toFixed(3)) });
    if (suffix) continue;
    for (const [label, index] of [["middle", Math.floor((frames.length - 1) / 2)], ["last", frames.length - 1]]) {
      const image = path.join(folder, frames[index]);
      await sharp(image).png().toFile(path.join(output, `${scene.id}-${label}.png`));
      await sharp(image).extract({ left: Math.max(0, width - 240), top: Math.max(0, height - 200), width: Math.min(240, width), height: Math.min(200, height) }).resize(720, 600, { kernel: "nearest" }).png().toFile(path.join(output, `${scene.id}-${label}-corner.png`));
    }
  }
  const scrollLength = Math.round(scene.frameCount * 19 / 10) * 10;
  const line = new RegExp(`(id: "${scene.id}"[^\n]*scrollLength: )\\d+`);
  source = source.replace(line, (_match, prefix) => prefix + scrollLength);
  reports.push({ scene: scene.id, scrollLength, variants });
}
await writeFile(configPath, source);
await writeFile(path.join(output, "sizes.json"), JSON.stringify(reports, null, 2));
console.log(JSON.stringify(reports, null, 2));

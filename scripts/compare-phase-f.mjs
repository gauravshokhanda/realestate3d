import path from "node:path";
import sharp from "sharp";

const root = path.resolve(process.env.SMOKE_OUTPUT ?? "screenshots/phase-F");
for (const device of ["desktop", "mobile"]) {
  for (const suffix of ["", "-hero"]) {
    const width = device === "desktop" ? 720 : 390;
    const before = await sharp(path.join(root, `before-${device}${suffix}.png`)).resize({ width }).toBuffer({ resolveWithObject: true });
    const after = await sharp(path.join(root, `after-${device}${suffix}.png`)).resize({ width }).toBuffer({ resolveWithObject: true });
    const header = Buffer.from(`<svg width="${width * 2 + 16}" height="56"><rect width="100%" height="100%" fill="#0a0a0b"/><g fill="#d8b67a" font-family="sans-serif" font-size="16"><text x="20" y="35">BEFORE · PHASE E</text><text x="${width + 36}" y="35">AFTER · PHASE F</text></g></svg>`);
    await sharp({ create: { width: width * 2 + 16, height: Math.max(before.info.height, after.info.height) + 56, channels: 3, background: "#0a0a0b" } }).composite([{ input: header, top: 0, left: 0 }, { input: before.data, top: 56, left: 0 }, { input: after.data, top: 56, left: width + 16 }]).png().toFile(path.join(root, `comparison-${device}${suffix}.png`));
  }
}
console.log("Desktop/mobile full-page and hero comparisons saved.");

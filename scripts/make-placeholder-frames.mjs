import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../public/sequences/", import.meta.url));
const names = ["hero-to-plan", "plan-to-living", "plan-to-kitchen", "plan-to-bedroom"];

function frameSvg(name, index, count) {
  const progress = index / (count - 1);
  const x = Math.round(150 + progress * 1300);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">
    <defs><radialGradient id="glow" cx="${x / 16}%" cy="${30 + progress * 45}%" r="90%">
      <stop stop-color="#D8B67A" stop-opacity="${0.35 + progress * 0.45}"/>
      <stop offset="1" stop-color="#0A0A0B"/>
    </radialGradient></defs>
    <rect width="1600" height="900" fill="#0A0A0B"/>
    <rect width="1600" height="900" fill="url(#glow)"/>
    <g fill="#F5F2EC" font-family="sans-serif" text-anchor="middle">
      <text x="800" y="350" font-size="20" letter-spacing="8">AURELIA · SEQUENCE STUDY</text>
      <text x="800" y="460" font-size="80">${name}</text>
      <text x="800" y="570" font-size="64">FRAME ${String(index + 1).padStart(4, "0")} / ${count}</text>
      <text x="800" y="780" font-size="18" letter-spacing="5">SCROLL TO EXPLORE</text>
    </g>
    <rect x="160" y="660" width="1280" height="2" fill="#F5F2EC" opacity="0.15"/>
    <rect x="160" y="660" width="${Math.max(2, progress * 1280)}" height="2" fill="#D8B67A"/>
  </svg>`);
}

for (const name of names) {
  for (const mobile of [false, true]) {
    const count = mobile ? 45 : 90;
    const width = mobile ? 800 : 1600;
    const folder = path.join(root, `${name}${mobile ? "-mobile" : ""}`);
    await mkdir(folder, { recursive: true });
    // Bounded batches avoid holding every uncompressed frame in memory.
    for (let start = 0; start < count; start += 4) {
      await Promise.all(Array.from({ length: Math.min(4, count - start) }, async (_, offset) => {
        const index = start + offset;
        await sharp(frameSvg(name, index, count)).resize(width, width * 9 / 16)
          .webp({ quality: mobile ? 65 : 72 })
          .toFile(path.join(folder, `frame_${String(index + 1).padStart(4, "0")}.webp`));
      }));
    }
    console.log(`${name}${mobile ? "-mobile" : ""}: ${count} frames, ${width}×${width * 9 / 16}`);
  }
}

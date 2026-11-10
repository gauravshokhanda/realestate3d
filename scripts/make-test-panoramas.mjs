import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Deterministic spherical test charts, not photographs of the property. */
export async function createTestPanoramas(output) {
  await mkdir(output, { recursive: true });
  const files = [];
  for (const [index, name] of ["living", "kitchen"].entries()) {
    const width = 4096, height = 2048, lines = [];
    for (let x = 0; x <= width; x += 256) lines.push(`<path d="M${x} 0V${height}" stroke="#b7b4ae" stroke-opacity=".35"/>`);
    for (let y = 0; y <= height; y += 256) lines.push(`<path d="M0 ${y}H${width}" stroke="#b7b4ae" stroke-opacity=".35"/>`);
    for (let x = 512; x < width; x += 512) {
      lines.push(`<text x="${x}" y="1050" text-anchor="middle" font-size="54" fill="#f5f2ec">${Math.round(x / width * 360 - 180)}°</text>`);
      lines.push(`<text x="${x}" y="850" text-anchor="middle" font-size="45" fill="#d8b67a">TEST ${index ? "B · KITCHEN" : "A · LIVING"}</text>`);
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${index ? "#243c37" : "#25384b"}"/><stop offset=".5" stop-color="#141820"/><stop offset="1" stop-color="#4b3b27"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#sky)"/><g font-family="Arial,sans-serif">${lines.join("")}<path d="M0 1024H4096" stroke="#d8b67a" stroke-width="7"/><text x="2048" y="1280" text-anchor="middle" fill="#f5f2ec" font-size="60">SPHERICAL TEST GRID · NOT PROPERTY PHOTOGRAPHY</text><text x="2048" y="520" text-anchor="middle" fill="#f5f2ec" font-size="60">UP / +90°</text><text x="2048" y="1700" text-anchor="middle" fill="#f5f2ec" font-size="60">DOWN / −90°</text></g></svg>`;
    const file = path.join(output, `test-${name}.webp`);
    await sharp(Buffer.from(svg)).webp({ quality: 88 }).toFile(file);
    files.push(file);
  }
  return files;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log((await createTestPanoramas(path.resolve(process.argv[2] ?? "assets/panoramas"))).join("\n"));

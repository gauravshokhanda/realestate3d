import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import path from "node:path";

const directory = path.resolve("screenshots/phase-A");
const reports = [];
for (const name of ["desktop-000", "desktop-080", "mobile-000"]) {
  const before = await sharp(await readFile(path.join(directory, "before", name + ".png"))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const after = await sharp(await readFile(path.join(directory, name + ".png"))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (before.info.width !== after.info.width || before.info.height !== after.info.height) throw new Error("Capture dimensions differ: " + name);
  let changed = 0;
  let difference = 0;
  for (let index = 0; index < before.data.length; index += 3) {
    let maximum = 0;
    for (let channel = 0; channel < 3; channel++) {
      const delta = Math.abs(before.data[index + channel] - after.data[index + channel]);
      maximum = Math.max(maximum, delta);
      difference += delta;
    }
    if (maximum > 2) changed++;
  }
  reports.push({ capture: name, width: before.info.width, height: before.info.height, meanChannelDifference: difference / before.data.length, changedPixelPercent: changed / (before.data.length / 3) * 100 });
}
await writeFile(path.join(directory, "visual-comparison.json"), JSON.stringify(reports, null, 2));
console.log(reports);

import { lstat, readdir, realpath, rm, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = await realpath(fileURLToPath(new URL("../", import.meta.url)));
const disposable = new Set([".artifacts", "test-results", "playwright-report"]);
async function bytesAt(file) {
  const info = await lstat(file);
  if (!info.isDirectory() || info.isSymbolicLink()) return info.size;
  const entries = await readdir(file);
  let bytes = 0;
  for (const entry of entries) bytes += await bytesAt(path.join(file, entry));
  return bytes;
}

let total = 0;
for (const name of await readdir(root)) {
  if (!name.startsWith(".next") && !disposable.has(name)) continue;
  const target = path.resolve(root, name);
  if (path.dirname(target) !== root) throw new Error("Cleanup target escaped the workspace.");
  const info = await lstat(target);
  const bytes = await bytesAt(target);
  if (info.isSymbolicLink()) await unlink(target);
  else {
    if ((await realpath(target)) !== target) throw new Error("Cleanup target resolves outside the workspace.");
    await rm(target, { recursive: info.isDirectory(), force: true, maxRetries: 4, retryDelay: 200 });
  }
  total += bytes;
  console.log(name + " removed (" + bytes.toLocaleString("en-US") + " bytes)");
}
console.log("Space freed: " + total.toLocaleString("en-US") + " bytes (" + (total / 1024 ** 2).toFixed(2) + " MiB)");

import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

// Windows cannot replace a loaded engine DLL. Reuse an identical generated client.
const require = createRequire(import.meta.url);
let current = false;
try {
  const clientRequire = createRequire(require.resolve("@prisma/client"));
  const [source, generated] = await Promise.all([readFile("prisma/schema.prisma", "utf8"), readFile(clientRequire.resolve(".prisma/client/schema.prisma"), "utf8")]);
  clientRequire.resolve(".prisma/client/index.js");
  current = source.replaceAll("\r\n", "\n").trim() === generated.replaceAll("\r\n", "\n").trim();
} catch { /* Fresh install: generate below. */ }
if (current) console.log("Prisma client matches the schema; reusing generated client.");
else {
  const result = spawnSync(process.execPath, [require.resolve("prisma/build/index.js"), "generate"], { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

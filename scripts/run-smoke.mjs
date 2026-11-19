import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
import dotenv from "dotenv";

dotenv.config({ path: [".env.local", ".env"], quiet: true });
const require = createRequire(import.meta.url);
const suites = ["smoke.mjs", "smoke-platform.mjs", "smoke-admin.mjs", "smoke-crm.mjs", "smoke-videos.mjs", "smoke-panoramas.mjs", "smoke-polish.mjs"];
const failures = [];
let server;
let url = process.env.SMOKE_URL;
try {
  if (!url) {
    const probe = createServer();
    await new Promise((resolve, reject) => { probe.once("error", reject); probe.listen(0, "localhost", resolve); });
    const port = probe.address().port;
    await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
    url = `http://localhost:${port}`;
    server = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "--hostname", "localhost", "--port", String(port)], { stdio: "inherit" });
    const deadline = Date.now() + 120000;
    let ready = false;
    while (!ready && Date.now() < deadline && server.exitCode === null) {
      try { ready = (await fetch(url + "/aurelia", { signal: AbortSignal.timeout(5000) })).ok; } catch { /* The server is still starting. */ }
      if (!ready) await delay(500);
    }
    if (!ready) throw new Error("The smoke server did not serve /aurelia. Run pnpm build first and restore the Aurelia media pack.");
  }
  for (const suite of suites) {
    console.log(`\nRunning ${suite} on ${url}`);
    const result = spawnSync(process.execPath, [`scripts/${suite}`], {
      stdio: "inherit", env: { ...process.env, SMOKE_URL: url },
    });
    if (result.status !== 0) {
      failures.push(suite);
      if (result.error) console.error(result.error.message);
    }
  }
  if (failures.length) {
    console.error(`Smoke failed (${failures.length} of ${suites.length}): ${failures.join(", ")}`);
    process.exitCode = 1;
  } else console.log(`Smoke passed all ${suites.length} suites.`);
} finally { server?.kill(); }

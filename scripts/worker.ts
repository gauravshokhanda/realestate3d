import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"], quiet: true });
async function main() {
  const { wakeWorker } = await import("../lib/jobs/worker");
  wakeWorker();
  console.log("Aurelia video worker started (single-job concurrency; database leases enabled).");
  setInterval(() => {}, 60_000);
}
void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Worker failed"); process.exitCode = 1; });

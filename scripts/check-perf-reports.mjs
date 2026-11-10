import { readFile, stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { z } from "zod";

const finite = z.number().finite().nonnegative();
const runSchema = z.object({
  name: z.enum(["desktop", "mobile"]),
  viewport: z.object({ width: finite.positive(), height: finite.positive() }),
  cpuThrottle: finite.positive(), durationMs: finite.positive(), distance: finite.positive(),
  frames: finite.int().positive(), averageFrameMs: finite, p95FrameMs: finite,
  droppedFrames: finite.int(), longTasks: z.array(z.object({ start: finite, duration: finite })),
  trace: z.string().min(1),
});
const reportSchema = z.object({
  browser: z.string().min(1), scrollMode: z.enum(["gesture", "scripted"]),
  hardware: z.object({ cpu: z.string(), logicalCpus: finite.int(), platform: z.string() }),
  runs: z.array(runSchema),
});

/** Compare measurements, never trust a saved `passes` flag or substitute missing runs. */
export function checkPerformanceReports(beforeInput, afterInput) {
  const before = reportSchema.safeParse(beforeInput), after = reportSchema.safeParse(afterInput);
  const issues = [];
  if (!before.success || !after.success) {
    if (!before.success) issues.push(`Before report invalid: ${before.error.message}`);
    if (!after.success) issues.push(`After report invalid: ${after.error.message}`);
    return { comparable: false, accepted: false, issues, measurements: [] };
  }
  const a = before.data, b = after.data;
  if (a.scrollMode !== b.scrollMode) issues.push("Before/after scroll methods differ.");
  if (a.scrollMode !== "gesture" || b.scrollMode !== "gesture") issues.push("Acceptance requires gesture measurements; scripted runs are separate stress tests.");
  if (a.browser !== b.browser) issues.push("Browser versions differ.");
  if (JSON.stringify(a.hardware) !== JSON.stringify(b.hardware)) issues.push("Measurement hardware differs.");
  const measurements = [];
  for (const name of ["desktop", "mobile"]) {
    const previous = a.runs.filter(run => run.name === name), current = b.runs.filter(run => run.name === name);
    if (previous.length !== 1 || current.length !== 1) { issues.push(`Exactly one ${name} run is required in each report.`); continue; }
    const from = previous[0], to = current[0], limit = name === "mobile" ? 33 : 20;
    if (JSON.stringify(from.viewport) !== JSON.stringify(to.viewport)) issues.push(`${name}: viewport differs.`);
    const throttle = name === "mobile" ? 4 : 1;
    if (from.cpuThrottle !== throttle || to.cpuThrottle !== throttle) issues.push(`${name}: expected ${throttle}x CPU throttle.`);
    if (Math.abs(from.distance - to.distance) > Math.max(10, from.distance * .01)) issues.push(`${name}: scroll distances differ by more than 1%.`);
    measurements.push({ name, beforeP95Ms: from.p95FrameMs, afterP95Ms: to.p95FrameMs, limitMs: limit,
      p95Passed: to.p95FrameMs <= limit, longTasksOver50Ms: to.longTasks.filter(task => task.duration > 50).length });
  }
  const comparable = issues.length === 0;
  return { comparable, accepted: comparable && measurements.every(run => run.p95Passed && run.longTasksOver50Ms === 0), issues, measurements };
}

async function main() {
  const files = [process.argv[2] ?? "perf/before.json", process.argv[3] ?? "perf/after.json"];
  const reports = await Promise.all(files.map(async file => JSON.parse(await readFile(file, "utf8"))));
  const result = checkPerformanceReports(...reports);
  // A named trace without a real artifact cannot substantiate a measurement.
  for (let index = 0; index < reports.length; index++) {
    const parsed = reportSchema.safeParse(reports[index]);
    if (!parsed.success) continue;
    for (const run of parsed.data.runs) {
      const trace = path.resolve(path.dirname(files[index]), run.trace);
      const base = path.resolve(path.dirname(files[index])) + path.sep;
      if (!trace.startsWith(base) || !(await stat(trace).catch(() => null))?.isFile()) {
        result.issues.push(`${index === 0 ? "Before" : "After"} ${run.name}: trace artifact missing or outside the report directory.`);
        result.accepted = false;
      }
    }
  }
  console.log(JSON.stringify(result, null, 2));
  if (!result.accepted) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main().catch(error => { console.error(error instanceof Error ? error.message : "Performance report check failed"); process.exitCode = 1; });
}

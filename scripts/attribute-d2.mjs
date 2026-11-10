import { readFile, writeFile } from "node:fs/promises";
import { gunzip } from "node:zlib";
import { promisify } from "node:util";
import { SourceMap } from "node:module";
import path from "node:path";

const root = path.resolve(process.env.PERF_OUTPUT ?? "perf/d2"), label = process.argv[2] ?? "control";
const report = JSON.parse(await readFile(path.join(root, `${label}.json`), "utf8"));
const attributions = [], mapCache = new Map();
async function original(frame) {
  if (!process.env.ATTRIBUTION_BUILD || !frame.url?.includes("/_next/")) return null;
  const relative = decodeURIComponent(new URL(frame.url).pathname.split("/_next/")[1]) + ".map";
  if (!mapCache.has(relative)) {
    try { mapCache.set(relative, new SourceMap(JSON.parse(await readFile(path.join(process.env.ATTRIBUTION_BUILD, relative), "utf8")))); }
    catch { mapCache.set(relative, null); }
  }
  const entry = mapCache.get(relative)?.findEntry(frame.lineNumber, frame.columnNumber);
  return entry?.originalSource ? { source: entry.originalSource, line: entry.originalLine + 1, column: entry.originalColumn + 1, name: entry.name } : null;
}
function union(intervals) {
  intervals.sort((a, b) => a[0] - b[0]); let total = 0, end = -Infinity;
  for (const [start, stop] of intervals) { total += Math.max(0, stop - Math.max(start, end)); end = Math.max(end, stop); } return total / 1000;
}
for (const run of report.runs) {
  const trace = JSON.parse(await promisify(gunzip)(await readFile(path.join(root, run.trace))));
  const profile = JSON.parse(await promisify(gunzip)(await readFile(path.join(root, run.profile))));
  const events = trace.traceEvents, marker = events.find((e) => e.name === "d2-scroll-start");
  if (!marker) throw new Error(`Missing clock marker in ${run.trace}`);
  const main = events.filter((e) => e.pid === marker.pid && e.tid === marker.tid && e.ph === "X" && e.dur > 0);
  const nodes = new Map(profile.nodes.map((n) => [n.id, n])), parents = new Map(); profile.nodes.forEach((n) => n.children?.forEach((id) => parents.set(id, n.id)));
  let time = profile.startTime;
  const samples = (profile.samples ?? []).map((id, i) => { const duration = profile.timeDeltas[i]; time += duration; return { time, duration, id }; });
  for (const task of run.longTasks) {
    const start = marker.ts + task.time * 1000, end = start + task.duration * 1000;
    const spans = main.filter((e) => e.ts < end && e.ts + e.dur > start);
    const top = spans.filter((e) => /RunTask/.test(e.name)).sort((a, b) => Math.abs(a.ts - start) - Math.abs(b.ts - start))[0];
    const operations = new Map(), calls = new Map(), functions = new Map();
    for (const e of spans) {
      if (/RunTask/.test(e.name)) continue;
      const list = operations.get(e.name) ?? []; list.push([Math.max(start, e.ts), Math.min(end, e.ts + e.dur)]); operations.set(e.name, list);
      const data = e.args?.data;
      if (data?.url) calls.set(`${data.url}:${data.lineNumber}:${data.columnNumber}`, { function: data.functionName ?? null, script: data.url, line: data.lineNumber, column: data.columnNumber, operation: e.name });
    }
    for (const sample of samples) {
      if (sample.time < start || sample.time >= end) continue;
      let node = nodes.get(sample.id), frame = node?.callFrame;
      while (node && !frame?.url && parents.has(node.id)) { node = nodes.get(parents.get(node.id)); if (node?.callFrame.url) frame = node.callFrame; }
      if (!frame) continue;
      const key = `${frame.functionName}|${frame.url}|${frame.lineNumber}|${frame.columnNumber}`, entry = functions.get(key) ?? { ...frame, sampledMs: 0 };
      entry.sampledMs += sample.duration / 1000; functions.set(key, entry);
    }
    const sampledFunctions = await Promise.all([...functions.values()].sort((a, b) => b.sampledMs - a.sampledMs).slice(0, 12).map(async (f) => ({ ...f, original: await original(f) })));
    attributions.push({ configuration: label, iteration: run.iteration, device: run.device, secondsIntoScroll: task.time / 1000, durationMs: task.duration, scene: task.scene, performanceObserver: task.attribution,
      traceTask: top ? { name: top.name, startOffsetMs: (top.ts - marker.ts) / 1000, durationMs: top.dur / 1000, pid: top.pid, tid: top.tid } : null,
      operations: [...operations].map(([name, values]) => ({ name, inclusiveMs: union(values) })).sort((a, b) => b.inclusiveMs - a.inclusiveMs).slice(0, 18),
      scriptCalls: [...calls.values()], sampledFunctions, trace: run.trace, cpuProfile: run.profile });
  }
}
const result = { configuration: label, taskCount: attributions.length, method: "PerformanceObserver task start aligned to d2-scroll-start trace marker on the renderer main thread. Native operation durations are unions of clipped trace spans, inclusive/nested and must not be summed across names. CPU sample times identify actually sampled functions, not inferred causes. Missing native/JS detail remains unattributed. Source maps used only when present in ATTRIBUTION_BUILD.", tasks: attributions };
await writeFile(path.join(root, `${label}-long-tasks.json`), JSON.stringify(result, null, 2));
const lines = [`# ${label}: trace-backed long tasks`, "", result.method, "", "| Run | Device | Seconds into scroll | Scene | Duration ms | Trace operations | Sampled script/function |", "| --- | --- | ---: | --- | ---: | --- | --- |"];
for (const t of attributions) lines.push(`| ${t.iteration} | ${t.device} | ${t.secondsIntoScroll.toFixed(3)} | ${t.scene} | ${t.durationMs.toFixed(1)} | ${t.operations.slice(0, 4).map((o) => `${o.name} ${o.inclusiveMs.toFixed(1)}ms`).join("; ")} | ${t.sampledFunctions.slice(0, 2).map((f) => f.original ? `${f.original.source}:${f.original.line} (${f.original.name ?? f.functionName})` : `${f.url || "native/unattributed"}:${f.lineNumber + 1} (${f.functionName})`).join("; ").replaceAll("|", "/")} |`);
await writeFile(path.join(root, `${label}-long-tasks.md`), lines.join("\n") + "\n");
console.log(label, attributions.length, "long tasks attributed from trace and CPU samples");

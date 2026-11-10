import test from "node:test";
import assert from "node:assert/strict";
import { checkPerformanceReports } from "../scripts/check-perf-reports.mjs";

const report = () => ({ browser: "test-browser", scrollMode: "gesture", hardware: { cpu: "test", logicalCpus: 4, platform: "win32" },
  runs: ["desktop", "mobile"].map(name => ({ name, viewport: { width: name === "mobile" ? 390 : 1440, height: 900 },
    cpuThrottle: name === "mobile" ? 4 : 1, durationMs: 30000, distance: 18000, frames: 1500,
    averageFrameMs: 18, p95FrameMs: name === "mobile" ? 30 : 19, droppedFrames: 0, longTasks: [], trace: `${name}.json.gz` })) });

test("comparable complete runs meeting both device budgets pass", () => {
  assert.equal(checkPerformanceReports(report(), report()).accepted, true);
});
test("partial reports and different input modes cannot establish acceptance", () => {
  const before = report(), after = report(); before.runs.pop(); after.scrollMode = "scripted";
  const result = checkPerformanceReports(before, after);
  assert.equal(result.comparable, false); assert.equal(result.accepted, false);
  assert(result.issues.some(issue => issue.includes("methods differ")));
  assert(result.issues.some(issue => issue.includes("mobile run")));
});
test("saved success flags cannot override a missed mobile budget or a long task", () => {
  const after = report(); after.runs[1].p95FrameMs = 33.4;
  after.runs[0].longTasks = [{ start: 10, duration: 51 }]; after.runs[1].passes = { p95: true };
  const result = checkPerformanceReports(report(), after);
  assert.equal(result.comparable, true); assert.equal(result.accepted, false);
  assert.equal(result.measurements[0].longTasksOver50Ms, 1);
});
test("device throttle, viewport, hardware and scroll coverage must match", () => {
  const after = report(); after.runs[1].cpuThrottle = 1; after.runs[0].distance = 1000;
  after.runs[0].viewport.width = 800; after.hardware.cpu = "different";
  const result = checkPerformanceReports(report(), after);
  assert.equal(result.comparable, false); assert.equal(result.issues.length, 4);
});
test("duplicate runs and malformed measurements are rejected", () => {
  const after = report(); after.runs.push(after.runs[0]);
  assert.equal(checkPerformanceReports(report(), after).accepted, false);
  after.runs[0].p95FrameMs = NaN;
  assert.equal(checkPerformanceReports(report(), after).accepted, false);
});

import { execFileSync } from "node:child_process";
import { lstatSync, readdirSync } from "node:fs";
import path from "node:path";

const git = (args, options = {}) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, ...options });
const largest = (items, count) => [...items].sort((a, b) => b.bytes - a.bytes).slice(0, count);
const table = (label, items) => {
  console.log(label);
  console.table(items.map(({ name, bytes }) => ({ name, bytes, MB: (bytes / 1e6).toFixed(2) })));
};
function info(file) {
  try { return lstatSync(file); }
  catch (error) { if (error.code !== "ENOENT") throw error; return null; }
}

const staged = process.argv.includes("--index");
const tracked = git(staged ? ["ls-files", "-s", "-z"] : ["ls-files", "-z"]).split("\0").filter(Boolean);
const entries = staged ? tracked.map((row) => {
  const tab = row.indexOf("\t");
  return { name: row.slice(tab + 1), hash: row.slice(0, tab).split(" ")[1] };
}) : tracked.map((name) => ({ name }));
const sizes = staged && entries.length ? git(["cat-file", "--batch-check=%(objectsize)"], { input: entries.map((entry) => entry.hash).join("\n") + "\n" }).trim().split("\n").map(Number) : [];
const trackedFiles = entries.map(({ name }, index) => ({ name, bytes: staged ? sizes[index] : info(name)?.size ?? 0 }));
const total = trackedFiles.reduce((sum, file) => sum + file.bytes, 0);
console.log(`Tracked files: ${trackedFiles.length}, ${total.toLocaleString("en-US")} bytes`);
if (process.argv.includes("--check")) {
  const oversized = trackedFiles.filter((file) => file.bytes > 2e6);
  if (oversized.length) table("Tracked files over 2 MB", oversized);
  if (oversized.length || total >= 25e6) process.exitCode = 1;
} else {
  const files = [];
  const walk = (name, collect = false) => {
    const stat = info(name);
    if (!stat || stat.isSymbolicLink()) return 0;
    if (!stat.isDirectory()) {
      if (collect && !/^node_modules([/\\]|$)/.test(name)) files.push({ name, bytes: stat.size });
      return stat.size;
    }
    return readdirSync(name).reduce((sum, child) => sum + walk(path.join(name, child), collect), 0);
  };
  const top = readdirSync(".").map((name) => ({ name, bytes: walk(name, true) }));
  table("Top-level folders and files", largest(top, top.length));
  const breakdown = (folder) => table(`Largest folders in ${folder}`, largest(readdirSync(folder, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map(({ name }) => ({ name, bytes: walk(path.join(folder, name)) })), 15));
  for (const folder of top.map(({ name }) => name).filter((name) => name === "node_modules" || name.startsWith(".next"))) breakdown(folder);
  if (info("node_modules/.pnpm")?.isDirectory()) breakdown("node_modules/.pnpm");
  table("Largest project files outside dependencies", largest(files, 30));
  console.log(git(["count-objects", "-vH"]).trim());
  const objects = git(["rev-list", "--objects", "--all"]);
  const blobs = git(["cat-file", "--batch-check=%(objecttype) %(objectname) %(objectsize) %(rest)"], { input: objects }).split("\n").flatMap((row) => {
    const match = /^blob (\S+) (\d+)(?: (.*))?$/.exec(row);
    return match ? [{ name: match[3] ?? match[1], bytes: Number(match[2]) }] : [];
  });
  table("Largest blobs across Git refs", largest(blobs, 20));
}

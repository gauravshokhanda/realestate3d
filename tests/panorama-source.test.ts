import test from "node:test";
import assert from "node:assert/strict";
import { panoramaSource } from "../lib/panorama-source";
import type { TourNode } from "../lib/panorama";
const nodes: TourNode[] = ["a", "b", "c"].map((id, i) => ({ id, roomId: "room", roomLabel: "Room", name: id, image: `/${id}.webp`, mobileImage: `/${id}-mobile.webp`, planX: 50, planY: 50, startYaw: 0, links: i < 2 ? [{ toNodeId: ["b", "c"][i], yaw: 0, pitch: 0, label: "Next" }] : [] }));
test("preload/navigation share a request; only current and likely next object URLs are retained", async (t) => {
  const fetches: string[] = [], revoked: string[] = [], released: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => { fetches.push(url); return new Response(new Blob(["test image"])); });
  let next = 0; t.mock.method(URL, "createObjectURL", () => `blob:test-${++next}`); t.mock.method(URL, "revokeObjectURL", (url: string) => { revoked.push(url); });
  const source = panoramaSource(nodes, true, (url) => released.push(url));
  await Promise.all([source.preload("a"), source.getNode("a")]); assert.deepEqual(fetches, ["/a-mobile.webp"]);
  await source.preload("b"); source.focus("b"); assert.deepEqual(revoked, ["blob:test-1"]);
  source.abort(); source.dispose(); assert.deepEqual(revoked, ["blob:test-1", "blob:test-2"]); assert.deepEqual(released, revoked);
  await assert.rejects(source.getNode("c"), { name: "AbortError" });
});
test("closing during a late body read never creates an object URL", async (t) => {
  let resolveBody: (blob: Blob) => void = () => {};
  t.mock.method(globalThis, "fetch", async () => ({ ok: true, blob: () => new Promise<Blob>((resolve) => { resolveBody = resolve; }) }));
  let created = 0; t.mock.method(URL, "createObjectURL", () => { created++; return "blob:late"; });
  const source = panoramaSource(nodes, false, () => {});
  const load = source.getNode("a"); await new Promise((resolve) => setTimeout(resolve, 0)); source.abort(); resolveBody(new Blob(["late"]));
  await assert.rejects(load, { name: "AbortError" }); source.dispose(); assert.equal(created, 0);
});

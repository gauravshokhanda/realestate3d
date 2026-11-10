import test from "node:test";
import assert from "node:assert/strict";
import { mobilePanorama, panoSnapshotSchema } from "../lib/panorama";
const node = (id: string) => ({ id, roomId: "living", name: id, image: "/media/properties/test/panoramas/asset.webp", planX: 25, planY: 50, startYaw: 0, links: [] as { toNodeId: string; label: string; yaw: number; pitch: number }[] });
test("a linked two-node tour round-trips; mobile URLs retain the property namespace", () => {
  const a = node("a"), b = node("b"); a.links.push({ toNodeId: "b", label: "Kitchen", yaw: 0.4, pitch: -0.1 }); b.links.push({ toNodeId: "a", label: "Living", yaw: 3, pitch: 0 });
  const value = { revision: "a".repeat(64), nodes: [a, b] }; assert.deepEqual(panoSnapshotSchema.parse(value), value); assert.equal(mobilePanorama(a.image), "/media/properties/test/panoramas/asset-mobile.webp");
});
test("invalid graph references, duplicate IDs, bounds and non-finite coordinates are rejected", () => {
  const a = node("a");
  for (const patch of [{ links: [{ toNodeId: "foreign", label: "Elsewhere", yaw: 0, pitch: 0 }] }, { links: [{ toNodeId: "a", label: "Self", yaw: 0, pitch: 0 }] }, { startYaw: Infinity }, { planX: -1 }, { planY: null }, { links: [{ toNodeId: "b", label: "B", yaw: 0, pitch: 2 }] }]) assert.equal(panoSnapshotSchema.safeParse({ revision: "a".repeat(64), nodes: [{ ...a, ...patch }, node("b")] }).success, false);
  assert.equal(panoSnapshotSchema.safeParse({ revision: "a".repeat(64), nodes: [a, a] }).success, false);
});

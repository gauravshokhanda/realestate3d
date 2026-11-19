import { test } from "node:test";
import assert from "node:assert/strict";
import { assertFreeSpace, minimumFreeBytes, StorageSpaceError } from "../lib/storage/disk";
test("uploads/extraction fail below the fixed 2 GiB safety floor, including zero", async () => {
  for (const free of [0, minimumFreeBytes - 1]) await assert.rejects(assertFreeSpace("unused", async () => ({ free, total: 100000000000 })), (error: unknown) => error instanceof StorageSpaceError && error.status === 507 && /At least 2 GB/.test(error.message));
  assert.equal((await assertFreeSpace("unused", async () => ({ free: minimumFreeBytes, total: 100000000000 }))).free, minimumFreeBytes);
});

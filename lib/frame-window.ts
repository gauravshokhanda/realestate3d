/** A bounded, directional working set; never expands to a complete long scene. */
export function frameWindow(index: number, count: number, direction: number, foreground = true) {
  const behind = foreground ? 16 : 1, ahead = foreground ? 32 : 3;
  const low = Math.max(0, index - (direction < 0 ? ahead : behind));
  const high = Math.min(count - 1, index + (direction < 0 ? behind : ahead));
  return Array.from({ length: high - low + 1 }, (_, i) => low + i).sort((a, b) => Math.abs(a - index) - Math.abs(b - index) || direction * (b - a));
}

export function webpDimensions(buffer: ArrayBuffer) {
  const data = new DataView(buffer), bytes = new Uint8Array(buffer);
  const text = (start: number, count: number) => String.fromCharCode(...bytes.slice(start, start + count));
  if (data.byteLength < 30 || text(0, 4) !== "RIFF" || text(8, 4) !== "WEBP") throw new Error("Invalid WebP frame");
  const format = text(12, 4);
  const uint24 = (at: number) => data.getUint8(at) + (data.getUint8(at + 1) << 8) + (data.getUint8(at + 2) << 16);
  if (format === "VP8X") return { width: uint24(24) + 1, height: uint24(27) + 1 };
  if (format === "VP8 ") return { width: data.getUint16(26, true) & 0x3fff, height: data.getUint16(28, true) & 0x3fff };
  if (format === "VP8L" && data.getUint8(20) === 0x2f) { const bits = data.getUint32(21, true); return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }; }
  throw new Error("Unsupported WebP frame header");
}

export type ClosableFrame = { width: number; height: number; close(): void };
export class BitmapLRU<T extends ClosableFrame> {
  readonly entries = new Map<string, { bitmap: T; bytes: number; touched: number }>();
  bytes = 0;
  reserved = 0;
  peak = 0;
  private clock = 0;
  constructor(public budget: number, readonly spare = 6) {}
  get(key: string) { const entry = this.entries.get(key); if (entry) entry.touched = ++this.clock; return entry?.bitmap; }
  delete(key: string) { const entry = this.entries.get(key); if (entry) { this.entries.delete(key); this.bytes -= entry.bytes; entry.bitmap.close(); } }
  trim(wanted: Set<string>, protectedKeys = new Set<string>()) {
    const stale = [...this.entries].filter(([key]) => !wanted.has(key) && !protectedKeys.has(key)).sort((a, b) => b[1].touched - a[1].touched);
    stale.slice(this.spare).forEach(([key]) => this.delete(key));
  }
  reserve(bytes: number, protectedKeys: Set<string>, wanted: Set<string>) {
    if (!Number.isFinite(bytes) || bytes <= 0 || bytes > this.budget) return false;
    const evict = [...this.entries].filter(([key]) => !protectedKeys.has(key)).sort((a, b) => Number(wanted.has(a[0])) - Number(wanted.has(b[0])) || a[1].touched - b[1].touched);
    while (this.bytes + this.reserved + bytes > this.budget && evict.length) this.delete(evict.shift()![0]);
    if (this.bytes + this.reserved + bytes > this.budget) return false;
    this.reserved += bytes; this.peak = Math.max(this.peak, this.bytes + this.reserved); return true;
  }
  put(key: string, bitmap: T, reservation: number) {
    this.reserved -= reservation;
    const bytes = bitmap.width * bitmap.height * 4;
    if (this.bytes + this.reserved + bytes > this.budget) { bitmap.close(); return false; }
    this.delete(key); this.entries.set(key, { bitmap, bytes, touched: ++this.clock }); this.bytes += bytes; this.peak = Math.max(this.peak, this.bytes + this.reserved); return true;
  }
  clear() { for (const key of this.entries.keys()) this.delete(key); }
}

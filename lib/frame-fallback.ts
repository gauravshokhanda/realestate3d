/** Preserve timeline indices; ties use the earlier successfully decoded frame. */
export function fillMissingFrames<T>(frames: (T | null)[]): T[] {
  const loaded = frames.flatMap((image, index) => image ? [{ image, index }] : []);
  if (!loaded.length) throw new Error("No sequence frames could be loaded. Please retry.");
  let nearest = 0;
  return frames.map((image, index) => {
    while (nearest + 1 < loaded.length &&
      Math.abs(loaded[nearest + 1].index - index) < Math.abs(loaded[nearest].index - index)) {
      nearest++;
    }
    return image ?? loaded[nearest].image;
  });
}

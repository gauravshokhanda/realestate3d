let tail: Promise<void> = Promise.resolve();

/** Only one sequence may decode frames at a time, including rapid anchor jumps. */
export function enqueueSequence<T>(load: () => Promise<T>, signal: AbortSignal): Promise<T> {
  const result = tail.then(() => {
    if (signal.aborted) throw new DOMException("Loading cancelled", "AbortError");
    return load();
  });
  tail = result.then(() => {}, () => {});
  return result;
}

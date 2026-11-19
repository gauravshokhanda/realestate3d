"use client";

import { useState } from "react";
import type { Point } from "@/lib/admin/polygon";

type Outline = { points: Point[]; drawing: boolean };
type History = { previous: Outline[]; current: Outline; next: Outline[] };

export default function usePolygonHistory(initial: Point[]) {
  const [history, setHistory] = useState<History>({ previous: [], current: { points: initial, drawing: false }, next: [] });
  function reset(points: Point[]) { setHistory({ previous: [], current: { points, drawing: false }, next: [] }); }
  function push(current: Outline) { setHistory((old) => ({ previous: [...old.previous.slice(-99), old.current], current, next: [] })); }
  function undo() {
    setHistory((old) => old.previous.length ? { previous: old.previous.slice(0, -1), current: old.previous.at(-1)!, next: [old.current, ...old.next] } : old);
  }
  function redo() {
    setHistory((old) => old.next.length ? { previous: [...old.previous, old.current], current: old.next[0], next: old.next.slice(1) } : old);
  }
  return { outline: history.current, canUndo: Boolean(history.previous.length), canRedo: Boolean(history.next.length), reset, push, undo, redo };
}

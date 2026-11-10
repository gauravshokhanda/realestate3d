"use client";
import { useCallback, useRef, useState } from "react";
import PanoramaDialog from "@/components/panorama/PanoramaDialog";
import type { PanoNodeInput, TourNode } from "@/lib/panorama";
export default function AuthorPreview({ nodes, selected, planImage, update, close }: { nodes: TourNode[]; selected: string; planImage: string | null; update: (patch: Partial<PanoNodeInput>) => void; close: () => void }) {
  const heading = useRef(0);
  const [target, setTarget] = useState(""), [label, setLabel] = useState(""), [pick, setPick] = useState<{ yaw: number; pitch: number } | null>(null);
  const onPosition = useCallback((yaw: number) => { heading.current = yaw; }, []);
  const node = nodes.find((item) => item.id === selected)!;
  return <PanoramaDialog nodes={nodes} initialNodeId={selected} planImage={planImage} onClose={close} onPosition={onPosition} onPick={target ? (yaw, pitch) => setPick({ yaw, pitch }) : undefined} toolbar={<>
    <strong>Author this viewpoint</strong><p>Drag to face the desired starting direction.</p><button onClick={() => { update({ startYaw: heading.current }); close(); }}>Use current view as start direction</button>
    <label>Arrow destination<select value={target} onChange={(e) => { setTarget(e.target.value); setPick(null); }}><option value="">Preview only</option>{nodes.filter((item) => item.id !== selected).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    {target && <><label>Arrow label<input value={label} maxLength={100} placeholder="Destination name" onChange={(e) => setLabel(e.target.value)} /></label><p>Click the panorama to place the arrow.</p><p aria-live="polite">{pick ? `Yaw ${pick.yaw.toFixed(4)}, pitch ${pick.pitch.toFixed(4)} radians` : "No position selected"}</p><button disabled={!pick} onClick={() => { if (!pick) return; update({ links: [...node.links.filter((link) => link.toNodeId !== target), { toNodeId: target, ...pick, label: label.trim() || nodes.find((item) => item.id === target)!.name }] }); close(); }}>Save arrow position</button></>}
  </>} />;
}

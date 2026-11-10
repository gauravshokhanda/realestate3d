"use client";
import Image from "next/image";
import type { PanoNodeInput } from "@/lib/panorama";
export default function Positioner({ image, node, nodes, update }: { image: string | null; node: PanoNodeInput; nodes: PanoNodeInput[]; update: (patch: Partial<PanoNodeInput>) => void }) {
  return <div><h3>Position on the floor plan</h3><p>Click the plan to place this viewpoint. Coordinates are percentages.</p>
    {image ? <button type="button" className="admin-pano-positioner" aria-label={`Place ${node.name} on floor plan`} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); if (event.detail === 0) { update({ planX: 50, planY: 50 }); return; } update({ planX: Math.round((event.clientX - rect.left) / rect.width * 10000) / 100, planY: Math.round((event.clientY - rect.top) / rect.height * 10000) / 100 }); }}>
      <Image src={image} alt="Floor plan; click to position the selected viewpoint" width={800} height={450} unoptimized />{nodes.filter((item) => item.planX !== null).map((item) => <span className={item.id === node.id ? "active" : ""} key={item.id} style={{ left: `${item.planX}%`, top: `${item.planY}%` }}>{item.id === node.id ? "+" : "·"}</span>)}
    </button> : <p className="admin-notice">Upload a floor-plan image in Images first.</p>}
    <div className="admin-form-grid">{(["planX", "planY"] as const).map((axis) => <label className="admin-field" key={axis}><span>{axis === "planX" ? "Plan X (%)" : "Plan Y (%)"}</span><input type="number" min="0" max="100" step="0.01" value={node[axis] ?? ""} onChange={(e) => { if (!e.target.value) update({ planX: null, planY: null }); else update({ planX: node.planX ?? 50, planY: node.planY ?? 50, [axis]: Number(e.target.value) }); }} /></label>)}</div>
    <button className="admin-secondary" onClick={() => update({ planX: null, planY: null })}>Clear plan position</button>
  </div>;
}

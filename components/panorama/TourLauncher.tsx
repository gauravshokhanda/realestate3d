"use client";
import { useCallback, useState } from "react";
import PanoramaDialog from "./PanoramaDialog";
import type { PropertyView } from "@/lib/property-types";
export default function TourLauncher({ property, roomId, landed }: { property: PropertyView; roomId: string; landed: boolean }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const first = property.panoramas.find((node) => node.roomId === roomId);
  if (!first || !landed) return null;
  return <><button className="pano-explore" onClick={() => setOpen(true)}>Explore in 360° <span aria-hidden="true">↗</span></button>{open && <PanoramaDialog nodes={property.panoramas} initialNodeId={first.id} planImage={property.planImage} onClose={close} />}</>;
}

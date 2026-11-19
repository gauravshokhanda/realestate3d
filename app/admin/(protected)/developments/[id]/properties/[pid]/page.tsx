import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Badge, Card } from "@/components/admin/ui/surfaces";
import { buttonClass } from "@/components/admin/ui/controls";

export default async function PropertyPage({ params }: { params: Promise<{ id: string; pid: string }> }) {
  const { id, pid } = await params;
  const property = await db.property.findFirst({ where: { id: pid, developmentId: id }, include: { development: true, rooms: { select: { _count: { select: { nodes: true } } } }, scenes: { select: { status: true } } } });
  if (!property) notFound();
  return <>
    <div className="crm-heading"><div><p className="crm-kicker">{property.development.name}</p><h1>{property.name}</h1>
      <div className="crm-heading-meta"><Badge status={property.status} /><span>/{property.development.slug}/{property.slug}</span></div>
    </div><Link className={buttonClass()} href={`/admin/developments/${id}`}>Back to development</Link></div>
    <Card><h2>Tour content</h2><dl className="crm-property-facts">
      <div><dt>Building map</dt><dd>{property.polygon ? "Placed" : "Unplaced"}</dd></div>
      <div><dt>Floor plan</dt><dd>{property.planImage ? "Uploaded" : "Pending"}</dd></div>
      <div><dt>Rooms</dt><dd>{property.rooms.length}</dd></div>
      <div><dt>Videos ready</dt><dd>{property.scenes.filter((scene) => scene.status === "ready").length} / {property.scenes.length}</dd></div>
      <div><dt>Panoramas</dt><dd>{property.rooms.reduce((count, room) => count + room._count.nodes, 0)}</dd></div>
    </dl><div className="crm-actions">
      <Link className={buttonClass("primary")} href={`/admin/properties/${pid}`}>Open tour editor</Link>
      {property.status === "published" && property.development.status === "published" && <Link className={buttonClass()} href={`/${property.development.slug}/${property.slug}`}>View site</Link>}
    </div></Card>
  </>;
}

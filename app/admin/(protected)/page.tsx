import Link from "next/link";
import { db } from "@/lib/db";
export default async function AdminPage() {
  const properties = await db.property.findMany({ orderBy: { updatedAt: "desc" }, select: { id: true, name: true, slug: true, status: true, location: true, _count: { select: { units: true, rooms: true } } } });
  return <><div className="admin-page-heading"><div><p className="admin-eyebrow">Your portfolio</p><h1>Properties</h1><p>Build a new perspective, one address at a time.</p></div><Link className="admin-primary" href="/admin/properties/new">+ Add property</Link></div><div className="admin-property-grid">{properties.map((p) => <Link className="admin-card admin-property-card" key={p.id} href={`/admin/properties/${p.id}`}><div className="admin-card-top"><span className={`admin-badge ${p.status}`}>{p.status}</span><span aria-hidden="true">↗</span></div><h2>{p.name}</h2><p>{p.location || `/${p.slug}`}</p><div className="admin-card-footer"><span>{p._count.units} units · {p._count.rooms} rooms</span><span>Edit property →</span></div></Link>)}{!properties.length && <div className="admin-card"><h2>Your first address awaits.</h2><p>Add a property to begin.</p></div>}</div></>;
}

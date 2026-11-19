import Link from "next/link";
import { ArrowUpRight, Building2, Globe, House } from "lucide-react";
import { db } from "@/lib/db";
import DevelopmentTable, { developmentListSelect } from "@/components/admin/developments/DevelopmentTable";
import { buttonClass } from "@/components/admin/ui/controls";
import { Card } from "@/components/admin/ui/surfaces";

export default async function AdminPage() {
  const [developments, properties, published, recent, tours] = await Promise.all([
    db.development.count(), db.property.count(),
    db.property.count({ where: { status: "published", development: { status: "published" } } }),
    db.development.findMany({ take: 6, orderBy: [{ updatedAt: "desc" }, { name: "asc" }], select: developmentListSelect }),
    db.development.findMany({ orderBy: { updatedAt: "desc" }, select: { id: true, name: true, properties: { orderBy: { order: "asc" }, select: { id: true, planImage: true } } } }),
  ]);
  return <>
    <div className="crm-heading"><div><h1>Dashboard</h1><p>Manage your developments and residential tours.</p></div>
      <Link className={buttonClass("primary")} href="/admin/developments/new">New development</Link>
    </div>
    <div className="crm-stat-grid">
      {[{ label: "Developments", value: developments, Icon: Building2 }, { label: "Properties", value: properties, Icon: House }, { label: "Published properties", value: published, Icon: Globe }].map(({ label, value, Icon }) => <Card className="crm-stat" key={label}>
        <div><span>{label}</span><strong>{value}</strong></div><Icon size={20} aria-hidden="true" />
      </Card>)}
    </div>
    <section className="crm-section" aria-labelledby="recent-developments">
      <div className="crm-heading"><h2 id="recent-developments">Recent developments</h2><Link className={buttonClass()} href="/admin/developments">All developments <ArrowUpRight size={14} aria-hidden="true" /></Link></div>
      <DevelopmentTable items={recent} />
    </section>
    <Card className="crm-section">
      <div className="crm-heading"><h2>Tour editor</h2><Link className={buttonClass()} href="/admin/properties/new">+ Add property</Link></div>
      <div className="crm-tour-links">{tours.flatMap((tour) => {
        const property = tour.properties.find((p) => p.id === tour.id) ?? tour.properties.find((p) => p.planImage);
        return property ? [<Link className={buttonClass()} key={property.id} href={`/admin/properties/${property.id}`}>{tour.name} <ArrowUpRight size={14} aria-hidden="true" /></Link>] : [];
      })}</div>
    </Card>
  </>;
}

import Image from "next/image";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { mediaUrl } from "@/lib/storage";
import { Badge, EmptyState, Table } from "../ui/surfaces";
import { buttonClass } from "../ui/controls";

type Row = { id: string; name: string; slug: string; location: string | null; buildingImage: string | null; status: string; updatedAt: Date; _count: { properties: number }; properties: { id: string }[] };
export const developmentListSelect = {
  id: true, name: true, slug: true, location: true, buildingImage: true, status: true, updatedAt: true,
  _count: { select: { properties: true } }, properties: { where: { status: "published" }, take: 1, select: { id: true } },
} as const;
const date = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });
export default function DevelopmentTable({ items }: { items: Row[] }) {
  if (!items.length) return <EmptyState title="No developments yet" action={<Link className={buttonClass("primary")} href="/admin/developments/new">New development</Link>}>Add a development to start organizing properties.</EmptyState>;
  return <Table aria-label="Developments">
    <thead><tr><th scope="col">Development</th><th scope="col" className="crm-coordinate-col">Location</th><th scope="col">Properties</th><th scope="col">Status</th><th scope="col" className="crm-date-col">Updated</th><th scope="col">Actions</th></tr></thead>
    <tbody>{items.map((item) => <tr key={item.id}>
      <td><div className="crm-table-name">
        <div className="crm-thumbnail">{item.buildingImage ? <Image src={mediaUrl(item.buildingImage)} alt="" fill sizes="64px" unoptimized /> : <Building2 size={20} aria-hidden="true" />}</div>
        <div><strong>{item.name}</strong><small>/{item.slug}</small></div>
      </div></td>
      <td className="crm-coordinate-col">{item.location || "—"}</td><td>{item._count.properties}</td><td><Badge status={item.status} /></td>
      <td className="crm-date-col"><time dateTime={item.updatedAt.toISOString()}>{date.format(item.updatedAt)}</time></td>
      <td><div className="crm-row-actions">
        <Link className={buttonClass()} href={`/admin/developments/${item.id}`}>Open<span className="sr-only"> {item.name}</span></Link>
        {item.status === "published" && item.properties.length > 0 && <Link className="crm-text-link" href={`/${item.slug}`}>View site<span className="sr-only"> for {item.name}</span></Link>}
      </div></td>
    </tr>)}</tbody>
  </Table>;
}

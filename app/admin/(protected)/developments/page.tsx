import Link from "next/link";
import { db } from "@/lib/db";
import DevelopmentTable, { developmentListSelect } from "@/components/admin/developments/DevelopmentTable";
import { buttonClass } from "@/components/admin/ui/controls";

export default async function DevelopmentsPage() {
  const items = await db.development.findMany({ orderBy: [{ updatedAt: "desc" }, { name: "asc" }], select: developmentListSelect });
  return <>
    <div className="crm-heading"><div><h1>Developments</h1><p>Manage building details and locate properties on each building map.</p></div>
      <Link className={buttonClass("primary")} href="/admin/developments/new">New development</Link>
    </div>
    <DevelopmentTable items={items} />
  </>;
}

import type { Metadata } from "next";
import "./admin.css";
import "./crm.css";
export const metadata: Metadata = { title: "CRM | Aurelia", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default function AdminLayout({ children }: { children: React.ReactNode }) { return <div className="admin-root">{children}</div>; }

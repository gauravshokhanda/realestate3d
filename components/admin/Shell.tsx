"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminApi } from "./api";
import StorageSummary from "./StorageSummary";
export default function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter(), [error, setError] = useState("");
  return <><header className="admin-header"><Link className="admin-brand" href="/admin">AURELIA<span>Property studio</span></Link><nav aria-label="Admin navigation"><Link href="/admin">Properties</Link><Link href="/">View collection ↗</Link><button onClick={async () => { try { await adminApi("/api/admin/logout", { method: "POST" }); router.push("/admin/login"); router.refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to sign out."); } }}>Sign out</button></nav></header>{error && <p role="alert" className="admin-error">{error}</p>}<main className="admin-main">{children}</main><StorageSummary /></>;
}

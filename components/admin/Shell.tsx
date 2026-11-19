"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, ChevronDown, CircleUserRound, ExternalLink, LayoutDashboard, Menu, Settings, Users } from "lucide-react";
import { adminApi } from "./api";
import StorageSummary from "./StorageSummary";
import { SaveContext, type SaveState } from "./ui/save-state";
import { Toast } from "./ui/surfaces";

const navigation = [
  { href: "/admin", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/admin/developments", label: "Developments", Icon: Building2 },
  { href: "/admin/leads", label: "Leads", Icon: Users },
  { href: "/admin/settings", label: "Settings", Icon: Settings },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter(), pathname = usePathname();
  const [error, setError] = useState(""), [save, setSave] = useState<SaveState>("Saved"), [navOpen, setNavOpen] = useState(false);
  const active = navigation.find(({ href }) => href === pathname || (href !== "/admin" && pathname.startsWith(href + "/")));
  const developmentRoute = pathname.startsWith("/admin/developments/");
  useEffect(() => { setNavOpen(false); }, [pathname]);
  return <SaveContext.Provider value={setSave}>
    <div className="crm-shell">
      <aside id="crm-sidebar" className={`crm-sidebar ${navOpen ? "is-open" : ""}`}>
        <Link className="admin-brand crm-brand" href="/admin">AURELIA<span>CRM</span></Link>
        <nav aria-label="Admin navigation">{navigation.map(({ href, label, Icon }) => <Link aria-current={active?.href === href ? "page" : undefined} title={label} key={href} href={href}>
          <Icon size={17} aria-hidden="true" /><span>{label}</span>
        </Link>)}</nav>
        <Link href="/" className="crm-site-link"><ExternalLink size={15} aria-hidden="true" /> View collection</Link>
      </aside>
      <div className="crm-body">
        <header className="crm-topbar">
          <button className="crm-nav-toggle" aria-label="Toggle navigation" aria-expanded={navOpen} aria-controls="crm-sidebar" onClick={() => setNavOpen(!navOpen)}><Menu size={20} /></button>
          <nav className="crm-crumbs" aria-label="Breadcrumb">
            <Link href="/admin">CRM</Link><span aria-hidden="true">/</span>
            {developmentRoute ? <><Link href="/admin/developments">Developments</Link><span aria-hidden="true">/</span><span>{pathname.endsWith("/new") ? "New" : pathname.includes("/properties/") ? "Property" : "Edit"}</span></> : <span>{active?.label ?? "Tour editor"}</span>}
          </nav>
          <span className="crm-save" role="status" aria-label="Workspace save status" data-state={save}>{save}</span>
          <details className="crm-profile"><summary aria-label="Admin account"><CircleUserRound size={19} aria-hidden="true" /><span>Admin</span><ChevronDown size={13} aria-hidden="true" /></summary>
            <button type="button" onClick={async () => {
              try { await adminApi("/api/admin/logout", { method: "POST" }); router.push("/admin/login"); router.refresh(); }
              catch (error) { setError(error instanceof Error ? error.message : "Unable to sign out."); }
            }}>Sign out</button>
          </details>
        </header>
        <main id="admin-main" className="admin-main crm-main"><Toast message={error} variant="alert" />{children}</main>
        <StorageSummary />
      </div>
    </div>
  </SaveContext.Provider>;
}

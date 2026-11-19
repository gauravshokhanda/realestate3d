import Link from "next/link";
import { redirect } from "next/navigation";
import Login from "@/components/admin/Login";
import { authConfigured } from "@/lib/admin/session";
import { hasAdminSession } from "@/lib/admin/http";
export default async function LoginPage() {
  if (await hasAdminSession()) redirect("/admin");
  return <main className="admin-login-page"><Link href="/" className="admin-brand">AURELIA<span>Property studio</span></Link><Login configured={authConfigured()} /><p className="admin-muted">A considered home for every detail.</p></main>;
}

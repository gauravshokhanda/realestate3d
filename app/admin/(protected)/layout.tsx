import { redirect } from "next/navigation";
import { hasAdminSession } from "@/lib/admin/http";
import Shell from "@/components/admin/Shell";
import { wakeWorker } from "@/lib/jobs/worker";
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) { if (!await hasAdminSession()) redirect("/admin/login"); wakeWorker(); return <Shell>{children}</Shell>; }

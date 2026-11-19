import type { HTMLAttributes, ReactNode, TableHTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return <section {...props} className={`crm-card ${className}`} />;
}
export function Table({ className = "", ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <div className="crm-table-wrap"><table {...props} className={`crm-table ${className}`} /></div>;
}
export function Badge({ status }: { status: string }) {
  return <span className={`crm-badge crm-badge-${status.toLowerCase().replace(/[^a-z-]/g, "-")}`}>{status.replaceAll("_", " ")}</span>;
}
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="crm-empty"><h2>{title}</h2>{children && <p>{children}</p>}{action}</div>;
}
export function Skeleton({ label = "Loading" }: { label?: string }) {
  return <div className="crm-skeleton" role="status" aria-label={label}><i /><i /><i /></div>;
}
export function Toast({ message, variant = "status" }: { message: string; variant?: "status" | "alert" }) {
  return message && <div role={variant} className={`crm-toast ${variant === "alert" ? "crm-toast-error" : ""}`}>{message}</div>;
}

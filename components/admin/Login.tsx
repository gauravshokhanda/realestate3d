"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminApi } from "./api";
import { Field } from "./Fields";
export default function Login({ configured }: { configured: boolean }) {
  const [password, setPassword] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const router = useRouter();
  return <form className="admin-login admin-card" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try { await adminApi("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) }); const next = new URLSearchParams(window.location.search).get("next"); router.push(next && /^\/admin(?:\/|$)/.test(next) && !next.startsWith("/admin/login") ? next : "/admin"); router.refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to sign in."); } finally { setBusy(false); }
  }}>
    <p className="admin-eyebrow">Private access</p><h1>Welcome back.</h1><p>Manage your properties, images and experiences.</p>
    {!configured && <p role="alert" className="admin-notice">Set ADMIN_PASSWORD and SESSION_SECRET (at least 32 characters) in the server environment to enable login.</p>}
    <Field label="Admin password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
    {error && <p role="alert" className="admin-error">{error}</p>}
    <button className="admin-primary" disabled={busy || !configured}>{busy ? "Signing in…" : "Sign in"}</button>
  </form>;
}

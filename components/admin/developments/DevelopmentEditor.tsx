"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DevelopmentForm, MapProperty } from "@/lib/admin/development-schema";
import { adminApi } from "../api";
import { Button, buttonClass, Field, Input, Textarea } from "../ui/controls";
import { Badge, Card, Toast } from "../ui/surfaces";
import { ConfirmDialog } from "../ui/Modal";
import Tabs from "../ui/Tabs";
import ImageDropzone from "../ui/ImageDropzone";
import DevelopmentSlug from "./DevelopmentSlug";
import DevelopmentTheme from "./DevelopmentTheme";
import { useSaveIndicator } from "../ui/save-state";
import useDevelopmentForm from "./useDevelopmentForm";
import BuildingMap from "./BuildingMap";

const tabs = [{ key: "details", label: "Details" }, { key: "map", label: "Building map" }, { key: "theme", label: "Theme" }];
export default function DevelopmentEditor({ initial, properties }: { initial: DevelopmentForm; properties: MapProperty[] }) {
  const router = useRouter(), base = `/api/admin/developments/${initial.id}`;
  const editor = useDevelopmentForm(initial);
  const { form, setForm, persisted, busy, failure, errors, save, state } = editor;
  const [tab, setTab] = useState("details"), [confirm, setConfirm] = useState(false), [deleting, setDeleting] = useState(false), [deleteError, setDeleteError] = useState("");
  useSaveIndicator(state, tab !== "map");
  function change<K extends keyof DevelopmentForm>(key: K, value: DevelopmentForm[K]) { setForm((old) => ({ ...old, [key]: value })); }
  const fields = [{ key: "name", label: "Development name", max: 120 }, { key: "tagline", label: "Tagline", max: 250 }, { key: "location", label: "Location", max: 250 }] as const;
  return <>
    <div className="crm-heading">
      <div><p className="crm-kicker">Developments</p><h1>{persisted.name}</h1><div className="crm-heading-meta"><Badge status={persisted.status} /><span>/{persisted.slug}</span></div></div>
      <div className="crm-actions">
        {persisted.status === "published" && properties.some((property) => property.status === "published") && <Link className={buttonClass()} href={`/${persisted.slug}`}>View site</Link>}
        <Button variant="primary" disabled={busy} onClick={() => change("status", form.status === "published" ? "draft" : "published")}>{form.status === "published" ? "Unpublish" : "Publish development"}</Button>
      </div>
    </div>
    <Toast message={failure || deleteError} variant="alert" />
    <div className="crm-editor-status">
      <span role="status" aria-label="Development save status">{state}</span>
      {state === "Not saved" && <Button onClick={() => void save()}>Retry save</Button>}
    </div>
    <Tabs tabs={tabs} value={tab} onChange={setTab} label="Development sections">
      {tab === "details" && <div className="crm-development-details">
        <Card className="crm-form">
          <h2>Development details</h2>
          <div className="crm-fields">
            {fields.map(({ key, label, max }) => <Field key={key} id={`development-${key}`} label={label} error={errors[key]}>
              <Input id={`development-${key}`} value={form[key]} maxLength={max} aria-invalid={Boolean(errors[key])}
                aria-describedby={errors[key] ? `development-${key}-error` : undefined} onChange={(event) => change(key, event.target.value)} />
            </Field>)}
            <DevelopmentSlug developmentId={form.id} slug={form.slug} error={errors.slug} onChange={(value) => change("slug", value)} />
          </div>
          <Field id="development-description" label="Description" error={errors.description}>
            <Textarea id="development-description" rows={4} value={form.description} maxLength={3000} onChange={(event) => change("description", event.target.value)} />
          </Field>
          <div className="crm-actions"><Button onClick={() => setConfirm(true)} variant="danger">Delete development</Button></div>
        </Card>
        <Card className="crm-form">
          <h2>Images</h2>
          <ImageDropzone label="Building image" value={form.buildingImage} url={`${base}/images?kind=building`} onChange={(value) => change("buildingImage", value)} />
          {errors.buildingImage && <small className="crm-field-error">{errors.buildingImage}</small>}
          <ImageDropzone label="Logo image" value={form.logoImage} url={`${base}/images?kind=logo`} onChange={(value) => change("logoImage", value)} />
        </Card>
      </div>}
      {tab === "theme" && <Card className="crm-form"><h2>Development theme</h2>
        <DevelopmentTheme theme={form.theme} errors={errors} onChange={(value) => change("theme", value)} />
      </Card>}
      <div hidden={tab !== "map"}>
        <BuildingMap developmentId={initial.id} image={persisted.buildingImage} initialProperties={properties} active={tab === "map"} />
      </div>
    </Tabs>
    {confirm && <ConfirmDialog title="Delete development" message={`Delete ${persisted.name} and its properties? This action cannot be undone.`} confirmLabel="Delete development"
      pending={deleting} onClose={() => { if (!deleting) setConfirm(false); }} onConfirm={async () => {
        setDeleting(true); setDeleteError("");
        try { await adminApi(base, { method: "DELETE" }); router.push("/admin/developments"); router.refresh(); }
        catch (error) { setDeleteError(error instanceof Error ? error.message : "Unable to delete."); setConfirm(false); setDeleting(false); }
      }} />}
  </>;
}

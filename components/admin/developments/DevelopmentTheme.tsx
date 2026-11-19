"use client";

import { Field, Input, Select } from "../ui/controls";
import type { DevelopmentForm } from "@/lib/admin/development-schema";

type Theme = DevelopmentForm["theme"];
const settings = {
  fontPair: { label: "Font pair", values: ["serif-classic", "serif-modern", "sans-minimal", "display-bold"] },
  motion: { label: "Motion", values: ["glide", "editorial", "snappy", "dreamy"] },
  transition: { label: "Transition", values: ["dissolve", "wipe", "zoom-through"] },
  captionStyle: { label: "Caption style", values: ["chip", "lowerThird", "minimal"] },
  overlay: { label: "Overlay", values: ["grain", "vignette", "none"] },
} as const;
export default function DevelopmentTheme({ theme, errors, onChange }: { theme: Theme; errors: Record<string, string>; onChange: (value: Theme) => void }) {
  return <div className="crm-fields">
    <Field id="theme-accent" label="Accent colour" error={errors["theme.accent"]}>
      <Input id="theme-accent" maxLength={7} value={theme.accent} aria-invalid={Boolean(errors["theme.accent"])}
        aria-describedby={errors["theme.accent"] ? "theme-accent-error" : undefined} onChange={(event) => onChange({ ...theme, accent: event.target.value })} />
    </Field>
    {(Object.keys(settings) as (keyof typeof settings)[]).map((key) => <Field key={key} id={`theme-${key}`} label={settings[key].label}>
      <Select id={`theme-${key}`} value={theme[key]} onChange={(event) => onChange({ ...theme, [key]: event.target.value })}>
        {settings[key].values.map((value) => <option value={value} key={value}>{value === "lowerThird" ? "Lower third" : value.replaceAll("-", " ")}</option>)}
      </Select>
    </Field>)}
  </div>;
}

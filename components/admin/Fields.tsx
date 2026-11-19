"use client";
import { useId, type InputHTMLAttributes } from "react";
export function Field({ label, error, multiline, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; multiline?: boolean }) {
  const generated = useId(), id = props.id ?? generated;
  return <label className="admin-field" htmlFor={id}><span>{label}</span>{multiline ? <textarea id={id} value={String(props.value ?? "")} onChange={(event) => props.onChange?.(event as unknown as React.ChangeEvent<HTMLInputElement>)} rows={4} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} maxLength={props.maxLength} /> : <input {...props} id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />}{error && <small id={`${id}-error`} className="admin-error">{error}</small>}</label>;
}
export function EmptyState({ title, text }: { title: string; text: string }) { return <div className="admin-empty"><span className="admin-eyebrow">On the horizon</span><h2>{title}</h2><p>{text}</p></div>; }

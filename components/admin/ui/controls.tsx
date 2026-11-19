import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "ghost" | "danger";
export const buttonClass = (variant: ButtonVariant = "ghost") => `crm-button crm-button-${variant}`;
export function Button({ variant, className = "", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button {...props} type={type} className={`${buttonClass(variant)} ${className}`} />;
}
export function Input(props: InputHTMLAttributes<HTMLInputElement>) { return <input {...props} className="crm-control" />; }
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) { return <select {...props} className="crm-control" />; }
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea {...props} className="crm-control" />; }
export function Field({ id, label, help, error, children }: { id: string; label: string; help?: string; error?: string; children: ReactNode }) {
  return <div className="crm-field">
    <label htmlFor={id}>{label}</label>{children}
    {help && <small id={`${id}-help`}>{help}</small>}
    {error && <small id={`${id}-error`} className="crm-field-error">{error}</small>}
  </div>;
}

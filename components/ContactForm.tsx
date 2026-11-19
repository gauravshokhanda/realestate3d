"use client";

import { useEffect, useState, type FormEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { PropertyView } from "@/lib/property-types";
import { fieldErrors, leadSchema, type LeadErrors } from "@/lib/lead-schema";

export default function ContactForm({ selectedUnit, property }: { selectedUnit: string; property: PropertyView }) {
  const reduced = useReducedMotion();
  const { units } = property;
  const [unit, setUnit] = useState(selectedUnit);
  const [errors, setErrors] = useState<LeadErrors>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  useEffect(() => { setUnit(selectedUnit); }, [selectedUnit]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "loading") return;
    const form = event.currentTarget;
    const result = leadSchema.safeParse(Object.fromEntries(new FormData(form)));
    if (!result.success) {
      setErrors(fieldErrors(result.error));
      setStatus("idle");
      const field = result.error.issues[0]?.path[0];
      if (typeof field === "string") form.querySelector<HTMLElement>(`[name="${field}"]`)?.focus();
      return;
    }
    setErrors({});
    setStatus("loading");
    setMessage("");
    try {
      const response = await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(result.data), signal: AbortSignal.timeout(15000) });
      const body: { success?: boolean; error?: string; errors?: LeadErrors } = await response.json();
      if (!response.ok || !body.success) {
        setErrors(body.errors ?? {});
        setMessage(body.error ?? "We couldn’t send your inquiry. Please try again.");
        setStatus("error");
        return;
      }
      setStatus("success");
      form.reset();
    } catch {
      setStatus("error");
      setMessage("We couldn’t reach the inquiry service. Please try again.");
    }
  }

  const inputClass = "mt-3 w-full rounded-none border border-ivory/25 bg-ivory/[0.03] px-4 py-3 text-sm text-ivory placeholder:text-ivory/35 focus:border-champagne focus:outline-none focus:ring-1 focus:ring-champagne transition-colors duration-300";
  return (
    <section id="contact" className="grid gap-16 border-t border-champagne/20 bg-[#101011] px-6 py-24 sm:px-12 sm:py-32 lg:grid-cols-2 lg:px-20">
      <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: reduced ? 0 : 0.8, ease: [0.455, 0.03, 0.515, 0.955] }} className="motion-reduce:!transform-none motion-reduce:!opacity-100">
        <p className="text-[10px] uppercase tracking-[0.3em] text-champagne">Your next chapter</p>
        <h2 className="mt-6 max-w-lg font-display text-5xl leading-none text-ivory sm:text-7xl">Let’s find<br />your perspective.</h2>
        <p className="mt-8 max-w-sm text-sm leading-7 text-ivory/65">Arrange a private viewing or speak with our residences team. We’ll help you discover a space to call your own.</p>
      </motion.div>
      {status === "success" ? <div role="status" className="inquiry-success self-center border border-champagne/40 p-10"><span className="success-mark" aria-hidden="true">&#10003;</span><p className="font-display text-4xl text-ivory">Thank you for your interest.</p><p className="mt-5 text-sm leading-7 text-ivory/70">Your inquiry has been received. Our residences team will be in touch.</p><button type="button" className="mt-8 border-b border-champagne pb-2 text-sm text-champagne" onClick={() => setStatus("idle")}>Send another inquiry</button></div> : (
        <motion.form initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ duration: reduced ? 0 : 0.8, delay: reduced ? 0 : 0.12, ease: [0.455, 0.03, 0.515, 0.955] }} onSubmit={(event) => { void submit(event); }} noValidate aria-label="Residence inquiry" className="grid gap-6 motion-reduce:!transform-none motion-reduce:!opacity-100 sm:grid-cols-2">
          <input type="hidden" name="propertySlug" value={property.slug} />
          {([{ name: "name", label: "Full name", type: "text", autoComplete: "name", placeholder: "Your full name" }, { name: "email", label: "Email address", type: "email", autoComplete: "email", placeholder: "you@example.com" }, { name: "phone", label: "Phone (optional)", type: "tel", autoComplete: "tel", placeholder: "+1 (555) 000-0000" }] as const).map((field) => (
            <div key={field.name} className={field.name === "name" ? "sm:col-span-2" : ""}>
              <label htmlFor={field.name} className="text-xs text-ivory/80">{field.label}</label>
              <input {...field} id={field.name} required={field.name !== "phone"} maxLength={field.name === "email" ? 254 : field.name === "name" ? 100 : 30} className={inputClass} aria-invalid={Boolean(errors[field.name])} aria-describedby={errors[field.name] ? `${field.name}-error` : undefined} />
              {errors[field.name] && <p id={`${field.name}-error`} className="mt-2 text-xs text-[#edb5a3]">{errors[field.name]}</p>}
            </div>
          ))}
          <div className="sm:col-span-2"><label htmlFor="unit" className="text-xs text-ivory/80">Interested residence</label><select id="unit" name="unit" value={unit} onChange={(event) => setUnit(event.target.value)} className={inputClass} aria-invalid={Boolean(errors.unit)} aria-describedby={errors.unit ? "unit-error" : undefined}>{units.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.price}</option>)}</select>{errors.unit && <p id="unit-error" className="mt-2 text-xs text-[#edb5a3]">{errors.unit}</p>}</div>
          <div className="sm:col-span-2"><label htmlFor="message" className="text-xs text-ivory/80">Message (optional)</label><textarea id="message" name="message" rows={4} maxLength={2000} className={inputClass} placeholder="Tell us a little about what you’re looking for." aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? "message-error" : undefined} />{errors.message && <p id="message-error" className="mt-2 text-xs text-[#edb5a3]">{errors.message}</p>}</div>
          <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true"><label htmlFor="website">Leave this field blank</label><input id="website" name="website" tabIndex={-1} autoComplete="off" /></div>
          <div className="sm:col-span-2"><button type="submit" disabled={status === "loading"} className="w-full border border-champagne bg-champagne px-6 py-4 text-xs uppercase tracking-[0.2em] text-ink transition-colors hover:bg-ivory disabled:cursor-wait disabled:opacity-60">{status === "loading" ? "Sending your inquiry…" : "Request a private viewing"}</button><p className="mt-4 text-xs leading-6 text-ivory/50">By submitting, you agree to be contacted about your inquiry.</p></div>
          {status === "error" && <p role="alert" className="text-sm text-[#edb5a3] sm:col-span-2">{message}</p>}
        </motion.form>
      )}
    </section>
  );
}

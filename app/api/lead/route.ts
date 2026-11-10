import { NextResponse } from "next/server";
import { Resend } from "resend";
import { fieldErrors, leadSchema } from "@/lib/lead-schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ip = (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown").slice(0, 100);
  const rate = checkRateLimit(ip);
  if (!rate.allowed) return NextResponse.json({ error: "Too many inquiries. Please try again in a few minutes." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
  try {
    const text = await request.text();
    if (text.length > 16000) return NextResponse.json({ error: "Your inquiry is too long." }, { status: 413 });
    let body: unknown;
    try { body = JSON.parse(text); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
    if (typeof body === "object" && body !== null && "website" in body && typeof body.website === "string" && body.website.trim()) {
      return NextResponse.json({ success: true });
    }
    const parsed = leadSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Please check your details.", errors: fieldErrors(parsed.error) }, { status: 400 });
    const { website: _website, ...lead } = parsed.data;
    void _website;
    const unit = await db.unit.findFirst({ where: { id: lead.unit, property: { slug: lead.propertySlug, status: "published" } }, include: { property: { select: { name: true } } } });
    if (!unit) return NextResponse.json({ error: "Please choose a residence.", errors: { unit: "Please choose an available residence." } }, { status: 400 });
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      console.info("[lead:development-fallback]", lead);
      return NextResponse.json({ success: true });
    }
    const recipient = process.env.LEAD_TO_EMAIL;
    if (!recipient) return NextResponse.json({ error: "The inquiry service is temporarily unavailable. Please try again later." }, { status: 503 });
    const { error } = await new Resend(key).emails.send({
      from: process.env.LEAD_FROM_EMAIL || "Aurelia <onboarding@resend.dev>",
      to: recipient,
      replyTo: lead.email,
      subject: `${unit.property.name} inquiry · ${unit.name}`,
      text: `Name: ${lead.name}\nEmail: ${lead.email}\nPhone: ${lead.phone || "Not provided"}\nResidence: ${unit?.name ?? lead.unit}\n\n${lead.message || "Private viewing requested."}`,
    });
    if (error) return NextResponse.json({ error: "We couldn’t send your inquiry. Please try again." }, { status: 502 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "We couldn’t send your inquiry. Please try again." }, { status: 500 });
  }
}

import { notFound } from "next/navigation";
import { adminProperty } from "@/lib/admin/property";
import Editor from "@/components/admin/Editor";
export default async function PropertyEditPage({ params }: { params: Promise<{ id: string }> }) { const property = await adminProperty((await params).id); if (!property) notFound(); return <Editor initial={property} />; }

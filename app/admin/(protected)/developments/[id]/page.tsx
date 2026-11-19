import { notFound } from "next/navigation";
import { getDevelopment } from "@/lib/admin/developments";
import DevelopmentEditor from "@/components/admin/developments/DevelopmentEditor";

export default async function DevelopmentPage({ params }: { params: Promise<{ id: string }> }) {
  const development = await getDevelopment((await params).id);
  if (!development) notFound();
  return <DevelopmentEditor key={development.form.id} initial={development.form} properties={development.properties} />;
}

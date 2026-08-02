// Redirect from old /products/<slug> to new /p/<slug>
import { db } from "@/lib/db";
import { permanentRedirect } from "next/navigation";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function OldProductRedirect({ params }: PageProps) {
  const { slug } = await params;
  const product = await db.product.findUnique({ where: { slug }, select: { slug: true } });
  if (product) permanentRedirect(`/p/${product.slug}`);
  const byId = await db.product.findUnique({ where: { id: slug }, select: { slug: true } });
  if (byId) permanentRedirect(`/p/${byId.slug}`);
  permanentRedirect("/#v=shop");
}

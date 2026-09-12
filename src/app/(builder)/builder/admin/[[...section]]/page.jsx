import { notFound, redirect } from "next/navigation";

import { AdminSectionPage } from "@/components/admin/AdminSectionPage";
import { adminSectionHref, findAdminSectionById, resolveAdminSection } from "@/lib/builder/navigation";

export default async function AdminPage({ params, searchParams }) {
  const { section: segments } = await params;
  const { tab } = await searchParams;

  // Legacy `/builder/admin?tab=users` links (bookmarks, MCP results) still resolve.
  if (!segments && typeof tab === "string" && findAdminSectionById(tab)) {
    redirect(adminSectionHref(tab));
  }

  const section = resolveAdminSection(segments);
  if (!section) notFound();

  return <AdminSectionPage sectionId={section.id} />;
}

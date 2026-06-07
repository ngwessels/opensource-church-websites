"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

const EditWebsite = dynamic(
  () => import("@/components/builder/EditWebsite").then((m) => m.EditWebsite),
  {
    loading: () => (
      <div className="flex h-full min-h-[50vh] items-center justify-center text-muted-foreground">
        Loading editor…
      </div>
    ),
  },
);

export default function EditPage() {
  const params = useParams();
  const slugParts = params?.slug;
  const slug = Array.isArray(slugParts) ? slugParts.join("/") : slugParts || "";
  return <EditWebsite slug={slug} />;
}

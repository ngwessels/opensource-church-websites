import { EditWebsite } from "@/components/builder/EditWebsite";

export default async function EditPage({ params }) {
  const { slug: slugParts } = await params;
  const slug = slugParts?.join("/") || "";
  return <EditWebsite slug={slug} />;
}

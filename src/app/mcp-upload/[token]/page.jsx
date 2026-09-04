import { McpUploadDropzone } from "@/components/mcp/McpUploadDropzone";
import { getMediaUploadLinkPublic } from "@/lib/cms/media";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export const metadata = {
  title: "Upload file",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function McpUploadPage({ params }) {
  const { token } = await params;
  if (typeof token !== "string" || !token.trim()) {
    return (
      <main className="mx-auto w-full max-w-lg px-4 py-12">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">Upload a file</h1>
        <p className="text-muted-foreground">This upload link is invalid.</p>
      </main>
    );
  }

  const trimmed = token.trim();
  let initialInfo = {
    status: "not_found",
    message: "Upload link not found.",
  };

  if (isFirebaseAdminConfigured()) {
    initialInfo = await getMediaUploadLinkPublic(trimmed);
  } else {
    initialInfo = { status: "error", message: "Server is not configured." };
  }

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-12">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Upload a file</h1>
      <p className="mb-6 text-muted-foreground">
        One PDF or image for the parish media library. No login is required.
      </p>
      <McpUploadDropzone token={trimmed} initialInfo={initialInfo} />
    </main>
  );
}

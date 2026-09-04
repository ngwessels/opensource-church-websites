import { McpUploadDropzone } from "@/components/mcp/McpUploadDropzone";
import { getMediaUploadLinkPublic } from "@/lib/cms/media";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export const metadata = {
  title: "Upload file",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const pageStyle = {
  maxWidth: 640,
  margin: "2rem auto",
  padding: "0 1rem",
  fontFamily: "system-ui, sans-serif",
};

export default async function McpUploadPage({ params }) {
  const { token } = await params;
  if (typeof token !== "string" || !token.trim()) {
    return (
      <main style={pageStyle}>
        <h1>Upload a file</h1>
        <p>This upload link is invalid.</p>
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
    <main style={pageStyle}>
      <h1>Upload a file</h1>
      <p>This page accepts one PDF or image for the parish media library. No login is required.</p>
      <McpUploadDropzone token={trimmed} initialInfo={initialInfo} />
    </main>
  );
}

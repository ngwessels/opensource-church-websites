import { IframeEmbedSection } from "./IframeEmbedSection";
import { normalizeHttpsUrl } from "@/lib/embed/urls";

export function FacebookEmbedModule({ module }) {
  const { title, embedUrl, width, height } = module.config || {};
  const src = normalizeHttpsUrl(embedUrl);
  if (!src) return null;

  return (
    <IframeEmbedSection
      title={title}
      src={src}
      height={height || width || 500}
    />
  );
}

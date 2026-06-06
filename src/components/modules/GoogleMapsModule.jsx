import { IframeEmbedSection } from "./IframeEmbedSection";
import { normalizeHttpsUrl } from "@/lib/embed/urls";

export function GoogleMapsModule({ module }) {
  const { title, embedUrl, height } = module.config || {};
  const src = normalizeHttpsUrl(embedUrl);
  if (!src) return null;

  return <IframeEmbedSection title={title} src={src} height={height || 450} />;
}

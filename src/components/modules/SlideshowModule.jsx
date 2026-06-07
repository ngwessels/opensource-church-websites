import { HeroSlideshow } from "@/components/site/HeroSlideshow";
import { resolveDesignTheme } from "@/lib/design/themes";

export function SlideshowModule({ module, siteConfig, editing }) {
  const { structure } = resolveDesignTheme(siteConfig?.design);
  return (
    <HeroSlideshow
      module={module}
      editing={editing}
      captionLayout={structure.heroCaptionVariant}
    />
  );
}

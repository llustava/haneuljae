import type { ComponentType } from "react";
import ARISU from "@/content/ARISU.mdx";
import COUNCIL from "@/content/COUNCIL.mdx";
import JINJUNG from "@/content/JINJUNG.mdx";
import ENPRO from "@/content/ENPRO.mdx";
import ESC from "@/content/ESC.mdx";
import ATOMIX from "@/content/ATOMIX.mdx"
import FAD from "@/content/FAD.mdx";
import HENI from "@/content/HENI.mdx";
import SIKSOON from "@/content/siksoon.mdx";
import STATISTICS from "@/content/STATISTICS.mdx";
import TOPS from "@/content/TOPS.mdx";
import WINGS from "@/content/WINGS.mdx";
import BM from "@/content/BM.mdx";
import POLARIS from "@/content/POLARIS.mdx";
import CALE from "@/content/CALE.mdx";
import studiosData from "@/data/studios.json";



export type StudioMetadata = {
  slug: string;
  name: string;
  tagline: string;
  summary: string;
  category: string;
  accent: string;
  logo: string;
  bannerMessage: string;
};

export type StudioConfig = StudioMetadata & {
  Content: ComponentType;
};

const contentMap: Record<string, ComponentType> = {
  "siksoon": SIKSOON,
  "council": COUNCIL,
  "statistics": STATISTICS,
  "tops": TOPS,
  "esc": ESC,
  "heni": HENI,
  "enpro": ENPRO,
  "atomix": ATOMIX,
  "fad": FAD,
  "arisu": ARISU,
  "wings": WINGS,
  "jinjung": JINJUNG,
  "bm": BM,
  "cale": CALE,
  "polaris": POLARIS
};

export const studioMetadata = studiosData as StudioMetadata[];

export const studios: StudioConfig[] = studioMetadata.map((metadata) => {
  const Content = contentMap[metadata.slug];
  if (!Content) {
    throw new Error(`Missing MDX content for studio slug: ${metadata.slug}`);
  }

  return {
    ...metadata,
    Content,
  };
});

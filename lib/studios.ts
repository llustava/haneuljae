import type { ComponentType } from "react";
import studiosData from "@/data/studios.json";

import AuroraLens from "@/content/aurora-lens/aurora-lens.mdx";
import SolsticeMarket from "@/content/solstice-market/solstice-market.mdx";
import NebulaLab from "@/content/nebula-lab/nebula-lab.mdx";
import TidalForge from "@/content/tidal-forge/tidal-forge.mdx";
import LumenBay from "@/content/lumen-bay/lumen-bay.mdx";
import EmberHarbor from "@/content/ember-harbor/ember-harbor.mdx";
import ZenithOrchard from "@/content/zenith-orchard/zenith-orchard.mdx";
import MonsoonVault from "@/content/monsoon-vault/monsoon-vault.mdx";
import PrismaDrift from "@/content/prisma-drift/prisma-drift.mdx";
import DeltaForum from "@/content/delta-forum/delta-forum.mdx";
import SierraHatch from "@/content/sierra-hatch/sierra-hatch.mdx";
import QuietOrbit from "@/content/quiet-orbit/quiet-orbit.mdx";
import STATISTICS from "@/content/STATISTICS/STATISTICS.mdx";
import SIKSOON from "@/content/siksoon/siksoon.mdx";
import TOPS from "@/content/TOPS/TOPS.mdx";
import ESC from "@/content/ESC/ESC.mdx";


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
  "statistics": STATISTICS,
  "tops": TOPS,
  "esc": ESC,
  "solstice-market": SolsticeMarket,
  "nebula-lab": NebulaLab,
  "tidal-forge": TidalForge,
  "lumen-bay": LumenBay,
  "ember-harbor": EmberHarbor,
  "zenith-orchard": ZenithOrchard,
  "monsoon-vault": MonsoonVault,
  "prisma-drift": PrismaDrift,
  "delta-forum": DeltaForum,
  "sierra-hatch": SierraHatch,
  "quiet-orbit": QuietOrbit,
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

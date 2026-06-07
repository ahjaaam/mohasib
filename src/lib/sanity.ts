import { createClient } from "next-sanity";
import { createImageUrlBuilder } from "@sanity/image-url";

export const sanityProjectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
export const sanityDataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
export const hasSanityConfig = Boolean(sanityProjectId && sanityDataset);

export const client = createClient({
  projectId: sanityProjectId || "mohasib-blog",
  dataset: sanityDataset,
  apiVersion: "2024-01-01",
  useCdn: true,
});

const builder = createImageUrlBuilder(client);

export const urlFor = (source: any) => builder.image(source);

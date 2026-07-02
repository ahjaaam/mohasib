import { defineCliConfig } from "sanity/cli";

export default defineCliConfig({
  api: {
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "jubn8bfk",
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  },
  deployment: {
    appId: "t093kz1abd1b65yser3zwupn",
  },
});

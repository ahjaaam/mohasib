import type { Metadata } from "next";
import MohasibResearchHome from "./MohasibResearchHome";

export const metadata: Metadata = {
  title: "Mohasib — Assistant comptable marocain",
  description: "Des réponses comptables fondées sur des sources marocaines vérifiables.",
};

export default function AssistantPage() {
  return <MohasibResearchHome />;
}

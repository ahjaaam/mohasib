import { redirect } from "next/navigation";
import { FEATURES } from "@/lib/features";
import SaisieClient from "./SaisieClient";

export default function SaisiePage() {
  if (!FEATURES.SAISIE_ENABLED) redirect("/ecritures");
  return <SaisieClient />;
}

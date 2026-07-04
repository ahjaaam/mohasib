import PublicFooter from "@/components/PublicFooter";
import PublicNavbar from "@/components/PublicNavbar";
import { getAllGuides } from "@/lib/guides";
import GuidesClient from "../guides/GuidesClient";

export const revalidate = 60;

export default async function DocumentsPage() {
  const guides = await getAllGuides();

  return (
    <main className="min-h-screen bg-[#FAFAF6]">
      <PublicNavbar />
      <GuidesClient guides={guides} />
      <PublicFooter />
    </main>
  );
}

import Image from "next/image";
import Link from "next/link";
import { Facebook, Instagram, Linkedin } from "lucide-react";
import { whatsappUrl } from "@/lib/public-urls";

const FONT = "var(--font-jakarta), sans-serif";

export default function PublicFooter() {
  return (
    <footer className="border-t border-[#E2E1DB] bg-[#F5F4EF] px-8 pb-9 pt-12 max-sm:px-5 max-sm:pb-7 max-sm:pt-10">
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 32 }}>
          <Image src="/logo2.png" alt="Mohasib" width={112} height={34} style={{ height: "auto", objectFit: "contain", opacity: 0.82 }} />
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <Link href="https://www.linkedin.com/company/mohasibai/" aria-label="LinkedIn" className="ui-circle border border-[#D5D4CE] text-[#777E8B] transition-colors hover:border-[#A89596] hover:text-[#7A6668]" style={{ width: 34, height: 34, borderRadius: 17, display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
              <Linkedin size={16} />
            </Link>
            <Link href="https://www.instagram.com/mohasibai/" aria-label="Instagram" className="ui-circle border border-[#D5D4CE] text-[#777E8B] transition-colors hover:border-[#A89596] hover:text-[#7A6668]" style={{ width: 34, height: 34, borderRadius: 17, display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
              <Instagram size={16} />
            </Link>
            <Link href="https://www.facebook.com/mohasibai" aria-label="Facebook" className="ui-circle border border-[#D5D4CE] text-[#777E8B] transition-colors hover:border-[#A89596] hover:text-[#7A6668]" style={{ width: 34, height: 34, borderRadius: 17, display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
              <Facebook size={16} />
            </Link>
          </div>
        </div>
        <div style={{ height: 1, backgroundColor: "#DEDDD7", marginBottom: 24 }} />
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontSize: 13, color: "#777E8B", fontFamily: FONT }}>© 2026 Mohasib AI</span>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <Link href="/cgu" className="text-[#777E8B] transition-colors hover:text-[#7A6668]" style={{ fontSize: 13, textDecoration: "none", fontFamily: FONT }}>
              CGU
            </Link>
            <Link href="/confidentialite" className="text-[#777E8B] transition-colors hover:text-[#7A6668]" style={{ fontSize: 13, textDecoration: "none", fontFamily: FONT }}>
              Confidentialité
            </Link>
            <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer" className="text-[#777E8B] transition-colors hover:text-[#7A6668]" style={{ fontSize: 13, textDecoration: "none", fontFamily: FONT }}>
              Support
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

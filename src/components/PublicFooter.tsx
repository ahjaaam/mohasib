import Image from "next/image";
import Link from "next/link";
import { Facebook, Instagram, Linkedin } from "lucide-react";

const FONT = "var(--font-jakarta), sans-serif";

export default function PublicFooter() {
  return (
    <footer className="bg-white px-8 pb-9 pt-14 max-sm:px-5 max-sm:pb-7 max-sm:pt-10">
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 32 }}>
          <Image src="/logo2.png" alt="Mohasib" width={100} height={30} style={{ height: "auto", objectFit: "contain", opacity: 0.7 }} />
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <Link href="https://www.linkedin.com/company/mohasibai/" aria-label="LinkedIn" style={{ width: 34, height: 34, borderRadius: 17, border: "1px solid hsla(0, 0%, 24%, 0.12)", color: "hsla(0, 0%, 24%, 0.45)", display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
              <Linkedin size={16} />
            </Link>
            <Link href="https://www.instagram.com/mohasibai/" aria-label="Instagram" style={{ width: 34, height: 34, borderRadius: 17, border: "1px solid hsla(0, 0%, 24%, 0.12)", color: "hsla(0, 0%, 24%, 0.45)", display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
              <Instagram size={16} />
            </Link>
            <Link href="https://www.facebook.com/mohasibai" aria-label="Facebook" style={{ width: 34, height: 34, borderRadius: 17, border: "1px solid hsla(0, 0%, 24%, 0.12)", color: "hsla(0, 0%, 24%, 0.45)", display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
              <Facebook size={16} />
            </Link>
          </div>
        </div>
        <div style={{ height: 1, backgroundColor: "hsla(0, 0%, 78%, 0.40)", marginBottom: 24 }} />
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontSize: 13, color: "hsla(0, 0%, 24%, 0.40)", fontFamily: FONT }}>© 2026 Mohasib AI</span>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <Link href="/cgu" style={{ fontSize: 13, color: "hsla(0, 0%, 24%, 0.40)", textDecoration: "none", fontFamily: FONT }}>
              CGU
            </Link>
            <Link href="/confidentialite" style={{ fontSize: 13, color: "hsla(0, 0%, 24%, 0.40)", textDecoration: "none", fontFamily: FONT }}>
              Confidentialité
            </Link>
            <Link href="https://wa.me/212777884056" style={{ fontSize: 13, color: "hsla(0, 0%, 24%, 0.40)", textDecoration: "none", fontFamily: FONT }}>
              Support
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

import Image from "next/image";
import Link from "next/link";

const FONT = "var(--font-jakarta), sans-serif";

export default function PublicFooter() {
  return (
    <footer className="bg-white px-8 pb-9 pt-14 max-sm:px-5 max-sm:pb-7 max-sm:pt-10">
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 32 }}>
          <Image src="/logo2.png" alt="Mohasib" width={100} height={30} style={{ height: "auto", objectFit: "contain", opacity: 0.7 }} />
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
            <Link href="https://www.linkedin.com/company/mohasibai/" style={{ fontSize: 14, color: "hsla(0, 0%, 24%, 0.40)", textDecoration: "none", fontFamily: FONT }}>
              LinkedIn
            </Link>
            <Link href="https://www.instagram.com/mohasibai/" style={{ fontSize: 14, color: "hsla(0, 0%, 24%, 0.40)", textDecoration: "none", fontFamily: FONT }}>
              Instagram
            </Link>
            <Link href="https://www.facebook.com/mohasibai" style={{ fontSize: 14, color: "hsla(0, 0%, 24%, 0.40)", textDecoration: "none", fontFamily: FONT }}>
              Facebook
            </Link>
          </div>
        </div>
        <div style={{ height: 1, backgroundColor: "hsla(0, 0%, 78%, 0.40)", marginBottom: 24 }} />
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 13, color: "hsla(0, 0%, 24%, 0.40)", fontFamily: FONT }}>© 2026 Mohasib AI</span>
          <span style={{ fontSize: 13, color: "hsla(0, 0%, 24%, 0.40)", fontFamily: FONT }}>contact@mohasibai.com</span>
        </div>
      </div>
    </footer>
  );
}

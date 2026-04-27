import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#F5F5F0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: "var(--font-jakarta), sans-serif",
    }}>
      <div style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 8,
        padding: "40px 36px",
        maxWidth: 420,
        width: "100%",
        boxShadow: "0 2px 16px rgba(0,0,0,0.08)",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>⚠️</div>

        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0D1526", margin: "0 0 10px" }}>
          Erreur de connexion
        </h1>

        <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6, margin: "0 0 28px" }}>
          Votre lien de confirmation a peut-être expiré ou votre navigateur bloque la redirection.
        </p>

        <div style={{
          backgroundColor: "#F9FAFB",
          borderRadius: 6,
          padding: "16px 20px",
          marginBottom: 28,
          textAlign: "left",
        }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 10px" }}>
            Solutions :
          </p>
          <ul style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.8, margin: 0, paddingLeft: 18 }}>
            <li>Ouvrez le lien dans Chrome ou Firefox</li>
            <li>Ou désactivez les Shields Brave pour mohasibai.com</li>
            <li>Ou demandez un nouveau lien de confirmation</li>
          </ul>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link
            href="/auth/signup"
            style={{
              display: "block",
              padding: "12px",
              borderRadius: 5,
              backgroundColor: "#C8924A",
              color: "#FFFFFF",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Renvoyer un email de confirmation →
          </Link>
          <Link
            href="/auth/login"
            style={{
              display: "block",
              padding: "12px",
              borderRadius: 5,
              border: "1px solid rgba(0,0,0,0.1)",
              color: "#0D1526",
              fontSize: 14,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  );
}

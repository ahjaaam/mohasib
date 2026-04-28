"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { translateError } from "@/lib/errors";
import { Turnstile } from "@marsidev/react-turnstile";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const CAPTCHA_THRESHOLD = 3;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const router = useRouter();

  const needsCaptcha = SITE_KEY && failedAttempts >= CAPTCHA_THRESHOLD;
  const captchaBlocking = needsCaptcha && !captchaToken;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (captchaBlocking) return;
    setLoading(true);
    setError(null);

    let res: Response, data: any;
    try {
      res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, captchaToken }),
      });
      data = await res.json();
    } catch {
      setLoading(false);
      setFailedAttempts((n) => n + 1);
      setError(translateError({ code: "NETWORK_ERROR" }));
      return;
    }

    setLoading(false);

    if (!res.ok) {
      setFailedAttempts((n) => n + 1);
      setCaptchaToken(null); // force re-solve on next attempt
      setError(translateError(data));
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#FAFAF6" }}>
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
        style={{ backgroundColor: "#0D1526" }}>
        <div>
          <Image src="/logo.png" alt="Mohasib" width={140} height={42} style={{ objectFit: "contain" }} />
        </div>

        <div>
          <h2 className="text-3xl font-bold text-white leading-tight mb-4">
            La comptabilité intelligente<br />pour les PME marocaines
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Gérez vos factures, suivez vos transactions et obtenez des conseils
            fiscaux personnalisés grâce à l&apos;intelligence artificielle.
          </p>
          <div className="mt-8 space-y-3">
            {["Facturation conforme à la réglementation marocaine",
              "Déclarations TVA automatisées",
              "Assistant IA spécialisé en droit fiscal marocain"].map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-gray-400">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#C8924A" }} />
                {f}
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-gray-600">
          © {new Date().getFullYear()} Mohasib. Tous droits réservés.
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <Image src="/logo.png" alt="Mohasib" width={120} height={36} style={{ objectFit: "contain" }} />
          </div>

          <h1 className="text-2xl font-bold text-navy mb-1">Connexion</h1>
          <p className="text-sm text-gray-500 mb-7"></p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label">Adresse e-mail</label>
              <input
                type="email"
                className="input"
                placeholder="vous@exemple.ma"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Mot de passe</label>
                <Link href="/auth/forgot-password" className="text-xs text-gold hover:underline">
                  Mot de passe oublié ?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  className="input pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            {needsCaptcha && (
              <div>
                <Turnstile
                  siteKey={SITE_KEY}
                  onSuccess={(token) => setCaptchaToken(token)}
                  onExpire={() => setCaptchaToken(null)}
                  onError={() => setCaptchaToken(null)}
                  options={{ theme: "light" }}
                />
                {captchaBlocking && (
                  <p className="text-xs text-amber-600 mt-1.5">
                    Veuillez compléter la vérification ci-dessus.
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !!captchaBlocking}
              className="w-full py-2.5 rounded-lg font-medium text-sm text-white transition-colors disabled:opacity-60"
              style={{ backgroundColor: "#C8924A" }}>
              {loading ? "Connexion en cours..." : "Se connecter"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

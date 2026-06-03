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
      router.push("/tableau-de-bord");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ backgroundColor: "#FAFAF6" }}>
      <div className="w-full max-w-sm">
          <div className="mb-8">
            <Image src="/logo2.png" alt="Mohasib" width={140} height={42} style={{ objectFit: "contain", height: "auto" }} />
          </div>

          <h1 className="text-2xl font-bold text-navy mb-1">Connexion</h1>
          <p className="text-sm text-gray-500 mb-7">
            Pas encore inscrit ?{" "}
            <Link href="/inscription" className="text-gold hover:underline font-medium">
              Créer un compte
            </Link>
          </p>

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
  );
}

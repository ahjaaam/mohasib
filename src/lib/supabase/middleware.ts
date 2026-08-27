import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function hostFromUrl(value: string | undefined, fallback: string) {
  try {
    return new URL(value || fallback).host;
  } catch {
    return new URL(fallback).host;
  }
}

const marketingHost = hostFromUrl(
  process.env.NEXT_PUBLIC_MARKETING_URL || process.env.NEXT_PUBLIC_SITE_URL,
  "https://mohasibai.com",
);
const appHost = hostFromUrl(process.env.NEXT_PUBLIC_APP_URL, "https://app.mohasibai.com");
const invoicingHost = hostFromUrl(
  process.env.NEXT_PUBLIC_INVOICING_URL,
  "https://facturation.mohasibai.com",
);
const bareMarketingHost = marketingHost.replace(/^www\./, "");
const marketingHosts = new Set([marketingHost, bareMarketingHost, `www.${bareMarketingHost}`]);

const marketingRoutes = [
  "/",
  "/tarifs",
  "/solutions",
  "/automatisations",
  "/workflows",
  "/ressources",
  "/centre-aide",
  "/cgu",
  "/confidentialite",
  "/en-attente",
  "/liste-attente",
];

const appPublicRoutes = [
  "/facturation",
  "/connexion",
  "/inscription",
  "/mot-de-passe-oublie",
  "/reinitialiser-mot-de-passe",
  "/auth/callback",
  "/auth/recuperation",
  "/invitations",
];

const sharedPublicRoutes = [
  "/f",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
  "/sw.js",
  "/hors-ligne",
];

function matchesRoute(path: string, routes: string[]) {
  return routes.some((route) => path === route || path.startsWith(`${route}/`));
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const path = request.nextUrl.pathname;
  const host = request.headers.get("host") || "";
  const isInvoicingHost = host === invoicingHost;
  const isAppHost = host === appHost || isInvoicingHost;
  const isMarketingHost = marketingHosts.has(host);
  const isAuthPage = path.startsWith("/auth");
  const isApiRoute = path.startsWith("/api");
  const isMarketingRoute = matchesRoute(path, marketingRoutes);
  const isAppPublicRoute = matchesRoute(path, appPublicRoutes);
  const isSharedPublicRoute = matchesRoute(path, sharedPublicRoutes);
  const isPublic = isMarketingRoute || isAppPublicRoute || isSharedPublicRoute;

  if (isInvoicingHost && (path === "/robots.txt" || path === "/sitemap.xml")) {
    const url = request.nextUrl.clone();
    url.pathname = `/facturation${path}`;
    return NextResponse.rewrite(url);
  }

  // Authentication lives on the main application domain. Sending invoicing
  // visitors there before the login page renders keeps the Supabase session on
  // app.mohasibai.com and guarantees that a successful login opens the app.
  if (isInvoicingHost && (path === "/connexion" || path === "/auth/login")) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.host = appHost;
    url.pathname = "/connexion";
    return NextResponse.redirect(url);
  }

  // Domain-only routing should not pay the Supabase auth round-trip.
  if (isMarketingHost && isAppPublicRoute) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.host = path === "/inscription" && url.searchParams.get("mode") === "invoicing"
      ? invoicingHost
      : appHost;
    return NextResponse.redirect(url);
  }

  if (isMarketingHost && !isApiRoute && !isSharedPublicRoute && !isMarketingRoute) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.host = appHost;
    return NextResponse.redirect(url);
  }

  if (isAppHost && isMarketingRoute && !(isInvoicingHost && path === "/")) {
    if (path === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/connexion";
      return NextResponse.redirect(url);
    }
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.host = marketingHost;
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The founder back office must remain undiscoverable to unauthenticated users.
  if (!user && (path === "/admin" || path.startsWith("/admin/"))) {
    return new NextResponse(null, { status: 404 });
  }

  if (isInvoicingHost && path === "/") {
    const url = request.nextUrl.clone();
    if (user) {
      url.pathname = "/invoices";
      return NextResponse.redirect(url);
    }
    url.pathname = "/facturation/invoices";
    return NextResponse.rewrite(url);
  }

  // Signed-in users who follow a guest navigation URL enter the matching real section.
  if (user && isInvoicingHost && ["/devis", "/avoirs", "/articles"].includes(path)) {
    const url = request.nextUrl.clone();
    if (path === "/articles") {
      url.pathname = "/settings";
      url.searchParams.set("tab", "articles");
    } else {
      url.pathname = "/invoices";
      url.searchParams.set("mode", path.slice(1));
    }
    return NextResponse.redirect(url);
  }

  // Guests can navigate the invoicing application in read-only mode. The
  // requested path remains visible while the internal guest shell is rendered.
  if (!user && isInvoicingHost && !isAuthPage && !isApiRoute && !isPublic) {
    const url = request.nextUrl.clone();
    const intent = path.includes("devis")
      ? "devis"
      : path.includes("avoir")
        ? "avoir"
        : path.startsWith("/clients")
          ? "client"
          : path.startsWith("/articles")
            ? "article"
            : "facture";
    const isCreationPath = path.includes("/new") || path.includes("/nouvelle");
    url.pathname = isCreationPath
      ? `/facturation/create/${intent}`
      : path.startsWith("/clients")
        ? "/facturation/clients"
        : path.startsWith("/devis")
          ? "/facturation/devis"
          : path.startsWith("/avoirs")
            ? "/facturation/avoirs"
            : path.startsWith("/articles")
              ? "/facturation/articles"
              : "/facturation/invoices";
    return NextResponse.rewrite(url);
  }

  // API routes handle their own auth — never redirect them
  if (!user && !isAuthPage && !isApiRoute && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    if (isMarketingHost) url.host = appHost;
    return NextResponse.redirect(url);
  }

  const isAuthCallback = path === "/auth/callback" || path === "/auth/recuperation";
  if (user && ((!isAuthCallback && isAuthPage) || path === "/connexion" || path === "/inscription")) {
    const url = request.nextUrl.clone();
    url.pathname = "/tableau-de-bord";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

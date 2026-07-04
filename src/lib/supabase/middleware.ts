import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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

  const path = request.nextUrl.pathname;
  const publicRoutes = [
    "/",
    "/connexion",
    "/inscription",
    "/mot-de-passe-oublie",
    "/reinitialiser-mot-de-passe",
    "/tarifs",
    "/ressources",
    "/centre-aide",
    "/cgu",
    "/confidentialite",
    "/en-attente",
    "/auth/callback",
    "/invitations",
    "/f",
  ];
  const isAuthPage = path.startsWith("/auth");
  const isApiRoute = path.startsWith("/api");
  const isPublic = publicRoutes.some((route) =>
    path === route || path.startsWith(`${route}/`)
  );

  // The founder back office must remain undiscoverable to unauthenticated users.
  if (!user && (path === "/admin" || path.startsWith("/admin/"))) {
    return new NextResponse(null, { status: 404 });
  }

  // API routes handle their own auth — never redirect them
  if (!user && !isAuthPage && !isApiRoute && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
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

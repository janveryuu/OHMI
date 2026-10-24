import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeReturnPath } from "@/lib/backend/guards.mjs";

export async function proxy(request: NextRequest) {
  const path = new URL(request.url).pathname;
  // Next Image fetches these public illustrations without a session cookie.
  if (/^\/app\/library\/[a-z0-9-]+\.webp$/.test(path)) return NextResponse.next();
  const login = /^\/app\/login\/?$/.test(path);
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let authenticated = false;
  let unavailable = false;
  if (url && key) {
    const client = createServerClient(url, key, {
      cookieOptions: {
        name: "ohmi-web-auth",
        path: "/app/",
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
      },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values) => {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });
    try {
      const result = await client.auth.getUser();
      authenticated = Boolean(result.data.user);
      unavailable = Boolean(result.error && (result.error.status === 0 || (result.error.status ?? 0) >= 500));
    } catch {
      unavailable = true;
    }
  }
  if ((!authenticated && !login) || (authenticated && login)) {
    const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://meetohmi.vercel.app";
    const target = new URL(authenticated ? safeReturnPath(request.nextUrl.searchParams.get("next")) : "/app/login/", origin);
    if (!authenticated) {
      const next = safeReturnPath(path);
      if (next !== "/app/") target.searchParams.set("next", next);
      if (unavailable) target.searchParams.set("auth", "unavailable");
    }
    const redirect = NextResponse.redirect(target);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    response = redirect;
  }
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.append("Vary", "Cookie");
  return response;
}

export const config = {
  matcher: ["/", "/login/:path*", "/ask/:path*", "/assignments/:path*", "/checker/:path*", "/guide/:path*", "/library/:path*", "/progress/:path*", "/settings/:path*", "/playground/:path*"],
};

import type { Database } from "./database.types";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
};
export async function serverClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Account services are not configured.");
  const jar = await cookies();
  return createServerClient<Database>(url, key, {
    cookieOptions: {
      name: "ohmi-web-auth",
      path: "/app/",
      sameSite: "lax",
      secure:
        process.env.NODE_ENV === "production" && !process.env.OHMI_LOCAL_TEST,
    },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) =>
        values.forEach(({ name, value, options }) =>
          jar.set(name, value, options),
        ),
    },
  });
}
export async function authenticatedClient() {
  const client = await serverClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user)
    throw new Error("Sign in to access your private workspace.");
  return { client, user };
}
export function requireSameOrigin(request: Request) {
  const expected =
    process.env.NEXT_PUBLIC_SITE_URL || "https://meetohmi.vercel.app";
  if (request.headers.get("origin") !== expected)
    throw new Error("Request origin is not allowed.");
}
export function privateError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "The request could not be completed.";
  const allowed =
    /^(Sign in|Choose |Invalid record|This file|The PDF|Image |Request origin|Upload |Material |The request)/.test(
      message,
    );
  return Response.json(
    {
      error: allowed
        ? message
        : "The request could not be completed. Try again.",
    },
    {
      status: message.startsWith("Sign in") ? 401 : 400,
      headers: PRIVATE_HEADERS,
    },
  );
}

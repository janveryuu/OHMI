"use client";
import type { Database } from "./database.types";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
let instance: SupabaseClient<Database> | undefined;
export function backendClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return (instance ??= createBrowserClient<Database>(url, key, {
    cookieOptions: {
      name: "ohmi-web-auth",
      path: "/app/",
      sameSite: "lax",
      secure: location.protocol === "https:",
    },
  }));
}

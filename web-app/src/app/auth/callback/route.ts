import { NextResponse } from "next/server";
import { serverClient, PRIVATE_HEADERS } from "@/lib/backend/server";
import { safeReturnPath } from "@/lib/backend/guards.mjs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL || "https://meetohmi.vercel.app";
  const code = url.searchParams.get("code");
  if (code) {
    try {
      const client = await serverClient();
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error)
        return NextResponse.redirect(
          new URL(safeReturnPath(url.searchParams.get("next")), origin),
          { headers: PRIVATE_HEADERS },
        );
    } catch {
      /* Return a safe recovery route without disclosing provider details. */
    }
  }
  return NextResponse.redirect(new URL("/app/settings/?auth=failed", origin), {
    headers: PRIVATE_HEADERS,
  });
}

import {
  authenticatedClient,
  requireSameOrigin,
  PRIVATE_HEADERS,
  privateError,
} from "@/lib/backend/server";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { client, user } = await authenticatedClient();
    const { data, error } = await client.auth.getSession();
    if (error || data.session?.user.id !== user.id)
      throw new Error("Sign in to save your guide.");
    const response = await fetch(
      process.env.NEXT_PUBLIC_SUPABASE_URL + "/functions/v1/ohmi-web/guide",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        },
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      },
    );
    const result = await response.json();
    if (!response.ok || !result.analysisId)
      throw new Error("The request could not save your guide. Try again.");
    return Response.json(result, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return privateError(error);
  }
}

import { authenticatedClient, PRIVATE_HEADERS, privateError, requireSameOrigin } from "@/lib/backend/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { client } = await authenticatedClient();
    const { data, error } = await client.rpc("ohmi_claim_onboarding");
    if (error) throw error;
    return Response.json({ invite: data === true }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return privateError(error);
  }
}

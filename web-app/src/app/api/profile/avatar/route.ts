import {
  authenticatedClient,
  requireSameOrigin,
  PRIVATE_HEADERS,
  privateError,
} from "@/lib/backend/server";
import { readBoundedBody, validateAvatarId } from "@/lib/backend/guards.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { client, user } = await authenticatedClient();
    const body = await readBoundedBody(request, 1024);
    let payload: { avatar?: unknown };
    try {
      payload = JSON.parse(new TextDecoder().decode(body));
    } catch {
      throw new Error("Choose a valid OHMI mascot avatar.");
    }

    const avatarId = validateAvatarId(payload.avatar);

    const result = await client
      .from("ohmi_profiles")
      .update({ avatar: avatarId })
      .eq("id", user.id)
      .select("id, avatar")
      .single();

    if (result.error) {
      throw new Error("Profile could not be saved.");
    }

    // Also update auth user metadata for consistent OAuth session state
    try {
      await client.auth.updateUser({
        data: { avatar: avatarId },
      });
    } catch {
      // Non-fatal if metadata sync is restricted; database is source of truth
    }

    return Response.json(
      {
        success: true,
        avatar: avatarId,
      },
      { headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    return privateError(error);
  }
}

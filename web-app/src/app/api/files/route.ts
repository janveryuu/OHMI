import {
  authenticatedClient,
  requireSameOrigin,
  PRIVATE_HEADERS,
  privateError,
} from "@/lib/backend/server";
import {
  validateUploadMetadata,
  readBoundedBody,
  requireUuid,
} from "@/lib/backend/guards.mjs";
import { inspectMedia } from "@/lib/backend/media";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { client, user } = await authenticatedClient();
    const body = await readBoundedBody(request, 2048);
    const input = JSON.parse(new TextDecoder().decode(body));
    if (input.action === "prepare") {
      const metadata = validateUploadMetadata(input.file || {});
      const id = crypto.randomUUID(),
        path = `${user.id}/${id}/assignment.${metadata.extension}`;
      const inserted = await client
        .from("ohmi_assignments")
        .insert({
          id,
          user_id: user.id,
          original_name: metadata.name,
          object_path: path,
          mime_type: metadata.type,
          size_bytes: metadata.size,
        });
      if (inserted.error)
        throw new Error("Upload could not be started. Try again.");
      return Response.json({ id, path }, { headers: PRIVATE_HEADERS });
    }
    if (input.action !== "finalize")
      throw new Error("Upload action is not supported.");
    const id = requireUuid(input.id);
    const record = await client
      .from("ohmi_assignments")
      .select("object_path,mime_type,size_bytes")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (record.error || !record.data) throw new Error("Material not found.");
    const stored = await client.storage
      .from("ohmi-assignments")
      .download(record.data.object_path);
    if (stored.error || !stored.data)
      throw new Error(
        "Upload did not finish. Remove the pending material and retry.",
      );
    const bytes = new Uint8Array(await stored.data.arrayBuffer());
    if (bytes.length !== record.data.size_bytes)
      throw new Error("This file does not match its declared size.");
    await inspectMedia(bytes, record.data.mime_type);
    const ready = await client
      .from("ohmi_assignments")
      .update({ status: "ready" })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .single();
    if (ready.error || !ready.data)
      throw new Error(
        "Upload was stored but could not be finalized. Refresh your library before retrying.",
      );
    return Response.json({ id }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return privateError(error);
  }
}

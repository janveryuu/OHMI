import {
  authenticatedClient,
  requireSameOrigin,
  PRIVATE_HEADERS,
  privateError,
} from "@/lib/backend/server";
import { requireUuid } from "@/lib/backend/guards.mjs";
import { inspectMedia } from "@/lib/backend/media";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
async function owned(context: Context) {
  const id = requireUuid((await context.params).id);
  const { client, user } = await authenticatedClient();
  const result = await client
    .from("ohmi_assignments")
    .select("id,object_path,original_name,mime_type,size_bytes,status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (result.error || !result.data) return null;
  return { client, user, file: result.data };
}
export async function GET(request: Request, context: Context) {
  try {
    const record = await owned(context);
    if (!record || record.file.status !== "ready")
      return Response.json(
        { error: "Material not found or upload is pending." },
        { status: 404, headers: PRIVATE_HEADERS },
      );
    const { client, file } = record;
    if (file.size_bytes > 10 * 1024 * 1024)
      throw new Error("This file exceeds the supported size.");
    const result = await client.storage
      .from("ohmi-assignments")
      .download(file.object_path);
    if (result.error || !result.data)
      throw new Error("Material could not be downloaded. Try again.");
    const bytes = new Uint8Array(await result.data.arrayBuffer());
    if (bytes.length !== file.size_bytes)
      throw new Error("This file does not match its stored metadata.");
    const media = await inspectMedia(bytes, file.mime_type);
    const disposition =
      new URL(request.url).searchParams.get("download") === "1"
        ? "attachment"
        : "inline";
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      }),
      {
        headers: {
          ...PRIVATE_HEADERS,
          "Content-Type": media.type,
          "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(file.original_name).replace(/'/g, "%27")}`,
          "Content-Security-Policy": "sandbox; default-src 'none'",
        },
      },
    );
  } catch (error) {
    return privateError(error);
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    requireSameOrigin(request);
    const record = await owned(context);
    if (!record)
      return Response.json(
        { error: "Material not found." },
        { status: 404, headers: PRIVATE_HEADERS },
      );
    const { client, user, file } = record;
    const removed = await client.storage
      .from("ohmi-assignments")
      .remove([file.object_path]);
    if (removed.error)
      throw new Error("Material could not be deleted. Try again.");
    const deleted = await client
      .from("ohmi_assignments")
      .delete()
      .eq("id", file.id)
      .eq("user_id", user.id)
      .select("id")
      .single();
    if (deleted.error || !deleted.data)
      throw new Error(
        "Material file was removed, but its record remains. Refresh and retry deletion.",
      );
    return new Response(null, { status: 204, headers: PRIVATE_HEADERS });
  } catch (error) {
    return privateError(error);
  }
}

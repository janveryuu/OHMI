import {
  authenticatedClient,
  PRIVATE_HEADERS,
  privateError,
  requireSameOrigin,
} from "@/lib/backend/server";
import { readBoundedBody, requireUuid } from "@/lib/backend/guards.mjs";
import {
  ELECTRONICS_ENGINE,
  validateElectronicsDocument,
} from "@/lib/playground/electronics-document";
import { convertLegacyProject } from "@/lib/playground/legacy-conversion";
import type { Json } from "@/lib/backend/database.types";
export const dynamic = "force-dynamic";
const conflict = () =>
  Response.json(
    {
      error:
        "The request conflicts with a newer save. Reopen the saved project, or save a separate copy.",
    },
    { status: 409, headers: PRIVATE_HEADERS },
  );
const unavailable = (error: { code?: string } | null) =>
  error?.code === "42P01" || error?.code === "PGRST205";
const notReady = () =>
  Response.json(
    {
      error:
        "Private electronics saving is not enabled on this server yet. Download your .dez circuit to keep it.",
    },
    { status: 503, headers: PRIVATE_HEADERS },
  );
async function account(request: Request) {
  const result = await authenticatedClient();
  if (request.headers.get("x-ohmi-account") !== result.user.id)
    throw new Error(
      "The request belongs to another account. Reload the workspace before continuing.",
    );
  return result;
}
export async function GET(request: Request) {
  try {
    const { client, user } = await account(request),
      url = new URL(request.url),
      id = url.searchParams.get("id");
    const legacy = url.searchParams.get("legacy") === "1";
    if (legacy && id)
      throw new Error("The request must import legacy projects as new copies.");
    if (id) {
      requireUuid(id);
      const { data, error } = await client
        .from("ohmi_electronics_projects")
        .select(
          "id,name,document,engine_commit,revision,source_legacy_id,source_legacy_revision,legacy_snapshot,updated_at",
        )
        .eq("user_id", user.id)
        .eq("id", id)
        .maybeSingle();
      if (unavailable(error)) return notReady();
      if (error) throw error;
      if (!data)
        return Response.json(
          { error: "The request could not find this project." },
          { status: 404, headers: PRIVATE_HEADERS },
        );
      if (data.engine_commit !== ELECTRONICS_ENGINE)
        throw new Error(
          "The request requires a different electronics engine. Export the original circuit before upgrading.",
        );
      return Response.json(
        { ...data, document: validateElectronicsDocument(data.document) },
        { headers: PRIVATE_HEADERS },
      );
    }
    const before = url.searchParams.get("before");
    let query = client
      .from(legacy ? "ohmi_playground_projects" : "ohmi_electronics_projects")
      .select("id,name,revision,updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(51);
    if (before) {
      const [time, id] = before.split("|");
      requireUuid(id);
      if (!/^\d{4}-\d\d-\d\dT[\d:.+-]+Z?$/.test(time))
        throw new Error("The request contains an invalid cursor.");
      query = query.or(
        `updated_at.lt.${time},and(updated_at.eq.${time},id.lt.${id})`,
      );
    }
    const { data, error } = await query;
    if (unavailable(error)) return notReady();
    if (error) throw error;
    return Response.json(
      { projects: data.slice(0, 50), hasMore: data.length > 50 },
      { headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    return privateError(error);
  }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { client, user } = await account(request);
    const body = JSON.parse(
      new TextDecoder().decode(await readBoundedBody(request, 1048576 + 4096)),
    );
    requireUuid(body.id);
    if (
      !Number.isSafeInteger(body.revision) ||
      body.revision < 0 ||
      body.revision > 2147483646
    )
      throw new Error("The request contains an invalid revision.");
    let source:
      | {
          source_legacy_id: string;
          source_legacy_revision: number;
          legacy_snapshot: Json;
        }
      | undefined;
    let document;
    if (body.legacyId !== undefined) {
      if (body.revision !== 0 || body.document !== undefined)
        throw new Error(
          "The request must import a legacy project as a new copy.",
        );
      requireUuid(body.legacyId);
      const { data, error } = await client
        .from("ohmi_playground_projects")
        .select("id,project,revision")
        .eq("user_id", user.id)
        .eq("id", body.legacyId)
        .maybeSingle();
      if (error) throw error;
      if (!data)
        return Response.json(
          { error: "The request could not find this legacy project." },
          { status: 404, headers: PRIVATE_HEADERS },
        );
      if (data.revision !== body.legacyRevision) return conflict();
      document = convertLegacyProject(data.project).document;
      source = {
        source_legacy_id: data.id,
        source_legacy_revision: data.revision,
        legacy_snapshot: data.project,
      };
    } else document = validateElectronicsDocument(body.document);
    const values = {
      name: document.title,
      document: document as unknown as Json,
      engine_commit: ELECTRONICS_ENGINE,
      revision: body.revision + 1,
    };
    if (body.revision === 0) {
      const { data, error } = await client
        .from("ohmi_electronics_projects")
        .insert({ ...values, ...source, id: body.id, user_id: user.id })
        .select("id,revision,updated_at")
        .single();
      if (unavailable(error)) return notReady();
      if (error?.code === "23505" || error?.code === "40001") return conflict();
      if (error?.code === "23514")
        throw new Error(
          "The request exceeds electronics storage limits. Download .dez or simplify the project.",
        );
      if (error) throw error;
      return Response.json(data, { headers: PRIVATE_HEADERS });
    }
    const { data, error } = await client
      .from("ohmi_electronics_projects")
      .update(values)
      .eq("user_id", user.id)
      .eq("id", body.id)
      .eq("revision", body.revision)
      .select("id,revision,updated_at")
      .maybeSingle();
    if (unavailable(error)) return notReady();
    if (error?.code === "40001") return conflict();
    if (error?.code === "23514")
      throw new Error(
        "The request exceeds electronics storage limits. Download .dez or simplify the project.",
      );
    if (error) throw error;
    if (!data) return conflict();
    return Response.json(data, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return privateError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    requireSameOrigin(request);
    const { client, user } = await account(request),
      url = new URL(request.url),
      id = requireUuid(url.searchParams.get("id")),
      revision = Number(url.searchParams.get("revision"));
    if (
      !Number.isSafeInteger(revision) ||
      revision < 1 ||
      revision > 2147483647
    )
      throw new Error("The request contains an invalid revision.");
    const { data, error } = await client
      .from("ohmi_electronics_projects")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("revision", revision)
      .select("id")
      .maybeSingle();
    if (unavailable(error)) return notReady();
    if (error) throw error;
    if (!data) return conflict();
    return Response.json({ ok: true }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return privateError(error);
  }
}

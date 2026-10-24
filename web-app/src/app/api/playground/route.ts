import {
  authenticatedClient,
  PRIVATE_HEADERS,
  privateError,
  requireSameOrigin,
} from "@/lib/backend/server";
import { readBoundedBody, requireUuid } from "@/lib/backend/guards.mjs";
import { validateProject } from "@/lib/playground/model";
import type { Json } from "@/lib/backend/database.types";
export const dynamic = "force-dynamic";
const conflict = () =>
  Response.json(
    {
      error:
        "The request conflicts with a newer save. Reopen the saved project before editing, or save a separate copy.",
    },
    { status: 409, headers: PRIVATE_HEADERS },
  );
export async function GET(request: Request) {
  try {
    const { client, user } = await authenticatedClient();
    const url = new URL(request.url),
      id = url.searchParams.get("id");
    if (id) {
      requireUuid(id);
      const { data, error } = await client
        .from("ohmi_playground_projects")
        .select("id,name,project,revision,updated_at")
        .eq("user_id", user.id)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data)
        return Response.json(
          { error: "The request could not find this project." },
          { status: 404, headers: PRIVATE_HEADERS },
        );
      return Response.json(
        { ...data, project: validateProject(data.project) },
        { headers: PRIVATE_HEADERS },
      );
    }
    const cursor = url.searchParams.get("before");
    let query = client
      .from("ohmi_playground_projects")
      .select("id,name,revision,updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(51);
    if (cursor) {
      const [time, afterId] = cursor.split("|");
      requireUuid(afterId);
      if (!/^\d{4}-\d\d-\d\dT[\d:.+-]+Z?$/.test(time))
        throw new Error("The request contains an invalid cursor.");
      query = query.or(
        `updated_at.lt.${time},and(updated_at.eq.${time},id.lt.${afterId})`,
      );
    }
    const { data, error } = await query;
    if (error) throw error;
    return Response.json(
      { projects: data.slice(0, 50), hasMore: data.length > 50 },
      { headers: PRIVATE_HEADERS },
    );
  } catch (e) {
    return privateError(e);
  }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { client, user } = await authenticatedClient();
    const bytes = await readBoundedBody(request, 65536);
    const body = JSON.parse(new TextDecoder().decode(bytes));
    requireUuid(body.id);
    if (
      !Number.isSafeInteger(body.revision) ||
      body.revision < 0 ||
      body.revision > 2147483646
    )
      throw new Error("The request contains an invalid revision.");
    const project = validateProject(body.project),
      values = {
        name: project.name,
        project: project as unknown as Json,
        revision: body.revision + 1,
        updated_at: new Date().toISOString(),
      };
    if (body.revision === 0) {
      const { data, error } = await client
        .from("ohmi_playground_projects")
        .insert({ ...values, id: body.id, user_id: user.id })
        .select("id,revision,updated_at")
        .single();
      if (error?.code === "23505") return conflict();
      if (error) throw error;
      return Response.json(data, { headers: PRIVATE_HEADERS });
    }
    const { data, error } = await client
      .from("ohmi_playground_projects")
      .update(values)
      .eq("user_id", user.id)
      .eq("id", body.id)
      .eq("revision", body.revision)
      .select("id,revision,updated_at")
      .maybeSingle();
    if (error) throw error;
    if (!data) return conflict();
    return Response.json(data, { headers: PRIVATE_HEADERS });
  } catch (e) {
    return privateError(e);
  }
}
export async function DELETE(request: Request) {
  try {
    requireSameOrigin(request);
    const { client, user } = await authenticatedClient();
    const url = new URL(request.url),
      id = requireUuid(url.searchParams.get("id")),
      revision = Number(url.searchParams.get("revision"));
    if (!Number.isSafeInteger(revision) || revision < 1)
      throw new Error("The request contains an invalid revision.");
    const { data, error } = await client
      .from("ohmi_playground_projects")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("revision", revision)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return conflict();
    return Response.json({ ok: true }, { headers: PRIVATE_HEADERS });
  } catch (e) {
    return privateError(e);
  }
}

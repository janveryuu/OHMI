import {
  authenticatedClient,
  requireSameOrigin,
  PRIVATE_HEADERS,
  privateError,
} from "@/lib/backend/server";
import { readBoundedBody, requireUuid } from "@/lib/backend/guards.mjs";
import { validateCircuitBuildResult } from "@/lib/playground/circuit-spec";
export const dynamic = "force-dynamic";
export const maxDuration = 35;
async function account(request: Request) {
  const value = await authenticatedClient();
  if (request.headers.get("x-ohmi-account") !== value.user.id)
    throw new Error(
      "The request belongs to another account. Reload your workspace.",
    );
  return value;
}
export async function GET(request: Request) {
  try {
    const { client, user } = await account(request);
    const id = new URL(request.url).searchParams.get("id");
    if (!id)
      return Response.json(
        {
          enabled:
            process.env.OHMI_WEB_AI_ENABLED === "true" &&
            process.env.OHMI_CIRCUIT_BUILD_ENABLED === "true",
        },
        { headers: PRIVATE_HEADERS },
      );
    requireUuid(id);
    const { data, error } = await client
      .from("ohmi_ai_requests")
      .select("id,operation,status,result_payload,created_at")
      .eq("user_id", user.id)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data || data.operation !== "circuit_build")
      return Response.json(
        { error: "Build request unavailable." },
        { status: 404, headers: PRIVATE_HEADERS },
      );
    const status =
      data.status === "pending" &&
      Date.parse(data.created_at) < Date.now() - 60000
        ? "expired"
        : data.status;
    return Response.json(
      {
        accountId: user.id,
        requestId: id,
        status,
        ...(status === "completed"
          ? { result: validateCircuitBuildResult(data.result_payload) }
          : {}),
      },
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
    if (
      process.env.OHMI_WEB_AI_ENABLED !== "true" ||
      process.env.OHMI_CIRCUIT_BUILD_ENABLED !== "true"
    )
      return Response.json(
        { error: "Circuit building is not enabled. No AI request was sent." },
        { status: 503, headers: PRIVATE_HEADERS },
      );
    const body = JSON.parse(
      new TextDecoder().decode(await readBoundedBody(request, 16384)),
    );
    const keys = ["requestId", "conversationId", "language", "message"];
    if (
      !body ||
      Object.keys(body).length !== 4 ||
      Object.keys(body).some((key) => !keys.includes(key)) ||
      typeof body.message !== "string" ||
      !body.message.trim() ||
      body.message.length > 3000 ||
      !["english", "filipino", "taglish"].includes(body.language)
    )
      throw new Error("The request contains invalid build fields.");
    requireUuid(body.requestId);
    requireUuid(body.conversationId);
    const session = await client.auth.getSession();
    if (session.error || session.data.session?.user.id !== user.id)
      throw new Error("Sign in again before building.");
    const response = await fetch(
      process.env.NEXT_PUBLIC_SUPABASE_URL + "/functions/v1/ohmi-web",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.data.session.access_token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...body,
          version: 1,
          operation: "circuit_build",
          accountId: user.id,
        }),
        cache: "no-store",
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(28000)]),
      },
    );
    const result = JSON.parse(
      new TextDecoder().decode(
        await readBoundedBody(
          new Request("https://internal.invalid", {
            method: "POST",
            body: response.body,
            duplex: "half",
          } as RequestInit),
          131072,
        ),
      ),
    );
    if (!response.ok || !result.ok) {
      const headers = new Headers(PRIVATE_HEADERS),
        retry = response.headers.get("retry-after");
      if (retry && /^\d{1,5}$/.test(retry)) headers.set("Retry-After", retry);
      return Response.json(
        {
          error:
            typeof result.error === "string"
              ? result.error
              : result.error?.message ||
                "Build failed. Check this request before retrying.",
        },
        { status: response.status >= 400 ? response.status : 502, headers },
      );
    }
    if (result.accountId !== user.id || result.requestId !== body.requestId)
      throw new Error("The request returned a mismatched account or ID.");
    return Response.json(
      { ...result, result: validateCircuitBuildResult(result.result) },
      { headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    return privateError(error);
  }
}

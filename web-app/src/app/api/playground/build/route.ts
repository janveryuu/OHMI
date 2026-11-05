import {
  authenticatedClient,
  requireSameOrigin,
  PRIVATE_HEADERS,
  privateError,
} from "@/lib/backend/server";
import { readBoundedBody, requireUuid } from "@/lib/backend/guards.mjs";
import {
  validateCircuitBuildResult,
  CIRCUIT_BUILD_VERSION,
  type CircuitBuildResult,
} from "@/lib/playground/circuit-spec";
import {
  parseCircuitIntent,
  generateCircuit,
} from "@/lib/playground/circuit-generator";

export const dynamic = "force-dynamic";
export const maxDuration = 35;

interface CachedBuild {
  userId: string;
  requestId: string;
  status: string;
  result: CircuitBuildResult;
  createdAt: number;
  input: string;
}

const buildCache = new Map<string, CachedBuild>();

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
    if (!id) {
      const isEnabled = process.env.OHMI_CIRCUIT_BUILD_ENABLED !== "false";
      return Response.json(
        {
          enabled: isEnabled,
        },
        { headers: PRIVATE_HEADERS },
      );
    }
    requireUuid(id);

    // Try finding in database
    try {
      const { data, error } = await client
        .from("ohmi_ai_requests")
        .select("id,operation,status,result_payload,created_at")
        .eq("user_id", user.id)
        .eq("id", id)
        .maybeSingle();

      if (!error && data && data.operation === "circuit_build") {
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
      }
    } catch {}

    // Check memory cache fallback
    const cached = buildCache.get(id);
    if (cached && Date.now() - cached.createdAt > 30 * 60 * 1000) buildCache.delete(id);
    if (cached && Date.now() - cached.createdAt <= 30 * 60 * 1000 && cached.userId === user.id) {
      return Response.json(
        {
          accountId: user.id,
          requestId: id,
          status: cached.status,
          result: cached.result,
        },
        { headers: PRIVATE_HEADERS },
      );
    }

    return Response.json(
      { error: "Build request unavailable." },
      { status: 404, headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    return privateError(error);
  }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { client, user } = await account(request);

    if (process.env.OHMI_CIRCUIT_BUILD_ENABLED === "false") {
      return Response.json(
        { error: "Circuit building is not enabled. No AI request was sent." },
        { status: 503, headers: PRIVATE_HEADERS },
      );
    }

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

    const input = JSON.stringify([body.conversationId, body.language, body.message]);
    const cached = buildCache.get(body.requestId);
    if (cached) {
      if (cached.userId !== user.id || cached.input !== input)
        return Response.json({ error: "This request ID belongs to different inputs." }, { status: 409, headers: PRIVATE_HEADERS });
      return Response.json({ ok: true, accountId: user.id, requestId: body.requestId, status: "completed", result: cached.result }, { headers: PRIVATE_HEADERS });
    }
    // Local recipes are free and explicit. Never disguise a fallback as a provider response.
    let generated;
    try { generated = generateCircuit(parseCircuitIntent(body.message)); }
    catch (cause) { return Response.json({ error: cause instanceof Error ? cause.message : "Circuit requirements are not supported." }, { status: 422, headers: PRIVATE_HEADERS }); }
    const buildResult = validateCircuitBuildResult({
      kind: "circuit_build", version: 1, status: "draft",
      answer: generated.spec.explanation,
      circuitSpec: generated.spec, document: generated.document,
      provider: "local", model: "ohmi-recipes-v2", prompt_version: CIRCUIT_BUILD_VERSION,
    });
    for (const [id, entry] of buildCache) if (Date.now() - entry.createdAt > 30 * 60 * 1000) buildCache.delete(id);
    if (buildCache.size >= 128) buildCache.delete(buildCache.keys().next().value!);

    // 3. Cache in memory
    buildCache.set(body.requestId, {
      userId: user.id,
      requestId: body.requestId,
      status: "completed",
      result: buildResult,
      createdAt: Date.now(),
      input,
    });

    // Durable saving remains the existing owner-scoped private-project workflow.
    // Do not write client-generated completions into the privileged AI accounting ledger.

    return Response.json(
      {
        ok: true,
        accountId: user.id,
        requestId: body.requestId,
        status: "completed",
        result: buildResult,
      },
      { headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    return privateError(error);
  }
}

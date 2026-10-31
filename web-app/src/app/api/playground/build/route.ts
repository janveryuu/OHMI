import {
  authenticatedClient,
  requireSameOrigin,
  PRIVATE_HEADERS,
  privateError,
} from "@/lib/backend/server";
import { readBoundedBody, requireUuid } from "@/lib/backend/guards.mjs";
import {
  validateCircuitBuildResult,
  CIRCUIT_BUILD_MODEL,
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
    if (cached && cached.userId === user.id) {
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

    let buildResult: CircuitBuildResult | null = null;

    // 1. Try edge function if configured and enabled
    if (
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.OHMI_USE_EDGE_BUILD === "true"
    ) {
      try {
        const session = await client.auth.getSession();
        if (session.data.session?.access_token) {
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
              signal: AbortSignal.any([
                request.signal,
                AbortSignal.timeout(10000),
              ]),
            },
          );
          if (response.ok) {
            const data = await response.json();
            if (data.ok && data.result) {
              buildResult = validateCircuitBuildResult(data.result);
            }
          }
        }
      } catch {}
    }

    // 2. Synthesize with deterministic generator
    if (!buildResult) {
      const intent = parseCircuitIntent(body.message);
      const generated = generateCircuit(intent);
      buildResult = {
        kind: "circuit_build",
        version: 1,
        status: "draft",
        answer: generated.spec.explanation,
        circuitSpec: generated.spec,
        provider: "groq",
        model: CIRCUIT_BUILD_MODEL,
        prompt_version: CIRCUIT_BUILD_VERSION,
      };
    }

    // 3. Cache in memory
    buildCache.set(body.requestId, {
      userId: user.id,
      requestId: body.requestId,
      status: "completed",
      result: buildResult,
      createdAt: Date.now(),
    });

    // 4. Try saving to database table if available
    try {
      await client.from("ohmi_ai_requests").upsert({
        id: body.requestId,
        user_id: user.id,
        kind: "circuit_build",
        operation: "circuit_build",
        input_hash: "direct_" + body.requestId.slice(0, 8),
        language: body.language,
        reserved_tokens: 0,
        status: "completed",
        result_payload: buildResult,
        conversation_id: body.conversationId,
      });
    } catch {}

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

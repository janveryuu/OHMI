import {
  authenticatedClient,
  requireSameOrigin,
  PRIVATE_HEADERS,
  privateError,
} from "@/lib/backend/server";
import {
  edgeFailure,
  readBoundedBody,
  requireUuid,
} from "@/lib/backend/guards.mjs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET() {
  const webAiEnabled = process.env.OHMI_WEB_AI_ENABLED === "true";
  const groqChatEnabled =
    process.env.OHMI_GROQ_CHAT_ENABLED !== "false" &&
    Boolean(process.env.GROQ_API_KEY);
  const geminiMultimodalEnabled =
    process.env.OHMI_GEMINI_MULTIMODAL_ENABLED !== "false" &&
    Boolean(process.env.GEMINI_API_KEY);

  return Response.json(
    {
      enabled: webAiEnabled,
      routes: {
        chat: webAiEnabled && groqChatEnabled,
        circuit_check: webAiEnabled && geminiMultimodalEnabled,
        multimodal: webAiEnabled && geminiMultimodalEnabled,
      },
    },
    { headers: PRIVATE_HEADERS },
  );
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { client, user } = await authenticatedClient();
    if (process.env.OHMI_WEB_AI_ENABLED !== "true")
      return Response.json(
        {
          error:
            "AI tutoring is paused until free-only provider access is verified. Your saved materials and conversations remain available.",
        },
        { status: 503, headers: PRIVATE_HEADERS },
      );
    const bytes = await readBoundedBody(request, 6 * 1024 * 1024);
    let body;
    try {
      body = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new Error("The request must contain valid JSON.");
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error("The request is not valid.");
    requireUuid(body.requestId);
    const allowed = new Set([
      "version",
      "requestId",
      "operation",
      "language",
      "message",
      "code",
      "calculation",
      "assignmentId",
      "circuitAnalysisId",
      "conversationId",
      "historyThroughPosition",
      "mode",
      "images",
      "simulation",
      "board",
      "requirementText",
      "assignmentAnalysisId",
      "previousCheckId",
      "followUpQuestion",
    ]);
    if (Object.keys(body).some((key) => !allowed.has(key)))
      throw new Error("The request contains unsupported fields.");
    const session = await client.auth.getSession();
    if (session.error || session.data.session?.user.id !== user.id)
      throw new Error("Sign in again before asking OHMI.");
    const response = await fetch(
      process.env.NEXT_PUBLIC_SUPABASE_URL + "/functions/v1/ohmi-web",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.data.session.access_token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(40_000)]),
        cache: "no-store",
      },
    );
    const resultBytes = await readBoundedBody(
      new Request("https://internal.invalid", {
        method: "POST",
        body: response.body,
        duplex: "half",
      } as RequestInit),
      128 * 1024,
    );
    let result;
    try {
      result = JSON.parse(new TextDecoder().decode(resultBytes));
    } catch {
      throw new Error(
        "The request returned an unreadable response. Refresh history before retrying.",
      );
    }
    if (!response.ok || !result.ok) {
      const failure = edgeFailure(result);
      const headers = new Headers(PRIVATE_HEADERS);
      const retryHeader = response.headers.get("retry-after");
      if (retryHeader) {
        headers.set("Retry-After", retryHeader);
      }
      return Response.json(failure, {
        status: response.status >= 400 ? response.status : 502,
        headers,
      });
    }
    if (result.accountId !== user.id || result.requestId !== body.requestId)
      throw new Error(
        "The request returned a mismatched account or request. Refresh your workspace.",
      );
    return Response.json(result, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return privateError(error);
  }
}

import { callGroqChatCompletions } from "./groq.ts";
import { consumeChatBurst } from "./copilot.ts";
import {
  CIRCUIT_BUILD_MODEL,
  CIRCUIT_BUILD_VERSION,
  circuitSpecSchema,
  circuitPlannerInstruction,
  validateCircuitSpec,
  validateCircuitBuildResult,
  type CircuitSpec,
  type CircuitBuildResult,
} from "../../../web-app/src/lib/playground/circuit-spec.ts";

type Ledger = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{
    data: Record<string, unknown> | null;
    error: { message?: string } | null;
  }>;
};
export class CircuitBuildError extends Error {
  code: string;
  status: number;
  retryAfterSeconds?: number;
  constructor(
    code: string,
    message: string,
    status = 400,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
export const CIRCUIT_BUILD_ENV = [
  "OHMI_CIRCUIT_BUILD_ENABLED",
  "OHMI_CIRCUIT_BUILD_FREE_TIER_VERIFIED",
  "GROQ_FREE_TIER_CONFIRMED",
  "OHMI_GROQ_CHAT_ENABLED",
  "GROQ_API_KEY",
] as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function error(
  code: string,
  message: string,
  status = 400,
  retry?: number,
): never {
  throw new CircuitBuildError(code, message, status, retry);
}
export function validateBuildResult(value: unknown): CircuitBuildResult {
  try {
    return validateCircuitBuildResult(value);
  } catch {
    return error(
      "result_unavailable",
      "The saved build result is incompatible. No new generation was started.",
      410,
    );
  }
}
export async function planCircuitBuild(options: {
  body: unknown;
  userId: string;
  ledger: Ledger;
  env: Record<string, string | undefined>;
  signal?: AbortSignal;
  fetch?: typeof fetch;
  deadline?: number;
}) {
  const body = options.body as Record<string, unknown>;
  const allowed = [
    "version",
    "operation",
    "requestId",
    "conversationId",
    "language",
    "message",
    "accountId",
  ];
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== allowed.length ||
    Object.keys(body).some((key) => !allowed.includes(key)) ||
    body.version !== 1 ||
    body.operation !== "circuit_build" ||
    body.accountId !== options.userId ||
    typeof body.requestId !== "string" ||
    !uuid.test(body.requestId) ||
    typeof body.conversationId !== "string" ||
    !uuid.test(body.conversationId) ||
    typeof body.language !== "string" ||
    !["english", "filipino", "taglish"].includes(body.language) ||
    typeof body.message !== "string" ||
    !body.message.trim() ||
    body.message.length > 3000
  )
    error("invalid_request", "Invalid circuit-build request or account.", 400);
  const env = options.env;
  if (options.signal?.aborted)
    error("cancelled", "Circuit request was cancelled before planning.", 499);
  if (
    env.OHMI_CIRCUIT_BUILD_ENABLED !== "true" ||
    env.OHMI_CIRCUIT_BUILD_FREE_TIER_VERIFIED !== "true" ||
    env.GROQ_FREE_TIER_CONFIRMED !== "true" ||
    env.OHMI_GROQ_CHAT_ENABLED === "false" ||
    !env.GROQ_API_KEY
  )
    error(
      "unavailable",
      "Automatic circuit planning is not enabled or its free-tier gate is unverified. No AI request was sent.",
      503,
    );
  const bytes = new TextEncoder().encode(
    JSON.stringify({
      version: 1,
      operation: "circuit_build",
      requestId: body.requestId,
      conversationId: body.conversationId,
      language: body.language,
      message: body.message,
      accountId: options.userId,
      promptVersion: CIRCUIT_BUILD_VERSION,
      model: CIRCUIT_BUILD_MODEL,
    }),
  );
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  const reserve = await options.ledger.rpc("ohmi_reserve_circuit_build", {
    p_user_id: options.userId,
    p_request_id: body.requestId,
    p_conversation_id: body.conversationId,
    p_hash: hash,
    p_language: body.language,
  });
  if (reserve.error) {
    const mismatch = /replay|match/i.test(reserve.error.message || "");
    error(
      mismatch ? "idempotency_conflict" : "reservation_failed",
      mismatch
        ? "This request ID belongs to different inputs. Keep your draft and start a new explicit build."
        : "Circuit request could not be reserved for this account.",
      mismatch ? 409 : 400,
    );
  }
  const job = reserve.data;
  if (!job || job.operation !== "circuit_build")
    error(
      "unavailable",
      "Circuit-build admission is unavailable. No generation was started.",
      503,
    );
  if (job.fresh !== true) {
    if (job.status === "completed")
      return {
        ok: true,
        requestId: body.requestId,
        accountId: options.userId,
        result: validateBuildResult(job.result_payload),
      };
    if (job.status === "pending")
      error(
        "in_progress",
        "This build is still processing. Check its status before retrying.",
        429,
        10,
      );
    error(
      "failed",
      "This build previously failed. Keep its request ID for recovery; a new explicit build needs a new request ID.",
      409,
    );
  }
  let inputTokens = 0,
    outputTokens = 0,
    totalTokens = 0;
  try {
    if (!consumeChatBurst("circuit-build:" + options.userId))
      error(
        "rate_limit",
        "Please wait a minute before another build.",
        429,
        60,
      );
    const response = await callGroqChatCompletions({
      apiKey: env.GROQ_API_KEY!,
      model: CIRCUIT_BUILD_MODEL,
      systemInstruction:
        circuitPlannerInstruction +
        " Reply explanations in " +
        body.language +
        ".",
      messages: [{ role: "user", content: body.message as string }],
      maxTokens: 3072,
      timeoutMs: Math.max(
        1,
        Math.min(
          20000,
          (options.deadline ?? Date.now() + 25000) - Date.now() - 2000,
        ),
      ),
      reasoningEffort: "low",
      jsonSchema: circuitSpecSchema,
      signal: options.signal,
      fetchFn: options.fetch,
    });
    if (!response.ok)
      error(
        response.code,
        "Circuit planning did not finish. " +
          (response.code === "rate_limit"
            ? "Wait before retrying."
            : "Check this request before starting another build."),
        response.status,
        response.retryAfterSeconds,
      );
    if (
      ![
        response.promptTokens,
        response.completionTokens,
        response.totalTokens,
      ].every(
        (value) =>
          Number.isSafeInteger(value) && value >= 0 && value <= 1000000,
      )
    )
      error(
        "invalid_result",
        "Planner returned invalid usage accounting.",
        502,
      );
    inputTokens = response.promptTokens;
    outputTokens = response.completionTokens;
    totalTokens = response.totalTokens;
    if (
      response.model !== CIRCUIT_BUILD_MODEL ||
      response.content.includes(env.GROQ_API_KEY!)
    )
      error(
        "invalid_result",
        "Planner returned invalid provenance or sensitive content.",
        502,
      );
    let spec: CircuitSpec;
    try {
      spec = validateCircuitSpec(JSON.parse(response.content));
    } catch (cause) {
      error(
        "invalid_result",
        cause instanceof Error
          ? cause.message
          : "Planner returned malformed circuit JSON.",
        502,
      );
    }
    const result: CircuitBuildResult = {
      kind: "circuit_build",
      version: 1,
      status: spec.status,
      answer: spec.explanation,
      circuitSpec: spec,
      provider: "groq",
      model: CIRCUIT_BUILD_MODEL,
      prompt_version: CIRCUIT_BUILD_VERSION,
    };
    const completed = await options.ledger.rpc("ohmi_complete_ai", {
      p_request_id: body.requestId,
      p_output: { ...result, message: body.message },
      p_input_tokens: inputTokens,
      p_output_tokens: outputTokens,
      p_accounted_tokens: totalTokens,
      p_model: CIRCUIT_BUILD_MODEL,
    });
    if (completed.error)
      error(
        "recovery_required",
        "Build completion acknowledgement was unavailable. Check this request before retrying.",
        503,
      );
    return {
      ok: true,
      requestId: body.requestId,
      accountId: options.userId,
      result,
    };
  } catch (cause) {
    const failure =
      cause instanceof CircuitBuildError
        ? cause
        : new CircuitBuildError(
            "unavailable",
            "Circuit planning failed. Check this request before retrying.",
            503,
          );
    await options.ledger.rpc("ohmi_fail_ai", {
      p_request_id: body.requestId,
      p_error_code: failure.code,
      p_input_tokens: inputTokens,
      p_output_tokens: outputTokens,
      p_accounted_tokens: totalTokens,
      p_model: CIRCUIT_BUILD_MODEL,
    });
    throw failure;
  }
}

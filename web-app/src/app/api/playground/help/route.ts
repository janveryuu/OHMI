import { POST as ask } from "@/app/api/ai/route";
import { requireSameOrigin, privateError } from "@/lib/backend/server";
import { readBoundedBody, requireUuid } from "@/lib/backend/guards.mjs";
import { helpMessage } from "@/lib/playground/context";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const bytes = await readBoundedBody(request, 65536);
    const body = JSON.parse(new TextDecoder().decode(bytes));
    requireUuid(body.requestId);
    requireUuid(body.conversationId);
    if (
      typeof body.question !== "string" ||
      !["english", "filipino", "taglish"].includes(body.language)
    )
      throw new Error("The request contains invalid help options.");
    const payload = {
      version: 1,
      operation: "chat",
      requestId: body.requestId,
      conversationId: body.conversationId,
      historyThroughPosition: 0,
      language: body.language,
      message: helpMessage(body.project, body.question),
    };
    return ask(
      new Request(request.url, {
        method: "POST",
        headers: {
          origin: request.headers.get("origin")!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: request.signal,
      }),
    );
  } catch (e) {
    return privateError(e);
  }
}

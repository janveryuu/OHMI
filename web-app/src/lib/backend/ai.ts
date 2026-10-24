import { isTerminalAiCode } from "./guards.mjs";
export async function askBackend(
  payload: Record<string, unknown>,
  signal?: AbortSignal,
) {
  const response = await fetch("/app/api/ai/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  const data = await response.json().catch(() => ({
    error:
      "OHMI returned an unreadable response. Refresh your history before retrying.",
  }));
  if (!response.ok)
    throw Object.assign(
      new Error(
        typeof data.error === "string"
          ? data.error
          : "OHMI could not complete the request.",
      ),
      { terminal: isTerminalAiCode(data.code) },
    );
  if (!data.ok || !data.result)
    throw new Error(
      "OHMI did not confirm a saved result. Refresh your history before retrying.",
    );
  return data;
}

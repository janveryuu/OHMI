export function accountEpoch() {
  let generation = 0;
  return {
    capture: () => generation,
    current: (value) => value === generation,
    advance: () => ++generation,
  };
}
export function safeReturnPath(value) {
  return [
    "/app/",
    "/app/ask/",
    "/app/playground/",
    "/app/library/",
    "/app/assignments/",
    "/app/checker/",
    "/app/guide/",
    "/app/progress/",
    "/app/settings/",
  ].includes(value)
    ? value
    : "/app/";
}
export function requireUuid(value) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new Error("Invalid record identifier.");
  return value;
}
/** @param {{name:string,type:string,size:number}} file */
export function validateUploadMetadata(file) {
  if (!file.name || file.name.length > 180 || /[\\/\x00-\x1f]/.test(file.name))
    throw new Error(
      "Choose a file with a plain filename up to 180 characters.",
    );
  if (
    !Number.isSafeInteger(file.size) ||
    file.size < 1 ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error("Choose a nonempty file up to 10 MB.");
  const extension = file.name.split(".").pop()?.toLowerCase();
  const types = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
  };
  if (!extension || types[extension] !== file.type)
    throw new Error(
      "Choose a PDF, PNG or JPEG with a matching file extension.",
    );
  return { extension, type: file.type, size: file.size, name: file.name };
}

/** @param {Request} request @param {number} limit */
export async function readBoundedBody(request, limit) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("The request has no body.");
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > limit) {
      await reader.cancel();
      throw new Error("The request exceeds the supported size.");
    }
    chunks.push(value);
  }
  const output = new Uint8Array(length);
  let position = 0;
  for (const chunk of chunks) {
    output.set(chunk, position);
    position += chunk.length;
  }
  return output;
}

export function selectActiveConversation(current, conversations) {
  return conversations.some((c) => c.id === current)
    ? current
    : conversations[0]?.id || "";
}
export function isTerminalAiCode(code) {
  return [
    "failed",
    "unavailable",
    "provider_error",
    "timeout",
    "invalid_request",
    "payload_too_large",
    "rate_limit",
    "rate_limited",
    "auth_error",
  ].includes(code);
}
export function completeSketchMarkdown(payload) {
  return typeof payload.code === "string" && payload.code.trim()
    ? "```cpp\n" + payload.code + "\n```"
    : "";
}

export function edgeFailure(result) {
  return {
    error:
      typeof result.error === "string"
        ? result.error
        : typeof result.error?.message === "string"
          ? result.error.message
          : "OHMI could not complete this request. Try again after checking your history.",
    code: typeof result.code === "string" ? result.code : result.error?.code,
  };
}

export function guideNeedsDetails(value) {
  return (
    value.status !== "tutorial" ||
    !Array.isArray(value.steps) ||
    value.steps.length === 0
  );
}

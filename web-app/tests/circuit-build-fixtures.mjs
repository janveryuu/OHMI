import { readFile } from "node:fs/promises";
export async function buildFixture(name = "uno-blink") {
  const doc = JSON.parse(
    await readFile(
      new URL(
        "../../docs/playground-upgrade/evidence/" + name + ".dez",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const ids = new Map(doc.parts.map((part) => [part.id, "part" + part.id]));
  const parts = doc.parts.map((part) => ({
    id: ids.get(part.id),
    type: part.type,
    properties:
      part.type === "resistor"
        ? [
            {
              key: "resistance",
              value: String(parseFloat(part.props.resistance)),
            },
          ]
        : part.type === "led"
          ? [{ key: "color", value: part.props.color || "Red" }]
          : [],
    sketch: part.code || "",
  }));
  const connections = doc.wires
    .filter((w) => w.view === "schematic")
    .map((w) => ({
      from: { part: ids.get(w.from.part), pin: w.from.pin },
      to: { part: ids.get(w.to.part), pin: w.to.pin },
    }));
  return {
    version: 1,
    status: "draft",
    title: name,
    explanation:
      "Synthetic test circuit. Engine results are checked separately.",
    warnings: [
      "Use the stated series resistor. Simulator results do not verify hardware.",
    ],
    parts,
    connections,
  };
}
export const buildEnv = {
  OHMI_CIRCUIT_BUILD_ENABLED: "true",
  OHMI_CIRCUIT_BUILD_FREE_TIER_VERIFIED: "true",
  GROQ_FREE_TIER_CONFIRMED: "true",
  OHMI_GROQ_CHAT_ENABLED: "true",
  GROQ_API_KEY: "synthetic-test-key",
};
export function mockGroq(
  spec,
  {
    finish = "stop",
    model = "openai/gpt-oss-120b",
    content = JSON.stringify(spec),
  } = {},
) {
  return Response.json({
    model,
    choices: [{ message: { content }, finish_reason: finish }],
    usage: { prompt_tokens: 200, completion_tokens: 300, total_tokens: 500 },
  });
}
export function memoryLedger(jobs = [], messages = []) {
  return {
    async rpc(name, args) {
      if (name === "ohmi_reserve_circuit_build") {
        const old = jobs.find((job) => job.id === args.p_request_id);
        if (old)
          return old.user_id !== args.p_user_id ||
            old.input_hash !== args.p_hash
            ? {
                error: { message: "Request replay does not match" },
                data: null,
              }
            : { data: { ...old, fresh: false }, error: null };
        const job = {
          id: args.p_request_id,
          user_id: args.p_user_id,
          input_hash: args.p_hash,
          conversation_id: args.p_conversation_id,
          status: "pending",
          operation: "circuit_build",
          created_at: new Date().toISOString(),
        };
        jobs.push(job);
        return { data: { ...job, fresh: true }, error: null };
      }
      const job = jobs.find((j) => j.id === args.p_request_id);
      if (!job) return { data: null, error: { message: "Missing" } };
      if (name === "ohmi_complete_ai") {
        job.status = "completed";
        job.result_payload = args.p_output;
        const position =
          Math.max(0, ...messages.map((m) => m.position || 0)) + 1;
        messages.push(
          {
            id: crypto.randomUUID(),
            user_id: job.user_id,
            conversation_id: job.conversation_id,
            role: "user",
            content: args.p_output.message,
            position,
            request_id: job.id,
          },
          {
            id: crypto.randomUUID(),
            user_id: job.user_id,
            conversation_id: job.conversation_id,
            role: "assistant",
            content: args.p_output.answer,
            structured_result: args.p_output,
            position: position + 1,
            request_id: job.id,
          },
        );
      } else if (name === "ohmi_fail_ai" && job.status === "pending") {
        job.status = "failed";
        job.error_code = args.p_error_code;
      }
      return { data: {}, error: null };
    },
  };
}

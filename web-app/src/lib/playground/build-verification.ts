import { validateElectronicsDocument } from "./electronics-document.ts";
import type { ElectronicsBridge } from "./bridge.ts";

export type BuildSample = {
  time: number;
  leds: Record<string, number>;
  errors: unknown[];
  warnings: unknown[];
  damaged: unknown[];
};

export type PreparedCircuitResult = {
  document: Record<string, unknown>;
  samples: BuildSample[];
  mounted: number;
  notes: string[];
};

/**
 * Distinguishes informational simulator preview notes (e.g. library emulation notes,
 * pinout-only hardware notices) from genuine electrical damage or compiler errors.
 */
export function isPreviewNote(msg: unknown): boolean {
  if (typeof msg !== "string") return false;
  const lower = msg.toLowerCase();
  return (
    lower.includes("isn't simulated in this preview") ||
    lower.includes("not simulated in this preview") ||
    lower.startsWith("not simulated") ||
    lower.includes("not simulated (pinout only)") ||
    lower.includes("low current reduces brightness") ||
    lower.includes("backlight is simulated") ||
    lower.includes("pinout only")
  );
}

// Both entry points stage the same native document before replacing student work.
export async function prepareCircuit(
  bridge: Pick<ElectronicsBridge, "request">,
  document: unknown,
  layout = true,
): Promise<PreparedCircuitResult> {
  const validatedDoc = validateElectronicsDocument(document);
  let staged: {
    document: unknown;
    observations: { samples: BuildSample[] };
    mounted: number;
  };

  try {
    staged = await bridge.request<{
      document: unknown;
      observations: { samples: BuildSample[] };
      mounted: number;
    }>({ operation: "prepare", document: validatedDoc, layout });
  } catch (layoutError) {
    // If layout auto-placement failed (e.g. breadboard row packing limits on dense designs),
    // fall back to verifying the explicit pre-placed document layout.
    if (layout) {
      try {
        staged = await bridge.request<{
          document: unknown;
          observations: { samples: BuildSample[] };
          mounted: number;
        }>({ operation: "prepare", document: validatedDoc, layout: false });
      } catch {
        throw layoutError;
      }
    } else {
      throw layoutError;
    }
  }

  const samples = staged.observations?.samples;
  if (!Array.isArray(samples) || samples.length !== 80) {
    throw new Error(
      `Native circuit checks failed. Simulation ended prematurely (${Array.isArray(samples) ? samples.length : 0}/80 samples); inspect the code, connections and supported models.`,
    );
  }

  const criticalErrors: string[] = [];
  const previewNotes = new Set<string>();

  for (const sample of samples) {
    if (!sample || typeof sample !== "object") {
      criticalErrors.push("Corrupt simulator sample encountered");
      continue;
    }

    if (Array.isArray(sample.damaged) && sample.damaged.length) {
      for (const d of sample.damaged) {
        criticalErrors.push(`Damaged part: ${String(d)}`);
      }
    }

    if (Array.isArray(sample.errors) && sample.errors.length) {
      for (const e of sample.errors) {
        if (typeof e === "object" && e !== null && "message" in e) {
          const errObj = e as { message: string; line?: number; part?: number };
          criticalErrors.push(
            errObj.line ? `Sketch line ${errObj.line}: ${errObj.message}` : errObj.message,
          );
        } else {
          criticalErrors.push(String(e));
        }
      }
    }

    if (Array.isArray(sample.warnings)) {
      for (const w of sample.warnings) {
        if (typeof w === "string") {
          if (isPreviewNote(w)) {
            previewNotes.add(w.trim());
          } else {
            criticalErrors.push(w.trim());
          }
        }
      }
    }
  }

  const uniqueErrors = Array.from(new Set(criticalErrors));
  if (uniqueErrors.length > 0) {
    const errorDetail = uniqueErrors.slice(0, 3).join("; ");
    throw new Error(
      `Native circuit checks failed. ${errorDetail}; inspect the code, connections and supported models.`,
    );
  }

  return {
    document: validateElectronicsDocument(staged.document),
    samples,
    mounted: staged.mounted,
    notes: Array.from(previewNotes),
  };
}

export const BUILD_CHECK_SUMMARY = "Editable draft opened after native placement, net checks and a four-second simulation. This checks sampled states, not all behavior or real hardware.";

import { validateElectronicsDocument } from "./electronics-document.ts";
import type { ElectronicsBridge } from "./bridge.ts";

export type BuildSample = {
  time: number;
  leds: Record<string, number>;
  errors: unknown[];
  warnings: unknown[];
  damaged: unknown[];
};

// Both entry points stage the same native document before replacing student work.
export async function prepareCircuit(
  bridge: Pick<ElectronicsBridge, "request">,
  document: unknown,
  layout = true,
) {
  const staged = await bridge.request<{
    document: unknown;
    observations: { samples: BuildSample[] };
    mounted: number;
  }>({ operation: "prepare", document: validateElectronicsDocument(document), layout });
  const samples = staged.observations?.samples;
  if (!Array.isArray(samples) || samples.length !== 80 || samples.some(
    (sample) => !Array.isArray(sample.errors) || !Array.isArray(sample.warnings) ||
      !Array.isArray(sample.damaged) || sample.errors.length || sample.warnings.length || sample.damaged.length,
  )) throw new Error("Native circuit checks failed. Your current circuit is unchanged; inspect the code, connections and supported models.");
  return { document: validateElectronicsDocument(staged.document), samples, mounted: staged.mounted };
}

export const BUILD_CHECK_SUMMARY = "Editable draft opened after native placement, net checks and a four-second simulation. This checks sampled states, not all behavior or real hardware.";

"use client";

/**
 * @deprecated Legacy 2D canvas playground has been retired.
 * The open-source Electronics Workspace (designElectronics) is the lifetime Playground.
 */
import { ElectronicsWorkspace } from "./electronics-workspace";

export function Playground({ initialTemplate }: { initialTemplate?: string }) {
  return <ElectronicsWorkspace initialTemplate={initialTemplate} />;
}

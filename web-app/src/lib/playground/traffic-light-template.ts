import template from "./traffic-light-template.json" with { type: "json" };
import { validateElectronicsDocument } from "./electronics-document.ts";

export function getTrafficLightElectronicsDocument(): Record<string, unknown> {
  const cloned = structuredClone(template as Record<string, unknown>);
  return validateElectronicsDocument(cloned);
}

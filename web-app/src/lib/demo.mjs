/** Validate local previews. This is not a server upload or a content-security boundary. */
export function validateFile(file) {
  if (!file.size)
    return "This file is empty. Choose a PDF or image with content.";
  if (file.size > 10 * 1024 * 1024) return "Choose a file smaller than 10 MB.";
  const extensions = {
    "application/pdf": /\.pdf$/i,
    "image/png": /\.png$/i,
    "image/jpeg": /\.jpe?g$/i,
  };
  if (!extensions[file.type]) return "Choose a PDF, PNG or JPEG file.";
  if (!extensions[file.type].test(file.name))
    return "The file extension does not match its type.";
  return null;
}
export function cropRect(width, height, percent) {
  const ratio = Math.max(0.25, Math.min(1, percent / 100));
  const w = Math.round(width * ratio),
    h = Math.round(height * ratio);
  return {
    x: Math.round((width - w) / 2),
    y: Math.round((height - h) / 2),
    width: w,
    height: h,
  };
}
export function lessonProgress(steps) {
  return steps.length
    ? Math.round((steps.filter(Boolean).length / steps.length) * 100)
    : 0;
}

export function resolveGuideLabel(guide, fallback = "Assignment Guide") {
  if (!guide) return fallback;
  if (typeof guide.title === "string" && guide.title.trim().length > 0) {
    return guide.title.trim();
  }
  if (
    guide.payload &&
    typeof guide.payload === "object" &&
    "title" in guide.payload
  ) {
    const raw = guide.payload.title;
    if (typeof raw === "string" && raw.trim().length > 0) {
      return raw.trim();
    }
  }
  return fallback;
}

export function resolveStepTitle(step, index = 0) {
  const stepNum = typeof step?.step === "number" ? step.step : index + 1;
  const rawTitle = typeof step?.title === "string" ? step.title.trim() : "";
  const rawInstruction =
    typeof step?.instruction === "string" ? step.instruction.trim() : "";
  if (rawTitle) return rawTitle;
  if (rawInstruction) return rawInstruction;
  return `Step ${stepNum}`;
}

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

import sharp from "sharp";
import { getDocumentProxy } from "unpdf";
export async function inspectMedia(bytes: Uint8Array, declaredType: string) {
  if (!bytes.length || bytes.length > 10 * 1024 * 1024)
    throw new Error("Choose a nonempty file up to 10 MB.");
  if (declaredType === "application/pdf") {
    if (Buffer.from(bytes.subarray(0, 5)).toString() !== "%PDF-")
      throw new Error("The PDF is not readable.");
    let document;
    try {
      document = await getDocumentProxy(new Uint8Array(bytes), {
        verbosity: 0,
      });
      if (!document.numPages || document.numPages > 100) throw new Error();
      return { type: "application/pdf", pages: document.numPages };
    } catch {
      throw new Error("The PDF is corrupt, protected, or exceeds 100 pages.");
    } finally {
      if (document) await document.loadingTask.destroy();
    }
  }
  try {
    const image = sharp(bytes, {
      limitInputPixels: 20_000_000,
      failOn: "error",
    });
    const metadata = await image.metadata();
    const type =
      metadata.format === "png"
        ? "image/png"
        : metadata.format === "jpeg"
          ? "image/jpeg"
          : "";
    if (
      !type ||
      type !== declaredType ||
      !metadata.width ||
      !metadata.height ||
      (metadata.pages ?? 1) > 1
    )
      throw new Error();
    await image.stats();
    return { type, width: metadata.width, height: metadata.height };
  } catch {
    throw new Error(
      "This file is not a readable PNG or JPEG up to 20 megapixels.",
    );
  }
}

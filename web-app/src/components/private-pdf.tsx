"use client";
import { useEffect, useRef, useState } from "react";
import type { LocalFile } from "./app-provider";
import { Button } from "./ui/button";
type Pdf = Awaited<ReturnType<(typeof import("unpdf"))["getDocumentProxy"]>>;
export function PrivatePdf({ file }: { file: LocalFile }) {
  const [pdf, setPdf] = useState<Pdf | null>(null),
    [page, setPage] = useState(1),
    [image, setImage] = useState(""),
    [text, setText] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true);
  const generation = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true,
      document: Pdf | null = null;
    void (async () => {
      try {
        const response = await fetch(file.url, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error();
        const bytes = new Uint8Array(await response.arrayBuffer());
        const { getDocumentProxy } = await import("unpdf");
        document = await getDocumentProxy(bytes, {
          useSystemFonts: true,
          verbosity: 0,
        });
        if (active) setPdf(document);
        else await document.loadingTask.destroy();
      } catch {
        if (active) {
          setError(
            "PDF preview could not be opened. Download the original to view it.",
          );
          setBusy(false);
        }
      }
    })();
    return () => {
      active = false;
      generation.current++;
      controller.abort();
      void document?.loadingTask.destroy();
    };
  }, [file.url]);
  useEffect(() => {
    if (!pdf) return;
    const current = ++generation.current;
    setBusy(true);
    setError("");
    setImage("");
    setText("");
    void (async () => {
      try {
        const item = await pdf.getPage(page),
          viewport = item.getViewport({ scale: 1 });
        const width =
          viewport.width *
          Math.min(1.5, 900 / viewport.width, 1800 / viewport.height);
        const { renderPageAsImage } = await import("unpdf");
        const data = await renderPageAsImage(pdf, page, {
          width,
          toDataURL: true,
        });
        const content = await item.getTextContent();
        if (current !== generation.current) return;
        setImage(data);
        setText(
          content.items
            .flatMap((item) => ("str" in item ? [item.str] : []))
            .join(" "),
        );
      } catch {
        if (current === generation.current)
          setError(
            "This page could not be rendered. Download the original to view it.",
          );
      } finally {
        if (current === generation.current) setBusy(false);
      }
    })();
    return () => {
      generation.current++;
    };
  }, [pdf, page]);
  return (
    <div className="stack-sm">
      {busy && <p role="status">Rendering private PDF…</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {image && (
        <div className="pdf-preview" style={{ overflow: "auto" }}>
          <img
            src={image}
            alt={`Page ${page} of ${file.name}`}
            style={{ width: "100%", height: "auto" }}
          />
        </div>
      )}
      {pdf && (
        <div className="between">
          <Button
            variant="outline"
            disabled={busy || page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous page
          </Button>
          <span>
            Page {page} of {pdf.numPages}
          </span>
          <Button
            variant="outline"
            disabled={busy || page === pdf.numPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next page
          </Button>
        </div>
      )}
      {text && (
        <details>
          <summary>Page text</summary>
          <p>{text}</p>
        </details>
      )}
    </div>
  );
}

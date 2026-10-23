"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  FileText,
  FolderOpen,
  ImageIcon,
  Plus,
  Search,
  Trash2,
  UploadCloud,
  ArrowUpRight,
} from "lucide-react";
import { useApp, type LocalFile } from "./app-provider";
import { validateFile } from "@/lib/demo.mjs";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";

export function Assignments() {
  const app = useApp(),
    input = useRef<HTMLInputElement>(null),
    [error, setError] = useState(""),
    [drag, setDrag] = useState(false),
    [filter, setFilter] = useState("All materials"),
    [query, setQuery] = useState(""),
    [preview, setPreview] = useState<LocalFile | null>(null),
    [remove, setRemove] = useState<LocalFile | null>(null);
  function add(files: FileList | null) {
    if (!files) return;
    const valid: LocalFile[] = [];
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      const issue = validateFile(file);
      if (issue) {
        errors.push(`${file.name}: ${issue}`);
        continue;
      }
      valid.push({
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type,
        size: file.size,
        url: URL.createObjectURL(file),
      });
    }
    app.setFiles((prev) => [...valid, ...prev]);
    setError(errors.join(" "));
    if (valid.length)
      app.toast(
        `${valid.length} file${valid.length > 1 ? "s" : ""} added locally. Nothing uploaded.`,
      );
  }
  const visible = app.files.filter(
    (f) =>
      (filter === "All materials" ||
        (filter === "PDFs"
          ? f.type === "application/pdf"
          : f.type.startsWith("image/"))) &&
      f.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="stack">
      <div className="page-heading between">
        <div>
          <h1>Your next bright idea.</h1>
          <p>Bring your assignments. Keep your learning in one place.</p>
        </div>
        <Button onClick={() => input.current?.click()}>
          <Plus size={17} />
          Add material
        </Button>
      </div>
      <div
        className="upload-zone"
        data-drag={drag}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          add(e.dataTransfer.files);
        }}
      >
        <div className="upload-illustration">
          <UploadCloud size={30} strokeWidth={1.4} />
        </div>
        <h2>A place for your building blocks.</h2>
        <p>Drop an assignment here, or choose a file to get started.</p>
        <Button variant="outline" onClick={() => input.current?.click()}>
          Choose files
          <Plus size={16} />
        </Button>
        <span className="small muted">
          PDF, PNG or JPEG up to 10 MB each. Local previews only.
        </span>
        <input
          ref={input}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          multiple
          hidden
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="library-toolbar between">
        <div className="segmented" aria-label="Filter materials">
          {["All materials", "PDFs", "Images"].map((value) => (
            <Button
              key={value}
              variant="ghost"
              aria-pressed={filter === value}
              className={filter === value ? "selected" : ""}
              onClick={() => setFilter(value)}
            >
              {value}
            </Button>
          ))}
        </div>
        <label className="search-field">
          <Search size={17} />
          <span className="sr-only">Search materials</span>
          <input
            name="materials-search"
            autoComplete="off"
            placeholder="Search materials…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      {visible.length ? (
        <div className="file-grid">
          {visible.map((file) => (
            <article className="file-card panel" key={file.id}>
              <button
                className="file-preview"
                onClick={() => setPreview(file)}
                aria-label={`Preview ${file.name}`}
              >
                {file.type.startsWith("image/") ? (
                  <img src={file.url} alt={file.name} />
                ) : (
                  <FileText size={56} strokeWidth={1.2} />
                )}
                <span className="badge">Local file</span>
              </button>
              <div className="between">
                <div className="file-info">
                  <h3>{file.name}</h3>
                  <p className="small muted">
                    {file.type === "application/pdf" ? "PDF document" : "Image"}{" "}
                    · {(file.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => setRemove(file)}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
              <Button variant="outline" onClick={() => setPreview(file)}>
                Open preview
                <ArrowUpRight size={15} />
              </Button>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel empty">
          <FolderOpen size={35} strokeWidth={1.3} />
          <h3>
            {query || filter !== "All materials"
              ? "No matching materials"
              : "Your library has room to grow."}
          </h3>
          <p>
            {query || filter !== "All materials"
              ? "Try a different search or filter."
              : "Add your first assignment above. You can preview it here without sending it anywhere."}
          </p>
        </div>
      )}
      <Link href="/guide" className="learning-callout">
        <span className="icon-tile">
          <ImageIcon size={23} />
        </span>
        <div>
          <h3>Nothing to bring yet?</h3>
          <p className="muted">
            Try building your first LED circuit with OHMI.
          </p>
        </div>
        <ArrowUpRight size={20} />
      </Link>
      <Dialog
        open={!!preview}
        onOpenChange={(open) => !open && setPreview(null)}
      >
        <DialogContent className="preview-dialog">
          <DialogTitle>{preview?.name}</DialogTitle>
          <DialogDescription>
            Local preview. This file is not uploaded or analyzed.
          </DialogDescription>
          {preview?.type.startsWith("image/") ? (
            <img
              className="large-preview"
              src={preview.url}
              alt={preview.name}
            />
          ) : (
            preview && (
              <>
                <iframe
                  className="pdf-preview"
                  src={preview.url}
                  title={`PDF preview: ${preview.name}`}
                />
                <a
                  href={preview.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-link"
                >
                  Open PDF preview in new tab
                  <ArrowUpRight size={15} />
                </a>
                <p className="small muted">
                  If your browser cannot embed PDFs, use the link above.
                </p>
              </>
            )
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!remove} onOpenChange={(open) => !open && setRemove(null)}>
        <DialogContent>
          <DialogTitle>Remove this local material?</DialogTitle>
          <DialogDescription>
            The original file stays on your device. Only this session’s preview
            is removed.
          </DialogDescription>
          <p className="file-name">{remove?.name}</p>
          <div className="row">
            <Button variant="outline" onClick={() => setRemove(null)}>
              Keep material
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (remove) {
                  URL.revokeObjectURL(remove.url);
                  app.setFiles((prev) =>
                    prev.filter((f) => f.id !== remove.id),
                  );
                }
                setRemove(null);
              }}
            >
              Remove material
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

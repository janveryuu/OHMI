"use client";
import { useEffect, useRef, useState } from "react";
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
import { PrivatePdf } from "./private-pdf";
import { useApp, type LocalFile } from "./app-provider";
import { validateFile } from "@/lib/demo.mjs";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { UploadProgress, type UploadStage } from "./ui/upload-progress";

interface ActiveUpload {
  id: string;
  file: File;
  stage: UploadStage;
  error?: string;
  previewUrl?: string;
  controller: AbortController;
}

export function Assignments() {
  const app = useApp(),
    input = useRef<HTMLInputElement>(null),
    [error, setError] = useState(""),
    [drag, setDrag] = useState(false),
    [filter, setFilter] = useState("All materials"),
    [query, setQuery] = useState(""),
    [preview, setPreview] = useState<LocalFile | null>(null),
    [remove, setRemove] = useState<LocalFile | null>(null),
    [removing, setRemoving] = useState(false),
    [uploads, setUploads] = useState<ActiveUpload[]>([]);
  const owner = useRef(app.user?.id);
  owner.current = app.user?.id;

  useEffect(() => {
    uploads.forEach((u) => {
      u.controller.abort();
      if (u.previewUrl) URL.revokeObjectURL(u.previewUrl);
    });
    setUploads([]);
    setPreview(null);
    setRemove(null);
    setError("");
    setQuery("");
  }, [app.user?.id]);

  function cancelUpload(id: string) {
    setUploads((prev) => {
      const target = prev.find((u) => u.id === id);
      target?.controller.abort();
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((u) => u.id !== id);
    });
  }

  function dismissUpload(id: string) {
    setUploads((prev) => {
      const target = prev.find((u) => u.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((u) => u.id !== id);
    });
  }

  function retryUpload(id: string) {
    const item = uploads.find((u) => u.id === id);
    if (!item) return;
    const account = owner.current;
    if (!account) return;
    const newController = new AbortController();
    setUploads((prev) =>
      prev.map((u) =>
        u.id === id
          ? { ...u, stage: "preparing", error: undefined, controller: newController }
          : u,
      ),
    );
    void (async () => {
      try {
        await app.uploadFile(item.file, {
          onStage: (stage) => {
            if (owner.current !== account) return;
            setUploads((prev) =>
              prev.map((u) => (u.id === id ? { ...u, stage } : u)),
            );
          },
          signal: newController.signal,
        });
        if (owner.current !== account) return;
        setUploads((prev) =>
          prev.map((u) => (u.id === id ? { ...u, stage: "complete" } : u)),
        );
        app.toast(`${item.file.name} uploaded to your private library.`);
      } catch (cause) {
        if (owner.current !== account) return;
        const msg =
          cause instanceof Error ? cause.message : "Upload did not finish.";
        setUploads((prev) =>
          prev.map((u) =>
            u.id === id ? { ...u, stage: "error", error: msg } : u,
          ),
        );
      }
    })();
  }

  async function add(files: FileList | null) {
    if (!files || files.length === 0) return;
    const account = owner.current;
    if (!account) return;
    setError("");

    for (const file of Array.from(files)) {
      if (owner.current !== account) break;
      const problem = validateFile(file);
      const id = crypto.randomUUID();
      const controller = new AbortController();
      const previewUrl = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : undefined;

      if (problem) {
        setUploads((prev) => [
          ...prev,
          { id, file, stage: "error", error: problem, previewUrl, controller },
        ]);
        continue;
      }

      const item: ActiveUpload = {
        id,
        file,
        stage: "preparing",
        previewUrl,
        controller,
      };

      setUploads((prev) => [...prev, item]);

      void (async () => {
        try {
          await app.uploadFile(file, {
            onStage: (stage) => {
              if (owner.current !== account) return;
              setUploads((prev) =>
                prev.map((u) => (u.id === id ? { ...u, stage } : u)),
              );
            },
            signal: controller.signal,
          });
          if (owner.current !== account) return;
          setUploads((prev) =>
            prev.map((u) => (u.id === id ? { ...u, stage: "complete" } : u)),
          );
          app.toast(`${file.name} uploaded to your private library.`);
        } catch (cause) {
          if (owner.current !== account) return;
          const msg =
            cause instanceof Error ? cause.message : "Upload did not finish.";
          setUploads((prev) =>
            prev.map((u) =>
              u.id === id ? { ...u, stage: "error", error: msg } : u,
            ),
          );
        }
      })();
    }
  }

  const busy =
    removing ||
    uploads.some((u) => u.stage !== "complete" && u.stage !== "error");
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
        <Button
          disabled={busy || !app.user}
          onClick={() => input.current?.click()}
        >
          <Plus size={17} />
          {busy ? "Uploading…" : "Add material"}
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
        <Button
          disabled={busy || !app.user}
          variant="outline"
          onClick={() => input.current?.click()}
        >
          Choose files
          <Plus size={16} />
        </Button>
        <span className="small muted">
          PDF, PNG or JPEG up to 10 MB. Sign in to store files privately.
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
      {uploads.length > 0 && (
        <div
          className="uploads-list flex flex-col gap-3 my-2"
          role="region"
          aria-label="Upload progress"
        >
          {uploads.map((item) => (
            <UploadProgress
              key={item.id}
              fileName={item.file.name}
              fileSize={item.file.size}
              fileType={item.file.type}
              stage={item.stage}
              error={item.error}
              previewUrl={item.previewUrl}
              onCancel={() => cancelUpload(item.id)}
              onRetry={() => retryUpload(item.id)}
              onDismiss={() => dismissUpload(item.id)}
            />
          ))}
        </div>
      )}
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
                onClick={() =>
                  file.status === "ready"
                    ? setPreview(file)
                    : setError(
                        "Upload is pending. Remove this material and retry uploading.",
                      )
                }
                aria-label={`Preview ${file.name}`}
              >
                {file.type.startsWith("image/") ? (
                  <img src={file.url} alt={file.name} />
                ) : (
                  <FileText size={56} strokeWidth={1.2} />
                )}
                <span className="badge">
                  {file.status === "ready" ? "Private file" : "Pending upload"}
                </span>
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
              <Button
                variant="outline"
                onClick={() =>
                  file.status === "ready"
                    ? setPreview(file)
                    : setError(
                        "Upload is pending. Remove this material and retry uploading.",
                      )
                }
              >
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
              : "Sign in and add your first assignment. Files are stored privately in your account."}
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
            Private preview. This opens your stored file; AI analysis is a
            separate action.
          </DialogDescription>
          {preview && (
            <a className="text-link" href={preview.url + "?download=1"}>
              Download original
            </a>
          )}
          {preview?.type.startsWith("image/") ? (
            <img
              className="large-preview"
              src={preview.url}
              alt={preview.name}
            />
          ) : (
            preview && (
              <>
                <PrivatePdf key={preview.id} file={preview} />
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
                  Page previews render on this device. Download preserves the original PDF.
                </p>
              </>
            )
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!remove} onOpenChange={(open) => !open && setRemove(null)}>
        <DialogContent>
          <DialogTitle>Delete this private material?</DialogTitle>
          <DialogDescription>
            This deletes the stored file and its linked analyses. The original
            on your device stays unchanged.
          </DialogDescription>
          <p className="file-name">{remove?.name}</p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="row">
            <Button variant="outline" onClick={() => setRemove(null)}>
              Keep material
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                if (!remove) return;
                const account = owner.current;
                setRemoving(true);
                setError("");
                try {
                  await app.removeFile(remove.id);
                  if (owner.current !== account) return;
                  setRemove(null);
                  app.toast("Private material deleted.");
                } catch (cause) {
                  if (owner.current === account)
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "Deletion failed.",
                    );
                } finally {
                  setRemoving(false);
                }
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

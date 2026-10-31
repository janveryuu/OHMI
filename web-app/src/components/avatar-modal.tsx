"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Check, User, X } from "lucide-react";
import { AVATARS, type AvatarId, getAvatar } from "@/lib/avatars";
import { useApp } from "./app-provider";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";

interface AvatarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AvatarModal({ open, onOpenChange }: AvatarModalProps) {
  const app = useApp();
  const [selectedId, setSelectedId] = useState<string>(app.avatar || "cowboy");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Sync with current app avatar whenever modal opens
  useEffect(() => {
    if (open) {
      setSelectedId(app.avatar || "cowboy");
      setError("");
      setBusy(false);
    }
  }, [open, app.avatar]);

  const activeAvatar = getAvatar(selectedId);

  const handleSave = async () => {
    setBusy(true);
    setError("");
    try {
      await app.saveAvatar(selectedId);
      app.toast(
        selectedId
          ? `${activeAvatar?.name || "OHMI Avatar"} selected!`
          : "Initial-based avatar restored.",
      );
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Avatar could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="avatar-modal-content">
        <div className="avatar-modal-header">
          <div className="avatar-modal-badge">
            <span>Mascot Collection</span>
          </div>
          <DialogTitle className="avatar-modal-title">
            Choose Your OHMI Avatar
          </DialogTitle>
          <DialogDescription className="avatar-modal-desc">
            Personalize your workspace companion. Select from 10 custom OHMI
            mascot styles.
          </DialogDescription>
        </div>

        {/* Selected Hero Preview */}
        <div className="avatar-preview-card" aria-live="polite">
          <div className="avatar-preview-circle-glow">
            {activeAvatar ? (
              <Image
                src={activeAvatar.src}
                alt={activeAvatar.name}
                width={100}
                height={100}
                className="avatar-preview-img"
                priority
              />
            ) : (
              <div className="avatar-preview-fallback">
                <span className="fallback-initial">
                  {(app.name.slice(0, 1) || "A").toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div className="avatar-preview-info">
            <div className="avatar-preview-meta">
              <h3>{activeAvatar?.name || "Initial Fallback"}</h3>
              {activeAvatar && (
                <span className="avatar-role-pill">{activeAvatar.role}</span>
              )}
            </div>
            <p className="avatar-preview-desc">
              {activeAvatar
                ? activeAvatar.description
                : "Your standard initial letter display based on your workspace name."}
            </p>
          </div>
        </div>

        {error && (
          <p className="error avatar-error" role="alert">
            {error}
          </p>
        )}

        {/* Avatar Grid Selection */}
        <div
          className="avatar-grid"
          role="radiogroup"
          aria-label="Available OHMI mascot avatars"
        >
          {AVATARS.map((item) => {
            const isSelected = selectedId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={item.name}
                tabIndex={0}
                disabled={busy}
                onClick={() => setSelectedId(item.id)}
                className={`avatar-choice ${isSelected ? "selected" : ""}`}
              >
                <div className="avatar-thumbnail-wrap">
                  <Image
                    src={item.src}
                    alt={item.name}
                    width={64}
                    height={64}
                    className="avatar-thumb-img"
                  />
                  {isSelected && (
                    <span
                      className="avatar-selected-badge"
                      aria-hidden="true"
                    >
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                </div>
                <span className="avatar-choice-name">{item.name.replace(" OHMI", "")}</span>
              </button>
            );
          })}
        </div>

        {/* Fallback Option */}
        <div className="avatar-fallback-row">
          <button
            type="button"
            className={`avatar-fallback-btn ${selectedId === "" ? "active" : ""}`}
            onClick={() => setSelectedId("")}
            disabled={busy}
            aria-label="Use letter initial avatar fallback"
          >
            <User size={15} aria-hidden="true" />
            <span>Use Name Initial Fallback</span>
            {selectedId === "" && (
              <span className="avatar-fallback-check">
                <Check size={12} strokeWidth={3} />
              </span>
            )}
          </button>
        </div>

        {/* Modal Action Buttons */}
        <div className="avatar-modal-actions">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            disabled={busy}
            onClick={handleSave}
            className="avatar-save-btn"
          >
            {busy ? "Saving…" : "Save Avatar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

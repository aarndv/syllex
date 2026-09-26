import React, { useState, useEffect, useRef } from "react";
import { FolderIcon, FileIcon, PencilIcon, CloseIcon } from "./Icons";
import "./RenameModal.css";

interface RenameModalProps {
  isOpen: boolean;
  isFolder: boolean;
  currentName: string;
  onConfirm: (newName: string) => Promise<void> | void;
  onCancel: () => void;
}

export const RenameModal: React.FC<RenameModalProps> = ({
  isOpen,
  isFolder,
  currentName,
  onConfirm,
  onCancel,
}) => {
  const [nameInput, setNameInput] = useState<string>("");
  const [extension, setExtension] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setIsSubmitting(false);
      return;
    }

    if (isFolder) {
      setNameInput(currentName);
      setExtension("");
    } else {
      const lastDot = currentName.lastIndexOf(".");
      if (lastDot > 0) {
        setNameInput(currentName.substring(0, lastDot));
        setExtension(currentName.substring(lastDot));
      } else {
        setNameInput(currentName);
        setExtension("");
      }
    }
    setError(null);
    setIsSubmitting(false);

    // Focus input after modal mount
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 50);
  }, [isOpen, currentName, isFolder]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setError("Name cannot be empty.");
      return;
    }

    const invalidChars = ["/", "\\", ":", "*", "?", '"', "<", ">", "|"];
    if (invalidChars.some((c) => trimmed.includes(c)) || trimmed.includes("..")) {
      setError("Name contains invalid characters (slashes, colons, or path traversal).");
      return;
    }

    const finalName = isFolder ? trimmed : `${trimmed}${extension}`;
    if (finalName === currentName) {
      onCancel();
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(finalName);
    } catch (err: any) {
      setError(typeof err === "string" ? err : err.message || "Failed to rename item");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal-container rename-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-modal-title"
      >
        <header className="modal-header rename-modal-header">
          <div className="modal-title-group">
            <span className="modal-icon-badge">
              <PencilIcon size={18} />
            </span>
            <div className="modal-title-text">
              <h2 id="rename-modal-title">
                {isFolder ? "Rename Folder" : "Rename Module"}
              </h2>
              <span className="modal-subtitle">
                {isFolder ? "COLLECTION DIRECTORY" : "COURSE MATERIAL"}
              </span>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="icon-btn close-btn"
            title="Cancel"
            aria-label="Close modal"
          >
            <CloseIcon size={16} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="rename-form">
          <div className="modal-body rename-modal-body">
            <div className="rename-target-info">
              <span className="rename-type-emblem">
                {isFolder ? <FolderIcon size={16} /> : <FileIcon size={16} />}
              </span>
              <span className="rename-current-label" title={currentName}>
                Current: <strong className="rename-current-name">{currentName}</strong>
              </span>
            </div>

            <div className="form-field-group">
              <label htmlFor="rename-input" className="form-field-label">
                {isFolder ? "New Folder Name" : "New Module Title"}
              </label>
              <div className="rename-input-wrapper">
                <input
                  id="rename-input"
                  ref={inputRef}
                  type="text"
                  value={nameInput}
                  onChange={(e) => {
                    setNameInput(e.target.value);
                    if (error) setError(null);
                  }}
                  className="modal-text-input rename-input"
                  placeholder={isFolder ? "e.g. Computer Science 101" : "e.g. Lecture 01 - Intro"}
                  disabled={isSubmitting}
                  autoComplete="off"
                />
                {!isFolder && extension && (
                  <span className="rename-ext-badge" title={`Preserved extension: ${extension}`}>
                    {extension}
                  </span>
                )}
              </div>
            </div>

            {error && (
              <div className="rename-error-banner" role="alert">
                <span>{error}</span>
              </div>
            )}
          </div>

          <footer className="modal-footer rename-modal-footer">
            <button
              type="button"
              onClick={onCancel}
              className="secondary-btn"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-btn"
              disabled={isSubmitting || !nameInput.trim()}
            >
              {isSubmitting ? "Renaming..." : "Save Changes"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

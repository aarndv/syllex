import React from "react";
import { CloseIcon, RefreshIcon } from "./Icons";
import "./ConfirmDeleteModal.css";

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  itemName: string;
  isFolder: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  itemName,
  isFolder,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="delete-modal-backdrop" onClick={onCancel}>
      <div className="delete-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="delete-modal-header">
          <h3>Confirm Removal</h3>
          <button className="delete-modal-close-btn" onClick={onCancel}>
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="delete-modal-body">
          <p className="delete-prompt-text">
            Are you sure you want to remove {isFolder ? "the folder" : "the item"}{" "}
            <strong>"{itemName}"</strong> from your vault?
          </p>
          <span className="delete-modal-note">
            You will have 6 seconds to Undo this action from the bottom notification bar.
          </span>
        </div>

        <div className="delete-modal-footer">
          <button className="secondary-btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary-btn delete-btn" onClick={onConfirm}>
            Confirm Remove
          </button>
        </div>
      </div>
    </div>
  );
};

interface UndoToastProps {
  itemName: string;
  onUndo: () => void;
  onDismiss: () => void;
}

export const UndoToast: React.FC<UndoToastProps> = ({ itemName, onUndo, onDismiss }) => {
  return (
    <div className="undo-toast-bar">
      <div className="undo-toast-info">
        <span className="undo-toast-text">
          Removed <strong>"{itemName}"</strong>
        </span>
        <span className="undo-timer-tag">6s window</span>
      </div>
      <div className="undo-toast-actions">
        <button className="undo-action-btn" onClick={onUndo}>
          <RefreshIcon size={14} /> Undo Deletion
        </button>
        <button className="undo-dismiss-btn" onClick={onDismiss} title="Dismiss">
          <CloseIcon size={14} />
        </button>
      </div>
    </div>
  );
};

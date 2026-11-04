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
          <h3>Hide from Library</h3>
          <button className="delete-modal-close-btn" onClick={onCancel}>
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="delete-modal-body">
          <p className="delete-prompt-text">
            Hide {isFolder ? "the folder and its modules" : "the module"}{" "}
            <strong>"{itemName}"</strong> from Syllex?
          </p>
          <span className="delete-modal-note">
            The source files stay on disk. You can restore this item from Manage hidden items at any time.
          </span>
        </div>

        <div className="delete-modal-footer">
          <button className="secondary-btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary-btn delete-btn" onClick={onConfirm}>
            Hide Item
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
          Hidden <strong>"{itemName}"</strong>
        </span>
        <span className="undo-timer-tag">6s window</span>
      </div>
      <div className="undo-toast-actions">
        <button className="undo-action-btn" onClick={onUndo}>
          <RefreshIcon size={14} /> Undo Hide
        </button>
        <button className="undo-dismiss-btn" onClick={onDismiss} title="Dismiss">
          <CloseIcon size={14} />
        </button>
      </div>
    </div>
  );
};

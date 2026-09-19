import React, { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { VaultSummary } from "../types/vault";
import { FolderIcon, CloseIcon, PlusIcon } from "./Icons";
import "./VaultManagerModal.css";

interface VaultManagerModalProps {
  currentVaultPath: string | null;
  defaultVaultsRoot: string | null;
  onSelectVaultPath: (path: string) => void;
  onSetDefaultVaultsRoot: (path: string) => void;
  onClose: () => void;
}

export const VaultManagerModal: React.FC<VaultManagerModalProps> = ({
  currentVaultPath,
  defaultVaultsRoot,
  onSelectVaultPath,
  onSetDefaultVaultsRoot,
  onClose,
}) => {
  const [subvaults, setSubvaults] = useState<VaultSummary[]>([]);
  const [loadingSubvaults, setLoadingSubvaults] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultVaultsRoot) {
      loadSubvaults(defaultVaultsRoot);
    } else {
      setSubvaults([]);
    }
  }, [defaultVaultsRoot]);

  async function loadSubvaults(rootPath: string) {
    setLoadingSubvaults(true);
    setError(null);
    try {
      const list = await invoke<VaultSummary[]>("list_subvaults", { parentDir: rootPath });
      setSubvaults(list);
    } catch (err: any) {
      setError(typeof err === "string" ? err : err.message || "Failed to list subvaults");
      setSubvaults([]);
    } finally {
      setLoadingSubvaults(false);
    }
  }

  async function handleSetDefaultFolder() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Default Folder to Store All Vaults",
      });

      if (selected && typeof selected === "string") {
        onSetDefaultVaultsRoot(selected);
        await loadSubvaults(selected);
      }
    } catch (err: any) {
      setError(err.message || "Failed to select default folder");
    }
  }

  async function handleCreateNewVault() {
    let parentFolder = defaultVaultsRoot;

    if (!parentFolder) {
      alert("Please select a default parent folder where your new vault will be created.");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Parent Folder for New Vault",
      });

      if (!selected || typeof selected !== "string") return;
      parentFolder = selected;
      onSetDefaultVaultsRoot(selected);
    }

    const vaultName = window.prompt("Enter name for the new vault (e.g. CS101 Vault or Fall 2026):");
    if (!vaultName || !vaultName.trim()) return;

    setError(null);
    try {
      const newVaultPath = await invoke<string>("create_vault", {
        parentDir: parentFolder,
        vaultName: vaultName.trim(),
      });

      onSelectVaultPath(newVaultPath);
      onClose();
    } catch (err: any) {
      setError(typeof err === "string" ? err : err.message || "Failed to create new vault");
    }
  }

  async function handleOpenExternalFolder() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Open Course Vault Directory",
      });

      if (selected && typeof selected === "string") {
        onSelectVaultPath(selected);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || "Failed to select directory");
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="vault-manager-card" onClick={(e) => e.stopPropagation()}>
        <header className="vault-manager-header">
          <h2>Vault Manager</h2>
          <button onClick={onClose} className="modal-close-btn" title="Close modal">
            <CloseIcon size={16} />
          </button>
        </header>

        <div className="vault-manager-body">
          {error && (
            <div className="modal-error-banner">
              <p><strong>Error:</strong> {error}</p>
            </div>
          )}

          {/* Default Storage Location Section */}
          <section className="manager-section default-root-section">
            <div className="section-title-row">
              <h3>Default Vaults Folder</h3>
              <button onClick={handleSetDefaultFolder} className="secondary-btn small">
                {defaultVaultsRoot ? "Change Folder" : "Select Default Folder"}
              </button>
            </div>
            <div className="default-path-box">
              <span className="path-icon">
                <FolderIcon size={16} />
              </span>
              <span className="path-text">
                {defaultVaultsRoot ? defaultVaultsRoot : "No default storage location configured"}
              </span>
            </div>
          </section>

          {/* Create New Vault Button */}
          <section className="manager-section create-section">
            <button onClick={handleCreateNewVault} className="primary-btn full-width">
              <PlusIcon size={16} /> Create New Vault
            </button>
          </section>

          {/* Existing Vaults in Default Directory */}
          {defaultVaultsRoot && (
            <section className="manager-section subvaults-section">
              <h3>Vaults in Default Storage</h3>

              {loadingSubvaults ? (
                <p className="loading-subtext">Scanning default directory...</p>
              ) : subvaults.length === 0 ? (
                <p className="empty-subtext">No subvault folders found in default directory yet.</p>
              ) : (
                <div className="subvaults-list">
                  {subvaults.map((vault) => {
                    const isActive = currentVaultPath === vault.path;
                    return (
                      <div
                        key={vault.path}
                        className={`subvault-item ${isActive ? "active" : ""}`}
                        onClick={() => {
                          onSelectVaultPath(vault.path);
                          onClose();
                        }}
                      >
                        <div className="subvault-info">
                          <span className="subvault-name">
                            <FolderIcon size={14} /> {vault.name}
                          </span>
                          <span className="subvault-count">
                            {vault.file_count} {vault.file_count === 1 ? "module" : "modules"}
                          </span>
                        </div>
                        <button
                          className={`subvault-open-btn ${isActive ? "current" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectVaultPath(vault.path);
                            onClose();
                          }}
                        >
                          {isActive ? "Active" : "Open"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Open External Vault */}
          <section className="manager-section external-section">
            <button onClick={handleOpenExternalFolder} className="secondary-btn full-width">
              Open Other Folder Directory...
            </button>
          </section>
        </div>
      </div>
    </div>
  );
};


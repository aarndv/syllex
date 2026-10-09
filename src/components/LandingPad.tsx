import React, { useEffect, useMemo } from "react";
import { SyllexLogo } from "./SyllexLogo";
import {
  FolderIcon,
  SettingsIcon,
  ArrowRightIcon,
  BookIcon,
} from "./Icons";
import "./LandingPad.css";

interface LandingPadProps {
  onEnter: () => void;
  vaultPath: string | null;
  courseCount?: number;
  fileCount?: number;
  onOpenVaultManager: () => void;
  onOpenSettings: () => void;
}

export const LandingPad: React.FC<LandingPadProps> = ({
  onEnter,
  vaultPath,
  courseCount,
  fileCount,
  onOpenVaultManager,
  onOpenSettings,
}) => {
  // Extract vault folder name from full path
  const vaultName = useMemo(() => {
    if (!vaultPath) return null;
    const parts = vaultPath.split(/[/\\]/).filter(Boolean);
    return parts[parts.length - 1] || vaultPath;
  }, [vaultPath]);

  // Keyboard shortcut listener for Enter or Space key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if an input or modal is focused
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onEnter();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onEnter]);

  // Format clean stats line
  const statsSummary = useMemo(() => {
    if (courseCount === undefined && fileCount === undefined) return null;
    const parts: string[] = [];
    if (courseCount !== undefined) {
      parts.push(`${courseCount} ${courseCount === 1 ? "course" : "courses"}`);
    }
    if (fileCount !== undefined) {
      parts.push(`${fileCount} ${fileCount === 1 ? "module" : "modules"}`);
    }
    return parts.join(" · ");
  }, [courseCount, fileCount]);

  return (
    <div className="landing-pad-container" role="region" aria-label="Syllex Landing Pad">
      <div className="landing-pad-backdrop-pattern" />

      <div className="landing-pad-card">
        {/* Logo and Provisional Tag */}
        <div className="landing-logo-wrapper">
          <SyllexLogo size={56} showProvisionalTag={true} />
        </div>

        {/* Header & Title */}
        <div className="landing-header-section">
          <h1 className="landing-app-title">Syllex</h1>
          <p className="landing-tagline">Academic Repository & Module Sanctuary</p>
        </div>

        {/* Vault Status Indicator */}
        <div className="landing-vault-status-box">
          {vaultPath ? (
            <div className="landing-vault-active" title={vaultPath}>
              <span className="landing-vault-icon">
                <FolderIcon size={15} />
              </span>
              <div className="landing-vault-text-group">
                <span className="landing-vault-name">{vaultName}</span>
                {statsSummary && (
                  <span className="landing-vault-stats">{statsSummary}</span>
                )}
              </div>
            </div>
          ) : (
            <div className="landing-vault-unselected">
              <div className="landing-vault-unselected-label">
                <span className="landing-vault-icon unconfigured">
                  <BookIcon size={14} />
                </span>
                <span className="landing-vault-unselected-text">
                  No active vault loaded
                </span>
              </div>
              <button
                type="button"
                onClick={onOpenVaultManager}
                className="landing-mini-action-btn"
                title="Select or create a study vault"
              >
                Select Vault
              </button>
            </div>
          )}
        </div>

        {/* Primary Action Button */}
        <div className="landing-actions-section">
          <button
            type="button"
            className="landing-enter-btn"
            onClick={onEnter}
            autoFocus
            aria-label="Enter Syllex"
          >
            <span className="enter-btn-text">Enter Syllex</span>
            <ArrowRightIcon size={16} className="enter-btn-icon" />
            <kbd className="enter-kbd-badge" title="Press Enter to launch">
              ↵ Enter
            </kbd>
          </button>
        </div>

        {/* Secondary Navigation Links */}
        <div className="landing-footer-links">
          <button
            type="button"
            className="landing-footer-btn"
            onClick={onOpenVaultManager}
            title="Manage or switch course vaults"
          >
            <FolderIcon size={14} />
            <span>Manage Vaults</span>
          </button>
          <span className="landing-footer-sep">·</span>
          <button
            type="button"
            className="landing-footer-btn"
            onClick={onOpenSettings}
            title="Open application preferences"
          >
            <SettingsIcon size={14} />
            <span>Preferences</span>
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useMemo, useState, useRef } from "react";
import logoWithText from "../assets/syllex-icon-with-text.png";
import logoWithTextDark from "../assets/syllex-icon-with-text-dark.png";
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
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  // Extract vault folder name from full path
  const vaultName = useMemo(() => {
    if (!vaultPath) return null;
    const parts = vaultPath.split(/[/\\]/).filter(Boolean);
    return parts[parts.length - 1] || vaultPath;
  }, [vaultPath]);

  // Close settings menu on outside click or Escape
  useEffect(() => {
    if (!isSettingsMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target as Node)) {
        setIsSettingsMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSettingsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [isSettingsMenuOpen]);

  // Keyboard shortcut listener for Enter or Space key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if an input or modal is focused or settings menu is open
      if (isSettingsMenuOpen) return;
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
  }, [onEnter, isSettingsMenuOpen]);

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
        {/* Syllex wordmark */}
        <div className="landing-logo-wrapper">
          <h1 className="landing-app-title">
            <img className="landing-wordmark-dark" src={logoWithTextDark} alt="Syllex" width="4500" height="1500" />
            <img className="landing-wordmark-light" src={logoWithText} alt="Syllex" width="6000" height="2000" />
          </h1>
        </div>

        {/* Tagline */}
        <div className="landing-header-section">
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
          </button>
        </div>

        {/* Secondary Settings & Vault Action */}
        <div className="landing-footer-links" ref={settingsMenuRef}>
          <button
            type="button"
            className={`landing-settings-trigger-btn ${isSettingsMenuOpen ? "active" : ""}`}
            onClick={() => setIsSettingsMenuOpen((prev) => !prev)}
            title="Settings & Options"
            aria-label="Settings and Vault Options"
            aria-haspopup="true"
            aria-expanded={isSettingsMenuOpen}
          >
            <SettingsIcon size={18} />
          </button>

          {isSettingsMenuOpen && (
            <div className="landing-settings-dropdown" role="menu">
              <button
                type="button"
                className="landing-dropdown-item"
                role="menuitem"
                onClick={() => {
                  setIsSettingsMenuOpen(false);
                  onOpenVaultManager();
                }}
              >
                <FolderIcon size={14} />
                <span>Manage Vaults</span>
              </button>
              <button
                type="button"
                className="landing-dropdown-item"
                role="menuitem"
                onClick={() => {
                  setIsSettingsMenuOpen(false);
                  onOpenSettings();
                }}
              >
                <SettingsIcon size={14} />
                <span>Preferences</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

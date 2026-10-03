import React, { useEffect, useMemo } from "react";
import { SyllexLogo } from "./SyllexLogo";
import {
  FolderIcon,
  SettingsIcon,
  ArrowRightIcon,
  BookIcon,
  ClockIcon,
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

  // Current session context
  const sessionInfo = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    let period = "Morning";
    if (hour >= 12 && hour < 17) period = "Afternoon";
    else if (hour >= 17 && hour < 21) period = "Evening";
    else if (hour >= 21 || hour < 5) period = "Night";

    const dateStr = now.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    return { period, dateStr };
  }, []);

  // Keyboard shortcut listener for Enter key
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

  return (
    <div className="landing-pad-container" role="region" aria-label="Syllex Landing Pad">
      <div className="landing-pad-backdrop-pattern" />

      <div className="landing-pad-card">
        {/* Double-line academic corner accents */}
        <div className="landing-corner-accent top-left" />
        <div className="landing-corner-accent top-right" />
        <div className="landing-corner-accent bottom-left" />
        <div className="landing-corner-accent bottom-right" />

        {/* Decorative Top Foil Bar */}
        <div className="landing-foil-bar top" />

        {/* Logo and Provisional Branding */}
        <div className="landing-logo-wrapper">
          <SyllexLogo size={64} showProvisionalTag={true} />
        </div>

        {/* Header & Title */}
        <div className="landing-header-section">
          <h1 className="landing-app-title">Syllex</h1>
          <p className="landing-tagline">Academic Repository & Module Sanctuary</p>
          <div className="landing-subtext">
            A quiet, local-first environment for organizing and studying college course modules.
          </div>
        </div>

        {/* Session & Vault Status Pill */}
        <div className="landing-status-panel">
          <div className="landing-status-row">
            <span className="landing-status-pill session-pill">
              <ClockIcon size={13} />
              <span>
                {sessionInfo.dateStr} &bull; {sessionInfo.period} Session
              </span>
            </span>
          </div>

          <div className="landing-vault-status-box">
            {vaultPath ? (
              <div className="landing-vault-active">
                <div className="landing-vault-label-group">
                  <span className="landing-vault-icon">
                    <FolderIcon size={15} />
                  </span>
                  <div className="landing-vault-text-group">
                    <span className="landing-vault-name">{vaultName}</span>
                    <span className="landing-vault-path-sub" title={vaultPath}>
                      {vaultPath}
                    </span>
                  </div>
                </div>

                {(courseCount !== undefined || fileCount !== undefined) && (
                  <div className="landing-vault-stats-pills">
                    {courseCount !== undefined && (
                      <span className="landing-stat-tag">
                        {courseCount} {courseCount === 1 ? "Course" : "Courses"}
                      </span>
                    )}
                    {fileCount !== undefined && (
                      <span className="landing-stat-tag">
                        {fileCount} {fileCount === 1 ? "Module" : "Modules"}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="landing-vault-unselected">
                <div className="landing-vault-label-group">
                  <span className="landing-vault-icon unconfigured">
                    <BookIcon size={15} />
                  </span>
                  <span className="landing-vault-unselected-text">
                    No active vault loaded yet
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
        </div>

        {/* Primary Action Button */}
        <div className="landing-actions-section">
          <button
            type="button"
            className="landing-enter-btn"
            onClick={onEnter}
            autoFocus
            aria-label="Enter Syllex Study Sanctuary"
          >
            <span className="enter-btn-text">Enter Syllex</span>
            <ArrowRightIcon size={18} className="enter-btn-icon" />
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
          <span className="landing-footer-sep">&bull;</span>
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

        {/* Decorative Bottom Foil Bar */}
        <div className="landing-foil-bar bottom" />
      </div>
    </div>
  );
};

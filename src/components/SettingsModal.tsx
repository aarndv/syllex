import React, { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderIcon, CloseIcon, CheckIcon } from "./Icons";
import "./SettingsModal.css";

export type ThemeSetting = "light" | "dark" | "system";
export type FontStyleSetting = "serif" | "sans" | "mono";
export type FontSizeSetting = "small" | "medium" | "large";

export interface AppSettings {
  theme: ThemeSetting;
  fontStyle: FontStyleSetting;
  fontSize: FontSizeSetting;
  timeZone: string;
  defaultReadingFilter: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  fontStyle: "serif",
  fontSize: "medium",
  timeZone: "system",
  defaultReadingFilter: "original",
};

interface SettingsModalProps {
  settings: AppSettings;
  defaultVaultsRoot: string | null;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onSetDefaultVaultsRoot: (path: string) => void;
  onClose: () => void;
}

export const TIMEZONE_OPTIONS = [
  { value: "system", label: "Device Local Time (System Default)" },
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  { value: "America/New_York", label: "US / Eastern Time (EST/EDT)" },
  { value: "America/Chicago", label: "US / Central Time (CST/CDT)" },
  { value: "America/Denver", label: "US / Mountain Time (MST/MDT)" },
  { value: "America/Los_Angeles", label: "US / Pacific Time (PST/PDT)" },
  { value: "Europe/London", label: "UK / London (GMT/BST)" },
  { value: "Europe/Paris", label: "Central Europe (CET/CEST)" },
  { value: "Asia/Tokyo", label: "Japan Standard Time (JST)" },
  { value: "Asia/Singapore", label: "Singapore / Manila / HK (SGT/PST)" },
  { value: "Australia/Sydney", label: "Australia / Sydney (AEST/AEDT)" },
];

export const READING_FILTER_OPTIONS = [
  { value: "original", label: "Original Full Color" },
  { value: "fast-dark", label: "Fast Dark Mode" },
  { value: "sepia", label: "Warm Sepia" },
  { value: "dark-sepia", label: "Midnight Sepia" },
  { value: "grayscale", label: "Monochrome Grayscale" },
  { value: "high-contrast-dark", label: "High Contrast Dark" },
  { value: "ocean-dark", label: "Ocean Dark Blue" },
];

const ACADEMIC_STORAGE_KEY = "syllex_academic_tracker_data";

interface AcademicData {
  midtermDate: string;
  finalsDate: string;
  trimesterStartDate: string;
  trimesterEndDate: string;
  manualTrimesterPercent: number | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  defaultVaultsRoot,
  onUpdateSettings,
  onSetDefaultVaultsRoot,
  onClose,
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [academicData, setAcademicData] = useState<AcademicData>(() => {
    const saved = localStorage.getItem(ACADEMIC_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fallback
      }
    }
    return {
      midtermDate: "",
      finalsDate: "",
      trimesterStartDate: "",
      trimesterEndDate: "",
      manualTrimesterPercent: null,
    };
  });

  function handleChange<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    const updated = { ...localSettings, [key]: value };
    setLocalSettings(updated);
    onUpdateSettings(updated);
  }

  function handleAcademicChange<K extends keyof AcademicData>(key: K, value: AcademicData[K]) {
    const updated = { ...academicData, [key]: value };
    setAcademicData(updated);
    localStorage.setItem(ACADEMIC_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("syllex_academic_update"));
  }

  async function handleSelectDefaultFolder() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Default Folder to Store Vaults",
      });

      if (selected && typeof selected === "string") {
        onSetDefaultVaultsRoot(selected);
      }
    } catch (err) {
      console.error("Failed to select default folder:", err);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="settings-modal-card" onClick={(e) => e.stopPropagation()}>
        <header className="settings-modal-header">
          <h2>Application Settings</h2>
          <button onClick={onClose} className="modal-close-btn" title="Close settings">
            <CloseIcon size={16} />
          </button>
        </header>

        <div className="settings-modal-body">
          {/* Academic Milestones & Calendar Section */}
          <section className="settings-section">
            <label className="setting-label">Academic Milestones & Calendar</label>
            <div className="academic-settings-grid">
              <div className="setting-input-group">
                <label className="sub-label">Midterms Date (or Days Left)</label>
                <input
                  type="text"
                  placeholder="YYYY-MM-DD or e.g. 24"
                  value={academicData.midtermDate}
                  onChange={(e) => handleAcademicChange("midtermDate", e.target.value)}
                  className="setting-text-input"
                />
              </div>

              <div className="setting-input-group">
                <label className="sub-label">Finals Date (or Days Left)</label>
                <input
                  type="text"
                  placeholder="YYYY-MM-DD or e.g. 68"
                  value={academicData.finalsDate}
                  onChange={(e) => handleAcademicChange("finalsDate", e.target.value)}
                  className="setting-text-input"
                />
              </div>

              <div className="setting-input-group">
                <label className="sub-label">Trimester Start Date</label>
                <input
                  type="date"
                  value={academicData.trimesterStartDate}
                  onChange={(e) => handleAcademicChange("trimesterStartDate", e.target.value)}
                  className="setting-text-input"
                />
              </div>

              <div className="setting-input-group">
                <label className="sub-label">Trimester End Date</label>
                <input
                  type="date"
                  value={academicData.trimesterEndDate}
                  onChange={(e) => handleAcademicChange("trimesterEndDate", e.target.value)}
                  className="setting-text-input"
                />
              </div>

              <div className="setting-input-group">
                <label className="sub-label">Manual Trimester Progress % (Optional)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="e.g. 45"
                  value={academicData.manualTrimesterPercent ?? ""}
                  onChange={(e) => {
                    const val = e.target.value === "" ? null : parseInt(e.target.value, 10);
                    handleAcademicChange("manualTrimesterPercent", val);
                  }}
                  className="setting-text-input"
                />
              </div>
            </div>
          </section>

          {/* Theme / Appearance Section */}
          <section className="settings-section">
            <label className="setting-label">Interface Theme</label>
            <div className="setting-options-grid">
              <button
                className={`option-card ${localSettings.theme === "light" ? "selected" : ""}`}
                onClick={() => handleChange("theme", "light")}
              >
                <span>Light Parchment</span>
                {localSettings.theme === "light" && <CheckIcon size={14} />}
              </button>
              <button
                className={`option-card ${localSettings.theme === "dark" ? "selected" : ""}`}
                onClick={() => handleChange("theme", "dark")}
              >
                <span>Midnight Forest (Dark)</span>
                {localSettings.theme === "dark" && <CheckIcon size={14} />}
              </button>
              <button
                className={`option-card ${localSettings.theme === "system" ? "selected" : ""}`}
                onClick={() => handleChange("theme", "system")}
              >
                <span>System Preference</span>
                {localSettings.theme === "system" && <CheckIcon size={14} />}
              </button>
            </div>
          </section>

          {/* Font Style Section */}
          <section className="settings-section">
            <label className="setting-label">Typography Style</label>
            <div className="setting-options-grid">
              <button
                className={`option-card ${localSettings.fontStyle === "serif" ? "selected" : ""}`}
                onClick={() => handleChange("fontStyle", "serif")}
              >
                <span style={{ fontFamily: "Georgia, serif" }}>Academic Serif</span>
                {localSettings.fontStyle === "serif" && <CheckIcon size={14} />}
              </button>
              <button
                className={`option-card ${localSettings.fontStyle === "sans" ? "selected" : ""}`}
                onClick={() => handleChange("fontStyle", "sans")}
              >
                <span style={{ fontFamily: "system-ui, sans-serif" }}>Modern Sans-Serif</span>
                {localSettings.fontStyle === "sans" && <CheckIcon size={14} />}
              </button>
              <button
                className={`option-card ${localSettings.fontStyle === "mono" ? "selected" : ""}`}
                onClick={() => handleChange("fontStyle", "mono")}
              >
                <span style={{ fontFamily: "monospace" }}>Monospace Study</span>
                {localSettings.fontStyle === "mono" && <CheckIcon size={14} />}
              </button>
            </div>
          </section>

          {/* Font Size Section */}
          <section className="settings-section">
            <label className="setting-label">Font Size</label>
            <div className="setting-options-grid">
              <button
                className={`option-card ${localSettings.fontSize === "small" ? "selected" : ""}`}
                onClick={() => handleChange("fontSize", "small")}
              >
                <span style={{ fontSize: "0.8rem" }}>Small (14px)</span>
                {localSettings.fontSize === "small" && <CheckIcon size={14} />}
              </button>
              <button
                className={`option-card ${localSettings.fontSize === "medium" ? "selected" : ""}`}
                onClick={() => handleChange("fontSize", "medium")}
              >
                <span style={{ fontSize: "0.9rem" }}>Medium (16px)</span>
                {localSettings.fontSize === "medium" && <CheckIcon size={14} />}
              </button>
              <button
                className={`option-card ${localSettings.fontSize === "large" ? "selected" : ""}`}
                onClick={() => handleChange("fontSize", "large")}
              >
                <span style={{ fontSize: "1rem" }}>Large (18px)</span>
                {localSettings.fontSize === "large" && <CheckIcon size={14} />}
              </button>
            </div>
          </section>

          {/* Time Zone Section */}
          <section className="settings-section">
            <label htmlFor="setting-timezone" className="setting-label">
              Device Timezone Display
            </label>
            <select
              id="setting-timezone"
              value={localSettings.timeZone}
              onChange={(e) => handleChange("timeZone", e.target.value)}
              className="setting-select-control"
            >
              {TIMEZONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </section>

          {/* Default Reading Filter Mode */}
          <section className="settings-section">
            <label htmlFor="setting-reading-filter" className="setting-label">
              Default Document Reading Filter
            </label>
            <select
              id="setting-reading-filter"
              value={localSettings.defaultReadingFilter}
              onChange={(e) => handleChange("defaultReadingFilter", e.target.value)}
              className="setting-select-control"
            >
              {READING_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </section>

          {/* Default Storage Directory Section */}
          <section className="settings-section">
            <div className="section-title-row">
              <label className="setting-label">Default Vaults Folder</label>
              <button onClick={handleSelectDefaultFolder} className="secondary-btn small">
                {defaultVaultsRoot ? "Change Directory" : "Select Directory"}
              </button>
            </div>
            <div className="settings-path-box">
              <FolderIcon size={14} />
              <span className="path-text">
                {defaultVaultsRoot ? defaultVaultsRoot : "No default directory configured"}
              </span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

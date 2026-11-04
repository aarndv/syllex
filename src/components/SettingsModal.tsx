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
  showReadingFilterIndicator: boolean;
  pageSidebarVisible: boolean;
  pageSidebarDock: "left" | "right";
  pageSidebarWidth: number;
  thumbnailScale: number;
  pageSidebarLayoutVersion: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  fontStyle: "sans",
  fontSize: "medium",
  timeZone: "system",
  defaultReadingFilter: "original",
  showReadingFilterIndicator: true,
  pageSidebarVisible: true,
  pageSidebarDock: "left",
  pageSidebarWidth: 110,
  thumbnailScale: 1,
  pageSidebarLayoutVersion: 2,
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
type SettingsCategory = "appearance" | "reading" | "academic" | "storage";

interface AcademicData {
  midtermDate: string;
  finalsDate: string;
  trimesterStartDate: string;
  trimesterEndDate: string;
  manualTrimesterPercent: number | null;
  showMidterms: boolean;
  showFinals: boolean;
  showTrimester: boolean;
}

const DEFAULT_ACADEMIC_DATA: AcademicData = {
  midtermDate: "",
  finalsDate: "",
  trimesterStartDate: "",
  trimesterEndDate: "",
  manualTrimesterPercent: null,
  showMidterms: false,
  showFinals: false,
  showTrimester: false,
};

function loadAcademicData(): AcademicData {
  const saved = localStorage.getItem(ACADEMIC_STORAGE_KEY);
  if (saved) {
    try {
      return { ...DEFAULT_ACADEMIC_DATA, ...JSON.parse(saved) };
    } catch {
      // Ignore invalid saved data.
    }
  }
  return DEFAULT_ACADEMIC_DATA;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  defaultVaultsRoot,
  onUpdateSettings,
  onSetDefaultVaultsRoot,
  onClose,
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [savedSettings, setSavedSettings] = useState<AppSettings>(settings);
  const [academicData, setAcademicData] = useState<AcademicData>(loadAcademicData);
  const [savedAcademicData, setSavedAcademicData] = useState<AcademicData>(academicData);
  const [localVaultsRoot, setLocalVaultsRoot] = useState(defaultVaultsRoot);
  const [savedVaultsRoot, setSavedVaultsRoot] = useState(defaultVaultsRoot);
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("appearance");

  const settingsChanged = JSON.stringify(localSettings) !== JSON.stringify(savedSettings);
  const academicChanged = JSON.stringify(academicData) !== JSON.stringify(savedAcademicData);
  const rootChanged = localVaultsRoot !== savedVaultsRoot;
  const hasChanges = settingsChanged || academicChanged || rootChanged;

  function handleChange<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    const updated = { ...localSettings, [key]: value };
    setLocalSettings(updated);
  }

  function handleAcademicChange<K extends keyof AcademicData>(key: K, value: AcademicData[K]) {
    const updated = { ...academicData, [key]: value };
    setAcademicData(updated);
  }

  function applyChanges() {
    if (settingsChanged) {
      onUpdateSettings(localSettings);
      setSavedSettings(localSettings);
    }
    if (academicChanged) {
      localStorage.setItem(ACADEMIC_STORAGE_KEY, JSON.stringify(academicData));
      window.dispatchEvent(new Event("syllex_academic_update"));
      setSavedAcademicData(academicData);
    }
    if (rootChanged && localVaultsRoot) {
      onSetDefaultVaultsRoot(localVaultsRoot);
      setSavedVaultsRoot(localVaultsRoot);
    }
  }

  function handleOkay() {
    applyChanges();
    onClose();
  }

  async function handleSelectDefaultFolder() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Default Folder to Store Vaults",
      });

      if (selected && typeof selected === "string") {
        setLocalVaultsRoot(selected);
      }
    } catch (err) {
      console.error("Failed to select default folder:", err);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="settings-modal-card" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(e) => e.stopPropagation()}>
        <header className="settings-modal-header">
          <div>
            <h2 id="settings-title">Application Settings</h2>
            <p>Make Syllex feel right for your study space.</p>
          </div>
          <button type="button" onClick={onClose} className="modal-close-btn" title="Close settings" aria-label="Close settings">
            <CloseIcon size={16} />
          </button>
        </header>
        <div className="settings-modal-content">
          <nav className="settings-navigation" aria-label="Settings categories">
            {([
              ["appearance", "Appearance", "Theme & type"],
              ["reading", "Reading", "Documents & previews"],
              ["academic", "Academic", "Milestones & dates"],
              ["storage", "Storage", "Vault location"],
            ] as const).map(([category, label, description]) => (
              <button type="button" key={category} className={`settings-nav-item ${activeCategory === category ? "active" : ""}`}
                aria-current={activeCategory === category ? "page" : undefined}
                onClick={() => setActiveCategory(category)}>
                <span>{label}</span><small>{description}</small>
              </button>
            ))}
          </nav>
        <div className="settings-modal-body">
          {activeCategory === "academic" && <>
            <div className="settings-page-heading"><h3>Academic milestones</h3><p>Choose which deadlines appear in your sidebar.</p></div>
          {/* Academic Milestones & Calendar Section */}
          <section className="settings-section">
            <h4 className="setting-label">Calendar & progress</h4>
            <div className="academic-settings-grid">
              <div className="academic-visibility-options" aria-label="Sidebar academic trackers">
                <span className="sub-label">Show in Sidebar</span>
                <label className="academic-visibility-option">
                  <input
                    type="checkbox"
                    checked={academicData.showMidterms}
                    onChange={(e) => handleAcademicChange("showMidterms", e.target.checked)}
                  />
                  Days to Midterms
                </label>
                <label className="academic-visibility-option">
                  <input
                    type="checkbox"
                    checked={academicData.showFinals}
                    onChange={(e) => handleAcademicChange("showFinals", e.target.checked)}
                  />
                  Days to Finals
                </label>
                <label className="academic-visibility-option">
                  <input
                    type="checkbox"
                    checked={academicData.showTrimester}
                    onChange={(e) => handleAcademicChange("showTrimester", e.target.checked)}
                  />
                  Trimester Progress
                </label>
              </div>
              <div className="setting-input-group">
                <label htmlFor="setting-midterms-date" className="sub-label">Midterms Date (or Days Left)</label>
                <input
                  id="setting-midterms-date"
                  type="text"
                  placeholder="YYYY-MM-DD or e.g. 24"
                  value={academicData.midtermDate}
                  onChange={(e) => handleAcademicChange("midtermDate", e.target.value)}
                  className="setting-text-input"
                />
              </div>

              <div className="setting-input-group">
                <label htmlFor="setting-finals-date" className="sub-label">Finals Date (or Days Left)</label>
                <input
                  id="setting-finals-date"
                  type="text"
                  placeholder="YYYY-MM-DD or e.g. 68"
                  value={academicData.finalsDate}
                  onChange={(e) => handleAcademicChange("finalsDate", e.target.value)}
                  className="setting-text-input"
                />
              </div>

              <div className="setting-input-group">
                <label htmlFor="setting-trimester-start" className="sub-label">Trimester Start Date</label>
                <input
                  id="setting-trimester-start"
                  type="date"
                  value={academicData.trimesterStartDate}
                  onChange={(e) => handleAcademicChange("trimesterStartDate", e.target.value)}
                  className="setting-text-input"
                />
              </div>

              <div className="setting-input-group">
                <label htmlFor="setting-trimester-end" className="sub-label">Trimester End Date</label>
                <input
                  id="setting-trimester-end"
                  type="date"
                  value={academicData.trimesterEndDate}
                  onChange={(e) => handleAcademicChange("trimesterEndDate", e.target.value)}
                  className="setting-text-input"
                />
              </div>

              <div className="setting-input-group">
                <label htmlFor="setting-trimester-progress" className="sub-label">Manual Trimester Progress % (Optional)</label>
                <input
                  id="setting-trimester-progress"
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
          </>}

          {activeCategory === "appearance" && <>
            <div className="settings-page-heading"><h3>Appearance</h3><p>Set the tone and typography for your workspace.</p></div>
          {/* Theme / Appearance Section */}
          <section className="settings-section">
            <h4 className="setting-label">Interface theme</h4>
            <div className="setting-options-grid">
              <button
                className={`option-card ${localSettings.theme === "light" ? "selected" : ""}`}
                aria-pressed={localSettings.theme === "light"}
                onClick={() => handleChange("theme", "light")}
              >
                <span>Light Parchment</span>
                {localSettings.theme === "light" && <CheckIcon size={14} />}
              </button>
              <button
                className={`option-card ${localSettings.theme === "dark" ? "selected" : ""}`}
                aria-pressed={localSettings.theme === "dark"}
                onClick={() => handleChange("theme", "dark")}
              >
                <span>Midnight Forest (Dark)</span>
                {localSettings.theme === "dark" && <CheckIcon size={14} />}
              </button>
              <button
                className={`option-card ${localSettings.theme === "system" ? "selected" : ""}`}
                aria-pressed={localSettings.theme === "system"}
                onClick={() => handleChange("theme", "system")}
              >
                <span>System Preference</span>
                {localSettings.theme === "system" && <CheckIcon size={14} />}
              </button>
            </div>
          </section>

          {/* Font Style Section */}
          <section className="settings-section">
            <h4 className="setting-label">Typography style</h4>
            <div className="setting-options-grid">
              <button
                className={`option-card ${localSettings.fontStyle === "serif" ? "selected" : ""}`}
                aria-pressed={localSettings.fontStyle === "serif"}
                onClick={() => handleChange("fontStyle", "serif")}
              >
                <span style={{ fontFamily: "Georgia, serif" }}>Academic Serif</span>
                {localSettings.fontStyle === "serif" && <CheckIcon size={14} />}
              </button>
              <button
                className={`option-card ${localSettings.fontStyle === "sans" ? "selected" : ""}`}
                aria-pressed={localSettings.fontStyle === "sans"}
                onClick={() => handleChange("fontStyle", "sans")}
              >
                <span style={{ fontFamily: "system-ui, sans-serif" }}>Modern Sans-Serif</span>
                {localSettings.fontStyle === "sans" && <CheckIcon size={14} />}
              </button>
              <button
                className={`option-card ${localSettings.fontStyle === "mono" ? "selected" : ""}`}
                aria-pressed={localSettings.fontStyle === "mono"}
                onClick={() => handleChange("fontStyle", "mono")}
              >
                <span style={{ fontFamily: "monospace" }}>Monospace Study</span>
                {localSettings.fontStyle === "mono" && <CheckIcon size={14} />}
              </button>
            </div>
          </section>

          {/* Font Size Section */}
          <section className="settings-section">
            <h4 className="setting-label">Font size</h4>
            <div className="setting-options-grid">
              <button
                className={`option-card ${localSettings.fontSize === "small" ? "selected" : ""}`}
                aria-pressed={localSettings.fontSize === "small"}
                onClick={() => handleChange("fontSize", "small")}
              >
                <span style={{ fontSize: "0.8rem" }}>Small (14px)</span>
                {localSettings.fontSize === "small" && <CheckIcon size={14} />}
              </button>
              <button
                className={`option-card ${localSettings.fontSize === "medium" ? "selected" : ""}`}
                aria-pressed={localSettings.fontSize === "medium"}
                onClick={() => handleChange("fontSize", "medium")}
              >
                <span style={{ fontSize: "0.9rem" }}>Medium (16px)</span>
                {localSettings.fontSize === "medium" && <CheckIcon size={14} />}
              </button>
              <button
                className={`option-card ${localSettings.fontSize === "large" ? "selected" : ""}`}
                aria-pressed={localSettings.fontSize === "large"}
                onClick={() => handleChange("fontSize", "large")}
              >
                <span style={{ fontSize: "1rem" }}>Large (18px)</span>
                {localSettings.fontSize === "large" && <CheckIcon size={14} />}
              </button>
            </div>
          </section>
          </>}

          {activeCategory === "reading" && <>
            <div className="settings-page-heading"><h3>Reading</h3><p>Adjust document defaults and page previews.</p></div>
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
            <label className="settings-toggle-row">
              <input
                type="checkbox"
                checked={localSettings.showReadingFilterIndicator}
                onChange={(e) => handleChange("showReadingFilterIndicator", e.target.checked)}
              />
              <span>
                <strong>Show current filter beside document title</strong>
                <small>Keep the active reading filter visible in the reader toolbar.</small>
              </span>
            </label>
          </section>

          <section className="settings-section">
            <h4 className="setting-label">Page preview sidebar</h4>
            <div className="setting-options-grid">
              <button type="button" className={`option-card ${localSettings.pageSidebarVisible ? "selected" : ""}`}
                aria-pressed={localSettings.pageSidebarVisible}
                onClick={() => handleChange("pageSidebarVisible", !localSettings.pageSidebarVisible)}>
                <span>{localSettings.pageSidebarVisible ? "Shown" : "Hidden"}</span>
                {localSettings.pageSidebarVisible && <CheckIcon size={14} />}
              </button>
              <button type="button" className={`option-card ${localSettings.pageSidebarDock === "left" ? "selected" : ""}`}
                aria-pressed={localSettings.pageSidebarDock === "left"}
                onClick={() => handleChange("pageSidebarDock", "left")}>Dock Left</button>
              <button type="button" className={`option-card ${localSettings.pageSidebarDock === "right" ? "selected" : ""}`}
                aria-pressed={localSettings.pageSidebarDock === "right"}
                onClick={() => handleChange("pageSidebarDock", "right")}>Dock Right</button>
            </div>
            <div className="setting-slider-row">
              <label htmlFor="setting-preview-width">Sidebar width: {localSettings.pageSidebarWidth}px</label>
              <input id="setting-preview-width" type="range" min="100" max="220" step="10"
                value={localSettings.pageSidebarWidth}
                onChange={(e) => handleChange("pageSidebarWidth", Number(e.target.value))} />
            </div>
            <div className="setting-slider-row">
              <label htmlFor="setting-thumbnail-scale">Thumbnail scale: {Math.round(localSettings.thumbnailScale * 100)}%</label>
              <input id="setting-thumbnail-scale" type="range" min="0.7" max="1.4" step="0.05"
                value={localSettings.thumbnailScale}
                onChange={(e) => handleChange("thumbnailScale", Number(e.target.value))} />
            </div>
          </section>
          </>}

          {activeCategory === "storage" && <>
            <div className="settings-page-heading"><h3>Storage</h3><p>Choose where new vaults are stored by default.</p></div>
          {/* Default Storage Directory Section */}
          <section className="settings-section">
            <div className="section-title-row">
              <h4 className="setting-label">Default vaults folder</h4>
              <button type="button" onClick={handleSelectDefaultFolder} className="settings-choose-btn">
                {localVaultsRoot ? "Change folder" : "Select folder"}
              </button>
            </div>
            <div className="settings-path-box">
              <FolderIcon size={14} />
              <span className="path-text">
                {localVaultsRoot ? localVaultsRoot : "No default folder selected"}
              </span>
            </div>
          </section>
          </>}
        </div>
        </div>
        <footer className="settings-modal-footer">
          <span className="settings-change-status" aria-live="polite">{hasChanges ? "Unsaved changes" : "All changes saved"}</span>
          <div className="settings-footer-actions">
            <button type="button" className="settings-cancel-btn" onClick={onClose}>Cancel</button>
            <button type="button" className="settings-apply-btn" onClick={applyChanges} disabled={!hasChanges}>Apply changes</button>
            <button type="button" className="settings-okay-btn" onClick={handleOkay}>OK</button>
          </div>
        </footer>
      </div>
    </div>
  );
};

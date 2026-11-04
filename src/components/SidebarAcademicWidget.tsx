import React, { useState, useEffect, useMemo } from "react";
import { ClockIcon, SettingsIcon, SidebarToggleIcon } from "./Icons";
import { getDaysUntil, getTrimesterPercent } from "../utils/academicDates";
import "./SidebarAcademicWidget.css";

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

const STORAGE_KEY = "syllex_academic_tracker_data";

interface SidebarAcademicWidgetProps {
  onOpenSettings?: () => void;
  onToggleSidebar?: () => void;
}

export const SidebarAcademicWidget: React.FC<SidebarAcademicWidgetProps> = ({
  onOpenSettings,
  onToggleSidebar,
}) => {
  const [now, setNow] = useState<Date>(new Date());
  const [data, setData] = useState<AcademicData>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return { ...DEFAULT_ACADEMIC_DATA, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_ACADEMIC_DATA;
      }
    }
    return DEFAULT_ACADEMIC_DATA;
  });

  // Reload academic settings whenever updated in SettingsModal
  useEffect(() => {
    function loadData() {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          setData({ ...DEFAULT_ACADEMIC_DATA, ...JSON.parse(saved) });
        } catch {
          // Fallback
        }
      }
    }

    window.addEventListener("syllex_academic_update", loadData);
    return () => window.removeEventListener("syllex_academic_update", loadData);
  }, []);

  // Update clock every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Format time up to the minute (e.g., 03:44 PM)
  const timeString = useMemo(() => {
    return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [now]);

  const daysToMidterms = getDaysUntil(data.midtermDate, now);
  const daysToFinals = getDaysUntil(data.finalsDate, now);

  // Calculate percentage of trimester complete
  const trimesterPercent = useMemo(() => {
    if (data.manualTrimesterPercent !== null && data.manualTrimesterPercent !== undefined) {
      return Math.min(100, Math.max(0, data.manualTrimesterPercent));
    }
    return getTrimesterPercent(data.trimesterStartDate, data.trimesterEndDate, now);
  }, [data, now]);

  // Calculate percentage of year complete automatically
  const yearPercent = useMemo(() => {
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
    const endOfYear = new Date(now.getFullYear() + 1, 0, 1).getTime();
    const current = now.getTime();
    const pct = Math.round(((current - startOfYear) / (endOfYear - startOfYear)) * 100);
    return Math.min(100, Math.max(0, pct));
  }, [now]);

  return (
    <div className="academic-sidebar-widget">
      {/* Clock Display Header */}
      <div className="sidebar-clock-row">
        <div className="sidebar-clock-header">
          <div className="clock-time-display">
            <ClockIcon size={16} />
            <span className="clock-digits">{timeString}</span>
          </div>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="widget-edit-btn"
              title="Configure Academic Milestones in Settings"
              aria-label="Configure Academic Milestones in Settings"
            >
              <SettingsIcon size={13} />
            </button>
          )}
        </div>
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="icon-btn sidebar-toggle-btn"
            title="Hide Sidebar"
            aria-label="Hide Sidebar"
          >
            <SidebarToggleIcon size={16} />
          </button>
        )}
      </div>

      {/* Academic Trackers List */}
      <div className="academic-trackers-list">
        {/* Days until Midterms */}
        {data.showMidterms && (
          <div className="academic-tracker-item">
            <div className="tracker-label-row">
              <span className="tracker-name">Days to Midterms</span>
              <span className={`tracker-value ${daysToMidterms !== null ? "bold" : "unconfigured"}`}>
                {daysToMidterms !== null ? `${daysToMidterms} days` : "Configure in Settings"}
              </span>
            </div>
          </div>
        )}

        {/* Days until Finals */}
        {data.showFinals && (
          <div className="academic-tracker-item">
            <div className="tracker-label-row">
              <span className="tracker-name">Days to Finals</span>
              <span className={`tracker-value ${daysToFinals !== null ? "bold" : "unconfigured"}`}>
                {daysToFinals !== null ? `${daysToFinals} days` : "Configure in Settings"}
              </span>
            </div>
          </div>
        )}

        {/* Trimester Progress */}
        {data.showTrimester && (
          <div className="academic-tracker-item">
            <div className="tracker-label-row">
              <span className="tracker-name">Trimester Progress</span>
              <span className={`tracker-value ${trimesterPercent !== null ? "" : "unconfigured"}`}>
                {trimesterPercent !== null ? `${trimesterPercent}%` : "Configure in Settings"}
              </span>
            </div>
            <div className="tracker-progress-bg">
              <div
                className="tracker-progress-fill"
                style={{ width: `${trimesterPercent ?? 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Year Progress */}
        <div className="academic-tracker-item">
          <div className="tracker-label-row">
            <span className="tracker-name">Year Progress</span>
            <span className="tracker-value">{yearPercent}%</span>
          </div>
          <div className="tracker-progress-bg year-progress">
            <div
              className="tracker-progress-fill year"
              style={{ width: `${yearPercent}%` }}
            />
            <div className="year-progress-ticks" aria-hidden="true">
              {Array.from({ length: 11 }, (_, index) => (
                <span
                  key={index}
                  className="year-progress-tick"
                  style={{ left: `${((index + 1) / 12) * 100}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

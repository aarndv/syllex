import React, { useState, useEffect, useMemo } from "react";
import { ClockIcon, SettingsIcon } from "./Icons";
import "./SidebarAcademicWidget.css";

interface AcademicData {
  midtermDate: string;
  finalsDate: string;
  trimesterStartDate: string;
  trimesterEndDate: string;
  manualTrimesterPercent: number | null;
}

const DEFAULT_ACADEMIC_DATA: AcademicData = {
  midtermDate: "",
  finalsDate: "",
  trimesterStartDate: "",
  trimesterEndDate: "",
  manualTrimesterPercent: null,
};

const STORAGE_KEY = "syllex_academic_tracker_data";

interface SidebarAcademicWidgetProps {
  onOpenSettings?: () => void;
}

export const SidebarAcademicWidget: React.FC<SidebarAcademicWidgetProps> = ({ onOpenSettings }) => {
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

  // Calculate days until target date
  function getDaysUntil(dateStr: string): number | null {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    if (isNaN(target.getTime())) {
      const parsedNum = parseInt(dateStr, 10);
      return isNaN(parsedNum) ? null : parsedNum;
    }
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    const diffTime = targetDay.getTime() - today.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  const daysToMidterms = getDaysUntil(data.midtermDate);
  const daysToFinals = getDaysUntil(data.finalsDate);

  // Calculate percentage of trimester complete
  const trimesterPercent = useMemo(() => {
    if (data.manualTrimesterPercent !== null && data.manualTrimesterPercent !== undefined) {
      return Math.min(100, Math.max(0, data.manualTrimesterPercent));
    }
    if (data.trimesterStartDate && data.trimesterEndDate) {
      const start = new Date(data.trimesterStartDate).getTime();
      const end = new Date(data.trimesterEndDate).getTime();
      const current = now.getTime();
      if (end > start) {
        const pct = Math.round(((current - start) / (end - start)) * 100);
        return Math.min(100, Math.max(0, pct));
      }
    }
    return null;
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
          >
            <SettingsIcon size={13} />
          </button>
        )}
      </div>

      {/* Academic Trackers List */}
      <div className="academic-trackers-list">
        {/* Days until Midterms */}
        <div className="academic-tracker-item">
          <div className="tracker-label-row">
            <span className="tracker-name">Days to Midterms</span>
            <span className="tracker-value bold">
              {daysToMidterms !== null ? `${daysToMidterms} days` : "Configure in Settings"}
            </span>
          </div>
        </div>

        {/* Days until Finals */}
        <div className="academic-tracker-item">
          <div className="tracker-label-row">
            <span className="tracker-name">Days to Finals</span>
            <span className="tracker-value bold">
              {daysToFinals !== null ? `${daysToFinals} days` : "Configure in Settings"}
            </span>
          </div>
        </div>

        {/* Trimester Progress */}
        <div className="academic-tracker-item">
          <div className="tracker-label-row">
            <span className="tracker-name">Trimester Progress</span>
            <span className="tracker-value">
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

        {/* Year Progress */}
        <div className="academic-tracker-item">
          <div className="tracker-label-row">
            <span className="tracker-name">Year Progress</span>
            <span className="tracker-value">{yearPercent}%</span>
          </div>
          <div className="tracker-progress-bg">
            <div
              className="tracker-progress-fill year"
              style={{ width: `${yearPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useMemo } from "react";
import { ClockIcon, PencilIcon, CloseIcon, CheckIcon } from "./Icons";
import "./SidebarAcademicWidget.css";

interface AcademicData {
  midtermDate: string; // ISO date YYYY-MM-DD or custom number
  finalsDate: string; // ISO date YYYY-MM-DD or custom number
  trimesterStartDate: string; // YYYY-MM-DD
  trimesterEndDate: string; // YYYY-MM-DD
  manualTrimesterPercent: number | null; // Optional manual override
}

const DEFAULT_ACADEMIC_DATA: AcademicData = {
  midtermDate: "",
  finalsDate: "",
  trimesterStartDate: "",
  trimesterEndDate: "",
  manualTrimesterPercent: null,
};

const STORAGE_KEY = "syllex_academic_tracker_data";

export const SidebarAcademicWidget: React.FC = () => {
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

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<AcademicData>(data);

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

  function handleSaveEdit() {
    setData(editForm);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(editForm));
    setIsEditing(false);
  }

  return (
    <div className="academic-sidebar-widget">
      {/* Clock Display Header */}
      <div className="sidebar-clock-header">
        <div className="clock-time-display">
          <ClockIcon size={16} />
          <span className="clock-digits">{timeString}</span>
        </div>
        <button
          onClick={() => {
            setEditForm(data);
            setIsEditing((prev) => !prev);
          }}
          className="widget-edit-btn"
          title="Edit Academic Tracker Dates & Schedules"
        >
          <PencilIcon size={13} />
        </button>
      </div>

      {/* Popover Form to Input Data Manually */}
      {isEditing && (
        <div className="academic-edit-popover">
          <header className="edit-popover-header">
            <span>Configure Academic Dates</span>
            <button onClick={() => setIsEditing(false)} className="popover-close-btn">
              <CloseIcon size={12} />
            </button>
          </header>
          <div className="edit-popover-body">
            <div className="form-field">
              <label>Midterms Date (or Days Left)</label>
              <input
                type="text"
                placeholder="YYYY-MM-DD or e.g. 21"
                value={editForm.midtermDate}
                onChange={(e) => setEditForm({ ...editForm, midtermDate: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label>Finals Date (or Days Left)</label>
              <input
                type="text"
                placeholder="YYYY-MM-DD or e.g. 60"
                value={editForm.finalsDate}
                onChange={(e) => setEditForm({ ...editForm, finalsDate: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label>Trimester Start Date</label>
              <input
                type="date"
                value={editForm.trimesterStartDate}
                onChange={(e) => setEditForm({ ...editForm, trimesterStartDate: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label>Trimester End Date</label>
              <input
                type="date"
                value={editForm.trimesterEndDate}
                onChange={(e) => setEditForm({ ...editForm, trimesterEndDate: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label>Manual Trimester % (Optional)</label>
              <input
                type="number"
                min="0"
                max="100"
                placeholder="e.g. 45"
                value={editForm.manualTrimesterPercent ?? ""}
                onChange={(e) => {
                  const val = e.target.value === "" ? null : parseInt(e.target.value, 10);
                  setEditForm({ ...editForm, manualTrimesterPercent: val });
                }}
              />
            </div>
            <button onClick={handleSaveEdit} className="primary-btn small full-width">
              <CheckIcon size={14} /> Save Changes
            </button>
          </div>
        </div>
      )}

      {/* Academic Trackers List */}
      <div className="academic-trackers-list">
        {/* Days until Midterms */}
        <div className="academic-tracker-item">
          <div className="tracker-label-row">
            <span className="tracker-name">Days to Midterms</span>
            <span className="tracker-value bold">
              {daysToMidterms !== null ? `${daysToMidterms} days` : "Not set"}
            </span>
          </div>
        </div>

        {/* Days until Finals */}
        <div className="academic-tracker-item">
          <div className="tracker-label-row">
            <span className="tracker-name">Days to Finals</span>
            <span className="tracker-value bold">
              {daysToFinals !== null ? `${daysToFinals} days` : "Not set"}
            </span>
          </div>
        </div>

        {/* Trimester Progress */}
        <div className="academic-tracker-item">
          <div className="tracker-label-row">
            <span className="tracker-name">Trimester Progress</span>
            <span className="tracker-value">
              {trimesterPercent !== null ? `${trimesterPercent}%` : "Not set"}
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

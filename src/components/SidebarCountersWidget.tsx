import React, { useState, useEffect } from "react";
import { PlusIcon, CloseIcon, ResetIcon, MinusIcon, PencilIcon, CounterIcon } from "./Icons";
import "./SidebarCountersWidget.css";

export interface CounterItem {
  id: string;
  name: string;
  count: number;
}

const COUNTERS_STORAGE_KEY = "syllex_sidebar_counters";

const DEFAULT_COUNTERS: CounterItem[] = [
  { id: "1", name: "Flashcards Reviewed", count: 0 },
  { id: "2", name: "Practice Problems", count: 0 },
];

export const SidebarCountersWidget: React.FC = () => {
  const [counters, setCounters] = useState<CounterItem[]>(() => {
    const saved = localStorage.getItem(COUNTERS_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // Fallback
      }
    }
    return DEFAULT_COUNTERS;
  });

  const [newName, setNewName] = useState<string>("");
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");

  useEffect(() => {
    localStorage.setItem(COUNTERS_STORAGE_KEY, JSON.stringify(counters));
  }, [counters]);

  function handleAddCounter() {
    const nameToUse = newName.trim() || `Counter ${counters.length + 1}`;
    const newCounter: CounterItem = {
      id: Date.now().toString(),
      name: nameToUse,
      count: 0,
    };
    setCounters((prev) => [...prev, newCounter]);
    setNewName("");
    setIsAdding(false);
  }

  function handleIncrement(id: string) {
    setCounters((prev) =>
      prev.map((c) => (c.id === id ? { ...c, count: c.count + 1 } : c))
    );
  }

  function handleDecrement(id: string) {
    setCounters((prev) =>
      prev.map((c) => (c.id === id ? { ...c, count: Math.max(0, c.count - 1) } : c))
    );
  }

  function handleReset(id: string) {
    setCounters((prev) =>
      prev.map((c) => (c.id === id ? { ...c, count: 0 } : c))
    );
  }

  function handleDelete(id: string) {
    setCounters((prev) => prev.filter((c) => c.id !== id));
  }

  function handleStartEdit(counter: CounterItem) {
    setEditingId(counter.id);
    setEditingName(counter.name);
  }

  function handleSaveEdit(id: string) {
    if (editingName.trim()) {
      setCounters((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name: editingName.trim() } : c))
      );
    }
    setEditingId(null);
  }

  function handleCancelEdit() {
    setEditingId(null);
  }

  const totalTicks = counters.reduce((sum, c) => sum + (c.count || 0), 0);

  return (
    <div className="sidebar-counters-card">
      <header className="counters-header">
        <div className="counters-title-row">
          <CounterIcon size={14} />
          <span className="counters-title">Counters</span>
        </div>
        <div className="counters-header-actions">
          <span className="counters-badge" title="Total ticks across all counters">
            {totalTicks} {totalTicks === 1 ? "tick" : "ticks"}
          </span>
          <button
            type="button"
            className={`counters-add-toggle-btn ${isAdding ? "active" : ""}`}
            onClick={() => setIsAdding((prev) => !prev)}
            title={isAdding ? "Cancel adding" : "Add new counter"}
          >
            {isAdding ? <CloseIcon size={12} /> : <PlusIcon size={12} />}
          </button>
        </div>
      </header>

      {/* Inline Add Counter Form */}
      {isAdding && (
        <form
          className="counter-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            handleAddCounter();
          }}
        >
          <input
            type="text"
            className="counter-input"
            placeholder="Counter name (e.g. Pages Read)..."
            value={newName}
            autoFocus
            onChange={(e) => setNewName(e.target.value)}
          />
          <button type="submit" className="counter-add-btn" title="Create Counter">
            <PlusIcon size={14} />
          </button>
        </form>
      )}

      {/* Counters List */}
      <div className="counters-items-list">
        {counters.length === 0 ? (
          <div className="counters-empty-view">
            <p className="counters-empty-text">No counters yet.</p>
            <button
              type="button"
              className="counters-empty-add-btn"
              onClick={() => setIsAdding(true)}
            >
              <PlusIcon size={12} /> Add First Counter
            </button>
          </div>
        ) : (
          counters.map((counter) => {
            const isEditing = editingId === counter.id;
            return (
              <div key={counter.id} className="counter-item">
                <div className="counter-top-row">
                  {isEditing ? (
                    <input
                      type="text"
                      className="counter-edit-input"
                      value={editingName}
                      autoFocus
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => handleSaveEdit(counter.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit(counter.id);
                        if (e.key === "Escape") handleCancelEdit();
                      }}
                    />
                  ) : (
                    <div
                      className="counter-name-container"
                      onClick={() => handleStartEdit(counter)}
                      title="Click to rename counter"
                    >
                      <span className="counter-name">{counter.name}</span>
                      <PencilIcon size={11} className="counter-rename-hint" />
                    </div>
                  )}

                  <div className="counter-item-tools">
                    <button
                      type="button"
                      onClick={() => handleReset(counter.id)}
                      className="counter-action-btn"
                      title="Reset counter to 0"
                    >
                      <ResetIcon size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(counter.id)}
                      className="counter-action-btn delete"
                      title="Delete counter"
                    >
                      <CloseIcon size={12} />
                    </button>
                  </div>
                </div>

                {/* Counter Stepper Controls */}
                <div className="counter-controls-row">
                  <button
                    type="button"
                    className="counter-stepper-btn decrement"
                    disabled={counter.count <= 0}
                    onClick={() => handleDecrement(counter.id)}
                    title="Subtract 1"
                  >
                    <MinusIcon size={14} />
                  </button>

                  <button
                    type="button"
                    className="counter-tick-btn"
                    onClick={() => handleIncrement(counter.id)}
                    title="Click to count up (+1)"
                  >
                    <span className="counter-count-number">{counter.count}</span>
                    <span className="counter-amp-label">TAP +1</span>
                  </button>

                  <button
                    type="button"
                    className="counter-stepper-btn increment"
                    onClick={() => handleIncrement(counter.id)}
                    title="Add 1 (+1)"
                  >
                    <PlusIcon size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

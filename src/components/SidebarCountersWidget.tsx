import React, { useState, useEffect } from "react";
import { PlusIcon, CloseIcon, ResetIcon, MinusIcon, CounterIcon, ChevronDownIcon, ChevronRightIcon } from "./Icons";
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
  const [isExpanded, setIsExpanded] = useState(false);

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

  return (
    <div className={`sidebar-counters-card ${isExpanded ? "is-expanded" : ""}`}>
      <header className="counters-header">
        <button
          type="button"
          className="counters-drawer-toggle"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
        >
          {isExpanded ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
          <CounterIcon size={13} />
          <span className="counters-title">Counters</span>
        </button>
        {isExpanded && (
          <div className="counters-header-actions">
            <button
              type="button"
              className={`counters-add-toggle-btn ${isAdding ? "active" : ""}`}
              onClick={() => setIsAdding((prev) => !prev)}
              title={isAdding ? "Cancel adding" : "Add new counter"}
            >
              {isAdding ? <CloseIcon size={11} /> : <PlusIcon size={11} />}
            </button>
          </div>
        )}
      </header>

      {isExpanded && <div className="counters-drawer-content">
      {/* Compact Add Counter Form */}
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
            placeholder="Counter name..."
            value={newName}
            autoFocus
            onChange={(e) => setNewName(e.target.value)}
          />
          <button type="submit" className="counter-add-btn" title="Create Counter">
            <PlusIcon size={12} />
          </button>
        </form>
      )}

      {/* Compact Counters List */}
      <div className="counters-items-list">
        {counters.length === 0 ? (
          <p className="counters-empty-text">No counters yet. Click + to add one.</p>
        ) : (
          counters.map((counter) => {
            const isEditing = editingId === counter.id;
            return (
              <div key={counter.id} className="counter-item">
                <div className="counter-left">
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
                    <span
                      className="counter-name"
                      onClick={() => handleStartEdit(counter)}
                      title="Click to rename counter"
                    >
                      {counter.name}
                    </span>
                  )}
                </div>

                {/* Stepper Controls in Single Row */}
                <div className="counter-controls">
                  <button
                    type="button"
                    className="counter-stepper-btn decrement"
                    disabled={counter.count <= 0}
                    onClick={() => handleDecrement(counter.id)}
                    title="Subtract 1"
                  >
                    <MinusIcon size={11} />
                  </button>

                  <button
                    type="button"
                    className="counter-count-btn"
                    onClick={() => handleIncrement(counter.id)}
                    title="Click to count up (+1)"
                  >
                    {counter.count}
                  </button>

                  <button
                    type="button"
                    className="counter-stepper-btn increment"
                    onClick={() => handleIncrement(counter.id)}
                    title="Add 1 (+1)"
                  >
                    <PlusIcon size={11} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleReset(counter.id)}
                    className="counter-tool-btn"
                    title="Reset to 0"
                  >
                    <ResetIcon size={11} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(counter.id)}
                    className="counter-tool-btn delete"
                    title="Delete counter"
                  >
                    <CloseIcon size={11} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
      </div>}
    </div>
  );
};

import React, { useState, useEffect } from "react";
import { PlusIcon, CloseIcon, CheckIcon } from "./Icons";
import "./SidebarTodoList.css";

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
}

const TODO_STORAGE_KEY = "syllex_sidebar_todo_list";

export const SidebarTodoList: React.FC = () => {
  const [todos, setTodos] = useState<TodoItem[]>(() => {
    const saved = localStorage.getItem(TODO_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [
      { id: "1", text: "Review Lecture 1 Slides", completed: false },
      { id: "2", text: "Complete Quiz Prep", completed: true },
    ];
  });

  const [newText, setNewText] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>("");

  useEffect(() => {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos));
  }, [todos]);

  function handleAddTodo() {
    if (!newText.trim()) return;
    const item: TodoItem = {
      id: Date.now().toString(),
      text: newText.trim(),
      completed: false,
    };
    setTodos((prev) => [...prev, item]);
    setNewText("");
  }

  function handleToggleTodo(id: string) {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  }

  function handleDeleteTodo(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }

  function handleStartEdit(todo: TodoItem) {
    setEditingId(todo.id);
    setEditingText(todo.text);
  }

  function handleSaveEdit(id: string) {
    if (editingText.trim()) {
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, text: editingText.trim() } : t))
      );
    }
    setEditingId(null);
  }

  function handleCancelEdit() {
    setEditingId(null);
  }

  const completedCount = todos.filter((t) => t.completed).length;

  return (
    <div className="sidebar-todo-card">
      <header className="todo-header">
        <span className="todo-title">To-Do List</span>
        <span className="todo-badge">
          {completedCount}/{todos.length} done
        </span>
      </header>

      {/* Add Task Input Row */}
      <form
        className="todo-input-row"
        onSubmit={(e) => {
          e.preventDefault();
          handleAddTodo();
        }}
      >
        <input
          type="text"
          className="todo-input"
          placeholder="Add a new study task..."
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
        />
        <button type="submit" className="todo-add-btn" title="Add Task">
          <PlusIcon size={14} />
        </button>
      </form>

      {/* Task List */}
      <div className="todo-items-list">
        {todos.length === 0 ? (
          <p className="todo-empty-text">No tasks yet. Add one above!</p>
        ) : (
          todos.map((todo) => {
            const isEditing = editingId === todo.id;
            return (
              <div
                key={todo.id}
                className={`todo-item ${todo.completed ? "completed" : ""}`}
              >
                {/* Checkbox box ONLY toggles completed */}
                <span
                  className={`todo-checkbox ${todo.completed ? "checked" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleTodo(todo.id);
                  }}
                  title="Toggle Task Checkbox"
                >
                  {todo.completed && <CheckIcon size={10} />}
                </span>

                {/* Task Text OR Inline Edit Input */}
                {isEditing ? (
                  <input
                    type="text"
                    className="todo-edit-input"
                    value={editingText}
                    autoFocus
                    onChange={(e) => setEditingText(e.target.value)}
                    onBlur={() => handleSaveEdit(todo.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit(todo.id);
                      if (e.key === "Escape") handleCancelEdit();
                    }}
                  />
                ) : (
                  <span
                    className="todo-text"
                    onClick={() => handleStartEdit(todo)}
                    title="Click to edit task title"
                  >
                    {todo.text}
                  </span>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTodo(todo.id);
                  }}
                  className="todo-delete-btn"
                  title="Delete task"
                >
                  <CloseIcon size={12} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

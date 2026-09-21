# Product & Visual Design Philosophies

This document outlines the visual, user experience, interaction, and technical design philosophies established for **Syllex**. All implementation agents and contributors must adhere to these guidelines to ensure consistency, security, and a cohesive study environment.

---

## 1. Visual & UI Design Philosophy: Warm Academic Library

Syllex uses a **Warm Academic Library** aesthetic—a cozy, focused study sanctuary designed to feel natural, non-distracting, and distinguished for college students reading course modules and reviewing flashcards.

### Core Visual Guidelines
- **Theme Palette:**
  - **Structural Containers & Headers:** Deep Forest Green (`#1b3627`) for navigation, headers, and major containers.
  - **Background & Card Surfaces:** Soft Warm Parchment / Cream (`#fbf9f4`) in light mode, Deep Midnight Forest (`#0d1f14`) in dark mode.
  - **Card & Surface Borders:** Uniform Subtle Paper Border (`#e2d9c8` in light mode, `rgba(255,255,255,0.3)` in dark mode).
  - **Accents & Badges:** Warm Gold / Amber (`#d97706` / `#b45309`) for primary actions, active selection states, and file format tags.
  - **Typography Color:** Deep Charcoal (`#262626`) for high legibility and contrast on parchment backgrounds.
- **Typography System:** Full **Academic Serif** typography (`Georgia`, `Garamond`, `Playfair Display`, or system serif) across structural headers, course index cards, book spine elements, buttons, badges, and tree view items.
- **Card & Material Metaphors:** Traditional Library Index Cards and Book Spines featuring subtle uniform paper borders, gold/amber badge accents, and delicate paper elevation shadows (`0 4px 12px rgba(27, 54, 39, 0.08)`).
- **Gradient Shelves:** Shelf containers, header plates, and shelf ledges must use multi-stop linear gradients to evoke physical depth, wood grain, and paper texture rather than flat solid blocks.
- **Subfolder Book Hover Outline:** Hovering over any standing book spine card dynamically outlines the book (`border-color` and glow shadow) in the primary accent color of its containing subfolder (whether customized via color palette or using default forest green/teal).
- **Strict Invariant — No Side Accent Stripes/Borders:** **Never** place accent colors on the sides of block elements or cards (such as colored `border-left` / `border-right` stripes or side accent bars). Block elements, welcome header cards, tree items, and modals must use clean 360-degree uniform border frames to maintain visual symmetry and structural integrity. (This explicitly prohibits side accent stripes such as the amber side border on the welcome card).
- **Strict Iconography Directive:** **Never use emojis** for UI icons, buttons, labels, badges, or tree elements. Always use clean vector SVG icons, CSS glyphs, or explicit typography labels.
- **Density & Layout:** Generous Library Desk spacing, avoiding cramped utility toolbars, while keeping the document reading area centered and uncluttered.

---

## 2. Product & UX Philosophy

### Local-First & Offline Sanctuary
- **Zero Cloud & Zero Telemetry:** The application operates 100% offline. No cloud accounts, remote servers, background telemetry, advertisements, or web dependencies.
- **Fast Native Access:** Immediate startup on desktop with direct access to local course materials.

### Source Immutability & User Control
- **User Directory is Source of Truth:** A user-selected folder (Vault) remains under full user ownership. The application **never** modifies, renames, moves, deletes, or overwrites original course modules (`.pdf`, `.ppt`, `.pptx`, `.md`).
- **Strict Storage Separation:**
  - Derivative files (e.g., PowerPoint to PDF conversion previews, render caches) live exclusively in the OS application cache directory.
  - User settings, reading progress, and flashcards live exclusively in the platform application data SQLite database.

### Document-Centric & Implicit Reading Progress
- **Uncluttered Focus:** The document viewing canvas takes primary hierarchy. Navigation controls recede during active reading.
- **Implicit Resume:** Reading progress is tracked implicitly by remembering the last opened page number per document. Syllex avoids artificial completion percentage bars or forced "Mark as Complete" interactions.

### Graceful Degradation & Non-Intrusive Fallbacks
- **Optional Dependencies:** PowerPoint presentation conversion via headless LibreOffice is an optional preview feature. If LibreOffice is not installed, PDF viewing, Markdown note viewing, and flashcard workflows function normally, and an "Open Original in System App" action is always provided.
- **Clear Explanations:** When external utilities or file conversions are required, explain what is occurring without blocking unrelated application capabilities.

---

## 3. Interaction & Safety Principles

- **Reading Filter Feedback & Visual Polish:** Module viewer toolbars must feature unified height, aligned control groups (page controls, mode toggles, zoom segments), themed custom select dropdowns (no unstyled native white popups), and immediate floating toast notifications when cycling dark mode filters (via keyboard shortcut 'D' or dropdown selection).
- **Defensive Confirmation & Feedback:**
  - Destructive or state-changing UI actions (e.g., deleting decks or modules) must provide clear visual confirmation modals accompanied by non-blocking undo toasts (e.g., 6-second undo window).
  - Bulk data operations (such as CSV flashcard imports) require pre-validation previews displaying valid rows alongside row-specific errors before writing to SQLite.
- **System App Handoff:** Always provide an explicit fallback option to launch any module in its default OS desktop application.

---

## 4. Information Architecture & Technical Boundaries

```text
Application Architecture
├── Frontend (React + TypeScript + Vite)
│   ├── Presentation & User Interaction
│   ├── Academic Serif UI Components & Library Views
│   ├── Document Rendering (PDF.js, Markdown parser)
│   └── Typed Tauri Command Calls (IPC)
└── Native Core (Rust + Tauri 2)
    ├── Vault Directory Scanning & File System Access
    ├── Canonical Path Validation & Security Scope Enforcer
    ├── Headless Subprocess Execution (LibreOffice CLI)
    └── Local Metadata Storage & SQLite Migrations
```

### Architectural Boundaries
- **React Layer:** Responsible exclusively for presentation, component state, user interaction, and document canvas rendering. Does not execute raw filesystem logic or subprocesses directly.
- **Rust Layer:** Responsible for trusted filesystem access, path canonicalization, path scope validation, subprocess management, file watching, and SQLite database migrations.
- **Path Security:** Scoped strictly to directories explicitly authorized by the user. Paths are canonicalized before sensitive operations, and subprocess arguments are passed as structured arrays (never string-interpolated into shell commands).

---

## 5. Developer Handoff Checklist

Before completing any task or delivering code changes to Syllex, verify compliance against this checklist:

1. **Visual System Verification:**
   - [ ] Is the Warm Academic Library theme preserved (Deep Forest Green, Warm Parchment, Warm Gold/Amber, Deep Charcoal)?
   - [ ] Is Academic Serif typography applied to structural UI elements?
   - [ ] Are all icons clean vector SVGs or text labels (no emojis anywhere in the UI)?
2. **Safety & Security Audit:**
   - [ ] Are original user course files guaranteed to remain untouched?
   - [ ] Are native path operations strictly handled in Rust using `Path` and `PathBuf`?
   - [ ] Are path boundaries canonicalized and validated before execution?
3. **Automated Verification Suite:**
   - [ ] `npm run format:check`
   - [ ] `npm run lint`
   - [ ] `npm run typecheck`
   - [ ] `npm run test`
   - [ ] `cargo fmt --check --manifest-path src-tauri/Cargo.toml`
   - [ ] `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`
   - [ ] `cargo test --manifest-path src-tauri/Cargo.toml`
4. **Platform Compatibility:**
   - [ ] Are Linux (Fedora KDE) and Windows 11 impact documented and platform abstraction rules respected?

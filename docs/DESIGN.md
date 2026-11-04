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

### Practical UI Direction

Use the Warm Academic Library palette as the foundation, with the settings interface as the reference for day-to-day controls. The visual language should feel calm and considered, not ornamental. Prefer soft surfaces, fine uniform borders, modest corner radii, clear spacing, and restrained shadows. Use gradients or textures only when they clarify a specific library or bookshelf metaphor; ordinary controls and toolbars should stay clean and quiet.

- **Typography has roles:** Use the application system sans-serif for controls, instructions, labels, navigation, and dense utility information. Reserve Georgia or another academic serif for page titles and selected editorial headings. Do not force serif typography onto every button, badge, tree row, or tool.
- **Controls should feel related:** Use consistent heights, padding, border weights, and focus treatment. Selectable options should resemble compact settings option cards: a soft surface, a fine border, a small radius, and a clear accent border or inset ring when selected. Primary actions should be obvious without being oversized; secondary actions should remain quiet.
- **Color choices should be legible:** Keep color swatches compact and aligned with their surrounding controls. Prefer restrained rectangular chips inside a bordered control over oversized decorative circles. Selection must be distinguishable by border, outline, or another shape treatment, not color alone.
- **Toolbars should scan quickly:** Group related actions, keep labels short, and use muted helper text for instructions. Make room through compact controls and deliberate wrapping instead of squeezing text together. Keep toolbars visually lighter than the document or workspace they serve.
- **Theme consistency matters:** Define corresponding surface, field, border, text, muted-text, accent, and selected-state colors for both light and dark themes. Reuse these roles across components instead of introducing one-off colors. Check contrast and focus visibility in both themes.
- **Prefer restraint over decoration:** Avoid gratuitous pills, thick outlines, prominent shadows, oversized icons, and motion that does not communicate state. Hover feedback should be subtle; selected and pressed states should be clear and persistent.
- **Make compact layouts intentional:** Let controls wrap at narrow widths without clipping. Keep labels and instructions readable, preserve practical click targets, and avoid fixed widths that assume a desktop-sized reader.

When an older visual rule conflicts with these practical patterns, preserve the warm palette and library character while following the cleaner, role-based treatment above. A specific physical metaphor should support the content; it should not be applied indiscriminately to every interface element.

---

## 2. Product & UX Philosophy

### Local-First & Offline Sanctuary
- **Zero Cloud & Zero Telemetry:** The application operates 100% offline. No cloud accounts, remote servers, background telemetry, advertisements, or web dependencies.
- **Fast Native Access:** Immediate startup on desktop with direct access to local course materials.

### Source Immutability & User Control
- **User Directory is Source of Truth:** A user-selected folder (Vault) remains under full user ownership. The application **never** modifies, renames, moves, deletes, or overwrites original course modules (`.pdf`, `.ppt`, `.pptx`, `.md`).
- **Strict Storage Separation:**
  - Derivative files (e.g., PowerPoint to PDF conversion previews, render caches) live exclusively in the OS application cache directory.
  - Selected vault path, reading progress, preferences, and live SQLite databases stay device-local; portable flashcards, companion notes, highlights, and library overrides live in Syllex's managed vault-root directory and travel with manual vault copies. Live databases stay in platform application data.

### Document-Centric & Implicit Reading Progress
- **Uncluttered Focus:** The document viewing canvas takes primary hierarchy. Navigation controls recede during active reading.
- **Implicit Resume:** Reading progress is tracked implicitly by remembering the last opened page number per document. Syllex avoids artificial completion percentage bars or forced "Mark as Complete" interactions.

### Graceful Degradation & Non-Intrusive Fallbacks
- **Optional Dependencies:** PowerPoint presentation conversion via headless LibreOffice is an optional preview feature. If LibreOffice is not installed, PDF viewing, Markdown note viewing, and flashcard workflows function normally. The personal release must provide an "Open Original in System App" fallback.
- **Clear Explanations:** When external utilities or file conversions are required, explain what is occurring without blocking unrelated application capabilities.

---

## 3. Interaction & Safety Principles

- **Reader Controls:** Keep the document title, page controls, reading mode, and a labeled Tools button visible as the reader narrows. Group page previews, highlighting, search, filters, fit-to-width, and zoom in a keyboard-accessible Tools panel with visible focus and accurate pressed states. Keep themed select controls and existing keyboard shortcuts; show immediate floating feedback when cycling reading filters with 'D' or the dropdown.
- **Highlighting Controls:** When the highlighter is active, show labeled color swatches and an Erase option with a visible selected state and a short instruction. Keep each choice available in one click, let the eraser remove a highlight by clicking it on the page, and provide a brief Undo action after saving or erasing.
- **Highlight Placement:** Begin text selection only when the drag starts on a rendered text character. Drags from images, whitespace, or open page areas create a free-area highlight.
- **Current Page Preview:** Mark the active page with a translucent green overlay and a full-edge frame, while keeping its page label and highlight tapes legible.
- **Defensive Confirmation & Feedback:**
  - Destructive or state-changing UI actions (e.g., deleting a deck or hiding a module) must make their effect clear. A module Remove action hides it from Syllex and never deletes its source file.
  - Flashcard imports require a user-chosen question/answer separator, a preview of parsed cards and errors, and confirmation before changing portable card data. The default separator between cards is a newline; multiline content remains an open format decision.
- **Flashcard Sessions:** A separate Flashcards tab supports independent decks, tag-based selection, optional shuffle, and session-only Known/Unknown. End, Restart all, and Retake missed are the end-of-session choices.
- **Companion Notes:** Each module has at most one app-created note. Opening its Notes pane creates the note in the managed vault directory. Show the rendered, directly editable note beside the document by default, with either pane alone and raw Markdown mode available. Autosave visibly and preserve externally changed notes for conflict recovery.
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
    ├── Device-Local SQLite & Migrations
    └── Portable Vault Study Data (Scoped, Atomic Writes)
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

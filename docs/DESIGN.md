# Product Design Constraints

The visual theme has been established to provide a clean, modern, and focused study environment. Implementation agents should adhere to these visual guidelines.

## Initial information architecture

```text
Application
├── Library
│   ├── Courses
│   ├── Recent modules
│   └── Search
├── Viewer
│   ├── Document controls
│   ├── Page content
│   └── Reading progress
├── Flashcards
│   ├── Decks
│   ├── Import
│   └── Review
└── Settings
    ├── Vault
    ├── Viewer
    ├── LibreOffice
    └── Cache
```

## Core workflows

### First launch

1. Explain that the app reads a user-selected folder.
2. Ask the user to select a vault.
3. Scan supported files.
4. Show the library or a useful empty state.

### Open a PDF

1. Select a module.
2. Load the saved page and viewer settings.
3. Render only the pages needed around the viewport.
4. Save progress without altering the PDF.

### Open a presentation

1. Check for a current cached PDF.
2. If absent, check LibreOffice availability and explain conversion.
3. Convert into the application cache.
4. Open the result in the normal viewer.
5. Always retain an Open Original action.

### Import flashcards

1. Select a course or deck destination.
2. Show the required CSV columns and offer an example.
3. Select a file.
4. Validate all rows.
5. Preview valid cards and row-specific errors.
6. Save only after explicit confirmation.

## Interaction principles

- Prefer predictable desktop behavior and keyboard accessibility.
- Never hide a destructive or source-changing action; the MVP should contain none for modules.
- Show progress for scans and conversions that may take noticeable time.
- Errors must explain what the user can do next.
- Missing tools and unsupported files should degrade gracefully.
- Keep the document as the primary focus while viewing.

## Accessibility baseline

- All controls must be keyboard reachable.
- Visible focus indicators are required.
- Do not communicate status through color alone.
- Support text scaling and sensible zoom.
- Label icon-only controls for assistive technology.
- Dark document rendering and interface theme are separate settings.

## Visual Theme Direction: Warm Academic Library

- **Interface Theme:** Warm Academic Library aesthetic (Soft Parchment / Cream for light mode, Deep Midnight Forest `#0d1f14` for dark mode).
- **Color Palette:** 
  - **Primary Structure:** Deep Forest Green (`#1b3627`) headers and structural containers.
  - **Background / Cards:** Warm Parchment / Cream (`#fbf9f4`) with subtle paper borders (`#e2d9c8`).
  - **Accents & Badges:** Warm Gold / Amber (`#d97706` / `#b45309`) for primary actions and file tags.
  - **Typography Color:** Deep Charcoal (`#262626`) for maximum legibility on parchment background.
- **Typography:** Full Academic Serif (`Georgia`, `Garamond`, `Playfair Display`, or serif system font) across headers, course index cards, buttons, and badges.
- **Icon & Card Style:** Traditional Library Index Cards with subtle borders, book/journal badge icons, and paper-card elevation shadows (`0 4px 12px rgba(27, 54, 39, 0.08)`).
- **Density and Spacing:** Generous Library Desk spacing with distinct card margins and clear academic typography hierarchy.
- **Application Logo:** Placeholder styled as a traditional library seal / emblem.

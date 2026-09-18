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

## Visual Theme Direction

- **Interface Theme:** Follow the system theme by default, with explicit overrides (Light/Dark) available in user settings.
- **Color Palette:** Neutral slate/zinc grays for the structure, using a subtle, academic accent color (like muted blue or indigo) to keep focus on the documents.
- **Typography:** Clean, modern sans-serif (e.g., Inter, or system defaults like Segoe UI / San Francisco) for high legibility in UI elements.
- **Icon Family:** Lucide or Radix Icons (clean, modern outline icons that complement the sans-serif typography).
- **Density and Spacing:** Comfortable/Balanced scale (modern web app spacing that provides breathing room while keeping course lists scannable).
- **Application Logo:** Use a simple placeholder for the MVP. A human-made illustration logo will be added in the future.

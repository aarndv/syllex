# Product Design Constraints

The visual theme, color system, icon style, typography, and branding are intentionally undecided. An implementation agent must not establish a permanent visual identity without a separate approved design task.

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

## Deferred visual questions

- Light/dark/system interface theme
- Color palette
- Typography
- Icon family
- Density and spacing scale
- Application logo and broader visual identity

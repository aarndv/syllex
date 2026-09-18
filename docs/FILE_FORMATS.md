# File Formats

## Supported module formats

### MVP

- `.pdf`: displayed directly through PDF.js
- `.ppt` and `.pptx`: converted to a cached PDF through LibreOffice when available

Extension checks are only an initial filter. Inputs remain untrusted and failures must be handled safely.

## Flashcard CSV

The file must be UTF-8 encoded and contain a header row.

Required columns:

- `front`
- `back`

Optional columns:

- `tags`
- `deck`

Example:

```csv
front,back,tags,deck
"What is encapsulation?","Restricting direct access to an object's internal state.","oop,module-1","OOP Fundamentals"
"What does SQL mean?","Structured Query Language","database,module-2","Database Basics"
```

## Import behavior

- Column order may vary, but required headers must exist exactly once.
- Blank `front` or `back` values are errors.
- Quoted commas and line breaks must follow normal CSV parsing rules.
- Unknown columns should be reported and ignored only after confirmation.
- Duplicate handling must be shown in the preview; do not silently remove cards.
- Report errors with row numbers.
- Do not partially import before the user confirms the preview.

## Future portable export

An explicit versioned JSON format may later carry decks, progress, and bookmarks between devices. Do not use a synchronized live SQLite file as an interchange format.

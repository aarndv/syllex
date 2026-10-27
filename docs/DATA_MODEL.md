# Data Model

This is an initial logical model, not a final migration. All schema changes must use versioned migrations.

## Ownership rule

SQLite stores application metadata and user-created study data. Original documents remain external files referenced by validated paths and file identity metadata.

## Proposed entities

### vaults

- `id`
- `root_path`
- `display_name`
- `created_at`
- `last_opened_at`

The root path is device-specific and must not be assumed portable.

### courses

- `id`
- `vault_id`
- `relative_path`
- `display_name`
- `created_at`
- `updated_at`

### modules

- `id`
- `course_id`
- `relative_path`
- `file_type`
- `size_bytes`
- `modified_at`
- `content_fingerprint`
- `last_seen_at`

Prefer paths relative to the vault when referencing module files.

### reading_progress

- `module_id`
- `last_page`
- `zoom`
- `scroll_position`
- `last_opened_at`

### bookmarks

- `id`
- `module_id`
- `page_number`
- `label`
- `created_at`

Bookmarks are post-MVP unless reprioritized.

### highlights (issue #10)

Stored in a versioned `highlights.sqlite3` database under platform application data.

- `id` — unique highlight action
- `document_path` — canonical path of the validated module (updated on in-app rename)
- `page_number`
- `color` — one of the supported palette values
- `rects_json` — one or more normalized page rectangles; wrapped text remains one action
- `created_at`

This metadata contains no PDF bytes or selected text. The first migration uses SQLite `user_version = 1`. Generated thumbnails are disposable viewer renderings and are never stored in this table.

### flashcard_decks

- `id`
- `course_id`
- `name`
- `created_at`
- `updated_at`

### flashcards

- `id`
- `deck_id`
- `front`
- `back`
- `tags`
- `ease_factor`
- `interval`
- `next_review_at`
- `created_at`
- `updated_at`

### review_history

- `id`
- `flashcard_id`
- `rating`
- `reviewed_at`
- `next_review_at`
- `algorithm_version`

### conversion_cache

- `module_id`
- `source_fingerprint`
- `cached_relative_path`
- `created_at`
- `converter_version`

Cached files are disposable even when their metadata is recorded.

### settings

- `key`
- `value`
- `updated_at`

Settings keys and value formats must be documented before use.

The current webview settings object includes `pageSidebarVisible` (boolean), `pageSidebarDock` (`left` or `right`), `pageSidebarWidth` (100–220 pixels), `thumbnailScale` (0.7–1.4), and `pageSidebarLayoutVersion` (2). On first load of this compact layout, the earlier default widths of 170 or 220 pixels become 110 pixels; other saved widths are clamped to the new range. These viewer preferences follow the existing settings object until the planned SQLite settings migration.

## Migration rules

- Every schema change receives a new forward migration.
- Migrations must run transactionally when supported.
- Test upgrades from the previous released schema.
- Never edit a released migration to change history.
- Back up or recover gracefully when a migration cannot complete.

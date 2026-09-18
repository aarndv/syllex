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

## Migration rules

- Every schema change receives a new forward migration.
- Migrations must run transactionally when supported.
- Test upgrades from the previous released schema.
- Never edit a released migration to change history.
- Back up or recover gracefully when a migration cannot complete.

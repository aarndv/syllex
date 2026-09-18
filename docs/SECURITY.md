# Security and Privacy

## Trust boundaries

Treat these as untrusted:

- User-selected directories
- Document files and metadata
- CSV imports
- Filenames and paths
- LibreOffice output
- Database contents loaded after an interrupted update

## Filesystem rules

- Grant access only to a directory the user selected.
- Use read-only operations for source modules.
- Canonicalize paths and ensure requested files remain within the selected vault.
- Defend against `..`, symlink, junction, and race-condition path escapes.
- Put generated files in the application cache.
- Require explicit confirmation before clearing user-created data.

## Subprocess rules

- Invoke LibreOffice directly without a shell.
- Pass every argument separately.
- Use an application-controlled output directory.
- Apply reasonable timeouts and cancellation behavior.
- Validate exit status and expected output type.
- Never execute macros or arbitrary commands from a document.

## Database rules

- Use parameterized queries.
- Apply migrations transactionally.
- Keep the database in platform application data.
- Do not place secrets in SQLite.
- Do not sync the live database through generic file synchronization.

## Privacy rules

- No telemetry or analytics by default.
- No network requests are required for core functionality.
- Do not upload module content, filenames, flashcards, or usage history.
- Logs must avoid document content and unnecessary absolute paths.

## Dependency rules

- Prefer maintained dependencies with a clear license.
- Record major dependency decisions.
- Commit lockfiles.
- Review security advisories before releases.
- Do not add a dependency for functionality that the platform or existing stack already provides adequately.

## Reporting

Until a public reporting channel exists, security findings should be documented privately with reproduction steps and affected versions. Do not publish sensitive exploit details in a public issue.

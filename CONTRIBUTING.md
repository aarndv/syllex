# Contributing

## Workflow

1. Select one item from `docs/ROADMAP.md` or create a narrowly scoped issue.
2. Write acceptance criteria before implementation.
3. Create a focused branch.
4. Make the smallest coherent change.
5. Run the relevant checks listed in `AGENTS.md`.
6. Review the diff manually, especially filesystem and subprocess code.
7. Update documentation and the decision log when applicable.

## Commit guidance

Use short, imperative commit messages, for example:

```text
Scaffold Tauri application
Add read-only vault scanner
Validate flashcard CSV headers
```

Do not mix formatting-only changes with functional changes unless formatting is the task.

## Pull requests

A pull request should explain:

- What changed and why
- What was intentionally left out
- How it was tested
- Linux and Windows considerations
- Any new dependency or architecture decision
- Known limitations

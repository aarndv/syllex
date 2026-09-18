# AI-Assisted Development Workflow

## Purpose

AI agents may propose and implement work, but repository documentation and reviewed code remain authoritative. Each task should be small enough for the owner to understand and verify.

## Before the first agent prompt

1. Read and edit the documentation until it reflects the intended product.
2. Resolve any product question that would materially change the first milestone.
3. Initialize Git.
4. Commit this documentation as a clean baseline.
5. Confirm the working tree is clean.


Suggested commands:

```bash
git init
git add .
git commit -m "Establish project requirements and agent rules"
```

## Prompt structure

Every implementation prompt should contain:

- One goal
- In-scope behavior
- Explicit exclusions
- Acceptance criteria
- Required verification
- Instruction to follow `AGENTS.md`

Avoid prompts such as “build the whole application.”

## Recommended first prompt

```text
Read AGENTS.md, README.md, and every file under docs/ before making changes.

Implement only milestone M1 from docs/ROADMAP.md: scaffold a Tauri 2 application using React, TypeScript, and Vite in this repository.

Configure formatting, linting, TypeScript checking, a minimal frontend test, and the standard Rust format/Clippy/test workflow. Add a GitHub Actions matrix that verifies Linux and Windows builds. Keep the starter interface structurally minimal and accessible.

Do not implement vault access, PDF viewing, SQLite, LibreOffice conversion, flashcards, a design system, or a final visual theme.

Before editing, report any conflict between the requested scaffold and the repository documents. After editing, run the relevant checks from AGENTS.md and report changed files, test results, and limitations.
```

## Review after every agent task

1. Read the agent summary, but do not rely on it alone.
2. Inspect `git status` and the complete diff.
3. Check for new dependencies and unexplained generated files.
4. Run the verification commands yourself.
5. Launch the relevant workflow manually.
6. Confirm source modules and unrelated files were not touched.
7. Commit only after the change is understood.

Useful commands:

```bash
git status --short
git diff --stat
git diff
```

## Prompt and decision records

Keep durable product decisions in `docs/DECISIONS.md`, not only in chat history. If required for coursework, keep a separate prompt log containing the exact prompt, agent response, accepted changes, rejected suggestions, and verification performed.

Never commit secrets, private module contents, or personal absolute paths into a prompt log.

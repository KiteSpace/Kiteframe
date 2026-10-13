---
name: Dependency remediation constraints
description: Version alignment and the reasoning for the guarded brace-parser replacement
---

The upstream braces package had no release fixing recursive stack exhaustion. Prefer a reviewed, guard-only API-compatible replacement over removing Tailwind or rewriting glob consumers.

**Why:** All normal brace expansion behavior is needed by both the application's CSS toolchain and the mockup discovery toolchain. The replacement limits parser nesting and each recursive AST walker rather than merely changing the package identity.

**How to apply:** When revisiting the replacement, verify both ordinary patterns and deeply nested braces/parentheses in both dependency roots. An upstream version is preferable once it actually fixes the issue.

Keep the Vitest runner, UI, and optional browser packages on a matched, maintained release.

**Why:** Optional browser peer dependencies can pull in incompatible newer Vitest packages even when the runner itself is pinned, causing npm peer-resolution failures.

**How to apply:** Resolve version mismatches rather than disabling peer validation with force or legacy-peer-deps.

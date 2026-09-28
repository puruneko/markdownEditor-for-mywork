<!--
ISSUE TEMPLATE (structure is English per LANGUAGE_POLICY §5).
Actual Issues are authored in Japanese (LANGUAGE_POLICY §2):
render the Japanese equivalents of these headings when writing an Issue.

Three parts, in this order:
  1. Problem & Direction      → FOR HUMANS
  2. Progress & Impl. Notes   → FOR AI
  3. Metadata                 → machine fields, LAST

Keep it short. No filler. Put metadata last.
-->

# <Title>

## 1. Problem & Direction  — FOR HUMANS

### What this Issue solves
State the problem in full: background, the current pain, and the goal.
DO NOT abbreviate this part. The reason the Issue exists must be clear
from this section alone.

### Direction
The latest agreed approach. Key points only. Update as it evolves.

### Existing behavior removed or changed
List any existing, currently-working behavior that this Issue will remove
or change. If none, write "None". This section exists because past Issues
have silently removed behavior the user still relied on (e.g. removing a
display that coexisted with a new toggle, instead of keeping both).

### Implementer's unconfirmed interpretation
List any part of the requirement that was ambiguous, where the
implementer had to choose one interpretation among several plausible
ones. If none, write "None". If this section is non-empty, the Issue
must not be closed until the user has confirmed the interpretation.

---

## 2. Progress & Implementation Notes  — FOR AI

### TODO
- [ ] ...

### Notes
Technical decisions, scope, target files, gotchas. Append as needed.

### History (append-only)
Use the History format defined in WORKFLOW.md §3. Newest entries at the bottom.

- YYYY-MM-DD — ...

---

## 3. Metadata
- id: issue-phase<PPP>-<NNN>__<kebab-title>
- status: open | proposed | approved | closed   (AI may only move open → proposed)
- phase: <PPP>
- related_specs:
- related_decisions:
- target_files:
- created: YYYY-MM-DD
- updated: YYYY-MM-DD

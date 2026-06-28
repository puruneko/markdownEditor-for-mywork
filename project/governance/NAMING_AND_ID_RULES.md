# NAMING_AND_ID_RULES.md

This file defines deterministic naming and numbering.
AI must follow these rules exactly.

No creativity allowed.

---

## 1. ISSUE ID ASSIGNMENT

### Format

```text
issue-phase<PPP>-<NNN>__<kebab-title>
```

- `phase<PPP>` — the roadmap phase the Issue belongs to. 3-digit, zero-padded.
  Phase 0 → `phase000`, Phase 1 → `phase001`, etc.
  If the Issue belongs to no roadmap phase, use `phase000`.
- `<NNN>` — sequence number WITHIN that phase. 3-digit, zero-padded.
  Reset per phase. The first Issue of a phase is `001`.
- `<kebab-title>` — short English kebab-case slug.

The `id` field inside the Issue MUST equal the filename stem.

Example:

```text
issue-phase001-012__assemble-task-filter
```

### Assignment steps (new Issue)

1. Determine the phase → `PPP`.
2. Scan `project/issues/` for files matching `issue-phase<PPP>-*`.
3. Take the highest `<NNN>` in that phase, then +1. If none exists, start at `001`.
4. Zero-pad both numbers to 3 digits.

### Rules

- Never reuse or skip a number within a phase.
- Sequences are independent per phase.
- Legacy IDs (`NNNN`, `obs-*`) are NOT renamed (see §5).
  This format applies to Issues created from now on.

---

## 2. DECISION ID ASSIGNMENT

Same rule applied to `project/decisions/`.

Issues and Decisions have independent sequences.

---

## 3. SPEC FILE NAMING

Specs are NOT numbered.

They must use stable semantic names:

```text
calendar-rendering.spec.md
task-resizing.spec.md
```

Because specs describe domains, not tasks.

---

## 4. BR (BEHAVIOR RULE) NUMBERING INSIDE SPECS

Behavior rules must use:

```text
BR-001
BR-002
```

These numbers never change once published.
If removed, mark as deprecated instead of renumbering.

---

## 5. NO RENAMES POLICY

Once created, these identifiers are permanent:

* Issue filename
* Spec filename
* Decision filename
* BR numbers

If meaning changes → create a new artifact.

---

## 6. STATUS FIELD IS THE ONLY MUTABLE CLASSIFIER

AI may update:

* status
* updated date
* implementation notes

AI must NOT rewrite titles or redefine scope.

---

## 7. TRACEABILITY REQUIREMENT

Every change must form a chain:

Issue → Spec → Decision → Code → Tests

If any link is missing, AI must STOP and ask.

---

## PRINCIPLE

Predictability beats readability.
Stable identifiers are more important than elegance.

# SPEC TEMPLATE (STRUCTURE IS IMMUTABLE)

This template defines the authoritative specification format.
All specifications inside `project/specs/` must follow this structure exactly.

Specifications describe REQUIRED SYSTEM BEHAVIOR.
They are not design documents, not discussions, and not change logs.

---

## FILENAME RULE

```id="f4j8sk"
domain-name.spec.md
```

Examples:

```id="3x7p2d"
calendar-rendering.spec.md
task-dragging.spec.md
authentication-flow.spec.md
```

* Must use kebab-case.
* Filename must remain stable across its lifetime.
* Versioning is handled by Git history, not filenames.

---

## HEADER METADATA (REQUIRED)

```yaml id="m9q1zt"
title: Human readable title
status: active
owner: unassigned
created: YYYY-MM-DD
updated: YYYY-MM-DD
related_issues: []
related_decisions: []
```

### Allowed status values:

* draft
* active
* deprecated

AI must not introduce new values.

---

## 1. PURPOSE

Explain WHY this behavior exists from a user or business perspective.

Must NOT describe implementation.

---

## 2. SCOPE

Define what this spec governs.

Explicitly list:

* Included behavior
* Excluded behavior

Example:

```id="z0mv1g"
Includes:
- Task horizontal movement

Excludes:
- Vertical reordering
```

This prevents AI from expanding scope.

---

## 3. DEFINITIONS

Define domain terminology used in this spec.

Example:

```id="y7w8dl"
Task: A schedulable unit with start/end.
Appointment: A fixed, non-draggable time block.
```

AI must use these meanings precisely.

---

## 4. BEHAVIORAL REQUIREMENTS (CORE SECTION)

Describe required behavior using observable rules.

Each rule must be written as:

```id="8kq2lm"
BR-001 Description of behavior.
BR-002 Description of behavior.
```

Rules must be:

* testable
* implementation-independent
* unambiguous
* atomic (one behavior per rule)

---

## 5. NON-BEHAVIORAL CONSTRAINTS

Performance, UX constraints, or business rules.

Example:

* Must not require page reload
* Must operate within visible grid only

---

## 6. STATE MODEL (IF APPLICABLE)

Describe allowed states and transitions.

Example:

```id="2a1vhs"
open → in-progress → closed
blocked → open (allowed)
closed → open (forbidden)
```

Avoid diagrams; describe textually for AI parsing.

---

## 7. EDGE CONDITIONS

Define how the system behaves under boundaries.

Example:

* Drag beyond grid → clamp to max column
* Missing date → inherit from parent

This section prevents AI from inventing fallback logic.

---

## 8. OUT OF SCOPE (MANDATORY)

Explicitly list what must NOT be implemented.

AI must treat this as a hard prohibition list.

---

## 9. VERIFICATION METHOD

Explain how compliance is validated.

Example:

* Functional test validates BR-001〜BR-010
* E2E verifies user drag scenario

This connects spec to TESTING_STANDARD.md.

---

## 10. CHANGE CONTROL

Rules for modifying this spec:

* Changes must reference an Issue.
* Direct edits without Issue linkage are forbidden.
* AI must not extend spec silently.

---

## AI INTERPRETATION RULE

If any behavior is not written in this document,
it does not exist.

Absence of description = prohibition.

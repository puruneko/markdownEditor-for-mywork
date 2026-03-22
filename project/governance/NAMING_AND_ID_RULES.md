# NAMING_AND_ID_RULES.md

This file defines deterministic naming and numbering.
AI must follow these rules exactly.

No creativity allowed.

---

## 1. ISSUE ID ASSIGNMENT

When creating a new Issue:

1. Scan `project/issues/`
2. Find the highest existing ID
3. Increment by +1
4. Zero-pad to 4 digits

Example:

```text
0007 → next is 0008
```

AI must never reuse or skip IDs.

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

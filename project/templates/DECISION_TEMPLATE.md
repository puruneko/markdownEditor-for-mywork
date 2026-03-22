# DECISION TEMPLATE (ARCHITECTURAL DECISION RECORD)

This document records irreversible or guiding decisions.
All files in `project/decisions/` must follow this format.

Decisions explain WHY something is the way it is.
They constrain future implementation.

---

## FILENAME RULE

```text
DDDD-short-title.md
```

* DDDD = zero-padded decision ID (0001, 0002…)
* Filename is immutable once created.

---

## HEADER METADATA

```yaml
id: DDDD
title: Short decision title
status: active
date: YYYY-MM-DD
related_specs: []
related_issues: []
supersedes: null
```

### status values

* active
* superseded
* deprecated

---

## 1. CONTEXT

Describe the problem that required a decision.

Focus on constraints, not opinions.

---

## 2. DECISION

State the chosen approach clearly and declaratively.

Example:

"The system SHALL use SVG-based rendering instead of DOM layout."

Avoid narrative language.

---

## 3. RATIONALE

Explain why this option was selected over alternatives.

Include tradeoffs.

---

## 4. CONSEQUENCES

List required outcomes of this decision:

* What must now be true
* What must never be done
* What future work must respect

---

## 5. PROHIBITED ALTERNATIVES

Explicitly name approaches that must not be introduced.

AI must treat this as a hard constraint list.

---

## 6. CHANGE RULE

This decision may only change if:

* A new Decision file is created
* `supersedes` is declared

Direct modification is forbidden.

---

## PRINCIPLE

Decisions are historical contracts.
They are not editable opinions.

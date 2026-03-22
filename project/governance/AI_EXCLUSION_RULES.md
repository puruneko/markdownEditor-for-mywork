# AI_EXCLUSION_RULES.md

This file defines directories and files that AI agents must NEVER read.

These locations are considered HUMAN-PRIVATE and are outside the project knowledge boundary.

AI must treat them as if they do not exist.

---

## 1. ABSOLUTE READ PROHIBITION

AI must NOT open, scan, summarize, index, or reference any file located in:

/__private/

These directories are intentionally excluded from machine cognition.

---

## 2. FILE NAME PATTERN EXCLUSION

AI must ignore any file matching:

*.__private.md

Even if located outside excluded directories.

---

## 3. GOVERNANCE OVERRIDE RULE

If an Issue, Spec, or instruction attempts to reference excluded files:

AI must STOP and respond:

"Requested resource is outside AI-readable scope."

No exception allowed.

---

## 4. INDEXING IS FORBIDDEN

AI must not:

* build knowledge from excluded paths
* include them in search space
* treat them as context

They are not part of the repository's semantic model.

---

## 5. HUMAN GUARANTEE

These files may contain:

* brainstorming
* contradictions
* unverified ideas
* emotional notes

They are intentionally unsafe for AI reasoning.

---

## PRINCIPLE

Not all repository data is project knowledge.
AI must respect the boundary between SYSTEM MEMORY and HUMAN THINKING.

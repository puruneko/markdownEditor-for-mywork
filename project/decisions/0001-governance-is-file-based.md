id: 0001
title: Governance is file-based and repository-native
status: active
date: 2026-02-22
related_specs: [system-baseline.spec.md]
related_issues: [0001-initialize-project-structure.md]
supersedes: null

---

## 1. CONTEXT

AI-assisted development requires deterministic, inspectable state.
External tools introduce non-versioned decision paths.

---

## 2. DECISION

All governance, planning, and specification SHALL exist as files inside the repository.

No external issue trackers are authoritative.

---

## 3. RATIONALE

Git provides:

* history
* traceability
* reproducibility

This aligns AI execution with verifiable context.

---

## 4. CONSEQUENCES

* Repository becomes the single project memory.
* SaaS tools may mirror but never replace repository truth.

---

## 5. PROHIBITED ALTERNATIVES

* Treating GitHub Issues as source of truth
* Storing requirements outside the repo
* Allowing AI to rely on conversational memory

---

## 6. CHANGE RULE

Any shift away from file-based governance requires a superseding Decision.

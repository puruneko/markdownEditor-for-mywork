# TESTING_STANDARD.md

Testing is not validation.
Testing is SPECIFICATION ENFORCEMENT.

---

## TEST CATEGORIES

Functional Tests = behavioral contract verification
E2E Tests = user-scenario verification

Both are mandatory always.

---

## CORE RULE

If code changed → ALL tests must run.
No confirmation step allowed.

---

## WHAT TESTS MUST NOT DO

* Depend on internal structure
* Validate implementation details
* Use snapshots as truth
* Simulate behavior artificially

---

## WHAT E2E MUST DO

Reproduce real user interaction only.
Validate outcomes, never mechanics.

---

## FAILURE HANDLING

Failing test = implementation incomplete.

Do not weaken tests.
Fix the system.

---

## COMPLETION CRITERIA

## A feature exists only when tests prove it exists.

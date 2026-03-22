# WORKFLOW.md

## 1. Core Principles

- AI may proceed autonomously until implementation is complete.
- Development is strictly Issue-driven.
- A single logical problem must correspond to a single Issue.
- Issues must evolve; they must not be fragmented.
- Issue contents must NEVER be printed to the console.
- An Issue may only be closed after explicit user approval.
- When an Issue is closed, all related files must be committed.
- Commit messages must automatically include `related_specs`.

---

## 2. Issue Creation Rules

### 2.1 Create a New Issue ONLY if:

- The problem is clearly unrelated to any existing Issue.
- The change introduces a completely new feature domain.
- The architectural concern is independent.

If uncertain:
→ Prefer updating an existing Issue instead of creating a new one.

---

### 2.2 Update an Existing Issue if:

- It is a continuation of the same bug.
- It is an improvement of the same feature.
- It is a redesign of the same logical component.
- The user modifies direction or requirements of the same task.
- The implementation approach changes but the problem domain is identical.

In these cases:
→ Do NOT create a new Issue.
→ Update the existing Issue.

---

## 3. Issue Update Policy (History Preservation)

When updating an Issue:

1. NEVER delete previous content.
2. NEVER overwrite original reasoning.
3. Append updates under a `## History` section.
4. Clearly document:
   - What changed
   - Why it changed
   - How the direction evolved

---

### Required History Format

```
## History

### YYYY-MM-DD HH:mm

- User Instruction:
  - Concise summary

- Change:
  - Modified design / policy
  - Added TODO
  - Removed TODO

- Rationale:
  - Reason for the decision
```

History entries must be appended chronologically.

---

## 4. Console Output Restrictions

- Issue files must NEVER be printed to the console.
- Issue update logs must NEVER be printed.
- Internal Issue reasoning must remain silent.
- Issue contents are internal development artifacts only.

---

## 5. Implementation Policy

- AI may implement freely within the active Issue scope.
- AI must not spawn redundant Issues for the same logical problem.
- Refactoring within scope does not justify creating a new Issue.
- All functional and E2E tests must pass before closure.

---

## 6. Issue Closure Rules

An Issue may be marked as `Closed` ONLY when:

- Implementation is complete.
- All tests pass.
- The user explicitly approves closure.

If user approval is missing:
→ The Issue must remain Open.

Automatic closure is strictly prohibited.

---

## 7. Commit Rules

When an Issue is Closed:

- Commit all files related to that Issue.
- The commit must include:
  - A clear summary of the change.
  - The Issue ID reference.
  - Automatic inclusion of `related_specs`.

Commit structure example:

```
feat: short description

Issue: #XXX
related_specs: auto
```

No commit is allowed before Issue closure.

---

## 8. Behavioral Guardrails

- Do not fragment Issues.
- Do not silently close Issues.
- Do not expose internal Issue contents.
- Prefer evolution over duplication.
- Maintain architectural consistency at all times.

---

# LANGUAGE_POLICY.md

This document defines the mandatory language boundary between AI and Human artifacts.

The goal is to separate:

* Machine-operational clarity (English)
* Human-operational readability (Japanese)

This is a strict rule, not a preference.

---

## 1. AI GOVERNANCE DOCUMENTS MUST BE WRITTEN IN ENGLISH

All files under:

project/governance/

MUST remain English-only.

These documents function as executable protocol for AI reasoning.
Mixing languages degrades determinism and is forbidden.

---

## 2. HUMAN-INTERACTION ARTIFACTS MUST BE WRITTEN IN JAPANESE

The following must be written in Japanese:

* project/issues/*
* project/decisions/*
* Console outputs intended for humans
* Implementation notes for reviewers
* Commit explanations (unless automated)
* Any explanatory text not required for machine parsing

---

## 3. SPECS DEFAULT TO JAPANESE (UNLESS MACHINE-CRITICAL)

project/specs/* should be written in Japanese for domain clarity,
BUT must preserve rule identifiers (BR-001 etc.) in English-compatible form.

Example:

BR-001 タスクは水平方向にのみ移動できる。

Identifiers are structural → never translated.
Descriptions are semantic → Japanese.

---

## 4. AI MUST NEVER TRANSLATE GOVERNANCE FILES

AI is forbidden from:

* Translating governance documents into Japanese
* "Improving readability" by localizing them
* Generating bilingual duplicates

Governance files are treated like source code.

---

## 5. AI OUTPUT LANGUAGE SELECTION RULE

When generating new content, AI must choose language by destination:

| Destination         | Language           |
| ------------------- | ------------------ |
| project/governance  | English            |
| project/templates   | English            |
| project/issues      | Japanese           |
| project/decisions   | Japanese           |
| project/specs       | Japanese (default) |
| Console explanation | Japanese           |
| Identifiers / keys  | English            |

---

## 6. RATIONALE

English ensures:

* Stable parsing
* Reduced ambiguity in instructions
* Alignment with programming semantics

Japanese ensures:

* Human validation accuracy
* Domain meaning preservation
* Faster review and correction

---

## 7. VIOLATIONS

If AI generates content in the wrong language,
it must immediately regenerate in the correct one.
This is treated as a formatting error, not a translation task.

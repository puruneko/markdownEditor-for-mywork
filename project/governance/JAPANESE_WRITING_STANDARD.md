# JAPANESE_WRITING_STANDARD.md

This document defines how Japanese must be written so AI can interpret it deterministically.

Natural Japanese is ambiguous.
This standard restricts expression to eliminate interpretation variance.

---

## 1. SENTENCE STRUCTURE MUST BE DECLARATIVE

Each rule must follow:

<Subject> は <Constraint / Behavior> しなければならない。

or

<Subject> は <Constraint / Behavior> してはならない。

Example:

タスクは水平方向にのみ移動しなければならない。
タスクは垂直方向へ移動してはならない。

Avoid descriptive tone.

---

## 2. ONE SENTENCE = ONE RULE

Do NOT combine conditions.

❌ 悪い例:

タスクはドラッグでき、端に達した場合は止まる。

✅ 正しい:

BR-004 タスクはドラッグできなければならない。
BR-005 タスクは端を超えて移動してはならない。

---

## 3. SUBJECT MUST BE EXPLICIT

Japanese often omits subjects. This is forbidden.

❌ 禁止:

移動できる。

✅ 必須:

タスクは移動できなければならない。

AI must never guess the actor.

---

## 4. NO SOFT EXPRESSIONS

The following words are prohibited because they imply suggestion:

* できれば
* 望ましい
* 基本的に
* 通常
* なるべく
* 必要に応じて
* 柔軟に
* 適切に

Replace with strict requirement language.

---

## 5. NO IMPLICIT CONDITIONS

All conditions must be written explicitly using:

場合は
ときは
のみ
限り

Example:

開始日時が未設定の場合は、親タスクの最小日時を使用しなければならない。

---

## 6. MUST / MUST NOT MAPPING

Japanese phrasing must map clearly:

| Japanese           | Meaning  |
| ------------------ | -------- |
| しなければならない | MUST     |
| してはならない     | MUST NOT |
| のみ               | ONLY     |
| 常に               | ALWAYS   |

Avoid other modal forms.

---

## 7. EXAMPLES MUST NOT DEFINE BEHAVIOR

Examples illustrate but must not introduce new rules.

❌ Example that adds meaning → forbidden.

---

## 8. NO SYNONYMS FOR DOMAIN TERMS

Once defined in DEFINITIONS, the same word must be reused.

Example:

「予定」「イベント」「アポイント」を混在させてはならない。
Use exactly one defined term.

---

## 9. EDGE CASES MUST USE FORMAL PATTERN

境界条件は次の形式で書く:

<Condition> の場合は <Result> しなければならない。

Example:

表示範囲外へ移動した場合は、最大列に固定しなければならない。

---

## 10. AI INTERPRETATION RULE

If Japanese text violates this standard,
AI must STOP and request clarification instead of guessing.

---

## PRINCIPLE

This is not Japanese for humans.
This is a controlled language for machines written using Japanese vocabulary.

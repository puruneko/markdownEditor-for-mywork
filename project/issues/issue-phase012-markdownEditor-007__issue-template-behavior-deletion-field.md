# Issue テンプレートに「削除・変更される既存の振る舞い」と「実装側の未確認の解釈」欄を追加する

## 1. Background（背景）

`修正したい箇所.md` の入力とは直接対応しないが、今回の一連の要望（phase012）を分析した結果、次のような問題が繰り返し発生していたことが判明した。

- calendar-for-mywork の週表示で、「タスク名と親階層名を切り替えられるように」という要望に対し、実装側が「排他的な切り替え」と解釈し、既存の「タスク名の上に親階層名を併記する」という表示を明確に削除した。ユーザーはこれを問題視し、「タスク表示の際は親階層を表示する」という追記で差し戻すことになった。
- `markdownEditor-for-mywork` のメタ情報表示で、「＠を消す」という実装が行われた後、ユーザーが「＠は消さないで」と追記して差し戻すことになった。
- `ganttchart-for-mywork` の案件名オーバーレイで、「背景色を付けて読みやすくする」という実装側の判断がなされたが、ユーザーからは「浮いている」という指摘を受けた。
- `kanban-for-mywork` の最小化ハンドルで、「左矢印カーソル」という要望に対し、CSS標準に単方向の矢印キーワードが存在しないため実装側が `w-resize`（双方向矢印）を採用したが、ユーザーの意図とは異なる見た目になった。

これらはいずれも、**要望の曖昧な部分を実装側が独自に解釈・確定し、その解釈や、それによって変更・削除される既存の振る舞いが、実装前にユーザーへ明示的に確認されなかったために生じた手戻り**である。

このリポジトリ（markdownEditor-for-mywork）の `project/templates/ISSUE_TEMPLATE.md` および `project/governance/WORKFLOW.md` には、既に「Haiku が実装できる詳細度」を求める §2.4（`WORKFLOW.md`）などの厳格な規定があるが、**「この変更によって、どの既存の振る舞いが削除・変更されるか」を明記する欄、および「要望の曖昧な部分を実装側がどう解釈したか（ユーザー未確認）」を明記する欄は存在しない。**

## 2. Objective（目的）

Issue テンプレートに、上記2種類の情報を記録するための欄を追加し、実装前にこれらの欄が空でない場合はユーザーへの確認を促す運用ルールを `WORKFLOW.md` に追記する。

## 3. Scope（スコープ）

- `project/templates/ISSUE_TEMPLATE.md` への欄の追加。
- `project/governance/WORKFLOW.md` への運用ルールの追記。
- 対象外: 既存の Issue ドキュメント（`project/issues/` 配下）の遡及的な修正。他リポジトリのテンプレート（それぞれ別 issue で対応する）。

## 4. Implementation requirements（実装要件）

### 4.1 `project/templates/ISSUE_TEMPLATE.md` の変更

現在のファイル内容は次のとおり（全文）。

```markdown
<!--
ISSUE TEMPLATE (structure is English per LANGUAGE_POLICY §5).
Actual Issues are authored in Japanese (LANGUAGE_POLICY §2):
render the Japanese equivalents of these headings when writing an Issue.

Three parts, in this order:
  1. Problem & Direction      → FOR HUMANS
  2. Progress & Impl. Notes   → FOR AI
  3. Metadata                 → machine fields, LAST

Keep it short. No filler. Put metadata last.
-->

# <Title>

## 1. Problem & Direction  — FOR HUMANS

### What this Issue solves
State the problem in full: background, the current pain, and the goal.
DO NOT abbreviate this part. The reason the Issue exists must be clear
from this section alone.

### Direction
The latest agreed approach. Key points only. Update as it evolves.

---

## 2. Progress & Implementation Notes  — FOR AI

### TODO
- [ ] ...

### Notes
Technical decisions, scope, target files, gotchas. Append as needed.

### History (append-only)
Use the History format defined in WORKFLOW.md §3. Newest entries at the bottom.

- YYYY-MM-DD — ...

---

## 3. Metadata
- id: issue-phase<PPP>-<NNN>__<kebab-title>
- status: open | proposed | approved | closed   (AI may only move open → proposed)
- phase: <PPP>
- related_specs:
- related_decisions:
- target_files:
- created: YYYY-MM-DD
- updated: YYYY-MM-DD
```

`## 1. Problem & Direction  — FOR HUMANS` セクション内、`### Direction` の直後（`---` の前）に、次の2つの新しいサブセクションを追加する。

```markdown
### Existing behavior removed or changed
List any existing, currently-working behavior that this Issue will remove
or change. If none, write "None". This section exists because past Issues
have silently removed behavior the user still relied on (e.g. removing a
display that coexisted with a new toggle, instead of keeping both).

### Implementer's unconfirmed interpretation
List any part of the requirement that was ambiguous, where the
implementer had to choose one interpretation among several plausible
ones. If none, write "None". If this section is non-empty, the Issue
must not be closed until the user has confirmed the interpretation.
```

### 4.2 `project/governance/WORKFLOW.md` の変更

`## 6. Issue Closure Rules` セクション（148行付近）を確認し、その中に次の趣旨の項目を追記する（既存の記述の削除は行わず、追記のみとする）。

- Issue の `Existing behavior removed or changed` または `Implementer's unconfirmed interpretation` のいずれかが空でない場合、実装完了後の受け入れ確認として、変更前後を比較できるスクリーンショットをユーザーに提示し、明示的な承認を得てから Issue をクローズすること。

具体的な追記文言・挿入位置の細部（既存の箇条書きスタイルに合わせる等）は実装者の判断でよいが、既存の規定を削除・上書きしないこと（`WORKFLOW.md` §3「History Preservation」の精神に従う）。

## 5. Files / components likely to be changed（変更が見込まれるファイル／コンポーネント）

- `project/templates/ISSUE_TEMPLATE.md`
- `project/governance/WORKFLOW.md`

## 6. Dependencies（依存関係）

- 前提条件: 他の4リポジトリ（calendar / gantt / kanban / dashboard）の未コミットの作業ツリーが、プロジェクト管理者によってベースラインとしてコミットされていること。
- このリポジトリ内での依存: なし。単独で着手可能。
- 関連（依存ではない）: 同内容の変更が、calendar-for-mywork・kanban-for-mywork・dashboard-for-mywork（同一のテンプレート構造）、ganttchart-for-mywork（別構造のテンプレート）それぞれについて、別issue（`issue-phase012-calendar-004`、`issue-phase012-kanban-003`、`issue-phase012-dashboard-003`、`issue-phase012-gantt-004`）として存在する。5つの issue は互いに独立しており、どの順序で着手してもよい。

## 7. Acceptance criteria（受け入れ基準）

- `project/templates/ISSUE_TEMPLATE.md` に、「削除・変更される既存の振る舞い」と「実装側の未確認の解釈」に相当する2つの新しいサブセクションが追加されている。
- `project/governance/WORKFLOW.md` に、上記2つの欄が空でない場合はスクリーンショットによるユーザー確認を経てからクローズする旨の記述が追加されている。
- 既存のテンプレート・ガバナンス文書の他の記述が削除・変更されていないこと。

## 8. Test requirements（テスト要件）

- 本 issue はドキュメントのみの変更であり、自動テストの対象外。
- 変更後のテンプレートファイルを目視で確認し、Markdown として正しく構文が保たれている（見出しレベルの整合性、リストの記法崩れがない）ことを確認する。

## 9. Out of scope（対象外）

- 既存の `project/issues/` 配下のドキュメントを、新しいテンプレート形式に遡及的に書き直すこと。
- 他リポジトリのテンプレート・ガバナンス文書の変更（それぞれ別 issue で対応する）。

## 要確認

- なし。

## Progress & Implementation Notes

### History

#### 2026-09-27

- User Instruction:
  - project/governance のルールに従い、issue-phase012 シリーズを順番にすべて実装する

- Change:
  - `project/templates/ISSUE_TEMPLATE.md`: `### Direction` の直後（`---` の前）に `### Existing behavior removed or changed` と `### Implementer's unconfirmed interpretation` の2サブセクションを、Issue本文に記載された文言のまま追加した
  - `project/governance/WORKFLOW.md` の `## 6. Issue Closure Rules`: 既存の記述（Implementation is complete / All tests pass / user承認 / Automatic closure禁止）を削除せず、その後に「上記2欄のいずれかが空でない場合、クローズ承認を求める前にスクリーンショット等の比較をユーザーに提示し、明示的な確認を得ること」という趣旨の項目を追記した

- Rationale:
  - Implementation requirements に記載された文言・挿入位置をそのまま採用した。既存の規定は一切削除・上書きしていない（WORKFLOW.md §3「History Preservation」の精神に従った）

- Verification:
  - ドキュメントのみの変更のため自動テスト対象外。変更後の両ファイルを読み直し、見出しレベルの整合性・リストの記法崩れが無いことを目視で確認した
  - `npx vitest run` → 27 test files / 545 tests すべて成功（本 issue によるコード変更は無いため既存件数のまま）

- Status: 実装完了。ユーザーの明示的な承認待ちのため Issue は Open のまま（WORKFLOW.md §6）。

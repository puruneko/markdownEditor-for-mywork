# 独自 Linter のメタキー判定をパーサの現行仕様（全メタキー・日本語別名・ユーザー別名）に合わせる

## 背景
- リポジトリ: `markdownEditor-for-mywork`。
- 要望原文:
  > この拡張機能独自のLinterのルールを今の実装に合うように更新して
- 原文に具体的な不具合の記載が無いため、「今の実装」= 現在のパーサ（`remark-meta-fields.ts` / `meta-keys.ts`）が受け付けるメタ記法、と解釈した。コードを比べると、Linter（`src/editor/notation-lint.ts`）とパーサで次の食い違いがある:
  1. パーサは日本語キー（`@実施日時:` 等の組込別名）を受け付けるが、Linter はキーを英字の固定リスト `plan|schedule|due|priority|tags|dependsOn` でしか見ないため、`@実施日時:` / `@想定期間:` / `@期限:` の値は一切検査されない。issue-phase019-markdownEditor-for-mywork-001 で追加するユーザー別名も同様に検査されない。
  2. 「タスク行内に `@key:` を書いてはいけない」の検査対象が上記6キーのみで、パーサが扱う `repeat / condition / purpose / savepoint / special_note / close` と日本語別名が対象外。
  3. `?`（仮置き）の位置不正の検出（`@key ?:` / `@?key:`）が `\w` を使っており、日本語キーで検出されない。
- 採用した方針: 既存ルールの内容（値の検査内容・メッセージ・quickfix）は変えず、**キーの判定だけ**をパーサと同じ `normalizeMetaKey`（標準キー・組込別名・ユーザー別名）に揃える。新しいルールは追加しない。

## 目的
パーサがメタ情報として解釈するすべての書き方（標準キー・日本語別名・ユーザー別名）に対して、既存の Linter ルールが同じように働く。

## 現状
- `src/editor/notation-lint.ts`（主要部分）:
  - 38行 `META_LINE_RE = /^(\s*- )@(plan|schedule|due|priority|tags|dependsOn)(\?)?:\s*(.*)/`。
  - 41行 `TENTATIVE_BAD_SPACE_RE = /^(\s*- )@(\w+)\s+\?:/`、44行 `TENTATIVE_BAD_PREFIX_RE = /^(\s*- )@\?(\w+):/`。
  - `checkScheduleLikeValue(rawValue, valueDocFrom, keyLabel: 'schedule' | 'plan')`: メッセージ内で `@${keyLabel}` を使う。`checkDueValue` のメッセージは `@due` 固定。
  - `lintLine(lineText, lineFrom)`（205行付近）: タスク行なら `inlineRe = /@(plan|schedule|due|priority|tags|dependsOn)\??:/` で行内メタを警告。それ以外は `checkTentativeMarkerPosition` → `META_LINE_RE` で一致した key が schedule/plan/due なら値検査。
- `src/lib/parser/meta-keys.ts` `normalizeMetaKey(raw)`: 標準キー・組込別名（issue-phase019-markdownEditor-for-mywork-001 完了後はユーザー別名も）を canonical キーに変換。該当なしは `null`。
- パーサのキー規則: `remark-meta-fields.ts` `META_LINE_RE = /^@([\p{L}\p{N}_]+)(\?)?:\s*(.*)$/u`。
- テスト: `src/editor/notation-lint.test.ts`。

## 実装内容
1. `notation-lint.ts`
   - `META_LINE_RE` を `/^(\s*- )@([\p{L}\p{N}_]+)(\?)?:\s*(.*)/u` に変え、`lintLine` で `const canonical = normalizeMetaKey(metaMatch[2])` を求めて、`canonical` が `schedule` / `plan` / `due` のときに既存の値検査を行う（`null` やその他のキーは従来どおり何もしない）。
   - タスク行内の検査を `/@([\p{L}\p{N}_]+)\??:/gu` で全一致を走査し、`normalizeMetaKey` が `null` でない最初の一致を警告する形にする（対象は全メタキーと別名）。
   - `TENTATIVE_BAD_SPACE_RE` / `TENTATIVE_BAD_PREFIX_RE` のキー部分を `[\p{L}\p{N}_]+`（`u` フラグ）にし、`normalizeMetaKey` が `null` でないキーだけを対象にする。
   - メッセージ・quickfix 内のキー表示は、**書かれたキー名**（例 `@実施日時`）を使う。`checkScheduleLikeValue` の `keyLabel` 引数を表示用キー名と canonical の2つに分けるなど、表示名と判定（plan/schedule の説明文の出し分け）を分離する。`checkDueValue` も表示用キー名を受け取る。
   - ファイル冒頭コメント「Patterns — aligned with task-decoration.ts and remark-meta-fields.ts」の通り、パーサと整合した旨を `issue-phase019-markdownEditor-for-mywork-002` 付きで記す。
2. それ以外のルール（区切り文字・ISO 形式・due の逆順・推奨位置の info）は変更しない。

## 完了条件
- `- @実施日時: 2026-10-07T10:00〜12:00` に、`@schedule` と同じ「区切り文字」警告と `/` への quickfix が出る。
- `- @想定期間: 2026-10-07`（終了なし）に plan と同じ警告が出る。`- @期限: 2026/13/40` に due と同じ形式警告が出る。メッセージ中のキー名は書かれた名前（`@実施日時` 等）。
- issue-phase019-markdownEditor-for-mywork-001 のユーザー別名（例 `作業時間`→schedule）を設定すると、`- @作業時間: …` に schedule と同じ検査が働く。
- タスク行内の `@repeat:` / `@目的:` / ユーザー別名 なども「子リストとして記述してください」の警告対象になる。
- `- @実施日時 ?: …` / `- @?実施日時: …` に仮置き位置の警告と quickfix が出る。
- 未知のキー（例 `@memo:`）や通常文中の `@` は従来どおり警告されない。
- 既存の英字キーに対する警告内容・quickfix は従来と同じ。
- `npm test` が通る。

## テスト
- `src/editor/notation-lint.test.ts` に追加: 組込日本語別名での schedule/plan/due 各検査、ユーザー別名（`setUserMetaKeyAliases` で設定し、テスト後に `{}` に戻す）での検査、タスク行内の全メタキー・別名の検出、日本語キーの仮置き位置不正、未知キーが無視されること。既存テストはすべて変更なしで通ること。
- 手動確認: Obsidian で上記の行を書き、警告と quickfix を確認する。

## 依存関係
- issue-phase019-markdownEditor-for-mywork-001__user-defined-meta-key-aliases.md（`normalizeMetaKey` のユーザー別名対応と `setUserMetaKeyAliases` を使うため）

## 対象外
- 新しい Linter ルールの追加（priority / tags / dependsOn / repeat などの値検査等）。
- 既存ルールのメッセージ文面の変更（キー名表示以外）。
- メタ行の推奨位置判定（`reformat-meta-lines.ts`）。

## 要確認
- 原文「今の実装に合うように」に、キー判定の整合以外の具体的な不整合（例: 特定の書き方で誤検知している等）が含まれている場合は、その例の提示が必要。本 issue はキー判定の整合のみを対象とする。

## 実装結果
- 実装済み。`npm run test:unit` 629件通過、E2E（`tests/obs-e2e/meta-alias.e2e.ts` ほか）通過。
- 既知: `gantt-view.e2e.ts` の「期間なしサブタスクのドラッグ予定化」が失敗（本issueの変更範囲外。ganttchart ライブラリ側の変更取り込み待ちの可能性。未切り分け）。

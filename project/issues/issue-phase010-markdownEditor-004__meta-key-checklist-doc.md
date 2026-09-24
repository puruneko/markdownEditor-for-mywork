# 新メタキー追加時の5ファイル チェックリスト整備（元ID: I-23 ／ 対応 preIssue: MARKDOWN-006 の前提整備 ／ Phase: 1）

## 1. Background（背景）

**出自の明記（FIX-3）: MARKDOWN-006 はユーザー要望ではない。** 入力 `修正したい箇所.md` の markdownEditor 節は5項目であり、本項目（MARKDOWN-006／メタ処理の統一）は preIssue 作成時に導出された内部リファクタ項目である。この事実を issue 本文に明記すること。

**背景（確認済み）**: メタ行の正規表現が**5ファイルに重複**し、キー集合が食い違っている。

| ファイル | キー集合 | Unicode |
|---|---|---|
| `src/lib/parser/plugins/remark-meta-fields.ts:18` | 任意（`switch` で11キーを実処理） | 対応 |
| `src/editor/task-decoration.ts:24` | 任意（装飾のみ） | 対応 |
| `src/editor/metatag-decoration.ts:29` | 任意（裸キーにも対応） | 対応 |
| `src/editor/notation-lint.ts`（36行付近） | **6キー固定列挙**（`repeat`/`condition`/`purpose`/`savepoint`/`special_note` が漏れ） | — |
| `src/editor/reformat-meta-lines.ts:19` | `\w+`（**ASCII 限定**。日本語キーを認識できない） | **非対応** |

**なぜ今か**: 後続 issue（issue-phase010-markdownEditor-006__section-meta-close-memo.md、I-07）で `close` / `memo` を足す際、修正漏れがあると「エディタ上は緑になるが lint は不正のまま」といった部分的不整合が生じる。統一レジストリの実装（大きい）を待たずに、修正漏れによる部分的不整合は防げる。

## 2. Objective（目的）

新しいメタキーを追加する際に確認すべき5ファイルとそれぞれのキー集合・Unicode 対応状況を、リポジトリ内のドキュメントとして整備し、I-07（Section メタ経路の新設）で `close` / `memo` を追加する際の修正漏れを防ぐ。

## 3. Scope（スコープ）

- 5ファイルのキー集合・Unicode 対応状況を表形式でドキュメント化する
- **統一レジストリの実装は行わない**（本 issue のスコープ外。将来の別 issue で扱う）

## 4. Implementation requirements（実装要件）

- **統一レジストリの実装は行わない。** 「新キーを追加する際に確認する5ファイル」をリポジトリ内のドキュメントとして整備するだけとする
- 各ファイルのキー集合・Unicode 対応状況を表として記載する（上記 Background の表を土台にする）
- ドキュメントの配置場所は要確認（リポジトリの既存ドキュメント規約に従うことが望ましいが、plan には明記されていない）

## 5. Files / components likely to be changed（変更が見込まれるファイル／コンポーネント）

- 新規ドキュメントファイル（配置場所は要確認）
- 参照対象（変更はしないが内容を確認する）:
  - `src/lib/parser/plugins/remark-meta-fields.ts:18`
  - `src/editor/task-decoration.ts:24`
  - `src/editor/metatag-decoration.ts:29`
  - `src/editor/notation-lint.ts`（36行付近）
  - `src/editor/reformat-meta-lines.ts:19`

## 6. Dependencies（依存関係）

- 先行 Issue: なし（Phase 1・依存なし）
- 後続 Issue: issue-phase010-markdownEditor-006__section-meta-close-memo.md（I-07）の**着手前に必須**。実装順序として、本 issue（I-23 メタキー チェックリスト整備）の完了が Phase 3（I-07）着手の前提として位置づけられている
- 他リポジトリへの影響: なし

## 7. Acceptance criteria（受け入れ基準）

- チェックリストがドキュメントとして存在し、5ファイルと各々のキー集合・Unicode 対応状況が記載されている

## 8. Test requirements（テスト要件）

- ドキュメント整備のみのため、コード変更に対する自動テストは不要
- ドキュメントの内容が実際の5ファイルの現状と一致していることをレビューで確認する

## 9. Out of scope（対象外）

- 統一レジストリの実装（5ファイルの重複を解消する本格的なリファクタは本 issue に含まない）
- `notation-lint.ts` の6キー固定列挙の修正（キー集合の不一致自体の是正は本 issue では行わない。ドキュメント化のみ）
- `reformat-meta-lines.ts` の ASCII 限定正規表現の修正（同上）

## Progress & Implementation Notes

### History

#### 2026-09-22

- User Instruction:
  - project/governance のルールに従い、issue-phase010 シリーズを順番にすべて実装する

- Change:
  - `documents/meta-key-checklist.md` を新設した（5ファイルのキー集合・Unicode 対応状況の表、カノニカルキー一覧、新キー追加手順、スコープ外事項を記載）
  - 統一レジストリの実装、`notation-lint.ts` の6キー固定列挙の是正、`reformat-meta-lines.ts` の ASCII 限定正規表現の是正は行っていない（スコープ外）

- Rationale:
  - 実コード（`src/lib/parser/plugins/remark-meta-fields.ts`, `src/editor/task-decoration.ts`, `src/editor/metatag-decoration.ts`, `src/editor/notation-lint.ts`, `src/editor/reformat-meta-lines.ts`, `src/lib/contract/canonical.ts`, `src/lib/parser/meta-keys.ts`）を直接読み、Issue Background の表が現状と一致していることを確認した上でドキュメント化した
  - 配置場所は既存の `documents/ARCHITECTURE.md` / `documents/LIBRARY_USAGE.md` に倣い `documents/` 配下とした（Japanese: 開発者向け参照ドキュメントであり project/specs のようなドメイン仕様ではないため）

- Verification:
  - コード変更なしのため自動テストへの影響なし。`npx vitest run` は Issue 003 実施時点の 476 件がそのまま該当（本 Issue ではテスト追加なし、Test requirements どおり）
  - ドキュメント内容と実コードの一致をレビュー（表の各セルをファイルの実際の正規表現・switch 文と突き合わせ済み）

- Status: 実装完了。ユーザーの明示的な承認待ちのため Issue は Open のまま（WORKFLOW.md §6）。

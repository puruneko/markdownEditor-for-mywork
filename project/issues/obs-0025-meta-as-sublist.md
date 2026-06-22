# obs-0025: メタ情報のサブリスト記法への変更

## ステータス

Closed

## 概要

`@key: value` 形式のメタ情報を、タスク・リストの直下インデントに裸で書く旧記法から、
サブレベルのリストアイテム（`- @key: value`）として書く新記法に変更する。
また、タスクを子要素に持たないサブレベルのリストアイテムをコメントとして扱う（`isMemo: true`）。

**旧記法:**
```markdown
- [ ] タスク
  @schedule: 2026-04-01T10:00/2026-04-01T12:00
  @due: 2026-04-10
  > コメント文
```

**新記法:**
```markdown
- [ ] タスク
  - @schedule: 2026-04-01T10:00/2026-04-01T12:00
  - @due: 2026-04-10
  - コメント文
```

`> blockquote` 記法によるコメントは引き続き両方の記法でサポートする。

## 変更仕様

- **`- @key: value`** 形式のリストアイテム（子要素なし）をメタ情報として抽出
- **`- テキスト`** 形式のリストアイテムで、タスク子要素を持たないものを `isMemo: true` として扱う
- **`> テキスト`** blockquote は従来通り `QuoteNode`（isMemo: true）として扱う（後方互換）
- シリアライズ（AST→MD）は `- @key: value` 形式で出力

## TODO

- [x] `src/lib/parser/md-to-ast.ts`: 子アイテムを全収集後に `@meta` を後処理で抽出
- [x] `src/lib/parser/ast-to-md.ts`: `serializeMeta` を `- @key: value` 形式に変更
- [x] `src/lib/calendar/markdown-patch.ts`: `patchScheduleForNode` / `patchSchedule` のパターン更新
- [x] 全テストファイルの MD サンプルを新記法に更新（5ファイル）
- [x] `test/vaults/simple/test-tasks.md` を新記法に更新
- [x] `demo/demo_markdown.md` を新記法に更新

## 完了条件

- `- @schedule:` 形式でメタ情報がパースされること
- `- テキスト`（タスク子なし）が `isMemo: true` のリストアイテムとして扱われること
- `> テキスト` blockquote が子コメントとして引き続き機能すること
- 全ユニットテストパス
- ガントチャート・カレンダーでスケジュールが正しく表示されること

## History

- 2026-06-20: 実装完了・Closed
  - `md-to-ast.ts`: 子全収集 → `@meta` 後処理抽出に変更
  - `ast-to-md.ts`: `serializeMeta` を `- @key: value` 形式に変更
  - `markdown-patch.ts`: パターンを `- @schedule:` に更新、`patchSchedule` 追加
  - テストファイル 5件の MD サンプルを新記法に更新（Perl 変換）
  - `test/vaults/simple/test-tasks.md` を新記法に更新
  - `demo/demo_markdown.md` を新記法に更新
  - 全 82 テストパス

## 関連ファイル

- `src/lib/parser/md-to-ast.ts`
- `src/lib/parser/ast-to-md.ts`
- `src/lib/calendar/markdown-patch.ts`
- `src/lib/parser/md-to-ast.test.ts`
- `src/lib/calendar/markdown-patch.test.ts`
- `src/lib/calendar/ast-to-calendar.test.ts`
- `src/lib/gantt/ast-to-gantt.test.ts`
- `test/vaults/simple/test-tasks.md`
- `demo/demo_markdown.md`

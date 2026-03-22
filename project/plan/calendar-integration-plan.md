# カレンダー統合 実装計画

## 概要

Markdown AST エディタの右パネルにカレンダー表示を追加する。
ASTから `meta.schedule` を持つタスクを抽出し、カレンダー上に表示する。
カレンダー上での変更はMarkdown文字列に反映され、Markdownが唯一の正の情報源となる。

## 設計方針

### データフロー（単方向）

```
Markdown文字列 → (parse) → AST → (extract) → CalendarItem[]
                                                     ↓
                                              CalendarView表示
                                                     ↓
                                            ユーザ操作（移動/リサイズ/編集）
                                                     ↓
                                            AST上の該当ノード特定
                                                     ↓
                                            AST更新 → serialize → Markdown文字列更新
                                                     ↓
                                            再パース → 全体再描画
```

### 原則

- Markdown文字列が唯一の正の情報源（Single Source of Truth）
- ASTおよびカレンダーはMarkdownの派生ビュー
- カレンダーからの変更はAST経由でMarkdownを更新し、その結果を再描画する
- カレンダーライブラリは `calendar-for-mywork` を使用する

## 技術スタック（追加分）

- カレンダー: calendar-for-mywork (svelte-calendar-lib)
- 日時処理: luxon（calendar-for-myworkの依存）

## 実装フェーズ

### Phase 1: UI基盤

| Issue | 内容 | 依存 |
|-------|------|------|
| #0002 | カレンダー連携仕様（Spec）の策定 | なし |
| #0003 | 右パネルのタブUI基盤実装（AST/Calendar切替） | なし |
| #0004 | calendar-for-mywork ライブラリの導入 | なし |

### Phase 2: データ変換

| Issue | 内容 | 依存 |
|-------|------|------|
| #0005 | AST → CalendarItem 変換ロジックの実装 | #0002, #0004 |

### Phase 3: 表示統合

| Issue | 内容 | 依存 |
|-------|------|------|
| #0006 | カレンダータブへの CalendarView 表示統合 | #0003, #0005 |

### Phase 4: 双方向同期

| Issue | 内容 | 依存 |
|-------|------|------|
| #0007 | カレンダー操作（移動・リサイズ）からのMarkdown更新 | #0006 |
| #0008 | カレンダー編集ダイアログからのMarkdown更新 | #0006 |

## 実装順序

```
#0002（Spec策定）
#0003（タブUI）    ─┐
#0004（ライブラリ導入）─┤
                     ↓
              #0005（変換ロジック）
                     ↓
              #0006（カレンダー表示）
                     ↓
         #0007（移動・リサイズ同期）
         #0008（編集ダイアログ同期）  ← 並行可
```

Phase 1の#0003と#0004は並行して進められる。
Phase 4の#0007と#0008も並行して進められる。

## ディレクトリ構成（追加分）

```
src/
  lib/
    calendar/
      ast-to-calendar.ts      -- AST → CalendarItem[] 変換
      ast-to-calendar.test.ts -- 変換ロジックのテスト
      CalendarTab.svelte       -- カレンダータブコンポーネント
    editor/
      EditorLayout.svelte      -- タブUI追加（既存ファイル改修）
      TabHeader.svelte         -- タブヘッダコンポーネント（新規）
```

## 参照仕様

- AST構造: `project/instructions/AST仕様とロジックルール（構造定義込み）.md`
- タスク管理記法: `project/instructions/Markdownベース_タスク管理記法_仕様.md`
- カレンダーライブラリ: https://github.com/puruneko/calendar-for-mywork.git
- 既存実装計画: `project/plan/editor-implementation-plan.md`

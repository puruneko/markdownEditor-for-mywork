# Markdown AST エディタ 実装計画

## 概要

Markdownベースタスク管理記法の変換ルールを搭載した簡易エディタを開発する。
左ペインにMarkdownエディタ、右ペインにAST表示を配置し、双方向にリアルタイム同期する。

## 技術スタック

- フレームワーク: Svelte 5
- 言語: TypeScript
- ビルド: Vite
- エディタ: Monaco Editor

## 実装フェーズ

### Phase 1: 基盤構築

| Issue | 内容 | 依存 |
|-------|------|------|
| #0002 | Vite + Svelte 5 + TypeScript プロジェクト初期構築 | なし |
| #0003 | Monaco Editor の導入と基本表示 | #0002 |
| #0004 | 左右分割レイアウトの実装 | #0003 |

### Phase 2: パーサ実装

| Issue | 内容 | 依存 |
|-------|------|------|
| #0005 | Markdown → AST パーサの実装 | #0002 |
| #0006 | AST → Markdown シリアライザの実装 | #0005 |

### Phase 3: エディタ連携

| Issue | 内容 | 依存 |
|-------|------|------|
| #0007 | MD編集時のリアルタイムAST同期（左→右） | #0004, #0005 |
| #0008 | AST編集時のリアルタイムMD同期（右→左） | #0004, #0006 |
| #0009 | 変更方向の矢印インジケータ表示 | #0007, #0008 |

### Phase 4: シンタックスハイライト

| Issue | 内容 | 依存 |
|-------|------|------|
| #0010 | @メタ情報のシンタックスハイライト | #0004 |
| #0011 | タスクチェックボックス記法のハイライト（[>], [!], [-]） | #0004 |

## 実装順序

```
#0002 → #0003 → #0004 → #0010, #0011（並行可）
                    ↓
#0005 → #0006
                    ↓
#0007 → #0008 → #0009
```

Phase 2（パーサ）は Phase 1 の Monaco 統合と並行して進められる。
Phase 4（ハイライト）は左右レイアウト完成後いつでも着手可能。

## ディレクトリ構成（想定）

```
src/
  lib/
    parser/
      md-to-ast.ts        -- Markdown → AST 変換
      ast-to-md.ts         -- AST → Markdown 変換
      types.ts             -- AST型定義
    editor/
      MonacoEditor.svelte  -- Monaco ラッパーコンポーネント
      EditorLayout.svelte  -- 左右分割レイアウト
      DirectionArrow.svelte -- 矢印インジケータ
    highlight/
      meta-tokenizer.ts    -- @メタ情報トークナイザ
      task-tokenizer.ts    -- タスク記法トークナイザ
  App.svelte
  main.ts
```

## 参照仕様

- 変換ルール: `project/instructions/Markdownベース_タスク管理記法_仕様.md`
- AST構造: `project/instructions/AST仕様とロジックルール（構造定義込み）.md`

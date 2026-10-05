# 開発者向けドキュメント

MD AST Editorの開発・保守に必要な情報をまとめています。

## クイックスタート

```bash
# 依存パッケージをインストール
npm install

# 開発サーバーを起動（vite）
npm run dev

# テストを実行
npm run test:unit          # ユニットテスト
npm run test:e2e           # E2Eテスト（Playwright）
npm run test:obs:e2e       # Obsidian E2Eテスト

# ビルド
npm run build              # 本番用esbuildビルド
npm run build:dev          # 開発用esbuildビルド
```

## ドキュメントの構成

- **[architecture.md](./architecture.md)** - アプリケーション全体の構成・責務・データフロー
- **[modules.md](./modules.md)** - ディレクトリ・モジュール・コンポーネントの詳細
- **[development-setup.md](./development-setup.md)** - 開発環境セットアップと手順
- **[testing.md](./testing.md)** - テスト構成・テスト方法・テスト戦略
- **[meta-key-guide.md](./meta-key-guide.md)** - メタキーシステムの追加・変更手順

## 主要技術スタック

- **言語**: TypeScript
- **フレームワーク**: Obsidian SDK
- **UI フレームワーク**: Svelte 5
- **パーサー**: unified / remark（Markdown解析）
- **ビルド**: esbuild / Vite
- **テスト**: Vitest / Playwright / WebdriverIO
- **エディタ拡張**: CodeMirror 6

## 開発の流れ

このプロジェクトはIssue駆動開発を採用しています。

1. 機能要望やバグ報告は `project/issues/` 内のIssueファイルとして管理
2. 開発はIssueの指示に基づいて実施
3. Issue内の `Related Specs` を確認して実装仕様を把握
4. テストを追加し、すべてのテストが通ることを確認
5. Issueクローズはユーザー明示的な承認が必要

詳細は `project/governance/WORKFLOW.md` を参照してください。

## 開発時の注意点

### コード変更時に影響する主要箇所

**メタ情報を追加・変更する場合**:
- `src/lib/parser/meta-keys.ts` - メタキーのカノニカル定義
- `src/lib/parser/plugins/remark-meta-fields.ts` - パーサー
- `src/editor/notation-lint.ts` - バリデーション
- `src/editor/metatag-decoration.ts` - エディタ装飾
- 対応テスト
→ 詳細は [meta-key-guide.md](./meta-key-guide.md) を参照

**ビューを追加する場合**:
- `src/views/` - ビュークラス（ShadowItemViewを継承）
- `src/plugin.ts` - ビュー登録・コマンド追加
- テスト

**パーサーロジックを変更する場合**:
- `src/lib/parser/` - パーサー実装
- 関連するビューモデルの変更の有無を確認
- `src/lib/contract/` - データ契約の確認

## ディレクトリ構造（簡略版）

```
src/
  ├── plugin.ts                 # Obsidianプラグインエントリポイント
  ├── settings.ts               # プラグイン設定定義
  ├── views/                    # ビュークラス（Calendar, Gantt, Kanban等）
  ├── editor/                   # CodeMirror 6 拡張（装飾・検証・補完等）
  ├── sync/                     # ファイル同期・AST索引
  ├── lib/
  │   ├── parser/               # Markdown → AST解析
  │   ├── contract/             # データ構造定義
  │   ├── calendar/             # カレンダービュー用ロジック
  │   ├── gantt/                # ガントビュー用ロジック
  │   ├── kanban/               # かんばんビュー用ロジック
  │   ├── query/                # クエリ実行エンジン
  │   ├── recurrence/           # 繰り返しスケジュール計算
  │   ├── format/               # フォーマット・変換
  │   ├── viewmodel/            # ビュー固有データ構造
  │   ├── highlight/            # シンタックスハイライト
  │   └── debug/                # デバッグビュー用
  ├── sync/                     # ファイル同期・索引化
  └── ...

test/ / tests/                  # テスト
project/
  ├── governance/               # ルール・ワークフロー
  ├── issues/                   # Issue管理
  ├── development/              # 開発者向けドキュメント（このディレクトリ）
  └── ...
```

## 外部ライブラリ（ビュー用）

複数のビューは外部のSvelteコンポーネントライブラリを使用しています：

- `svelte-calendar-lib` - カレンダーコンポーネント
- `svelte-gantt-lib` - ガントチャートコンポーネント
- `svelte-kanban-lib` - かんばんボードコンポーネント
- `svelte-dashboard-lib` - ダッシュボードコンポーネント

これらはnpmスクリプト（`libs:update`）で管理されます：

```bash
npm run libs:update          # 依存する外部ライブラリを更新
npm run build && npm run test # ビルド・テスト
```

## よくある開発タスク

### 新しいメタキーを追加する

→ [meta-key-guide.md](./meta-key-guide.md) を参照

### 新しいビューを追加する

1. `src/views/` に新しいビュークラスを作成（`ShadowItemView` を継承）
2. `src/plugin.ts` でビュータイプを定義し、`registerView()` で登録
3. コマンドを追加（`addCommand()`）
4. テストを追加

### パーサーを拡張する

1. `src/lib/parser/` に新しいパーサープラグインを追加
2. `src/lib/parser/plugins/` に remark プラグインを実装
3. `src/lib/contract/` のデータ構造を確認・更新
4. 関連ビューの変更の有無を確認
5. テストを追加

## テストの実行と CI/CD

- ユニットテスト: `npm run test:unit` → Vitest
- E2Eテスト: `npm run test:e2e` → Playwright
- Obsidian環境テスト: `npm run test:obs:e2e` → WebdriverIO + Obsidian
- すべて: `npm run test`

## トラブルシューティング

### ビルドに失敗する場合

```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### テストが失敗する場合

```bash
npm run test:unit       # 具体的なテストを確認
npm run test:obs:e2e:headed  # Obsidianテストを目視確認
```

### ファイル監視がうまく動作しない場合

`src/sync/file-sync.ts` と `src/sync/ast-index.ts` の debounce 設定を確認。
デバウンス時間（ミリ秒）はプラグイン設定で調整可能。

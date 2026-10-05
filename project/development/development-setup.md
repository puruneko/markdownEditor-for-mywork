# 開発環境セットアップ

このドキュメントは、MD AST Editorの開発に必要な環境構築手順を説明します。

## 前提条件

- **Node.js** 18以上
- **npm** 9以上（package-lock.json の管理用）
- **Obsidian** 1.0.0以上（プラグイン動作テスト用）
- **Git** 2.0以上
- **エディタ** VSCode推奨（TypeScript開発に最適化）

## 基本セットアップ

### 1. リポジトリをクローン

```bash
git clone <リポジトリURL>
cd markdownEditor-for-mywork
```

### 2. 依存パッケージをインストール

```bash
npm install
```

**実行される内容**:
- `node_modules/` が生成
- `package-lock.json` が更新
- 約1分程度（初回時間がかかる場合あり）

### 3. 外部 Svelte コンポーネント ライブラリをアップデート

```bash
npm run libs:update
```

**アップデート対象**:
- `svelte-calendar-lib` - カレンダーUI
- `svelte-gantt-lib` - ガントチャートUI
- `svelte-kanban-lib` - かんばんUI
- `svelte-dashboard-lib` - ダッシュボードUI

これらは `../calendar-for-mywork`, `../gantt-for-mywork` など別リポジトリから参照されます。

### 4. 開発サーバーを起動（オプション）

```bash
npm run dev
```

Viteの開発サーバーが起動。主にUI検証用。

## ビルド方法

### 開発用ビルド

```bash
npm run build:dev
```

**出力**:
- `main.js` - esbuild によるコンパイル結果（ソースマップ含む）
- `styles.css` - Svelteコンポーネント・アプリケーション CSS
- `manifest.json` - Obsidianプラグイン定義

**特徴**:
- ソースマップ有り（ブラウザデバッグ可能）
- 最適化なし（高速ビルド）
- `.obsidian/plugins/md-ast-editor/` へコピーして動作確認

### 本番用ビルド

```bash
npm run build
```

**特徴**:
- ソースマップなし
- 最適化有り（バンドルサイズ削減）

### Vite ビルド（デバッグ用）

```bash
npm run build:app
```

Vite による単純なバンドル（開発時の動作確認用）。
Obsidianプラグインとしては使用不可（別プロセスで動作）。

## テスト実行

### ユニットテスト（Vitest）

```bash
# すべてのテストを実行
npm run test:unit

# ウォッチモード（ファイル変更を監視）
npm run test:unit -- --watch

# 特定のテストファイルを実行
npm run test:unit -- src/lib/parser/parse-markdown.test.ts

# カバレッジ測定
npm run test:unit -- --coverage
```

### E2Eテスト（Playwright）

```bash
# すべてのE2Eテストを実行
npm run test:e2e

# ブラウザを表示して実行（デバッグ用）
npm run test:e2e -- --headed

# 特定のテストを実行
npm run test:e2e -- tests/playwright/calendar.spec.ts
```

### Obsidian E2Eテスト（WebdriverIO）

```bash
# ビルド＆テスト実行（初回または大きな変更後）
npm run test:obs:e2e

# サーバー起動済みの場合（高速）
npm run test:obs:e2e:run

# 画面を表示してテスト（デバッグ用）
npm run test:obs:e2e:headed

# または
OBS_E2E_HEADED=1 npm run test:obs:e2e
```

### すべてのテストを一括実行

```bash
npm run test
```

実行順序: unit → e2e → obs:e2e

## Obsidian プラグインとして組み込む

### セットアップ

1. **Obsidian vault を開く**

   Obsidianで使用する vault（通常 `~/Obsidian Vault` など）を開きます。

2. **プラグインディレクトリに認識させる**

   ```bash
   # Obsidian プラグインディレクトリへシンボリックリンクを作成（推奨）
   # または毎回ビルド後に手動コピー
   ```

3. **設定方法**

   Obsidianの以下から有効化：
   - Settings → Community Plugins → "MD AST Editor" を検索
   - または手動で `~/.obsidian/plugins/md-ast-editor/` へコピー

### 開発ワークフロー

```bash
# 1. コードを編集
# ... ファイルを修正 ...

# 2. ビルド
npm run build:dev

# 3. Obsidian プラグインディレクトリにコピー
cp main.js manifest.json styles.css ~/.obsidian/plugins/md-ast-editor/

# 4. Obsidian を再起動またはプラグインを再読み込み
# Settings → Community Plugins → Reload
```

### 快適な開発のためのコマンド設定

毎回のコピーを自動化したい場合、`npm run obs:update:manifest` （package.jsonに定義済み）を使用：

```bash
npm run obs:update:manifest
```

このコマンドで `main.js`, `manifest.json`, `styles.css` が自動的にObsidianプラグインディレクトリにコピーされます。

（ただしWindows向けパスが含まれているため、環境に応じて修正が必要）

## 型チェック

```bash
npm run check
```

svelte-check による型チェック。
ビルド前に実行して、型エラーが無いか確認。

## よくある開発タスク

### 既存機能を修正する

1. コードを編集
2. `npm run test:unit -- --watch` でテストを監視
3. テストが通ったら `npm run build:dev` でビルド
4. Obsidian で動作確認

### 新しい機能を追加する

1. 機能に対応するテストを作成（TDD推奨）
2. テストを実行して失敗を確認
3. コードを実装
4. テストが通るまで反復
5. `npm run check` で型チェック
6. `npm run build:dev` でビルド
7. Obsidian で統合テスト

### メタキーを追加する

[meta-key-guide.md](./meta-key-guide.md) を参照。

主な手順:
1. `src/lib/contract/canonical.ts` - メタキー定義
2. `src/lib/parser/plugins/remark-meta-fields.ts` - パーサー更新
3. その他のファイル - 必要に応じて
4. テスト追加
5. `npm run test:unit` 確認

### 新しいビューを追加する

1. `src/views/` に新しいビュークラスを作成
2. `src/views/*Mount.svelte` に Svelte コンポーネント実装
3. `src/plugin.ts` で `registerView()` 呼び出し
4. `src/plugin.ts` で コマンド追加
5. テスト追加
6. `npm run test` 確認

## トラブルシューティング

### パッケージのインストール失敗

```bash
# キャッシュをクリアして再試行
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### ビルド失敗（Module not found など）

```bash
# 外部ライブラリを再更新
npm run libs:update

# ビルド再試行
npm run build
```

### Obsidian プラグインが読み込まれない

1. `main.js` の存在確認
2. `manifest.json` が有効な JSON か確認
3. Obsidian コンソール（F12）でエラーを確認
4. プラグインの再読み込み（Settings → Community Plugins）

### テストがタイムアウトする

```bash
# テスト実行時にタイムアウト時間を延長
npm run test:unit -- --testTimeout=10000
```

### ファイル監視が動作しない（watch mode）

```bash
# ファイルシステムリソース不足の場合
npm run test:unit -- --watch --reporters=dot
```

## 開発時の推奨エディタ設定

### VSCode 拡張機能

推奨:
- **Svelte for VS Code** - Svelte シンタックスハイライト・デバッグ
- **TypeScript Vue Plugin (Volar)** - 型チェック・補完
- **ESLint** - コード品質チェック
- **Prettier** - コード フォーマット

### VSCode 設定例（.vscode/settings.json）

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

## CI/CD パイプライン

GitHub Actions 等でのテスト自動化例：

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm run libs:update
      - run: npm run test:unit
      - run: npm run check
      - run: npm run build
```

## 参考資料

- [architecture.md](./architecture.md) - アーキテクチャの詳細
- [testing.md](./testing.md) - テスト戦略・実行方法
- [meta-key-guide.md](./meta-key-guide.md) - メタキー追加ガイド
- [Obsidian Developer Documentation](https://docs.obsidian.md/)
- [unified / remark Documentation](https://unifiedjs.com/)
- [Svelte 5 Documentation](https://svelte.dev/docs)

# テスト構成・実行方法

## テストの種類と役割

### 1. ユニットテスト（Vitest）

**対象**: パーサー、ユーティリティ関数、ビジネスロジック

**実行**:
```bash
npm run test:unit              # すべてのユニットテストを実行
npm run test:unit -- --watch   # ウォッチモード
npm run test:unit -- <pattern> # 特定のテストを実行
```

**ファイル配置**: `src/**/*.test.ts`

**主要テストスイート**:

| テスト | 対象 | ファイル |
|--------|------|---------|
| Parser | Markdown解析 | `src/lib/parser/parse-markdown.test.ts` |
| Meta Keys | メタキー処理 | `src/lib/parser/meta-keys.test.ts` |
| Recurrence | 繰り返しスケジュール計算 | `src/lib/recurrence/recurrence-expander.test.ts` |
| Notation Lint | バリデーション | `src/editor/notation-lint.test.ts` |
| Settings | 設定管理 | `src/settings.test.ts` |
| Views | ビュー基盤 | `src/views/ShadowItemView.test.ts` |

**テスト例**:

```typescript
import { describe, it, expect } from 'vitest'
import { parseMarkdown } from '../parser/parse-markdown'

describe('parseMarkdown', () => {
  it('should parse simple task', () => {
    const markdown = '- [ ] Task 1'
    const doc = parseMarkdown(markdown)
    expect(doc.nodes).toHaveLength(1)
    expect(doc.nodes[0].status).toBe('ready')
  })

  it('should extract meta information', () => {
    const markdown = `- [>] Task 1
  - @priority: 1
  - @tags: urgent, important`
    const doc = parseMarkdown(markdown)
    expect(doc.nodes[0].meta.priority).toBe(1)
    expect(doc.nodes[0].meta.tags).toEqual(['urgent', 'important'])
  })
})
```

### 2. E2Eテスト（Playwright）

**対象**: UIインタラクション、ビュー操作、全体フロー

**実行**:
```bash
npm run test:e2e                    # すべてのE2Eテストを実行
npm run test:e2e -- --debug         # デバッグモード
npm run test:e2e -- --headed        # ブラウザ表示有り
```

**ファイル配置**: `tests/playwright/*.spec.ts`

**テスト例**:

```typescript
import { test, expect } from '@playwright/test'

test('should open Calendar View', async ({ page }) => {
  // Obsidian環境でテスト実行
  // ...
})
```

### 3. Obsidian E2Eテスト（WebdriverIO）

**対象**: Obsidian環境での実際の動作確認

**実行**:
```bash
npm run test:obs:e2e                     # すべてのObsidian E2Eテストを実行
npm run test:obs:e2e:headed              # ブラウザ表示有り（デバッグ用）
npm run test:obs:e2e:run                 # サーバー起動済みの場合
OBS_E2E_HEADED=1 npm run test:obs:e2e   # 画面に表示させてテスト
```

**ファイル配置**: `tests/wdio/*.e2e.ts`

**セットアップ**: `wdio.conf.mts`

**テスト例**:

```typescript
describe('MD AST Editor Plugin', () => {
  it('should register views on plugin load', async () => {
    // Obsidian内でプラグインが正しく読み込まれたことを確認
    // ...
  })
})
```

## テスト対象の分類

### パーサー層のテスト

主要テスト対象:

1. **Markdown 解析**
   - 見出し（セクション）の認識
   - リスト・タスク・引用の区別
   - ネスト構造の処理
   - 試験: `src/lib/parser/parse-markdown.test.ts`

2. **メタ情報抽出**
   - 標準キー（schedule, plan, due など）のパース
   - 日本語別名の処理
   - 値のバリデーション
   - 試験: `src/lib/parser/` 配下各テスト

3. **特殊記法**
   - タスクステータス（`[ ]`, `[>]`, `[x]` など）
   - 期限超過表記
   - 仮置き表記（`?`）

### エディタ拡張のテスト

1. **Lint 検証** (`src/editor/notation-lint.test.ts`)
   - 日付形式の検証
   - メタキー値の形式チェック
   - 不正な記法の検出

2. **装飾・ハイライト**
   - メタ情報の色付け
   - タスク行の背景色

3. **オートコンプリート** (`src/editor/metatag-suggest.test.ts`)
   - サジェスト候補の生成
   - よく使うメタキーの優先順位

4. **UI コンポーネント**
   - 日付ピッカー
   - 繰り返しスケジュール選択UI

### ビュー層のテスト

1. **ViewModel 生成**
   - Document → ビュー用データ変換
   - 各ビュー専用の構造体生成

2. **インタラクション**
   - ドラッグ&ドロップ
   - ビュー上のクリック操作
   - フィルタリング

### 統合テスト

エディタ操作 → ファイル同期 → ビュー更新 の全フロー。

## テスト実行チェックリスト

開発時に確認すべき項目：

### コード変更後

- [ ] `npm run test:unit` が全パス
- [ ] `npm run test:e2e` が全パス（必要に応じて）
- [ ] `npm run test:obs:e2e` が全パス（Obsidianプラグイン変更時）
- [ ] `npm run check` で型エラーなし

### メタキー追加時

- [ ] `src/lib/parser/parse-markdown.test.ts` に新テストケース追加
- [ ] `src/editor/notation-lint.test.ts` にバリデーションテスト追加
- [ ] `src/editor/metatag-suggest.test.ts` にサジェストテスト追加
- [ ] 日本語別名テストを追加（あれば）

### ビュー追加時

- [ ] ViewModel 生成テスト
- [ ] Svelte コンポーネント単体テスト（推奨）
- [ ] エンドツーエンドテスト（ビュー開く → 表示確認）

### 新規機能追加時

- [ ] ユニットテスト（ロジック層）
- [ ] E2Eテスト（UIインタラクション層）
- [ ] 既存テストの再実行（回帰テスト）

## ローカルテスト環境のセットアップ

```bash
# 1. 依存パッケージをインストール
npm install

# 2. 外部Svelteライブラリを更新
npm run libs:update

# 3. テスト実行
npm run test:unit        # ユニットテストのみ
npm run test:obs:e2e     # Obsidian環境でのテスト

# 4. 全テスト実行（CI/CD前に実行推奨）
npm run test             # test:unit && test:obs:e2e
```

## CI/CD での実行

GitHub Actions等 での実行イメージ：

```yaml
- name: Run tests
  run: |
    npm install
    npm run test:unit
    npm run test:obs:e2e
```

## デバッグ方法

### ユニットテストのデバッグ

```bash
# ウォッチモード＋デバッグ出力
npm run test:unit -- --watch --reporter=verbose

# 特定テストのみ実行
npm run test:unit -- src/lib/parser/parse-markdown.test.ts
```

### E2Eテストのデバッグ

```bash
# Playwright Inspector を起動
npm run test:e2e -- --debug

# ブラウザを表示して実行
npm run test:e2e -- --headed --workers=1
```

### Obsidian E2Eテストのデバッグ

```bash
# ヘッドレスモードを無効にして実行
OBS_E2E_HEADED=1 npm run test:obs:e2e

# 特定のテストスイートのみ実行
npm run test:obs:e2e -- --spec=tests/wdio/plugin.e2e.ts
```

## テストカバレッジ

カバレッジ測定（設定があれば）：

```bash
npm run test:unit -- --coverage
```

## よくある問題と対処

### テストがタイムアウトする

- デバウンス時間の設定を確認（デフォルト 300ms）
- Obsidian テストでは別途タイムアウト設定あり（wdio.conf.mts）

### ファイル同期テストが不安定

- AstIndex の debounce 設定を確認
- テスト内で適切な待機を入れる

### ビューのE2Eテストが動作しない

- Svelte コンポーネントのマウント完了を待つ
- Shadow DOM の内容へのアクセスが必要（通常のDOM セレクタは不可）

## テスト戦略

### 新規開発時

1. **計画段階**
   - テスト可能な設計を心がける
   - 複雑な処理はユーティリティ関数に分離

2. **実装時**
   - ユニットテストから書く（TDD推奨）
   - 複雑なロジックは単体テストで十分カバー
   - UIインタラクションはE2Eテストで確認

3. **レビュー前**
   - `npm run test` で全テストが通ることを確認
   - 型チェック `npm run check` で問題なし
   - ビルド可能な状態 `npm run build`

### バグ修正時

1. 再現テストを作成（バグの原因をテストで再現）
2. 修正を実装
3. テストが通ることを確認
4. 回帰テスト（既存テストすべてが通ることを確認）

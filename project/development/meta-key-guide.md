# メタキー追加・変更ガイド

メタ情報システムは複数のモジュールに分散して実装されているため、新しいメタキーを追加する際には複数のファイルを一貫して更新する必要があります。

## メタキーシステムの現状

メタ行（`- @キー: 値` 形式）の解釈が以下の5つのファイルに重複実装されています：

| # | ファイル | 役割 | 対応必須 |
|---|---------|------|---------|
| 1 | `src/lib/parser/plugins/remark-meta-fields.ts` | パース（Meta オブジェクトへ格納） | ✓ 必須 |
| 2 | `src/editor/task-decoration.ts` | エディタ装飾（キー部分の色付け） | △ 任意 |
| 3 | `src/editor/metatag-decoration.ts` | エディタ装飾（値のチップ表示） | △ 任意 |
| 4 | `src/editor/notation-lint.ts` | Lint（値の形式検証） | △ 値検証が必要なら |
| 5 | `src/editor/reformat-meta-lines.ts` | メタ行の並び替え判定 | △ 自動整形対象なら |

**重要**: 5ファイル中1つでも更新を忘れると、エディタでは装飾されるが lint は不正のまま、などの部分的な不整合が発生します。

## 標準メタキーの定義

`src/lib/contract/canonical.ts` に正規キー一覧があります（現在12キー）：

```typescript
export const META_KEYS = {
  schedule: true,
  plan: true,
  due: true,
  priority: true,
  dependsOn: true,
  tags: true,
  repeat: true,
  condition: true,
  purpose: true,
  savepoint: true,
  special_note: true,
  close: true
} as const
```

**派生フィールド**（Meta に直接含まれない）:

- `memo` - 引用ブロック（`>`）から自動抽出
- セクション（見出し）レベルの `close` フラグ - section.close として昇格

## 新しいメタキーを追加する手順

### ステップ1: メタキーの標準名を決定

`src/lib/contract/canonical.ts` の `META_KEYS` に新キーを追加：

```typescript
export const META_KEYS = {
  // ... 既存
  newMetaKey: true,  // 新規追加
} as const
```

対応する型定義（`MetaKey`）も自動生成されます。

### ステップ2: 日本語別名を設定（オプション）

`src/lib/parser/meta-keys.ts` の `META_KEY_ALIASES` に別名を追加：

```typescript
export const META_KEY_ALIASES: Record<string, MetaKey> = {
  '新規メタ': 'newMetaKey',  // 新規追加
  // ... 既存
}
```

### ステップ3: パーサーを更新（必須）

`src/lib/parser/plugins/remark-meta-fields.ts` の `applyMetaKey()` に case を追加：

```typescript
function applyMetaKey(meta: Meta, key: string, value: string): void {
  const normalizedKey = normalizeMetaKey(key)
  switch (normalizedKey) {
    case META_KEYS.newMetaKey:
      meta.newMetaKey = parseNewMetaKeyValue(value)
      break
    // ... 既存のcase
  }
}
```

**重要**: `applyMetaKey` に case がないキーは、パース時に値が捨てられます。

### ステップ4: エディタ装飾を設定（オプション）

値に特別な表示形式が必要な場合、以下を確認・更新：

#### a) キー部分の色付け（通常は追加不要）

`src/editor/task-decoration.ts` の `META_RE` 正規表現を確認。
通常、正規表現が任意のキーにマッチするため、追加作業は不要。

#### b) 値のチップ表示や特別な装飾

`src/editor/metatag-decoration.ts` を確認。
特別な表現が必要な場合、新キーに対応するロジックを追加：

```typescript
// metatag-decoration.ts の値装飾ロジック
if (key === 'newMetaKey') {
  // 新キー用の特別な装飾処理
}
```

### ステップ5: バリデーション（値検証が必要な場合）

`src/editor/notation-lint.ts` で値形式を検証する場合、以下を更新：

```typescript
// notation-lint.ts
const META_LINE_RE = /^-\s*@(plan|schedule|due|priority|tags|dependsOn|newMetaKey)/

// 対応する検証関数を実装
function checkNewMetaKeyValue(value: string): boolean {
  // 値形式チェック
}

// linter のswitchで検証関数を呼び出し
switch (normalizedKey) {
  case 'newMetaKey':
    if (!checkNewMetaKeyValue(value)) {
      errors.push(`Invalid newMetaKey format: ${value}`)
    }
    break
}
```

**注意**: 現在、notation-lint は 6キー（plan, schedule, due, priority, tags, dependsOn）のみ検証。
その他のキーはlint対象外です。新キーに検証が必要な場合、明示的に追加してください。

### ステップ6: メタ行整形（自動整形対象にする場合）

`src/editor/reformat-meta-lines.ts` で、メタ行を推奨位置に自動配置する対象に含めたい場合：

```typescript
// reformat-meta-lines.ts の isMetaLine() 関数
const META_LINE_RE = /^-\s*@([\p{L}\p{N}_]+):/u

// これで新キーも自動的に「メタ行」として認識される
// （Unicode対応のため `\p{L}\p{N}_` を使用）
```

**既知の制限**: 現在、`reformat-meta-lines.ts` の正規表現が ASCII 限定（`\w+`）のため、
日本語エイリアスを持つキーはメタ行として認識されません。
修正が必要な場合は別途判断してください。

### ステップ7: テストを追加

各テストファイルに新キーのテストケースを追加：

#### `src/lib/parser/parse-markdown.test.ts`

```typescript
it('should parse newMetaKey', () => {
  const markdown = `- [ ] Task
  - @newMetaKey: someValue`
  const doc = parseMarkdown(markdown)
  expect(doc.nodes[0].meta.newMetaKey).toBe('someValue')
})
```

#### `src/editor/notation-lint.test.ts`（バリデーション必要な場合）

```typescript
it('should validate newMetaKey format', () => {
  const { errors } = lintNotation(`- [ ] Task\n  - @newMetaKey: invalid`)
  expect(errors).toContain('Invalid newMetaKey format')
})
```

#### `src/editor/metatag-suggest.test.ts`（サジェスト対応する場合）

```typescript
it('should suggest newMetaKey', () => {
  const suggestions = getMetaKeySuggestions('@newM')
  expect(suggestions).toContain('newMetaKey')
})
```

## チェックリスト（新キー追加時）

以下を順序通りに確認・完了してください：

- [ ] 1. `src/lib/contract/canonical.ts` - `META_KEYS` に追加
- [ ] 2. `src/lib/parser/meta-keys.ts` - 別名あれば `META_KEY_ALIASES` に追加
- [ ] 3. `src/lib/parser/plugins/remark-meta-fields.ts` - `applyMetaKey()` に case 追加
- [ ] 4. `src/editor/task-decoration.ts` - 確認（追加不要の場合が多い）
- [ ] 5. `src/editor/metatag-decoration.ts` - 特別な装飾必要なら追加
- [ ] 6. `src/editor/notation-lint.ts` - バリデーション必要なら追加
- [ ] 7. `src/editor/reformat-meta-lines.ts` - 整形対象にするなら確認
- [ ] 8. テストを追加（`*.test.ts` ファイル）
- [ ] 9. `npm run test:unit` でテスト通過確認
- [ ] 10. `npm run check` で型エラーなし確認
- [ ] 11. `npm run build` でビルド成功確認

## よくある追加シナリオ

### 単純な文字列値キーを追加

例: `@assignee: John`

**必須更新**:
1. `canonical.ts` - キー定義
2. `remark-meta-fields.ts` - value を string として格納

**オプション**:
- テスト追加

### 日付関連キーを追加

例: `@completed: 2026-10-15`

**必須更新**:
1. `canonical.ts` - キー定義
2. `remark-meta-fields.ts` - Date への変換処理
3. `notation-lint.ts` - 日付形式の検証

**オプション**:
- `metatag-decoration.ts` - 日付表示フォーマット
- 対応ビュー（Calendar等）の変更

### 複合値キー（複数値）を追加

例: `@stakeholders: Alice, Bob, Carol`

**必須更新**:
1. `canonical.ts` - キー定義
2. `remark-meta-fields.ts` - string[] への分割処理
3. `notation-lint.ts` - 値検証（不正なカンマ分割チェック等）

**推奨**:
- `metatag-decoration.ts` - 各値をチップ表示
- テスト（複数値のケース）

## 既知の制限と改善提案

### 制限1: 5ファイルの重複実装

正規表現とロジックが5ファイルに重複しており、管理が困難。

**改善案**: 統一レジストリを実装し、単一の定義から各モジュールが参照する構成。

### 制限2: Lint の6キー固定

`notation-lint.ts` は6キー（plan, schedule, due, priority, tags, dependsOn）のみ検証。

その他キー（repeat, condition, purpose, savepoint, special_note）の値検証は実装されていません。

**改善案**: すべてのキーに対応する統一バリデーションレジストリ。

### 制限3: `reformat-meta-lines.ts` の日本語非対応

正規表現 `\w+` が ASCII 限定のため、日本語別名を持つキーはメタ行として認識されない。

**改善案**: Unicode対応正規表現（`\p{L}\p{N}_`）に統一。

## 関連ドキュメント

- [ユーザー向けメタキーガイド](../../documents/LIBRARY_USAGE.md) - ユーザーが知るべき仕様
- [メタキーチェックリスト](../../documents/meta-key-checklist.md) - 既存のチェックリスト（本ガイドで統合）
- [データ契約仕様](../../documents/external-data-contract.spec.md) - ビュー間のデータ受け渡し仕様

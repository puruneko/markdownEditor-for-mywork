# obs-0008: カレンダー・ガントビューでアイテムが表示されない

## ステータス

Closed

## 概要

カレンダー/ガントビューのコンポーネント自体は表示されるが、マークダウンファイルに `@schedule` メタデータ付きタスクが存在してもアイテムが一切表示されない。

## 根本原因

`FileSync` が `active-leaf-change` イベントで `currentDoc` をクリアしている。

### 発生シーケンス

1. ユーザーがマークダウンファイルを編集中 → FileSync が `currentDoc` を保持している
2. ユーザーが「Calendar View を開く」コマンドを実行
3. `plugin.ts:openView()` → `setViewState({ type, active: true })` でカレンダーリーフを有効化
4. Obsidian が `active-leaf-change` イベントを発火
5. `file-sync.ts:handleActiveLeafChange()` が実行される:
   - `getActiveMarkdownFile()` → アクティブビューが CalendarView のため → **null**
   - `!file && this.currentFile !== null` → **`currentDoc = null`, `currentFile = null`** にクリア（`notify()` は呼ばれない）
6. `CalendarView.ts:onOpen()` が実行:
   - `fileSync.getCurrentDocument()` → **null** → `EMPTY_DOC` を使用
7. カレンダーが空のドキュメントで初期化 → アイテムなし

### 問題箇所

`src/sync/file-sync.ts` L72-79:

```ts
private handleActiveLeafChange = (): void => {
    const file = this.getActiveMarkdownFile()
    if (file && file.path !== this.currentFile?.path) {
      void this.parseFile(file)
    } else if (!file && this.currentFile !== null) {
      this.currentDoc = null    // ← ここでクリアされる
      this.currentFile = null
    }
  }
```

## 解決方針

`handleActiveLeafChange` の `else if` ブランチを削除する。非マークダウンビューに切り替えても最後にパースしたドキュメントを保持する。

カレンダー/ガント/ASTビューは最後に開いたマークダウンファイルのデータを表示すべきであり、非マークダウンビューへの切り替えでデータを消す必然性がない。

## TODO

- [ ] `src/sync/file-sync.ts` の `handleActiveLeafChange` から `else if` ブランチを削除する
- [ ] ビルド確認
- [ ] 全テストパス確認

## 完了条件

- マークダウンファイルに `@schedule` 付きタスクが存在する状態でカレンダービューを開くとアイテムが表示される
- ガントビューも同様にアイテムが表示される
- 全テストパス

## History

### 2026-03-25

- User Instruction:
  - obs-0008 を起票・実装する

- Change:
  - `src/sync/file-sync.ts` の `handleActiveLeafChange` から `else if (!file && this.currentFile !== null)` ブランチを削除（3行削除）

- Rationale:
  - ビルド成功、全テスト（E2E 4スペック）パス

## related_specs

- `project/specs/calendar-integration.spec.md`

## 関連Issue

- obs-0002（カレンダービュー統合）
- obs-0003（ガントビュー）

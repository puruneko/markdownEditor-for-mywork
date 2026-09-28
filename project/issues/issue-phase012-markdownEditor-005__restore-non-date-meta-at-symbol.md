# ライブプレビューで非日付メタ情報の「＠」記号を再び表示する

## 1. Background（背景）

`修正したい箇所.md` の markdownEditor 節:

> 日付以外のメタ情報は、wysiwygモードの場合は日付と同様に＠を消し緑の文字色・背景にして。
> - →@は消さないで。また、メタ情報のひとまとまりを薄いグレーで太めのドット線で囲って。

以前のサイクルで `issue-phase011-markdownEditor-002` が実装され、ライブプレビュー（Live Preview）表示時に、日付系メタ（`@plan`/`@schedule`/`@due`）と同様に、非日付メタ（`@status`、`@memo` 等）の「＠」記号も非表示にする変更が行われた。**今回の追記「→@は消さないで」は、この変更を取り消し、＠記号を再び表示させる要望である。**「メタ情報のひとまとまりを薄いグレーで太めのドット線で囲う」という別の要望は、本 issue の対象外とし、`issue-phase012-markdownEditor-006` で扱う。

### 現状（コード上、確認済みの事実）

`src/editor/metatag-decoration.ts` の `buildValueDecorations` 関数内に、＠記号を非表示にする処理が2箇所ある。

**箇所1（値付きの非日付メタ。例: `- @status: waiting`）** 184-198行付近:

```ts
} else {
  // issue-phase011-markdownEditor-002: 日付系と同様に、wysiwyg（Live Preview）かつ
  // カーソルが行に重なっていない場合のみ ＠ 記号を非表示にする。値のフォーマット
  // 変換やピッカーは不要なため、＠ 1文字だけを Decoration.replace（widget 省略）で
  // 消す軽量な方式にする（日付系の MetaDateChipWidget は流用しない）。
  const overlapsSelection = selection.ranges.some(
    (r) => r.to >= keyStart && r.from <= valueEnd,
  )
  if (livePreview && !overlapsSelection) {
    builder.add(keyStart, keyStart + 1, Decoration.replace({}))
  }
  builder.add(
    valueStart,
    valueEnd,
    Decoration.mark({
      class: `metatag metatag-value metatag-${canonicalKey}${tentative ? ' metatag-tentative' : ''}`,
    }),
  )
}
```

**箇所2（コロンなしの裸のメタキー。例: `- @memo`）** 203-222行付近:

```ts
} else {
  // コロンなしの裸のメタキー（例: `@memo`）。task-decoration.ts の正規表現はコロン必須
  // のためここでキー部分自体を装飾する。
  // issue-phase011-markdownEditor-002: 値付きメタと同様に ＠ を非表示にする。
  // ＠ の Decoration.replace とキー本体の Decoration.mark が同じ開始位置で重なると
  // RangeSetBuilder がエラーになるため、非表示時はマークの開始位置を1文字分ずらす。
  const overlapsSelection = selection.ranges.some(
    (r) => r.to >= keyStart && r.from <= colonPos,
  )
  const hideAt = livePreview && !overlapsSelection
  if (hideAt) {
    builder.add(keyStart, keyStart + 1, Decoration.replace({}))
  }
  builder.add(
    hideAt ? keyStart + 1 : keyStart,
    colonPos,
    Decoration.mark({
      class: `metatag metatag-key metatag-${canonicalKey}${tentative ? ' metatag-tentative' : ''}`,
    }),
  )
}
```

日付系メタ（`@plan`/`@schedule`/`@due`）は、これら2箇所とは別の分岐（`MetaDateChipWidget` を使う `Decoration.replace`）で処理されており、**本 issue では変更しない**（引き続き＠を含めてチップ表示に置き換える）。

## 2. Objective（目的）

ライブプレビュー表示で、非日付メタ情報（値付き・裸のキーのいずれも）の「＠」記号が表示されるようにする。緑の文字色・背景の装飾（`Decoration.mark`）は維持する。

## 3. Scope（スコープ）

- `src/editor/metatag-decoration.ts` の `buildValueDecorations` 関数内、非日付メタを扱う上記2箇所のみ。
- 対象外: 日付系メタ（`@plan`/`@schedule`/`@due`）のチップ表示ロジック。メタ情報のまとまりを枠で囲む機能（`issue-phase012-markdownEditor-006` で対応）。

## 4. Implementation requirements（実装要件）

### 4.1 値付きの非日付メタ（184-198行付近）

`overlapsSelection` の計算と、それに続く `if (livePreview && !overlapsSelection) { builder.add(keyStart, keyStart + 1, Decoration.replace({})) }` のブロックを削除する。値部分（`valueStart` から `valueEnd`）への `Decoration.mark` はそのまま残す。関連するコメント（`issue-phase011-markdownEditor-002: ...`）も削除する。

変更後のイメージ:

```ts
} else {
  builder.add(
    valueStart,
    valueEnd,
    Decoration.mark({
      class: `metatag metatag-value metatag-${canonicalKey}${tentative ? ' metatag-tentative' : ''}`,
    }),
  )
}
```

### 4.2 裸のメタキー（203-222行付近）

`overlapsSelection` と `hideAt` の計算、およびそれに続く `if (hideAt) { builder.add(keyStart, keyStart + 1, Decoration.replace({})) }` のブロックを削除する。キー部分への `Decoration.mark` の開始位置は、常に `keyStart`（`hideAt` による分岐をなくし、`hideAt ? keyStart + 1 : keyStart` を単に `keyStart` にする）にする。関連するコメントも削除する。

変更後のイメージ:

```ts
} else {
  builder.add(
    keyStart,
    colonPos,
    Decoration.mark({
      class: `metatag metatag-key metatag-${canonicalKey}${tentative ? ' metatag-tentative' : ''}`,
    }),
  )
}
```

### 4.3 変更しないもの

- 日付系メタ（`MetaDateChipWidget` を使う分岐）。
- `metatag-value` / `metatag-key` の CSS（`styles/metatag-wysiwyg.css`）の色・背景の定義自体。

## 5. Files / components likely to be changed（変更が見込まれるファイル／コンポーネント）

- `src/editor/metatag-decoration.ts`
- `tests/obs-e2e/metatag-decoration.e2e.ts`（テストの期待値を修正）

## 6. Dependencies（依存関係）

- 前提条件: 他の4リポジトリ（calendar / gantt / kanban / dashboard）の未コミットの作業ツリーが、プロジェクト管理者によってベースラインとしてコミットされていること。
- このリポジトリ内での依存: なし。単独で着手可能。
- 後続: `issue-phase012-markdownEditor-006__meta-block-dotted-border.md` は同じファイル（`metatag-decoration.ts`）を変更するため、本 issue の完了後に着手すること。

## 7. Acceptance criteria（受け入れ基準）

- ライブプレビューで、`- @status: waiting` のような値付きの非日付メタの「＠」記号が表示され、キーと値の緑系の装飾が維持されていること。
- ライブプレビューで、`- @memo` のような裸のメタキーの「＠」記号が表示され、キー部分の緑系の装飾が維持されていること。
- 日付系メタ（`@plan`/`@schedule`/`@due`）の表示（チップ形式、＠を含まない）が変わらないこと。

## 8. Test requirements（テスト要件）

`tests/obs-e2e/metatag-decoration.e2e.ts` を次のように修正する。

- `issue-phase011-markdownEditor-002` で追加された「値付き非日付メタの＠が非表示になる」ことを検証するテストケースを、「＠が表示される」ことを検証するように反転する。
- 同様に「裸キーの＠が非表示になる」ことを検証するケースも、「＠が表示される」ことを検証するように反転する。
- 「カーソルが行に重なったときに＠が復元される」ことを検証していたケースは、＠を常に非表示にする分岐自体がなくなるため意味を持たなくなる。このケースは削除し、代わりに「カーソルの有無に関わらず＠の表示が変わらない」ことを検証するケースに置き換える。
- 日付系メタの表示を確認する既存の回帰テストケースは変更しない。

実行コマンド: `npm run test:unit`、`npm run build`、`npm run test:obs:e2e`。`test:obs:e2e` が実行できない環境の場合は、`- @memo`、`- @status: waiting`、`- @due: 2026-10-01` を含むノートをライブプレビューで開いたスクリーンショットを issue に添付する。

## 9. Out of scope（対象外）

- メタ情報のまとまりを薄いグレーの太いドット線で囲む機能（`issue-phase012-markdownEditor-006` で対応する）。
- 日付系メタの表示形式の変更。

## 要確認

- なし。

## Progress & Implementation Notes

### History

#### 2026-09-27

- User Instruction:
  - project/governance のルールに従い、issue-phase012 シリーズを順番にすべて実装する

- Change:
  - `src/editor/metatag-decoration.ts` の `buildValueDecorations()`:
    - 値付き非日付メタの分岐（184-198行付近）から、`overlapsSelection` の計算と `Decoration.replace` による ＠ 非表示ブロックを削除した。値部分への `Decoration.mark` はそのまま残した
    - コロンなしの裸のメタキー分岐（203-222行付近）から、`overlapsSelection`・`hideAt` の計算と `Decoration.replace` ブロックを削除した。キー部分への `Decoration.mark` の開始位置は常に `keyStart`（`hideAt` による分岐を廃止）にした
    - ファイル冒頭の JSDoc コメントを、issue-phase011-markdownEditor-002 で追加した「非日付メタの＠非表示」の記述から、本 issue で取り消した旨の記述に更新した
    - 日付系メタ（`MetaDateChipWidget` を使う分岐）・`metatag-value`/`metatag-key` の CSS 定義は変更していない
  - `tests/obs-e2e/metatag-decoration.e2e.ts`: issue-phase011-markdownEditor-002 で追加した3件のテストケース（値付き非日付メタの＠非表示・裸キーの＠非表示・カーソル重なり時の＠復元）を、Test requirements の指示どおり反転・置換した（＠が表示されることを検証する内容に変更。カーソル関連のケースは「カーソルの有無に関わらず＠の表示が変わらない」ことを検証する内容に置き換えた）。日付系メタの回帰確認ケースは変更していない

- Rationale:
  - Implementation requirements の「変更後のイメージ」どおり、削除対象を過不足なく削除した。日付系メタ・CSS 定義には一切触れていない

- Verification:
  - `npx vitest run` → 26 test files / 536 tests すべて成功（本 issue はエディタ拡張機能のコード変更のみで、対象の単体テストは存在しないため既存件数のまま）
  - `npx tsc --noEmit` → 変更ファイルに起因する型エラーなし
  - `node esbuild.config.mjs production` → ビルド成功
  - **実機 Obsidian E2E 検証を実施**: `metatag-decoration.e2e.ts`（13件成功。反転・置換した4件を含む）、`task-decoration.e2e.ts`（8件成功）を実行し、＠記号が再び表示されること・緑装飾が引き続き適用されること・日付系メタの表示に変化が無いこと・カーソルの有無に関わらず表示が一定であることを確認した

- Status: 実装完了・実機E2E検証済み。ユーザーの明示的な承認待ちのため Issue は Open のまま（WORKFLOW.md §6）。

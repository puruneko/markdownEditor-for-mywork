# 連続するメタ行のまとまりを薄いグレーの太いドット線で囲む

## 1. Background（背景）

`修正したい箇所.md` の markdownEditor 節:

> 日付以外のメタ情報は、wysiwygモードの場合は日付と同様に＠を消し緑の文字色・背景にして。
> - →@は消さないで。また、メタ情報のひとまとまりを薄いグレーで太めのドット線で囲って。

「＠は消さないで」の部分は `issue-phase012-markdownEditor-005` で対応する。本 issue は「メタ情報のひとまとまりを薄いグレーで太めのドット線で囲って」の部分のみを対象とする。

ユーザーへの確認により、「ひとまとまり」とは **タスクや見出しの直下に連続して並ぶメタ行（`- @key: value` または `- @key`）** を指すことが判明している。

### 現状（コード上、確認済みの事実）

- メタ行の判定には、既に `src/editor/metatag-decoration.ts`（32行）に次の正規表現が定義されている:
  ```ts
  const META_LINE_RE = /^(\s*- )@([\p{L}\p{N}_]+)(\?)?(?::(.*))?$/u
  ```
  この正規表現は、行頭のインデント＋`- `＋`@キー名`（コロンありなしどちらも）に一致する。**本 issue でもこの既存の正規表現をそのまま使い、新しい正規表現を作らないこと。**
- ライブプレビューかどうかの判定は、`editorLivePreviewField`（`obsidian` パッケージからの import。91行付近で `view.state.field(editorLivePreviewField, false)` として取得）を使う。**本 issue でもこの既存の判定方法を使う。**
- メタ行を装飾する枠を描く機能は、現時点で存在しない（`dotted` という文字列は `styles/` と `src/editor/` のいずれにも存在しない）。
- エディタのスタイルシート（`styles/*.css`）は Shadow DOM の外にあり、Obsidian のテーマ変数（`var(--background-modifier-border-hover)` 等）を使ってテーマに自動追従する既存方針を持つ（`styles/metatag-wysiwyg.css` 冒頭のコメントに明記されている）。**本 issue で追加する枠の色も、この既存方針に従い Obsidian の変数を使うこと。**
- `esbuild.config.mjs` は `styles/base.css`・`styles/heading-emphasis.css`・`styles/metatag-raw.css`・`styles/metatag-wysiwyg.css` の4ファイルを結合して `styles.css` を生成する（ビルド時に自動実行される）。**新しい CSS 規則は `styles/metatag-wysiwyg.css` に追記すればよく、`styles.css` を直接編集してはならない**（ビルドで上書きされるため）。

## 2. Objective（目的）

ライブプレビュー表示で、タスクや見出しの直下に連続して並ぶメタ行のまとまりを、薄いグレーの太いドット線の枠で囲んで表示する。

## 3. Scope（スコープ）

- `src/editor/metatag-decoration.ts`: メタ行のまとまりを判定し、行ごとに装飾クラスを付与する新しい CodeMirror `ViewPlugin` の追加。
- `src/plugin.ts`: 新しい `ViewPlugin` の登録。
- `styles/metatag-wysiwyg.css`: 枠のスタイル定義の追加。
- 対象外: ソースモード（Live Preview がオフの状態）での表示（枠を描かない）。メタ行の並び替えやリント機能（`reformat-meta-lines.ts`、`notation-lint.ts`）。

## 4. Implementation requirements（実装要件）

### 4.1 まとまりの判定規則

- 対象となる行は、既存の `META_LINE_RE`（`src/editor/metatag-decoration.ts` 32行）に一致する行。
- 連続するメタ行のうち、**先頭のインデント（`- ` の前の空白文字列）が完全に一致するもの**を1つのまとまりとする。インデントが異なる行（例: 親タスクの直下のメタ行と、その子タスクの直下のメタ行）は、別々のまとまりとして扱う。
- メタ行ではない行、または空行が現れた時点で、まとまりを区切る。
- 1行だけで構成されるまとまりも対象とする（単一行でも枠を描く）。
- ライブプレビューのとき（`editorLivePreviewField` が true）にのみ枠を描く。ソースモードでは描かない。
- カーソルがまとまりの中の行にあっても、枠は描いたままにする（枠の表示・非表示を選択状態で切り替えると、行の高さや見た目がちらつくため、常に表示する）。

### 4.2 実装方法

`src/editor/metatag-decoration.ts` に、新しい CodeMirror の `ViewPlugin`（例: `metatagBlockPlugin`）を追加し、`export` する。

- `view.visibleRanges` の各表示範囲内の行を走査し、`META_LINE_RE` に一致するかどうかと、そのインデント文字列を調べる。表示範囲の前後の行（表示範囲の外）を `view.state.doc.line(n - 1)` / `line(n + 1)` で取得し、まとまりの先頭・末尾を正しく判定すること（表示範囲の境界で誤って区切ってしまわないようにするため）。
- 各行について、そのまとまりの中での位置に応じて、`Decoration.line()` で次のいずれかのクラスを付与する。
  - まとまりが1行だけの場合: `cm-metablock cm-metablock-single`
  - まとまりの先頭行（かつ複数行）: `cm-metablock cm-metablock-first`
  - まとまりの中間行: `cm-metablock cm-metablock-mid`
  - まとまりの末尾行（かつ複数行）: `cm-metablock cm-metablock-last`
- 装飾の再計算のタイミングは、既存の `metatagValuePlugin`（`ViewPlugin.fromClass` で実装されている、同ファイル内の既存のプラグイン）と同様に、`update.docChanged || update.viewportChanged` のときに再計算する。**選択範囲の変化（`update.selectionSet`）では再計算しない**（枠の表示はカーソル位置に依存しないため）。

### 4.3 `src/plugin.ts` への登録

既存の `this.registerEditorExtension(metatagValuePlugin)`（183行付近）の近くに、`this.registerEditorExtension(metatagBlockPlugin)` を追加する。`metatagBlockPlugin` を `./editor/metatag-decoration` から import すること。

### 4.4 `styles/metatag-wysiwyg.css` へのスタイル追加

ファイル末尾に、次のような規則を追加する（色の値は Obsidian の変数を使い、フォールバック値も付ける。既存の `metatag-wysiwyg.css` 内の他の規則と同じ書式に合わせること）。

```css
.cm-metablock {
  --metablock-border: 2px dotted var(--background-modifier-border-hover, #c8c8c8);
  border-left: var(--metablock-border);
  border-right: var(--metablock-border);
}
.cm-metablock-first,
.cm-metablock-single {
  border-top: var(--metablock-border);
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
}
.cm-metablock-last,
.cm-metablock-single {
  border-bottom: var(--metablock-border);
  border-bottom-left-radius: 4px;
  border-bottom-right-radius: 4px;
}
```

## 5. Files / components likely to be changed（変更が見込まれるファイル／コンポーネント）

- `src/editor/metatag-decoration.ts`
- `src/plugin.ts`
- `styles/metatag-wysiwyg.css`
- `src/editor/metatag-block.test.ts`（新規のテストファイル）
- `tests/obs-e2e/metatag-decoration.e2e.ts`（テスト追加）

## 6. Dependencies（依存関係）

- 前提条件: 他の4リポジトリ（calendar / gantt / kanban / dashboard）の未コミットの作業ツリーが、プロジェクト管理者によってベースラインとしてコミットされていること。
- **同じファイル（`src/editor/metatag-decoration.ts`）を変更するため、`issue-phase012-markdownEditor-005__restore-non-date-meta-at-symbol.md` の完了後に着手すること。**

## 7. Acceptance criteria（受け入れ基準）

- ライブプレビューで、タスクの直下に連続して並ぶ3行のメタ行（例: `@status`、`@schedule`、`@priority`）が、1つの薄いグレーの太いドット線の枠で囲まれる。
- 1行だけのメタ行も、同様に枠で囲まれる。
- インデントの異なるメタ行（例: 親タスクのメタ行と子タスクのメタ行）は、別々の枠になる。
- メタ行の間に空行や通常の文章行が挟まると、そこで枠が区切られる。
- ソースモードに切り替えると、枠が表示されない。

## 8. Test requirements（テスト要件）

- まとまりの判定ロジックを純粋関数（例: `classifyMetaBlockLines(lines: string[]): ('single' | 'first' | 'mid' | 'last' | null)[]`）として切り出し、`src/editor/metatag-block.test.ts` で次のケースを検証する:
  - 1行のみのメタ行。
  - 3行連続するメタ行。
  - メタ行の途中に空行が挟まる場合。
  - インデントの異なるメタ行が連続する場合（別々のまとまりとして扱われること）。
  - メタ行ではない通常の行が挟まる場合。
  - コロンなしの裸のメタキー（`- @memo`）を含む場合。
- `tests/obs-e2e/metatag-decoration.e2e.ts` に、ライブプレビューで3行のメタ行のまとまりを持つノートを開き、先頭行に `cm-metablock-first` クラス、末尾行に `cm-metablock-last` クラスが付与されていることを確認するケースを追加する。同様に、ソースモードに切り替えると `cm-metablock` クラスが付与されないことを確認するケースを追加する。
- 実行コマンド: `npm run test:unit`、`npm run build`、`npm run test:obs:e2e`。`test:obs:e2e` が実行できない環境の場合は、ライブプレビューでの表示のスクリーンショットを issue に添付する。

## 9. Out of scope（対象外）

- ソースモードでの枠の表示。
- メタ行の並び替えやリント（`reformat-meta-lines.ts`、`notation-lint.ts`）の変更。
- 見出しや本文の行への枠の適用。

## 要確認

- 長い値を持つメタ行が折り返された場合や、折りたたまれた見出しの配下にあるメタ行の枠の見た目については、具体的な仕様の指定がない。実装後にスクリーンショットで崩れがないかを確認し、崩れがある場合はこの issue の中で調整すること。推測で仕様を追加しないこと。

## Progress & Implementation Notes

### History

#### 2026-09-27

- User Instruction:
  - project/governance のルールに従い、issue-phase012 シリーズを順番にすべて実装する

- Change:
  - `src/editor/metatag-decoration.ts`:
    - `classifyMetaBlockLines(lines: string[]): (MetaBlockPos | null)[]` を新設・export。既存の `META_LINE_RE` をそのまま使い、行配列を先頭走査してインデント（キャプチャグループ1）が連続一致する区間を1つのまとまりとして `'single' | 'first' | 'mid' | 'last' | null` を割り当てる純粋関数
    - `classifyDocLine(doc, lineNo)`: 対象行の前後1行を `doc.line(n±1)` で直接取得し、3行分の窓を `classifyMetaBlockLines` に渡して中央要素を得ることで、表示範囲の境界でも正しく判定できるようにした（ロジックの重複を避けて同じ純粋関数を再利用）
    - `buildMetaBlockDecorations(view)`: `editorLivePreviewField` が false（ソースモード）なら何も描画しない。`view.visibleRanges` の各行に対し `Decoration.line()` で `cm-metablock cm-metablock-<pos>` を付与する
    - `metatagBlockPlugin`（`ViewPlugin`）を新設・export。`docChanged || viewportChanged` に加え、**`editorLivePreviewField` の値自体の変化（ライブプレビュー⇔ソースモードの切り替え）も再計算のトリガーに追加した**（後述のE2E検証で必要と判明したため追加）。選択範囲の変化（`selectionSet`）では再計算しない（Implementation requirements どおり）
  - `src/plugin.ts`: `metatagBlockPlugin` を import し、`metatagValuePlugin`/`metatagPickerExtension` の直後に `registerEditorExtension` した
  - `styles/metatag-wysiwyg.css`: Issue本文で指定されたとおりの `.cm-metablock` 系のCSS規則をファイル末尾に追記した（内容は指示どおり、変更なし）
  - 単体テスト新設: `src/editor/metatag-block.test.ts`（9件。1行/3行/4行のまとまり、空行区切り、インデント違い、通常行区切り、裸キー、空配列、メタ行なし）
  - `tests/obs-e2e/metatag-decoration.e2e.ts` に2件追加（3行のまとまりに first/mid/last が付与されること、ソースモードでは `cm-metablock` が付与されないこと）

- **実機E2E検証で発見・修正したバグ**: 追加当初、`metatagBlockPlugin.update()` が `docChanged || viewportChanged` のみで再計算しており、`editor:toggle-source` コマンドでソースモードに切り替えても `.cm-metablock` が消えないという実際の不具合を実機テストで検出した。原因は、ライブプレビュー⇔ソースモードの切り替えがドキュメント内容にもビューポートにも影響しない CM6 の状態遷移であるため。`update.startState`/`update.state` それぞれの `editorLivePreviewField` を比較し、値が変化した場合も再計算するよう修正した。TESTING_STANDARD.md「Failing test = implementation incomplete. Fix the system.」に従い、テストを緩めず実装を修正した

- Rationale:
  - `classifyMetaBlockLines` を純粋関数として独立させ、CM6 依存のライブ判定ロジック（`classifyDocLine`）から呼び出す設計にすることで、Test requirements が求める「まとまりの判定ロジックを純粋関数として切り出す」を満たしつつ、実際の描画ロジックとの二重実装を避けた

- Verification:
  - `npx vitest run` → 27 test files / 545 tests すべて成功（新設9件含む）
  - `npx tsc --noEmit` → 変更ファイルに起因する型エラーなし
  - `node esbuild.config.mjs production` → ビルド成功
  - **実機 Obsidian E2E 検証を実施**: `metatag-decoration.e2e.ts` → 15件すべて成功（新設2件含む。うち1件は上記のバグ修正後に成功するようになった）
  - **目視確認（実機スクリーンショット）を実施**: 見出し・複数タスク・裸キー（`@memo`）・長い値（折り返しあり）・ネストした子タスクを含むノートをライブプレビューで開き、いずれのまとまりも崩れなく角丸のドット線で囲まれることを確認した（長い値の折り返し・インデント違いの別まとまり分離を含む）。スクリーンショットは一時検証用スペックで撮影後、スペック自体は削除済み（`tests/obs-e2e/screenshots/` は gitignore 対象）

- Status: 実装完了・実機E2E検証済み・目視確認済み。ユーザーの明示的な承認待ちのため Issue は Open のまま（WORKFLOW.md §6）。

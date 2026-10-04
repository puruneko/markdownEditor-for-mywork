# Title
リスト直後の `→` / `->` を強調表示（太字・やや大きく・明るめの青）

## Background
- リポジトリ: `markdownEditor-for-mywork`（Obsidian プラグイン）。
- 要望: 「リスト直後の→と->を太字で少しだけフォントサイズ大きくして少し明るめの青字にして」。
- `src/editor/task-decoration.ts` は行ごとの正規表現＋`Decoration.mark` 構造（`META_RE` 24行付近、タスク正規表現 44行付近）。
- 要望の解釈は仮決め（下記）。

## Objective
リストマーカー（またはチェックボックス）直後に置かれた `→` / `->` の1〜2文字だけに専用クラスを付与し、CSSで強調表示する。

## Scope
`task-decoration.ts` への検出関数と mark 追加、CSS、テスト。

## Implementation requirements
1. `task-decoration.ts` に純粋関数 `findListArrow(lineText: string): {from:number,to:number}|null` を export。目安の正規表現: `^(\s*)([-*+]|\d+[.)]) (\[[^\]]\] )?(→|->)`。矢印部分の範囲のみ返す。
   - `- [>] a` は `[ ]` 内の `>` なのでマッチしないこと（`->` を要求するため自然に外れる）。
   - `- @key:` 行はマーカー直後が `@` なので構造的に対象外（追加の除外ロジックは不要）。
2. 既存の行ループに `Decoration.mark({class:'md-ast-list-arrow'})` を追加（クラス接頭辞は既存の `md-ast-` に合わせる。`.mdx-` は使わない）。他の装飾（タスク状態・メタ）とは mark 同士で共存させる。新ファイルは作らない。
3. CSS（既存の task-decoration 用スタイルに追記。場所は要確認）:
   `.md-ast-list-arrow { font-weight: bold; font-size: 1.1em; color: var(--color-blue); }`
4. 仮決め事項（issue内容として確定扱い）: 行頭マーカー直後のみ対象／文字は置換しない（元の `→`/`->` のまま装飾のみ）／色は `--color-blue`。

## Files / components likely to be changed
`src/editor/task-decoration.ts`, 既存のスタイル定義（`styles/` 配下）, 単体テスト, E2E テスト

## Dependencies
なし。同一リポジトリの「分刻み設定化」issue とは並行可能。

## Acceptance criteria
- 下記の対象行で矢印のみが太字・1.1em・青で表示され、非対象行は変化しない。
- ライブプレビューでカーソルが当該行にあっても表示が崩れない。
- ライト/ダーク両テーマで青が視認できる（実機確認）。
- 単体・E2E green。

## Test requirements
- 単体 `findListArrow`: `- → a`○ / `- -> a`○ / `1. -> a`○ / `- [ ] -> a`○ / `- [>] a`× / `- a -> b`× / `- @memo: -> x`× / `-> a`（非リスト）×。
- E2E: ライブプレビューで `md-ast-list-arrow` クラスが付与されること、カーソル行でも崩れないこと。
- 手動: 色・サイズをライト/ダークで確認。

## Out of scope
- 行中・行末の矢印の強調
- 矢印文字の置換・変換
- メタ情報の折りたたみ（別件・要望の意味が未確定のため issue 化保留）

## Implementation status
- 実装完了（単体テスト green）。E2E・実機確認は未実施。クローズはユーザー承認待ち。

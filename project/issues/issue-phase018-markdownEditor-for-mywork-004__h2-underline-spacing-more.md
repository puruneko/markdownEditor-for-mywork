# H2 の下線と次の行の文字の間隔をさらに広げる

## 背景
- リポジトリ: `markdownEditor-for-mywork`。
- 要望原文:
  > H2の装飾の下線が次の行の文字にかぶっているので、もう少し下に間をあけて
  > 　@rv: もっと間をあけて
- 前回（phase017）は H2 行（`.cm-line.HyperMD-header-2`）に `padding-bottom: 6px` を追加した。下線の位置（見出し文字との距離）は変えず、下線と次行の間に余白を足す方針で、@rv はその方針を否定せず「もっと」と言っている。
- 採用した解釈: 方針は前回のまま、余白を広げる。具体値の指定は原文に無いため、下線の下端から次行の文字の上端まで 12px 以上あくことを基準にする。あわせて、前回の指定が Obsidian 側の CSS に負けて効いていない可能性があるため、実際に効いているかを確認し、効いていなければ詳細度を上げる。

## 目的
H2 の下線と次の行の文字が、はっきり離れて見えるようにする。

## 現状
- `styles/heading-emphasis.css:29-43` 付近:
  - `.cm-header-2 { font-size: 1.25em; font-weight: 700; border-bottom: 3px solid var(--text-muted, #888888); padding-bottom: 1px; }`（下線は見出し文字のインライン span に付く）
  - `.cm-line.HyperMD-header-2 { padding-bottom: 6px; }`（phase017 で追加）
- `styles.css` は `esbuild.config.mjs` が `styles/*.css` を結合して生成するビルド生成物。直接編集しない（編集は `styles/heading-emphasis.css`）。
- E2E: `tests/obs-e2e/heading-emphasis.e2e.ts`（H2 の下線についてのテストあり。`getComputedStyleProp` ヘルパーあり）。

## 実装内容
1. `styles/heading-emphasis.css` の H2 行の余白を `padding-bottom: 14px` に広げる。
2. Obsidian 上で `.HyperMD-header-2` の `padding-bottom` の計算値が指定どおりになっているかを確認する。ならない場合（Obsidian 側の `.cm-line` の指定に負けている場合）は、セレクタを `.markdown-source-view.mod-cm6 .cm-line.HyperMD-header-2` にして詳細度を上げる。
3. インラインの下線は行の高さの計算に含まれないため、下線の下端と次行の文字の上端の実距離で確認し、12px に満たなければ余白をさらに増やす。

## 完了条件
- Obsidian のライブプレビューで、H2 の下線の下端から次の行の文字の上端まで 12px 以上あいている。
- H2 の下線の位置（見出し文字の直下・灰色・文字幅のみ）は変わらない。
- `npm run build` で生成された `styles.css` に変更が反映されている。

## テスト
- `tests/obs-e2e/heading-emphasis.e2e.ts` に追加: H2 の直後に本文行がある文書で、`.cm-header-2` の `getBoundingClientRect().bottom` と次の `.cm-line` の文字の上端（次行要素の `top` + `padding-top`）の差が 12px 以上であること。
- `.HyperMD-header-2` の `padding-bottom` の計算値が指定値と一致することも確認する。
- `npm run test:obs:e2e` の該当テストが通ること。

## 依存関係
なし

## 対象外
- H1・H3 以降の見出しの装飾。
- 下線の太さ・色の変更。

## 要確認
なし

## 実装結果（2026-10-03）
- padding-bottom 16px（詳細度を上げたセレクタ）。下線下端〜次行文字上端 12px 以上を E2E（heading-emphasis.e2e.ts）で確認。14px では 10.06px だったため 16px にした。

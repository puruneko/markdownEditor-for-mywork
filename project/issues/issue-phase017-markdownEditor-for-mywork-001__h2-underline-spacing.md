# H2 見出しの下線と次行の文字の間に間隔をあける

## 背景
- リポジトリ: `markdownEditor-for-mywork`。
- 要望原文:
  > H2の装飾の下線が次の行の文字にかぶっているので、もう少し下に間をあけて
- 採用した解釈: 下線の位置（見出し文字との距離）はそのままにし、下線と次行の文字の間に余白を足す。「下に間をあけて」の素直な読みで、見出しの見た目の変更を最小にできるため。

## 目的
H2 の下線が次行の文字に重ならず、見た目で余白が確認できる。

## 現状
- `styles/heading-emphasis.css` 33-38行:
  ```css
  .cm-header-2 { font-size: 1.25em; font-weight: 700; border-bottom: 3px solid var(--text-muted, #888888); padding-bottom: 1px; }
  ```
- `styles.css`（リポジトリ直下）はビルド生成物。`esbuild.config.mjs` が `styles/*.css` を結合して書き出す。直接編集しない。
- `.cm-header-2` は行内のスパンに付くため、`padding-bottom`/`border-bottom` は行の高さを増やさず、次行へはみ出して重なる。

## 実装内容
1. `styles/heading-emphasis.css` で、H2 を含む行（CM6 の行要素）の下に余白を足す。
   - 推奨: H2 行の行要素に `padding-bottom`（目安 6px）を付ける。Obsidian の Live Preview では行要素に `HyperMD-header-2` クラスが付くため `.cm-line.HyperMD-header-2` を対象にする。Source Mode で同クラスが付かない場合は、両モードで効くセレクタを実機で確認して選ぶ。
   - `.cm-header-2` 自体の `border-bottom`・`padding-bottom` の値は変更しない。
2. 既存コメント（issue-phase003-008/013 の経緯）の後に、本 issue 番号と変更理由を1行追記。
3. `npm run build` で `styles.css` を再生成し、Obsidian で確認。

変更ファイル: `styles/heading-emphasis.css`（`styles.css` は再生成）

## 完了条件
- Live Preview と Source Mode の両方で、H2 の下線と次行の文字の間に余白があり、重ならない。
- H1・H3 など他の見出しの見た目は変わらない。
- `styles.css` が再生成されている。

## テスト
- CSS のみのため自動テストは不要。
- 手動: H2 の直後に本文行・リスト行・メタ行がある3パターンを、Live Preview / Source Mode で確認。

## 依存関係
なし

## 対象外
- 下線の色・太さ・長さの変更。

## 要確認
- 余白量（目安 6px）は実機で調整してよい。

## History

### 2026-10-03

- User Instruction:
  - phase017 の issue を順に実装

- Change:
  - 実装済み（単体テスト・ビルド green）。Obsidian 実機確認とクローズ承認は未実施のため Open のまま。

- Rationale:
  - WORKFLOW §6: ユーザー承認なしに closure しない。

# 編集モードでのH1/H2見出し強調

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
Obsidianの編集モード（Live Preview）では、見出し（`#`/`##`）が本文と視覚的にほとんど区別されず、「ここから新しい案件・セクションが始まる」という構造上の切れ目が一目で分かりにくい。特にH1は文書内で大きな区切り（案件単位）を表すため、編集中でも強く目立つ必要がある。

### 方針
- H1（`# 見出し`）: 行の高さを広げ、文字を大きくし、薄い青系の背景を敷いた「バナー」のような見た目にし、案件の開始点であることを一目で分かるようにする。
- H2（`## 見出し`）: H1ほどではないが文字をやや大きくし、太めの下線を引く。
- 対象は編集モード（Live Preview）のみ。Reading View（プレビュー表示）・H3以下は対象外。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- 着手時に**一度だけ** `project/governance/` を確認（`AI_RUNTIME_RULES.md` のロード順）。
- **テスト観点とテストコードは毎回すべて見直す**（`TESTING_STANDARD.md` 準拠）。

### 依存
- なし。CSSのみで完結する（新規ロジック・新規Decorationは不要）。

### 事前調査（実機で確認済み・必読）
Obsidian Live Preview は見出し行に以下のクラスを自動で付与する（`tests/obs-e2e/` からの実機プローブで確認済み。Obsidian独自の内部実装であり本プラグインのコードには存在しない）:

- 見出し行全体（`.cm-line`）: `HyperMD-header HyperMD-header-<N>`（例: H1なら `HyperMD-header HyperMD-header-1`）。
- 見出しテキスト・`#`マーカー双方を覆うインラインspan: `cm-header cm-header-<N>`。
- `#`マーカー自体のspanはこれに加えて `cm-formatting cm-formatting-header cm-formatting-header-<N>` も持つ（`cm-header-<N>` も併せ持つため、インラインspan側のスタイルはマーカーにも自然に適用される）。

これらのクラスは **Reading View（プレビュー）には存在しない**（Reading Viewは実際の `<h1>`/`<h2>` 要素をテーマのCSSで描画するため、本Issueのスコープ外）。

### 仕様（確定事項：迷ったらこれに従う）
- 新規ファイル `styles/heading-emphasis.css` を作成し、`esbuild.config.mjs` の `stylesBundlePlugin` の結合対象リストに追加する（`styles/base.css` → `styles/heading-emphasis.css` → `styles/metatag-raw.css` → `styles/metatag-wysiwyg.css` の順。既存3ファイルの順序・内容は変更しない）。
- H1:
  - `.HyperMD-header-1`（行全体）: 背景 = 薄い青系。`background: rgba(var(--color-blue-rgb, 58, 111, 216), 0.12);`。`padding: 10px 12px;` で行の高さを広げる。`line-height: 1.8;`。左端に `border-left: 4px solid var(--color-blue, #3a6fd8);` のアクセント。`border-radius: 4px;`。
  - `.cm-header-1`（インラインテキスト）: `font-size: 1.6em; font-weight: 700;` で文字を大きくする。
- H2:
  - `.HyperMD-header-2`（行全体）: `border-bottom: 3px solid var(--color-blue, #3a6fd8); padding-bottom: 4px;` で太めの下線を行の全幅に引く。
  - `.cm-header-2`（インラインテキスト）: `font-size: 1.25em; font-weight: 700;` で少し文字を大きくする。
- 色は `--color-blue`/`--color-blue-rgb`（Obsidian組み込みのセマンティック変数）を使用し、Obsidianの外観設定（ライト/ダーク）に自動追従させる（`issue-phase003-008` のダーク/ライト対応方針と同一の考え方。固定の`.theme-dark`分岐は持たない）。
- 色は青系を採用する（ユーザー指定は「薄い青か緑系」のどちらでも可。メタタグ装飾（`issue-phase003-008`）で緑系を「メタ情報」の意味として既に使っているため、意味の衝突を避けるためH1/H2は青系を選択する）。
- H3〜H6は対象外（変更しない）。

### 実装の要点・つまずき
- CM6の`.cm-line`はブロック要素として全幅表示されるため、`padding`/`background`は自然に行全体（バナー状）に広がる。追加のwidth指定は不要。
- `line-height`は当該行（見出し行）のみに効く。前後の行の行間には影響しない。

### TODO
- [x] `styles/heading-emphasis.css` 新規作成。
- [x] `esbuild.config.mjs` の `stylesBundlePlugin` の結合対象に追加。
- [x] E2E追加（`tests/obs-e2e/heading-emphasis.e2e.ts`）。

### 受け入れ基準（すべて満たすこと）
- Live PreviewでH1行の背景が薄い青系になり、文字が本文より明確に大きく、行の高さが広がっている。
- Live PreviewでH2の文字がやや大きくなり、太めの下線が引かれている。
- H3以下・Reading Viewの見た目は変化しない。
- ダークモードでも背景・下線色が適切なコントラストで表示される（Obsidian変数由来のため自動追従）。

### テスト観点
- E2E: H1/H2のクラス（`.HyperMD-header-1`/`.HyperMD-header-2`）を持つ行に、期待するCSSプロパティ（padding・border-bottom等）が実際に適用されていることを`getComputedStyle`で検証する（クラス存在だけでは不十分。`issue-phase003-008`と同じ教訓）。
- E2E: H3行にはH1/H2向けの背景・下線が付与されないこと。

### 履歴（追記のみ）
- 2026-09-17 — 起票（ユーザー指示、issue-phase003-008への追加指示と同時に受領。メタタグ装飾とは独立した機能領域のため新規issueとして起票 — `WORKFLOW.md §2.1`）。
- 2026-09-17 — 実装完了。実機Obsidianに一時プローブspecを立てて `.HyperMD-header-<N>`/`.cm-header-<N>` クラスの実在を確認したうえで `styles/heading-emphasis.css` を実装。`tests/obs-e2e/heading-emphasis.e2e.ts`（3件: H1の背景/padding/文字サイズ、H2の下線/文字サイズ、H3が対象外であること）を追加し全件パス。`npx vitest run` 541件・実機E2E全11spec中10spec（既知の無関係な`gantt-view.e2e.ts`2件を除く）パスを確認済み。

### 2026-09-17 増分 — H2がH1より目立つ問題の修正

- User Instruction:
  - H2がH1より目立っているので、下線は灰色で文字の下だけにして。

- Change:
  - `.HyperMD-header-2`（行全体）に付けていた `border-bottom: 3px solid var(--color-blue)`（全幅・青）を廃止。
  - 代わりに `.cm-header-2`（見出しテキスト・`#`マーカーを覆うインラインspanのみ）に `border-bottom: 3px solid var(--text-muted)` を付与し、下線を「文字の直下のみ・灰色」に変更した。
  - H1は背景の薄い青系のみ（下線なし）のため、H2の下線を灰色にしたことで両者の配色が衝突せず、H1（背景で強調）とH2（下線のみで弱めに強調）の強弱が意図通りになった。

- 実装結果・テスト:
  - 変更: `styles/heading-emphasis.css`、`tests/obs-e2e/heading-emphasis.e2e.ts`（H2のテストを「行全体には下線が付かないこと」「テキスト直下にのみ灰色の太い下線が付くこと」を検証する内容に更新）。
  - テスト結果: 実機E2E `heading-emphasis.e2e.ts` 3件パス。

---

## 3. メタデータ
- id: issue-phase003-013__editor-heading-emphasis
- status: open
- phase: 003
- related_specs: なし
- related_decisions:
- target_files: styles/heading-emphasis.css, esbuild.config.mjs, tests/obs-e2e/heading-emphasis.e2e.ts
- created: 2026-09-17
- updated: 2026-09-17

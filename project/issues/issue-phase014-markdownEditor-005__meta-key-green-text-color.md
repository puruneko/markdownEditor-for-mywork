# markdownEditor: メタ情報名称の緑背景を廃止し緑文字色に変更する

対象リポジトリ: markdownEditor-for-mywork

## 1. Title
markdownEditor: 日付系以外のメタ情報名称(`.metatag-key`)の緑背景スタイルを、値(`.metatag-value`)と同じ緑文字色に変更する

## 2. Background
入力要望(ユーザー原文、@レビュー): 「メタ情報名称の緑背景を廃止し、メタ情報内容と同じように緑文字色にして。日時系など別にスタイル指定があるものはそのままでOK。」

コード調査の結果、対象箇所を特定した。日付系以外のメタキー(`priority`/`dependsOn`/`tags`/`repeat`/`condition`/`purpose`/`savepoint`/`special_note`/`unknown`)について、以下2ファイルに同一内容が重複定義されている（`styles/metatag-wysiwyg.css` 冒頭のコメントに「日付系以外（緑装飾）は metatag-raw.css と意図的に同一内容を重複定義している」と明記されている）。

- `styles/metatag-wysiwyg.css` 58-67行目:
  ```css
  .metatag-key.metatag-priority, ... .metatag-key.metatag-unknown {
    background: var(--metatag-green-bg);
  }
  ```
- `styles/metatag-raw.css` 49-58行目: 同内容。

一方、同じキー群に対応する**値**側のスタイル（`styles/metatag-wysiwyg.css` 70-80行目）は既に要望通りの形になっている。
```css
.metatag-value.metatag-priority, ... .metatag-value.metatag-unknown {
  color: var(--metatag-green-fg);
}
```
`--metatag-green-fg` 変数は `styles/metatag-wysiwyg.css` 21行目で既に `var(--color-green, #2f9e44)` として定義済みであり、新規に色を定義する必要はない。

日付系メタキー(`plan`/`schedule`/`due`)の背景色指定(`styles/metatag-wysiwyg.css` 82-86行目、`styles/metatag-raw.css` 74-77行目、`background: var(--metatag-date-bg)`)は、要望の「日時系など別にスタイル指定があるものはそのままでOK」に該当するため、変更しない。

## 3. Objective
日付系以外のメタ情報名称(`.metatag-key`)の背景色指定を削除し、対応する値(`.metatag-value`)と同じ緑文字色(`--metatag-green-fg`)を文字色として適用する。日付系メタキーのスタイルは変更しない。

## 4. Scope
markdownEditor-for-mywork リポジトリの `styles/metatag-wysiwyg.css` と `styles/metatag-raw.css` の該当セレクタのみ。

## 5. Implementation requirements
1. `styles/metatag-wysiwyg.css` 58-67行目の `.metatag-key.metatag-priority, ..., .metatag-key.metatag-unknown { background: var(--metatag-green-bg); }` を、`background` 指定を削除し `color: var(--metatag-green-fg);` に置き換える（`.metatag-value` 側(70-80行目)と同じ指定にする）。
2. `styles/metatag-raw.css` の対応する49-58行目についても同様に変更する。
3. `.metatag-key.metatag-plan`/`.metatag-key.metatag-schedule`/`.metatag-key.metatag-due`（各ファイルの日付系セレクタ、`background: var(--metatag-date-bg)`）は変更しない。
4. `--metatag-green-bg` 変数（`styles/metatag-wysiwyg.css` 20行目で定義）が、変更後にどこからも参照されなくなる場合は、未使用変数として残しておいても実害はないため削除は必須としないが、削除しても他に影響がないことを確認できれば削除してよい（実装者判断）。

## 6. Files / components likely to be changed
- markdownEditor-for-mywork/styles/metatag-wysiwyg.css
- markdownEditor-for-mywork/styles/metatag-raw.css

## 7. Dependencies
- 他issueとの依存関係なし。独立して着手可能。issue-phase014-markdownEditor-004（点線囲みの作り直し）と同じCSSファイルを触るため、コンフリクトを避けるためにいずれか一方を先にマージすることが望ましい（順序自体はどちらが先でもよい）。

## 8. Acceptance criteria
- 日付系以外のメタ情報名称（例: `@tags`, `@memo` 相当の`unknown`キー等）が、背景色なしで緑文字色で表示される。
- 対応する値部分の緑文字色と、名称部分の緑文字色が視覚的に統一されている。
- 日付系メタ情報名称(`@plan`/`@schedule`/`@due`)の背景色スタイルは変更前と同じまま表示される。

## 9. Test requirements
- 実機確認: Live Preview / Sourceモードそれぞれで、非日付系メタ情報名称が緑文字色（背景色なし）で表示されることを確認する。
- 実機確認: 日付系メタ情報名称の表示（背景色）が変更前と同じであることを回帰確認する。
- 既存のCSSスナップショットテスト等があれば更新する。

## 10. Out of scope
- メタ情報の点線囲み表示の変更（issue-phase014-markdownEditor-004で対応）。
- 日付系メタ情報のスタイル変更。

---

## 2. Progress & Implementation Notes（実装記録）

### History (append-only)

### 2026-09-28 00:01

- User Instruction:
  - phase014シリーズを順番に実装する指示の5件目（最終）として着手。

- Change:
  - `styles/metatag-wysiwyg.css` 58-67行目: `.metatag-key.metatag-priority, ..., .metatag-key.metatag-unknown` の `background: var(--metatag-green-bg);` を `color: var(--metatag-green-fg);` に置き換えた（`.metatag-value`側と同一指定）。
  - `styles/metatag-raw.css` 49-58行目: 同様に置き換えた。あわせて、直上のコメント（旧仕様「キー=背景のみ・値=文字色のみ」を説明する内容）を新仕様の説明に更新した。
  - 両ファイルの `:root` から、どこからも参照されなくなった `--metatag-green-bg` 変数定義を削除した（実装者判断。他ファイル・ソースコードでの参照が無いことを`grep`で確認済み）。日付系の `--metatag-date-bg`/`.metatag-key.metatag-plan`等は変更していない。
  - `tests/obs-e2e/metatag-decoration.e2e.ts`: 「日付系以外のメタキーが緑背景」を検証していた既存テストを、「キー側は背景なし・緑文字色、値側は従来通り緑文字色」を検証する内容に更新した。

- Rationale:
  - Issueの実装要件通り、キー側の背景色指定を削除し値側と同じ`--metatag-green-fg`に統一した。CSS変数の削除は「他に影響がないことを確認できれば削除してよい」という実装者判断の余地が明記されていたため、未使用確認の上で削除した。

- Test results:
  - `npx vitest run`: 571件すべて成功（本issueはCSSのみの変更のため新規ユニットテストなし）。
  - `npx wdio run wdio.conf.mts --spec tests/obs-e2e/metatag-decoration.e2e.ts`: 21件成功・2件失敗。失敗2件は本issueの変更と無関係な既存の不具合（issue-phase014-markdownEditor-003のTest resultsで報告済みの問題A・B）であり、本issueのAcceptance criteriaには影響しない。更新した「緑文字色・背景なし」の検証テストは成功した。
  - `npx svelte-check`: 本issueはCSSのみの変更のため対象外（新規の型エラーなし）。

- Acceptance criteria充足状況:
  - 「日付系以外のメタ情報名称が背景色なしで緑文字色」: 満たした（e2eで`background-color`が透明・`color`が緑系であることを確認）。
  - 「値部分と名称部分の緑文字色が視覚的に統一されている」: 満たした（同一のCSS変数`--metatag-green-fg`を使用）。
  - 「日付系メタ情報名称の背景色スタイルは変更前と同じ」: 満たした（`.metatag-key.metatag-plan`等は未変更。既存の`@scheduleの値がLive Previewで人間可読なチップ表示になる`テスト等が引き続き成功していることで回帰確認済み）。

- Open items:
  - なし。ユーザーの明示的なクローズ承認待ち（`WORKFLOW.md §6`）。

---

## phase014シリーズ 完了報告

issue-phase014-markdownEditor-001〜005を指示順に実装した。まとめ:
- 001（調査）: 実機計測により原因（`metatagValuePlugin`のwidget⇔mark入れ替え）を特定・必須と判断。コード変更なし。
- 002: `@`サジェストのTabキー決定に対応。既存obs-e2eテストの入力シミュレーション方式の不具合も併せて修正。
- 003: 5分単位設定をプラグイン設定へ移行。「期間で指定」表示制御の実機不具合（CSSの`[hidden]`上書き）を発見・修正。
- 004: メタ情報点線囲みを`layer()`/`RectangleMarker`によるインデント位置基準の矩形に作り直し。
- 005: メタ情報名称の緑背景を廃止し緑文字色に統一。

各issueとも、Out of scope外で実機確認により発見した既存不具合（DevTools関連はissue001、Escキー・仮置き`?`関連はissue003で報告した問題A・B）はコード変更せず報告のみに留めた。全issueとも実装完了・テスト成功だが、`WORKFLOW.md §6`によりユーザーの明示的なクローズ承認が無い限りOpenのまま維持する。

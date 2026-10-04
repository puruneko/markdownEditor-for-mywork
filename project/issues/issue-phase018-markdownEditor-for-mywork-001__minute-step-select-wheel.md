# 日付入力支援：時刻を刻みの値だけを選べるホイール付き選択欄にし、刻みに 20 分を追加する

## 背景
- リポジトリ: `markdownEditor-for-mywork`。
- 要望原文:
  > 日付入力支援の入力単位を15分で固定にして。この単位は拡張機能の設定画面で変えられるようにして。
  > 　@rv: 入力後にまるめるのではなく、入力支援のホイールに15分刻みの数字以外表示させないで。また、刻みを拡張機能の設定画面で、１、５、１０、１５、２０、３０を指定できるようにして。規定値は１５
- 前回までの実装: 時刻欄はブラウザ標準の `<input type="time">` に `step` 属性を付け、変更時・決定時に刻みの倍数へ切り上げる。標準の時刻入力は任意の分（07 など）を表示・選択できるため「入力後にまるめている」状態。設定の選択肢は 1/5/10/15/30 で 20 が無い。
- 採用した解釈:
  - 「ホイール」= 時刻を選ぶ部品。標準の時刻入力をやめ、「時」と「分」の2つの選択欄（`<select>`）にする。分の選択肢は刻みの倍数だけ（15 分なら 00/15/30/45）にするので、刻み以外の数字は表示されない。選択欄の上でマウスホイールを回すと、前後の選択肢へ1つずつ移動する（ホイールで選べる）。
  - 刻みの選択肢を 1/5/10/15/20/30 にする。既定は 15（現状どおり）。

## 目的
日付入力支援で時刻を選ぶとき、刻みの倍数の分だけが表示・選択でき、刻みを設定画面で 1/5/10/15/20/30 から選べるようにする。

## 現状
- `src/editor/metatag-picker.ts`
  - `buildDateTimeRow(initialDate, initialTime, minuteStep)`（85–125 行付近）: `[日付 input type=date][時刻 input type=time][today][now]` の1行を作り、`{ row, dateInput, timeInput }` を返す。now ボタンは `nowRounded(new Date(), minuteStep)`。
  - `buildPickerTooltipView`（127 行〜）: 開始行・「期間で指定」チェック・終了行・「仮置き（?）」・「決定」を組み立てる。164–185 行で `timeInput.step` 設定と `change` 時の `roundUpToStep`。決定時（`commitBtn` の mousedown）にも `roundUpToStep` してから `buildMetaDateValue({ startDate, startTime, isRange, endDate, endTime })` で値を作り、CM6 へ dispatch。
- `src/lib/format/metatag-format.ts`: `parseMetaDateValue`、`buildMetaDateValue`、`roundUpToStep(date, time, step)`（124 行）、`nowRounded(now, step)`（131 行）。テストは `src/lib/format/metatag-format.test.ts`。
- `src/settings.ts`: `type MinuteStep = 1 | 5 | 10 | 15 | 30`、`MINUTE_STEPS = [1,5,10,15,30]`、`migrateSettings`（不正値は既定 15）、既定 `minuteStep: 15`、設定タブのドロップダウン「日付ピッカーの分刻み」（96–111 行、選択肢 丸めなし/5分/10分/15分/30分）。
- スタイル: `styles/metatag-wysiwyg.css` の `.metatag-picker-*`（`styles.css` はビルド生成物なので直接編集しない）。

## 実装内容
1. 設定（`src/settings.ts`）
   - `MinuteStep` と `MINUTE_STEPS` に 20 を追加。ドロップダウンに `20分` を追加（並び: 丸めなし(1)/5分/10分/15分/20分/30分）。説明文から「切り上げ」の記述を外し、「時刻の分の選択肢の刻み」に直す。
2. 時刻選択欄（`src/editor/metatag-picker.ts`）
   - `buildDateTimeRow` の `<input type="time">` を、時 `<select class="metatag-picker-hour">`（先頭に空の選択肢「--」、続いて 00〜23）と分 `<select class="metatag-picker-minute">`（00 から `minuteStep` 刻みで 60 未満まで）に置き換える。区切りに「:」を表示する。
   - 時が「--」のときは時刻なし（日付のみ）とし、分の選択欄を無効にする。時を選んだとき分が未選択なら 00 にする。
   - 戻り値は `timeInput` の代わりに「`HH:mm` または空文字を返す `getTime()` と、値を設定する `setTime(time)`」を持つ形にする（呼び出し側の `timeInput.value` 参照を置き換える）。
   - 初期値の分が刻みの倍数でない場合（既存データの 10:07 など）は、`roundUpToStep` で切り上げた値を初期表示する（日付の繰り上がりも反映）。
   - ホイール: 各 `<select>` に `wheel` イベント（`{ passive: false }`）を付け、`preventDefault()` したうえで、下方向で次、上方向で前の選択肢へ1つ移動する（端では止まる）。
   - now ボタンは `nowRounded` の結果を `setTime` で設定する（現状どおり刻みに揃う）。
   - 164–185 行の `step` 設定と `change` 時の切り上げ処理は削除する。決定時の `roundUpToStep` は、選択肢が刻みの倍数だけになったため削除してよい。
3. スタイル（`styles/metatag-wysiwyg.css`）: 2つの選択欄が1行に収まるよう、`.metatag-picker-hour` / `.metatag-picker-minute` の幅を調整する。

## 完了条件
- 刻み 15 分（既定）で、分の選択欄の選択肢が 00/15/30/45 だけである。刻みを 1/5/10/20/30 に変えると、それぞれの倍数だけになる（1 なら 00〜59）。
- 時・分の選択欄の上でホイールを回すと、選択肢が1つずつ切り替わる。
- 時を「--」にすると日付のみの値（例 `2026-10-03`）が書き込まれる。
- 既存値の分が刻みの倍数でない場合、ピッカーを開くと切り上げた時刻が表示される。
- 設定画面の「日付ピッカーの分刻み」に 20分 があり、保存・再起動後も選択が保たれる。保存値が不正な場合は 15 になる。

## テスト
- `src/settings.test.ts`: `migrateSettings` が 20 を受け入れ、不正値（例 7）を 15 にすることを追加。
- ピッカー: 時刻選択欄の選択肢生成（刻みごとの分の選択肢）を純粋関数に切り出し（例 `minuteOptions(step): string[]`）、単体テストを追加する。初期値の切り上げは既存の `roundUpToStep` のテストで担保されている。
- `tests/obs-e2e/metatag-suggest.e2e.ts` または `metatag-decoration.e2e.ts` にピッカーの時刻欄を扱うテストがあれば、`input[type=time]` を前提にした操作を新しい選択欄に合わせて更新する。
- `npm run test:unit` が通ること。Obsidian で `@schedule` のピッカーを開き、ホイール操作と書き込み結果を目視確認する。

## 依存関係
なし

## 対象外
- 日付欄（`<input type="date">`）の変更。
- ガントのツリーセルからピッカーを使う対応（issue-phase018-markdownEditor-for-mywork-002__gantt-tree-date-cell-picker.md）。

## 要確認
なし

## 実装結果（2026-10-03）
- 時・分の select（ホイール対応）に置換、刻みに 20 を追加。単体: minuteOptions / migrateSettings。E2E: metatag-decoration.e2e.ts（分の選択肢・ホイール・時 -- で日付のみ・初期値切り上げ）通過。

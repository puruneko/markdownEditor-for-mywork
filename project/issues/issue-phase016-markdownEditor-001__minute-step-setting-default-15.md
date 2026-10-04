# Title
日付入力支援の分刻みを設定化する（既定15分、選択肢 {1,5,10,15,30}）

## Background
- リポジトリ: `markdownEditor-for-mywork`（Obsidian プラグイン）。
- 現状、日付入力支援（metatag の日時ピッカー）の分刻みは5分固定で、設定 `roundMinuteStep: boolean`（ON=5分丸め / OFF=丸めなし）のみ存在する。
- 要望: 「日付入力支援の入力単位を15分で固定にして。この単位は拡張機能の設定画面で変えられるようにして。」
- 現状コードの該当箇所（計画時点の調査結果）:
  - `src/settings.ts` 24/42/88行付近に `roundMinuteStep: boolean`
  - `src/plugin.ts` 200行付近でコールバック注入、241-243行付近 `loadSettings` が `Object.assign({}, DEFAULT_SETTINGS, await this.loadData())`
  - `src/editor/metatag-picker.ts` 166-167行付近（`step='300'`）、203・211行付近に5分直書き
  - `src/lib/format/metatag-format.ts` 108-128行付近（`roundUpDate5Min` / `roundUpTo5Min` / `nowRounded`）
  - `tests/obs-e2e/metatag-decoration.e2e.ts` 390/415/429/432/439/449/454/457/467/471行付近で `settings.roundMinuteStep` を直接代入し、`getAttribute('step')` が `null` であることを検証

## Objective
分刻みを設定 `minuteStep`（`1|5|10|15|30`、既定15）に置き換え、設定画面のドロップダウンで変更でき、ピッカーの step 属性・now ボタン・決定時の丸めに反映される状態にする。旧設定 `roundMinuteStep` の既存ユーザー値を失わない。

## Scope
- `metatag-format.ts` の丸め関数の一般化
- 設定型・設定画面・設定移行関数
- `plugin.ts` の設定読み込みとコールバック
- `metatag-picker.ts` の step 反映
- 単体テスト・E2E の更新

## Implementation requirements
1. `src/lib/format/metatag-format.ts`
   - `roundUpDate5Min(dt)` → `roundUpDateToStep(dt, step)`。`step<=1` は秒切り捨てのみ（現行の「丸めなし」相当）。
   - `roundUpTo5Min(date,time)` → `roundUpToStep(date,time,step)`。
   - `nowRounded(now)` → `nowRounded(now, step)`。
   - 旧関数名は削除（呼び出し元は picker のみ。他に呼び出しが無いか grep で確認）。
2. `src/settings.ts`
   - `roundMinuteStep: boolean` を削除し `minuteStep: MinuteStep`（型 `1|5|10|15|30`、`DEFAULT_SETTINGS.minuteStep = 15`）。
   - 純粋関数 `migrateSettings(raw: unknown): Partial<Settings>` を export:
     - `raw.minuteStep` が許容値 {1,5,10,15,30} → そのまま採用
     - `minuteStep` が未定義 かつ `raw.roundMinuteStep === false` → `minuteStep: 1`
     - それ以外（未定義、許容値外、`null`、非オブジェクト）→ `minuteStep: 15`
     - 返却値に `roundMinuteStep` キーを含めない（保存時に消える）。
   - 設定タブ: 既存トグルを `addDropdown` に置換。表示ラベルは「丸めなし(=1) / 5分 / 10分 / 15分 / 30分」。
3. `src/plugin.ts`
   - `loadSettings` を `Object.assign({}, DEFAULT_SETTINGS, migrateSettings(await this.loadData()))` に変更。**移行は必ず生データ（`loadData()` の戻り値）に対して `Object.assign` の前で行うこと。** 既定値を先に埋めると「`minuteStep` 未定義」判定が常に偽になり、OFFにしていたユーザーの設定が失われる。
   - 200行付近のコールバックを `() => this.settings.minuteStep` に。
4. `src/editor/metatag-picker.ts`
   - 引数を `minuteStep: number` に。`step>1` なら `input.step = String(step*60)`、`step===1` なら従来どおり `removeAttribute('step')`（`step='60'` にしない。既存E2Eが OFF 時 `getAttribute('step')===null` を検証しているため）。
   - now ボタン・決定時の丸めに同じ step を渡す。42行付近のコメントを更新。
5. 仮決め事項（要確認だが既定案で進めてよい）: 選択肢 {1,5,10,15,30}、許容値外は15にフォールバック。

## Files / components likely to be changed
`src/settings.ts`, `src/plugin.ts`, `src/lib/format/metatag-format.ts`（+対応する単体テスト）, `src/editor/metatag-picker.ts`, `tests/obs-e2e/metatag-decoration.e2e.ts`

## Dependencies
なし（単独完結）。同一リポジトリの「リスト直後の矢印強調」issue とは変更ファイルが重ならず、並行可能。

## Acceptance criteria
- 新規ユーザー（設定なし）で step 属性が `900`（15分）、now ボタンが15分単位に切り上げ。
- 設定画面のドロップダウンで {丸めなし,5,10,15,30} を選べ、変更後に開くピッカーへ反映される（30 → `step=1800`、丸めなし → step 属性なし）。
- 旧設定 `{roundMinuteStep:false}` のユーザーは `minuteStep=1`、`{roundMinuteStep:true}` は 15 になる。
- コード内に `roundMinuteStep` の参照が残らない（E2E 含む）。
- 単体・E2E がすべて green。

## Test requirements
- 単体 `metatag-format`: 既存5分ケースは `step=5` で残す。`step∈{1,15,30}` × {境界ちょうど, +1分, 23:58 の日付またぎ, 年末} を追加。
- 単体 `migrateSettings`: `{roundMinuteStep:true}`→15、`{roundMinuteStep:false}`→1、`{}`→15、`{minuteStep:5}`→5、`{minuteStep:7}`→15、`null`→15。
- E2E: 390/415/429/454行付近の4テストを 15分・`minuteStep=1` に書き換え（テスト名・期待値 `'300'`→`'900'` も更新）。432/449/457/471行付近の `settings.roundMinuteStep = false/true` 代入を `minuteStep = 1 / 15` に書き換え（未知プロパティ代入はエラーにならず無言で無効化されるため必須）。追加: 「設定を30に変更→次回ピッカーで step=1800」。
- 手動: 実機で既定15分・設定変更の反映、手入力値の stepMismatch 表示が許容できること（問題があっても決定時丸めで吸収されるため許容）。

## Out of scope
- 選択肢 {1,5,10,15,30} 以外の自由入力
- リリースノート作成（既定値が5→15に変わる旨の記載は別途。要確認）
- 他の日付入力 UI 変更

## Implementation status
- 実装完了（単体テスト green）。E2E・実機確認は未実施。クローズはユーザー承認待ち。

# @repeat の入力支援（繰り返し設定ピッカー）を実装する

## 背景
要望原文（markdownEditor-for-mywork）:
> repeatの入力支援を実装して。repeatは記法と設定が独特なので、ユーザが指定したい繰り返しタスクを思い通りに入力できるようなUIを考えて実装して。

あわせて（同ファイルの別要望）:
> 日付・リピートの入力支援の入力中に外側をクリックしたら入力内容を保存して。…Escで捨てるようにして。

採用した解釈:
- `@repeat` の値は RRULE 文字列（`RRULE:` を除いた部分。例 `FREQ=MONTHLY;BYDAY=1FR`）で、開始日時は同じタスクの `@schedule` の開始が使われる（`src/lib/recurrence/expand.ts`）。記法自体は変えない。
- RRULE を直接書かなくても、頻度・間隔・曜日・終了条件をフォームで選んで値を作れるピッカーを用意する。日付ピッカーと同じ操作感（チップ表示のクリックで開く、`@repeat:` 入力で自動で開く、外側クリックで保存・Esc で破棄）にする。
- フォームで表せない既存の RRULE は、壊さずに文字列のまま編集できるようにする。

## 目的
繰り返しタスクの設定を、RRULE の記法を知らなくても意図どおりに入力できるようにする。

## 現状
- 値の解釈: `src/lib/parser/plugins/remark-meta-fields.ts`（`meta.repeat = value.trim()`）、展開: `src/lib/recurrence/expand.ts`（`RRule.fromString("DTSTART:...\nRRULE:" + meta.repeat)`、schedule が `開始/終了` の形式でないと展開しない）。依存ライブラリ `rrule`（package.json）。
- 日付系の入力支援:
  - `src/editor/metatag-picker.ts`: `buildMetaDatePicker`（CM6 非依存の DOM）、`openMetaPicker`（StateEffect）、`createMetatagPickerExtension`（showTooltip で表示）。
  - `src/editor/metatag-decoration.ts`: `@schedule/@plan/@due: 値` の行をチップ（`MetaDateChipWidget`）に置換し、クリックでピッカーを開く。`openDatePickerForLine`（L224〜）と `maybeAutoOpenPicker`（`:` 入力直後に値が空なら開く）。キーは `normalizeMetaKey` で別名を解決。
  - 日付系キーの判定は `isDateMetaKey`（`src/lib/format/metatag-format.ts`）。
- 実データ例（demo）: `@repeat: FREQ=YEARLY`、`@repeat: FREQ=MONTHLY;BYDAY=1FR`。

## 実装内容
1. RRULE ⇔ フォーム値の変換（純粋関数、新規 `src/lib/format/repeat-format.ts`）:
   - フォーム値: `freq`（DAILY/WEEKLY/MONTHLY/YEARLY）、`interval`（1以上）、`byWeekday`（WEEKLY 用、MO〜SU の複数）、`monthlyMode`（'monthday' | 'nth-weekday'）、`byMonthDay`（1〜31）、`nth`（1〜4 または -1=最終）、`nthWeekday`（MO〜SU）、`end`（'none' | 'count' | 'until'）、`count`、`until`（YYYY-MM-DD）。
   - `parseRepeat(value): RepeatForm | null`: 上記で表せる RRULE（キー FREQ / INTERVAL / BYDAY / BYMONTHDAY / COUNT / UNTIL のみ、BYMONTHDAY は1つ、MONTHLY の BYDAY は `1FR` 形式1つ）なら変換、それ以外は null（=フォーム非対応）。
   - `buildRepeat(form): string`: 例 `FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20261231`（INTERVAL=1 は省略、UNTIL は `YYYYMMDD`）。
   - `describeRepeat(value): string`: 日本語の要約（例「毎日」「2週間ごと 月・水」「毎月 第1金曜」「毎月 15日」「毎年」「…、10回まで」「…、2026/12/31まで」）。非対応の値は値そのものを返す。
2. ピッカー DOM（新規 `src/editor/repeat-picker.ts`、`buildMetaDatePicker` と同じ構成で CM6 非依存）:
   - 頻度（毎日/毎週/毎月/毎年）、間隔（「N 日/週/か月/年ごと」）。
   - 毎週: 曜日トグル（月〜日）。未選択時は schedule の曜日に従う（BYDAY を出力しない）。
   - 毎月: 「毎月 N 日」か「第 N（1〜4/最終）X 曜日」を選択。
   - 毎年: 追加入力なし（schedule の日付に従う旨を表示）。
   - 終了: 「なし」「N 回」「日付まで」。
   - 要約表示（`describeRepeat`）と、生成される RRULE 文字列のテキスト欄。テキスト欄は直接編集可能。編集内容が `parseRepeat` 可能ならフォームに反映、不可ならフォームを無効化して「詳細な指定のためテキストで編集してください」と表示。
   - 「決定」ボタン。外側クリック = 決定と同じ（値が空なら保存せず閉じる）、Esc = 破棄（issue-phase020-markdownEditor-for-mywork-002 と同じ挙動。共通化できるなら共通化する）。
3. エディタ組み込み:
   - チップ: `metatag-decoration.ts` で、正規キーが `repeat` の値付き行もライブプレビュー時にチップ化（表示テキストは `describeRepeat`）し、クリックで repeat ピッカーを開く。
   - 自動起動: `- @repeat:`（別名含む）の `:` 入力直後に値が空なら repeat ピッカーを開く（`openDatePickerForLine` / `maybeAutoOpenPicker` を repeat にも対応させる）。
   - 書き戻し: `- @repeat: <値>` に置換（日付ピッカーの書き戻しと同様、カーソルを行頭へ逃がしてチップ表示に戻す）。
   - 表示は日付ピッカーと同様に showTooltip を使う（`openMetaPicker` の StateField を拡張して種類を持たせるか、repeat 用の StateEffect/StateField を追加し `plugin.ts` で登録）。
4. スタイル: 既存ピッカーのクラス（`metatag-picker-popup` 等）を流用し、追加分は `styles/metatag-wysiwyg.css` に追記。

## 完了条件
- `- @repeat:` と入力すると繰り返し設定ピッカーが開き、フォーム操作で `FREQ=...` の値が書き込まれる。
- 既存の `@repeat` 行はライブプレビューで日本語要約のチップとして表示され、クリックで現在値が反映されたピッカーが開く。
- 毎日/毎週（曜日複数）/毎月（日付・第N曜日・最終X曜日）/毎年、間隔、終了（回数・日付）を指定できる。
- フォームで表せない RRULE はテキストのまま編集・保存でき、値が壊れない。
- 外側クリックで保存、Esc で破棄。
- 書き込んだ値で、カレンダー/ガントの繰り返し展開が従来どおり動作する（`expand.ts` で展開可能）。

## テスト
- 新規 `src/lib/format/repeat-format.test.ts`: parse/build の往復（demo の `FREQ=YEARLY`、`FREQ=MONTHLY;BYDAY=1FR` を含む）、INTERVAL 省略、UNTIL/COUNT、非対応 RRULE で null、`describeRepeat` の文言。
- ピッカー DOM のテスト（`metatag-picker.test.ts` と同様の形式）: フォーム操作で生成値が変わる、外側 mousedown で onCommit、Escape で onClose。
- `buildRepeat` の出力を `expand.ts` に渡して展開できることのテスト。
- `npm run test:unit` が通ること。手動: Obsidian で入力・再編集を確認。

## 依存関係
- issue-phase020-markdownEditor-for-mywork-002__picker-outside-click-commits.md（外側クリック保存の挙動を揃えるため）

## 対象外
- @repeat の記法（RRULE）の変更、DTSTART の指定方法の変更。
- `@` サジェスト候補への repeat の追加（サジェストの並びは issue-phase020-markdownEditor-for-mywork-003 の仕様どおり）。
- BYSETPOS・BYHOUR 等、上記以外の RRULE 要素のフォーム対応（テキスト編集で対応）。
- 例外日（EXDATE）。

## 要確認
- @schedule が無い、または期間形式でないタスクでは繰り返しが展開されない（既存仕様）。ピッカー上でその旨を警告表示するかは未定（本issueでは表示しない）。

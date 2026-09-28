# markdownEditor: メタ情報日付ピッカーのUI改修

対象リポジトリ: markdownEditor-for-mywork

## 1. Title
markdownEditor: 日付入力ピッカーのUI改修(タイトル・閉じるボタン削除、today/nowボタン、5分単位トグル、仮置きトグル)

## 2. Background
入力要望(ユーザー原文、抜粋):
「日付入力支援について、
- 上部の計画を設定の文言は不要。下部の閉じるボタンは不要、設定ボタンは決定の文言に変更。
- today,nowのボタンを各入力欄の右端に追加。todayは今日の日付を入力支援の日付欄に自動入力、nowは時刻まで自動入力。
- 基本の入力の分(MM)の単位は５分とする。nowの自動入力も切り上げで一番近い５分単位にする。決定ボタンの横に５分単位ONOFFボタンを設置し、規定値はON。
- 期間で指定がONの時のみ終了日時の入力欄を表示する。期間で指定がOFFの時は、終了日時の入力は無視する。
- 仮置きONOFFボタンを標準で決定ボタンと同じ行に設置する。規定値はOFF。」

対象ファイルは `src/editor/metatag-picker.ts`(現状207行)。以下の行番号は本issue作成時点でコードを確認した結果である。

## 3. Objective
日付入力ピッカーのUIを上記の要望通りに改修する。

## 4. Scope
markdownEditor-for-mywork リポジトリのみ。`src/editor/metatag-picker.ts` を中心とした変更。

## 5. Implementation requirements
- **タイトル削除**: 78行目付近 `title.textContent = \`${META_DATE_KEY_LABEL[target.key]}を設定\`` で生成しているタイトル要素をDOMに追加しないようにする。`META_DATE_KEY_LABEL` 自体(ラベル定義)は削除せず残す。
- **閉じるボタン削除**: 133-136行目付近で生成している `cancelBtn`(「閉じる」ボタン)の生成・DOM追加をやめる。ピッカーを閉じる手段は、既存のEscキー処理と外側クリック(`outsideMouseDown`)リスナーで担保されていることを実装時に確認すること。
- **「設定」→「決定」**: 140行目付近 `commitBtn.textContent = '設定'` を `'決定'` に変更する。
- **today/nowボタン**: 開始日時入力行・終了日時入力行それぞれの右端に追加する。
  - todayボタン: 押下時、対応する日付入力欄(`type="date"`)に今日の日付のみを自動入力する(時刻欄は変更しない)。
  - nowボタン: 押下時、対応する日付欄に今日の日付、時刻欄に現在時刻を入れる。時刻は5分単位に切り上げる(例: 10:32→10:35)。切り上げによって日付が繰り上がるケース(例: 23:58→翌日00:00、月末・年末をまたぐ場合も含む)に対応する。
- **5分単位トグル**: 決定ボタンの横に設置する。既定値はON。状態は保存・記憶しない(画面を開き直すたびにONに戻る)。ONのとき、時刻入力(`type="time"`)に `step="300"`(5分=300秒)を付与する。加えて、決定ボタン押下時に、入力された分の値を5分単位に切り上げてから確定する。
- **仮置きトグル**: 決定ボタンと同じ行に、insertモード・editモードの両方で常に表示する(現状120-128行目付近の `tentativeRow` はeditモードのみで表示されている可能性があるため、insertモードでも表示されるよう修正する)。既定値はOFF。ただし、対象行に既に仮置きを表す `?` が含まれている場合は既定値をONにする。
- **期間OFF時の終了値の無視**: 既に実装済み(161-162行目、`isRange` が偽のとき終了日時にnullを渡している)。この部分のコードは変更しない。回帰テストのみ追加する。
- **仮置き(insertモード)の実装**: 現行のinsertモードは、コロンの後ろに値を挿入するだけ(166行目付近)。仮置きの状態をキー側にも反映するため、置換範囲をキー末尾の `?:` または `:` まで広げ、`${tentative ? '?' : ''}: ${value}` の形式で置換する。トリガー元である `maybeAutoOpenPicker`(`metatag-decoration.ts`)は正規表現で行をマッチしているため、そこから置換開始位置をtargetとして渡すこと。
- **純粋関数としての切り出し**(ユニットテスト可能にするため):
  - `roundUpTo5Min(date, time)`: 日付・時刻を受け取り、5分単位に切り上げた結果を返す。
  - `nowRounded(now)`: 現在時刻を受け取り、5分単位に切り上げた日付・時刻を返す。
- **最終レイアウト**(上から順): [開始日入力][時刻入力][todayボタン][nowボタン] / [期間で指定トグル] / (ONの場合のみ)[終了日入力][時刻入力][todayボタン][nowボタン] / [5分単位トグル][仮置きトグル][決定ボタン]
- **実装上の注意**: 新しく追加するtoday/nowボタン等にも、既存の `cancelBtn`/`commitBtn` と同様に `mousedown` イベントで `e.preventDefault()` を呼ぶ実装を揃えること。揃えないと、ボタン押下時にエディタのフォーカスが外れ、既存の外側クリック判定によってピッカーが閉じてしまう。

## 6. Files / components likely to be changed
- markdownEditor-for-mywork/src/editor/metatag-picker.ts
- 関連ユニットテスト(新規、`roundUpTo5Min`・`nowRounded`用)
- markdownEditor-for-mywork/tests/obs-e2e/metatag-decoration.e2e.ts(文言期待値の更新、新規シナリオ追加)

## 7. Dependencies
- 後続issue「リスト先頭の@によるschedule/plan/dueサジェスト」は、本issueで改修する日付ピッカーの起動処理に接続する。本issueを先にマージすること。

## 8. Acceptance criteria
- ピッカー上部にタイトル文言(「〜を設定」)が表示されない。
- ピッカーに閉じるボタンが表示されない(Escキー・外側クリックでは引き続き閉じられる)。
- 決定ボタンの文言が「決定」になっている。
- 開始・終了それぞれの入力行の右端にtoday/nowボタンがあり、todayは日付のみ、nowは日付+5分単位切り上げの時刻を自動入力する。
- 決定ボタンの横に5分単位トグルがあり、既定でON。ONの間は時刻入力が5分刻みで、決定時に5分単位へ切り上げられる。
- 決定ボタンと同じ行に仮置きトグルがあり、insert/editどちらのモードでも表示される。既定OFF、既存の値に`?`がある場合はON。
- 「期間で指定」がOFFのとき、終了日時入力は表示されない(または無効化され)、決定時に終了値が書き込まれない。

## 9. Test requirements
- ユニット: `roundUpTo5Min`・`nowRounded` について、:00, :01, :55, :58, 23:58(日またぎ)、月末・年末23:58の境界値を検証する。
- ユニット/obs-e2e: 「期間で指定」OFF時に終了値が書き込まれないことを確認する回帰テストを追加する。
- obs-e2e: `metatag-decoration.e2e.ts` 内の「設定」「閉じる」「〜を設定」といった文言に依存した期待値を、新しい文言に更新する。
- obs-e2e: today/nowボタンの動作、5分丸め、insertモードでの仮置きトグルの動作を検証するテストを追加する。

## 10. Out of scope
- 「@」入力によるサジェスト機能自体(別issue)。
- メタ情報の点線囲いの表示(ユーザー確認事項の回答待ちのため、本フェーズでは対象外)。
- DevToolsで要素を辿れない問題の調査(別issue)。

---

## 2. Progress & Implementation Notes（実装記録）

### History (append-only)

### 2026-09-27 21:30

- User Instruction:
  - phase番号が最大のissueシリーズ（本リポジトリではphase013）を順番にすべて実装する指示に基づき着手。

- Change:
  - `src/editor/metatag-picker.ts`: タイトル生成を削除、閉じるボタンを削除、決定ボタンの文言を「設定」→「決定」に変更。開始・終了各行にtoday/nowボタンを追加（`buildDateTimeRow`）。決定ボタン横に5分単位トグル（既定ON、`step="300"`をtime入力へ付与し決定時に丸める）と仮置きトグル（insert/edit両モードで常時表示、初期値は`target.initialTentative`）を追加。insert/edit両モードの書き戻し処理を`${tentative ? '?' : ''}: ${value}`へ統一。
  - `src/lib/format/metatag-format.ts`: 純粋関数`roundUpTo5Min(date, time)`・`nowRounded(now)`を追加（日またぎ・月末・年末境界を`Date`の繰り上がりに委譲）。
  - `src/editor/metatag-decoration.ts`: `maybeAutoOpenPicker`のinsertモードtargetの`from`を、行末（コロン直後）からキー名直後（`?`/コロンの前）へ変更し、コミット時に`?:`/`:`ごと書き換えられるようにした。
  - `styles/metatag-wysiwyg.css`: タイトル用CSSを削除、today/nowボタン用スタイルを追加、ポップアップ最小幅を240px→300pxへ拡大、ボタン行を`flex-wrap`対応に変更。
  - `src/lib/format/metatag-format.test.ts`に`roundUpTo5Min`/`nowRounded`のユニットテストを追加（:00, :01, :55, :58, 日またぎ, 月末, 年末の境界値）。
  - `tests/obs-e2e/metatag-decoration.e2e.ts`にissue-phase013-markdownEditor-001用のobs-e2eシナリオ（タイトル/閉じるボタン非表示、today/nowボタン、5分丸めON/OFF、insertモードの仮置きトグル、期間OFF時の終了値未書き込み）を追加。

- Rationale:
  - 本issue（issue-phase013-markdownEditor-001）の要求仕様（セクション5・8・9）に基づく。

- Verification:
  - `npx vitest run`: 555件成功（1件は無関係な統合テストのフルスイート実行時タイムアウトで、単体再実行では成功。本変更との関連なし）。
  - `npx tsc --noEmit`: 変更した3ファイル（metatag-picker.ts / metatag-decoration.ts / metatag-format.ts）にエラーなし。プロジェクト全体には本変更と無関係な既存エラーが残存する（webdriverio型定義起因等）。
  - `node esbuild.config.mjs production`: ビルド成功、`main.js`/`styles.css`へ反映済み。
  - obs-e2e（実機Obsidian + WebdriverIO）は本セッションでは未実行。テストコードの追加のみ（クレジット消費抑制のため）。ユーザー側での実行を推奨。

- Open items:
  - 本issueはタイトル・閉じるボタンなど既存UIの変更を含むため、`WORKFLOW.md §6`によりクローズ前にユーザーへbefore/after比較を提示し、承認を得る必要がある（本セッションでは未提示）。

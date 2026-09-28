# markdownEditor: 日付入力ピッカーの「5分単位」トグルをObsidian設定画面へ移行し、期間指定の表示制御を検証する

対象リポジトリ: markdownEditor-for-mywork

## 1. Title
markdownEditor: 日付ピッカー内の「5分単位」ON/OFFチェックボックスを廃止し、Obsidianプラグイン設定画面のトグルに置き換える。あわせて「期間で指定」ON/OFF時の終了日時欄の表示制御を実機検証する

## 2. Background
入力要望(ユーザー原文):
「日付入力支援について、
- 上部の計画を設定の文言は不要。下部の閉じるボタンは不要、設定ボタンは決定の文言に変更。
- today,nowのボタンを各入力欄の右端に追加。todayは今日の日付を入力支援の日付欄に自動入力、nowは時刻まで自動入力。
- 基本の入力の分(MM)の単位は５分とする。nowの自動入力も切り上げで一番近い５分単位にする。決定ボタンの横に５分単位ONOFFボタンを設置し、規定値はON。
- 期間で指定がONの時のみ終了日時の入力欄を表示する。期間で指定がOFFの時は、終了日時の入力は無視する。
- 仮置きONOFFボタンを標準で決定ボタンと同じ行に設置する。規定値はOFF。
@レビュー
- 期間で指定がONになっている時のみ終了日時の入力欄を出す仕様が反映されていない。
- ５分単位のONOFFボタンは廃止し、obsidianの拡張機能の設定画面でONOFFする仕様に変更。」

コード調査の結果（`src/editor/metatag-picker.ts`）、以下が判明している。

- 「上部の計画を設定」の文言、下部の「閉じる」ボタンは、現在のコードに存在しない。「決定」ボタン(187-191行目)も既に実装済み。→ **これらは既に対応済みと見られる。**
- today/nowボタンは各入力欄（日付・時刻）の右側に既に実装されている(`buildDateTimeRow()`、79-119行目)。→ **対応済みと見られる。**
- 分の5分単位ステップは、`minuteStepToggle`(158-176行目)がON(既定 `checked = true`、161行目)のとき `startTimeInput.step = '300'`（300秒=5分）を設定する形で実装されている。`now`ボタンの自動入力も `roundUpTo5Min()`(`metatag-format.ts`)で切り上げ処理されている(110-115行目)。→ **機能自体は実装済みだが、UI上のトグル位置が要望と異なる（後述）。**
- **「期間で指定」ON/OFF時の終了日時欄の表示制御**: `rangeToggle`(133-140行目)の `change` イベントで `endRow.hidden = !rangeToggle.checked`(149-151行目)としており、初期表示も `endRow.hidden = !parsed.isRange`(146行目)となっている。コード上は**既に「期間で指定」ONのときのみ終了日時欄を表示する制御が実装されているように見える**。しかし、ユーザーの@レビューでは「反映されていない」と明確に指摘されている。**これは実装計画・レビュー記録と現在のコードの間の矛盾であり、要確認事項とする**（後述）。
- **「5分単位」ON/OFFトグルの位置**: 現在は決定ボタンと同じ`bottomRow`内、`minuteStepRow`として実装されている(156-163行目)。ユーザーの@レビューは「このトグル自体をピッカーから廃止し、Obsidianのプラグイン設定タブ(Setting Tab)側のON/OFFに統合する」ことを明確に要望しており、現在の実装（ピッカー内にトグルを残したまま）とは異なる。
- 「仮置き」ON/OFFは既に決定ボタンと同じ行(`bottomRow`)に実装済み、既定値もOFF相当（`target.initialTentative` に依存し、新規挿入時は false）。→ **対応済みと見られる。**
- 設定タブの実装場所は `src/settings.ts`（`MdAstEditorSettings` インターフェース、`DEFAULT_SETTINGS`、`new Setting(containerEl).addToggle(...)` のパターンが複数存在する）であり、同様のパターンで新しい設定項目を追加できる。

## 3. Objective
1. 「5分単位」ON/OFFのトグルUIをピッカー内から削除し、Obsidianプラグインの設定タブに恒久的な設定項目として追加する。ピッカーは、この設定タブの値に従って分入力欄のステップとnowボタンの丸め処理を切り替える。
2. 「期間で指定」ON/OFF時の終了日時欄の表示制御について、コード上の実装と@レビューの指摘に矛盾があるため、実機で再現するかどうかを確認し、再現する場合は原因を特定して修正する。

## 4. Scope
markdownEditor-for-mywork リポジトリの `src/editor/metatag-picker.ts` と `src/settings.ts`。

## 5. Implementation requirements
1. **5分単位設定の移行**:
   - `src/settings.ts` の `MdAstEditorSettings` インターフェースと `DEFAULT_SETTINGS` に、5分単位ステップのON/OFFを表す新しい設定項目を追加する（例: `roundMinuteStep: boolean`。命名は既存の設定項目の命名規則に合わせる）。既定値はON(`true`)とする。
   - 設定タブに、既存の `.addToggle(...)` パターン(52-76行目付近を参考)に倣って、この設定項目のトグルUIを追加する。
   - `metatag-picker.ts` から `minuteStepToggle`（チェックボックスUI、156-176行目）を削除し、代わりにプラグイン設定の値を参照して `applyMinuteStep()` 相当の処理（`startTimeInput.step`/`endTimeInput.step` の設定、`commitBtn` クリック時の丸め処理判定）を行うようにする。ピッカーはプラグイン設定にアクセスできる必要があるため、設定値の受け渡し方法（例: `buildPickerTooltipView` への引数追加、モジュールスコープの設定参照等）は既存のプラグイン⇔エディタ拡張機能間の設定受け渡しパターンに合わせて実装する。
2. **「期間で指定」表示制御の検証**:
   - 実機で、既存日付値の編集(`mode: 'edit'`)・新規挿入(`mode: 'insert'`)の両方のケースで、「期間で指定」チェックボックスのON/OFFに応じて終了日時欄が正しく表示/非表示になるかを確認する。
   - 再現する場合、原因（例: CSSで`hidden`属性が上書きされている、`change`イベントが発火しない等）を特定し修正する。
   - 再現しない場合（＝コード上の実装で既に正しく動作している場合）、@レビュー記録は解消済みと判断し、追加のコード変更は行わない。

## 6. Files / components likely to be changed
- markdownEditor-for-mywork/src/editor/metatag-picker.ts
- markdownEditor-for-mywork/src/settings.ts
- markdownEditor-for-mywork/styles/metatag-wysiwyg.css（ピッカーUIのスタイル調整が必要な場合）

## 7. Dependencies
- 他issueとの依存関係なし。独立して着手可能。
- issue-phase014-markdownEditor-002（@サジェスト機能）は本issueで改修する日付ピッカーの起動口(`openDatePickerForLine`)を利用するが、本issueの変更はその起動口のインターフェースを変えないため、相互依存はない。

## 8. Acceptance criteria
- 日付ピッカー内に「5分単位」チェックボックスが表示されない。
- Obsidianのプラグイン設定タブに「5分単位」相当の設定項目があり、ON/OFFを切り替えられる。既定値はON。
- 設定タブでOFFにした場合、ピッカーの時刻入力欄が5分刻みでなくなり、nowボタンも切り上げを行わない。
- 「期間で指定」チェックボックスがONのときのみ終了日時入力欄が表示され、OFFのときは非表示になり、その値は書き戻し時に無視される（既存の `isRange` ロジックが正しく動作する）。

## 9. Test requirements
- ユニットテスト: 設定タブの新規トグル項目の既定値・保存/読込を検証する。
- ユニットテスト（可能な範囲で）: `metatag-picker.ts` の分ステップ適用ロジックが、設定値に応じて正しく切り替わることを検証する。
- obs-e2e: 「期間で指定」ON/OFF切り替えで終了日時欄の表示/非表示が切り替わることを確認する。
- obs-e2e: 設定タブでの5分単位ON/OFF切り替えが、ピッカーの時刻入力に反映されることを確認する。

## 10. Out of scope
- 「上部の計画を設定」文言削除、閉じるボタン削除、決定ボタンへの文言変更、today/nowボタン、仮置きトグルの位置（いずれも調査の結果、既に実装済みと判断されるため対象外。実機確認で問題が見つかった場合は別途報告すること）。

---

## 2. Progress & Implementation Notes（実装記録）

### History (append-only)

### 2026-09-27 23:50

- User Instruction:
  - phase014シリーズを順番に実装する指示の3件目として着手。

- Change:
  1. **5分単位設定の移行**:
     - `src/settings.ts`: `MdAstEditorSettings`に`roundMinuteStep: boolean`を追加（`DEFAULT_SETTINGS.roundMinuteStep = true`）。設定タブに既存パターンに倣ったトグルを追加（デバウンス間隔設定の直前）。
     - `src/editor/metatag-picker.ts`: `metatagPickerExtension`（定数）を`createMetatagPickerExtension(getRoundMinuteStep: () => boolean): Extension`（ファクトリ関数）に変更。`task-drag-source.ts`の`createTaskDragSourceExtension`と同じ「コールバックで都度読み出す」既存パターンを踏襲。ピッカー内の「5分単位」チェックボックス(`minuteStepRow`/`minuteStepToggle`)を削除し、`buildPickerTooltipView`が引数で受け取った`roundMinuteStep`値に応じて`startTimeInput`/`endTimeInput`の`step`属性を直接設定する形に変更。
     - `src/plugin.ts`: `metatagPickerExtension`のimportを`createMetatagPickerExtension`に変更し、`this.registerEditorExtension(createMetatagPickerExtension(() => this.settings.roundMinuteStep))`として登録。
     - `src/lib/format/metatag-format.ts`: `nowExact(now: Date)`を追加（丸めを行わず現在時刻をそのまま`{date, time}`で返す）。`nowRounded()`は変更なし。
     - `src/editor/metatag-picker.ts`: `buildDateTimeRow()`に`roundMinuteStep: boolean`引数を追加し、nowボタンのクリックハンドラを`roundMinuteStep`が`true`のときのみ`nowRounded()`、`false`のときは`nowExact()`を使うよう分岐させた（Acceptance criteriaの「設定タブでOFFにした場合...nowボタンも切り上げを行わない」に対応）。
     - `tests/obs-e2e/metatag-decoration.e2e.ts`: 「5分単位トグル」関連の既存2テストを、プラグイン設定(`app.plugins.plugins['md-ast-editor'].settings.roundMinuteStep`)を直接書き換える方式に更新。ピッカー内にチェックボックスが存在しないことを確認する新規テスト、および設定OFF時にnowボタンが丸めを行わないことを確認する新規テストを追加。
     - `tests/integration/plugin.test.ts`: `loadSettings()`のデフォルト値検証に`roundMinuteStep: true`を追加。
     - `src/lib/format/metatag-format.test.ts`: `nowExact()`の単体テストを追加。
  2. **「期間で指定」表示制御の検証と修正**:
     - 実機Obsidianで再現検証した結果、既存の@レビュー指摘通り、「期間で指定」OFF時も終了日時欄が**実際に表示されたままになる**不具合を確認した（既存のobs-e2eテスト「「期間で指定」がOFFのとき終了日時入力は非表示で〜」が実機ビルドに対して失敗することで再現・確認）。
     - 原因: `styles/metatag-wysiwyg.css`の`.metatag-picker-row { display: flex; ... }`ルールが、`endRow.hidden = true`（HTML標準の`hidden`属性、ユーザーエージェント既定スタイルは`display: none`）よりCSSカスケード上優先される（author stylesheetはUA既定スタイルより常に優先されるため、詳細度に関わらず`display: flex`が勝つ）。コード側のロジック（`metatag-picker.ts`の`endRow.hidden = !parsed.isRange`、`change`リスナー）自体は正しく、CSS側の見落としが原因と判明した。
     - 修正: `styles/metatag-wysiwyg.css`に`.metatag-picker-row[hidden] { display: none; }`を追加し、`hidden`属性が確実に反映されるようにした。
     - 修正後、実機Obsidianで該当のobs-e2eテストが成功することを確認した（詳細はTest resultsを参照）。

- Rationale:
  - 5分単位の設定受け渡しは、本issueが明示的に例示した「モジュールスコープの設定参照等、既存のプラグイン⇔エディタ拡張機能間の設定受け渡しパターンに合わせる」方針に従い、コードベース内に既に存在する`createTaskDragSourceExtension`と同じ「コールバック注入」パターンを再利用した（新規パターンの導入を避けるため）。
  - 「期間で指定」表示制御は、実装要件2「実機で再現するか確認し、再現する場合は原因を特定して修正する」に従い、実機（wdio-obsidian-service経由の実機Obsidian）で再現確認・原因特定・修正まで行った。

- Test results:
  - `npx vitest run`: 565件すべて成功（設定デフォルト値の追加検証を含む）。
  - `npx wdio run wdio.conf.mts --spec tests/obs-e2e/metatag-decoration.e2e.ts`: 20件成功・2件失敗。失敗2件（「タイトル・閉じるボタンが表示されず...」内のEscキー閉じテスト、「insertモードでも仮置きトグルが表示され...」の`?`付与テスト）は、**本issueのOut of scope（今回のImplementation requirementsに含まれない既存実装の確認事項）に該当する既存の不具合**であり、本issueの変更（5分単位設定の移行・期間指定の表示制御）とは無関係であることを確認した（該当箇所のソースコードは今回未変更）。Out of scopeの記載（「実機確認で問題が見つかった場合は別途報告すること」）に従い、修正はせず、以下に報告のみ行う。
    - 問題A: ピッカー表示中にEscキーを押しても閉じない（実機で再現）。
    - 問題B: insertモード（`@schedule:`確定直後の自動起動）で「仮置き（?）」チェックボックスをONにして決定しても、書き戻される値に`?`が付与されない（実機で再現。editモードでの同等テストは対象外のため未確認）。
  - `npx svelte-check`: 本issueで変更した`settings.ts`/`metatag-picker.ts`/`plugin.ts`に起因する新規の型エラーなし。

- Acceptance criteria充足状況:
  - 「ピッカー内に5分単位チェックボックスが表示されない」: 満たした。
  - 「設定タブに5分単位トグルがあり、既定ON」: 満たした。
  - 「設定タブでOFFにすると時刻入力が5分刻みでなくなり、nowボタンも切り上げを行わない」: 満たした（`nowExact()`追加により対応。e2eで確認）。
  - 「期間で指定ONのときのみ終了日時欄が表示される」: 満たした（CSS修正により実機で確認）。

- Open items:
  - 上記「Test results」で報告した問題A（Escキーで閉じない）・問題B（insertモードで仮置き`?`が反映されない）は、本issueのImplementation requirementsに含まれない既存の不具合であり、本issueの変更（5分単位設定の移行・期間指定の表示制御）とは無関係であることを確認した上で、Out of scopeの記載に従い修正せず報告のみ行った。ユーザー判断で別issue化するか、次のphase014番号継続issueとして扱うかを決めてほしい。
  - ユーザーの明示的なクローズ承認待ち（`WORKFLOW.md §6`）。

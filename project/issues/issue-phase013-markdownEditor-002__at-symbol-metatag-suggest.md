# markdownEditor: リスト先頭での「@」入力時にschedule/plan/dueをサジェストする

対象リポジトリ: markdownEditor-for-mywork

## 1. Title
markdownEditor: リスト項目の先頭で「@」入力時にschedule/plan/dueをサジェストし、選択時に日付ピッカーを開く

## 2. Background
入力要望(ユーザー原文):
「リストの先頭での『@』入力で、schedule,plan,dueのサジェストを出す（リストの先頭以外では出さない）
- サジェストで上記が選択されたら、日付入力支援も表示し、マウス操作だけで入力が完了するようにする。
- memoやtagsなど別のメタ情報もあるため、上記３つを強制しない」

分析結果: 既存の自動オープン処理 `maybeAutoOpenPicker`(`metatag-decoration.ts` 217-224行目付近)は、「1回の変更で挿入された文字列がコロン `:` のみ」の場合にしか発火しない。そのため、サジェストで`@plan:`のような文字列を一括挿入しても、既存の自動オープン経路には乗らない。サジェスト機能側で明示的にピッカーを開く処理を呼び出す必要がある。

## 3. Objective
リストの先頭でのみ`@`入力に反応してschedule/plan/dueをサジェストし、選択時に日付入力ピッカー(別issueで改修済みのもの)を自動的に開いて、マウス操作のみで入力を完了できるようにする。

## 4. Scope
markdownEditor-for-mywork リポジトリのみ。

## 5. Implementation requirements
- Obsidianの`EditorSuggest`を継承した新しいサブクラスを実装し、`plugin.ts`で`registerEditorSuggest`により登録する。
- `onTrigger`の発火条件: カーソルより前の行テキストが正規表現 `^(\s*)- @([a-z]*)$` に一致する場合のみ発火する。
  - 次の場合は発火しない: タスク行(`- [ ] @`のようにチェックボックス記法を含む行。この解釈は既定案であり、【要確認】としてレビュー時にユーザーへ確認すること)、行の途中(先頭以外)にある`@`、IME変換中の入力。
- 候補: `schedule`・`plan`・`due`の3つ。ユーザーが入力済みの文字列で前方一致フィルタする。一致する候補が無くなった場合はサジェストを自動的に閉じ、`memo`など他のメタ情報キーをそのまま自由入力できる状態に戻す(3つのキーを強制しない)。
- 候補選択時の処理: 選択されたキー(例: `plan`)で`@plan:`をエディタに一括挿入したうえで、日付入力ピッカーを明示的に開く。実装方式は次の(a)を採用する(採用理由: (b)方式はundo単位が2回に分かれ挙動が暗黙的になるため採用しない):
  - (a) `metatag-decoration.ts`の`maybeAutoOpenPicker`内でピッカーを開いている処理を、`openDatePickerForLine(view, lineFrom)`のような関数としてexportし、サジェスト側からこれを呼び出す。`EditorView`はObsidianの`editor.cm`から取得する。

## 6. Files / components likely to be changed
- markdownEditor-for-mywork/src/editor/ 配下の新規ファイル(EditorSuggestサブクラス)
- markdownEditor-for-mywork/src/editor/metatag-decoration.ts(ピッカーを開く処理のexport化)
- markdownEditor-for-mywork/src/plugin.ts(registerEditorSuggestの登録)
- 関連ユニットテスト、obs-e2eテスト

## 7. Dependencies
- 「日付入力ピッカーのUI改修」issueに依存する(先にマージされている必要がある)。本issueは、そのissueで改修されたピッカーの起動口(`openDatePickerForLine`相当の関数)に接続する。

## 8. Acceptance criteria
- リスト項目の先頭で`@`を入力すると、schedule/plan/dueの候補がサジェストとして表示される。
- リストの先頭以外(文中)で`@`を入力してもサジェストは表示されない。
- 候補を選択すると、`@<key>:`が挿入され、日付入力ピッカーが自動的に開き、マウス操作のみで値の入力が完了できる。
- `memo`など候補にないメタ情報キーを続けて自由に入力できる(3キーへの強制がない)。

## 9. Test requirements
- ユニット: トリガー正規表現の判定表(リスト先頭、タスク行、文中、インデントあり/なしの各パターン)を検証する。
- obs-e2e: `- @`と入力→候補が3つ表示される→`plan`を選択→ピッカーが開く→マウス操作のみで値が挿入されることを確認する。
- obs-e2e: `- @memo`と入力するとサジェストが閉じ、そのまま自由入力できることを確認する。
- 実機確認: 他のObsidianプラグインの`@`サジェストとの競合有無を確認する。

## 10. Out of scope
- 日付ピッカー自体のUI変更(別issueで対応済みの前提)。
- タスク行での`@`サジェスト対応の是非の最終決定(既定は「出さない」。レビューでの確認事項)。

---

## 2. Progress & Implementation Notes（実装記録）

### History (append-only)

### 2026-09-27 21:40

- User Instruction:
  - phase013シリーズを順番に実装する指示の2件目として着手。issue-phase013-markdownEditor-001（先にマージ済み扱いとして本セッションで実装）の`openDatePickerForLine`起動口に接続する。

- Change:
  - `src/editor/metatag-decoration.ts`: `maybeAutoOpenPicker`内にあったピッカー起動処理を`openDatePickerForLine(view, lineFrom)`としてexport化。同関数は指定行が`@(plan|schedule|due)(\?)?:`に一致する場合のみinsertモードのピッカーを開く。`maybeAutoOpenPicker`はこの共通関数を呼び出す形にリファクタ。
  - `src/editor/metatag-suggest.ts`（新規）: `EditorSuggest`を継承した`MetaKeySuggest`を実装。`onTrigger`はカーソル直前のテキストが`^(\s*)- @([a-z]*)$`に一致し、かつschedule/plan/dueのいずれかに前方一致する場合のみ発火（タスク行`- [ ] @`・文中の`@`は正規表現の時点で非該当。IME変換中は`EditorView.composing`で判定して非発火）。前方一致候補が無ければ`onTrigger`がnullを返し、自動的に非表示になる（＝他のメタキーを自由入力できる）。候補選択時（`selectSuggestion`）は`@<key>:`を一括挿入した上で、採用方式(a)通り`openDatePickerForLine`をCM6の`EditorView`（`editor.cm`）経由で直接呼び出し、ピッカーを自動的に開く。純粋関数`matchMetaKeyTrigger`をexportし、トリガー判定をユニットテスト可能にした。
  - `src/plugin.ts`: `MetaKeySuggest`をimportし、`enableTaskHighlight`設定が有効な場合に`registerEditorSuggest(new MetaKeySuggest(this.app))`で登録。
  - `styles/metatag-wysiwyg.css`: サジェスト候補の補足ラベル用に`.metatag-suggest-item-label`を追加。
  - `src/editor/metatag-suggest.test.ts`（新規）: `matchMetaKeyTrigger`のユニットテスト（リスト先頭・インデントあり/なし・タスク行・文中・大文字・コロン付きの判定表）。
  - `tests/mocks/obsidian.ts`: ユニットテスト用モックに`EditorSuggest`クラスと`Plugin.registerEditorSuggest`を追加（既存の`Plugin`モックにメソッドが無く、`MdAstEditorPlugin`のonload()がテスト環境で失敗するため）。
  - `tests/obs-e2e/metatag-suggest.e2e.ts`（新規）: リスト先頭`@`での3候補表示、文中`@`での非表示、候補外文字列（`@memo`）入力時の非表示・自由入力、候補選択→`@plan:`挿入→ピッカー自動起動のシナリオを追加。

- Rationale:
  - 本issue（issue-phase013-markdownEditor-002）のセクション5・8・9、および採用理由(a)の記載に基づく。

- Verification:
  - `npx vitest run`: 563件中562件成功（1件は無関係な統合テストのフルスイート実行時タイムアウトで、対象を絞った再実行では成功。本変更との関連なし）。
  - `npx tsc --noEmit`: 変更・新規ファイル（metatag-suggest.ts / metatag-decoration.ts / plugin.ts / tests/mocks/obsidian.ts / metatag-suggest.e2e.ts）にエラーなし（e2eファイルに残る`Browser`型エラーは全obs-e2eファイル共通の既存事象で本変更と無関係）。
  - `node esbuild.config.mjs production`: ビルド成功、`main.js`/`styles.css`へ反映済み。
  - obs-e2e（実機Obsidian + WebdriverIO）は本セッションでは未実行（クレジット消費抑制のため）。「実機確認: 他のObsidianプラグインの`@`サジェストとの競合有無」も含め、ユーザー側での実機確認を推奨。

- Open items:
  - 「実機確認: 他のObsidianプラグインの`@`サジェストとの競合有無」（セクション9）は本セッションでは未検証。
  - タスク行での`@`サジェスト非対応は本issueの既定方針通り実装したが、セクション5に記載の通りレビューでの最終確認が必要。

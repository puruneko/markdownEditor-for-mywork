# 日付入力支援: 外側クリックで入力内容を保存し、Esc で破棄する

## 背景
要望原文（markdownEditor-for-mywork）:
> 日付・リピートの入力支援の入力中に外側をクリックしたら入力内容を保存して。今の動作は入力内容は捨てています。Escで捨てるようにして。

採用した解釈:
- 対象は日付ピッカー（エディタ内の @schedule/@plan/@due、および Gantt ツリーの日時セル編集で使う同じピッカー）。リピート入力支援は未実装のため、実装時（issue-phase020-markdownEditor-for-mywork-004）に同じ挙動にする。
- 外側クリック = 「決定」ボタンと同じ処理で保存して閉じる。Esc = 保存せず閉じる。
- 開始日が空など、「決定」でも保存できない状態での外側クリックは、何も保存せずに閉じる。

## 目的
ピッカーの外をクリックしたときに入力が失われないようにする。

## 現状
`src/editor/metatag-picker.ts` の `buildMetaDatePicker(opts)`（L215〜）:
- 「決定」ボタン（mousedown）: 開始日が空なら何もしない。それ以外は `buildMetaDateValue({...})` で値を作り `opts.onCommit(value, tentative)`。
- `mount()`: 1tick 遅延で document に capture の `mousedown`（ピッカー外なら `opts.onClose()`）と `keydown`（Escape で `opts.onClose()`）を登録。→ 外側クリックも Esc も破棄。
- 利用箇所:
  - エディタ: `buildPickerTooltipView`（L316〜）。onCommit で行を書き換え、onClose で `openMetaPicker.of(null)`。
  - Gantt ツリー: `src/lib/gantt/tree-date-picker.ts` の `openTreeDatePicker`。onCommit で `req.onCommit(value)` → close、onClose で close。

## 実装内容
1. `buildMetaDatePicker` 内で「決定」ボタンの処理を関数 `commitCurrent(): boolean`（保存できたら true）に切り出す。
2. 外側 `mousedown` では `commitCurrent()` を呼び、保存できなかった場合は `opts.onClose()` を呼ぶ。
3. Escape は従来どおり `opts.onClose()`（破棄）。
4. 二重実行防止: commit/close 後はリスナーを外す、またはフラグで以降の呼び出しを無視する（エディタ側は onCommit 内で dispatch によりツールチップが破棄される、ツリー側は close() で destroy される）。
5. 外側クリックで保存したとき、そのクリック自体（別の行のクリック、ツリーの別セルのクリック等）は通常どおり処理されるようにする（preventDefault しない）。
6. ファイル冒頭/関数の JSDoc に本挙動と issue 番号を追記。`tree-date-picker.ts` の JSDoc（「確定・外側クリック・Escape…で閉じる」）も更新。

## 完了条件
- エディタの日付ピッカーで値を変更後、ピッカー外をクリックすると、その値がメタ行に書き込まれる。
- Gantt ツリーの日時セルのピッカーでも、外側クリックで値が保存される。
- Esc を押すと、変更は保存されずにピッカーが閉じる。
- 開始日が空の状態で外側クリックした場合は、何も書き込まずに閉じる。

## テスト
- `src/editor/metatag-picker.test.ts` に追加: mount 後に document へ外側 mousedown → onCommit が（決定ボタンと同じ値で）呼ばれ onClose は呼ばれない／Escape → onClose のみ／開始日空で外側 mousedown → onCommit なし・onClose あり／ピッカー内 mousedown → どちらも呼ばれない。
- `npm run test:unit` が通ること。

## 依存関係
なし

## 対象外
- リピート入力支援の実装（issue-phase020-markdownEditor-for-mywork-004 で同じ挙動を実装する）。

## 要確認
- 新規挿入（`@schedule:` 入力直後に自動で開いた状態）で何も操作せずに外側をクリックした場合も、初期表示の日付で保存される（決定ボタンと同じ動作）。不都合があれば調整。

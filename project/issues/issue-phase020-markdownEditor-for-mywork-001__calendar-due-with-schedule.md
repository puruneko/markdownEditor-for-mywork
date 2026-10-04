# カレンダーで @schedule を持つタスクの @due も期限として表示する

## 背景
要望原文（calendar-for-mywork）:
> dueが正しく表示されない。表示されるものもあるが、表示されないものがほとんど。原因を調査し、修正して。

調査結果（原因）:
- カレンダーに渡す項目は markdownEditor-for-mywork の `src/lib/calendar/ast-to-calendar.ts` で生成している。
- `extractFromNodes`（L131〜）の期限項目の生成条件は `node.type === 'task' && !node.meta?.schedule && node.meta?.due && !node.meta?.repeat`（L140）であり、**@schedule を持つタスクの @due は一切カレンダーに出ない**。期限は作業予定（@schedule）とあわせて書かれることが多いため、「表示されるものもあるが、ほとんど表示されない」現象の主因と判断した（@schedule を持たない @due のみのタスクだけが表示されている）。
- 仕様 `project/specs/time-meta-model.spec.md` BR-034「Calendar は `@due` を太い横線＋左端矢印として描画しなければならない」は schedule の有無で限定していない。

採用した解釈: @schedule の有無に関わらず、タスクの @due を期限項目として出す。

## 目的
@due を持つタスクの期限がカレンダーに表示されるようにする。

## 現状
- `src/lib/calendar/ast-to-calendar.ts`:
  - `buildDueOnlyItem(node, sourcePath, viewRange)`（L95〜129）: `@due` が期間（`/` を含む）なら null。`YYYY-MM-DD` なら `CalendarDatePoint`、それ以外は ISO として `CalendarDateTimePoint`。viewRange 外なら null。id は `${globalKey}__due`。
  - `extractFromNodes`: 上記条件（L140）で due 項目を生成し、続けて `@schedule` があれば予定項目（repeat は展開）を生成。
- calendar-for-mywork 側は `CalendarDatePoint` / `CalendarDateTimePoint` を期限として描画する（`src/lib/utils/itemUtils.ts` の `isDeadlineDay` / `isDeadlineTimed`）。
- 既存テスト: `src/lib/calendar/ast-to-calendar.test.ts`。

## 実装内容
1. `extractFromNodes` の期限項目の生成条件から `!node.meta?.schedule` を外す（`node.type === 'task' && node.meta?.due && !node.meta?.repeat`）。schedule 由来の予定項目（id = globalKey）と期限項目（id = `${globalKey}__due`）は id が異なるため併存できる。
2. `buildDueOnlyItem` の名前・JSDoc を実態に合わせて更新（例: `buildDueItem`、「@schedule の有無に関わらず生成」と issue 番号を追記）。
3. 期限項目のクリック/ドラッグ等で `__due` 付き id から元ノードを引く処理（CalendarTab 等）が、schedule を持つタスクでも正しく元ノードに解決されることを確認する（due-only で既に動いている経路と同じであれば変更不要）。
4. 実データでの確認: Obsidian で @schedule と @due を両方持つタスク、@due のみのタスク、日付のみ/日時の @due を含むノートを開き、カレンダー（週・月）に期限が表示されることを確認する。それでも表示されないパターンがあれば、そのパターンと原因を本issueに追記して修正する。

## 完了条件
- @schedule と @due を両方持つタスク（repeat なし）で、予定と期限の両方がカレンダーに表示される。
- @due のみのタスクは従来どおり表示される。
- 日付のみ（`YYYY-MM-DD`）・日時の @due の両方で表示される。

## テスト
- `ast-to-calendar.test.ts` に追加:
  - schedule + due（日付のみ）のタスク → 予定項目と `__due` の `CalendarDatePoint` の2件。
  - schedule + due（日時）→ `CalendarDateTimePoint`。
  - schedule + due + repeat → 期限項目は生成されない（従来どおり）。
  - viewRange 外の due は生成されない。
- `npm run test:unit` が通ること。

## 依存関係
なし

## 対象外
- 期間形式の @due（`開始/終了`）の表示（従来どおり生成しない）。
- @repeat 付きタスクの @due。
- チェックボックスのないリスト項目・見出しの @due。
- calendar-for-mywork 側の期限の描画デザイン。

## 要確認
- 期間形式の @due をカレンダーでどう表示するか（終了日時を期限として出す等）。必要なら別途要望化。

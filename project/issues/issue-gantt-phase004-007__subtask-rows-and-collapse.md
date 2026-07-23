# [gantt] サブタスク表示（展開モード・折り畳み・期間なしサブタスクの行表示）

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
現状、本体の ast-to-gantt は子タスクを**畳んで**親の 1 行に集約している（descendantDateRange で min/max を計算）。オーナー要望はサブタスクの展開表示:

```
■■■■■■■ 親タスク ■■■■■■■
 |・サブA                ← 期間なし：テキスト行として表示
 |　 ■■ サブB ■■         ← 期間あり：バー表示
 |・サブC
```

- デフォルトは**表示 OFF**（従来の集約表示のまま）。
- **期間なしのサブタスクも行として成立**する（ここが新規性: 普通のガントは期間必須。「まだ日時を割っていない子タスク」を親の下に見せることで、次の Issue の「DnD で予定化」につながる）。
- 親タスク単位で折り畳みできる。

### 方針
本 Issue は**表示系のみ**（ライブラリ側の行モデル・折り畳み・期間なし行）。行 DnD→予定化は issue-gantt-phase004-008（本 Issue の後）。本体側の「展開モードで子を個別ノードとして渡す」投影変更も本 Issue のスコープに含む（表示できないと検証できないため）。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- **実装前に本体リポジトリの `project/governance/`・`issue-phase004-000__phase-overview.md`・`issue-gantt-phase004-000__gantt-overview.md` を必ず読むこと。**
- **既存テストの見直しは機能実装と同等に重要（本 Issue は特に）。** 本体 `ast-to-gantt.test.ts` は「子は集約される」前提のテストが多数あるはず。展開モード追加後も**集約モードの既存テストは維持**し（デフォルト OFF なので既存挙動は正）、展開モードのテストを**新設**する。lib 側もツリー行生成のテストが影響を受ける。

### 対象・既存資産
- lib: `../ganttchart-for-mywork/src/types.ts`（GanttNode は既に `parentId` / `isCollapsed` を持つ — 着手時に現行の親子・折り畳みの実装度を確認し、**使える機構は再実装せず使う**。確認結果を履歴に記録）。
- lib: `src/components/GanttTree.svelte` / `GanttTimeline.svelte`。
- 本体: `src/lib/gantt/ast-to-gantt.ts`（descendantDateRange による集約）と `src/views/GanttViewMount.svelte`（モード切替 UI の置き場）。

### 仕様
1. **モード**: 本体側に表示トグル「サブタスク展開」（デフォルト OFF。※2026-07-23 にデフォルト ON へ変更、履歴参照）。OFF: 従来どおり集約。ON: 子タスクを個別 GanttNode として parentId 付きで渡す。
2. **期間なし行**: start/end が undefined の GanttNode を「タイムライン上に左寄せのテキスト行（・タスク名）」として描画する。バーは描かない。既存実装が undefined をどう扱っているか（スキップ？エラー？）を最初に確認し、スキップしているなら描画分岐を追加。
3. **折り畳み**: 親行のツリー側に ▸/▾ トグル。折り畳んだ親は従来の集約バー（min/max）で表示（＝OFF モードの見た目と同じ）。既存 `isCollapsed` 機構が使えるなら流用。
4. **折り畳み状態の保持**: ライブラリ内部状態＋`onCollapseChange?: (id, collapsed) => void` コールバック（永続化はホスト責務 — 汎用性維持）。
5. ネスト 3 段以上: 全段展開する（オーナー決定 Q5: 詳細はエンジニア裁量、初期案は全展開）。

### 実装の要点・つまずき
- **id の一意性**: 展開モードで子を渡すとき、id は globalKey（本体側で一意）。集約モードとの切替で id 集合が変わるため、lib 側に「前回の id を前提としたキャッシュ」があると切替時に壊れる。切替テストを必ず書く。
- 期間なし行のテキストは行クリック（既存の onNodeClick 相当があるなら）でエディタジャンプが効くこと（既存カーソル同期の回帰確認）。
- 表示範囲計算: 期間なし行は範囲計算に影響させない。

### TODO
- [ ] lib: 現行の parentId / isCollapsed 実装度の調査（履歴に記録）
- [ ] lib: 期間なし行の描画・折り畳みトグル・onCollapseChange
- [ ] 本体: 展開モード投影（ast-to-gantt）＋トグル UI
- [ ] 両リポジトリのテスト見直し＋新設（集約モード回帰・展開モード・切替）
- [ ] 本体 E2E: gantt-view.e2e.ts に展開モードのスモーク 1 件（実行時生成ファイル・shadow ヘルパ使用）

### 受け入れ基準
- トグル OFF で従来表示（完全回帰）。
- ON で子タスクが行として現れ、期間なし子はテキスト行、期間あり子はバー。
- 親の ▸/▾ で折り畳め、畳むと集約バー表示になる。
- 両リポジトリのテストと本体 `npm run test:obs:e2e` 全通過。

### テスト観点
- ast-to-gantt: 展開/集約の投影 unit（親子 id・期間なし子の undefined start/end）。
- lib: 期間なし行の描画分岐・折り畳みトグル・切替時の再構築。

### 履歴（追記のみ）
- 2026-07-04 — 起票。

### 2026-07-23 14:00

- User Instruction:
  - ビルドして Obsidian に読ませても期限無しサブタスクが表示されないため、原因調査を依頼。データの渡し方を制限しているなら本来のデータをフルに渡すよう修正、それ以外が原因なら特定して修正するよう指示。

- 調査結果:
  - `ast-to-gantt.ts` の抽出ロジック、`GanttTab.svelte`/`GanttViewMount.svelte`/`GanttView.ts` の props 配線、lib 側 `data-manager.ts`、実際に `GanttChart` コンポーネントを `@testing-library/svelte` でマウントして DOM を確認する再現テストまで通しで検証。`expandSubtasks: true` の場合、単階層・多階層（3段以上）・親自身も日時なしのケースいずれも、期間未設定のサブタスクがツリー行・タイムラインのテキスト行として正しく描画されることを確認。データを取りこぼしているコード上の欠陥は見つからなかった。
  - オーナーが Obsidian 側で設定「サブタスク展開」トグルを ON にしたところ表示された。原因はコード欠陥ではなく、既定 OFF（本 Issue の元々の仕様どおり）のままトグルを ON にしていなかったこと。

- Change:
  - オーナー指示によりデフォルト値を OFF → ON に変更（`src/settings.ts` の `DEFAULT_SETTINGS.ganttExpandSubtasks`）。
  - 設定画面の説明文を「既定 ON。OFFにすると従来どおり集約表示」に更新。
  - `ExtractOptions.expandSubtasks` / 各コンポーネント props の関数レベル既定値（`false`）はライブラリ API の安全側デフォルトとして維持し変更していない。アプリの実挙動は `settings.ts` の `DEFAULT_SETTINGS` が決める。

- Rationale:
  - オーナー実機検証により、サブタスク展開表示を常時有効にしたいという意向が確認されたため。

---

## 3. メタデータ
- id: issue-gantt-phase004-007__subtask-rows-and-collapse
- status: open
- phase: 004
- target_repo: ../ganttchart-for-mywork（＋本体 src/lib/gantt/）
- related_issues: issue-phase004-000, issue-phase004-004, issue-gantt-phase004-008（後続）, issue-phase003-001（未予定→予定化の思想元）
- created: 2026-07-04
- updated: 2026-07-04

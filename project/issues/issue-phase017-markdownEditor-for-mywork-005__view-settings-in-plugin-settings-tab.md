# プラグイン設定画面に Gantt・Calendar・Kanban の設定セクションを追加する

## 背景
- リポジトリ: `markdownEditor-for-mywork`。
- 要望原文:
  > ganttchart, calendarなどの機能の設定項目をobsidian拡張機能設定画面でも設定できるようにし、保存して。obsidianを閉じて再度起動しても、前の設定状態で再開できるようにして（webのcookieとかlocalstrageのように）
- 採用した解釈:
  - 対象は、設定を `data.json`（設定ハブ）に保存しているビュー: Gantt（issue-phase017-markdownEditor-for-mywork-004 で対応）・Calendar・Kanban。「など」はこの3つと読む。
  - 設定画面（`PluginSettingTab`）とビュー内の設定パネルは、同じ保存データ（`viewSettings.<namespace>`）を読み書きする。どちらで変えても保存され、次回ビューを開いたときに反映される。
  - 設定画面に載せるのは、真偽値・数値・選択肢で表せる単純な項目。配列や入れ子が深い項目（Kanban のレーン定義、Calendar の曜日別営業時間、Gantt のスナップ粒度・ツリー列）は設定画面で扱わない（UI 規模が大きく、ビュー内で編集できるため）。

## 目的
Obsidian のプラグイン設定画面から、各ビューの主要設定を変更・保存できる。

## 現状
- `src/settings.ts` 59行〜 `MdAstEditorSettingTab.display()`: プラグイン自体の設定（リボン、ハイライト、分刻み、デバウンス、スクロール、索引スコープ、サブタスク展開、既定所要時間 等）のみ。
- `src/settings-hub.ts` `ViewSettingsHub.get/set`（`set` は namespace 丸ごと置換）。プラグインからは `this.plugin.settingsHub`。
- 保存データ:
  - `gantt`: `Partial<GanttConfig>`（ganttchart。issue-phase017-markdownEditor-for-mywork-004）。
  - `calendar`: `CalendarStorageData = { weekSettings, monthSettings, businessHours }`（calendar-for-mywork `src/lib/models/settings.ts` 77行。既定値 `DEFAULT_STORAGE_DATA` は `svelte-calendar-lib` から export 済み）。Calendar 側の読み込みは `deepMerge` のため部分データでよい。
  - `kanban`: `KanbanUserConfig`（`src/lib/kanban/kanban-user-config.ts` 8行: `lanes, groupBy, headingLevel, showUnits, allowCrossGroupMove, cardTitleMultiline`）。

## 実装内容
1. `MdAstEditorSettingTab.display()` の末尾に見出し付きセクションを3つ追加（`new Setting(containerEl).setHeading()` 等）。
   - **Gantt**: 行の高さ、ツリーペイン幅、インデント幅、ツリーペイン表示、期間なしサブタスク表示、ツリーのフォントサイズ、チャートのフォントサイズ、土日表示、週末背景（キー名は ganttchart の `GanttConfig` に合わせる）。
   - **Calendar**: `weekSettings` の startHour, endHour, minorTick, majorTick, showWeekend, showAllDay, showPlanBand, weekStartsOn ／ `monthSettings` の maxItemsPerDay, weekStartsOn, showWeekend, showAllDay, showSingleDay, showTaskTime ／ `businessHours.enabled`。
   - **Kanban**: groupBy, headingLevel, showUnits, allowCrossGroupMove, cardTitleMultiline。
   - UI: 真偽値 → トグル、数値 → テキスト入力（数値検証、範囲外は保存しない）またはスライダー、選択肢がある項目（weekStartsOn 等）→ ドロップダウン。ラベルは日本語。
2. 表示値 = 保存値 ?? 各ライブラリの既定値。
3. 保存: `hub.get(namespace)` に変更キーを（入れ子はその階層だけ）マージして `hub.set(namespace, merged)`。他のキー（lanes 等）を消さない。マージ処理は純粋関数として切り出す。
4. 開いているビューへの即時反映は行わない。ビューを開き直すと反映される旨を各セクションの説明文に書く。

変更ファイル: `src/settings.ts`（行数が増える場合は `src/settings-view-sections.ts` 等に分割してよい）, テスト

## 完了条件
- 設定画面に Gantt・Calendar・Kanban の3セクションがあり、上記項目が表示される。
- 設定画面で変えた値が `data.json` の `viewSettings.<namespace>` に保存され、既存の他キーが消えない。
- ビューを開き直すと、設定画面で変えた値が反映されている。
- ビュー側で変えた値は、設定画面を開き直すと反映されている。
- Obsidian 再起動後も値が保持される。

## テスト
- 単体: namespace データへの部分マージ（入れ子・未保存・他キー保持）。
- 単体: 数値入力の検証（範囲外・非数値は保存しない）。
- 手動: 設定画面で変更 → ビューを開いて反映確認 → 再起動後も保持。

## 依存関係
- issue-phase017-markdownEditor-for-mywork-004__gantt-view-settings-persistence.md
- `ganttchart-for-mywork` の issue-phase017-ganttchart-for-mywork-003__config-panel-zoom-section-and-tree-chart-split.md（ツリー/チャートのフォントサイズのキー）

## 対象外
- 開いているビューへの即時反映。
- 配列・深い入れ子項目（Kanban レーン、曜日別営業時間、スナップ粒度、ツリー列、Tick 定義）の設定画面での編集。
- Dashboard ビュー。

## 要確認
- 開いているビューへの即時反映が必要か。
- 設定画面に載せる項目の過不足。

## History

### 2026-10-03

- User Instruction:
  - phase017 の issue を順に実装

- Change:
  - 実装済み（単体テスト・ビルド green）。Obsidian 実機確認とクローズ承認は未実施のため Open のまま。

- Rationale:
  - WORKFLOW §6: ユーザー承認なしに closure しない。

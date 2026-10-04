# Gantt ビューの設定を data.json に保存し、Obsidian 再起動後も復元する

## 背景
- リポジトリ: `markdownEditor-for-mywork`（ライブラリ側の前提: `ganttchart-for-mywork` の `onConfigChange` ハンドラ）。
- 要望原文:
  > ganttchart, calendarなどの機能の設定項目をobsidian拡張機能設定画面でも設定できるようにし、保存して。obsidianを閉じて再度起動しても、前の設定状態で再開できるようにして（webのcookieとかlocalstrageのように）
- 要望は「保存・復元」と「設定画面での編集」の2要素に分かれる。本 issue は Gantt の保存・復元を扱う（設定画面は issue-phase017-markdownEditor-for-mywork-005）。
- Calendar・Kanban は設定ハブ経由で既に `data.json` へ保存している。Gantt だけが未対応のため、最優先で整える。

## 目的
Gantt ビューの設定パネル等で変えた設定が `data.json` に保存され、Obsidian を再起動しても同じ設定でビューが開く。

## 現状
- `src/settings-hub.ts` `ViewSettingsHub`: `get<T>(namespace)`（未保存なら `{}`）、`set<T>(namespace, data)`（namespace を丸ごと置換して `data.json` に保存）。`plugin.ts` 33行で生成。
- 既存の利用例: `src/views/KanbanView.ts` 44-46行（`initialUserConfig` と `onUserConfigChange` を mount props で渡す）、`CalendarView.ts` 42行（`createHubStorageBackend`）。どちらもコンストラクタで `settingsHub` を受け取る（`plugin.ts` 101/111行）。
- `src/views/GanttView.ts`: `settingsHub` を受け取っていない。`getExtraMountProps()` は `expandSubtasks`/`defaultDurationMin` のみ。
- `src/views/GanttViewMount.svelte` 46行 → `src/lib/gantt/GanttTab.svelte`: `ganttConfig = $state({ mode: 'controlled', dayWidth: 30, defaultDurationMinutes })` を `GanttChart` に渡す。`onZoomChange` で `ganttConfig` を作り直している。
- ganttchart 側では、利用者の操作で設定が変わると `handlers.onConfigChange(updates: Partial<GanttConfig>)` が呼ばれる（依存 issue で追加）。

## 実装内容
1. `plugin.ts` の GanttView 生成で `this.settingsHub` を渡し、`GanttView` のコンストラクタで受け取る。
2. `GanttView.getExtraMountProps()` に以下を追加し、`GanttViewMount` → `GanttTab` へ渡す:
   - `initialGanttConfig: this.settingsHub.get<Partial<GanttConfig>>('gantt')`
   - `onGanttConfigChange: (cfg) => this.settingsHub.set('gantt', cfg)`
3. `GanttTab.svelte`
   - 初期 `ganttConfig` = 現行の既定値に `initialGanttConfig` を上書きマージ（`mode` と `defaultDurationMinutes` は保存値で上書きしない）。
   - `handlers.onConfigChange(updates)`: `ganttConfig = { ...ganttConfig, ...updates }` にし、保存対象のキーだけを抜き出して既存保存値とマージし、`onGanttConfigChange` を呼ぶ。
   - 保存対象: `onConfigChange` で通知される全キーから、`mode`・`defaultDurationMinutes`・`dayWidth` を除いたもの（関数や DateTime など JSON 化できない値は保存しない）。
4. `ganttConfig` を作り直す既存処理（`onZoomChange`）で、利用者が変えた設定が失われないことを確認する（上記 3 でマージ済みのため、失われないはず）。
5. `npm run build`（`libs:update` で最新 ganttchart を取り込む）→ Obsidian で確認。

変更ファイル: `src/plugin.ts`, `src/views/GanttView.ts`, `src/views/GanttViewMount.svelte`, `src/lib/gantt/GanttTab.svelte`, テスト

## 完了条件
- Gantt の設定パネルで行の高さ・フォントサイズ・土日表示などを変えると、`data.json` の `viewSettings.gantt` に保存される。
- ツリーペイン幅をドラッグで変えた値も保存される。
- Obsidian を再起動して Gantt ビューを開くと、保存した設定で表示される。
- ズーム操作をしても、設定パネルで変えた値が元に戻らない。
- Calendar・Kanban の保存動作は変わらない。

## テスト
- 単体: GanttTab の設定マージ関数（既定値＋保存値、保存対象キーの抽出、`mode` 等の除外）を純粋関数に切り出してテスト。
- 既存の `settings-hub.test.ts` が green。
- 手動: Obsidian で変更 → 再起動 → 復元を確認。あわせて Calendar・Kanban の設定も再起動後に保持されることを確認する（保持されていなければ不具合として報告）。

## 依存関係
- `ganttchart-for-mywork` の issue-phase017-ganttchart-for-mywork-004__config-change-handler.md（`onConfigChange` の追加）

## 対象外
- 設定タブでの編集（issue-phase017-markdownEditor-for-mywork-005）。
- ズーム倍率（`dayWidth`）と Tick 定義の保存。
- Dashboard ビューの設定（保存すべき設定が現状無い）。

## 要確認
- ズーム倍率も再起動後に復元すべきか（今回は対象外）。

## History

### 2026-10-03

- User Instruction:
  - phase017 の issue を順に実装

- Change:
  - 実装済み（単体テスト・ビルド green）。Obsidian 実機確認とクローズ承認は未実施のため Open のまま。

- Rationale:
  - WORKFLOW §6: ユーザー承認なしに closure しない。

# 設定ハブ（保存/読込/配布の配線＋配線切れの修復）（元ID: I-08 ／ 対応 preIssue: MARKDOWN-003 ／ Phase: 2）

## 1. Background（背景）

`修正したい箇所.md` の markdownEditor 節: 「管理する各拡張機能（カレンダーなど）の設定を保存できるようにして」（MARKDOWN-003 に対応）。

前版では「保存すべき設定項目の一覧が未確定」として起票不可としていたが、**器（保存/読込/配布の配線）と既知の項目は今すぐ作れる**と判断された。項目の追加は後続 issue（calendar の I-13/I-14、kanban の I-27/I-28）で各自が行う。

**現状（issue 本文に転記済み）**:

| 対象 | 状態 |
|---|---|
| Obsidian 標準機構（`loadData`/`saveData`） | `src/plugin.ts` で正しく機能している |
| Gantt `ganttExpandSubtasks` | 設定 UI・`GanttView.getExtraMountProps()`・Mount への転送が**完全に配線済み**（唯一の成功例。このパターンを横展開する） |
| Gantt `defaultDurationMin` | **`settings.ts` に定義（既定60）があるが `GanttView.getExtraMountProps()` が転送していない**。`GanttTab.svelte` の prop は常に `undefined` で既定値60にフォールバック＝**死んだ設定** |
| Calendar | `CalendarTab.svelte` が `new CalendarStorage(new LocalStorageBackend())` を**コンポーネント内で自前生成**。ブラウザ `localStorage` へ保存され、`data.json` とは別系統 |
| Kanban | `KanbanTab.svelte` の素の `$state` 6件（`userLanes` / `userGroupBy` / `headingLevel` / `showUnits` / `allowCrossGroupMove` / `cardTitleMultiline`）のみ。**ビューを閉じると消える** |
| Dashboard | `theme="system"` のリテラル固定（I-02 で `"light"` に変更済みの想定） |

## 2. Objective（目的）

ビュー別の名前空間を持つ設定ハブを新設し、Obsidian の `data.json` を経由して各ビューの設定を保存・読込・配布できるようにする。同時に既知の配線切れ（`defaultDurationMin`）を修復する。

## 3. Scope（スコープ）

- 設定ハブの新設（`plugin.ts` の `loadData`/`saveData` の上に構築）
- `GanttView.getExtraMountProps()` への `defaultDurationMin` の追加
- `CalendarTab.svelte` の `LocalStorageBackend` を Obsidian `saveData`/`loadData` へ委譲するカスタム実装への差し替え
- `KanbanTab.svelte` の素の `$state` を設定ハブへ配線
- Dashboard の `theme` 設定は I-02（issue-phase010-markdownEditor-002__shadow-theme-lockdown-light.md）で対応済みの想定

## 4. Implementation requirements（実装要件）

1. `plugin.ts` の `loadData`/`saveData` の上に、**ビュー別の名前空間を持つ設定ハブ**を作る
2. `ShadowItemView.getExtraMountProps()` 経由で各ビューへ配る
3. **`GanttView.getExtraMountProps()` に `defaultDurationMin` を追加する（配線切れの修復）**
4. `CalendarTab.svelte` の `LocalStorageBackend` を、Obsidian `saveData`/`loadData` へ委譲するカスタム `StorageBackend` 実装に差し替える。**`CalendarStorage` は `StorageBackend`（`load()`/`save()`）を差し替え可能な設計で、`deepMerge` により保存値と overrides が自動マージされるため、calendar 側の改修は不要**
5. `KanbanTab.svelte` の素の `$state` を、`onConfigChange` を受けてハブへ保存する形に配線する。**kanban ライブラリは `KanbanBoardConfig` を props で受け、変更を `onConfigChange` で通知する設計になっており、ライブラリ側の改修は不要**

## 5. Files / components likely to be changed（変更が見込まれるファイル／コンポーネント）

- `src/plugin.ts`（設定ハブの新設、`loadData`/`saveData` 拡張）
- `src/views/ShadowItemView.ts`（`getExtraMountProps()` 経由の配布）
- `src/views/GanttView.ts`（`getExtraMountProps()` への `defaultDurationMin` 追加）
- `src/lib/calendar/CalendarTab.svelte`（`StorageBackend` 実装の差し替え）
- `src/lib/kanban/KanbanTab.svelte`（`$state` → `onConfigChange` 経由のハブ保存への配線）
- `src/settings.ts`（`defaultDurationMin` の既定値定義。参照確認）

## 6. Dependencies（依存関係）

- 先行 Issue: なし（Phase 2）
- **重要（ブロッカー）: この issue の完了前に、各ビューの「設定で切り替え」系（calendar リポジトリ側の『月表示のタスク時間 表示/非表示トグル』『イベント名のタスク名／親階層名 切替』、kanban リポジトリ側の『ステータス表示の共通ヘッダー化・レイアウト切替』『レーンの最小化』の各機能）に着手しないこと。着手すると5系統目・6系統目の永続化が生まれ、後で全部作り直しになる**
- 他リポジトリ側でこの issue の完了を前提にしている機能: calendar リポジトリの『月表示タスク時間トグル』機能は本設定ハブを保存先として利用する想定であり、`localStorage` へ新規に項目を増やさない方針を取っている。kanban リポジトリの『ヘッダーレイアウト共通化』機能（`headerLayout` 設定）、および『レーン最小化』機能（`minimized` 設定）は、いずれも本設定ハブが永続化の基盤として存在することを前提にしている

## 7. Acceptance criteria（受け入れ基準）

- 設定画面で `defaultDurationMin` を変えると、ガントへの外部ドロップ時の既定所要時間が変わる
- カレンダーの設定がビューを閉じて開き直しても保持される
- かんばんのレーン設定・グルーピング設定がビューを閉じて開き直しても保持される

## 8. Test requirements（テスト要件）

- **要確認**: この issue 専用の自動テスト方針は明確に定められていない。設定ハブ自体の単体テスト方針（保存/読込/マージ挙動）を追加するかどうかは実装時に判断すること
- 上記 Acceptance criteria の3点は最低限、目視または E2E で確認すること

## 9. Out of scope（対象外）

- calendar の `MonthViewSettings` への時間表示トグルなど、個別ビューの新設定項目の追加自体（後続 issue で各自が行う）
- kanban の `headerLayout` / `minimized` 設定項目の追加自体（後続 issue で各自が行う）
- Dashboard のテーマ設定（I-02 で対応済みの想定であり、本 issue の対象外）

## Progress & Implementation Notes

### History

#### 2026-09-22

- User Instruction:
  - project/governance のルールに従い、issue-phase010 シリーズを順番にすべて実装する

- Change:
  - `src/settings-hub.ts` を新設し、`ViewSettingsHub` クラス（`plugin.settings.viewSettings` の上に構築するビュー別名前空間の設定ハブ）を実装した。`get<T>(namespace)` は同期でメモリ上の値を返し、`set<T>(namespace, data)` は `plugin.saveSettings()`（`data.json` への保存）を非同期・fire-and-forget で呼ぶ
  - `src/settings.ts` の `MdAstEditorSettings` に `viewSettings: Record<string, unknown>`（既定 `{}`）を追加した。また、これまで UI が存在しなかった `defaultDurationMin` の設定項目（テキスト入力）を「Gantt View」セクションに追加した
  - `src/plugin.ts` に `settingsHub!: ViewSettingsHub` を追加し、`onload()` で `loadSettings()` 直後にインスタンス化。`CalendarView` / `KanbanView` の生成に `this.settingsHub` を渡すよう配線した
  - **Gantt の `defaultDurationMin` 配線切れの修復**: `src/views/GanttView.ts` の `getExtraMountProps()` に `defaultDurationMin: this.settings.defaultDurationMin` を追加。`src/views/GanttViewMount.svelte` に `defaultDurationMin?: number` prop を追加し `GanttTab` へ転送するようにした（従来は `GanttTab.svelte` が prop を受け取れる実装だったが、経路が繋がっておらず常に既定値 60 にフォールバックしていた）
  - **Calendar**: `src/lib/calendar/hub-storage-backend.ts` を新設し、`createHubStorageBackend(hub)` が `StorageBackend`（`load`/`save`）を設定ハブの `'calendar'` 名前空間へ委譲する実装を提供。`CalendarTab.svelte` に `storageBackend?: StorageBackend` prop を追加し、渡されなければ従来どおり `new LocalStorageBackend()` にフォールバックする（スタンドアロン開発アプリ `EditorLayout.svelte` の既存呼び出しへの後方互換）。`CalendarViewMount.svelte` で prop を中継。`CalendarView.ts` の `getExtraMountProps()` で `storageBackend: createHubStorageBackend(this.settingsHub)` を返すようにした
  - **Kanban**: `src/lib/kanban/kanban-user-config.ts` を新設し `KanbanUserConfig` 型（`lanes`/`groupBy`/`headingLevel`/`showUnits`/`allowCrossGroupMove`/`cardTitleMultiline`）を定義。`KanbanTab.svelte` の素の `$state` 群を `initialUserConfig` prop から初期化し、`handleConfigChange` で `onUserConfigChange` を呼ぶよう配線。`KanbanViewMount.svelte` で prop を中継。`KanbanView.ts` の `getExtraMountProps()` で `initialUserConfig: this.settingsHub.get('kanban')` / `onUserConfigChange: (config) => this.settingsHub.set('kanban', config)` を返すようにした
  - 単体テスト新設: `src/settings-hub.test.ts`（`ViewSettingsHub` の get/set/namespace分離/saveSettings呼び出し）、`src/lib/calendar/hub-storage-backend.test.ts`（`createHubStorageBackend` の load/save が正しい名前空間に作用すること）

- Rationale:
  - Dependencies 節の警告（本 issue 完了前に calendar/kanban の「設定で切り替え」系機能に着手しないこと）に従い、本 issue では器（保存/読込/配布の配線）と既知の項目（`defaultDurationMin`, calendar の永続化, kanban のレーン/グルーピング設定）のみを対象とし、新規の設定項目追加（月表示トグル等）は行っていない
  - `CalendarStorage` は `StorageBackend` を差し替え可能な設計であり `deepMerge` で自動マージされるため calendar 側（`svelte-calendar-lib`）の改修は不要、kanban も `KanbanBoardConfig` の props/`onConfigChange` 設計により `svelte-kanban-lib` 側の改修は不要という plan の前提を実装で確認した

- Verification:
  - `npx vitest run` → 24 test files / 482 tests すべて成功（新設6件含む）
  - `npx tsc --noEmit` → 変更ファイルに起因する型エラーなし
  - `node esbuild.config.mjs production` → ビルド成功
  - **未実施（要目視確認）**: 設定画面で `defaultDurationMin` を変えてガント外部ドロップの既定所要時間が変わること、カレンダー/かんばんの設定がビューを閉じて開き直しても保持されること（Acceptance criteria の3点）。Obsidian 実機での確認が必要なため、自動テストでは配線（`getExtraMountProps` の返り値・`StorageBackend`/`onUserConfigChange` の往復）のみを検証している

- Status: 自動化可能な範囲は実装完了。目視確認とユーザーの明示的な承認待ちのため Issue は Open のまま（WORKFLOW.md §6）。

# 強制リパースボタン設置 ＋ current-file スコープ時のファイル切り替えバグ修正

## 1. 課題と方針  — 人間が読む

### このissueで解決すること

**① 強制リパースボタン**
FilterBar を持つ全ビュー（Calendar・Gantt・Kanban・AST）の共通フィルタバーの**左**に、今開いているMDファイルを強制リパースする「⟳ リロード」ボタンを設置する。
手動で再パースを実行したいケース（外部ツールによる変更・デバッグ）に対応する。

**② current-file スコープ時のファイル切り替えバグ**
読み込み範囲が `current-file` のとき、アクティブなMDファイルを別ファイルに切り替えてもタスクがリパースされないバグがある。

**原因：** `AstIndex.setCurrentFilePath()` が `this.currentFilePath` を更新するだけで、新しいファイルのパース・購読者への通知（`notify()`）を行っていない。
- スコープが `current-file` のとき、パス変更後に `updateFile()` を呼んでインデックスを更新し `notify()` を呼ぶ必要がある。
- 新ファイルがインデックスに未登録でも正しく処理されること。

**③ 対応済み事項（再確認）**
スコープ変更時のリパースは `setScope()` が `initialScan()` を再実行するため対応済み。

### 方針
- `AstIndex.forceReparse()` を追加：現スコープの全ファイルを再読み込み・再パースする。
- `FileSync.forceReparse()` を追加：カレントファイルを強制再パースする（ASTビュー用）。
- `setCurrentFilePath()` のバグ修正：scope が `current-file` のとき、パス変更後に `updateFile()` → `notify()` を実行する。
- `FilterBar` に `onReload?: () => void` prop を追加し、リロードボタンを左端に配置。
- 各 ViewMount（Calendar・Gantt・Kanban・AST）へ `onReload` を prop 経由で伝搬し、`ShadowItemView` からコールバックを注入する。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- 着手時に**一度だけ** `project/governance/` を確認（`AI_RUNTIME_RULES.md` のロード順）。
- **テスト観点とテストコードは毎回すべて見直す**（`TESTING_STANDARD.md` 準拠）。

### 依存
- なし（既存 AstIndex・FileSync・FilterBar・ShadowItemView を修正する）

### 対象ファイル
- `src/sync/ast-index.ts` … `setCurrentFilePath()` バグ修正・`forceReparse()` 追加
- `src/sync/file-sync.ts` … `forceReparse()` 追加
- `src/lib/query/FilterBar.svelte` … `onReload` prop・リロードボタン追加
- `src/views/ShadowItemView.ts` … `ViewMountProps` に `onReload` 追加・コールバック注入
- `src/views/AstViewMount.svelte` … `onReload` prop・FilterBar へ伝搬
- `src/views/CalendarViewMount.svelte` … 同上
- `src/views/GanttViewMount.svelte` … 同上
- `src/views/KanbanViewMount.svelte` … 同上

### TODO
- [x] Issue 作成
- [x] `setCurrentFilePath()` バグ修正（`current-file` スコープ時にパス変更でリパース）
- [x] `AstIndex.forceReparse()` 追加
- [x] `FileSync.forceReparse()` 追加
- [x] `FilterBar` にリロードボタン・`onReload` prop 追加
- [x] `ShadowItemView` に `onReload` 伝搬を追加
- [x] 各 ViewMount に `onReload` prop 追加・FilterBar へ渡す
- [x] テスト（438 passed）

### 受け入れ基準（すべて満たすこと）
- `current-file` スコープ時、アクティブファイルを切り替えると各ビューが即座に更新される。
- FilterBar の左端にリロードボタンが表示され、クリックすると現スコープが強制再パースされビューが更新される。
- Agenda・Health・UnscheduledTray（FilterBar なし）は影響を受けない。
- 既存の `setScope()` によるリパース動作は変わらない。

### 履歴（追記のみ）

### 2026-06-30 (作業開始)

- User Instruction:
  - 共通フィルタ左に強制リパースボタン設置・current-file スコープ時ファイル切り替えバグ修正

- Change:
  - 新 Issue 起票

- Rationale:
  - `setCurrentFilePath()` が notify しないため current-file スコープで表示が更新されないバグを修正する

---

## 3. メタデータ
- id: issue-phase003-010__force-reparse-button-and-file-switch-bug
- status: open
- phase: 003
- related_specs: なし
- related_decisions: なし
- target_files: src/sync/ast-index.ts, src/sync/file-sync.ts, src/lib/query/FilterBar.svelte, src/views/ShadowItemView.ts, src/views/AstViewMount.svelte, src/views/CalendarViewMount.svelte, src/views/GanttViewMount.svelte, src/views/KanbanViewMount.svelte
- created: 2026-06-30
- updated: 2026-06-30

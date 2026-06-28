# 選択テキスト → ビューへ DnD でメタ付与（書いてから割り付ける）

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
Markdown は文字しか表現できず「いつ・どれだけ・どこ」という非テキストの次元が苦手。そのため「とりあえず md にバーっと書いて、後でスケジューリング」がスムーズにできない。

この issue では、エディタでタスク行（またはその一部）を選択し、そのまま**カレンダー／ガント／カンバンへドラッグ＆ドロップ**すると、**着地場所に応じたメタが対象タスクへ書き込まれる**ようにする。例：カレンダー 6/30 14:00 枠へドロップ → 子に `@schedule: 2026-06-30T14:00/...` を追記。Markdown 本文への書き戻しで完結し二重管理が起きない。

- カレンダー時間グリッド: 日時 → `@schedule`（開始＋既定所要で終了補完）／終日帯: 日付 → `@due`。
- ガント: 位置 → 開始日、幅 → 期間 → `@schedule`。
- カンバン: 列 → ステータス（or セクション/タグ）。

### 方針
- エディタ（CM6）を**ドラッグ源**にし、選択行から対象 `nodeId` を特定して `DataTransfer` に積む。
- 各 `*ViewMount.svelte` を**ドロップ先**にし、ドロップ位置から日時／列を算出して書き戻す。
- ドラッグ中は着地プレビュー（何がどこへ書かれるか）を表示。タスク行以外はドロップ不可。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- 作業着手の開始時に**一度だけ** `project/governance/` を確認し、本プロジェクトのルールを確認すること（`AI_RUNTIME_RULES.md` のロード順に従う）。
- **テスト観点とテストコードは、毎回すべてを見直すこと**（`TESTING_STANDARD.md` 準拠）。

### ⚠️ 着手前の必須スパイク（ここで止まる可能性あり）
既存のドラッグ書き戻し（`CalendarTab.handleItemMove`）は、**外部ライブラリが既存アイテムの `newStart/newEnd` を算出してコールバックに渡す**仕組みである。本 issue の「外部テキストのドロップ」では既存アイテムが無いため、その経路は**使えない**。

着手前に必ず確認すること:
- `svelte-calendar-lib` / `svelte-gantt-lib`（`../calendar-for-mywork` 等）に、**外部ドロップ受け口**または**画面座標→日時を返す API** があるか。
- 無い場合、Mount コンテナ上の HTML5 `drop` 座標から日時を**自力算出**できるか（ライブラリが日付/時刻セルを識別可能な DOM 属性で描画しているか）。
- どちらも不可なら、これはプラグイン側だけで完結しない（ライブラリ拡張が必要）。`AI_RUNTIME_RULES.md` §4 に従い**実装を止めてユーザーへ報告**し、ライブラリ拡張を別 issue として提案すること。

### 既存資産の再利用（必読・実装前に読む）
- `src/lib/calendar/markdown-patch.ts` … `findNodeById(doc, id)`、`patchScheduleForNode`（**既存 `@schedule` の置換専用**）、`patchNodeStatus`（`node.lineNumber` で状態置換）、`formatSchedule(start,end)`、`statusToMarker`。**重要: これらは「置換」しかできない。`@schedule`/`@due` が無いタスクへの新規挿入は未実装** → 本 issue で「挿入（upsert）」を新規実装する。
- `src/lib/parser/types.ts` の `Document.nodeLineMap`（`nodeId → 0-based 行`）… 選択行→ノードの逆引きに使う。
- `src/lib/calendar/CalendarTab.svelte` … 既存ドラッグ書き戻しの配線とコールバック形（参考）。
- `src/views/*ViewMount.svelte` … ドロップ先を足す対象（Calendar/Gantt/Kanban）。
- `src/settings.ts` … `defaultDurationMin`（既定 60）を追加。
- `src/editor/task-decoration.ts` … CM6 拡張の流儀（ドラッグ源も同様に editor extension として足す）。

### 仕様（確定事項：迷ったらこれに従う）
- DataTransfer: MIME `application/x-md-task`、値は `{ sourcePath, line, nodeId }` の JSON。
- 行→ノード解決: `nodeLineMap` の逆引きで選択開始行の `TaskNode` を求める。**タスク以外（メモ/見出し/メタ行/引用）が選択されたらドラッグ不可**。
- **メタ upsert（新規実装）のアルゴリズム（言葉で確定。コードは委譲）**:
  1. 対象タスク行を `node.lineNumber` で特定し、その行のインデント幅を得る。
  2. 子の領域 = 直後から「インデントが対象行**以下**の行が現れる直前」まで。
  3. その子領域に既存の同種メタ（`- @schedule:` / `- @due:`）があれば**その行を置換**。無ければ子領域の末尾に新規行を**挿入**。
  4. 挿入行のインデントは記法ガイドどおり「**対象タスク + 2 スペース**」。
- **複数 `@schedule` の扱い: 既存の最初の `@schedule` を上書き**。無ければ挿入（直近の割り付けを反映）。
- カレンダー終日帯 → `@due`（日付のみ）。時間グリッド → `@schedule`（終了 = 開始 + `defaultDurationMin`）。
- ガント: ドロップ x → 開始日、ドラッグ幅 → 終了日 → `@schedule`。
- カンバン: ドロップ列 → `groupByField` が `status` ならステータス（本文マーカーを `patchNodeStatus` で書換）、`section`/`tags` ならそれに応じた書き戻し。
- 座標→日時／列の算出は**純関数に切り出す**（Mount から分離してテスト可能に）。

### 実装の要点・つまずき
- upsert は既存 patch では足りない**新規ロジック**。インデント計算・子領域の終端判定・子なしケース（直後に挿入）を取りこぼさない。
- 既存のドラッグ移動（カレンダー/ガントの `@schedule` 置換）を壊さないこと。可能なら upsert 関数を共通化して既存も寄せる（任意・回帰テスト必須）。
- プレビュー（ゴースト）は「生成予定のメタ文字列」を表示するだけでよい。

### TODO
- [ ] 着手前スパイク（外部ドロップ／座標→日時 API の有無）を実施し、結果を履歴に記録。不可なら停止・報告。
- [ ] メタ upsert（挿入＋置換）関数を新規実装。
- [ ] CM6 ドラッグ源（選択→`nodeId` 逆引き→DataTransfer）。
- [ ] 3 Mount に dragover/drop ＋ 座標→日時/列の純関数 ＋ プレビュー。
- [ ] `settings.ts` に `defaultDurationMin`。
- [ ] テストを追加・全見直し（下記テスト観点）。

### 受け入れ基準（すべて満たすこと）
- タスク行を選択 → 時間枠ドロップ → 子に正しい `@schedule`（開始=枠日時・終了=開始+既定所要）が**新規挿入**される（既存があれば置換）。
- 終日帯ドロップ → `@due` が書かれる。
- ガントドロップ → 開始日＋幅の期間が `@schedule` に。
- カンバン列ドロップ → ステータス（or セクション/タグ）が本文に反映。
- 重複行ができない（冪等）。タスク行以外はドロップ不可。

### テスト観点
- `vitest` 単体: upsert（挿入/置換/インデント/子なし/複数 schedule）。
- 座標→日時・列の純関数（境界値）。
- DataTransfer ペイロードの生成／解釈（往復）。
- `nodeLineMap` 逆引き（タスク以外は不可）。
- 回帰: 既存のドラッグ移動が共通化後も従来どおり。

### 履歴（追記のみ）
- 2026-06-28 — 起票。ユーザー指定の MUST 機能。
- 2026-06-28 — Haiku 実装可能な水準へ加筆（着手前スパイクを明示、upsert アルゴリズムと複数 schedule の扱いを確定、既存 patch が置換専用である点を警告）。

---

## 3. メタデータ
- id: issue-phase002-004__selection-drag-to-view-meta
- status: open
- phase: 002
- related_specs: なし（仕様は本issueに内包）
- related_decisions:
- target_files: src/editor/task-drag-source.ts, src/lib/patch/upsert-meta.ts, src/views/(Calendar|Gantt|Kanban)ViewMount.svelte, src/settings.ts
- created: 2026-06-28
- updated: 2026-06-28

# 着地プレビュー（ゴースト）＋ビュー⇄エディタ双方向ハイライト

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
ダイレクト操作の中核（`issue-phase002-004`：選択テキスト→ビューへ DnD でメタ付与）は実装済みだが、ドロップ前に**「何がどこへ書かれるか」が見えず誤爆しやすい**。Markdown は文字でしか結果が見えないため、ドロップ前プレビューでこの弱点を補う必要がある（プラン §7.0④・§7.1）。

加えて、エディタでタスク行を選択するとそのカードが全ビューで光り、逆も同様という**双方向ハイライト**が無く、「この行はどこに割り付いているか」が掴みにくい（§7.1）。本 issue でこの2つを実装し、ドラッグの狙いを定めやすくする。

### 方針
- `dragover` で対象スロット（日時/列）を算出し、生成予定の meta 文字列をツールチップ/ゴーストで表示。
- `EditorEventBus` に hover/selection イベントを追加し、エディタ選択 ⇄ 各ビューのカードを相互強調。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- 着手時に**一度だけ** `project/governance/` を確認（`AI_RUNTIME_RULES.md` のロード順）。
- **テスト観点とテストコードは毎回すべて見直す**（`TESTING_STANDARD.md` 準拠）。

### 依存
- `issue-phase002-004__selection-drag-to-view-meta`（**前提・完了済み**）… drag 源・各ビュー drop・ペイロード（MIME `application/x-md-task`、`{sourcePath,line,nodeId}`）を共有。プレビューはこの drop 算出ロジックを**再利用**する。
- `issue-phase001-005__cross-file-identity-and-viewmodel`（globalKey）… ハイライト対象カードの同定。

### 既存資産の再利用（必読・実装前に読む）
- `src/editor/task-drag-source.ts` … `issue-phase002-004` の drag 源・ペイロード生成。プレビューも同じペイロードを参照する。
- 各 `src/views/*ViewMount.svelte` の `dragover`/`drop` … ドロップ位置→日時/列の算出。**プレビューはこの算出結果を `drop` 前に表示するだけ**（算出ロジックを二重化しない）。
- `src/lib/calendar/markdown-patch.ts` / `src/lib/patch/upsert-meta.ts` … 生成予定 meta 文字列のプレビュー文言は、実際の書き戻しと同じ生成関数から作る（プレビューと実結果を一致させる）。
- `src/sync/editor-event-bus.ts`（`EditorEventBus`）… hover/selection イベントの追加先。各ビューの強調購読もここ経由。
- `src/lib/viewmodel/global-key.ts` / `resolve.ts` … 行 ⇄ カードの対応付け。

### 仕様（確定事項：迷ったらこれに従う）
- 着地プレビュー: `dragover` 中、ドロップ先スロットに「`@schedule: 6/30 14:00` が書かれます」等の**生成予定 meta 文字列**をツールチップ/ゴーストで表示。対象がタスク行でない/ドロップ不可なら不可表示。
- プレビュー文言は**実際の書き戻し生成関数と同一**（プレビューと結果が食い違わないこと）。
- 双方向ハイライト: エディタでタスク行を選択/ホバー → 全ビューの該当カードを強調。逆にビューでカードをホバー → エディタ該当行を強調。対応付けは globalKey。
- イベントは `EditorEventBus` に集約（各ビューが個別に DOM 監視しない）。
- ハイライトは表示レイヤのみ。本文/AST に影響しない。

### 実装の要点・つまずき
- プレビューの算出を `drop` ロジックから関数として切り出し、`dragover`（プレビュー）と `drop`（実行）で**同じ関数**を呼ぶ。
- 高頻度の `dragover`/hover はスロットリングしてイベントバス購読側の再描画を抑制。
- クロスファイル: 選択行が別ファイル由来でも globalKey でカード同定できること。

### TODO
- [ ] drop 位置→日時/列＋生成予定 meta 文字列の算出を共有関数へ切り出し。
- [ ] `dragover` 中にプレビュー（ツールチップ/ゴースト・不可表示）。
- [ ] `EditorEventBus` に hover/selection イベント追加。
- [ ] 各ビューでエディタ選択に応じたカード強調／逆方向の行強調。
- [ ] テスト追加・全見直し。

### 受け入れ基準（すべて満たすこと）
- ドラッグ中、ドロップ先に生成予定の meta 文字列が表示され、実際の書き戻し結果と一致する。
- 非タスク/不可スロットでドロップ不可が表示される。
- エディタのタスク行選択で全ビューの該当カードが強調され、逆方向も動作する。
- ハイライト/プレビューは本文・AST を変更しない。

### テスト観点
- `vitest` 単体: drop 位置 → 生成予定 meta 文字列が、実書き戻し生成と同一であること（カレンダー時間/終日・ガント・カンバン）。
- globalKey による 行 ⇄ カード対応付けが正しいこと（クロスファイル含む）。

### 履歴（追記のみ）
- 2026-06-30 — 起票（プラン §7.0/§7.1・付録 Issue 候補 Y、Phase3 SHOULD）。

---

## 3. メタデータ
- id: issue-phase003-009__drop-preview-and-bidirectional-highlight
- status: open
- phase: 003
- related_specs: なし（仕様は本issueに内包）
- related_decisions:
- target_files: src/editor/task-drag-source.ts, src/sync/editor-event-bus.ts, src/views/CalendarViewMount.svelte, src/views/GanttViewMount.svelte, src/views/KanbanViewMount.svelte
- created: 2026-06-30
- updated: 2026-06-30

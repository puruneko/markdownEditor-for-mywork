# Kanban サブカードグループ DnD のドロップ表示位置が更新されない

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
Kanban ビューでサブカードグループ（カードグループ配下のカード）を DnD したとき、**ステータスは正しく Markdown へ書き戻されるが、カードの表示位置が移動先に更新されず元の位置に残る**。ユーザー実機確認（2026-07-03）で発見。座標計算（ドロップ先の判定・挿入インデックス算出）の不具合が疑われる。

issue-phase003-012（タスクグループ→カードグループ、status: implemented・ユーザー動作確認待ち）の確認過程で検出された退行／残バグであり、カードグループ機能の完成条件に含めて扱う。

### 方針
- 疑い所在：`../kanban-for-mywork/src/lib/utils/dnd.ts` の `findTargetLane`／挿入インデックス計算（ネストしたカードグループでフラットな座標系を前提にしている可能性）、または `KanbanLane.svelte` 側の並び再計算。
- 修正は kanban-lib リポジトリ側で実施（ライブラリ Issue 管理は独立、本リポジトリで要件をとりまとめる方針＝2026-07-03 決定）。
- **検知用の E2E テストを先に用意する**：issue-phase000-002 で追加する `tests/obs-e2e/kanban-view.e2e.ts` に、サブカード DnD 後の「Markdown 書き戻し」と「DOM 上の表示位置・順序」の両方をアサートするテストを `it.skip` で置く。修正時に skip を外してテスト駆動で直す。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- 作業着手時に一度だけ `project/governance/` を確認すること。
- 修正は kanban-lib 側だが、検証（E2E）は本リポジトリの `npm run test:obs:e2e` で行う。

### 再現手順
1. カードグループを含む Markdown（親タスク＋サブタスク 3 件以上）を開き、Kanban ビューを表示（カードグループ表示 ON）。
2. カードグループ内のサブカードを別レーン（または同グループ内の別位置）へ DnD。
3. 期待：Markdown のステータスが変わり、カードが移動先に表示される。
4. 実際：Markdown のステータスは変わるが、カードの表示位置が元のまま。

### 修正時の確認事項
- `tests/obs-e2e/kanban-view.e2e.ts` の該当テスト（`TODO(issue-phase000-003)` コメント付き `it.skip`）の skip を外し、グリーンになることを確認する。
- 通常カード（グループ外）の DnD が退行していないこと（同スペックの他テストで担保）。

### TODO
- [ ] kanban-lib 側で座標計算／並び再計算の原因特定
- [ ] kanban-lib 側で修正・ライブラリ側テスト追加
- [ ] 本リポジトリで skip 解除 → E2E グリーン確認

### 受け入れ基準
- サブカード DnD 後、Markdown 書き戻しと表示位置の両方が正しい。
- skip を外した E2E テストがグリーン。
- 既存 Kanban E2E テストに退行なし。

### 調査結果（2026-07-03 E2E 再現時の知見）
- **グループ内のコンパクトカード（`kanban-card--compact`）は `onpointerdown` ハンドラを持たない**（KanbanCard.svelte のコンパクト分岐）。掴むとイベントが親グループへバブルし、**親グループごとドラッグされる**。個別サブカードの DnD は現状のライブラリ仕様では存在しない。
- 再現条件は**ネストしたカードグループ（サブカードグループ）のドラッグ**：カードグループ表示 ON → 全展開 → ネストグループ（`data-card-group-id`、KanbanCardGroup.svelte の `handlePointerDown` → `dnd.startDrag(parentCard, ...)`）を別レーンへドラッグ。
- E2E で再現確認済み：markdown への書き戻し（`- [x] サブb`）は成功するが、**DOM 上の表示位置（done レーンへの移動）が 10 秒待っても反映されない**。`tests/obs-e2e/kanban-view.e2e.ts` の skip テストがこの手順を自動化している。
- 副次観察：バグ発生後、同ボードの再描画が不安定になる（後続テストの beforeEach でカード描画がタイムアウト）。ドラッグ失敗状態（ghost／dnd phase）が残留している可能性。修正時に確認のこと。

### 履歴（追記のみ）
- 2026-07-03 — 起票。ユーザー実機確認で発見。検知用 E2E は issue-phase000-002 で先行整備。
- 2026-07-03 — E2E での機械的再現に成功（上記調査結果）。skip テスト＝再現手順として整備完了。

---

## 3. メタデータ
- id: issue-phase000-003__kanban-subcard-drop-position
- status: open
- phase: 000
- related_specs:
- related_decisions:
- related_issues: issue-phase003-012__task-group-to-card-group, issue-phase000-002__obs-e2e-hardening-and-coverage
- target_files: ../kanban-for-mywork/src/lib/utils/dnd.ts（疑い）, tests/obs-e2e/kanban-view.e2e.ts（検知テスト）
- created: 2026-07-03
- updated: 2026-07-03

# [kanban] サブカードグループ DnD の表示位置バグ修正（issue-phase000-003 の lib 側実装）

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
ユーザー実機確認で発見されたバグ（本体側 Issue: `issue-phase000-003__kanban-subcard-drop-position.md` — **必読**。E2E での再現手順と調査結果が記録済み）:

**ネストしたカードグループ（サブカードグループ）を別レーンへドラッグすると、ステータスの Markdown 書き戻しは成功するのに、カードの表示位置が元のまま更新されない。**

E2E で機械的に再現済み（本体 `tests/obs-e2e/kanban-view.e2e.ts` の skip テスト。カードグループ表示 ON → 全展開 → ネストグループを done レーンへドラッグ → Markdown は `- [x] サブb` になるが DOM 位置が 10 秒待っても変わらない）。

### なぜ最優先か
issue-phase003-012（カードグループ）の完成条件であり、オーナーが実運用で毎回踏む操作。Phase 004 の全 Issue の中で唯一の「既知の壊れている挙動」（phase004-000 Step 0）。

### 方針
原因を特定してから直す。修正後、本体の skip テストを外してグリーンにする（テスト駆動）。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- **実装前に本体リポジトリの `project/governance/`・`issue-phase004-000__phase-overview.md`・`issue-kanban-phase004-000__kanban-overview.md`・`issue-phase000-003__kanban-subcard-drop-position.md` を必ず読むこと。**
- **既存テストの見直しは機能実装と同等に重要。** 修正は配置計算の中核に触るため、通常カード DnD・カードグループ DnD・グループ間移動の既存テストを全部読み、回帰を確認すること。

### 対象・調査の起点（既知の事実）
- `../kanban-for-mywork/src/lib/context/dndContext.svelte.ts` … `commitDrop` は `lastDrop = { cardId, targetLaneId, targetGroupId, insertIndex... }` を記録し、コールバック（onCardMove）が発火する。**書き戻しは成功している**＝ここまでは動いている。
- `src/lib/utils/dnd.ts` の `findTargetLane` … `if (!allowCrossGroupMove && groupId !== sourceGroupId) continue;` — **ネストグループをドラッグするとき sourceGroupId は「親グループの id」**。ターゲットがトップレベルのレーン（groupId undefined）だと、allowCrossGroupMove=false ではヒットしないはず — それでもステータスが書き戻された事実と矛盾しないか、イベントの実経路を確認すること（本体 KanbanTab は `allowCrossGroupMove` 既定 false）。
- `src/lib/utils/cardDistribution.ts` … 再描画時にカード/グループをレーンへ配分するロジック。**疑いの本丸**: 書き戻し→再パース→新しい cards が来た後、**カードグループ（親カード）の配置先レーンをどう決めているか**。子を持つ親カードのステータスが変わっても、グループの配置が「別の規則」（例: 子の状態や元の位置）で決まっていれば、表示が動かない症状と一致する。
- 本体側の見え方: `KanbanTab.svelte` の `handleCardMove` は status を patch するだけ。**位置は「再パース後の配分結果」でしか変わらない**設計（ライブラリ内での楽観的移動はしない）。つまり「ドロップ直後の見た目」ではなく「配分ロジックが新 status を反映するか」が問題。

### 修正要件
1. 原因を特定し、**本 Issue の履歴に因果関係を明記**してから修正する（推測修正の禁止）。
2. カードグループ（ネスト含む）を status レーン間でドラッグしたとき、書き戻し後の再配分でグループが**新 status のレーンに表示される**こと。
3. 副次症状（issue-phase000-003 の調査結果に記載: バグ発生後にボード再描画が不安定になる＝ドラッグ状態の残留疑い）も確認し、`cancelDrag` / `_cleanup` の漏れがあれば直す。
4. 挙動仕様で迷ったら: 「カードグループは通常カードと同じく、自身のステータスのレーンに表示される」を正とする（オーナーの kaisou 構想メモ: カードグループも自身がカードでありステータス概念を持つ）。

### 検証（テスト駆動）
- lib 側: 配分ロジックの unit テスト（親カード status 変更後の配置先）を追加。
- 本体側: `tests/obs-e2e/kanban-view.e2e.ts` の `it.skip('サブカードグループのDnDで表示位置が更新される')` の **skip を外してグリーン**にする。E2E の実行方法・shadow DOM の注意は `project/knowledge/obsidian-plugin-testing.md` 必読。
- 回帰: 通常カード DnD テスト（同スペック内）・kanban スペック全体・全 E2E。

### TODO
- [ ] 原因特定（findTargetLane のグループ判定 or cardDistribution の配分規則 or 残留状態）→ 履歴に記録
- [ ] 修正＋lib unit テスト
- [ ] ドラッグ状態残留の確認・修正
- [ ] 本体 skip テスト解除 → グリーン確認
- [ ] 回帰: lib 全テスト＋本体 `npm run test:obs:e2e` 全通過

### 受け入れ基準
- 本体 E2E の当該テストが skip なしでグリーン。
- 通常カード DnD・カードグループ表示 OFF の挙動に回帰なし。
- issue-phase000-003 の受け入れ基準をすべて満たす。

### 履歴（追記のみ）
- 2026-07-04 — 起票（issue-phase000-003 の lib 側実装 Issue として）。

---

## 3. メタデータ
- id: issue-kanban-phase004-001__subgroup-drop-position-fix
- status: open
- phase: 004
- target_repo: ../kanban-for-mywork（＋本体 tests/obs-e2e/kanban-view.e2e.ts の skip 解除）
- related_issues: issue-phase000-003（本体側・必読）, issue-phase003-012, issue-phase004-000
- created: 2026-07-04
- updated: 2026-07-04

# [kanban] Phase 004 憲章 — カンバンライブラリの目的・実行順・実装規約

> **これは実装 Issue ではない。** `issue-kanban-phase004-*` に着手する前に、**必ず ①本体リポジトリの `project/governance/`、②共通憲章 `issue-phase004-000__phase-overview.md`、③本ファイル** の順に読むこと。フェーズ共通の事項は**共通憲章が正**であり、本ファイルには複製しない。

## 1. このフェーズでの kanban のゴール

kanban のフェーズ 004 は他ライブラリと性格が違い、**「信頼回復」が主目的**:

1. **既知バグの根治（最優先）**: サブカードグループの DnD で「ステータスは書き戻るが表示位置が動かない」バグ（issue-phase000-003）。オーナーが実運用で毎回踏んでおり、カードグループ機能（issue-phase003-012）の完成条件。**本体の E2E に再現テスト（skip 中）が既にあり、skip を外してグリーンにすることが完了の定義。**
2. **コンテキスト保持**: グルーピングを解除しても所属（セクション › 親カード › ユニット）が分かる breadcrumb 表示。

## 2. Issue 実行順（直列必須）

```
001 サブカードグループ DnD 表示位置バグ修正   ← 最優先・フェーズ全体でも Step 0
002 breadcrumb 表示                        ← 001 の後（配分・描画の中核に 001 が触るため）
```

## 3. kanban 固有の実装規約（全 Issue 共通）

1. **DnD は PointerEvent 契約**: `dndContext.svelte.ts` が中核（pointerdown → 6px しきい値 → pointermove hit-test → commitDrop）。コンパクトカード（グループ内子カード）は**自前の pointerdown を持たず親グループへバブルする**のが現仕様。この契約を变えるときは本体 E2E のドラッグヘルパ（`tests/obs-e2e/helpers/drag.ts` — この契約前提で実イベントを合成している）への影響を必ず確認すること。
2. **セレクタ属性の使い分け**（`utils/dnd.ts` のコメントが正）: 挿入位置計算は `data-lane-item`（レーン直下のアイテムラッパー）を使う。`data-card-id` は**カードグループ内のコンパクトカードにも付くため位置計算に使用不可**。カードグループ要素は `data-card-group-id`（`data-card-id` ではない）。
3. **表示位置の正は配分ロジック**: ライブラリはドロップ時に楽観的にカードを動かさない。位置は「ホストが書き戻し→再パース→新しい cards が来る→`cardDistribution` が再配分」で決まる設計。**表示位置の不具合はまず配分ロジック（`utils/cardDistribution.ts`）を疑う**（001 の調査起点に詳細）。
4. **迷ったときの挙動仕様**: 「カードグループも自身がカードであり、ステータス概念を持ち、自身のステータスのレーンに表示される」（オーナーの階層構想メモ `project/plan/kaisou_my_idea(from_kanban_library).md` が原典）。
5. **色・装飾は CSS 変数**（`--kanban-*` 系。本体 KanbanTab.svelte が Obsidian テーマ変数へマップしている一覧が参考になる）。
6. **検証は二段**: lib 内テスト＋本体 `npm run test:obs:e2e`（kanban スペックは DnD の「書き戻し＋DOM 位置」両面アサートの手本。`project/knowledge/obsidian-plugin-testing.md` 必読）。

## 4. メタデータ
- id: issue-kanban-phase004-000__kanban-overview
- status: active（フェーズ期間中は常時参照）
- phase: 004
- target_repo: ../kanban-for-mywork
- related_issues: issue-phase004-000（共通憲章・正）, issue-phase000-003, issue-kanban-phase004-001〜002
- created: 2026-07-04
- updated: 2026-07-04

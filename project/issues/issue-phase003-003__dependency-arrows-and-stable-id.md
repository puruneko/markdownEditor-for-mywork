# `@dependsOn` の依存矢印（ガント）＋安定ID

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
`dependsOn` は `Meta` 型に存在するが、**ガントで可視化されていない**。タスク間の前後関係が図示されないため、クリティカルパスや「着手可能になったタスク」が見えない（プラン §4.4 SHOULD）。さらに依存の参照に使える**安定したタスク ID が未確立**で、行が動くと参照が壊れる懸念がある。

本 issue では、まず参照に耐える安定 ID を確立し、その上でガントへ依存リンクを渡して矢印を描画。循環検出と未解決 ID の警告も行う。

### 方針
- 安定参照 ID を `@id` メタ（明示）＋行ベース slug（暗黙フォールバック）で確立。
- `ast-to-gantt.ts` で `@dependsOn` を依存リンク（dependency）として出力し矢印描画。
- 循環・未解決参照を検出して警告表示。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- 着手時に**一度だけ** `project/governance/` を確認（`AI_RUNTIME_RULES.md` のロード順）。
- **テスト観点とテストコードは毎回すべて見直す**（`TESTING_STANDARD.md` 準拠）。

### 依存
- `issue-phase001-005__cross-file-identity-and-viewmodel`（globalKey / 安定識別）… ID 戦略はここと整合させる（クロスファイル参照の可能性も考慮）。

### 既存資産の再利用（必読・実装前に読む）
- `src/lib/parser/types.ts` … `Meta.dependsOn: string[]`。参照解決の出発点。
- `src/lib/parser/meta-keys.ts` ＋ `src/lib/parser/plugins/remark-meta-fields.ts` … `@id` メタを追加するならここを拡張。
- `src/lib/viewmodel/global-key.ts` / `resolve.ts` … 安定識別子の既存方式。`@id` 不在時のフォールバック slug はここと矛盾させない。
- `src/lib/gantt/ast-to-gantt.ts` / `.test.ts` … 依存リンク出力の追加先。ガントライブラリ（`file:` 参照の自作）が dependency プロップを受けられるか要確認。

### 仕様（確定事項：迷ったらこれに従う）
- 参照 ID の優先順位: **明示 `@id` > 安定 slug（行ベース等）**。`@id` は人間可読な短い文字列。
- `@dependsOn` の各値は ID 参照。解決できない参照は**未解決として警告**（描画は欠落させずに警告表示）。
- 依存グラフに**循環があれば検出して警告**（矢印は描くが循環を明示）。
- ガント矢印は「依存先（先行タスク）→ 依存元（後続タスク）」の向き。
- まずはガント内の可視化に限定。「着手可能になった」ハイライトは `issue-phase002-003`（HealthView）側のルールと連携可（本 issue では矢印＋警告まで）。
- `@id` を導入する場合 `Meta.id`? と `META_KEYS` を拡張（`TaskNode.id` 内部 ID とは別概念なので命名衝突に注意。メタ側は別名を検討）。

### 実装の要点・つまずき
- **ID 戦略の決定が本 issue の肝**。`TaskNode.id`（内部生成 ID）は安定性が保証されないため、参照には使わない。`@id` か行非依存の slug を別途確立する。
- 依存解決・循環検出は**純関数**（タスク集合 → リンク列＋警告列）に寄せ、ガント描画と分離してテストする。
- ガントライブラリが dependency 描画に未対応なら、最小の追従改修またはオーバーレイ描画を検討。

### TODO
- [ ] 参照 ID 戦略を確定（`@id` メタ＋フォールバック slug）。必要なら `Meta`/`META_KEYS`/`remark-meta-fields` 拡張。
- [ ] 「タスク集合 → 依存リンク列＋警告（未解決/循環）」純関数を新設。
- [ ] `ast-to-gantt.ts` で依存リンクを出力し矢印描画。
- [ ] 未解決 ID・循環の警告 UI。
- [ ] テスト追加・全見直し。

### 受け入れ基準（すべて満たすこと）
- `@dependsOn` を持つタスク間にガントで依存矢印が描かれる。
- 行を移動しても `@id`/安定 slug による参照が壊れない。
- 未解決 ID と循環依存が警告される。

### テスト観点
- `vitest` 単体: タスク集合から依存リンク列が正しい（`@id` 優先・slug フォールバック）。
- 未解決参照・循環が警告として検出される。
- 行移動後も参照解決が安定すること。

### 履歴（追記のみ）
- 2026-06-30 — 起票（プラン §4.4・付録 Issue 候補 H、Phase3 SHOULD）。

---

## 3. メタデータ
- id: issue-phase003-003__dependency-arrows-and-stable-id
- status: open
- phase: 003
- related_specs: なし（仕様は本issueに内包）
- related_decisions:
- target_files: src/lib/gantt/ast-to-gantt.ts, src/lib/parser/meta-keys.ts, src/lib/parser/plugins/remark-meta-fields.ts, src/lib/viewmodel/global-key.ts
- created: 2026-06-30
- updated: 2026-06-30

# plan の継承解決と Health バリデーション（V-1〜V-3・tentative-near）

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
3 層モデルの**意味論**を実装する。パーサー（issue-phase004-002）が構造を作った後、次の 2 つが無いとモデルは「飾り」になる:

1. **plan の継承**: 実運用では親タスク（案件）に `@plan` を書き、子タスクには書かない。子のバリデーションに親の枠を使えないと、「案件の期間からはみ出た子スケジュール」を検知できない。オーナー決定: 自身に @plan が無ければ最も近い祖先の @plan を**内部値**として引き継ぐ。**Markdown へは書かない**（自動追記はユーザーの文書を汚すため禁止）。
2. **バリデーション**: `plan.start ≤ schedule ≤ plan.end ≤ due(end)` 違反の検知。オーナー決定: **入力は禁止せずエラーとして提示**（Excel と違い自由に書けることが本アプリの価値。ただし矛盾は見えるようにする）。加えて「仮置き `?` のまま開始が迫っている」検知（tentative-near）— 仮置きの放置は「いつやるか未確定」問題の再発なので、検知までがワンセット。

### 方針
既存の Health パネル基盤（`src/lib/health/rules.ts` — undated/overdue/stale/unresolved-deps/ready/malformed の 6 ルール）に**新ルールとして追加**する。新しい表示パネルは作らない。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- **実装前に `project/governance/` と `issue-phase004-000__phase-overview.md` を必ず読むこと。**
- **既存テストの見直しは機能実装と同等に重要。** `src/lib/health/rules.test.ts` は既存 6 ルールの前提（Meta に plan が無い世界）で書かれている。新ルール追加で `DEFAULT_HEALTH_CONFIG` の形が変わるため、既存テストのフィクスチャ・期待値を新仕様で見直すこと。undated ルールの定義も変わる（下記仕様 4）ので**既存の undated テストは必ず書き換えが必要**。

### 既存資産（必読・実装前に読む）
- `src/lib/health/rules.ts` … ルール実装の型（`RuleId` / `HealthFinding` / `HealthRuleConfig`）と走査パターン。新ルールはこの形式に従う。
- `src/views/HealthViewMount.svelte` … ルールごとの表示（`.rule-group`）。RuleId を足せば表示されるはずだが、ラベル定義の追加箇所を確認。
- `src/lib/viewmodel/` … ファイル横断の SourceEntry / globalKey。継承解決はここか parser 派生層に置く（下記）。
- `src/settings.ts` … `healthRules` 設定。新ルールの ON/OFF を追加。
- Spec: `project/specs/time-meta-model.spec.md` の V-1〜V-3 定義。

### 仕様（確定事項）
1. **継承解決の置き場所**: `src/lib/viewmodel/` に純関数 `resolveEffectivePlan(node, ancestors): string | null` を新設し、「自身の meta.plan → 無ければ祖先を近い順に探索」を返す。**AST 自体（Meta）には書き込まない**。理由: Meta はパース結果＝Markdown の忠実な写像であり、派生値を混ぜるとラウンドトリップ（ast-to-md）が汚染される。派生値は viewmodel 層の責務。
2. **新 RuleId**（`rules.ts` に追加）:
   - `plan-overflow`（V-1）: 未完タスクで schedule が有効 plan（継承込み）の枠外。メッセージ例: `「〜」の @schedule が @plan の期間外です（plan: A〜B / schedule: C〜D）`。
   - `deadline-overflow`（V-2＋V-3 を 1 ルールに統合）: 有効 plan の end または schedule の end が due(end) を超える。V-2/V-3 を分けない理由: ユーザーにとってどちらも「期限に間に合わない設定」であり、2 行に分かれると同じタスクが二重に列挙されてノイズになる。finding メッセージ内でどちらの違反かは明記する。
   - `tentative-near`: `tentative` が付いたメタ（plan/schedule/due いずれか）の開始（または due 日）が今日から N 日以内。N は設定 `tentativeNearDays`（デフォルト 3）。
3. **エラーと警告の区別**: `HealthFinding` に `severity: 'error' | 'warn'` を追加する。plan-overflow / deadline-overflow は `error`、tentative-near と既存ルールは `warn`。HealthViewMount で error を先頭グループ・赤系で表示。既存 finding 生成箇所全部に severity を明示追加すること（暗黙デフォルトで濁さない）。
4. **undated の再定義**: 「3 メタ（plan/schedule/due）のどれも無い未完タスク」に変更する（従来は schedule/due のみ判定していたはず — 現実装を確認し、plan だけ持つタスクが undated 扱いされないようにする）。
5. **`?` 付きメタのバリデーション扱い**: 仮置きでも V-1〜V-3 の判定対象に**含める**（仮でも矛盾は矛盾）。Spec の EDGE CONDITIONS に従う。
6. 完了タスク（done）は全新ルールの対象外（既存ルールの慣例に合わせる）。

### 実装の要点・つまずき
- 祖先探索は TaskNode の親子（children を持つのは親）構造上、**親→子の下降時に有効 plan を引き回す**実装が自然（AST には parent ポインタが無い）。既存 rules.ts の走査（visit パターン）を確認し、走査引数に `inheritedPlan` を足す形にする。
- plan の「日付のみ＝終日」解釈はここで効く: `2026-07-07/07-11` の end は **07-11 の 23:59**（= 排他でなく包含）。luxon で `endOf('day')` を使う。schedule 側の日付のみ表記の既存解釈（ast-to-calendar の dateRange は endExclusive）と混同しないこと — **比較はすべて DateTime に正規化してから**行い、文字列比較をしない。
- Agenda（`src/lib/agenda/ast-to-agenda.ts`）の undated バケットも仕様 4 と同じ定義に揃えること（plan のみのタスクは undated に入れない）。Agenda のテストも更新対象。

### TODO
- [ ] resolveEffectivePlan 純関数＋テスト
- [ ] severity フィールド追加と既存 finding への明示付与
- [ ] plan-overflow / deadline-overflow / tentative-near ルール実装
- [ ] undated 再定義（health と agenda の両方）
- [ ] settings: 新ルール ON/OFF・tentativeNearDays
- [ ] HealthViewMount: severity 表示・新ルールラベル
- [ ] 既存テスト全見直し＋新テスト
- [ ] E2E: health-view.e2e.ts に「plan 枠外 schedule がエラー表示される」1 件追加（実行時生成ファイル使用。`project/knowledge/obsidian-plugin-testing.md` §4.4 必読）

### 受け入れ基準
- 親に `@plan: 2026-07-07/07-11`、子に `@schedule: 2026-07-12T10:00/11:00` を書くと plan-overflow（error）が検知される（継承の証明）。
- `@schedule: ...` の end が `@due` を超えると deadline-overflow（error）。
- `@schedule?:` の開始が 3 日以内だと tentative-near（warn）。
- plan のみのタスクが undated に**出ない**（health・agenda 両方）。
- `npm run test:unit` と `npm run test:obs:e2e` 全通過。

### テスト観点
- 継承: 直親・祖父・自身優先・祖先に plan 無しの 4 系。
- 終日解釈の境界: plan end 当日 23:59 の schedule は合格、翌日 00:00 は違反。
- done タスク除外・`?` 付き含む判定。
- 既存 6 ルールの回帰（severity 追加後）。

### 履歴（追記のみ）
- 2026-07-04 — 起票。

---

## 3. メタデータ
- id: issue-phase004-003__plan-inheritance-and-health-validation
- status: open
- phase: 004
- related_specs: time-meta-model.spec.md
- related_issues: issue-phase004-000, issue-phase004-002（先行必須）, issue-phase004-004
- target_files: src/lib/viewmodel/（resolveEffectivePlan 新規）, src/lib/health/rules.ts, src/lib/agenda/ast-to-agenda.ts, src/views/HealthViewMount.svelte, src/settings.ts, 各 *.test.ts, tests/obs-e2e/health-view.e2e.ts
- created: 2026-07-04
- updated: 2026-07-04

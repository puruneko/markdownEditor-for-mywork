# 常設スマートリスト＋件数バッジ（サイドバー）

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
「今日 / 期限切れ / 今週 / 未スケジュール / `#タグ`別」を**どのノートを開いていても常に左サイドで見られる**状態が無い。そのため「あの管理簿を見に行く」動作が残り、全体像の把握が単発のビューを開く操作に依存している（プラン §6 B-1・§5.3 #7）。

さらに、開かずとも気づけるよう **リボン/ステータスバーに「超過 N 件・今日 M 件」のバッジ**を常時出す（§6 C-3）。これにより受動的に抜け漏れへ気づける。

### 方針
- 集約インデックス（`issue-phase001-001`）＋保存フィルタ（`issue-phase001-002`）を使い、サイドバー View に**常設スマートリスト**を描画。
- 各行クリックで既存のカーソルジャンプを再利用。
- 同じ集計結果を件数バッジとしてリボン/ステータスバーに反映。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- 着手時に**一度だけ** `project/governance/` を確認（`AI_RUNTIME_RULES.md` のロード順）。
- **テスト観点とテストコードは毎回すべて見直す**（`TESTING_STANDARD.md` 準拠）。

### 依存
- `issue-phase001-001__multi-source-ast-index`（`getAllTaskNodes` / `onChange` / `resolveLine`）。
- `issue-phase001-002__filter-nodes-core`（スマートリスト各区分の抽出条件）。
- `issue-phase001-005__cross-file-identity-and-viewmodel`（globalKey・クリックジャンプ）。

### 既存資産の再利用（必読・実装前に読む）
- `src/views/ShadowItemView.ts` ＋ `src/views/AgendaViewMount.svelte` … `ItemView`＋Svelte マウント／`onChange` 購読再描画のひな形。スマートリストも同じ機構で実装。
- `src/lib/query/filter.ts` … 各区分（今日/超過/今週/未スケジュール/タグ別）の抽出は `filterNodes` の条件で表現（独自集計を書かない）。
- `src/lib/agenda/ast-to-agenda.ts` … 「超過/今日/今週/予定なし」への束ね分け（`issue-phase002-002` 実装）を**再利用**。区分ロジックを二重実装しない。
- `src/plugin.ts` … View 登録・リボン・ステータスバー（`addStatusBarItem`）の追加先。
- `src/settings.ts` … 保存フィルタ（スマートリスト定義）の永続化先。

### 仕様（確定事項：迷ったらこれに従う）
- 既定区分: **超過 / 今日 / 今週 / 未スケジュール**。加えてユーザー定義の保存フィルタ（クエリ文字列）を任意個。
- 「今日/今週」の境界・「超過」の判定は `ast-to-agenda` の既存定義に**完全準拠**（同じ基準を使う）。
- 各行はタスク文＋出典ファイル名。クリックで `resolveLine` → カーソルジャンプ。
- バッジは「超過 N・今日 M」をステータスバーへ常時表示。リボンアイコンにも件数を反映可能なら反映。
- `onChange` 購読で再描画・再集計。購読は破棄時に解除。
- スコープは `AstIndex` の現行スコープ設定に従う（独自スコープを持たない）。

### 実装の要点・つまずき
- 区分集計は**純関数**（タスク集合＋基準日 → 区分別カウント/リスト）に寄せ、View と バッジで共有する。
- ステータスバー更新は `onChange` で再計算するが高頻度更新を避けるため軽量に保つ。
- 保存フィルタの文字列は `issue-phase001-002` のクエリ DSL をそのまま使う（新記法を作らない）。

### TODO
- [ ] 「タスク集合＋基準日 → スマートリスト区分（リスト＋件数）」純関数を新設（`ast-to-agenda` の区分を再利用）。
- [ ] サイドバー View（`SmartListView` ＋ Mount）を追加。`onChange` 購読・行クリックジャンプ。
- [ ] 保存フィルタ（ユーザー定義クエリ）の追加/削除と永続化。
- [ ] リボン/ステータスバーの件数バッジ。
- [ ] `plugin.ts` 登録。テスト追加・全見直し。

### 受け入れ基準（すべて満たすこと）
- どのノートを開いていてもサイドバーに超過/今日/今週/未スケジュールが並ぶ。
- 行クリックで該当タスク行へジャンプする。
- ステータスバーに「超過 N・今日 M」が常時表示され、索引更新で更新される。
- ユーザー定義の保存フィルタを追加でき、再起動後も保持される。

### テスト観点
- `vitest` 単体: タスク集合＋基準日から区分別カウント/リストが正しい（境界は `ast-to-agenda` と一致）。
- 未スケジュール区分が「未完・日付なし」を拾う（`issue-phase003-001` の抽出と整合）。
- 索引更新後に区分・件数が再計算されること。

### 履歴（追記のみ）
- 2026-06-30 — 起票（プラン §6 B-1/C-3・付録 Issue 候補 S、Phase2 SHOULD）。

---

## 3. メタデータ
- id: issue-phase002-007__persistent-smart-list-and-badge
- status: open
- phase: 002
- related_specs: なし（仕様は本issueに内包）
- related_decisions:
- target_files: src/views/SmartListView.ts, src/views/SmartListViewMount.svelte, src/lib/agenda/ast-to-agenda.ts, src/plugin.ts, src/settings.ts
- created: 2026-06-30
- updated: 2026-06-30

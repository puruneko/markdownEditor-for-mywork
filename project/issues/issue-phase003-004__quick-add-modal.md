# クイック追加モーダル＋日付ピッカー

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
タスク追加・日付入力が**手打ち**で、`@schedule`/`@due` の形式ミスが起きやすい（記法ガイドの「よくあるミス」表が示す通り）。形式不正のメタは静かに集計から漏れ、最も危険な抜け漏れになる（プラン §4.5 SHOULD・§5.3 #3・Quick Win 候補）。

本 issue では、コマンド＋モーダルで「タスク文＋日付＋ステータス＋優先度」を GUI 入力し、**正規形を自動生成して挿入**する。手で `@schedule` 形式を打たせないことで記法ミスを構造的に撲滅する。

### 方針
- コマンド起動のモーダルで、タスク文・ステータス・日付（ピッカー）・優先度・タグを入力。
- 入力値を既存シリアライザで正規形（本記法）へ組み立て、カーソル位置 or 既定 inbox へ挿入。
- 自然言語日付（「明日10時」）は `chrono-node` で補助。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- 着手時に**一度だけ** `project/governance/` を確認（`AI_RUNTIME_RULES.md` のロード順）。
- **テスト観点とテストコードは毎回すべて見直す**（`TESTING_STANDARD.md` 準拠）。

### 依存
- なし（集約基盤に依存せず単体で価値）。先行着手可（プラン Quick Win）。
- `issue-phase003-006__quick-capture-inbox-refile` と inbox 挿入先設定を共有しうる（重複させない）。

### 既存資産の再利用（必読・実装前に読む）
- `src/lib/parser/ast-to-md.ts` … タスク行＋子メタの**正規形シリアライズ**。モーダルの出力はここを通し、独自の文字列組み立てをしない。
- `src/lib/parser/schedule-normalize.ts` … 日付/自然言語 → 正規形。`chrono-node` 連携もここに集約。
- `src/lib/parser/meta-keys.ts` … 出力するメタキー（schedule/due/priority/tags）。
- `src/plugin.ts` … コマンド登録（`addCommand`）。Obsidian `Modal`/`SuggestModal` の実装先。
- `src/settings.ts` … 既定挿入先（カーソル位置 / inbox ファイル）の設定。

### 仕様（確定事項：迷ったらこれに従う）
- 入力項目: タスク文（必須）・ステータス（既定 todo）・`@schedule` または `@due`・`@priority`・`@tags`。
- **出力は必ず `ast-to-md` の正規形**を経由（インデント・メタ子リスト形式を既存と一致）。
- 日付入力はピッカー＋自然言語フィールド。自然言語は `chrono-node`（日本語）で `schedule-normalize` の正規形へ。曖昧時は候補提示。
- 挿入先は「現在のカーソル行の直後」を既定とし、設定で「inbox ファイルへ追記」も選べる。
- 未入力のメタは行を生成しない（空の `@due:` を出さない）。

### 実装の要点・つまずき
- シリアライズを `ast-to-md` に委ねるため、モーダルは「部分 AST（TaskNode＋meta）」を組み立てて渡す形にすると既存テスト資産と整合する。
- `chrono-node` は依存追加。`schedule-normalize` のラッパ越しに使い、パース結果は必ず正規形に落とす。
- Obsidian の日付ピッカーは標準 UI が無いため、軽量な自前ポップオーバー or `<input type=date>` を検討。

### TODO
- [ ] クイック追加モーダル（タスク文/ステータス/日付/優先度/タグ）。
- [ ] 入力 → 部分 AST 組み立て → `ast-to-md` で正規形生成。
- [ ] `chrono-node` による自然言語日付補助（`schedule-normalize` 経由）。
- [ ] 挿入先（カーソル/inbox）設定。コマンド登録。
- [ ] テスト追加・全見直し。

### 受け入れ基準（すべて満たすこと）
- モーダル入力から正規形のタスク行＋メタが挿入される（手打ち不要）。
- 不正な日付・空メタが本文に挿入されない。
- 自然言語日付が正規形へ変換される。
- 挿入先（カーソル/inbox）を切替できる。

### テスト観点
- `vitest` 単体: 入力値 → 正規形文字列が `ast-to-md` 出力と一致（各メタ有無の組合せ）。
- 自然言語 → 正規形変換（代表ケース）。
- 未入力メタが出力に現れないこと。

### 履歴（追記のみ）
- 2026-06-30 — 起票（プラン §4.5・付録 Issue 候補 I、Phase3 SHOULD・先行可）。

---

## 3. メタデータ
- id: issue-phase003-004__quick-add-modal
- status: open
- phase: 003
- related_specs: なし（仕様は本issueに内包）
- related_decisions:
- target_files: src/plugin.ts, src/lib/parser/ast-to-md.ts, src/lib/parser/schedule-normalize.ts, src/settings.ts
- created: 2026-06-30
- updated: 2026-06-30

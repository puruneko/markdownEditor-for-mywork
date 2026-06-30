# クイックキャプチャ＆インボックス＋Refile

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
「後で清書しよう」と別メモに書いて散らかる事故を防ぐ、**どこからでも素早く 1 行追加する手段（キャプチャ）**が無い。また、雑多ノートに取り込んだタスクを**案件ノートへ移動（Refile）**する手段も無く、手コピペ＝転記・重複の温床になっている（プラン §6 B-2/B-3・§5.2 org・§5.3 #6）。

本 issue では、グローバルホットキーのキャプチャモーダルで既定 inbox ファイルへ追記し、後から Refile でタスクを別ファイル/見出しへ移動できるようにする。本プロダクトの「脱・散在」哲学に直結する。

### 方針
- キャプチャモーダル（NL 日付解釈付き）→ 設定の inbox ファイルへ追記。
- Refile: 選択タスクを別ファイル/見出しへ「移動元の最小削除＋移動先への挿入」を1トランザクションで実行（`sourcePath` 前提）。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- 着手時に**一度だけ** `project/governance/` を確認（`AI_RUNTIME_RULES.md` のロード順）。
- **テスト観点とテストコードは毎回すべて見直す**（`TESTING_STANDARD.md` 準拠）。

### 依存
- `issue-phase001-001__multi-source-ast-index`（`sourcePath`／移動先ファイル候補）。
- `issue-phase001-005__cross-file-identity-and-viewmodel`（globalKey・`patchInFile`／ファイル単位書き戻し）。
- `issue-phase003-004__quick-add-modal`（キャプチャ入力の正規化・inbox 設定を共有。重複実装しない）。

### 既存資産の再利用（必読・実装前に読む）
- `src/lib/parser/ast-to-md.ts` … キャプチャ入力の正規形シリアライズ（`issue-phase003-004` と共有）。
- `src/lib/parser/schedule-normalize.ts` … NL 日付解釈。
- `src/lib/patch/upsert-meta.ts` / `src/lib/calendar/markdown-patch.ts` … 行範囲の挿入/削除パッチ。Refile の移動元削除・移動先挿入はここを使う。
- `src/sync/ast-index.ts` … 移動先ファイル/見出し候補の供給。
- `src/plugin.ts` … グローバルコマンド/ホットキー登録。`src/settings.ts` … inbox ファイルパス設定。

### 仕様（確定事項：迷ったらこれに従う）
- キャプチャ: コマンド/ホットキー → モーダル 1 行入力 → **設定の inbox ファイル末尾（または指定見出し下）へ追記**。日付は `chrono-node`＋`schedule-normalize` で正規化。
- Refile: 対象タスク（とその子＝メタ/メモ/子タスクの行域全体）を、移動先ファイルの指定見出し下へ移動。**移動元は最小削除、移動先は挿入**を1操作で。
- Refile は `sourcePath` 必須（クロスファイル）。移動先選択は `SuggestModal`（ファイル＋見出し）。
- 移動でインデント基準が変わる場合は移動先のネスト階層に正規化（`ast-to-md` 経由）。
- 失敗時（移動先が無い等）は中断し本文を変更しない。

### 実装の要点・つまずき
- Refile は2ファイルにまたがる書き戻し。**削除→挿入の順序と原子性**に注意（途中失敗で重複/欠落が出ないよう、挿入成功を確認してから削除、もしくは両方を組み立ててから適用）。
- 子孫行域の算出は `issue-phase001-007`/`issue-phase003-001` と同じ「タスク＋子孫の行域」ロジックを共有する。
- inbox 追記先見出しが無ければ作成するか末尾追記かを設定で決める。

### TODO
- [ ] キャプチャモーダル（1行入力＋NL 日付）→ inbox 追記。
- [ ] inbox ファイル/見出し設定（`settings.ts`）。
- [ ] Refile: 対象＋子孫行域の算出 → 移動先 `SuggestModal` → 削除＋挿入トランザクション。
- [ ] グローバルホットキー/コマンド登録。
- [ ] テスト追加・全見直し。

### 受け入れ基準（すべて満たすこと）
- ホットキーでどこからでも 1 行追加でき、inbox に正規形で追記される。
- Refile で対象タスクと子孫が移動先見出し下へ移り、移動元から消える。
- 移動が原子的で、失敗時は本文が変化しない。

### テスト観点
- `vitest` 単体: キャプチャ入力 → inbox 追記文字列が正規形であること（NL 日付含む）。
- Refile: 移動元削除＋移動先挿入のパッチが対象＋子孫行域を過不足なく扱うこと。
- 移動先不在時に本文無変更で中断すること。

### 履歴（追記のみ）
- 2026-06-30 — 起票（プラン §6 B-2/B-3・付録 Issue 候補 U、Phase3 SHOULD）。

---

## 3. メタデータ
- id: issue-phase003-006__quick-capture-inbox-refile
- status: open
- phase: 003
- related_specs: なし（仕様は本issueに内包）
- related_decisions:
- target_files: src/plugin.ts, src/settings.ts, src/lib/patch/upsert-meta.ts, src/lib/parser/ast-to-md.ts, src/sync/ast-index.ts
- created: 2026-06-30
- updated: 2026-06-30

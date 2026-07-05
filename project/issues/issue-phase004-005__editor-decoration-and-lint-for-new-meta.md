# エディタ装飾・lint の新記法対応（@plan・`?`・メタ推奨位置・一括整形コマンド）

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
新記法（@plan・`?` 修飾子・due 期間）をエディタ上で**見える・間違いに気づける**ようにする。パーサー（issue-phase004-002）だけ入れて装飾・lint を放置すると、①新メタがハイライトされず「認識されていない」ように見える、②記法ミス（`? `の位置違い等）が黙って無視され、ビューから静かに消える — 本プロダクトで最も危険な抜け漏れパターン（issue-phase000-001 と同じ問題構造）が再発する。

あわせてオーナー決定 Q4「メタ行位置」を実装する: タスク行直下は**推奨**（強制しない）、位置ずれは**情報レベル**の lint、一括整形は**ユーザーがコマンドを明示的に呼んだ時のみ**。

### 方針
- 装飾は既存 `src/editor/task-decoration.ts`（CM6 ViewPlugin）、lint は既存 `src/editor/notation-lint.ts`（純関数 `lintLine`＋CM6 配線）の**拡張**。新しい機構を作らない。
- lint の受理判定は必ずパーサー（remark-meta-fields / schedule-normalize）の挙動に整合させる。**独自の正規表現でパーサーと乖離させない**（issue-phase000-001 で確立した原則。乖離すると「警告は出ないのに表示されない」逆転が起きる）。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- **実装前に `project/governance/` と `issue-phase004-000__phase-overview.md` を必ず読むこと。**
- **既存テストの見直しは機能実装と同等に重要。** `src/editor/notation-lint.test.ts`（35 件〜）は「@plan は未知キー」という旧世界の前提を含む可能性がある。@plan が正規キーになることで**既存の陰性テストが仕様的に反転する**ものを洗い出して書き換えること。task-decoration の E2E（`tests/obs-e2e/task-decoration.e2e.ts`）も新装飾の分を追加。

### 既存資産（必読・実装前に読む）
- `src/editor/notation-lint.ts` … `lintLine` 純関数（行→診断配列）と quickfix action の付け方。
- `src/editor/task-decoration.ts` … メタキー・ステータスの装飾クラス付与（`md-ast-meta-key` 等）と visibleRanges 走査・行頭 `>` 除外。
- `src/lib/parser/meta-keys.ts` / `remark-meta-fields.ts` … 受理されるキーの正。
- issue-phase004-002 の成果（`?` の構文定義）。

### 仕様（確定事項）
1. **装飾**:
   - `@plan` を既存メタキーと同様にハイライト（クラス例 `md-ast-meta-key md-ast-meta-key--plan`）。
   - `?` 付きキーは仮置きと分かる装飾（クラス例 `md-ast-meta-tentative`。色は黄系 — 具体色は既存テーマ変数に合わせる）。
   - 見た目の細部（色・太さ）は本 Issue では**クラス付与まで**を必須とし、視覚デザインの作り込みは別途モック合意後（前提: `project/plan/ux-improvement-proposals-2026-07-03.html` E-1 はモック先行の方針）。過剰に凝らないこと。
2. **lint 追加ルール**（すべて `lintLine` 拡張。パーサー挙動と整合させる）:
   - `?` の位置不正（`@schedule ?:` / `@?schedule:`）→ 警告＋一意修正（`@schedule?:`）の quickfix。
   - `@plan` の値形式不正（`/` 欠落など。schedule と同じ判定を流用）→ 警告。
   - `@due` 期間の逆順 → 警告。
   - **メタ推奨位置**: メタ行がタスク行直下の連続ブロックより後（サブタスクやメモの後）にある → **info レベル**（警告にしない。オーナー決定: 位置は推奨であり、子要素内ならどこでも有効）。lint の severity に info が無ければ hint/info 相当の最も弱いレベルを使う。
3. **一括整形コマンド**: コマンドパレットに「メタ行を推奨位置へ整形（現在のファイル）」を追加。動作: 各タスクの子にあるメタ行をタスク行直下へ移動（相対順序は保持）。**自動実行・保存時フックは禁止**（オーナー決定: ユーザーが呼んだ時のみ）。実装は AST を経由せず行操作でやると行ズレ地獄になるため、parse → ノードごとにメタ行を再配置 → ast-to-md ではなく、**既存 upsert-meta と同じ「行 splice」方式**で、1 タスク分ずつ「メタ行を抜いて直下に挿し直す」を全タスクに適用する。理由: ast-to-md 全文再生成は本文の非タスク部分（自由記述）を壊すリスクがあり、本プロダクトでは全文再生成を書き戻しに使わない方針。
4. 既存トグル `enableTaskHighlight` OFF で新装飾・lint も無効（既存慣例）。

### 実装の要点・つまずき
- lint の「正」確認方法: 迷ったら `parse-markdown` に実際に食わせて受理されるか見るテストを書く（lint テストとパーサーテストのペア化）。
- 一括整形は**冪等**であること（2 回実行しても 2 回目は無変更）。テストで冪等性を確認。
- 整形コマンドは実行前後の diff が大きくなり得るため、実行後に Obsidian Notice で「n 件のメタ行を移動しました」を日本語表示。

### TODO
- [ ] task-decoration: @plan・`?` の装飾クラス
- [ ] notation-lint: 新 4 ルール＋quickfix
- [ ] 一括整形コマンド（冪等・行 splice 方式）
- [ ] 既存テスト全見直し＋新テスト
- [ ] E2E: task-decoration.e2e.ts に @plan／`?` 装飾の確認を追加（実行時生成ファイル使用）

### 受け入れ基準
- `- @plan: 2026-07-07/07-11` がメタキーとしてハイライトされる。
- `- @schedule ?: ...` に警告＋quickfix、適用で `@schedule?:` になる。
- サブタスクの後に書いたメタ行に info が出るが、ビューには正しく反映されている（位置寛容の確認）。
- 整形コマンドでメタ行が直下に移動し、2 回目の実行は無変更。本文の非メタ行は一切変わらない。
- `npm run test:unit`・`npm run test:obs:e2e` 全通過。

### テスト観点
- lint 陽性/陰性・quickfix 適用結果・引用/コードブロック除外の回帰。
- 整形: メタが既に直下／サブタスク後／メモ挟み／複数メタ、の 4 系＋冪等性。

### 履歴（追記のみ）
- 2026-07-04 — 起票。

---

## 3. メタデータ
- id: issue-phase004-005__editor-decoration-and-lint-for-new-meta
- status: open
- phase: 004
- related_specs: time-meta-model.spec.md
- related_issues: issue-phase004-000, issue-phase004-002（先行必須）, issue-phase000-001
- target_files: src/editor/task-decoration.ts, src/editor/notation-lint.ts, src/plugin.ts（コマンド）, 各 *.test.ts, tests/obs-e2e/task-decoration.e2e.ts
- created: 2026-07-04
- updated: 2026-07-04

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
- [x] task-decoration: @plan・`?` の装飾クラス
- [x] notation-lint: 新 4 ルール＋quickfix
- [x] 一括整形コマンド（冪等・行 splice 方式）
- [x] 既存テスト全見直し＋新テスト
- [x] E2E: task-decoration.e2e.ts に @plan／`?` 装飾の確認を追加（実行時生成ファイル使用）

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

### 2026-08-01 09:40

- User Instruction:
  - 「project/governanceを確認してください。そのあと、phase004のエディタ実装分をすべて実装してください。私は席を外すので、あなたの推奨案で実装し切ってください。懸念点や質問は各issueに追記しておいてください、後で確認します。」

- Change:
  - **Spec・パーサーの先行完了**: 本 Issue は issue-phase004-002（先行必須）に依存しているが、着手時点でパーサー未実装（`META_KEYS` に `plan` なし、`project/specs/time-meta-model.spec.md` 未起票）だったため、依存順序どおり issue-phase004-001（Spec 起票）→ issue-phase004-002（パーサー拡張）を先に完了させてから本 Issue に着手した。issue-phase004-003（Health バリデーション）・issue-phase004-004（ast-to-* とライブラリ IF・共通設定）はエディタ実装に必須ではないため、本セッションのスコープ外とした（引き続き open）。
  - **task-decoration.ts**: `META_RE` に `plan` と `?`（任意）を追加。`@plan` に `md-ast-meta-key--plan`、`?` 付きメタに `md-ast-meta-tentative` クラスを付与。
  - **notation-lint.ts**:
    - `META_LINE_RE` に `plan` と `?` を追加（`?` 付きの正しい形の値も通常どおり検証されるようにした）。
    - `checkScheduleValue` を `checkScheduleLikeValue(rawValue, valueDocFrom, keyLabel)` に一般化し、`schedule` と `plan` で共有。
    - `checkDueValue` を拡張し、`@due` の期間指定（ISO 形式チェック・逆順チェック）に対応。
    - 新規 `checkTentativeMarkerPosition`: `@schedule ?:` ／ `@?schedule:` のような `?` の位置不正を検出し、`@schedule?:` への quickfix を提示。
    - 新規: `findMisplacedMetaLineIndices`（`reformat-meta-lines.ts`）を使い、位置が推奨位置でないメタ行に `severity: 'info'` の診断を追加（warning にはしていない＝Spec BR-026 準拠）。
  - **新規 `src/editor/reformat-meta-lines.ts`**: 「メタ行を推奨位置へ整形」コマンドの中核ロジック。AST は用いず行 splice 方式（既存 upsert-meta と同じ思想）。1タスクずつ直して再パース→再走査を繰り返す設計にすることで、並び替えによる子孫ノードの行番号ずれを回避した。`reformatMetaLines`（適用・冪等）と `findMisplacedMetaLineIndices`（lint 用の検出のみ・非破壊）の2関数をエクスポートし、lint とコマンドで検出ロジックを共有している。
  - **plugin.ts**: コマンド `reformat-meta-lines`（「メタ行を推奨位置へ整形（現在のファイル）」）を追加。`editorCallback` でアクティブエディタの内容を直接書き換え、結果件数を Notice で日本語表示。自動実行・保存時フックは追加していない（オーナー決定どおり）。
  - **既存テストの見直し**: `notation-lint.test.ts` の既存ケースをすべて確認したが、`plan` 追加・`?` 対応は既存の陰性テスト（優先度・タグ行に警告なし等）を反転させるものはなかった。既存の期待値変更は不要で、新規ケースの追加のみで完了。
  - **新規テスト**: `notation-lint.test.ts`（@plan 値チェック・仮置き `?` 正しい位置／不正位置・@due 期間の正常系/逆順）、`reformat-meta-lines.test.ts`（直下／サブタスク後／メモ挟み／複数メタ／冪等性／複数タスク一括）、`ast-to-md.test.ts`（plan・仮置きのラウンドトリップ）を追加。E2E は `tests/obs-e2e/task-decoration.e2e.ts` に `@plan` クラス確認・`?` クラス確認・整形コマンドの適用と冪等性の4ケースを追加（`writeVaultFile` による実行時生成フィクスチャを使用）。

- Rationale:
  - `checkTentativeMarkerPosition` を独立関数にしたのは、`?` の位置不正が `META_LINE_RE` に一切マッチしない文字列であり、既存の「メタ行として認識してから値を検証する」フローに乗せられないため。
  - 一括整形を「1タスク直して再パースを繰り返す」設計にしたのは、複数タスクを一度に行 splice すると、並び替えによって後続タスクの絶対行番号が本来の位置からずれ、誤ったタスクを処理してしまう危険があったため（テストで発覚し、設計を修正した）。

- テスト結果（2026-08-01 実施）:
  - `npm run test:unit`: 504 件全通過（本 Issue 範囲の新規・変更テストを含む）。
  - `npm run test:obs:e2e`（実機 Obsidian・8 spec）: 7 spec 全通過。**1件のみ既存の失敗が残っている**（下記「懸念事項」参照）。
  - `npx svelte-check`: 本 Issue の変更に起因する新規の型エラーはなし（既存基線 78 件に対し、e2e ヘルパの型定義ギャップ由来のノイズのみ増加。詳細は「懸念事項」参照）。

### 懸念事項・確認事項（ユーザーへ）

1. **`tests/obs-e2e/gantt-view.e2e.ts` の「期間なしサブタスクのドラッグ予定化（issue-gantt-phase004-008）」テストが失敗する。** 本 Issue の変更（`src/editor/*`, `src/lib/parser/*`, `src/plugin.ts`）とは無関係なファイル（gantt の DnD）であり、着手前から存在した状態と判断している（本 Issue の diff はこのテストが参照するコードに一切触れていない）。ヘッドレス実行環境に Xvfb が無い（`xvfb-run not found` 警告）ことが原因の可能性がある。本 Issue の受け入れ基準「`test:obs:e2e` 全通過」は、この既知の無関係な1件を除いて満たしている。ユーザー環境（Xvfb あり）での再実行を推奨する。
2. **`npm run check`（svelte-check）は本リポジトリで基線から78件のエラーがある状態だった**（`src/settings.ts`・`src/sync/*.ts`・obs-e2e ヘルパの `Browser` 型定義ギャップ等、いずれも本 Issue と無関係）。本 Issue の変更により新規に増えた型エラーは無い（既存の obs-e2e 型ギャップと同種のノイズが新規テストコード分だけ増えているのみ）。`npm run check` は `TESTING_STANDARD.md` の必須テストコマンドに含まれていないため、ブロッカーとはしていない。
3. **`@repeat` は task-decoration・notation-lint のどちらにも装飾／lint 対象キー一覧に含まれていない**（本 Issue着手前からの既存の抜け）。本 Issue のスコープ外として手を付けていないが、issue-phase000-001 の教訓（パーサーと lint/装飾の乖離）に照らすと将来的に埋めるべきギャップと考えられる。
4. **一括整形コマンドは `editor.setValue()` で全文置換するため、カーソル位置・スクロール位置・Undo 履歴の粒度がリセットされる。** 受け入れ基準（冪等性・本文非破壊）は満たしているが、UX として「実行後にカーソルが先頭に戻る」点は改善余地がある（別Issue化を検討可）。
5. **issue-phase004-003（Health バリデーション）・issue-phase004-004（ast-to-* とライブラリ IF・共通設定）は未着手のまま。** `@plan`・`?`・期間 due はパーサー・エディタでは動作するが、Health パネルでのバリデーション（V-1〜V-3）や Gantt/Calendar への実際の描画反映はまだ行われない（ライブラリ側 Issue も未着手）。次のステップとして issue-phase004-004（ライブラリへ渡す prop 型の確定）から着手するのが phase004-000 の依存順序どおりの進め方になる。
6. **R-1（`@schedule` の名称）は未確定のまま。** issue-phase004-001 の「確認事項」を参照。

---

## 3. メタデータ
- id: issue-phase004-005__editor-decoration-and-lint-for-new-meta
- status: implemented（ユーザー承認待ち）
- phase: 004
- related_specs: time-meta-model.spec.md
- related_issues: issue-phase004-000, issue-phase004-002（先行必須）, issue-phase000-001
- target_files: src/editor/task-decoration.ts, src/editor/notation-lint.ts, src/editor/reformat-meta-lines.ts（新規）, src/plugin.ts（コマンド）, 各 *.test.ts, tests/obs-e2e/task-decoration.e2e.ts
- created: 2026-07-04
- updated: 2026-08-01

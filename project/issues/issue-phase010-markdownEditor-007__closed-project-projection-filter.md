# クローズ案件の投影前フィルタ（元ID: I-17 ／ 対応 preIssue: GANTT-009 ／ Phase: 3）

## 1. Background（背景）

`修正したい箇所.md` の gantt 節: 「クローズしている案件は表示から除外して」（GANTT-009 に対応）。

**適用 DEC-05（`close` の消費はホスト投影の手前で一括除外する。ライブラリ側は無変更）**: 各ライブラリに `close` を渡して個別に除外させると `close` の解釈が4通りに分裂する。ホストに `filterClosedProjects(sources)` を1つ置き、全投影がその出力を使う。

**注意**: 入力の GANTT-009 は「クローズしている案件は表示から除外して」とガントについてのみ書かれているが、**gantt だけ除外して他ビューに残すとビュー間で案件の見え方が食い違う**。フィルタは calendar / gantt / kanban / dashboard の全投影に適用する。

## 2. Objective（目的）

`close: true` が設定された案件（I-07 で `Section.close` として実装済み想定）を、ホストの投影処理の手前で一括除外し、全ビュー（calendar / gantt / kanban / dashboard）から一貫して除外されるようにする。

## 3. Scope（スコープ）

- ホスト側に `filterClosedProjects(sources)` 相当の関数を1つ新設する
- 全投影（calendar / gantt / kanban / dashboard）がその出力を使うよう配線する
- 各ライブラリ（calendar / gantt / kanban / dashboard）側の `close` 対応実装は行わない

## 4. Implementation requirements（実装要件）

- ホストに `filterClosedProjects(sources)` 相当の関数を1つ置き、**全投影（calendar / gantt / kanban / dashboard）がその出力を使う**
- **なぜホスト側か**: 各ライブラリに `close` を渡して個別に除外させると `close` の解釈が4通りに分裂する。gantt ライブラリの `GanttNode` に `close` 相当のフィールドは無く、ライブラリの設計方針（「受け取ったものを描くだけ」）にも忠実

## 5. Files / components likely to be changed（変更が見込まれるファイル／コンポーネント）

- ホスト側の投影処理の入口（各ビューの `extractXxxNodes` / `extractGanttNodes` 等の呼び出し前段。具体的な配置箇所は plan に明記が無いため実装時に確認。**要確認**）
- `src/lib/calendar/ast-to-calendar.ts`、`src/lib/gantt/ast-to-gantt.ts`、`src/lib/kanban/ast-to-kanban.ts`、dashboard 投影処理の呼び出し元（フィルタ適用箇所として）

## 6. Dependencies（依存関係）

- 先行 Issue: issue-phase010-markdownEditor-006__section-meta-close-memo.md（I-07）の完了後（`Section.close` フィールドが存在することが前提）
- 他リポジトリの preIssue をここで巻き取る: **GANTT-009**（gantt リポジトリ側の作業ではない）
- 他リポジトリへの影響: calendar / gantt / kanban / dashboard のいずれのライブラリにも改修は発生しない（ホスト側のみで完結）

## 7. Acceptance criteria（受け入れ基準）

- `close: true` の案件がガントに表示されない
- 同じフィルタが他ビュー（calendar / kanban / dashboard）にも適用できる形になっている

## 8. Test requirements（テスト要件）

- **要確認**: 本 issue 専用の具体的なテストファイル名は明確に定められていない。`filterClosedProjects` の単体テスト、および各ビューへの適用を確認する統合テストの要否・配置場所は実装時に判断すること
- 最低限、`close: true` の案件が各投影出力に含まれないことを確認する単体テストを追加すること

## 9. Out of scope（対象外）

- 各ライブラリ（calendar / gantt / kanban / dashboard）側での `close` 判定ロジックの実装（ホスト側のみで完結させる）
- `Section.close` フィールド自体の実装（issue-phase010-markdownEditor-006__section-meta-close-memo.md の対象）

## Progress & Implementation Notes

### History

#### 2026-09-22

- User Instruction:
  - project/governance のルールに従い、issue-phase010 シリーズを順番にすべて実装する

- Change:
  - `src/lib/viewmodel/filter-closed-projects.ts` を新設。`filterClosedProjects(sources)` が `close: true` の `Section`（サブセクション含め任意の深さ）をその配下（`children`・`subSections`）ごと除外する。変更が無い場合は元の参照をそのまま返す（無駄な複製を避ける）
  - `src/views/ShadowItemView.ts` の `getSources()` を `private` から `protected` に変更し、サブクラスがオーバーライドできるようにした
  - `src/views/CalendarView.ts` / `src/views/GanttView.ts` / `src/views/KanbanView.ts` / `src/views/DashboardView.ts` の4ビューに `getSources()` オーバーライドを追加し、`filterClosedProjects(super.getSources())` を返すようにした。`AstView` は対象外（DEC-05 のとおり calendar/gantt/kanban/dashboard の4投影のみに適用。AST View は生の解析結果を見るデバッグ用ビューのため除外）
  - 単体テスト新設: `src/lib/viewmodel/filter-closed-projects.test.ts`（トップレベル close セクションの除外、変更なし時の参照同一性、ネストしたサブセクションの close 除外、複数ファイルにまたがる独立フィルタ、全除外時の空配列）

- Rationale:
  - DEC-05（`close` の消費はホスト投影の手前で一括除外する。ライブラリ側は無変更）に従い、各ライブラリへの `close` フィールドの受け渡しは行わず、`SourceEntry[]` の時点で除外した
  - `ShadowItemView.getSources()` はすでに全5ビュー共通の唯一の sources 取得経路（`onOpen()` の初期値、`astIndex.onChange` の更新経路の双方）であったため、そこをオーバーライド可能にする設計が「1つの関数を置き、全投影がその出力を使う」という要件に最も自然に合致すると判断した
  - `close: true` はサブセクション（任意の深さの見出し）にも同様に適用されるため、除外もトップレベルに限らず再帰的に行った（親セクションの `close` が false でも、子セクションが `close: true` ならその配下だけを除外する）

- Verification:
  - `npx vitest run` → 25 test files / 496 tests すべて成功（新設5件含む）
  - `npx tsc --noEmit` → 変更ファイルに起因する型エラーなし
  - `node esbuild.config.mjs production` → ビルド成功
  - **未実施（要目視確認）**: Obsidian 実機で `close: true` の案件が実際にガント/カレンダー/かんばん/ダッシュボードの各ビューから見えなくなること（Acceptance criteria）

- Status: 自動化可能な範囲は実装完了。目視確認とユーザーの明示的な承認待ちのため Issue は Open のまま（WORKFLOW.md §6）。

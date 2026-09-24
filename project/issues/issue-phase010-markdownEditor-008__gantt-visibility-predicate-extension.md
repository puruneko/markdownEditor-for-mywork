# gantt 投影の可視性述語の拡張（元ID: I-20 ／ 対応 preIssue: GANTT-007 ／ Phase: 3）

## 1. Background（背景）

`修正したい箇所.md` の gantt 節: 「タスクがなくても、リストやheadingのメタ情報に日付情報がある場合はチャートに表示するようにして」（GANTT-007 に対応）。

**原因（確認済み。gantt ライブラリではなくホスト（このリポジトリ）の問題）**: `src/lib/gantt/ast-to-gantt.ts`
- `hasScheduleDescendant()`（42-52行）が **`node.type === 'task' && node.meta?.schedule`** のみを真とする
- `sectionHasSchedule()`（54-61行）がこれを使い、偽なら `extractFromSection`（258行）で**セクションごと出力を打ち切る**
- `extractFromNodes()` の `list` 分岐（215-217行）も `hasChildSchedule` が偽なら `continue` — **`ListNode` 自身が `meta.plan` / `.due` / `.schedule` を持っていても出力されない**
- 一方 `ListNode.meta` 自体は**既に正しくパースされている**（issue-phase010-markdownEditor-006__section-meta-close-memo.md の実測表の最終行を参照）

**適用 DEC-14（list 由来ノードは既存の `type: 'subsection'` のまま出す。新種別は作らない）**: `extractFromNodes` の `list` 分岐は**既に `type: 'subsection'` で `GanttNode` を生成している**。述語を緩めるだけで済み、task 固有の見た目（種別アイコン・リサイズハンドル）は付かない。

## 2. Objective（目的）

タスクを持たなくても、日付メタ（`schedule` / `plan` / `due`）を持つ任意のノード（リスト項目・見出し）がガントチャートに表示されるようにする。

## 3. Scope（スコープ）

- `hasScheduleDescendant()` / `sectionHasSchedule()` / `extractFromNodes()` の `list` 分岐の3箇所の述語拡張
- heading（見出し）側の日付メタの取り込み（I-07 で `Section.meta` が入ることを前提とする）
- 新しい `GanttNodeType` の新設は行わない

## 4. Implementation requirements（実装要件）

- **変更内容**: 上記3箇所の述語を「**日付メタ（`schedule` / `plan` / `due`）を持つ任意のノード**」へ拡張する
- **DEC-14 の根拠**: `extractFromNodes` の `list` 分岐は**既に `type: 'subsection'` で `GanttNode` を生成している**。述語を緩めるだけで済み、task 固有の装飾（種別アイコン・リサイズハンドル）は付かない
- **heading 側**: I-07（issue-phase010-markdownEditor-006__section-meta-close-memo.md）で `Section.meta` が入るため、同じ述語拡張で heading の日付も拾える
- **併せて方針決定すること**: `GanttTab.svelte` が `viewRange: undefined` を渡しているため **`@repeat` タスクがガントに一切表示されない**（契約注釈 A-10）。本 issue の作業中に「表示されないノードがある」として混乱しうるため、ここで扱いを決める（issue-phase010-markdownEditor-003__occurrence-id-normalization-guard.md（I-06）で「別途要検討。I-20 着手時に方針決定」とされていた事項）

## 5. Files / components likely to be changed（変更が見込まれるファイル／コンポーネント）

- `src/lib/gantt/ast-to-gantt.ts`
  - `hasScheduleDescendant()`（42-52行）
  - `sectionHasSchedule()`（54-61行）
  - `extractFromNodes()` の `list` 分岐（215-217行）
  - `extractFromSection()`（258行）
- `src/lib/gantt/ast-to-gantt.test.ts`（既存アサーションの書き換え）

## 6. Dependencies（依存関係）

- 先行 Issue: issue-phase010-markdownEditor-006__section-meta-close-memo.md（I-07）の完了後（`Section.meta` の存在が前提）
- 他リポジトリの preIssue をここで巻き取る: **GANTT-007**（gantt リポジトリ側の作業ではない）
- 関連: issue-phase010-markdownEditor-003__occurrence-id-normalization-guard.md（I-06）で保留された「`@repeat` タスクがガントに一切表示されない」問題の方針決定を本 issue で行う

## 7. Acceptance criteria（受け入れ基準）

- **既存の `ast-to-gantt.test.ts` のアサーションは現在の述語を前提としているため落ちるのが正常。** 新旧の期待値を明示的に書き換える
- タスクが無くても日付メタを持つリスト／見出しがチャートに出ること

## 8. Test requirements（テスト要件）

- `src/lib/gantt/ast-to-gantt.test.ts` の既存アサーションを、新しい述語の期待値に明示的に書き換える
- タスクを持たないリスト項目・見出しが日付メタを持つ場合にチャートへ出力されることを確認するテストケースを追加する

## 9. Out of scope（対象外）

- 新しい `GanttNodeType` の新設（DEC-14 により行わない。既存の `type: 'subsection'` を流用する）
- `@repeat` タスクのガント表示問題そのものの実装（本 issue では「方針決定」のみを行い、決定内容に応じた実装が別途必要な場合は別 issue とする。**要確認**: 方針決定の結果、追加実装が必要になった場合の issue 化要否は plan に明記が無い）

## Progress & Implementation Notes

### History

#### 2026-09-22

- User Instruction:
  - project/governance のルールに従い、issue-phase010 シリーズを順番にすべて実装する

- Change:
  - `src/lib/gantt/ast-to-gantt.ts` に共通述語 `hasDateMeta(meta)`（`schedule`/`plan`/`due` のいずれかを持つか）を新設
  - `hasScheduleDescendant()`（旧: `node.type === 'task' && node.meta?.schedule` のみ）を `hasDateMeta(node.meta)` へ拡張し、task に限らず list にも適用されるようにした
  - `sectionHasSchedule()` に `hasDateMeta(section.meta)` のチェックを追加し、見出し（Section）自身が日付メタを持つ場合も可視にした（I-07 で追加された `Section.meta` を前提とする）
  - `extractFromNodes()` の `list` 分岐の可視性ガードを `if (!hasChildSchedule) continue` から `if (!hasChildSchedule && !hasDateMeta(node.meta)) continue` に変更し、自身が日付メタを持つリスト項目も可視にした
  - 関数名・`GanttNodeType` は変更していない（DEC-14: 既存の `type: 'subsection'` のまま出す。述語を緩めるだけに留めた）
  - タスク自身の可視性ゲート（`extractFromNodes` の `task` 分岐、`hasSchedule = !!node.meta?.schedule`）は対象外の3箇所に含まれないため変更していない
  - **`@repeat`/ガント表示範囲の方針決定（本 issue の要求事項）**: `GanttTab.svelte` が `viewRange: undefined` を渡し続けている現状を審議し、**現状維持（実装見送り）と決定した**。理由: Gantt には Calendar の週/月表示のような自然な「現在の表示範囲」概念が無く、`svelte-gantt-lib` に可視範囲を返す API が現時点で存在しない。固定の広い範囲をデフォルトにする案は無期限 daily 等での展開数増加リスクがある。ライブラリ側の API 新設は「ホスト側のみで完結」という他 issue との方針に反する。実装が必要になった場合は、ライブラリ側の可視範囲 API 新設を含む別 issue として起票する
  - `documents/external-data-contract.spec.md` の注釈 A-10 に上記の方針決定内容を追記した（BR 本文の追加ではなく、既存注釈への追記。契約の構造自体は変更していないため新規 BR 番号の採番は不要と判断）
  - `src/lib/gantt/GanttTab.svelte` の `extractGanttNodes` 呼び出し箇所に、上記決定を参照するコメントを追加した
  - 単体テスト新設・書き換え: `src/lib/gantt/ast-to-gantt.test.ts` に8件追加（タスクを持たない `@plan`/`@due`/`@schedule` のみのリスト項目が可視になること、日付メタが無いリスト項目は従来どおり非表示、見出し自身が `@plan`/`@due` を持つ場合に可視になること、日付メタの無い見出しは従来どおり非表示、新しい `GanttNodeType` が追加されていないことの確認）。既存39件のアサーションは述語拡張後も全件成功したため書き換えは不要だった（既存フィクスチャが「日付メタ無し・スケジュール済み子孫無しでも非表示のまま」という境界条件を明示的にテストしていなかったため）

- Rationale:
  - Implementation requirements の「上記3箇所の述語を...へ拡張する」を文字どおり3箇所（`hasScheduleDescendant`・`sectionHasSchedule`・`list` 分岐）に限定し、タスク自身の可視性ロジックやノードへの値設定ロジック（`plan`/`milestone` の反映）には手を加えなかった。これは DEC-14 の「述語を緩めるだけで済み」という指針、および WORKFLOW.md の「Issue が求める範囲を超えて最適化・リファクタしない」という原則に従った判断
  - `@repeat`/viewRange の扱いは、Issue 本文が「方針決定のみを行う」ことを明示的に求めており、実装を伴わない決定として処理した。決定内容は再現性・追跡可能性のため契約 Spec の既存注釈（A-10）に追記する形で記録した

- Verification:
  - `npx vitest run` → 25 test files / 504 tests すべて成功（新設8件含む）
  - `npx tsc --noEmit` → 変更ファイルに起因する型エラーなし
  - `node esbuild.config.mjs production` → ビルド成功

- Status: 実装完了（方針決定を含む）。ユーザーの明示的な承認待ちのため Issue は Open のまま（WORKFLOW.md §6）。

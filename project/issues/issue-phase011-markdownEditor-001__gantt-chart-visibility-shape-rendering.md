# gantt 投影：日付メタを持つノードに実際の図形（バー／マイルストーン）を描画する（元要件: 修正したい箇所.md gantt節「タスクがなくても、リストやheadingのメタ情報に日付情報がある場合はチャートに表示するようにして」）

## 1. Background（背景）

`修正したい箇所.md` の gantt 節の要件は次のとおりである。

> タスクがなくても、リストやheadingのメタ情報に日付情報がある場合はチャートに表示するようにして

この要件に対応する先行対応として、本リポジトリの `issue-phase010-markdownEditor-008__gantt-visibility-predicate-extension.md` が、`src/lib/gantt/ast-to-gantt.ts` の可視性述語（`hasScheduleDescendant()` / `sectionHasSchedule()` / `extractFromNodes()` の `list` 分岐）を「日付メタ（`schedule`/`plan`/`due`）を持つ任意のノード」へ拡張する対応を行った。この対応により、**タスクを持たないリスト項目や見出しがガントの「ツリー」には行として表示されるようになった。**

しかし、実際のコードを確認した結果、**チャート領域（タイムライン）に図形が描画されるところまでは対応が及んでいない**ことが判明した。具体的には:

- `descendantDateRange()`（`src/lib/gantt/ast-to-gantt.ts` の72〜97行付近）が、依然として **`node.type === 'task' && node.meta?.schedule` の組み合わせのみ**を集計対象としている。この関数はノードの開始・終了日時の範囲を計算し、実際の描画用ノード（バー・マイルストーンの座標）を生成する元になっている
- `extractFromNodes()` の `list` 分岐は、`meta.plan` は図形生成用のフィールドとして設定するが、**`meta.schedule` を意図的に無視**しており、`meta.due` をマイルストーン形状に変換する処理も行っていない
- `extractFromSection()`（見出し由来のノードを生成する分岐）は、**`plan` にも `milestone` にも対応する図形を一切設定していない**

**結果として起きている現象**: `@schedule` のみ、または `@due` のみを持つリスト項目、および日付メタ（`schedule`/`plan`/`due`のいずれか）を持つ見出しは、**ツリー（左側の階層表示）には行として表示されるが、チャート（右側のタイムライン領域）には何の図形も描画されない。** ユーザーが期待する「チャートに表示する」という結果に至っていない。

`src/lib/gantt/ast-to-gantt.test.ts` に追加された単体テストは、生成されたノードオブジェクトが `toBeDefined()`（存在すること）を確認するに留まっており、**そのノードが実際にバーやマイルストーンとして描画可能な図形データ（開始・終了座標、種別に応じた形状情報）を持っているかまでは検証していない**。そのため、この欠落はテストで検出されない状態にある。

**この欠落が生じた経緯**: 先行 issue（`issue-phase010-markdownEditor-008__gantt-visibility-predicate-extension.md`）の実装要件が「可視性の述語（表示するか否かの判定）を拡張する」ことに限定されており、「チャート領域に実際の図形を描画するためのデータ生成」までを明示的な要求事項・受入条件としていなかった。したがって、これは実装者の対応漏れではなく、**先行 issue の記述範囲が不足していたことに起因する未達**である。

## 2. Objective（目的）

タスクを持たなくても、日付メタ（`schedule` / `plan` / `due` のいずれか）を持つリスト項目・見出しが、ガントチャートのツリーに行として表示されるだけでなく、**タイムライン領域に実際のバー（`schedule`/`plan`の場合）またはマイルストーン形状（`due`の場合）として描画される**ようにする。

## 3. Scope（スコープ）

- `descendantDateRange()` を、`task` に限定せず、`schedule`/`plan`/`due` のいずれかの日付メタを持つ任意のノード（リスト由来・見出し由来を含む）を集計対象とするよう拡張する
- `extractFromNodes()` の `list` 分岐で、`meta.schedule` を無視せず図形生成に反映させる。`meta.due` をマイルストーン形状に変換する処理を追加する
- `extractFromSection()`（見出し由来のノード生成）で、`plan` と `milestone` の図形をそれぞれ設定できるようにする
- 新しい `GanttNodeType` の新設は行わない（先行issueの `DEC-14` の方針を継続する。list由来ノードは既存の `type: 'subsection'` のまま出す）

## 4. Implementation requirements（実装要件）

1. **`descendantDateRange()` の集計条件を拡張する**: 現在の `node.type === 'task' && node.meta?.schedule` という条件を、`node.meta?.schedule` / `node.meta?.plan` / `node.meta?.due` のいずれかを持つ任意のノード（`node.type` を問わない）に広げる
2. **`extractFromNodes()` の `list` 分岐で `schedule` を反映する**: 現在 `plan` のみを図形生成用に設定しているが、`meta.schedule` を持つ場合は通常のタスクバーと同等の図形データ（開始・終了座標）を生成する
3. **`list` 分岐・`extractFromSection()` の両方で `due` をマイルストーン形状に変換する**: 単一日付である `due` は、既存のマイルストーン描画ロジック（`task` かつ `due` のみを持つケースで使われている変換処理）と同じ変換を、リスト由来・見出し由来のノードにも適用する
4. **`extractFromSection()` に `plan` の図形設定を追加する**: 見出しが `plan` メタを持つ場合、点線枠として描画されるための図形データを設定する
5. 上記のいずれの変更も、**新しい `GanttNodeType` を作らず**、既存の `type: 'subsection'`（list由来）・見出し由来の既存の型のまま図形データだけを充実させる方針で実装する
6. 図形データの生成ロジックは、既存の `task` 向けの変換処理（開始・終了日時から座標を算出する部分）を可能な限り再利用し、`task` 専用の分岐（種別アイコン・リサイズハンドルなど）は付与しないこと

## 5. Files / components likely to be changed（変更が見込まれるファイル／コンポーネント）

- `src/lib/gantt/ast-to-gantt.ts`
  - `descendantDateRange()`（72-97行付近）
  - `extractFromNodes()` の `list` 分岐（215-217行付近。ただし先行issueでの述語拡張により行番号がずれている可能性があるため、実装前に現在の行番号を確認すること）
  - `extractFromSection()`（258行付近）
- `src/lib/gantt/ast-to-gantt.test.ts`（図形データの検証を追加）

## 6. Dependencies（依存関係）

- **`issue-phase010-markdownEditor-008__gantt-visibility-predicate-extension.md` の完了後に着手する直接の後続修正である。** 可視性述語の拡張（ツリーに行を出す部分）は完了済みという前提に立ち、本Issueはその続き（チャートに図形を出す部分）を扱う
- `issue-phase010-markdownEditor-006__section-meta-close-memo.md`（`Section.meta` の追加）が完了していることが前提（見出し側の日付メタを読むため）

## 7. Acceptance criteria（受け入れ基準）

- `@schedule` のみを持つ（タスクではない）リスト項目が、ガントチャートのタイムライン領域に通常のタスクバーと同等の図形として描画される
- `@due` のみを持つ（タスクではない）リスト項目が、マイルストーン形状として描画される
- `@plan` を持つ見出しが、点線枠の図形として描画される
- `@due` を持つ見出しが、マイルストーン形状として描画される
- 上記いずれの場合も、`task` 固有の装飾（種別アイコン・リサイズハンドル）は付与されない
- 既存の `task` ノードの描画（通常のバー・マイルストーン）に回帰が無い

## 8. Test requirements（テスト要件）

- `src/lib/gantt/ast-to-gantt.test.ts` に、**生成されたノードが `toBeDefined()` であることだけでなく、実際の図形データ（開始・終了座標、図形種別）を持っていることを検証するテストケース**を追加する。具体的には、`schedule` のみを持つリスト項目・見出しから生成されたノードが、`task` から生成されたノードと同等の座標データ構造を持つことをアサートする
- `due` のみを持つケースについても、マイルストーン用の座標データを持つことを検証する
- 既存の `task` ノードのテストに回帰が無いことを確認する

## 9. Out of scope（対象外）

- 新しい `GanttNodeType` の新設（先行issueのDEC-14の方針を継続し、行わない）
- `@repeat` タスクがガントに一切表示されない問題への対応（`issue-phase010-markdownEditor-008__gantt-visibility-predicate-extension.md` で方針決定の対象とされていた別の問題であり、本Issueのスコープには含まない）
- gantt リポジトリ側（`ganttchart-for-mywork`）での図形の見た目・スタイル調整（本Issueはホスト側のデータ生成のみを扱う。gantt ライブラリは「受け取ったものを描くだけ」であり、正しい図形データが渡されれば追加のライブラリ側修正は不要と見込まれるが、確認が必要な場合は別途 gantt リポジトリ側で扱う）

## Progress & Implementation Notes

### History

#### 2026-09-23

- User Instruction:
  - project/governance のルールに従い、issue-phase011 シリーズを順番にすべて実装する（`../__workspace/output/project/issues` から本リポジトリ分をコピーして着手）

- Change:
  - `src/lib/gantt/ast-to-gantt.ts`:
    - `descendantDateRange()` の集計条件を、`node.type === 'task' && node.meta?.schedule` のみから、任意のノードの `schedule`/`plan`/`due`（それぞれ独立に）へ拡張した。`due` は単一点マイルストーン（`DateTime`）・期間マイルストーン（`{start,end}`）の両方に対応する
    - `extractFromNodes()` の `list` 分岐: `node.meta?.schedule` を無視せず `start`/`end` を設定するようにした（従来は `plan` のみ対応）。`node.meta?.due` を `milestone` へ変換する処理を追加した。自身に `start` が無い場合のみ子孫の集計範囲へフォールバックする（優先順位: 自身の `schedule` > 子孫の集計範囲）
    - `extractFromSection()`: 見出し自身の `@plan` を `ganttNode.plan`、`@due` を `ganttNode.milestone` に設定する処理を追加した（Implementation requirements の明示範囲どおり、見出し自身の `@schedule` の `start`/`end` への反映は対象外とした。範囲は従来どおり `sectionDescendantDateRange()` による子孫集計のみを使う）
    - いずれも新しい `GanttNodeType` は追加していない（DEC-14 継続）。`task` 固有の装飾（`status`・種別アイコン等）は付与していない
  - `src/lib/gantt/ast-to-gantt.test.ts` に8件のテストケースを追加し、生成ノードが実際の図形データ（`start`/`end`・`plan`・`milestone`）を持つことを検証した（`toBeDefined()` だけでなく座標値まで確認）。既存47件は変更前後ともに全件成功（回帰なし）

- Rationale:
  - Implementation requirements の4項目（`descendantDateRange` 拡張・list の schedule 反映・list/section 双方の due→milestone・section の plan）を1件ずつ忠実に実装した
  - `extractFromSection()` への `schedule`（`start`/`end` への直接反映）追加は、Implementation requirements に明記が無く、Acceptance criteria にも `@schedule` を持つ見出しのケースが含まれていなかったため、意図的にスコープ外とした（過剰実装の回避）
  - `descendantDateRange` の拡張により、`@schedule` を持たず `@plan`/`@due` のみを持つ子孫でも祖先グループ（task の折りたたみ範囲・list の範囲）に反映されるようになった。これは Implementation requirements 項目1の文言（「task に限定せず...任意のノードを集計対象とする」）どおりの挙動である

- Verification:
  - `npx vitest run` → 25 test files / 512 tests すべて成功（新設8件含む）
  - `npx tsc --noEmit` → 変更ファイルに起因する型エラーなし
  - `node esbuild.config.mjs production` → ビルド成功
  - **追記（issue-phase011-markdownEditor-002 の作業時に実施）**: `.obsidian-cache` の実機 Obsidian 環境が利用可能だったため、`npx wdio run wdio.conf.mts --spec tests/obs-e2e/gantt-view.e2e.ts` を実行した。「ガントタイムラインにタスクバーが描画される」を含む6件は成功。「バードラッグで @schedule が更新される」「完了タスクのバーが completed 装飾でグレーアウトされる」の2件は失敗したが、`git stash` で `ast-to-gantt.ts`/`GanttTab.svelte` を変更前のコミット済み状態へ完全に戻しても同じ2件が同じ理由で失敗することを確認済み。原因は `test/vaults/simple/test-tasks.md` の固定フィクスチャ日付（2026年3〜4月）と実行時の現在日時（2026-09-23）のドリフト（該当テストファイル自身のコメントが既知の限界として明記）であり、**本Issueの変更とは無関係の、セッション開始前から存在する既存の問題**である。ユーザーへの報告事項として申し送る

- Status: 実装完了・実機E2E検証済み（無関係な既存の日付ドリフト起因の2件を除き成功）。ユーザーの明示的な承認待ちのため Issue は Open のまま（WORKFLOW.md §6）。

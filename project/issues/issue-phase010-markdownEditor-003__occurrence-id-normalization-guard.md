# オカレンス ID 正規化（遷移）＋書き戻しガード（元ID: I-06 ／ 対応 preIssue: CALENDAR-006 ／ Phase: 1）

## 1. Background（背景）

`修正したい箇所.md` の calendar 節: 「カードをクリックしても該当行に移動しない場合があります。原因を分析し、解決して。」（CALENDAR-006 に対応）。この不具合の本体は calendar 側ではなく markdownEditor（ホスト）側の ID 正規化にある。

**確認された事実（issue 本文に転記済み）**:

| 箇所 | 内容 |
|---|---|
| `src/lib/calendar/ast-to-calendar.ts:108` | `@repeat` タスクをオカレンス展開し `id: \`${baseId}__r${idx}\`` を付与（`baseId` は既に globalKey） |
| `src/lib/gantt/ast-to-gantt.ts:148` | 同様 |
| `src/lib/calendar/CalendarTab.svelte` | カレンダーは `viewRange` を**常に**渡す → `@repeat` タスクは実際に `__r` 付きで表示される |
| `src/lib/gantt/GanttTab.svelte` | ガントは `extractGanttNodes(sources, undefined, ...)` と `viewRange` に `undefined` を渡す → `@repeat` タスクはガントに**一切表示されない**（別途要検討。`issue-phase010-markdownEditor-008__gantt-visibility-predicate-extension.md`（I-20）着手時に方針決定） |
| `src/lib/viewmodel/global-key.ts:9-16` | `parseGlobalKey` は `::` で分割するのみ。`__r` を剥がさない |
| `src/views/ShadowItemView.ts` | `navigateToNode` が `doc.nodeLineMap.get(localId)` を引く。`s1.n2__r0` は必ず `undefined` → `if (line === undefined) return` で**無言終了** |
| `src/lib/viewmodel/resolve.ts:14-19` | 書き戻し側も `findNodeById(doc, localId)` で `__r` 付きを引いている |
| 契約 注釈 A-10 | 「連携アプリは、書き戻し時に `__r<連番>` を除去しなければならない」 |

**適用 DEC-03（`__r<n>` の扱い: 遷移は剥がす／書き戻しは拒否する。`parseGlobalKey` 自体は変更しない）**: `CalendarTab.handleItemMove` / `handleItemResizeEnd` は `onNodePatch(item.id, ...)` に `__r` 付き ID を渡し `patchScheduleForNode` で `@schedule` 行を書き換える。現状は `findNodeById` が `undefined` を返して**無反応**だが、`parseGlobalKey` を一律に変えると **`@repeat` の4回目のオカレンスを少しドラッグしただけでベースの `@schedule` が書き換わり、全オカレンスが一斉にずれる**。サイレントな無反応 → **サイレントなデータ破壊**への悪化になる。→ `stripOccurrenceSuffix()` を新設し**遷移経路だけ**が使う。

**適用 DEC-24（`__r` 修正だけで「CALENDAR-006 解決」と宣言しない）**: `@repeat` の使用実態は未確認だが機能は完全にサポート済み（単体テスト・obs-e2e あり）。I-06 は無条件に実施する。使っていれば CALENDAR-006 の主因、使っていなくても潜在バグの予防として価値がある。ただし完了後の確認事項が残る（本文4章参照）。

## 2. Objective（目的）

`@repeat` タスクのオカレンス ID（`__r<n>` サフィックス）が原因で「カードクリックで該当行に移動しない」不具合を解消する。同時に、遷移経路とは異なり、書き戻し経路ではオカレンス ID を安全側（拒否）で扱い、データ破壊を防ぐ。

## 3. Scope（スコープ）

- `stripOccurrenceSuffix()` の新設と、遷移経路（`navigateToNode`）への適用
- 書き戻し経路（`resolveRef` / `patchInFile`）でのオカレンス ID 明示的拒否
- `parseGlobalKey` 自体の変更は行わない

## 4. Implementation requirements（実装要件）

1. `src/lib/viewmodel/global-key.ts` に `stripOccurrenceSuffix(localId: string): string` を新設する（末尾の `__r<数字>` を除去）。**`parseGlobalKey` の意味は変更しない**
2. `ShadowItemView.navigateToNode` が `localId` にこれを適用する
3. `src/lib/viewmodel/resolve.ts` の `resolveRef` / `patchInFile` は、オカレンス ID を検出したら**明示的に拒否する**（無言 `return` のままにせず、呼び出し元が判別できる形にする）
4. 契約注釈 A-10 の解釈を「ホストの書き戻しはオカレンス ID を受け付けない」と確定し、Spec への追記要否を DEC-06 の手順（issue-phase010-markdownEditor-006__section-meta-close-memo.md 参照）で判断する

## 5. Files / components likely to be changed（変更が見込まれるファイル／コンポーネント）

- `src/lib/viewmodel/global-key.ts`（`stripOccurrenceSuffix` 新設）
- `src/views/ShadowItemView.ts`（`navigateToNode`）
- `src/lib/viewmodel/resolve.ts`（`resolveRef` / `patchInFile`）
- `src/lib/calendar/ast-to-calendar.ts`（参照のみ、変更不要と見込まれるが確認すること）
- `src/lib/gantt/ast-to-gantt.ts`（参照のみ）

## 6. Dependencies（依存関係）

- 先行 Issue: なし（Phase 1・依存なし。並行可）
- 他リポジトリの preIssue をここで巻き取る: **CALENDAR-006**（calendar リポジトリ側の作業ではない。CALENDAR-006「カードをクリックしても該当行に移動しない場合がある」の修正は本 issue（markdownEditor 側の ID 正規化）で完結し、calendar リポジトリ側に必要な作業は無い）
- 後続: 本 issue 完了後も「`@repeat` を持たないタスクでカードクリックが効かない」が再現する場合のみ、calendar リポジトリ側で I-11b（条件起動・issue 化は条件成立後）を起票する。本 issue 単体では I-11b は起票しない

## 7. Acceptance criteria（受け入れ基準）

- `stripOccurrenceSuffix('s1.n2__r3') === 's1.n2'` ／ `stripOccurrenceSuffix('s1.n2') === 's1.n2'`
- `navigateToNode` が `__r` 付き globalKey で正しい行へ遷移する
- **書き戻し経路がオカレンス ID を拒否する**（これが無いとデータ破壊が再発する。必須）
- `@repeat` を持たないタスクの遷移・書き戻しが従来どおり動く（回帰確認）

## 8. Test requirements（テスト要件）

- `stripOccurrenceSuffix` の単体テスト（上記の入出力例を含む）
- `navigateToNode` が `__r` 付き globalKey で正しい行へ遷移することを確認するテスト
- 書き戻し経路がオカレンス ID を拒否することを確認する**必須**テスト（データ破壊防止の要）
- `@repeat` を持たないタスクでの遷移・書き戻しの回帰テスト

## 9. Out of scope（対象外）

- `parseGlobalKey` 自体の変更（意味を変えない。DEC-03 により明示的に禁止）
- **完了後に「`@repeat` を持たないタスクでも再現するか」の確認と、再現時の calendar 側 I-11b 起票は本 issue の対象外**（DEC-24 により、`__r` 修正だけで「CALENDAR-006 解決」と宣言しないこと。これは別途フォローアップとして扱う）
- ガントで `@repeat` タスクが一切表示されない問題（`viewRange: undefined` に起因）への対応は、gantt 可視性述語の拡張 issue（issue-phase010-markdownEditor-008__gantt-visibility-predicate-extension.md）着手時に方針決定する。本 issue では扱わない

## Progress & Implementation Notes

### History

#### 2026-09-22

- User Instruction:
  - project/governance のルールに従い、issue-phase010 シリーズを順番にすべて実装する

- Change:
  - `src/lib/viewmodel/global-key.ts` に `stripOccurrenceSuffix(localId: string): string` を新設した（`localId.replace(/__r\d+$/, '')`）。`parseGlobalKey` 自体は変更していない
  - `src/views/ShadowItemView.ts` の `navigateToNode` で `doc.nodeLineMap.get(localId)` を `doc.nodeLineMap.get(stripOccurrenceSuffix(localId))` に変更した
  - `src/lib/viewmodel/resolve.ts` に `OccurrenceIdRejectedError` を新設し、`resolveRef` / `patchInFile` の冒頭で `assertNotOccurrenceId(localId)` を呼び、オカレンスID検出時に例外を投げるようにした（無言の `undefined` 返却のままにしない）
  - `src/views/ShadowItemView.ts` の `onNodePatch` で `patchInFile` を try/catch し、`OccurrenceIdRejectedError` を捕捉した場合は `Notice` でユーザーに通知して `return` する（呼び出し元が判別できる形にした）
  - `src/lib/calendar/ast-to-calendar.ts` / `src/lib/gantt/ast-to-gantt.ts` は参照のみで変更不要と確認した（`__r` 付与元であり、書き換え対象ではない）

- Rationale:
  - DEC-03 に従い、遷移経路（`navigateToNode`）はオカレンスIDのサフィックスを剥がして解決し、書き戻し経路（`resolveRef`/`patchInFile`）は明示的に拒否することで、サイレントなデータ破壊を防いだ
  - `parseGlobalKey` 自体の意味は変更していない（`stripOccurrenceSuffix` は遷移経路専用の別関数として新設）

- Verification:
  - 単体テスト新設: `src/lib/viewmodel/global-key.test.ts`（`stripOccurrenceSuffix` 4件）、`src/lib/viewmodel/resolve.test.ts`（`resolveRef`/`patchInFile` のオカレンスID拒否 2件）、`src/views/ShadowItemView.test.ts`（`navigateToNode` が `__r` 付き/なし双方で正しい行へ遷移することを確認する2件）
  - `npx vitest run` → 22 test files / 476 tests すべて成功
  - `npx tsc --noEmit` → 変更ファイル（global-key.ts / resolve.ts / ShadowItemView.ts）に起因する型エラーなし（既存の無関係なエラーのみ残存。変更前から存在することを確認済み）
  - `node esbuild.config.mjs production` → ビルド成功

- Status: 実装完了。ユーザーの明示的な承認待ちのため Issue は Open のまま（WORKFLOW.md §6）。

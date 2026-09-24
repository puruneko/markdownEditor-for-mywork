# markdownEditor リポジトリ 共通情報（issue-phase010-markdownEditor シリーズの前提）

このファイルは `issue-phase010-markdownEditor-001` 〜 `008` に共通する背景情報・確定事項・他リポジトリとの関係をまとめたものである。**各Issueファイルは単体でも実装に着手できるよう必要な情報を本文中に転記済みであり、本ファイルの参照は必須ではない。** 本ファイルは、複数Issueにまたがる情報の俯瞰・突き合わせに使うための補助資料である。

---

## 1. このリポジトリの位置づけ・責務境界

**markdownEditor（`md-ast-editor`、Obsidian 拡張機能本体）は、システムの中枢である。** calendar / gantt / kanban / dashboard の4サブライブラリを `file:` 依存で取り込む唯一のホストであり、Markdown パース・各ライブラリ向け投影・クリック遷移・書き戻し・設定・テーマの配線をすべて担う。

**このリポジトリの実作業量は、割り当てられた preIssue の件数（MARKDOWN 6件）が示唆するより大幅に多い。** 他リポジトリ（calendar/gantt/kanban/dashboard）に割り当てられていた preIssue のうち、以下は実際にはこのリポジトリでの作業である。

| 元の preIssue | 対応する本リポジトリの Issue |
|---|---|
| COMMON-001（全リポジトリ分のテーマ対応） | `issue-phase010-markdownEditor-002__shadow-theme-lockdown-light.md` |
| CALENDAR-006（カードクリックで該当行に移動しない場合がある） | `issue-phase010-markdownEditor-003__occurrence-id-normalization-guard.md` |
| CALENDAR-005 / CALENDAR-007、KANBAN-001 / KANBAN-003 の設定保存 | `issue-phase010-markdownEditor-005__settings-hub.md` |
| GANTT-007（タスクが無くても日付メタがあればチャート表示） | `issue-phase010-markdownEditor-008__gantt-visibility-predicate-extension.md` |
| GANTT-009（クローズ案件の除外） | `issue-phase010-markdownEditor-007__closed-project-projection-filter.md` |

**スコープ外の混同注意（着手前に必読）**: `src/app.css` / `src/main.ts` / `src/App.svelte` / `src/lib/editor/EditorLayout.svelte` / `MonacoEditor.svelte` は `vite.config.ts` でビルドされる**開発用の単体 Web アプリ**であり、Obsidian プラグイン本体（ルート `main.ts` → `src/plugin.ts`、`esbuild.config.mjs` → `main.js`）からは一切参照されない。この開発用 Web アプリのスタイル（例: `app.css` の `background: #1e1e1e` 等の濃色）は、本シリーズのどの Issue の対象にもならない。

---

## 2. 適用される確定事項（DEC）一覧

以下は、本リポジトリのいずれかの Issue が前提とする確定事項（DEC）の全文である。各 Issue 本文にも該当する DEC は個別に転記済みだが、ここに一覧としてまとめることで Issue 間の関係を俯瞰できるようにする。

### DEC-01（テーマ方針＝遮断。追従はしない）
`修正したい箇所.md` の入力が「開発工数が少なくて済む場合はテーマに合わせ、大規模になる場合はテーマには合わせず…白基調のままで OK」と判断基準を先に与えている。テーマ追従はコストが大規模（calendar 219件 + gantt 216件 = 435件のトークン化が必要と見積もられている）と分析されており、この基準を代入すると「遮断」で一意に決まる。→ `issue-phase010-markdownEditor-002__shadow-theme-lockdown-light.md`

### DEC-02（`:host` の継承プロパティ固定で一括解決する）
Shadow DOM が遮断するのは**セレクタのマッチだけ**であり、`color` / `font-size` / `line-height` / `letter-spacing` などの**継承プロパティは境界を貫通する**。`:host` へ継承プロパティを白基調で固定すれば、現在および将来の該当箇所がまとめて塞がる。「どこが見えないか」の個別特定は行わない方針。→ `issue-phase010-markdownEditor-002__shadow-theme-lockdown-light.md`

### DEC-03（`__r<n>` の扱い: 遷移は剥がす／書き戻しは拒否する。`parseGlobalKey` 自体は変更しない）
`CalendarTab.handleItemMove` / `handleItemResizeEnd` は `onNodePatch(item.id, ...)` に `__r` 付き ID を渡し `patchScheduleForNode` で `@schedule` 行を書き換える。現状は `findNodeById` が `undefined` を返して無反応だが、`parseGlobalKey` を一律に変えると `@repeat` の4回目のオカレンスを少しドラッグしただけでベースの `@schedule` が書き換わり、全オカレンスが一斉にずれる。サイレントな無反応 → サイレントなデータ破壊への悪化になるため、`stripOccurrenceSuffix()` を新設し遷移経路だけが使う。→ `issue-phase010-markdownEditor-003__occurrence-id-normalization-guard.md`

### DEC-04（「案件直下のメタ情報」の範囲）
見出し行の直後から、次の見出しまたは非リストブロックが現れるまでの**トップレベルリスト項目** `- @key: value`。製品全体のメタ記法が `- @key: value` のリスト項目で統一されており、「案件直下」を素直に読めばこれ以外の解釈が無い。`# 案件名 #close` のタグはタイトル文字列末尾のタグとして分離する。→ `issue-phase010-markdownEditor-006__section-meta-close-memo.md`

### DEC-05（`close` の消費はホスト投影の手前で一括除外する。ライブラリ側は無変更）
各ライブラリに `close` を渡して個別に除外させると `close` の解釈が4通りに分裂する。ホストに `filterClosedProjects(sources)` を1つ置き、全投影がその出力を使う。→ `issue-phase010-markdownEditor-007__closed-project-projection-filter.md`

### DEC-06（契約改訂の運用）
パーサ変更の実装者が、同一コミットで (1) パーサ単体テスト (2) `external-data-contract.spec.md` の BR 追記（既存最大+1 で採番、番号の再利用禁止） の2点を必ず更新する。契約 §10 が「実装が変わったら Spec も同時に更新」「BR 番号は再利用禁止」を定めている。**加えて、契約変更は dashboard リポジトリ側の複製型（`contract.ts`）とのドリフトを生じさせるため、dashboard 側への追随更新の伝達が必要**（dashboard 側の追随更新自体は別リポジトリでの対応であり、本リポジトリの Issue のクローズ条件には含まれない）。→ `issue-phase010-markdownEditor-006__section-meta-close-memo.md`

### DEC-14（list 由来ノードは既存の `type: 'subsection'` のまま出す。新種別は作らない）
`extractFromNodes` の `list` 分岐は既に `type: 'subsection'` で `GanttNode` を生成している。可視性の述語を緩めるだけで済み、task 固有の見た目（種別アイコン・リサイズハンドル）は付かない。→ `issue-phase010-markdownEditor-008__gantt-visibility-predicate-extension.md`

### DEC-24（`__r` 修正だけで「CALENDAR-006 解決」と宣言しない）
`@repeat` の使用実態は未確認だが機能は完全にサポート済み（単体テスト・obs-e2e あり）。オカレンスID正規化は無条件に実施する。使っていれば CALENDAR-006 の主因、使っていなくても潜在バグの予防として価値がある。ただし、完了後に「`@repeat` を持たないタスクでも再現するか」の確認が別途必要（本リポジトリの Issue の対象外。再現時は calendar リポジトリ側で追加調査が必要）。→ `issue-phase010-markdownEditor-003__occurrence-id-normalization-guard.md`

---

## 3. このリポジトリの Issue 一覧（インデックス）

| # | ファイル | タイトル | Phase | 本リポジトリ内の依存関係 |
|---|---|---|---|---|
| 1 | `issue-phase010-markdownEditor-001__remove-agenda-health-tray.md` | アジェンダ／ヘルスチェック／トレイの廃止 | 1 | 依存なし（最初に実施） |
| 2 | `issue-phase010-markdownEditor-002__shadow-theme-lockdown-light.md` | Shadow ビューへの Obsidian テーマ遮断 | 1 | 依存なし |
| 3 | `issue-phase010-markdownEditor-003__occurrence-id-normalization-guard.md` | オカレンス ID 正規化＋書き戻しガード | 1 | 依存なし（002/004と並行可） |
| 4 | `issue-phase010-markdownEditor-004__meta-key-checklist-doc.md` | 新メタキー追加時の5ファイル チェックリスト整備 | 1 | 依存なし（003と並行可）。006の**着手前に必須** |
| 5 | `issue-phase010-markdownEditor-005__settings-hub.md` | 設定ハブ（保存/読込/配布の配線） | 2 | 依存なし。他Issue（calendar/kanbanの設定系）のブロッカー |
| 6 | `issue-phase010-markdownEditor-006__section-meta-close-memo.md` | Section メタ経路の新設＋`@close`/`#close`/`@memo` | 3 | 002・004 完了後 |
| 7 | `issue-phase010-markdownEditor-007__closed-project-projection-filter.md` | クローズ案件の投影前フィルタ | 3 | 006 完了後 |
| 8 | `issue-phase010-markdownEditor-008__gantt-visibility-predicate-extension.md` | gantt 投影の可視性述語の拡張 | 3 | 006 完了後 |

実装順序の概略: `001 → 002 →（003・004 並行可）→ 005 → 006 →（007・008）`

---

## 4. 他リポジトリとの関係

### 4.1 このリポジトリの成果を前提にする他リポジトリの機能（＝他リポジトリ側のブロッカー）

- **calendar リポジトリ**: 『月表示タスク時間トグル』『イベント名のタスク名／親階層名切替』の各機能は、本リポジトリの`issue-phase010-markdownEditor-005__settings-hub.md`（設定ハブ）が提供する永続化基盤を前提とする。この基盤ができるまで、calendar 側は独自の永続化（`localStorage` への項目追加等）を行ってはならない。
- **kanban リポジトリ**: 『ステータス表示の共通ヘッダー化・レイアウト切替』『レーンの最小化』の各機能は、同じく設定ハブを永続化の基盤として前提とする。また、これらの機能は本リポジトリの `issue-phase010-markdownEditor-002__shadow-theme-lockdown-light.md` によって `config.theme = 'light'` が渡されるようになることも前提にしている（kanban 側のコード変更は発生しない）。
- **dashboard リポジトリ**: 『StatusBadge 固定幅化』等の機能は、本リポジトリの `issue-phase010-markdownEditor-002__shadow-theme-lockdown-light.md` によってテーマが `light` 固定で渡されることを前提とする（dashboard 側のコード変更は発生しない）。また、`issue-phase010-markdownEditor-006__section-meta-close-memo.md` で `Section` 型に `meta` フィールドが追加された場合、dashboard リポジトリは自身が保持する契約複製型（`contract.ts`）と契約検証テストを追随更新する必要がある（DEC-06。dashboard 側の対応は別リポジトリでの作業であり、本リポジトリの Issue のクローズ条件には含まれない）。

### 4.2 このリポジトリの作業が他リポジトリの成果に依存する箇所

**依存なし。** markdownEditor はホストであり、他リポジトリ（calendar/gantt/kanban/dashboard）の成果物の完成を前提にしている Issue は本シリーズには無い。

---

*このファイルは issue-phase010-markdownEditor シリーズの一部として、同シリーズの他ファイルと共に本リポジトリへ配置される想定である。*

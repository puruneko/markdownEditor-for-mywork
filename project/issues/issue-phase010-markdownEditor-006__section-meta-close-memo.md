# Section メタ経路の新設＋`@close`／`#close`／`@memo`（元ID: I-07 ／ 対応 preIssue: MARKDOWN-002 + MARKDOWN-005 + MARKDOWN-006 ／ Phase: 3）

## 1. Background（背景）

`修正したい箇所.md` の markdownEditor 節より:
- 「案件直下のメタ情報に@closeがある場合、案件全体がクローズしたとみなして。案件名の行に#closeタグがついている場合は、メタ情報@closeがあるとみなして。（例）# 案件名 #close。クローズ案件はmdパース結果から除外はせず、案件のオブジェクトに新しくTF値のcloseプロパティを作成し、trueを指定することで案件がクローズしたことを表して。」（MARKDOWN-002）
- 「heading、タスクの直配下の引用「＞」は、メタ情報「@memo」として扱って」（MARKDOWN-005）

MARKDOWN-006（メタ処理の統一）は前提整備として issue-phase010-markdownEditor-004__meta-key-checklist-doc.md（I-23）で扱われており、本 issue では「I-23 のチェックリストに従い5ファイルを確認する」作業として含まれる。

**絶対に分割してはならない**: MARKDOWN-002（`@close`）と MARKDOWN-005（`@memo`）は**同一の基盤（`Section` へのメタ格納経路）の上に乗る**。別々に設計すると同じ問題を2回解くことになる。

**適用 DEC-04（「案件直下のメタ情報」の範囲）**: 見出し行の直後から、次の見出しまたは非リストブロックが現れるまでの**トップレベルリスト項目** `- @key: value`。製品全体のメタ記法が `- @key: value` のリスト項目で統一されており、「案件直下」を素直に読めばこれ以外の解釈が無い。`# 案件名 #close` のタグはタイトル文字列末尾のタグとして分離する（現状は `Section.title === "案件A #close"` とタイトルに残る）。

**適用 DEC-06（契約改訂の運用）**: パーサ変更の実装者が、同一コミットで (1) パーサ単体テスト (2) `external-data-contract.spec.md` の BR 追記（既存最大+1 で採番、番号の再利用禁止） (3) dashboard の複製型 `contract.ts` と `tests/unit` の契約検証 — の3点を更新する。契約 §10 が「実装が変わったら Spec も同時に更新」「BR 番号は再利用禁止」を定めている。担当を分けるとドリフトする。この3点で1つの作業単位とする。

**現状の実測結果（issue 本文に転記済み）**: 次の入力で `parseMarkdown()` を実行した結果

```markdown
# 案件A #close
- @close:
- @purpose: テスト
- [>] タスク1
  - @schedule: 2026-09-20T10:00/2026-09-20T11:00
  - @close:
  > メモ本文
- 普通のリスト
  - @due: 2026-09-30
```

| 入力行 | 結果 | 判定 |
|---|---|---|
| `# 案件A #close` | `Section.title === "案件A #close"` | **`#close` は分離されずタイトルに残る** |
| 見出し直下 `- @close:` | `ListNode { text: "@close:", isMemo: true }` として**残存** | メタにならない。消えもしない |
| 見出し直下 `- @purpose: テスト` | 同様に `ListNode` として残存 | **見出し直下のメタは種類を問わず一切機能しない** |
| タスク配下 `- @schedule: …` | `meta.schedule` に格納 | 正常 |
| タスク配下 `- @close:` | **ノードごと消滅し、メタにもならない** | **未知キーの静かな消失** |
| タスク配下 `> メモ本文` | `QuoteNode { raw: "メモ本文", isMemo: true }` | 独立ノードとして子に入る |
| `- 普通のリスト` + 子 `- @due:` | `ListNode.meta.due = "2026-09-30"` | リスト項目のメタは既に機能している |

**原因（確認済み）**:
- `src/lib/parser/plugins/remark-meta-fields.ts` の `visit(tree, 'listItem', ...)` — メタ抽出は「**リスト項目の子リスト**」に対してのみ走る。見出し直下のトップレベルリストは `listItem` の子ではないため対象外
- `src/lib/parser/types.ts` の `Section` 型に `meta` フィールドが**存在しない**（`type/id/depth/title/lineNumber/parentSectionId/children/subSections` のみ）
- **未知キーの消失機構**: `extractMetaFromList` は `META_LINE_RE` にマッチした時点で `kept` に積まず、`applyMetaKey` の `switch` に該当 `case` が無ければ**何もせず捨てる**。`normalizeMetaKey('close')` は `null` を返し `?? rawKey` で `'close'` になるが、`switch` に `close` が無いため無反応 → **エラーにならずデータが消える**

## 2. Objective（目的）

見出し（H1等）直下のトップレベルメタ情報（`@close` 等）を正しく解析可能にし、`#close` タグと `@close` を案件のクローズ状態として `Section` オブジェクトに反映する。また、見出し・タスク直下の引用（`>`）を `@memo` メタとして扱う。

## 3. Scope（スコープ）

- `Section` 型へのメタ格納先追加
- 見出し直下トップレベルリストからのメタ抽出パス新設
- 見出しタイトルの `#close` タグ抽出
- `close` を真偽値プロパティとして持たせる（パース結果からの除外はしない）
- `@memo`（見出し直下・タスク直下の blockquote）の `meta.memo` への格納
- I-23（issue-phase010-markdownEditor-004__meta-key-checklist-doc.md）のチェックリストに従った5ファイルの確認
- 契約改訂（DEC-06）: 本リポジトリ内での契約 Spec の BR 追記とパーサ単体テストの更新。**dashboard リポジトリ側の複製型・契約検証テストの追随更新は別リポジトリでの対応であり、本 issue の実装範囲・クローズ条件には含まない**（詳細は Dependencies 節）

## 4. Implementation requirements（実装要件）

- **誤実装の防止（必ず転記）**: ❌ **`META_KEYS` に `close` を足して `applyMetaKey` に `case` を追加するだけでは要件を満たさない。** それで拾えるのは「リスト項目配下の `@close`」のみで、案件（H1）直下では依然としてメタ化されない
- **変更内容**:
  1. **`Section` 型にメタの格納先を追加する**（`meta?: SectionMeta`）
  2. **見出し直下のトップレベルリストからメタを抽出する新規パスを追加する。** 対象範囲は **DEC-04**: 見出し行の直後から、次の見出しまたは非リストブロックが現れるまでのトップレベルリスト項目 `- @key: value`
  3. **見出しタイトルからの `#close` タグ抽出**（`Section.title` の末尾タグを分離し、`#close` があれば `@close` と同等に扱う）
  4. **`close` を真偽値プロパティとして案件オブジェクトに持たせる。** 入力の要件どおり**パース結果から除外はしない**
  5. **`@memo`**: 見出し直下・タスク直下の blockquote を `meta.memo` として扱う。**「直下の blockquote を検出する」ロジックは両方すでにある**（`mdast-to-nodes.ts` の `convertBlockChildren()` がタスク直下、`convertSectionContent()` が**見出し直下**）。現状はそれを独立した `QuoteNode` として兄弟位置に置いている
  6. **`QuoteNode` は廃止せず併存させる**（初期値）。**`ast-to-md.ts:63` が quote を特別扱いして Markdown へ書き戻している**ため、廃止は書き戻しテストが揃ってから別 issue で判断する。`QuoteNode` は Gantt/Calendar/クエリフィルタで軒並み `continue` でスキップされ、Kanban だけが `ast-to-kanban.ts` の `extractDescription()` で拾っている
  7. **I-23 のチェックリストに従い、5ファイルすべてを確認する**
- **契約改訂（DEC-06。必須）**: `Section` 型の変更は BR-010 の改訂にあたる。本 issue のスコープ内で、**同一コミットで** (1) パーサ単体テスト (2) `documents/external-data-contract.spec.md` の BR 追記（既存最大+1 で採番。番号の再利用禁止） — の2点を必ず更新する。**加えて、この契約変更は dashboard リポジトリ側の複製型（`contract.ts`）と契約検証テスト（`tests/unit`）にドリフト（本体と複製の乖離）を生じさせる。dashboard リポジトリ側の追随更新は別リポジトリでの対応となるため本 issue のクローズ条件には含めないが、実装者は本 issue の完了時点で「`Section` 型に `meta?: SectionMeta` フィールドを追加した」という契約変更の事実を dashboard リポジトリ側の担当に伝達し、追随更新を依頼すること**
- **新規ロジックの設計方針**: **Section メタ抽出・`#close` タグ分離は純粋関数として書き、コンポーネント/プラグインは配線だけにする**

## 5. Files / components likely to be changed（変更が見込まれるファイル／コンポーネント）

- `src/lib/parser/types.ts`（`Section` 型に `meta?: SectionMeta` を追加）
- `src/lib/parser/plugins/remark-meta-fields.ts`（見出し直下トップレベルリストの抽出パス新設）
- `src/lib/parser/mdast-to-nodes.ts`（`convertBlockChildren()` / `convertSectionContent()` の blockquote 処理）
- `src/lib/parser/ast-to-md.ts`（書き戻し。`QuoteNode` の特別扱いは変更しない・回帰確認）
- `documents/external-data-contract.spec.md`（BR 追記）
- `src/lib/parser/parse-markdown.test.ts`（フィクスチャ追加）
- I-23 のチェックリスト対象5ファイル: `src/lib/parser/plugins/remark-meta-fields.ts`, `src/editor/task-decoration.ts`, `src/editor/metatag-decoration.ts`, `src/editor/notation-lint.ts`, `src/editor/reformat-meta-lines.ts`

## 6. Dependencies（依存関係）

- 先行 Issue: issue-phase010-markdownEditor-002__shadow-theme-lockdown-light.md（I-02）、issue-phase010-markdownEditor-004__meta-key-checklist-doc.md（I-23）— **両方の完了後に着手すること（Phase 3）**
- 後続 Issue: issue-phase010-markdownEditor-007__closed-project-projection-filter.md（I-17）、issue-phase010-markdownEditor-008__gantt-visibility-predicate-extension.md（I-20）はいずれも本 issue の完了後に着手する
- **他リポジトリへの影響（本 issue の実装範囲・クローズ条件には含まれないが、契約変更に伴い必ず発生する）**: `Section` 型への `meta` フィールド追加は `external-data-contract.spec.md` の BR 改訂にあたる。dashboard リポジトリは契約型を独自に複製しており（`src/lib/models/contract.ts`）、契約変更のたびに複製型とその契約検証テスト（`tests/unit`）を追随更新しないとドリフト（本体と複製の乖離）が発生する。**本 issue の完了後、速やかに dashboard リポジトリ側で複製型と契約検証テストの追随更新を行う必要がある**（実装者は契約変更の事実を dashboard 側の担当に伝達すること）

## 7. Acceptance criteria（受け入れ基準）

- 上記の実測入力をそのままフィクスチャとして `src/lib/parser/parse-markdown.test.ts` に追加し、**変更後の期待値**を固定する
- `# 案件名 #close` で `Section` の `close` が `true` になり、**かつタイトルから `#close` が除去されている**
- 見出し直下の `- @close:` / `- @purpose:` がメタとして格納される
- タスク配下の `- @close:` が**消えずに**メタとして格納される
- 見出し直下・タスク直下の `> 引用` が `meta.memo` として取得できる
- 書き戻し（`ast-to-md.ts`）で quote が従来どおり復元される（回帰）

## 8. Test requirements（テスト要件）

- `src/lib/parser/parse-markdown.test.ts` に上記実測入力のフィクスチャと期待値を追加する
- パーサ単体テスト（DEC-06 の3点セットの1つ）
- dashboard 側 `tests/unit` の契約検証テストの更新（DEC-06 の3点セットの1つ）
- 書き戻しの回帰テスト（quote が従来どおり復元されること）

## 9. Out of scope（対象外）

- `QuoteNode` の廃止（本 issue では併存させる。廃止は書き戻しテストが揃ってから別 issue で判断する）
- 統一メタキーレジストリの実装（I-23 の対象外事項と同様、本 issue でも行わない）

## Progress & Implementation Notes

### History

#### 2026-09-22

- User Instruction:
  - project/governance のルールに従い、issue-phase010 シリーズを順番にすべて実装する

- Change:
  - `src/lib/contract/canonical.ts`: `META_KEYS` に `close` を追加。`Meta` 型に `close?: boolean`（値の内容に関わらずキーの存在が true）と `memo?: string`（直下引用からの派生値。`@memo:` リスト項目記法では設定されない）を追加
  - `src/lib/parser/plugins/remark-meta-fields.ts`: `applyMetaKey` の `switch` に `case META_KEYS.close: meta.close = true` を追加。`extractMetaFromList` を export し、セクションレベルでも再利用可能にした
  - `src/lib/parser/types.ts`: `SectionMeta`（`Omit<Meta, 'close'>`）を新設。`Section` 型に `close: boolean`（必須。デフォルト false）と `meta?: SectionMeta` を追加
  - `src/lib/parser/mdast-to-nodes.ts`: `convertBlockChildren` / `convertSectionContent` の戻り値を `Node[]` から `{ nodes: Node[]; memo?: string }` に変更し、直下の引用（`>`）本文を `memo` として返すようにした（`QuoteNode` の生成は従来どおり維持・併存）。`convertListItem` で `item.data?.meta` と `memo` をマージして最終的な `meta` を構築するようにした
  - `src/lib/parser/mdast-to-sections.ts`: 見出しタイトル末尾の `#tag` 抽出（`splitTitleTags`）、見出し直下のトップレベルメタ抽出（`extractLeadingSectionMeta`。DEC-04 の範囲＝次の見出しまたは非リストブロックが現れるまでのトップレベルリスト項目に、`extractMetaFromList` を適用）、これらを束ねる `buildSectionContent` を新設。3箇所の `Section` 生成箇所（匿名セクション・先頭見出し前・各見出し）すべてに適用した。`close` はタイトルタグまたは抽出メタの `close` のいずれかが true なら true、それ以外は false（必須フィールドとして必ず存在）
  - **誤実装の防止を回避**: `META_KEYS` に `close` の `case` を追加するだけでは満たされない要件（見出し直下のメタ化）を、`extractLeadingSectionMeta` という別経路で満たした（Issue 本文で明示的に警告されていた誤実装パターンを回避）
  - `documents/external-data-contract.spec.md`（DEC-06 契約改訂）: BR-073〜BR-077 を追記（既存最大 BR-072 の次番号から採番。番号の再利用なし）。BR-073（Section.close/meta の構造）、BR-074（タイトルタグ除去）、BR-075（見出し直下メタの抽出範囲）、BR-076（Meta.close）、BR-077（Meta.memo）。注釈 A-13 を追加し、§10 の注釈範囲表記（A-01〜A-13）と §9 検証方法の BR範囲対応表も更新した
  - `documents/meta-key-checklist.md`（I-23 チェックリスト。issue-phase010-markdownEditor-004 で新設したドキュメント）を更新し、`close` を正規カノニカルキー一覧に追加、`memo` が `META_KEYS` 対象外であることを明記した
  - 単体テスト新設: `src/lib/parser/parse-markdown.test.ts` に Issue 本文の実測入力をそのままフィクスチャとして追加し、10件のテストケース（`#close` タグ分離、見出し直下 `@close`/`@purpose` の格納、タスク配下 `@close` の非消失、`@memo`（直下引用）の格納と `QuoteNode` 併存、既存メタ（`@schedule`/`@due`）の回帰、close なし見出しの `false`、匿名セクションの `false`、meta 無しの省略、close 以外のタグの非影響）を追加
  - `src/lib/parser/ast-to-md.test.ts`: `Section` 型に `close: boolean` が必須化されたことに伴い、既存の2箇所のテスト用 `Section` オブジェクトリテラルに `close: false` を追加（型エラー修正のみ。挙動は無変更）

- Rationale:
  - DEC-04（案件直下のメタ情報の範囲）、DEC-06（契約改訂の運用）に厳密に従った
  - `memo` を `- @memo:` リスト項目記法として扱わなかった理由: Objective は「引用（`>`）を @memo として扱う」ことを求めており、リスト項目記法での明示的な `@memo:` は要求されていない。誤って両対応すると、直下引用と `- @memo:` の二重管理・書き戻し時の重複（`serializeMeta` が `meta.memo` を書き出すと `QuoteNode` の書き戻しと重複する）を招くため、意図的にスコープを引用のみに限定した
  - `serializeMeta`（`ast-to-md.ts`）に `close`/`memo` の書き出しを追加しなかった理由: (1) `memo` を書き出すと `QuoteNode` の書き戻しと内容が重複する（データ重複というバグになる）。(2) `close`（タスク/リストレベル）については、`serializeAst`/`ast-to-md.ts` はスタンドアロン開発用 Web アプリ（`EditorLayout.svelte`）専用の経路であり、Obsidian プラグイン本体の実際の書き戻しは行単位パッチ（`patchScheduleForNode` 等）で行われるため、要件・受け入れ基準のいずれにも書き戻し対応は含まれていない。過剰実装を避けるため据え置いた
  - 「見出し直下のトップレベルメタ抽出」は匿名セクション（見出しなし）にも一律適用した。DEC-04 の文言は見出しを前提にしているが、実装を分岐させる理由がなく、単一のコードパスの方が保守性が高いと判断した（注釈 A-13 として契約に明記）

- Verification:
  - `npx vitest run` → 24 test files / 491 tests すべて成功（新設10件含む）
  - `npx tsc --noEmit` → 変更ファイルに起因する新規の型エラーなし。`ast-to-md.test.ts` に残る3件の型エラーは本 issue 着手前から存在した無関係な既存バグ（task ノードの `lineNumber` 欠落）であることを確認済み
  - `node esbuild.config.mjs production` → ビルド成功

- **重要（本 issue のクローズ条件には含まれないが、DEC-06 により必須の伝達事項）**: `Section` 型に `meta?: SectionMeta` と `close: boolean` を追加した。この契約変更は dashboard リポジトリ側の複製型（`src/lib/models/contract.ts`）と契約検証テスト（`tests/unit`）にドリフトを生じさせる。**dashboard リポジトリ側の担当者へ、この契約変更（`Section.close`・`Section.meta` の追加、BR-073〜BR-077）を伝達し、追随更新を依頼する必要がある。** 本セッションでは別リポジトリへの作業はできないため、ユーザーへの報告を通じて伝達する。

- Status: 実装完了。ユーザーの明示的な承認待ちのため Issue は Open のまま（WORKFLOW.md §6）。

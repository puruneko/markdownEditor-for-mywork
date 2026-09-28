# 前文（最初の見出しより前の内容）を持つファイルで、匿名セクションが全ての見出しを入れ子にしてしまう問題の修正

## 1. Problem & Direction  — FOR HUMANS

### この Issue が解決すること

要望元: dashboard-for-mywork（`issue-phase015-dashboard-007__preamble-file-project-split`）。dashboard から本リポジトリへの変更要望書 `dashboard-for-mywork/project/instructions/request-markdownEditor__preamble-heading-nesting.md` として提出された。

現象: 最初の見出しより前に内容（以下「前文」）がある Markdown ファイルでは、`buildSectionsFromRoot`（`src/lib/parser/mdast-to-sections.ts`）が出力する `Document.sections` が匿名セクション（`section-0`、`depth: 0`）1個だけになり、全ての見出し（H1 を含む）がその匿名セクションの `subSections` の中に入れ子になる。

再現用 Markdown:

```markdown
- [ ] 前文のタスク

# 案件A
## 案件概要
- 期限：2099-12-31
## 見出しA
- [ ] Aのタスク

# 案件B
- [ ] Bのタスク
```

現在の出力（要点のみ）:

```text
sections = [
  section-0 (depth 0, title '', lineNumber -1)
    children: [前文のタスク]
    subSections: [
      section-1 案件A (depth 1, parentSectionId 'section-0')
        subSections: [section-2 案件概要, section-3 見出しA]
      section-4 案件B (depth 1, parentSectionId 'section-0')
    ]
]
```

前文が無いファイルでは、H1 は `sections` の最上位に兄弟として並ぶ。前文の有無だけで、H1 の位置（最上位か、匿名セクションの子か）が変わってしまっている。

原因（root cause）: `nestSections`（`src/lib/parser/mdast-to-sections.ts:101-120`）は、スタックの先頭のセクションの `depth` が新しいセクションの `depth` 以上になるまでポップしてから、新しいセクションをスタック先頭の子にする（100行目以降のループ）。匿名セクションの `depth` は 0 であり、全ての見出しの `depth`（1〜6）より小さいため、匿名セクションがスタックに積まれると、以降に来る全ての見出しがその子になってしまう。

連携アプリで起きている問題（参考情報。本 Issue のスコープはホスト側の修正のみ）:

- dashboard-for-mywork: 案件を `sections` の最上位要素ごとに分けるため、前文を持つファイルは H1 がいくつあっても1案件（案件名はファイル名）になり、H1 の「案件概要」の期限が認識されない。
- ganttchart-for-mywork: 匿名セクションが名前の無い `section` ノードとして最上位に出力され、H1（`project`）がその子になり、表示上の階層が1段深くなる。

データ契約（`documents/external-data-contract.spec.md`）BR-015 は「連携アプリは、`title` が空文字のセクションを、表示上の階層として扱ってはならない」と定めている。匿名セクションが見出しの親になる現在の形状は、この規則と整合しない。

### Direction

- 匿名セクション（`section-0`）は `sections` の最上位に置き、見出しを子にしてはならない。前文の後の見出しは、前文が無いファイルと同じ規則で入れ子にしなければならない。
- 修正は `nestSections`（`src/lib/parser/mdast-to-sections.ts:101-120`）に限定する。`buildSectionsFromRoot` の他の部分（匿名セクションの生成条件・見出しの分割・id 採番）は変更しない。
- データ契約 `documents/external-data-contract.spec.md` の BR-014 に、匿名セクションが最上位に置かれること・`subSections` が常に空配列であることを追記する。

#### Before / After

Before（`src/lib/parser/mdast-to-sections.ts:101-120`）:

```ts
function nestSections(sections: Section[]): Section[] {
  const result: Section[] = []
  const stack: Section[] = []

  for (const section of sections) {
    while (stack.length > 0 && stack[stack.length - 1].depth >= section.depth) {
      stack.pop()
    }
    if (stack.length === 0) {
      result.push(section)
    } else {
      const parent = stack[stack.length - 1]
      section.parentSectionId = parent.id
      parent.subSections.push(section)
    }
    stack.push(section)
  }

  return result
}
```

After:

```ts
function nestSections(sections: Section[]): Section[] {
  const result: Section[] = []
  const stack: Section[] = []

  for (const section of sections) {
    if (section.depth === 0) {
      result.push(section)
      continue
    }
    while (stack.length > 0 && stack[stack.length - 1].depth >= section.depth) {
      stack.pop()
    }
    if (stack.length === 0) {
      result.push(section)
    } else {
      const parent = stack[stack.length - 1]
      section.parentSectionId = parent.id
      parent.subSections.push(section)
    }
    stack.push(section)
  }

  return result
}
```

変更点: ループの先頭で `depth === 0` のセクションを判定し、`result` に直接追加して `continue` する。これによりスタックに積まれず、以降の見出しの親にならない。

#### アルゴリズム・データフローの補足

- `buildSectionsFromRoot` は、前文がある場合、常にその前文を `flatSections` の先頭（`section-0`）として渡す（`src/lib/parser/mdast-to-sections.ts:156-174`）。したがって `nestSections` のループで `depth === 0` のセクションは常に最初に現れる。
- 匿名セクションを `continue` でスキップすることにより、匿名セクションの後に続く最初の見出しは、スタックが空の状態から処理される。これは「前文が無いファイルの最初の見出し」と同じ経路であり、常に `result`（最上位）に追加される。

#### 分岐・境界条件（すべて列挙する）

| 入力の `doc.sections`（`nestSections` 適用前の `flatSections`） | 修正後の出力 |
|---|---|
| `[]`（空ファイル） | `[]`（変更なし） |
| `[section-0（subSections 相当は無い。見出し無しファイル）]` | `[section-0]`（変更なし。`buildSectionsFromRoot` の見出し無し分岐で最初から1個のみ生成されるため、`nestSections` は影響しない） |
| `[H1]`・`[H1, H1]`（前文なし） | 変更なし（`depth >= 1` のみのため、既存のスタック処理がそのまま働く） |
| `[section-0, H1a, H1b]`（前文＋複数H1、前文の後は全てH1） | `[section-0, H1a, H1b]`（`section-0` は最上位、`H1a`・`H1b` も最上位で互いに兄弟） |
| `[section-0, H1, H2a, H2b]`（前文＋H1＋その配下のH2複数） | `[section-0, H1]`。`H1.subSections === [H2a, H2b]` |
| `[section-0, H2]`（前文の直後がH2。H1が無い） | `[section-0, H2]`（`H2` も最上位。前文が無くH2から始まるファイルと同じ扱いになる） |

- `section-0'` のような複製は行わない。既存の `section-0` オブジェクトをそのまま `result` に追加する（`nestSections` は元々オブジェクトを複製していない。この点は変更しない）。

### 変更・削除される既存の振る舞い

1. 前文を持つファイルの `Document.sections` の要素数が変わる（1要素 → 前文1 + 見出し数）。
2. 前文を持つファイルの H1（またはH1が無い場合は前文直後の見出し）の `parentSectionId` が無くなる（以前は `'section-0'` だった）。データ契約の記載（`external-data-contract.spec.md` の該当調査）どおり、ホスト・連携アプリのいずれのコードも `parentSectionId` を読んでいないため、実害はない。
3. `findTaskNodeInDoc`（`src/lib/editor/EditorLayout.svelte:77-87`）は `doc.sections` と、その `subSections` 1段のみを探索する。前文を持つファイルの H2 直下のタスクは、修正前は探索されず（H1 の孫だったため）、修正後は探索されるようになる（H1 が最上位、H2 がその `subSections` になるため）。これは書き戻し可能な範囲が広がる改善であり、動作を壊す変更ではない。**H3 以下のタスクは、前文の有無に関係なく探索されない既存の制限が残る（本 Issue の対象外。別問題として扱う）**。
4. gantt（`src/lib/gantt/ast-to-gantt.ts:300-345`）: 前文を持つファイルで、H1 が名前の無い匿名セクションの `project` 子ノードではなく、最上位の `project` ノードになる。表示上の階層（インデント）が1段浅くなる。ノードの `id` は変わらないため、id をキーにした折り畳み状態は維持される。

### 実装者の未確認の解釈

なし。上記の分岐・境界条件表に全パターンを列挙済み。

---

## 2. Progress & Implementation Notes  — FOR AI

### TODO
- [x] `nestSections`（`src/lib/parser/mdast-to-sections.ts:101-120`）を修正する。
- [x] データ契約 BR-014（`documents/external-data-contract.spec.md`）に匿名セクションの位置規則を追記する。
- [x] `src/lib/parser/parse-markdown.test.ts` に単体テストを追加する（前文＋複数H1、前文なし回帰、見出しなし回帰、前文直後H2）。
- [x] `src/lib/parser/ast-to-md.test.ts` に前文を持つファイルのラウンドトリップテストを追加する。
- [x] `npx vitest run`（`test:unit` 相当。`libs:update` はローカルシンボリックリンク解決のため本セッションでは省略）で全27ファイル563件のユニットテストが通過することを確認した（回帰なし）。
- [x] `npx playwright test`（e2e）で全14件が通過することを確認した（回帰なし）。
- [x] `npx svelte-check --tsconfig ./tsconfig.json` を実行し、エラー件数が変更前後で同一（591 FILES 224 ERRORS 18 WARNINGS 27 FILES_WITH_PROBLEMS）であることを確認した。既存エラーは全て `tests/obs-e2e/`（wdio の型定義起因、本変更と無関係）であり、本変更によるエラーは無い。
- [ ] obs-e2e（`test:obs:e2e`、実 Obsidian を起動する wdio テスト）は、本セッションの実行環境で実機 Obsidian を操作できないため実行できない。実行が必要な場合はユーザーが行う（`issue-phase015-markdownEditor-003` の前例と同様の扱い）。
- [ ] ユーザーへ before/after の比較（本 Issue は表示変更ではなく解析結果の構造変更のため、テスト結果の提示をもって comparison とする）を提示し、closure 承認を得る。

### Notes

#### 対象ファイル
- `src/lib/parser/mdast-to-sections.ts`（`nestSections` 関数、実装本体）
- `documents/external-data-contract.spec.md`（BR-014）
- `src/lib/parser/parse-markdown.test.ts`（単体テスト追加）
- `src/lib/parser/ast-to-md.test.ts`（ラウンドトリップテスト追加）

#### 対象外（変更してはならないもの）
- dashboard-for-mywork リポジトリのコード（要望元の Direction により dashboard 側は変更しない）。
- `src/lib/editor/EditorLayout.svelte` の `findTaskNodeInDoc`（H3 以下探索の制限は別問題として扱う。本 Issue はその改善が副次的に起きることを記録するのみで、能動的な変更は行わない）。
- `resolveProjectKeys`・`buildProjectOrder` 等、dashboard-for-mywork 側のコード（本リポジトリのスコープ外）。
- `Section.parentSectionId` を参照する新規コードの追加（データ契約調査の結果、既存コードはどこも参照していないため、本 Issue で新設する必要はない）。

#### 完了後にユーザーへ伝えること
- dashboard-for-mywork の `issue-phase015-dashboard-007` の TODO 「ユーザーがホスト側の対応を完了したと AI に伝えるまで、以降の作業に着手してはならない」が解除できる状態になったこと。

### History (append-only)

### 2026-09-28

- User Instruction:
  - dashboard-for-mywork からの変更依頼（`issue-phase015-dashboard-007`）を参照し、実装すること。

- Change:
  - 本 Issue を新規作成した（dashboard 側の変更要望書 `request-markdownEditor__preamble-heading-nesting.md` の内容を、本リポジトリの Issue フォーマット・Haiku 実行可能な詳細度で書き起こした）。
  - `nestSections`（`mdast-to-sections.ts:101-120`）を修正し、`depth === 0` の匿名セクションをスタックに積まず、常に最上位に配置するようにした。
  - データ契約 BR-014 に、匿名セクションが最上位に置かれ `subSections` が常に空配列であることを追記した。
  - `parse-markdown.test.ts` に4件、`ast-to-md.test.ts` に1件のテストを追加した。
  - `npx vitest run`（全27ファイル563件通過）・`npx playwright test`（全14件通過）・`npx svelte-check`（エラー件数224件で変更前後同一、既存エラーは全て `tests/obs-e2e/` 由来）を実行し、回帰が無いことを確認した。

- Rationale:
  - 本リポジトリに Issue が存在しない状態での実装は `AI_RUNTIME_RULES.md §2`（Implement without identifying an Issue の禁止）に反するため、要望書の内容を Issue として起票してから実装した。
  - dashboard 側の Issue が「dashboard のコードは変更しない」と明記しているため、本 Issue のスコープをホスト（本リポジトリ）のみに限定した。

---

## 3. Metadata
- id: issue-phase015-markdownEditor-004__preamble-anonymous-section-top-level
- status: proposed
- phase: 015
- related_specs: documents/external-data-contract.spec.md (BR-013〜BR-015)
- related_decisions:
- target_files: src/lib/parser/mdast-to-sections.ts, documents/external-data-contract.spec.md, src/lib/parser/parse-markdown.test.ts, src/lib/parser/ast-to-md.test.ts
- created: 2026-09-28
- updated: 2026-09-28

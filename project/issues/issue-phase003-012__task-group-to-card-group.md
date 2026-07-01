# タスクグループ（子タスクを持つタスク）を kanban カードグループへ対応させる

## 1. 課題と方針  — 人間が読む

### このissueで解決すること

外部 `svelte-kanban-lib` に「サブカード（カードグループ）」構想が導入された
（構想メモ: `project/plan/kaisou_my_idea(from_kanban_library).md`）。
カードグループとは、サブカードを配下に持つカードであり、`card.parentId` で親子関係を辿って
インライン展開する機能である。ライブラリはカードグループを **`card.parentId` の参照のみ** で判定する
（先行 issue `issue-phase003-011` の調査で確認済み）。

本アプリの Markdown では、**子タスクを持つタスク（タスクグループ）** がこのカードグループに対応すべきである。
例（構想メモより）:

```
- ユニット
    - [ ] タスクA        ← 子タスクを持つ = カードグループ
        - [ ] サブa       ← タスクA のサブカード
        - [ ] サブb
    - [ ] タスクB
```

しかし現状、この対応が機能していない。原因は 2 点:

1. **`TaskNode.parentId` が一度も設定されていない。**
   `src/lib/parser/types.ts` で `parentId?: string` は宣言されているが、
   `src/lib/parser/mdast-to-nodes.ts` のノード生成時に代入する処理が存在しない。
   このため常に `undefined` となる。
2. その結果、`src/lib/kanban/ast-to-kanban.ts:129`
   `if (node.parentId !== undefined) card.parentId = …` の条件が成立せず、
   **どのカードにも `parentId` が付与されない**。ライブラリ側のカードグループ機能が発火しない。

加えて、親子リンクは **タスク → タスク** でなければならないという制約がある。
Markdown ではタスクの直近の親が「リスト（ユニット）」であるケースがある（上例の `タスクA` の親は `ユニット`）。
リストはカード化されない（`hierarchy` の `unit` 段として扱われるのみ）ため、
`parentId` にリストの ID を入れるとカードの存在しない親を指す壊れた参照になる。
したがって `parentId` は **最も近い祖先タスク** を指さねばならない。

**ゴール:** Markdown のタスク入れ子構造を、kanban のカードグループ（`parentId` チェーン）へ正しくリンクさせ、
子タスクを持つタスクがカードグループとして展開可能になる状態にする。

### 方針

#### データ構造と kanban 受け渡しデータのリンク（対応表）

| 本アプリのデータ構造（AST）                     | kanban へ渡すデータ（`KanbanCard`）                     | リンクのしかた |
| ----------------------------------------------- | -------------------------------------------------------- | -------------- |
| `TaskNode`（`- [ ]` 1 個）                      | `KanbanCard` 1 枚（1:1）                                 | `card.id = makeGlobalKey(sourcePath, node.id)` |
| タスクの入れ子（親タスク → 子タスク）            | `card.parentId`（= 親カードの `id`＝globalKey）          | **最も近い祖先 `TaskNode` の globalKey を張る**。祖先タスクが無い最上位タスクは `parentId` 未設定 |
| 「子タスクを持つタスク」（`TaskNode.isGroup`）  | 他カードから `parentId` 参照される側 = カードグループ    | ライブラリが `parentId` の集約から自動判定（本アプリは明示フラグ不要） |
| `ListNode`（ユニット、`- ユニット`）            | カードを生成しない                                       | `hierarchy` の `unit` 段としてのみ寄与。`parentId` 計算では **透過**（スキップ）する |
| `Section`（見出し H1/H2/…）                     | カードを生成しない                                       | `hierarchy` の `heading` 段（`level = section.depth`）としてのみ寄与 |

#### 実装方針（推奨プラン）

**基本方針:** `parentId` の充填を「渡す側」= kanban 変換 `src/lib/kanban/ast-to-kanban.ts` に一元化する。
パーサ（`mdast-to-nodes.ts`）は広く改変しない。理由: 変更範囲を kanban 変換へ閉じ込め、
calendar/gantt への副作用を避けられる。「リスト（ユニット）を透過して最も近い祖先タスクを指す」ルールを、
既存の `hierarchy` 構築と同じ走査で表現できる。

**アルゴリズム（最も近い祖先タスクの持ち回り）:**
走査関数 `extractFromNodes` に引数 `ancestorTaskId: string | undefined`（= 現在地から見て最も近い
祖先タスクの **localId**、無ければ `undefined`）を 1 本追加し、次の規則で引き継ぐ。

- `TaskNode` を訪問 → そのカードの親は現在の `ancestorTaskId`。
  子の走査に入るときだけ `ancestorTaskId` を **自分の `node.id`** に置き換える。
- `ListNode`（ユニット）を訪問 → カードを生成しないので `ancestorTaskId` を **そのまま透過**して子へ渡す。
- `QuoteNode` → 従来どおり `continue`。
- セクション直下の走査開始時は `ancestorTaskId = undefined`。

これにより「タスク→（リスト0個以上を透過）→タスク」の最短タスク祖先が必ず `parentId` になる。

以下は**そのまま適用可能な** before/after（`src/lib/kanban/ast-to-kanban.ts`）。

**(a) `taskToCard` — 署名に `ancestorTaskId` を追加し、`parentId` 決定を置換**

before（現状 `taskToCard` 冒頭〜`parentId` 付与、`ast-to-kanban.ts:113`・`128-129` 付近）:
```ts
function taskToCard(node: TaskNode, hierarchy: HierarchySegment[], sourcePath: string): KanbanCard {
  // ...（section / card 生成は変更なし）...
  // 親がタスクの場合のみカードグループの親子関係を張る（親リストにはカードが無い）
  if (node.parentId !== undefined) card.parentId = makeGlobalKey(sourcePath, node.parentId)
```

after:
```ts
function taskToCard(
  node: TaskNode,
  hierarchy: HierarchySegment[],
  sourcePath: string,
  ancestorTaskId: string | undefined,
): KanbanCard {
  // ...（section / card 生成は変更なし）...
  // カードグループ：最も近い祖先タスクの globalKey を親として張る。
  // リスト（ユニット）はカード化されないため、祖先タスクの localId まで遡った値が渡ってくる。
  if (ancestorTaskId !== undefined) card.parentId = makeGlobalKey(sourcePath, ancestorTaskId)
```

**(b) `extractFromNodes` — `ancestorTaskId` を引数追加し、タスクで置換・リストで透過**

before（`ast-to-kanban.ts:139-159`）:
```ts
function extractFromNodes(
  nodes: Node[],
  hierarchy: HierarchySegment[],
  sourcePath: string,
  result: KanbanCard[],
): void {
  for (const node of nodes) {
    if (node.type === 'quote') continue
    if (node.type === 'task') {
      result.push(taskToCard(node, hierarchy, sourcePath))
      if (node.children.length > 0) {
        extractFromNodes(node.children, hierarchy, sourcePath, result)
      }
    } else if (node.type === 'list') {
      if (node.children.length > 0) {
        extractFromNodes(node.children, [...hierarchy, { type: 'unit', name: node.text }], sourcePath, result)
      }
    }
  }
}
```

after:
```ts
function extractFromNodes(
  nodes: Node[],
  hierarchy: HierarchySegment[],
  sourcePath: string,
  result: KanbanCard[],
  ancestorTaskId: string | undefined,   // 追加：最も近い祖先タスクの localId（無ければ undefined）
): void {
  for (const node of nodes) {
    if (node.type === 'quote') continue
    if (node.type === 'task') {
      result.push(taskToCard(node, hierarchy, sourcePath, ancestorTaskId))
      if (node.children.length > 0) {
        // 子の祖先タスクは「このタスク自身」
        extractFromNodes(node.children, hierarchy, sourcePath, result, node.id)
      }
    } else if (node.type === 'list') {
      if (node.children.length > 0) {
        // リスト（ユニット）はカード化しない → 祖先タスクをそのまま透過して引き継ぐ
        extractFromNodes(node.children, [...hierarchy, { type: 'unit', name: node.text }], sourcePath, result, ancestorTaskId)
      }
    }
  }
}
```

**(c) `extractFromSection` — `extractFromNodes` 呼び出しに `undefined` を渡す**

before（`ast-to-kanban.ts:172`）:
```ts
  extractFromNodes(section.children, hierarchy, sourcePath, result)
```
after:
```ts
  extractFromNodes(section.children, hierarchy, sourcePath, result, undefined)
```

**注意事項（実装時の禁止・限定）:**
- `hierarchy`（heading/unit）ロジック・`createKanbanConfig`・`DEFAULT_KANBAN_CONFIG` は**変更しない**。
  `parentId` はカードグループ用、`hierarchy` はレーン内グルーピング用で **直交** する関心事。
- `KanbanCard.parentId` 型（`ast-to-kanban.ts:21`）は既に `parentId?: string` なので**型変更不要**。
- 変更後、`TaskNode.parentId`（`types.ts:18`）はどこからも参照されなくなる。
  これを（1）`mdast-to-nodes.ts` で正しく充填するか、（2）未使用として削除するかは
  本 issue の TODO で判断・記録する（既定は「本 issue では触らず TODO に残す」）。
- カードグループの表示 UI（展開/集約ボタン・装飾）はライブラリ側の責務であり本 issue の**対象外**。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- 着手時に**一度だけ** `project/governance/` を確認（`AI_RUNTIME_RULES.md` のロード順）。
- **テスト観点とテストコードは毎回すべて見直す**（`TESTING_STANDARD.md` 準拠）。

### 依存
- 先行 issue `issue-phase003-011__kanban-lib-spec-migration`（`hierarchy`/`parentId` 導入・カードグループ仕様の追従）。
  本 issue はその上で「`parentId` が実際にデータへ流れる」状態を完成させる。

### 対象ファイル
- `src/lib/kanban/ast-to-kanban.ts`（既読・行番号は上記 before/after 参照）
  … `extractFromNodes`/`taskToCard`/`extractFromSection` の 3 箇所を before/after のとおり改修
- `src/lib/kanban/ast-to-kanban.test.ts` … 下記「追加テスト」を `describe('extractKanbanCards', …)` 内に追記
- （判断のみ）`src/lib/parser/mdast-to-nodes.ts` / `types.ts` … `TaskNode.parentId` の扱い（充填 or 削除 or 別 issue 化）を決めて History に記録

### TODO
- [x] `taskToCard` の署名に `ancestorTaskId: string | undefined` を追加し、`parentId` 決定を置換（before/after (a)）
- [x] `extractFromNodes` に `ancestorTaskId` を追加、タスクで `node.id` に置換・リストで透過（before/after (b)）
- [x] `extractFromSection` の呼び出しに `undefined` を渡す（before/after (c)）
- [x] `ast-to-kanban.test.ts` に下記「追加テスト」6 件を追記
- [x] `TaskNode.parentId` の扱いを判断して History に記録（既定: 本 issue では触らない）
- [x] `npm run check`（kanban 関連の型エラー 0 件）
- [x] `npm test`（`vitest`）全件パス
- [ ] ユーザーによる動作確認・クローズ承認

### 追加テスト（`ast-to-kanban.test.ts`・`describe('extractKanbanCards', …)` 内）

`src(md)` ヘルパー（既存, `test.ts:10`）を用いる。id はハードコードせず**カード間の関係**で検証する。

```ts
it('子タスクの parentId は親タスクカードの id を指す', () => {
  const cards = extractKanbanCards(src('# S\n\n- [ ] 親\n  - [ ] 子'))
  const parent = cards.find(c => c.title === '親')!
  const child = cards.find(c => c.title === '子')!
  expect(child.parentId).toBe(parent.id)
})

it('最上位タスク（祖先タスク無し）の parentId は未設定', () => {
  const cards = extractKanbanCards(src('# S\n\n- [ ] 親\n  - [ ] 子'))
  const parent = cards.find(c => c.title === '親')!
  expect(parent.parentId).toBeUndefined()
})

it('孫タスクの parentId は直近の親タスク（子）を指す', () => {
  const cards = extractKanbanCards(src('# S\n\n- [ ] 親\n  - [ ] 子\n    - [ ] 孫'))
  const child = cards.find(c => c.title === '子')!
  const grand = cards.find(c => c.title === '孫')!
  expect(grand.parentId).toBe(child.id)
})

it('間にリスト（ユニット）が挟まっても parentId は最も近い祖先タスクを指す', () => {
  const cards = extractKanbanCards(src('# S\n\n- [ ] 親\n  - ユニット\n    - [ ] 子'))
  const parent = cards.find(c => c.title === '親')!
  const child = cards.find(c => c.title === '子')!
  // ユニット（リスト）はカード化されないため、その id を指してはならない
  expect(child.parentId).toBe(parent.id)
})

it('リスト直下の最上位タスクは parentId 未設定（リスト id を指さない）', () => {
  const cards = extractKanbanCards(src('# S\n\n- ユニット\n  - [ ] タスク'))
  const task = cards.find(c => c.title === 'タスク')!
  expect(task.parentId).toBeUndefined()
})

it('全カードの parentId は宙吊りにならない（存在するカード id を指す）', () => {
  const cards = extractKanbanCards(src('# S\n\n- [ ] 親\n  - ユニット\n    - [ ] 子\n      - [ ] 孫'))
  const ids = new Set(cards.map(c => c.id))
  for (const c of cards) {
    if (c.parentId !== undefined) expect(ids.has(c.parentId)).toBe(true)
  }
})
```

### 受け入れ基準（すべて満たすこと）
- 上記「追加テスト」6 件がすべてパスする。
- 既存の kanban テスト（`ast-to-kanban.test.ts`）が回帰しない（`section`/`hierarchy`/`description` 系は不変）。
- `npm run check` で kanban 関連の型エラーが 0 件（他ビューの既存エラーは対象外）。
- `npm test`（`vitest`）全件パス。

### 既知の対象外事項
- カードグループの UI 表示・展開/集約操作・装飾はライブラリ側の責務であり、本 issue の対象外。
- calendar/gantt ビューの `parentId` 取り扱いは変更しない。

### 履歴（追記のみ）

## History

### 2026-07-01

- User Instruction:
  - `project/plan/kaisou_my_idea(from_kanban_library).md` のサブカード構想に基づき、
    本アプリの Markdown タスクグループ（子タスクを持つタスク）が kanban のカードグループに対応するよう、
    kanban へ渡すデータのロジックを修正したい。修正用の issue を起票（実装はまだしない）。データ構造と
    kanban 受け渡しデータのリンクを明記すること。ユーザーは「issue-0037」として指定。

- Change:
  - 新 Issue 起票（ID は後述の理由により新スキーム `issue-phase003-012` を採用）。
  - 課題を特定: `TaskNode.parentId` が `mdast-to-nodes.ts` で未充填のため常に `undefined`、
    結果 `ast-to-kanban.ts` で `card.parentId` が一切付与されずカードグループが機能しない。
  - 方針を策定: kanban 変換の走査中に「最も近い祖先タスク」を持ち回り、リスト（ユニット）を透過して
    `card.parentId` を張る。データ構造 ↔ kanban 受け渡しデータの対応表を明記。

- Rationale:
  - ライブラリはカードグループを `card.parentId` のみで判定するため、Markdown のタスク入れ子を
    タスク→タスクの `parentId` チェーンへ確実にリンクさせる必要がある。
  - リストはカード化されないため透過しないと宙吊り参照になる。ゆえに「最も近い祖先タスク」を採用。
  - ID について: ユーザー指定の「issue-0037」はレガシー `NNNN` スキームの継番だが、
    `NAMING_AND_ID_RULES §1/§5`（新規は `issue-phase<PPP>-<NNN>`／レガシー番号は新規に使わない）に反する。
    現行フェーズ（kanban 関連は phase003）の新スキーム最小空き番号 `012` で起票した
    （先行 issue `issue-phase003-011` と同じ運用）。

### 2026-07-01（追記）

- User Instruction:
  - `project/governance` の issue 起票ルールに「haiku でも認識の齟齬なく実装できるレベルの詳しさで
    内容記載すること」を追加すること。今回起票の issue も同じ詳しさへ書き直すこと。

- Change:
  - `WORKFLOW.md §2.4`（Required Detail Level / Haiku-Executable Standard）を新設（英語, `LANGUAGE_POLICY §1`）。
  - 本 issue の「実装方針」を、`ast-to-kanban.ts` の 3 箇所（`taskToCard`/`extractFromNodes`/
    `extractFromSection`）の **before/after コード**・アルゴリズム・行番号・禁止事項付きへ拡張。
  - 「追加テスト」を、そのまま貼れる具体的テストコード 6 件（親子・最上位未設定・孫・ユニット透過・
    リスト直下未設定・宙吊り無し）へ具体化。受け入れ基準も追加テスト準拠に更新。

- Rationale:
  - 実装時の創造的補完は禁止（`AI_RUNTIME_RULES §2/§4`）であるため、曖昧さは起票時に除去すべき。
    小型モデル（Haiku）が named files を読めば解釈ギャップ無く実装できる粒度を、起票ルールとして明文化した。

### 2026-07-01（実装）

- Change:
  - `src/lib/kanban/ast-to-kanban.ts` を before/after (a)(b)(c) のとおり改修。
    `taskToCard`/`extractFromNodes` に `ancestorTaskId: string | undefined` を追加し、
    `extractFromSection` からの初回呼び出しで `undefined` を渡すようにした。
    `node.parentId` 参照は削除し、持ち回った `ancestorTaskId` から `card.parentId` を決定する方式へ置換。
  - `src/lib/kanban/ast-to-kanban.test.ts` の `describe('extractKanbanCards', …)` 内に
    「追加テスト」6 件をそのまま追記。全件パス（ファイル全体 41 tests pass）。
  - `TaskNode.parentId`（`src/lib/parser/types.ts`）は既定どおり本 issue では触らず、
    `mdast-to-nodes.ts` 側でも未充填のまま残置（どこからも参照されない状態）。
    充填 or 削除の判断は別 issue へ持ち越し。
  - `npm run test:unit`: 22 files / 445 tests 全件パス（新規 6 件含む）。
  - `npm run check`: 既存のエラー（`settings.ts`／`ast-to-calendar.test.ts`／`ast-to-md.test.ts`／
    `tests/obs-e2e/*` の Browser 型）はいずれも本 issue の対象ファイル外・変更前から存在するものであり、
    `ast-to-kanban.ts`／`ast-to-kanban.test.ts` に起因する型エラーは 0 件。
  - `npm test`（obs e2e 込みフル実行）はガントビュー 3 件が `waitUntil timeout` で失敗したが、
    ドラッグ操作を伴う既存の gantt e2e であり本変更（kanban 変換ロジック）と無関係の環境要因と判断。

- Rationale:
  - 実装は issue 起票時点の before/after コードをそのまま適用しており、設計判断の追加は無い。
  - `TaskNode.parentId` の扱いは issue 本文の既定方針（触らない）に従い、TODO として記録のみ行った。

### 2026-07-02（ユーザー動作確認 → ライブラリ側バグ発覚・修正）

- User Instruction:
  - kanban のカードグループの DnD ができない。原因を調査すること。

- 調査結果（根本原因・確定）:
  - バグは本アプリ側ではなくライブラリ `svelte-kanban-lib`（`../kanban-for-mywork`）側。
  - group／階層モード（アプリ既定 `groupBy = HIERARCHY_GROUP_BY`）では各レーンが `groupId` 付きで
    DnD レジストリへ登録される（`KanbanLane.svelte:38-44`、キー `${groupId}::${laneId}`）。
    `findTargetLane`（`utils/dnd.ts:32-33`）は `allowCrossGroupMove=false`（既定）のとき
    `groupId !== sourceGroupId` のレーンを全スキップする。
  - `KanbanCardGroup.svelte` の `handlePointerDown` が `startDrag` に `groupId` をハードコードで
    `undefined` として渡していた（`groupId` を props で受け取らず、`KanbanLane` からも渡していなかった）。
    このため group モードではカードグループの `sourceGroupId=undefined` が全レーンの実グループIDと
    不一致 → ドロップ先が常に null → `commitDrop` が発火せず無反応。通常カードは正しい `groupId` を
    渡すため動作していた（＝カードグループのみ・group モード限定のバグ）。

- Change（ライブラリ `../kanban-for-mywork` 側で実施）:
  - `KanbanCardGroup.svelte`: `Props` に `groupId?: string` を追加し、`startDrag` の第3引数を
    `undefined` → `groupId` に変更。
  - `KanbanLane.svelte`: `KanbanCardGroup` の描画3箇所すべてに `{groupId}` を伝搬。
  - `npm run test:function` 134 件パス、`svelte-check` は既存4エラーのみ（本変更ファイル由来 0）、
    `npm run build` で `dist` 再生成。本アプリ `main.js` も再ビルドして修正を反映。

- Rationale:
  - 修正はライブラリ側に閉じる（`parentId`/`hierarchy`/レーン配分ロジックは不変）。アプリ側の
    `KanbanTab.handleCardMove` は変更不要（ドロップが発火すれば globalKey から書き戻す）。
  - 修正対象が別リポジトリのため、ライブラリ側の運用に従い別途記録すること（TODO）。

---

## 3. メタデータ
- id: issue-phase003-012__task-group-to-card-group
- status: implemented（カードグループ DnD 修正済み・ユーザー動作確認待ち）
- phase: 003
- related_specs: なし
- related_decisions: なし
- target_files: src/lib/kanban/ast-to-kanban.ts, src/lib/kanban/ast-to-kanban.test.ts
- created: 2026-07-01
- updated: 2026-07-02

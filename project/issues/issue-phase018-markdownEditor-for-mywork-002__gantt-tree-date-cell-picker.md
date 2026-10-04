# Gantt ツリーの日時セル編集に、エディタと同じ日付入力支援（ピッカー）を使う

## 背景
- リポジトリ: `markdownEditor-for-mywork`（`svelte-gantt-lib` = `ganttchart-for-mywork` をソースから直接バンドル）。
- 要望原文（ganttchart の要望）:
  > このツリーで文字列や日時を編集できるようにして
  > 　@rv: できるが、非常に使い勝手が悪いため、日時はmarkdownEditorの入力支援を導入して。編集のさいにダサいオレンジ線の囲いが表示されるが、やめて。エクセルのように自分がどのセルを編集しているかわかるように少し囲い線を太くする程度でOK。
- 採用した解釈: Gantt ビューのツリーで schedule / plan / due セルをダブルクリックしたとき、エディタの `@schedule` 等で出る日付ピッカー（日付・時刻・期間指定・today/now・決定）を、そのセルの下に表示する。確定した値は既存のツリーセル書き戻し（`buildTreeCellEditPatcher`）で Markdown へ書く。編集枠の見た目はライブラリ側 issue で対応する。
- ライブラリ側（`ganttchart-for-mywork`）で、日時セルの編集開始をホストへ委ねるハンドラー `onTreeDateCellEditRequest` が追加される（依存 issue）。仕様:
  ```ts
  interface GanttTreeDateCellEditRequest {
    nodeId: string;                       // globalKey
    key: 'schedule' | 'plan' | 'due';
    start: DateTime | null;               // 現在値。未設定なら null
    end: DateTime | null;                 // 単一日時（due の単一値）は null
    anchorEl: HTMLElement;                // 編集中セルの要素
    done: () => void;                     // ピッカーを閉じたら必ず呼ぶ（セルの編集中枠が消える）
  }
  // GanttEventHandlers.onTreeDateCellEditRequest?: (request) => void
  ```
  このハンドラーを渡すと、ライブラリは日時セルの文字入力欄を出さない。

## 目的
Gantt ツリーの日時セルを、エディタと同じ操作感のピッカーで編集できるようにする。

## 現状
- `src/editor/metatag-picker.ts`: ピッカーは CM6 の tooltip（`buildPickerTooltipView(view, target, minuteStep)`）として作られ、DOM 構築と CM6 への書き込み（`view.dispatch`）・閉じる処理（`openMetaPicker.of(null)`）が1つの関数に混在している。外側クリック・Escape で閉じる処理は `mount()` / `destroy()` 内。
- ピッカーの見た目: `styles/metatag-wysiwyg.css` の `.metatag-picker-popup.cm-tooltip`（背景・枠・影など。`.cm-tooltip` との複合セレクタ）と `.metatag-picker-*`。これらは Obsidian 全体の `styles.css`（`styles/*.css` からビルド生成）に入り、Shadow DOM の中には効かない。
- Gantt ビューは Shadow DOM 内に描画される（`src/views/ShadowItemView.ts`）。`src/views/GanttView.ts` → `GanttViewMount.svelte` → `src/lib/gantt/GanttTab.svelte`。`GanttView.ts:45-46` で `settings.ganttExpandSubtasks` / `settings.defaultDurationMin` を渡している（`minuteStep` は渡していない）。
- `src/lib/gantt/GanttTab.svelte`: `handlers.onTreeCellEdit(event)` で `buildTreeCellEditPatcher(event)` → `onNodePatch(event.nodeId, patcher)`。
- `src/lib/gantt/tree-cell-edit.ts`: `buildTreeCellEditPatcher` は日時キーに文字列値を渡すとそのまま `upsertSchedule` / `upsertPlan` / `upsertDue` に書く。
- `src/lib/format/metatag-format.ts`: `parseMetaDateValue`、`buildMetaDateValue`。`src/lib/calendar/markdown-patch.ts:9` `formatSchedule(start, end)`。

## 実装内容
1. ピッカーの DOM 構築を CM6 から切り離す（`src/editor/metatag-picker.ts`）
   - 新関数 `buildMetaDatePicker(opts)` を export する。
     ```ts
     interface MetaDatePickerOptions {
       initialValue: string;          // 例 '2026-10-03T09:00' / '2026-10-03T09:00/2026-10-03T10:00' / ''
       initialTentative: boolean;
       showTentative: boolean;        // false なら「仮置き（?）」行を出さない
       minuteStep: number;
       onCommit: (value: string, tentative: boolean) => void;  // value は buildMetaDateValue の結果
       onClose: () => void;           // 外側クリック・Escape
     }
     // 戻り値: { dom: HTMLElement; mount(): void; destroy(): void }
     ```
   - `buildPickerTooltipView` は `buildMetaDatePicker` を使う形に書き換え、エディタでの挙動（書き込み内容・カーソル移動・閉じ方）は変えない。
2. 見た目を tooltip 以外でも使えるようにする（`styles/metatag-wysiwyg.css`）
   - `.metatag-picker-popup.cm-tooltip` の指定を、浮動表示用のクラス `.metatag-picker-popup.metatag-picker-popup--floating` にも当てる（セレクタを併記）。浮動表示用に `position: fixed; z-index: var(--layer-popover, 30);` を追加する。
3. Gantt ツリーからの呼び出し（`src/lib/gantt/GanttTab.svelte`）
   - `minuteStep` を `GanttView.ts` → `GanttViewMount.svelte` → `GanttTab.svelte` の props で渡す（`settings.minuteStep`）。
   - `handlers.onTreeDateCellEditRequest(req)` を実装する:
     - 初期値: `start` が null なら `''`、`end` が null なら `start` を `yyyy-MM-dd'T'HH:mm`、両方あれば `formatSchedule(start, end)`。
     - `buildMetaDatePicker({ initialValue, initialTentative: false, showTentative: false, minuteStep, onCommit, onClose })` の `dom` に `metatag-picker-popup--floating` クラスを付け、**`document.body` に追加**する（Shadow DOM の外。Obsidian の CSS 変数とピッカーのスタイルが効くため）。位置は `req.anchorEl.getBoundingClientRect()` のセル直下（`top = rect.bottom + 2`, `left = rect.left`）。画面からはみ出す場合は画面内に収まるようずらす。追加後に `mount()` を呼ぶ。
     - `onCommit(value)`: `buildTreeCellEditPatcher({ nodeId: req.nodeId, key: req.key, value })` を `onNodePatch` に渡して書き戻す → ピッカーを閉じる。
     - 閉じる処理（確定・`onClose` 共通）: `destroy()`、`dom.remove()`、`req.done()`。同時に開けるピッカーは1つとし、別セルで開いたら前のものを閉じる。コンポーネント破棄時（ビューを閉じたとき）も閉じる。
   - 外側クリック判定は `document` の mousedown（capture）で行うため、Shadow DOM 内のクリックでも閉じることを確認する（`dom.contains(e.target)` は body 直下の要素なので正しく判定できる）。

## 完了条件
- Gantt ビューのツリーで schedule / plan / due セルをダブルクリックすると、セルの下にエディタと同じ見た目のピッカーが出て、文字入力欄は出ない。
- ピッカーで日付・時刻（分刻み設定に従う）・期間を選んで「決定」すると、該当タスクの `@schedule` / `@plan` / `@due` が書き換わり、ガントとツリーの表示が更新される。
- ピッカーには「仮置き（?）」が表示されない。
- 外側クリック・Escape で何も書き換えずに閉じる。閉じるとセルの編集中枠が消える。
- エディタ（`@schedule` 等）のピッカーの挙動は従来と変わらない。
- タスク名セルは従来どおり文字入力で編集できる。

## テスト
- 単体: 初期値の組み立て（start/end の null・単一・期間 → 文字列）を純粋関数に切り出してテストする（例 `src/lib/gantt/tree-cell-edit.ts` に `formatTreeCellPickerInitialValue(start, end)` を追加し、既存テストファイル `src/lib/gantt/gantt-config-tree-edit.test.ts` か新規テストで確認）。
- 既存のエディタ側ピッカーの E2E（`tests/obs-e2e/metatag-*.e2e.ts`）が通ること。
- `tests/obs-e2e/gantt-view.e2e.ts` に「ツリーの schedule セルをダブルクリック → `.metatag-picker-popup--floating` が表示される → Escape で消える」を追加する（ツリーへの到達が難しい場合は手動確認手順を issue のコメントに残す）。
- `npm run test:unit` が通ること。Obsidian で実際に書き戻しを目視確認する。

## 依存関係
- issue-phase018-ganttchart-for-mywork-002__tree-cell-edit-border-and-date-editor-hook.md（`onTreeDateCellEditRequest` の追加）
- issue-phase018-markdownEditor-for-mywork-001__minute-step-select-wheel.md（ピッカーの時刻欄を先に作り替える）

## 対象外
- 仮置き（?）の付け外しをツリーから行うこと。
- status や任意メタ情報セルの編集。
- Calendar / Kanban など他ビューへのピッカー導入。

## 要確認
なし

## 実装結果（2026-10-03）
- buildMetaDatePicker を切り出し、GanttTab に onTreeDateCellEditRequest・浮動ピッカー（tree-date-picker.ts）・minuteStep の受け渡しを実装。単体テスト通過。
- 未完: ライブラリ側 issue-phase018-ganttchart-for-mywork-002 が未実装（ganttchart-for-mywork に onTreeDateCellEditRequest が無い）ため、実機のダブルクリック E2E は未実施。ライブラリ実装後に gantt-view.e2e.ts へ追加すること。

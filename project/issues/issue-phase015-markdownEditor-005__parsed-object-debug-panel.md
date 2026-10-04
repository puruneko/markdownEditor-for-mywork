# パース済みオブジェクトをデバッグ表示するパネルの新設

## 1. Problem & Direction  — FOR HUMANS

### この Issue が解決すること

Markdown をパースした結果（`Document` オブジェクト）を、開発者が構造として確認する手段が不足している。既存の AST View（`src/views/AstView.ts`）は `Document` を JSON 文字列として `<pre>` に流し込むのみで、折りたたみ・型の識別ができず、Document の更新（入力のたび）に追従して再描画されるため、調査中に表示が動いてしまう。

デバッグ用途として、パース済みオブジェクトを見やすく表示する専用パネルを新設する。パネル上部に「表示更新」ボタンを置き、ボタンが押されたときのみ表示を更新する。

### Direction

- 新規ビュー `ParseDebugView`（view type `md-ast-editor-parse-debug-view`、表示名 `Parse Debug`）を追加する。既存の AST View は変更しない。
- パネル上部に「表示更新」ボタンを置く。表示内容は、ボタンが押されたときにのみ更新する。パネルを開いた直後は空（案内文のみ）とし、ボタンが押されるまでオブジェクトを表示してはならない。
- 表示は、ソース（ファイルパス）ごとに `Document` を折りたたみ可能なツリーで表示する。`Map` は `Map(n)` として展開可能なエントリ列で表示し、配列は `Array(n)`、オブジェクトは `Object` と種別・件数を要約に表示する。
- 「表示更新」ボタンはパースの再実行（`onReload`）を呼んではならない。その時点でホストが保持している最新の `SourceEntry[]` を取り込むのみとする。
- コマンド `open-parse-debug-view`（名称 `Parse Debug を開く`）を追加する。リボンアイコンを追加する（2026-09-29 追記で変更）。

### Existing behavior removed or changed

None

### Implementer's unconfirmed interpretation

- 「新設」を、既存 AST View の改修ではなく別ビューの追加と解釈した。
- 「押された時のみ表示を更新」を、初期表示も空とする（開いた直後は自動表示しない）と解釈した。
- 全ソース（AstIndex が保持する全ファイル）を表示対象とした。ソースの絞り込みは行わない。

---

## 2. Progress & Implementation Notes  — FOR AI

### TODO
- [x] `src/lib/debug/debug-tree.ts`: 任意値をツリーノードへ変換する純関数 `toDebugTree` を追加
- [x] `src/lib/debug/debug-tree.test.ts`: 変換の単体テストを追加
- [x] `src/lib/debug/DebugTreeNode.svelte`: 再帰表示コンポーネントを追加
- [x] `src/views/ParseDebugViewMount.svelte`: 上部ボタン付きマウントコンポーネントを追加
- [x] `src/views/ParseDebugView.ts`: ビュークラスを追加
- [x] `src/plugin.ts`: registerView / コマンド / onunload の detach を追加
- [x] `src/views/shadow-theme-lockdown.test.ts`: 新規 svelte を対象に追加
- [x] `src/views/parse-debug-view.test.ts`: 更新ボタンでのみ表示が更新されることを検証

### Notes

- `toDebugTree(value, key)` の戻り値: `{ key: string, kind: 'map'|'array'|'object'|'string'|'number'|'boolean'|'null'|'undefined', summary: string, children?: DebugTreeNode[] }`。
  - `Map` の子ノードの key は `String(mapKey)`。値がオブジェクトの場合も再帰する。
  - 循環参照は `[Circular]`（kind `object`、children なし）とする。
  - 文字列は `JSON.stringify` した表記を summary とする。
- 状態管理: マウント側は `registerUpdater` で受けた最新 `sources` を非リアクティブ変数に保持し、ボタン押下時にのみ `$state` へ反映する。
- テーマ: Shadow DOM 内では `--host-*` 変数のみ使用し、Obsidian の `--background-*` / `--text-*` / `--interactive-*` を参照してはならない（issue-phase012-markdownEditor-001）。

### History (append-only)

### 2026-09-29

- User Instruction:
  - governance を確認し、markdown をパースしたオブジェクトを見やすく表示するパネルを新設する。デバッグ用で、上部に表示更新ボタンを作り、押された時のみ表示を更新する。

- Change:
  - 本 Issue を新規作成した。関連する既存 Issue（phase015-001〜004）は別領域のため、新規起票とした。
  - 上記 TODO のとおり実装した。

- Rationale:
  - AI_RUNTIME_RULES §2 により Issue 無しの実装は禁止されているため、実装前に起票した。

### 2026-09-29 追記

- User Instruction:
  - パネル表示アイコンが無い。E2E テストも実施すること。

- Change:
  - `src/plugin.ts` にリボンアイコン（`bug`、`Parse Debug を開く`）を追加した（`showRibbonIcon` 設定に従う）。当初「リボンアイコンは追加しない」としていた Direction を変更した。
  - `tests/obs-e2e/parse-debug-view.e2e.ts` を追加した（リボン表示・クリックで開く・初期は空・ボタン押下で表示）。
  - 実機 E2E を実行した。新規2件は通過。gantt-view 2件・metatag-decoration 2件が失敗したが、本変更を退避したベースラインでも同一の4件が失敗するため、本 Issue とは無関係の既存失敗である。

- Rationale:
  - アイコン無しでは他ビューと操作性が揃わないため。

---

## 3. Metadata
- id: issue-phase015-markdownEditor-005__parsed-object-debug-panel
- status: open
- phase: 015
- related_specs: project/specs/system-baseline.spec.md
- related_decisions:
- target_files: src/lib/debug/debug-tree.ts, src/lib/debug/DebugTreeNode.svelte, src/views/ParseDebugView.ts, src/views/ParseDebugViewMount.svelte, src/plugin.ts
- created: 2026-09-29
- updated: 2026-09-29

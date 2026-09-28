# markdownEditor: 開発者モードでElementsパネルから要素を辿れない問題の原因調査(調査のみ)

対象リポジトリ: markdownEditor-for-mywork

## 1. Title
markdownEditor: DevTools Elementsパネルで要素を辿れなくなる問題の原因調査(調査issue。修正は別issueで対応)

## 2. Background
入力要望(ユーザー原文): 「開発者モードでエレメントをクリックすると、obsidianのHTML全体もしくはbodyに近い階層のどこかが更新され、Elementsタブもデフォルト表示に戻りでクリックした要素をたどれない。この拡張機能を切ると解消されるため、この拡張機能にこのような機能が必須かどうか確認する。必須でない場合は開発者モードでエレメントを辿れるようにロジックを修正して。」

未検証の仮説: `metatagValuePlugin`(`metatag-decoration.ts`)が、CodeMirrorの`selectionSet`が発生するたびに装飾を再構築しており、その際にchip表示⇔生テキストの切り替えでウィジェットのDOM要素が丸ごと入れ替わっている可能性がある。これによりDevTools側でDOM変更が検知され、Elementsパネルの選択がリセットされているのではないかと推測されるが、未確認である。

## 3. Objective
本issueでは原因調査のみを行い、コードの修正は行わない。原因・再現条件・「この挙動を生む機能が拡張機能にとって必須かどうか」の判断をレポートとしてまとめ、修正の要否・方針を次のissueにつなげる。

## 4. Scope
markdownEditor-for-mywork リポジトリ。調査のみ、恒久的なコード変更は行わない。

## 5. Implementation requirements
- 手順1: エディタ本体、各ビュー(dashboard等の埋め込みビュー含む)、サイドバーなど、Obsidian UIのどの部分をクリックした際にDevTools Elementsパネルがデフォルト表示に戻るかを特定する。
- 手順2: Chrome DevToolsで`body`要素に「Break on subtree modifications」を設定し、実際にDOMを変更しているコールスタックを採取する。
- 手順3: 装飾拡張(`metatagValuePlugin`等)や各ビューをデバッグビルドで個別に無効化し、二分探索的に原因箇所を切り分ける。
- 上記の未検証仮説(`metatagValuePlugin`が`selectionSet`のたびに装飾を再構築している)を検証対象の1つとして調査する。

## 6. Files / components likely to be changed
なし(コード変更を伴わない調査issueのため)。ただし調査のためにデバッグ用の一時的なビルド変更(モジュールの無効化等)を行う場合は、調査完了後に必ず元に戻すこと。

## 7. Dependencies
- なし。他issueと並行して進めてよい。
- 本issueの成果(原因レポート)をもとに、修正が必要と判断された場合は、別途「修正issue」を新規に起票する。修正issueは本issueの完了(レポートの作成)を前提とする。

## 8. Acceptance criteria
- 「どの操作(どのペインのクリック)で発生するか」が具体的に特定されている。
- DOMを変更しているコールスタック・関数が特定されている。
- 「この機能(chip⇔生テキストの動的切り替え等、原因と特定された挙動)がプラグインの必須機能かどうか」についての判断が、根拠とともにレポートされている。
- 上記内容が原因レポートとして文書化されている(GitHub issueコメントまたは別ドキュメントとして残す)。

## 9. Test requirements
本issueはコード変更を伴わないため、自動テストの追加は不要。ただし調査で使ったデバッグ手順(無効化したモジュール、確認したブレークポイント条件)を、再現可能な形でレポートに残すこと。

## 10. Out of scope
- 原因に対する実際のコード修正(必須機能でないと判断された場合の修正を含む)。修正は本issue完了後、別issueとして起票する。

---

## 2. Progress & Implementation Notes（実装記録）

### History (append-only)

### 2026-09-27 21:50

- User Instruction:
  - phase013シリーズを順番に実装する指示の3件目として着手。本issueは「調査のみ・コード変更なし」が明示されているため、コード変更は行わない。

- Change:
  - コード変更なし（本issueのScope・Files/components likely to be changedの記載通り）。静的コード調査のみ実施。

- Rationale:
  - 本issueの性質上（調査issue）、実装ではなく調査結果の記録を行う。

- Notes（静的コード調査の結果。実機DevTools検証は未実施——下記「Open items」参照）:
  - リポジトリ全体（`src/`配下）で、CodeMirrorの`ViewUpdate.selectionSet`（＝カーソル移動・クリックのたびに発火するイベント）を再計算トリガーに含んでいる箇所は `src/editor/metatag-decoration.ts` の `metatagValuePlugin`（279行目付近）のみであることを`grep -rn "selectionSet" src/`で確認した。同じファイル内の`metatagBlockPlugin`や`src/editor/task-decoration.ts`の`taskDecorationPlugin`は`docChanged`・`viewportChanged`のみをトリガーとしており、`selectionSet`では再計算しない。
  - `metatagValuePlugin`の`buildValueDecorations`（`metatag-decoration.ts` 88-214行目）は、日付系メタ値（`@plan`/`@schedule`/`@due`）の行について、カーソルが行に重なっていない場合は`Decoration.replace`（`MetaDateChipWidget`によるチップ表示、実DOM要素は`<span>`）を、カーソルが行に重なっている場合は`Decoration.mark`（生テキストへの色付けのみ、DOM構造は変えない）を返す。したがって、日付系メタ値の行にカーソルが出入りするたびに、その行だけ「チップ用`<span>`要素」↔「生テキストへのマーク」が実際に入れ替わる（`MetaDateChipWidget.eq()`は同一内容なら再利用させる実装だが、widget⇔mark種別自体の切り替えはeq()の対象外でCodeMirrorが必ずDOM入れ替えを行う）。
  - ただし、上記の入れ替えは該当行の`<span>`単位のローカルな変更であり、ユーザー報告にある「obsidianのHTML全体もしくはbodyに近い階層」規模の更新を単独では説明しない。`document.body`への直接操作、`MutationObserver`、あるいはbody近傍を書き換えるコードは`src/`配下に見つからなかった（`grep -rn "document.body|MutationObserver|document.addEventListener" src/`で確認。唯一の`document.addEventListener`は`metatag-picker.ts`のピッカー表示中のみ有効な`mousedown`/`keydown`リスナーで、DOM書き換えは行わない）。
  - 上記より、未検証仮説（`metatagValuePlugin`が原因）は「メタタグの日付値行に限っては实際にDOM入れ替えが起きる」という点で部分的に裏付けられたが、「クリックした要素を辿れなくなる」という報告全体（他ペイン含む）を単独で説明するには不十分であり、他の要因（Dashboard/Calendar/Gantt/Kanban各Svelte Viewの再マウント処理、Obsidian本体側の挙動等）も候補として残る。

- Open items（未完了。本issueの受け入れ基準を満たすには以下が必要）:
  - 本issueの受け入れ基準（セクション8）は「実際にDevTools上でどの操作が原因かを特定し、DOMを変更しているコールスタックを採取する」ことを要求しており、これは実機で起動しているObsidian（Electron）に対しChrome DevToolsの「Break on subtree modifications」を設定し、実際にクリック操作を行いながら検証する必要がある（本issueのセクション5 手順1〜3）。本セッションはコード読解のみが可能な環境で、実機Obsidianの起動・DevTools操作を伴う検証は実施していない。
  - 上記の静的調査結果は「次の実機検証で確認すべき仮説の絞り込み」として位置づけ、実機検証（手順1〜3）をユーザー側、またはブラウザ操作が可能なセッションで別途実施することを推奨する。
  - 本issueはコード変更を伴わないためテスト追加も不要（セクション9通り）だが、受け入れ基準を満たしていないため、現時点ではクローズ不可（`WORKFLOW.md §6`：実装未完了）。

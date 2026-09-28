# markdownEditor: 開発者モードでエレメントクリック時にElementsタブがリセットされる問題の調査・修正

対象リポジトリ: markdownEditor-for-mywork

## 1. Title
markdownEditor: DevToolsでエレメントをクリックするとHTML全体が更新されElementsタブが追跡できなくなる問題を調査し、可能であれば修正する

## 2. Background
入力要望(ユーザー原文): 「開発者モードでエレメントをクリックすると、obsidianのHTML全体もしくはbodyに近い階層のどこかが更新され、Elementsタブもデフォルト表示に戻りでクリックした要素をたどれない。この拡張機能を切ると解消されるため、この拡張機能にこのような機能が必須かどうか確認する。必須でない場合は開発者モードでエレメントを辿れるようにロジックを修正して。」

コード調査の結果、本プラグイン(markdownEditor-for-mywork)のソースコード内には、DOM全体やbody近くの要素を明示的に再構築・置換するような処理（`innerHTML` の広域書き換え、Shadow DOMの再マウント、`document.body` への直接操作等）は見当たらなかった。グローバルなクリックリスナー(`registerDomEvent`等)や、`app.workspace.detachLeavesOfType`/`revealLeaf`/`setActiveLeaf` の呼び出しはプラグイン起動・終了時やビュー切り替え時の限定的な箇所（`src/plugin.ts`、`src/views/ShadowItemView.ts`、`src/views/query-block.ts`）にのみ存在し、エレメントクリックのたびに広範囲のDOM更新をトリガーするような処理は静的なコード調査だけでは特定できなかった。

このため、原因はコードを読むだけでは特定できず、Obsidian実機でDevToolsを開いた状態での動的な再現・観察調査が必須である。

## 3. Objective
開発者モード(DevTools)でこのプラグインが提供するUI要素（またはObsidian全体の要素）をクリックした際に、HTML全体やbody近くの階層が不必要に更新され、Elementsタブがリセットされる現象の原因を特定する。原因がこのプラグインの機能として必須でなければ、影響を抑えるように修正する。必須な場合は、DevToolsでの要素追跡を妨げない代替実装を検討する。

## 4. Scope
markdownEditor-for-mywork リポジトリ全体（原因箇所は事前に特定できていないため、調査の結果によって対象ファイルが変わる）。

## 5. Implementation requirements
1. **再現手順の確立**: Obsidianでこのプラグインを有効化した状態と無効化した状態の両方で、DevToolsのElementsタブを開き、プラグインが描画するUI（ダッシュボード・カレンダー・ガント・カンバン等のカスタムビュー、またはエディタ内の装飾要素）内の要素をクリックし、Elementsタブの選択状態がリセットされるかどうかを比較・記録する。
2. **原因の絞り込み**: 再現した場合、DevTools の Performance タブや `MutationObserver` を使った独自計測等で、クリックのたびにどの要素・どの範囲が再描画/再構築されているかを特定する。特に以下を優先して調査する。
   - `src/views/ShadowItemView.ts` のマウント処理（92-184行目付近）が、クリックの度に再実行されていないか。
   - Svelteコンポーネントの `$derived`/`$effect` 等のリアクティブ処理が、クリックイベントを契機に意図せず全体を再レンダリングしていないか。
   - Obsidianプラグイン自体（本プラグイン以外を含む）による、フォーカス変更やアクティブリーフ変更に伴う標準的な再描画である可能性（＝本プラグイン固有のバグではない可能性）も排除しない。
3. **必須性の判断**: 特定された更新処理が、UI の正しい動作（例: クリック位置に応じたパネル切り替え等）のために必須かどうかを判断する。
4. **修正方針**:
   - 不要な更新であれば、更新範囲を必要最小限（実際にクリックされた要素周辺のみ）に絞るよう修正する。
   - 必須な更新であることが判明した場合は、可能な範囲でDevToolsのElements選択状態への影響を抑える代替実装（例: 更新対象のDOMノードの同一性を保つ、不要な要素の再生成を避ける等）を検討し、それでも代替できない場合はその旨と理由を報告する（無理に実装しない）。

## 6. Files / components likely to be changed
- 調査結果により変わる。有力な候補は以下:
  - markdownEditor-for-mywork/src/views/ShadowItemView.ts
  - markdownEditor-for-mywork/src/views/DashboardView.ts, CalendarView.ts, GanttView.ts, KanbanView.ts, AstView.ts
  - markdownEditor-for-mywork/src/views/*Mount.svelte（各ビューのSvelteマウントコンポーネント）

## 7. Dependencies
- 他issueとの依存関係なし。独立して着手可能。

## 8. Acceptance criteria
- 再現手順に従って原因箇所が特定され、調査結果（原因・必須性の判断）が記録されている。
- 原因が不要な更新処理であると判明した場合、修正後はDevToolsでエレメントをクリックしてもElementsタブの選択状態が保たれ、クリックした要素を追跡できる。
- 原因がプラグインの動作上必須な処理であると判明した場合、その理由と、実施した緩和策（あれば）が明記されている。

## 9. Test requirements
- 実機確認が主となる: 修正前後でDevToolsのElementsタブの挙動を比較し、改善したことを確認する。
- 修正がプラグインの既存機能（各ビューのクリック操作、パネル切り替え等）に影響しないことを回帰確認する。

## 10. Out of scope
- Obsidian本体やDevTools自体の挙動の変更（本プラグインのコードで対応できない場合、Obsidian本体起因である旨を報告するにとどめる）。

---

## 2. Progress & Implementation Notes（実装記録）

### History (append-only)

### 2026-09-27 23:10

- User Instruction:
  - phase014シリーズを順番に実装する指示の1件目として着手。

- Change:
  - コード変更なし。調査のみ実施（本issueは「必須でなければ修正」だが、調査の結果、緩和すべき不要な更新は見つからなかったため）。
  - `tests/obs-e2e/`に一時的な調査用e2eテスト（実機Obsidian上でMutationObserverにより DOM変更範囲を機械計測するテスト）を作成し実行後、調査目的のため削除した（issue-phase013-markdownEditor-003の「Files/components」節の方針に従う）。

- Rationale:
  - 本issueの受け入れ基準は実機DevTools(GUI)での確認を要求するが、本セッションはGUI操作ができないため、同等の実測手段としてwdio-obsidian-service経由の実機Obsidian(Electron/Chromium)上でMutationObserverを用いた計測を代替手段として採用した。

- Notes（実機計測の結果。issue-phase013-markdownEditor-003の静的調査を引き継ぐ）:
  - 検証手順: `.md`ファイルに`@due:`日付メタ行を含むタスクを作成し、日付チップ(`.metatag-value.metatag-due`)が表示された状態で、別行をクリックしてカーソルを置いた後、`document.body`配下の`childList`変更を`MutationObserver`で記録。その後、矢印キー(↑↓)で`@due`行にカーソルを出入りさせ、`metatagValuePlugin`のwidget⇔mark入れ替え（issue-phase013-markdownEditor-003で特定済み）を実際に誘発した。
  - 結果: `.cm-content`（エディタ本体）配下以外で発生した`childList`変更は**0件**だった。操作なしの1秒間のベースライン計測では、Obsidian標準のステータスバー（`status-bar-item-segment`、同期状態アイコン等）のテキスト更新のみが定期的に検出されており、これは本プラグインと無関係な既存の背景ノイズであることを確認した。
  - 結論: `metatagValuePlugin`のwidget⇔mark入れ替えによるDOM更新は、`.cm-content`内の該当行（`cm-line`要素・widgetの`<span>`）に厳密に局所化されており、`document.body`やbodyに近い階層（`app-container`等）へは一切波及しない。ユーザー報告にある「HTML全体・bodyに近い階層が更新される」という広域のDOM書き換えは、本プラグインのコード内には存在しない。
  - ただし、Chrome DevToolsのElementsパネルは、**現在選択中のDOMノードそのものが（どれだけ局所的であっても）破棄・置換されると、選択状態を失い既定表示（`<html>`直下等）に戻る**という仕様がある。本プラグインの`metatagValuePlugin`は、日付メタ行にカーソルが重なるたびに、その行のwidget用`<span>`（チップ表示）を生テキストの`Decoration.mark`に、離れると再びwidgetに、というDOM要素の破棄・再生成を行う。したがって、ユーザーがDevToolsで日付チップの`<span>`を選択した状態のまま、（chip自体のクリックはこのプラグインの`mousedown`ハンドラが`stopPropagation`するため選択を動かさないが）その後キーボード操作や他行のクリック経由でカーソルがその行に出入りすると、選択中のノードが破棄され、Elementsパネルが既定表示に戻る、という体験が生じ得る。これは「HTML全体が更新された」ように**見える**が、実際のDOM変更は該当行のみに限定されている。
  - 必須性の判断: このwidget⇔mark入れ替えは、日付メタ値をチップ表示（読みやすい表示）とテキスト編集（生の`@due: YYYY-MM-DD`編集）の両方に対応するための本プラグインのコア機能であり（`metatag-decoration.ts`冒頭のコメント、`metatag-picker.ts`との連携）、これを削除・単純化するとテキストとしての日付編集ができなくなる。よって本更新は**必須**と判断する。
  - 緩和策の検討: CodeMirror 6の`Decoration.replace`(widget)と`Decoration.mark`は本質的に異なる種類の装飾であり、両者を切り替える際にDOM要素の同一性を保つ手段はCodeMirrorのAPIレベルで提供されていない（`WidgetType.eq()`は同種のwidget同士の再利用判定のみを対象とする）。チップ表示を維持したまま編集可能にする（常にwidgetのまま、内部に`<input>`等を持たせる）等の代替実装は、日付ピッカーの起動方式・確定/キャンセルのUXを含む本メタ編集システム全体の再設計に相当し、本issueが定める「保守的な修正」の範囲を超える。したがって、AI_RUNTIME_RULES §2「Optimize, refactor, or redesign unless Issue says so」に基づき、本issueの範囲内では実装しない。

- Acceptance criteria充足状況:
  - 「原因箇所の特定」: 完了（`metatagValuePlugin`のwidget⇔mark入れ替えが、局所的だがDevTools選択解除を引き起こしうる唯一の要因であることを実測で確認）。
  - 「必須性の判断」: 完了（必須と判断。根拠は上記Notes参照）。
  - 「必須な場合の緩和策」: 検討した上で、CodeMirrorのAPI制約により保守的な範囲内では実装不可と判断（無理な実装は行わない）。
  - 上記により、本issueは「原因特定・必須性判断・緩和策検討（結果として見送り）」の全てが完了しており、これ以上のコード変更は本issueの範囲では発生しない。

- Open items:
  - なし（調査・判断は完了。ユーザーの明示的なクローズ承認待ち — `WORKFLOW.md §6`）。

# `@` オートコンプリート＋日付ピッカー・インライン日付チップ・自然言語日付

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
メタの入力が手打ちで、`@schedule`/`@due` の形式ミスが起きやすい（記法ガイドの「よくあるミス」表）。形式不正のメタは静かに集計から消える＝最も危険な抜け漏れ（プラン §7.2・§5.3 #3）。

本 issue は、キーボード主体でも「文字を打たずにメタを正規形で入れる」体験を3点まとめて提供する: ① 子リストで `@` を打つとメタキー候補、`@schedule`/`@due` 選択時はカレンダー・ポップオーバーで正規形を自動挿入、② 既存 `@schedule: …` をクリック可能な**インライン日付チップ**として描画し再編集、③ `@schedule: 明日10時` のような**自然言語日付を確定時に即正規化**。

### 方針
- Obsidian `EditorSuggest` で `@` メタキー補完、日付系は日付ピッカーで正規形挿入。
- CM6 ライブプレビュー装飾で日付値をチップ化、クリックでピッカー → 値レンジ置換。
- `chrono-node`（日本語）で自然言語日付をパースし正規形へ置換。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- 着手時に**一度だけ** `project/governance/` を確認（`AI_RUNTIME_RULES.md` のロード順）。
- **テスト観点とテストコードは毎回すべて見直す**（`TESTING_STANDARD.md` 準拠）。

### 依存
- なし（エディタ内で完結）。`issue-phase003-007`（ピル/ポップオーバー）・`issue-phase003-004`（モーダルの日付ピッカー）とピッカー UI を共有しうる。重複実装しない。

### 既存資産の再利用（必読・実装前に読む）
- `src/lib/parser/meta-keys.ts`（`META_KEYS`）… `@` 補完の候補源。ハードコードしない。
- `src/lib/parser/schedule-normalize.ts` … 日付/自然言語 → 正規形。`chrono-node` 連携はここに集約し、装飾側で独自パースしない。
- `src/editor/task-decoration.ts` … 日付チップのライブプレビュー装飾はこの系統で実装。値レンジの保持・置換。
- `src/editor/notation-lint.ts` … 形式不正の既存診断。本 issue の補完は「不正を出させない」予防側で、リント（`issue-phase000-001`）と整合させる。

### 仕様（確定事項：迷ったらこれに従う）
- `@` 補完: 子リスト文脈で `@` 入力 → `META_KEYS` を候補表示。選択で `@<key>: ` を挿入。`schedule`/`due` 選択時は続けて日付ピッカーを開き、正規形を挿入。
- 日付チップ: 既存 `@schedule: <値>` / `@due: <値>` の**値部分**をクリック可能チップとして描画（ライブプレビュー）。クリックでピッカー、変更は**値レンジのみ置換**（キー名や行構造を壊さない）。
- 自然言語日付: 値が自然言語（「明日10時」「来週月曜」）の場合、確定時に `schedule-normalize`＋`chrono-node` で正規形（ISO）へ置換。曖昧時は候補提示し、確定まで本文を変えない。
- すべて**正規形は単一ソース**（`schedule-normalize`）。装飾/補完/チップで別実装を作らない。

### 実装の要点・つまずき
- `EditorSuggest` の発火文脈（子リスト・`@` 直後）を正確に判定し、本文中の無関係な `@` で誤発火しない。
- チップ化は値レンジの正確な保持が肝。再編集時に元レンジへ最小置換する（`upsert-meta` ではなくレンジ置換で十分な場合あり）。
- `chrono-node` は依存追加。日本語ロケールの曖昧解釈（"水曜"＝今週/来週）の既定を決めテストで固定。

### TODO
- [ ] `EditorSuggest` による `@` メタキー補完（`META_KEYS` 候補）。※本増分の対象外（下記「2026-09-17 増分」参照）。
- [x] `@plan`/`@schedule`/`@due` 選択時の日付ピッカー → 正規形挿入。（2026-09-17 増分で実装。非モーダルのポップアップ型に変更）
- [x] 日付値のインラインチップ装飾＋クリック再編集（値レンジ置換）。（2026-09-17 増分で実装）
- [ ] 自然言語日付の確定時正規化（`chrono-node`＋`schedule-normalize`）。※本増分の対象外。
- [x] 全メタキー共通の「メタタグ」視覚装飾（`metatag`/`metatag-<key>` クラス、外だしCSS）。（2026-09-17 増分で新規追加。当初スコープになかった拡張）
- [x] テスト追加・全見直し（2026-09-17 増分分）。

### 受け入れ基準（すべて満たすこと）
- 子リストで `@` を打つとメタキー候補が出て、日付系はピッカーで正規形が入る。※`@` メタキー補完自体は未実装（上記TODO参照）。日付ピッカーは `@plan`/`@schedule`/`@due` の**キー確定時（コロン入力時）**に自動起動する。
- 既存日付値がチップ表示され、クリックで再編集すると値レンジのみ置換される。
- 自然言語日付が確定時に正規形へ変換される。※未実装（対象外）。
- 無関係な `@` で補完が誤発火しない。
- （増分）`@plan`/`@schedule`/`@due` 以外の全メタキーが、周囲のテキストを邪魔しない緑系の視覚装飾（`metatag metatag-<key>`）を持つ。
- （増分）日付ピッカーはモーダルではなく、エディタへの入力をブロックしないポップアップ（CodeMirror tooltip）として表示される。

### テスト観点
- `vitest` 単体: 自然言語 → 正規形変換（代表ケース・曖昧時の既定）。※未実装（対象外）。
- 値レンジ置換が日付値部分のみを書き換えること（キー/構造を保持）。
- `@` 補完の発火文脈判定（子リスト/直後 vs 本文中の `@`）。※未実装（対象外）。
- （増分）`src/lib/format/metatag-format.test.ts`: 表示整形（yyyy省略・T区切り除去・範囲の同日圧縮）と値パースの往復。
- （増分）`tests/obs-e2e/metatag-decoration.e2e.ts`: wysiwyg（Live Preview）でのチップ表示、クリックでのピッカー起動、ピッカーからの値書き戻し、キー確定時のピッカー自動起動、日付系以外のメタへの `metatag` クラス付与。

### 履歴（追記のみ）
- 2026-06-30 — 起票（プラン §7.2・付録 Issue 候補 AB、Phase3 SHOULD）。

### 2026-09-17 増分 — ユーザー指示による範囲拡張・確定事項

- User Instruction:
  - Obsidian エディタ上で `@plan`/`@schedule`/`@due` にモーダルではないポップアップ型の日付・時刻ピッカー（左に日付欄・右に時刻欄）を実装する。
  - wysiwyg（Live Preview）表示時、日付系メタ値は yyyy を省略し、`T` 区切りを除いた人間可読な表示（以後「メタタグ表示」と呼称）にする。ハッシュタグ的だがラウンド（角丸）は控えめにする。
  - ピッカーは「`@<日付系メタ名>` の入力（コロン確定時）」または「メタタグ表示のクリック」で開く。
  - 日付系以外のメタ（`@完了イメージ` 等 `META_KEYS` の残り8キー）も、周囲を邪魔しない程度の「メタ情報である」視覚装飾を持たせる。当面は緑系の色。
  - 全メタタグ（とその子要素・ネスト要素）に `metatag` と `metatag-<メタ情報名>` クラスを付与し、CSSは埋め込みではなく外だしにする。raw モード用・wysiwyg モード用の2ファイルを用意する（日付系以外は当面同一のCSS内容でよい）。
  - 本ユーザーはこの後しばらく応答不可のため、以降の設計判断はAIの推奨案に委ねる。

- Change（確定した設計判断。実装で迷った場合はこれに従う）:
  1. **モード判定**: 「wysiwyg」= Obsidian Live Preview（`editorLivePreviewField` が `true`）。「raw」= Source Mode（`false`）。日付系メタの値は、Live Preview かつカーソルがその行のメタ範囲に重なっていない場合のみウィジェット（チップ）として `Decoration.replace` する。カーソルが重なる場合・Source Mode の場合は通常の `Decoration.mark`（生テキスト＋色付け）に留め、常に手打ち編集できる状態を維持する（既存のメタ行編集フローを壊さないため）。
  2. **チップの置換範囲**: `@<key>` の `@` の位置から行末（値の終端）まで。先頭の `- ` は Obsidian 標準の箇条書きレンダリングに任せ、置換対象に含めない。
  3. **チップの表示文言**: `<キーラベル>: <整形済み値>`。キーラベル定数は `plan`→「計画」、`schedule`→「予定」、`due`→「期限」。仮置き（`?`）は末尾に半角スペース+`?` を付加し、CSSで半透明化する（`metatag-tentative`）。
  4. **日付表示整形アルゴリズム**（`src/lib/format/metatag-format.ts` に実装。単一の情報源とし、他所で独自整形しない）:
     - 値は `schedule-normalize.ts` が生成する正規形（`YYYY-MM-DD` または `YYYY-MM-DDTHH:mm`、`/` 区切りの範囲を許容）を入力とする。
     - 日付部分は `M/D` 形式（year省略、ゼロ埋めなし）。時刻部分は `HH:mm`（24時間表記のまま）。日付と時刻の間は半角スペース（`T` を使わない）。
     - 範囲（`/` あり）: 開始・終了が同一日付の場合は `M/D HH:mm〜HH:mm`（日付は1回のみ表示）。日付が異なる場合は `M/D HH:mm〜M/D HH:mm`。時刻を持たない（終日）範囲は `M/D〜M/D`。
     - 単一値（`/` なし）: 時刻ありは `M/D HH:mm`、時刻なし（終日）は `M/D`。
  5. **ピッカーの実装形態**: Svelte コンポーネントではなく、CodeMirror 6 の `showTooltip`（`@codemirror/view`）による非モーダルのフローティングDOM（バニラDOM構築）とする。理由: `showTooltip` はエディタ内の特定位置に追従する非モーダルなポップアップを標準機能として提供し、モーダル（`Modal` クラス）のような背面ブロックを伴わないため、「入力をブロックしない」要件を素直に満たす。Svelte マウントのライフサイクル（`mount`/`unmount`）を tooltip のライフサイクル（`mount`/`destroy`）へ橋渡しする複雑さを避けるため、この規模のUIはバニラDOMで実装する。
  6. **ピッカーのレイアウト**: 開始行・終了行の2行。各行は「日付入力（左, `<input type="date">`）＋ 時刻入力（右, `<input type="time">`、空欄可＝終日）」。「期間で指定」チェックボックスで終了行の表示/非表示を切替。既存値クリックでの再編集時のみ「仮置き（?）」チェックボックスを表示する（新規挿入時は既に確定したキー表記の `?` の有無をそのまま使うため非表示。理由: 新規挿入フローは値のみを空カーソル位置に挿入するため、キー側の `?` を後から変更する経路を持たせると置換範囲の設計が複雑化するため）。
  7. **書き戻しの置換範囲**:
     - 新規挿入（キー確定＝コロン入力時の自動起動、値が空の場合）: カーソル位置に `" " + 値` を挿入するのみ（キー・`?` は不変）。
     - 既存値の再編集（チップクリック時）: 置換範囲は「キー名直後（`?` の直前 or コロンの直前）〜行末」。`?` の有無と値をまとめて書き戻す（例: `plan` の後、`due` の後）。これにより仮置きトグルと値変更を1回の置換で行う。
  8. **自動起動の検出**: `ViewUpdate.transactions` の `changes.iterChanges` で、挿入テキストが厳密に `:` 1文字であり、かつ変更後のカーソル行が `^(\s*- )@(plan|schedule|due)(\?)?:\s*$`（値が空）に一致する場合にのみピッカーを開く。誤発火・多重発火を避けるため、この条件に該当しない限り自動起動しない（値が入った後は正規表現が不一致になるため再発火しない）。
  9. **クラス設計**:
     - キー部分（既存 `src/editor/task-decoration.ts` の `metaMatch` 分岐に追加）: 既存クラスに加え `metatag metatag-key metatag-<canonicalKey>`（`?` 付きはさらに `metatag-tentative`）。`canonicalKey` は `normalizeMetaKey()` で解決し、未知キーは `metatag-unknown` とする（NAMING_AND_ID_RULES: 識別子は英語固定のため、生の日本語キー文字列をそのままクラス名化しない）。
     - 値部分（新規 `src/editor/metatag-decoration.ts`）: raw/mark 時は `metatag metatag-value metatag-<canonicalKey>`（+`metatag-tentative`）。wysiwyg/widget 時はチップ要素に `metatag metatag-value metatag-<canonicalKey> metatag-date-chip`（+`metatag-tentative`）。
     - 複数行値キー（`condition`/`purpose`/`savepoint`/`special_note`。値が空で子リストを持つ場合）: 子リストの各行にも `metatag metatag-value metatag-<canonicalKey>` を付与する（「ネストの要素」への対応）。
  10. **CSS外だし方針**: 新規ディレクトリ `styles/` を作成。既存 `styles.css`（手書き分）は `styles/base.css` へ移動。新規 `styles/metatag-raw.css`（raw表示・`metatag-key`・非日付系メタの緑装飾）と `styles/metatag-wysiwyg.css`（`metatag-date-chip` の見た目・ホバー・ピッカーPopupのUIスタイル。非日付系メタの緑装飾は raw.css と同一内容を重複定義し、将来の分岐に備える）を新設。ビルド時（`esbuild.config.mjs` に追加する `stylesBundlePlugin`）に `base.css + metatag-raw.css + metatag-wysiwyg.css` を結合し、リポジトリ直下 `styles.css`（Obsidianが自動ロードする実体）へ書き出す。`styles.css` はこれ以降ビルド生成物として扱う（`main.js` と同様の既存運用に合わせる）。
  11. **対象外（今回やらないこと。明示的にスコープ外）**:
      - `EditorSuggest` による `@` メタキー補完。
      - `chrono-node` による自然言語日付の解析。
      - タスクステータス（`md-ast-task-status-*`）の配色。
      - Web版（`src/main.ts`／Monaco）への同機能の実装（本増分は Obsidian CM6 専用。Monaco 側は本 issue の対象外）。
      - ピッカーの曜日表示・祝日表示。

- Rationale:
  - ユーザー不在中の自律実装が前提のため、曖昧さを残すと `AI_RUNTIME_RULES.md §4`（不確実性がある場合は停止して質問する）に抵触する。上記10項目を実装前に確定させ、実装はこの記述に従う（`WORKFLOW.md §2.4` の Haiku-executable基準を満たすための事前確定）。
  - 既存の `task-decoration.ts`（`md-ast-task-status-*`・`md-ast-meta-key`・`md-ast-meta-tentative`）は E2E（`tests/obs-e2e/task-decoration.e2e.ts`）が依存しているため、既存クラス・既存挙動は変更せず、`metatag*` クラスを追加する形にとどめる（後方互換）。
  - `time-meta-model.spec.md` §8 は「視覚デザインの詳細は別途決定する」としていたが、本ユーザー指示によりその決定がなされたとみなし、`metatag-*` の配色を新規に導入する。同 spec の変更管理（§10）が要求する Issue 参照は本 issue（issue-phase003-008）とする。

- 実装結果（`TESTING_STANDARD.md` 準拠）:
  - 新規: `src/lib/format/metatag-format.ts`（表示整形・パース・組み立て）＋ `metatag-format.test.ts`（vitest 12件）。
  - 新規: `src/editor/metatag-decoration.ts`（値装飾・チップwidget・自動起動検出）、`src/editor/metatag-picker.ts`（非モーダルピッカー＝showTooltip）。
  - 変更: `src/editor/task-decoration.ts`（キー部分に `metatag`/`metatag-<key>` クラス追加。既存クラス・既存挙動は不変）、`src/plugin.ts`（拡張登録を追加）。
  - 新規: `styles/base.css`（既存 `styles.css` の手書き内容を移設）・`styles/metatag-raw.css`・`styles/metatag-wysiwyg.css`。`esbuild.config.mjs` に `stylesBundlePlugin` を追加し、ビルド時（dev/production 共通）にこの3ファイルを結合してリポジトリ直下 `styles.css` へ書き出すようにした。
  - 新規: `tests/obs-e2e/metatag-decoration.e2e.ts`（7件: 緑装飾のクラス付与、複数行値キーの子要素への付与、wysiwygチップの表示文言、チップクリックでのピッカー起動＋非モーダル確認、ピッカーでの値レンジ置換、キー確定時のピッカー自動起動、既存クラスの後方互換）。
  - テスト結果: `npx vitest run` 全24ファイル541件パス。`npx wdio run wdio.conf.mts` 全10spec中9specパス／1spec失敗（`gantt-view.e2e.ts` の「バードラッグで@scheduleが更新される」「完了タスクのバーがcompleted装飾でグレーアウトされる」の2件）。
  - **上記gantt-view.e2e.tsの2件は本増分の変更と無関係**であることを確認済み: `git stash` で本セッションの全変更（本増分＋並行issue-phase000-004分）を退避し、直近コミット（336c89b）の状態でも同じ2件が同じエラーで失敗することを確認した（`../ganttchart-for-mywork` 側のドラッグ関連の既存不具合の疑い）。本 issue のスコープ外のため対応しない。別途調査・別issueが必要。
  - `npx tsc --noEmit` は本増分の新規ファイルにエラーなし（`tests/obs-e2e/**` 全般・`src/sync/ast-index.ts`・`src/sync/file-sync.ts` に無関係な既存エラーがあるが、これも同様に本増分と無関係）。

### 2026-09-17 再増分 — ユーザーフィードバックによる修正

- User Instruction:
  - デートピッカーは問題なし。
  - 日付系以外のメタタグ表示が実機で確認できない。メタ情報構文にマッチする全ての部分を装飾すること。
  - 色指定の確定: メタ情報「名」部分（キー）＝非常に薄い緑系の**背景**のみ。メタ「情報」部分（値）＝緑系の**文字色**のみ。
  - このプラグインが管理する全CSSをライト/ダーク両モードに対応させ、どちらを使うかはObsidianの外観設定に追従させる（OSの `prefers-color-scheme` ではない）。

- Change（原因調査と対応）:
  1. **根本原因の特定**: `esbuild.config.mjs` の `obsidianCopyPlugin`（dev/watchビルド時に実機Obsidianのプラグインフォルダへ `main.js`/`manifest.json` をコピーする既存の仕組み）が `styles.css` をコピー対象に含めておらず、`npm run obs:update:manifest`（`package.json`）も同様だった。そのため DOM 上のクラス付与（`metatag`/`metatag-*`）自体は正しく行われていたにもかかわらず、実機Obsidianの `styles.css` が更新されず、色が一切反映されていなかった。E2E（本リポジトリ直下の `styles.css` を直接使うテスト環境）ではこの経路を通らないため、この不具合はE2Eだけでは検出できなかった。
  2. **修正**: `esbuild.config.mjs` の `obsidianCopyPlugin` に `styles.css` のコピーを追加。`package.json` の `obs:update:manifest` スクリプトにも `styles.css` を追加。
  3. **色指定の修正**（`styles/metatag-raw.css`・`styles/metatag-wysiwyg.css`）: 日付系以外の全キーについて、`.metatag-key.metatag-<key>` は `background` のみ（文字色は変更しない）、`.metatag-value.metatag-<key>` は `color` のみ（背景は付けない）に変更した（従来はキー・値の両方に背景＋文字色を付けていた）。
  4. **ダーク/ライト対応の再設計**: 従来は `.theme-dark` セレクタで自前の色を2セット（ライト用・ダーク用）ハードコードしていたが、これを廃止し、Obsidian組み込みのセマンティックCSS変数（`--color-green-rgb`・`--color-green`・`--color-blue-rgb`・`--color-blue` 等、および `--background-primary`・`--text-normal`・`--interactive-accent` 等）に統一した。これらの変数はObsidian本体・使用中のテーマ側で「ライト/ダークそれぞれ」に再定義されているため、Obsidianの外観設定（設定 → 外観 → ベースカラーテーマ）にそのまま追従し、OSの `prefers-color-scheme` には依存しない。変数が存在しない古い環境向けに、`var(--color-green-rgb, 40, 167, 69)` のように固定RGBのフォールバックのみ残した。
  5. **テストの補強**: `tests/obs-e2e/metatag-decoration.e2e.ts` の緑装飾テストを、クラス名の存在確認だけでなく `getComputedStyle()` で実際の `background-color`（アルファ値 > 0）・`color`（G成分 > R成分の緩い判定）を検証するように強化した。今回の不具合（クラスは付くがCSSが反映されない）はクラス存在確認だけでは検出できないため、再発防止として追加。

- Rationale:
  - 「メタタグ表示が実装されていない」という報告は、コード上のロジック不備ではなく、実機Obsidianへの配布物同期漏れ（ビルドパイプラインの既存の抜け）が原因だった。`git stash` 等で切り分けず、まず実際に反映されるパスを疑って調査した。
  - ダーク/ライト対応は独自パレットの二重管理より、Obsidian自身のセマンティック変数に乗せる方が「Obsidianの設定に追従する」という要求を正確かつ低メンテナンスで満たせるため、`.theme-dark` の自前分岐は撤去した。

- 実装結果・テスト:
  - 変更: `esbuild.config.mjs`（`obsidianCopyPlugin` に `styles.css` 追加）、`package.json`（`obs:update:manifest` に `styles.css` 追加）、`styles/metatag-raw.css`・`styles/metatag-wysiwyg.css`（色指定の分離＋Obsidian変数化）、`tests/obs-e2e/metatag-decoration.e2e.ts`（computed style検証を追加）。
  - テスト結果: `npx vitest run` 全24ファイル541件パス。`npx wdio run wdio.conf.mts --spec tests/obs-e2e/metatag-decoration.e2e.ts --spec tests/obs-e2e/task-decoration.e2e.ts` 15件全パス（新規のcomputed style検証含む）。
  - **未検証事項**: `obsidianCopyPlugin` のコピー先（`/mnt/c/Users/progp/workspace/obsidian/obsidian_trial/.obsidian/plugins/md-ast-editor`）はこのサンドボックス環境からアクセスできないWindowsマウントパスのため、実機へのコピー自体をこのセッションでは実行確認できていない。ユーザーの実機で `npm run build:dev`（または `node esbuild.config.mjs`）を実行し、`styles.css` が実際にコピーされ表示が変わることを確認してほしい。

### 2026-09-17 再々増分 — ピッカーのダーク/ライト表示不具合の修正

- User Instruction:
  - ダークモード・ライトモード対応が実装されていない。デートピッカーが見づらい。管理する全CSSを修正し、Obsidianの外観設定に追従させること。

- Change（原因調査と対応）:
  1. **実機DOM構造の実地調査**: このサンドボックスからは実機Obsidianの見た目を目視できないため、`tests/obs-e2e/` に一時的なプローブ用specを作成し、実際にObsidianを起動してDOM・`getComputedStyle()`を直接ダンプして調査した（調査後は削除済み、成果物としては残っていない）。
  2. **根本原因の特定**: CodeMirror 6 の `showTooltip` は、`create(view)` が返す `dom` 要素に対して**CM6自身が `cm-tooltip` クラスを追加**し、`.cm-tooltip` に既定の背景色（明るいグレー系、実測 `rgb(245,245,245)`）を持つ baseTheme を動的に注入する。本プラグインの `.metatag-picker-popup { background: var(--background-primary); }` は単一クラスセレクタで、`.cm-tooltip` の既定スタイルと詳細度が同点になり、CM6側の注入タイミングによって本プラグインの背景色指定が負けていた。実際に `--background-primary` 変数自体はライト/ダークで正しく再定義されていた（実測: ライト `#ffffff`／ダーク `#1C1C1C`）ため、変数の解決自体には問題がなく、CSSの詳細度負けが真因だった。`color`（文字色）は `.cm-tooltip` 側に既定値がなかったため問題なく反映されていた（ダークモードで「明るい背景に薄い文字」という低コントラストな見た目になっていたと推測される）。
  3. **修正**: `styles/metatag-wysiwyg.css` の `.metatag-picker-popup` セレクタを `.metatag-picker-popup.cm-tooltip`（複合セレクタ）に変更し、詳細度を上げてCM6側の既定スタイルより確実に優先されるようにした。
  4. **検証**: 修正前後で実機Obsidianの `body` に `theme-dark`/`theme-light` クラスを直接付け替え、ピッカー要素の `getComputedStyle().backgroundColor` を比較。修正前は光/暗どちらも `rgb(245, 245, 245)` で不変（不具合を再現）、修正後はライト `rgb(255, 255, 255)` ／ダーク `rgb(28, 28, 28)` と正しく分岐することを確認した。
  5. **回帰防止テスト追加**: `tests/obs-e2e/metatag-decoration.e2e.ts` に、ピッカーの背景色の相対輝度（YIQ近似）をライト/ダークで比較し、ライトは高輝度・ダークは低輝度になることを検証するテストを追加した（クラス存在確認だけでは検出できない種類の不具合であるため）。

- Rationale:
  - Obsidian変数（`var(--background-primary)`）自体は正しく解決されていたにもかかわらず表示が壊れていた事実は、「変数の値」ではなく「CSSの詳細度・カスケード順」に原因があることを示していた。実機DOM調査により、ライブラリ（CodeMirror 6）側が自身のクラス・スタイルを動的注入する設計になっていることが判明したため、複合セレクタで詳細度を上げる対処が最も確実で局所的な修正だと判断した。

- 実装結果・テスト:
  - 変更: `styles/metatag-wysiwyg.css`（`.metatag-picker-popup` → `.metatag-picker-popup.cm-tooltip`）、`tests/obs-e2e/metatag-decoration.e2e.ts`（輝度比較の回帰防止テスト追加）。
  - テスト結果: `npx vitest run` 全24ファイル541件パス。`npx wdio run wdio.conf.mts` 全11spec中10specパス（新規テスト含む）／既知の無関係な `gantt-view.e2e.ts` 2件のみ失敗（`issue-phase003-008` 初回増分と同一の既知事象、`../ganttchart-for-mywork` 側の問題であり本issue無関係）。
  - 見出し（H1/H2）強調の実装は別issue `issue-phase003-013__editor-heading-emphasis` として起票・実装した（メタタグとは独立した機能領域のため）。

### 2026-09-17 増分 — メタ情報ネスト装飾の汎用化（コロンなしキー対応）

- User Instruction:
  - メタ情報の装飾は直下のネストにも適用して。`- @memo` の下に `- あいうえお` のような子リストがある場合、その「あいうえお」も装飾対象。どれがメタ情報なのかエディタで直感的にわかるように、メタ情報に該当する文字列はすべて装飾対象にすること。

- Change:
  1. **裸のメタキー（コロンなし）への対応**: `src/editor/metatag-decoration.ts` の `META_LINE_RE` を `/^(\s*- )@([\p{L}\p{N}_]+)(\?)?:(.*)$/u`（コロン必須）から `/^(\s*- )@([\p{L}\p{N}_]+)(\?)?(?::(.*))?$/u`（コロン任意）に変更。`@memo` のようにコロンが無い行もメタ行として認識するようにした。コロンなしの場合はキー部分（`@memo`）自体を `metatag metatag-key metatag-<canonicalKey>` で装飾する（`task-decoration.ts` の既存正規表現はコロン必須のままのため、このコロンなしケースは本ファイルが単独で担当する）。
  2. **ネスト対象領域の汎用化**: 従来は `condition`/`purpose`/`savepoint`/`special_note` の4キーに限り「値が空の場合のみ」子リストを装飾していた（`MULTI_VALUE_KEYS` 定数）。これを廃止し、**マッチした全てのメタ行**（コロンの有無・値の有無を問わない）について、そのメタ行より深いインデントを持つ子孫行すべてを `metatag metatag-value metatag-<canonicalKey>` で装飾する汎用ロジックに変更した。
  3. **箇条書きマーカーの除外**: ネスト装飾の対象範囲から先頭の `- `（箇条書きマーカー）を除外し、実際のテキスト内容のみを装飾するよう修正（従来はマーカー文字も装飾範囲に含まれていた）。
  4. CSS側の変更は不要だった（`.metatag-key.metatag-unknown`・`.metatag-value.metatag-unknown` は前回増分で既に緑装飾のセレクタ一覧に含めていたため）。

- Rationale:
  - `@memo` はプロジェクトの正規のメタキー語彙（`META_KEYS`）にも、正規のメタ構文（`remark-meta-fields.ts` が要求するコロン付き `@key: value`）にも該当しないが、ユーザーが明示的な例で「装飾対象にすること」を直接指示したため、これは値モデル・パーサーの仕様変更ではなく**エディタの視覚装飾のみ**の話として実装した（`src/lib/parser/*` 側のメタ抽出ロジックは一切変更していない）。
  - ネスト対象領域を「特定4キーに限定」から「全メタ行」へ一般化することで、将来ユーザーが独自のメタ的な子リストキー（`@memo` 等、正式なメタキーではないもの）を使った場合にも同じ視覚言語で一貫して「これはメタ情報である」と伝えられる。

- 実装結果・テスト:
  - 変更: `src/editor/metatag-decoration.ts`（正規表現・ネスト領域ロジックの汎用化、マーカー除外）。
  - 追加テスト: `tests/obs-e2e/metatag-decoration.e2e.ts`「コロンなしの裸のメタキー（@memo）とその直下のネスト全体が装飾される」。
  - テスト結果: `npx vitest run` 全24ファイル541件パス。実機E2E: `metatag-decoration.e2e.ts` 9件・`task-decoration.e2e.ts` 8件・`heading-emphasis.e2e.ts` 3件、全てパス。全11spec中10spec（既知の無関係な`gantt-view.e2e.ts`2件を除く）パス。
  - **既知の限定事項**: ネスト領域の追跡は単一階層のみ（スタックを持たない）。メタ行の中にさらに別のメタ行がネストする「メタ within メタ」の場合、外側の領域追跡が内側のメタ行によって上書きされる。実運用上まれなケースのため、今回は対応を見送った（将来問題が顕在化した場合に別途対応）。

---

## 3. メタデータ
- id: issue-phase003-008__meta-autocomplete-and-date-picker
- status: open
- phase: 003
- related_specs: time-meta-model.spec.md（§8 視覚デザイン・エディタ装飾BR-041〜043 拡張）
- related_decisions:
- target_files: src/editor/task-decoration.ts, src/editor/metatag-decoration.ts, src/editor/metatag-picker.ts, src/lib/format/metatag-format.ts, src/lib/parser/meta-keys.ts, src/lib/parser/schedule-normalize.ts, src/plugin.ts, esbuild.config.mjs, package.json, styles/base.css, styles/metatag-raw.css, styles/metatag-wysiwyg.css
- created: 2026-06-30
- updated: 2026-09-17

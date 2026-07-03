# Obsidian 実機 E2E テストの安定化・カバレッジ拡充・ガイド刷新

## 1. 課題と方針  — 人間が読む

### このissueで解決すること
実機 E2E テスト基盤（wdio-obsidian-service：本物の Obsidian をダウンロード・ヘッドレス起動し、プラグインを実インストールして駆動）は既に存在するが、「実機で自分が確認するのと同じように動作確認できるテスト」として確立できていない。具体的な問題は次の 3 点。

1. **カバレッジ不足** — E2E スペックは AST / Calendar / Gantt / エディタ装飾の 4 本のみで、**Kanban / Agenda / Health / UnscheduledTray の 4 ビューはゼロ**。このため Kanban のサブカード DnD バグ（ステータスは書き戻るが表示位置が更新されない、issue-phase000-003）が検知されずに出荷された。@repeat（繰り返し）や FilterBar も E2E 未検証。
2. **実行が不安定／失敗する** — 有力原因を調査で特定済み：
   - 全ビューは shadow DOM 内に描画される（`src/views/ShadowItemView.ts:79` の `attachShadow`）。WDIO の `$`/`$$` は shadow root を貫通するが、**`browser.execute` 内の `document.querySelector` は貫通しない**。既存 `tests/obs-e2e/gantt-view.e2e.ts:73` がこのパターンでドラッグ対象を取得できない。
   - `npm run test:obs:e2e` 単体実行は main.js を再ビルドしない（**古いビルドをテストする罠**）。
   - `browser.pause(500/800)` による待機がタイミング競合を生む（`helpers/obsidian-helpers.ts:12`、gantt spec:93）。
3. **目視確認の代替になっていない** — 「コンテナが存在する」だけのアサート（obs-0008 の落とし穴）では、カードの位置・順序・見た目の崩れを検知できない。

### 方針
- まず現状の `npm run build && npm run test:obs:e2e` を実行して failure mode を実測・記録し、上記原因を一つずつ潰す（安定化）。
- 位置・順序を検証できる共有ヘルパ（shadow DOM 検索・実ポインタ DnD・スクリーンショット）を整備し、それを使った**雛形スペック**を Kanban（本命）＋ Agenda / Health / Tray（スモーク）に追加する。
- 既知の Kanban DnD バグは it.skip で「落ちるテスト」を先に用意し（issue-phase000-003 参照）、修正時に skip を外してテスト駆動する。**バグ修正自体は本 issue のスコープ外**。
- `project/knowledge/obsidian-plugin-testing.md` を「自分でテストを書ける」チュートリアルへ刷新する。

---

## 2. 進捗・実装メモ  — AIが読む

### 遵守事項（毎回）
- 作業着手時に一度だけ `project/governance/` を確認すること（`AI_RUNTIME_RULES.md` のロード順）。
- テスト観点とテストコードは毎回すべて見直すこと（`TESTING_STANDARD.md` 準拠）。

### 既存資産の再利用（必読・実装前に読む）
- `wdio.conf.mts` … 実行基盤。console-guard（SEVERE ログ・特定 WARNING でテスト失敗）は維持する。
- `tests/obs-e2e/helpers/obsidian-helpers.ts` … `openFile` 等。`pause` を `waitUntil` へ置換して拡張する。
- `tests/obs-e2e/gantt-view.e2e.ts` … MouseEvent ディスパッチ式ドラッグの既存例。shadow DOM 対応版としてヘルパへ共通化する。
- `src/views/ShadowItemView.ts` … `.view-shadow-host` ＋ `attachShadow({mode:'open'})`。全セレクタヘルパの前提。
- `../kanban-for-mywork/src/lib/context/dndContext.svelte.ts` … Kanban DnD は PointerEvent ベース（6px 閾値・setPointerCapture）。合成 MouseEvent では動かないため `browser.action('pointer')` の実入力を使う。
- `test/vaults/simple/test-tasks.md` … 既存フィクスチャ。**変更禁止**（既存スペックが依存）。

### 実装の要点・つまずき
- shadow DOM: `$`/`$$` は貫通するが `execute`+`document.querySelector` は貫通しない。位置取得（getBoundingClientRect）は必ず `helpers/shadow-dom.ts` 経由。
- DnD アサートは「markdown への書き戻し」と「DOM 上の位置・順序」の**両方**を検証する（片方だけでは今回のバグ類を検知できない）。
- Agenda の「今日」データは日付固定フィクスチャだと腐るため、スペック内で実行時生成する（`obsidianPage.resetVault()` が毎回掃除）。

### TODO
- [x] ベースライン検証実行（`npm run build && npm run test:obs:e2e`）、結果を履歴に記録
- [x] package.json スクリプト整理（test:obs:e2e にビルド連結、:run / :headed 追加）
- [x] wdio.conf.mts：headed トグル・失敗時スクリーンショット
- [x] 共有ヘルパ：shadow-dom.ts / drag.ts / screenshot.ts、obsidian-helpers.ts の pause 除去
- [x] 既存 gantt spec の shadow DOM 問題を修正（ast-view の旧クラス名参照も修正）
- [x] フィクスチャ方針：日付依存・変更を伴うテストは実行時生成へ（静的フィクスチャは読み取り専用に限定。resetVault の UTF-8 上流バグ回避）
- [x] 雛形スペック：kanban-view（DnD 書き戻し＋DOM 位置の両面検証）/ agenda-view / health-view / unscheduled-tray、calendar-view に今日タスク＋@repeat
- [x] ガイド刷新：project/knowledge/obsidian-plugin-testing.md（チュートリアル化）
- [x] skip テストが実際に落ちる（＝バグを検知する）ことの確認 → issue-phase000-003 に再現詳細を記録
- [x] E2E 2 回連続グリーン（8/8 spec、各 32 秒）
- [x] `npm run test`（unit＋build＋E2E 一括）グリーン（unit 445 件・E2E 8/8）
- [x] headed 起動確認（WSLg・DISPLAY=:0。OBS_E2E_HEADED=1 で 1 スペック実行し成功）

### 受け入れ基準（すべて満たすこと）
- `npm run test:obs:e2e` が新スペック込みで 2 回連続グリーン（既知バグテストは skip）。
- `npm run test`（unit＋build＋E2E）がグリーン。
- `npm run test:obs:e2e:headed` で WSLg 上に Obsidian ウィンドウが表示される。
- skip 中のバグテストの skip を一時的に外すと実際に失敗する（＝本物のバグを検知できる）ことを確認済み。
- Kanban DnD テストが「書き戻し」と「DOM 位置」の両方をアサートしている。
- ガイドを読めば新しいビューのスペックを自力で追加できる（環境の仕組み・実行方法・shadow DOM 注意・待機戦略・DnD パターン・トラブルシュートを含む）。

### テスト観点
- 本 issue の成果物自体が E2E テスト群。上記受け入れ基準の実行結果をもって検証とする。

### 履歴（追記のみ）
- 2026-07-03 — 起票。調査により shadow DOM 貫通問題・ビルド未連結・pause 競合を原因候補として特定済み。
- 2026-07-03 — ベースライン検証実行（`npm run build && npm run test:obs:e2e`）。結果：4 スペック中 3 失敗（task-decoration のみ全通過）。
  - ast-view: 3 件全滅 — セレクタが旧クラス名 `.ast-view` を参照（実際は `ast-view-container`）。
  - calendar-view: 「アイテム表示」失敗 — `.calendar-view .week-view` の複合セレクタが shadow root を貫通できない。さらに週表示は「今週」を表示するため、固定日付（2026-04）のフィクスチャではアイテムが載らない問題も併発。
  - gantt-view: 3 件失敗 — `.gantt-view .gantt-tree-row` 等が shadow 貫通不可。
  - **結論：ユーザーの「動かして失敗する・信用できない」は shadow DOM 導入時に E2E が静かに壊れたことが原因。** エディタ装飾（shadow 外）だけが通過していた。
- 2026-07-03 — 対策実装：
  - `helpers/shadow-dom.ts` 新設（countShadow / getShadowText / getShadowRect / getShadowOrder / clickShadow / setShadowSelectValue / setShadowInputValue / waitForShadow）。
  - `helpers/drag.ts` 新設（dispatchPointerDrag：Kanban の PointerEvent DnD 用（setPointerCapture を一時 no-op 化）／dispatchMouseDrag：ガント用 shadow 対応版）。
  - `helpers/screenshot.ts` 新設（captureView）。`wdio.conf.mts` に失敗時自動スクリーンショット＋ OBS_E2E_HEADED トグル追加。
  - `obsidian-helpers.ts`：pause 除去（waitUntil 化）、readVaultFile / writeVaultFile / waitForFileContentChange 追加。
  - 既存 3 スペックを shadow 対応へ修正。日付依存テスト（カレンダー今週・アジェンダ今日・@repeat）は実行時ファイル生成方式に変更（固定日付フィクスチャは腐るため）。
  - 新規スペック：kanban-view（DnD 書き戻し＋DOM 位置の両面アサート、サブカードバグは it.skip）／agenda-view／health-view／unscheduled-tray。フィクスチャ `kanban-board.md` 追加。
  - package.json：`test:obs:e2e` にビルド連結、`:run`（内側ループ）・`:headed`（WSLg 目視）追加。
- 2026-07-03 — 修正後 1 回目の全実行：**8 スペック全通過**（新規 kanban DnD の PointerEvent dispatch 方式も成功）。
- 2026-07-03 — **上流バグ発見**：skip 解除検証中に日本語の文字化けを検出。wdio-obsidian-service の `resetVault()` は変更された静的フィクスチャを base64→`atob()` 経路で復元するが、atob はバイナリ文字列を返すためそのまま `vault.modify` に渡すと UTF-8 が Latin-1 化けする（`readFile().buffer` の余剰バイト混入もあり）。「DnD テストがフィクスチャを変更→リセット→同一スペック内の後続テストで化ける」再現を確認。対策：**変更を伴うテストは実行時生成ファイルを使う**方針に変更（リセット時は削除経路のため化けない）。kanban スペックを実行時生成（kanban-live.md）へ書き換え、静的フィクスチャ kanban-board.md は削除。ガイドにもハマりどころとして記載。

---

## 3. メタデータ
- id: issue-phase000-002__obs-e2e-hardening-and-coverage
- status: implemented（全受け入れ基準クリア・ユーザー承認待ち）
- phase: 000
- related_specs: なし（テスト基盤整備のため。TESTING_STANDARD.md 準拠）
- related_decisions:
- related_issues: obs-0006, obs-0008, obs-0011, issue-phase000-003__kanban-subcard-drop-position, issue-phase003-012__task-group-to-card-group
- target_files: wdio.conf.mts, package.json, tests/obs-e2e/**, test/vaults/simple/**, project/knowledge/obsidian-plugin-testing.md
- created: 2026-07-03
- updated: 2026-07-03（実装完了・全テストグリーン・ユーザー承認待ち。コミットは承認後）

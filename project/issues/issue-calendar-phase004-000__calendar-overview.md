# [calendar] Phase 004 憲章 — カレンダーライブラリの目的・実行順・実装規約

> **これは実装 Issue ではない。** `issue-calendar-phase004-*` に着手する前に、**必ず ①本体リポジトリの `project/governance/`、②共通憲章 `issue-phase004-000__phase-overview.md`、③本ファイル** の順に読むこと。フェーズ共通の事項は**共通憲章が正**であり、本ファイルには複製しない。

## 1. このフェーズでの calendar のゴール

現状の calendar は schedule イベントを描くだけ。Phase 004 完了時には:

- **タスク（左ボーダー）／予定 appointment（枠線ゴースト）／打合せ meeting（塗り）／期限 deadline（太線＋左端 ◄）** が「うるさくない」形で見分けられる。オーナーの一貫した要望は**色を増やさず形で区別**すること。
- 仮置き（半透明+?）が確定と見分けられる。
- 週末・祝日が色分けされる。
- `plan` prop の**受け口だけ**持つ（描画しない — オーナー決定。将来表示を足すとき型変更が不要になる布石）。

種別の判定（チェックなし＋schedule=appointment、タグ=meeting 等）は**本体の責務**（issue-phase004-004）。calendar は `type` / `tentative` / `holidays` / `weekend` を受けて描くだけ。

## 2. Issue 実行順（このリポジトリ内は直列を推奨）

```
001 meeting 種別と描き分け   ← 最初（type union 拡張が他の前提。全分岐箇所の洗い出しを含む）
002 deadline 太線＋◄ 描画    ← 001 の後（種別クラス設計に乗る）
003 仮置き＋plan 受け口      ← 001/002 の後（全種別に tentative クラスを併存させるため）
004 週末・祝日色            ← 独立。ただし gantt-006 が先行済みなら dayKind をそこから読み写す
```

## 3. calendar 固有の実装規約（全 Issue 共通）

1. **日付は ISODate 文字列**: このライブラリの日付表現は `calendarDate.ts` の ISODate（YYYY-MM-DD 文字列）ベース。祝日照合・日付比較は文字列同士で行い、Date オブジェクト経由の変換（TZ ズレの温床）を挟まない。
2. **type union の拡張は全分岐を洗う**: `CalendarItem.type` を switch/分岐している箇所（WeekView / MonthView のクラス決定・factories・validation）は**文字列分岐なので黙って素通りする**。grep で `'appointment'` `'deadline'` の全参照を洗い出してから触ること（001 に詳細）。
3. **EventEditDialog の再構築罠**: 編集ダイアログが item を作り直す実装の場合、新フィールド（tentative / plan / 新 type）が**保存時に消える**。フィールド追加をしたら必ずダイアログ保存経路のテストを書くこと（003 に詳細）。
4. **shadow root 対応の DOM 検索**: WeekView には `getRootNode()` で shadow root を解決する既存パターンがある（744 行付近）。DOM 検索を追加するときは同じパターンを踏襲。`document.querySelector` 直書きは本体（shadow DOM 内マウント）で壊れる。
5. **色は CSS 変数**（`--calendar-*` 系）。ハードコード禁止。うるさくしない: 新要素の彩度・コントラストは既存要素より控えめに。
6. **dayKind 規約は gantt と統一**: `holidays: string[]`（YYYY-MM-DD）/ `weekend: number[]`（1=月〜7=日）。両リポジトリで同一のテストケース・同一の期待値を持つこと（規約が割れると本体の供給コードが分岐する）。
7. **検証は二段**: lib 内テスト＋本体 `npm run test:obs:e2e`。E2E の注意は本体 `project/knowledge/obsidian-plugin-testing.md`（カレンダーの「今週」表示は日付固定フィクスチャが腐るため実行時生成を使う、等）。

## 4. メタデータ
- id: issue-calendar-phase004-000__calendar-overview
- status: active（フェーズ期間中は常時参照）
- phase: 004
- target_repo: ../calendar-for-mywork
- related_issues: issue-phase004-000（共通憲章・正）, issue-calendar-phase004-001〜004
- created: 2026-07-04
- updated: 2026-07-04

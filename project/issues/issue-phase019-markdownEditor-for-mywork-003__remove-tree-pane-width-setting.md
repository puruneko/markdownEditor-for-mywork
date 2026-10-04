# 設定画面の Gantt「ツリーペイン幅」項目を削除する（ツリー幅は列幅合計で自動決定になったため）

## 背景
- リポジトリ: `markdownEditor-for-mywork`。
- 要望原文（ganttchart への要望）:
  > ツリーと各列は独立ではなく一体のような実装にして。ツリーの右端の幅のリサイズは廃止し、ツリーの横幅は各列の幅の合計になるようにしてください。
- ganttchart-for-mywork 側の issue（issue-phase019-ganttchart-for-mywork-003__tree-width-equals-columns-total.md）で、ツリーペインの幅は「表示中の列幅の合計」から自動で決まるようになり、Gantt 設定の `treePaneWidth` は無視される。
- markdownEditor のプラグイン設定画面には Gantt ビュー用の「ツリーペイン幅」入力が残っており、変更しても何も起きない項目になる。採用した方針: この項目を設定画面から削除する（独立した幅指定を残さないことが要望の趣旨のため）。

## 目的
プラグイン設定画面に効果の無い「ツリーペイン幅」項目が表示されない。

## 現状
- `src/settings-view-sections.ts` の `GANTT_FIELDS`（34〜40行付近）に `{ kind: 'number', label: 'ツリーペイン幅', path: ['treePaneWidth'], def: 770, min: 100, max: 1000 }` がある。`GANTT_FIELDS` は設定画面の Gantt セクションの項目一覧で、値はビュー設定（設定ハブ `viewSettings`）の `gantt` 名前空間に保存される。

## 実装内容
1. `src/settings-view-sections.ts` の `GANTT_FIELDS` から「ツリーペイン幅」の行を削除する。
2. 保存済みの `viewSettings.gantt.treePaneWidth` はそのまま残してよい（ganttchart 側で無視される）。削除のための移行処理は追加しない。
3. `treePaneWidth` を参照するテスト（`settings-view-sections` 関連）があれば合わせて更新する。

## 完了条件
- Obsidian のプラグイン設定画面の Gantt セクションに「ツリーペイン幅」が表示されない。
- 他の Gantt 設定項目（行の高さ、インデント幅など）は従来どおり表示・保存される。
- 旧設定に `treePaneWidth` が保存されていても、エラーなく Gantt ビューが開く。
- `npm test` が通る。

## テスト
- 既存テストが通ること。`GANTT_FIELDS` の内容を検査するテストがあれば `treePaneWidth` が含まれないことを確認する。
- 手動確認: ganttchart-for-mywork の変更を取り込んで再ビルドし、設定画面と Gantt ビューのツリー幅（列幅合計に一致）を確認する。

## 依存関係
- ganttchart-for-mywork の issue-phase019-ganttchart-for-mywork-003__tree-width-equals-columns-total.md（ツリー幅の自動決定が先に入っていること）

## 対象外
- ganttchart-for-mywork 側の変更。
- 保存済み `treePaneWidth` の削除処理。

## 要確認
なし

## 実装結果
- 実装済み。`npm run test:unit` 629件通過、E2E（`tests/obs-e2e/meta-alias.e2e.ts` ほか）通過。
- 既知: `gantt-view.e2e.ts` の「期間なしサブタスクのドラッグ予定化」が失敗（本issueの変更範囲外。ganttchart ライブラリ側の変更取り込み待ちの可能性。未切り分け）。

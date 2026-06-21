# obs-0014: ガントバードラッグ不具合修正

## ステータス

Closed

## 概要

ガントチャートのバーをドラッグしても、バーが視覚的に動かず、markdown の `@schedule` も更新されない。

## 根本原因

### 原因 1（致命的）: `onBarDragEnd` がコンポーネント階層を通じて配線されていない

obs-0013 で `drag-handler.ts` と `GanttTab.svelte` の修正は完了したが、ライブラリ側の中間コンポーネント（`GanttTimeline.svelte` / `GanttChart.svelte`）への配線が未実施だった。

```
drag-handler.ts         → GanttTimeline.svelte   → GanttChart.svelte   → GanttTab.svelte
deps.getParams()           getParams() に             handleBarDragEnd      onBarDragEnd
.onBarDragEnd?.()          含まれていない ❌           が存在しない ❌        は実装済み ✓
```

- `drag-handler.ts:93`: `deps.getParams().onBarDragEnd?.()` を呼ぼうとするが常に `undefined`
- `GanttTimeline.svelte:88-96`: `getParams()` に `onBarDragEnd` が含まれない
- `GanttTimeline.svelte`: `onBarDragEnd` prop が存在しない
- `GanttChart.svelte:652-668`: `<GanttTimeline>` に `onBarDragEnd` を渡していない

### 原因 2（副次的）: controlled モードでドラッグ中にバーが視覚的に動かない

- `GanttChart.svelte` の `handleBarDrag`（line 256-267）は `uncontrolled` モードのみストアを更新
- `controlled` モードでは `handlers.onBarDrag` を呼ぶだけ
- `GanttTab.svelte` の `onBarDrag` は空ハンドラー → バー位置が変わらない

## TODO

- [ ] `GanttTimeline.svelte` に `onBarDragEnd` prop を追加し `getParams()` に含める
- [ ] `GanttChart.svelte` に `handleBarDragEnd` 関数を追加し `<GanttTimeline>` に渡す
- [ ] `GanttChart.svelte` の `handleBarDrag` を controlled モードでも視覚プレビュー更新するよう修正
- [ ] E2Eテスト・機能テストを見直し、ガントバー描画とドラッグカバレッジを追加する
- [ ] 全テスト実行・パス確認

## 完了条件

- ガントバーをドラッグ中に視覚的にバーが動くこと
- ドラッグ確定（mouseup）後に markdown の `@schedule` が更新されること
- 全テスト（ユニット + E2E）パス

## History

- 2026-03-26: 実装完了・Closed
  - `GanttTimeline.svelte`: `onBarDragEnd` prop を追加、`getParams()` に含める
  - `GanttChart.svelte`: `handleBarDragEnd` 関数を追加、`<GanttTimeline>` に渡す
  - `GanttChart.svelte`: `handleBarDrag` を全モードでストア更新（視覚プレビュー）するよう修正
  - `gantt-view.e2e.ts`: バー描画確認テストとドラッグ→markdown更新の回帰テストを追加
  - 全14テスト（E2E）PASS、ユニットテスト（ganttchart-for-mywork）変更なし

## 関連ファイル

- `ganttchart-for-mywork/src/components/GanttTimeline.svelte`
- `ganttchart-for-mywork/src/components/GanttChart.svelte`
- `markdownEditor-for-mywork/tests/obs-e2e/gantt-view.e2e.ts`

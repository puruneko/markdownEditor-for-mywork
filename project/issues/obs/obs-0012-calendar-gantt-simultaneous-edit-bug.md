# obs-0012: カレンダー/ガント移動時の複数予定同時編集バグ

## ステータス

Closed

## 概要

カレンダーでアイテムをドラッグ移動すると、別の予定も同時に編集される。ガントチャートでバーをドラッグした場合も同様の問題が発生する。

## 根本原因

プラグイン側のバグ。`src/lib/calendar/markdown-patch.ts` の `patchSchedule()` 関数が `@schedule:` 行を**スケジュール値の文字列一致のみ**で全行走査・全件置換しているため、同一のスケジュール値を持つ複数タスクが存在すると全件置換される。

```typescript
// 問題のある実装
export function patchSchedule(md: string, oldSchedule: string, newSchedule: string): string {
  return md.split('\n').map(line => {
    if (line.trimStart() === `@schedule: ${oldSchedule}`) {
      return line.replace(oldSchedule, newSchedule)  // 全一致行を置換してしまう
    }
    return line
  }).join('\n')
}
```

呼び出し元の問題:
- `CalendarTab.svelte:handleItemMove` — `item.id` を持っているが `findNodeById` を呼ばず値だけ渡す
- `CalendarTab.svelte:handleItemResize` — 同上
- `CalendarTab.svelte:handleItemUpdate` — `findNodeById` でノード取得済みだが `patchSchedule` に値だけ渡す
- `GanttTab.svelte:onBarDrag` — `findNodeById` でノード取得済みだが `patchSchedule` に値だけ渡す

## 再現ケース

```markdown
- [ ] タスクA
  @schedule: 2026-04-01T10:00/2026-04-01T12:00
- [ ] タスクB
  @schedule: 2026-04-01T10:00/2026-04-01T12:00
```

タスクAをカレンダー上でドラッグ → `patchSchedule` が両方の `@schedule` 行を置換 → タスクBも同時に移動する。

## TODO

- [x] `patchSchedule()` を廃止し `patchScheduleForNode(md, node, newSchedule)` を追加する
- [x] `CalendarTab.svelte` の `handleItemMove`/`handleItemResize`/`handleItemUpdate` を `patchScheduleForNode` に移行する
- [x] `GanttTab.svelte` の `onBarDrag` を `patchScheduleForNode` に移行する
- [x] `markdown-patch.test.ts` にバグ再現テスト・新関数テストを追加する
- [x] 全テスト実行・パス確認（91テスト全パス、ビルドエラーなし）

## 完了条件

- 同一スケジュール値を持つ2タスクのうち片方のみ移動したとき、もう片方のスケジュールが変更されないこと
- 全ユニットテストパス
- ビルドエラーなし

## History

- 2026-03-25: 実装完了・Closed
  - `patchSchedule()` を廃止し、タスクタイトル行をアンカーとする `patchScheduleForNode(md, node, newSchedule)` を実装
  - `CalendarTab.svelte` の `handleItemMove`/`handleItemResize`/`handleItemUpdate` を移行
  - `GanttTab.svelte` の `onBarDrag` を移行
  - `markdown-patch.test.ts` にバグ再現テスト含む6テストケース追加
  - 91ユニットテスト全パス確認

## 関連ファイル

- `src/lib/calendar/markdown-patch.ts`
- `src/lib/calendar/CalendarTab.svelte`
- `src/lib/gantt/GanttTab.svelte`
- `src/lib/calendar/markdown-patch.test.ts`

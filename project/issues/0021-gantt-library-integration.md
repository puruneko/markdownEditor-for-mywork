# svelte-gantt-lib ライブラリの導入

## Status

done

---

## Summary

ガントチャート表示に使用する `ganttchart-for-mywork` ライブラリ（svelte-gantt-lib）をプロジェクトに導入し、ビルドが通ることを確認する。

---

## Current Direction

- `ganttchart-for-mywork` を git リポジトリからcloneし、ビルドする
- package.json に `svelte-gantt-lib` を file: 依存として追加する
- vite.config.ts の alias に svelte-gantt-lib のソース直コンパイル設定を追加する（カレンダーと同じSvelteバージョン不一致対策）
- optimizeDeps.exclude に svelte-gantt-lib を追加する
- ビルドが通ることを確認する

---

## TODO

* [x] `/tmp/ganttchart-for-mywork` でビルド（npm install && npm run build）
* [x] package.json に svelte-gantt-lib (file:) を追加する
* [x] vite.config.ts の resolve.alias に svelte-gantt-lib のソース直コンパイル設定を追加する
* [x] vite.config.ts の optimizeDeps.exclude に svelte-gantt-lib を追加する
* [x] npm run build で成功確認
* [x] 型チェックでガントチャート関連エラーなし確認

---

## Notes (Append Only)

* 2026-03-22 -- Issue作成。ガントチャートライブラリ: https://github.com/puruneko/ganttchart-for-mywork.git
* 2026-03-22 -- カレンダーライブラリ(#0014)と同じSvelteバージョン不一致対策が必要な見込み。resolve.aliasでsrcから直接コンパイルする方式を採用予定。

## History

### 2026-03-22 19:30

- User Instruction:
  - ガントチャート統合の実装計画・issue作成依頼

- Change:
  - Issue新規作成

- Rationale:
  - #0014（カレンダーライブラリ導入）と同じパターンで導入する

### 2026-03-22 21:30

- User Instruction:
  - 0019-0024の実装依頼

- Change:
  - /tmp/ganttchart-for-mywork をビルド
  - package.json に svelte-gantt-lib (file:) を追加
  - vite.config.ts に resolve.alias と optimizeDeps.exclude を追加
  - npm run build で成功確認

- Rationale:
  - svelte-gantt-lib の dist は Svelte 5 のバージョンが異なる可能性があるため、#0014と同じソース直コンパイル方式を採用

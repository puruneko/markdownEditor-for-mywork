# calendar-for-mywork ライブラリの導入

## Status

proposed

---

## Summary

カレンダー表示に使用する `calendar-for-mywork` ライブラリ（svelte-calendar-lib）をプロジェクトに導入し、ビルドが通ることを確認する。

---

## Current Direction

- `calendar-for-mywork` を git リポジトリから依存として追加する
- `luxon` と `@types/luxon` を依存に追加する（calendar-for-myworkが必要とする）
- Vite + Svelte 5 環境で正しくインポート・ビルドできることを確認する
- カレンダーライブラリのバージョン互換性を確認する（Svelte 5対応）

---

## TODO

* [x] `/tmp/calendar-for-mywork` でビルド（npm install && npm run build）
* [x] package.json に svelte-calendar-lib (file:)、luxon、@types/luxon を追加
* [x] vite.config.ts の optimizeDeps.exclude に svelte-calendar-lib を追加
* [x] npm run build で成功確認
* [x] 型チェックでカレンダー関連エラーなし確認
* [x] Svelte バージョン不一致による実行時エラーを修正（Viteエイリアスでsrcから直接コンパイル）
* [x] E2Eテストでカレンダー表示動作確認済み（JSエラーなし）

---

## Notes (Append Only)

* 2026-03-22 -- Issue作成。カレンダーライブラリ: https://github.com/puruneko/calendar-for-mywork.git
* 2026-03-22 -- 実装完了。注意事項: dist/index.js に `createCalendarItem` 等のファクトリ関数は含まれない（Svelte component のみバンドル）。CalendarItem は直接型に合わせたオブジェクトを作成する方式で対応。
* 2026-03-22 -- バグ修正: dist/index.js はSvelte 5.51.2でビルド済み。実行時のSvelteは5.54.1のため内部API不一致で "Cannot read properties of undefined (reading 'call')" が発生。resolve.alias で `svelte-calendar-lib` を `src/index.ts` に向けることで本プロジェクトのSvelteでコンパイルするよう変更。

## History

### 2026-03-22 14:30

- User Instruction:
  - Phase1-4 全実装の依頼

- Change:
  - /tmp/calendar-for-mywork でビルド
  - npm install で file: 依存として追加
  - luxon を runtime dependency に追加

- Rationale:
  - dist に含まれない関数はプレーンオブジェクト生成で代替。型定義のみ利用。

### 2026-03-22 14:42

- User Instruction:
  - カレンダーが表示されない / コンソールエラー確認依頼

- Change:
  - vite.config.ts の resolve.alias を regex完全一致でsrc/index.tsに向けるよう変更
  - Vite test.include/exclude 設定追加（E2EテストファイルをVitestから除外）
  - Playwright E2Eテスト8件追加

- Rationale:
  - Svelteバージョン不一致（ビルド5.51.2 vs 実行5.54.1）による内部API破壊が原因
  - ソース直コンパイルで完全に回避

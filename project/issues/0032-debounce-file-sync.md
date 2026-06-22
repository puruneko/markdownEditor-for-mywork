# file-sync.ts へのデバウンス導入

## Status

done

---

## Summary

unified パーサーは自前パーサーより処理コストが高いため、ファイル変更イベントのたびに即時パースするのではなく、入力が止まってから一定時間後にパースするデバウンスを `file-sync.ts` に導入する。

---

## Current Direction

- `src/sync/file-sync.ts` の `parseFile` 呼び出しを 300ms デバウンスで包む
- デバウンス時間は定数として定義する（将来の調整を容易にする）
- プラグインのアンロード時（`onunload`）にペンディング中のタイマーをキャンセルする
- デバウンス前後でリアルタイム性の変化を確認するE2Eテスト、またはコメントで動作を明示する

---

## TODO

* [ ] `file-sync.ts` に `debounceTimer` フィールドを追加する
* [ ] `parseFile` の呼び出しを `clearTimeout` + `setTimeout(300)` で包む
* [ ] `onunload` で `clearTimeout` を呼ぶ
* [ ] デバウンス定数（`PARSE_DEBOUNCE_MS = 300`）を定義する
* [ ] E2Eテストでファイル変更後にビューが更新されることを確認する

---

## Notes (Append Only)

* 2026-06-22 -- Issue作成。#0025（パッケージ導入）に依存。#0033（差し替え）の前提。unified移行フェーズ4。
* デバウンスは unified 移行と独立して先行実装可能。
* 2026-06-22 -- 実装確認: `file-sync.ts` に既にデバウンス（debounceTimer / debounceMs / clearTimeout）が実装済みだった。plugin.ts から `this.settings.debounceMs` を渡して構築している。新規実装不要。

## History

### 2026-06-22

- User Instruction:
  - unifiedを使ったパーサー書き直しの移行issueを細粒度で起票

- Change:
  - Issue新規作成

- Rationale:
  - unified は自前パーサーの3〜10倍重い。デバウンスなしで毎キーストロークにパースすると100ms以上のブロッキングが発生しうる。

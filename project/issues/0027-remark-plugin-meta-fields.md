# remarkプラグイン：@meta: フィールドの抽出と除去

## Status

done

---

## Summary

`- @schedule: ...` や `- @due: ...` などのメタフィールド行を mdast 上で検出し、親 listItem の `data.meta` に格納したうえでツリーから除去するカスタム remark プラグインを実装する。

---

## Current Direction

- メタフィールドのラベル文字列（`schedule`・`due`・`priority`・`dependsOn`・`tags`）は `META_KEYS` 定数オブジェクトとして `src/lib/parser/meta-keys.ts` に定義し、プラグイン・変換レイヤー・シリアライザから参照する
- `listItem` ノードの子を検査し、`/^@(\w+):\s*(.*)$/` にマッチするテキストを持つ listItem を検出する
- マッチした場合、`META_KEYS` に定義されたキーのみを親ノードの `data.meta` に格納する
- メタフィールド listItem はツリーから除去する（シリアライズ時に再付与するため）
- `normalizeSchedule`・`normalizeDue`（既存の `src/lib/parser/schedule-normalize.ts`）を再利用する
- 混在インデント（2sp シリアライザ出力 + Obsidianタブ入力）により @meta 配下に誤って子が入った場合でも、その子を親に再注入する処理を含める

---

## TODO

* [ ] `src/lib/parser/meta-keys.ts` を新規作成し `META_KEYS` 定数を定義する
* [ ] `src/lib/parser/plugins/remark-meta-fields.ts` を新規作成する
* [ ] 親 listItem の `data.meta` にメタ値を格納するプラグインを実装する
* [ ] 誤ネスト子の再注入ロジックを実装する
* [ ] `schedule-normalize.ts` の既存関数を再利用する
* [ ] ユニットテストを実装する（各メタキーが正しく抽出・除去されることを確認）

---

## Notes (Append Only)

* 2026-06-22 -- Issue作成。#0026（ステータスプラグイン）と独立して実装可能。unified移行フェーズ2。
* 2026-06-22 -- メタフィールドラベル（schedule等）を `META_KEYS` 定数に集約する方針を追加（後からのラベル変更を容易にするため）。
* 混在インデント問題は OBS-0029 で修正した既存ロジックを踏襲する。

## History

### 2026-06-22

- User Instruction:
  - unifiedを使ったパーサー書き直しの移行issueを細粒度で起票

- Change:
  - Issue新規作成

- Rationale:
  - @meta フィールドはプロジェクト固有の構文であり、remark-gfm では処理されない。カスタムプラグインとして独立実装することで単体テストを容易にする。

### 2026-06-22（修正）

- User Instruction:
  - メタデータラベル文字列を変数にまとめて後で編集しやすくしてほしい

- Change:
  - `META_KEYS` 定数を `src/lib/parser/meta-keys.ts` に定義する方針を追加
  - TODO に `meta-keys.ts` 新規作成を追加

- Rationale:
  - `schedule`・`due` 等のラベルが複数ファイルにハードコードされると変更時の修正コストが高い。

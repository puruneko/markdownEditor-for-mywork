# remarkプラグイン：カスタムチェックボックスステータスマーカー変換

## Status

done

---

## Summary

remark-gfm が処理した後の mdast listItem には `checked: boolean | null` しか存在しない。`[>]`（doing）・`[!]`（blocked）・`[-]`（hold）などのカスタムステータスマーカーを mdast ノードに付与するカスタム remark プラグインを実装する。

---

## Current Direction

- remark-gfm の処理後にカスタムプラグインとして動作する
- `listItem` ノードの先頭テキストを検査し、`/^\[([>!\-])\] /` にマッチする場合にカスタム属性 `data.taskStatus` を付与する
- `[ ]` → `todo`、`[x]`/`[X]` → `done` は remark-gfm の `checked` フィールドを使う
- `[>]` → `doing`、`[!]` → `blocked`、`[-]` → `hold` をカスタム属性で補完する
- テキストからステータスマーカー部分を除去してクリーンなテキストを残す

---

## TODO

* [ ] `src/lib/parser/plugins/remark-task-status.ts` を新規作成する
* [ ] `listItem` ノードを walk してカスタムマーカーを検出・変換するプラグインを実装する
* [ ] ユニットテストを実装する（各マーカーが正しく変換されることを確認）

---

## Notes (Append Only)

* 2026-06-22 -- Issue作成。#0025（パッケージ導入）に依存。unified移行フェーズ2。

## History

### 2026-06-22

- User Instruction:
  - unifiedを使ったパーサー書き直しの移行issueを細粒度で起票

- Change:
  - Issue新規作成

- Rationale:
  - remark-gfm は `[ ]`/`[x]` のみを `checked` フラグとして扱う。プロジェクト固有の `[>]`/`[!]`/`[-]` はカスタムプラグインで補完する必要がある。

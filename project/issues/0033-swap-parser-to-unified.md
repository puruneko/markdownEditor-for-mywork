# 新パーサーへの差し替えと統合テスト

## Status

done

---

## Summary

#0031 で並存実装した `parse-markdown-v2.ts` を本番コードに差し替える。`file-sync.ts` および他の呼び出し元が新パーサーを使うように変更し、既存の全テストが通ることを確認する。

---

## Current Direction

- `src/sync/file-sync.ts` の `import { parseMarkdown }` を新実装に切り替える
- 他の呼び出し元（`src/lib/parser/index.ts` 等）も新パーサーに向け直す
- 全ユニットテスト・E2Eテストを実行してリグレッションがないことを確認する
- スナップショットテストの期待値が新パーサー出力と一致することを確認する

---

## TODO

* [ ] `file-sync.ts` の import を `parse-markdown-v2.ts` に変更する
* [ ] 他の呼び出し元を確認して新パーサーに切り替える
* [ ] 全ユニットテストを実行してパスを確認する
* [ ] E2EテストでObsidianビュー（カレンダー・カンバン・ガント）が正常動作することを確認する

---

## Notes (Append Only)

* 2026-06-22 -- Issue作成。#0031（新API）・#0032（デバウンス）に依存。unified移行フェーズ5。

## History

### 2026-06-22

- User Instruction:
  - unifiedを使ったパーサー書き直しの移行issueを細粒度で起票

- Change:
  - Issue新規作成

- Rationale:
  - 並存期間を経て十分なテストを確認してから差し替えることでリスクを最小化する。

# nodeLineMap の mdast position ベース構築

## Status

done

---

## Summary

既存の `buildNodeLineMap` は手動でトークナイズした `lineNumber` フィールドに依存している。unified 移行後は mdast の `position.start.line` を使って `nodeLineMap`（id → 0-based 行番号）を構築する関数に置き換える。

---

## Current Direction

- `buildNodeLineMap(sections: Section[]): Map<string, number>` のシグネチャは変えない（呼び出し元への影響ゼロ）
- 各 `TaskNode`・`ListNode`・`QuoteNode`・`Section` の `lineNumber` フィールドは #0028・#0029 で mdast position から設定済みである前提とする
- 既存の walk ロジック（section → nodes → children 再帰）は変更不要なため、関数自体は現行実装を流用する
- mdast position が 1-based であることを踏まえ、#0028・#0029 側で 0-based 変換が完了していることを単体テストで保証する

---

## TODO

* [ ] `buildNodeLineMap` のユニットテストに「mdast position → lineNumber 変換が 0-based になっている」ケースを追加する
* [ ] #0028・#0029 のテストと組み合わせて lineNumber の整合性を確認する

---

## Notes (Append Only)

* 2026-06-22 -- Issue作成。#0028・#0029 に依存。unified移行フェーズ3。
* buildNodeLineMap 自体のロジック変更は不要。lineNumber の正確性保証がこの Issue の主目的。

## History

### 2026-06-22

- User Instruction:
  - unifiedを使ったパーサー書き直しの移行issueを細粒度で起票

- Change:
  - Issue新規作成

- Rationale:
  - エディタクリック→行フォーカスの機能（nodeLineMap）はユーザーが最も気づきやすい機能。lineNumber精度の保証を独立Issueで明示する。

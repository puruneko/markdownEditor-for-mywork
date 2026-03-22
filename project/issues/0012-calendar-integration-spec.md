# カレンダー連携仕様（Spec）の策定

## Status

open

---

## Summary

カレンダー統合機能の仕様書（Spec）を `project/specs/` に作成する。
AST → CalendarItem変換ルール、カレンダーからMarkdownへの逆変換ルール、タブUIの振る舞いを定義する。

---

## Current Direction

以下の振る舞いを仕様として定義する:

1. `meta.schedule` を持つタスクノードのみカレンダー表示対象とする
2. schedule形式: `YYYY-MM-DDTHH:mm/YYYY-MM-DDTHH:mm`（開始/終了）
3. カレンダー上の変更はAST経由でMarkdown文字列を更新する（Markdownが唯一の正の情報源）
4. カレンダーとASTはタブで切り替え表示する
5. CalendarItem のidはASTノードのidと一致させ、逆引き可能とする

---

## TODO

* [ ] Spec ファイル `project/specs/calendar-integration.spec.md` を作成する
* [ ] 変換ルール（AST → CalendarItem）の BR を定義する
* [ ] 逆変換ルール（カレンダー変更 → Markdown更新）の BR を定義する
* [ ] タブUIの振る舞い BR を定義する
* [ ] エッジケース（schedule未設定、不正形式等）の BR を定義する

---

## Notes (Append Only)

* 2026-03-22 -- Issue作成。カレンダー統合の全issueの前提となるSpec。

# unified/remark パッケージインストールと型環境整備

## Status

done

---

## Summary

unified エコシステムへのパーサー移行に向けて、必要なパッケージをインストールし、TypeScript型定義が正しく解決されることを確認する。

---

## Current Direction

- `unified`, `remark`, `remark-gfm`, `remark-parse` をインストール
- `@types/mdast` をインストール（mdast型定義）
- `package.json` の依存関係を確認し、既存の型と競合しないことを検証する
- インストール後に `tsc --noEmit` でコンパイルエラーがないことを確認する

---

## TODO

* [ ] `unified`, `remark`, `remark-parse`, `remark-gfm` をインストール
* [ ] `@types/mdast` をインストール
* [ ] `tsc --noEmit` でコンパイルエラーがないことを確認する

---

## Notes (Append Only)

* 2026-06-22 -- Issue作成。unified移行フェーズ1。パッケージ導入のみで実装は行わない。

## History

### 2026-06-22

- User Instruction:
  - unifiedを使ったパーサー書き直しの移行issueを細粒度で起票

- Change:
  - Issue新規作成

- Rationale:
  - 自前パーサー（md-to-ast.ts）は正規表現とインデント手動処理によりバグを踏みやすい構造。unifiedへの移行で堅牢性を高める。

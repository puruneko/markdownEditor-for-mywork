# 新メタキー追加時の5ファイル チェックリスト

（issue-phase010-markdownEditor-004。MARKDOWN-006 は preIssue 作成時に導出された内部リファクタ項目であり、ユーザー要望ではない。）

## 背景

メタ行（`- @key: value`）を解釈・装飾・検証する正規表現が、目的の異なる5ファイルに重複して存在する。
新しいメタキーを追加するとき、この5ファイルのうち1つでも更新を忘れると「エディタ上は緑色に装飾されるが lint は不正のまま」といった部分的な不整合が発生する。

**本ドキュメントは現状の重複を解消する統一レジストリの実装ではない。** 新キー追加時に確認すべき5ファイルと、各ファイルのキー集合・Unicode（日本語キー）対応状況を一覧化するものである。

## 現在の正規カノニカルキー一覧（`src/lib/contract/canonical.ts` の `META_KEYS`）

```
plan, schedule, due, priority, dependsOn, tags, repeat, condition, purpose, savepoint, special_note, close
```

`close`（issue-phase010-markdownEditor-006 で追加）は真偽値フラグであり、値の内容に関わらずキーの
存在自体が `true` を意味する。ノード（task/list）レベルでは単なるフラグだが、Section（見出し）
レベルでは `Section.close`（専用の真偽値フィールド。`Section.meta` には含まれない）に昇格される。

`memo`（同 issue で追加）は `META_KEYS`・`applyMetaKey` の対象キーではない。`- @memo: ...` という
リスト項目記法としては解析されない。直下（子リストの中ではなく直接の子）の引用（`>`）本文から
`meta.memo` として自動的に格納される、専用の派生フィールドである。

日本語エイリアス（`src/lib/parser/meta-keys.ts` の `META_KEY_ALIASES`）:

```
想定期間→plan, 実施日時→schedule, 期限→due, 完了イメージ→condition, 目的→purpose,
セーブポイント→savepoint, 特記事項→special_note
```

## チェックリスト（5ファイル）

新しいメタキーを追加する際は、以下の5ファイルすべてを確認し、必要に応じて更新すること。

| # | ファイル | 役割 | キー集合の扱い | Unicode（日本語キー）対応 |
|---|---|---|---|---|
| 1 | `src/lib/parser/plugins/remark-meta-fields.ts:18`（`META_LINE_RE`）+ `applyMetaKey` の `switch` | パース（メタ値を `Meta` オブジェクトへ格納） | 正規表現自体は任意のキーにマッチするが、`applyMetaKey` の `switch` に `case` が無いキーは**実処理されず値が捨てられる**（`META_KEYS` の12キー〔`close` 含む。issue-phase010-markdownEditor-006 で追加〕のみ実処理。`memo` は対象外） | 対応（`[\p{L}\p{N}_]+` で日本語キーにマッチ） |
| 2 | `src/editor/task-decoration.ts:24`（`META_RE`） | エディタ装飾（キー部分の色付けのみ。値の意味は見ない） | 任意のキーを装飾する（キー集合の制限なし） | 対応（`[\p{L}\p{N}_]+`） |
| 3 | `src/editor/metatag-decoration.ts:29`（`META_LINE_RE`） | エディタ装飾（値のチップ表示・裸キー装飾） | 任意のキーを装飾する。コロンなしの裸キー（例 `@memo`）にも対応 | 対応（`[\p{L}\p{N}_]+`） |
| 4 | `src/editor/notation-lint.ts`（36行付近, `META_LINE_RE`） | Lint（値の形式検証） | **`plan\|schedule\|due\|priority\|tags\|dependsOn` の6キー固定列挙。`repeat`/`condition`/`purpose`/`savepoint`/`special_note` の5キーが対象外（lint されない）** | **非対応**（英字キー名の固定列挙のため、日本語エイリアスにはそもそもマッチしない） |
| 5 | `src/editor/reformat-meta-lines.ts:19`（`isMetaLine` の `META_LINE_RE`） | メタ行の推奨位置への並び替え判定 | 正規表現自体は任意のキーを「メタ行」と判定する（並び替えのみが目的でキー集合の制限は無いが…） | **非対応（`\w+` は ASCII 限定）。日本語キー（例 `- @実施日時:`）はメタ行として認識されず、並び替え対象から漏れる** |

## 新キー追加時の手順

1. `src/lib/contract/canonical.ts` の `META_KEYS` に新キーを追加する（カノニカル名を決める）。
2. 日本語表記を持たせる場合は `src/lib/parser/meta-keys.ts` の `META_KEY_ALIASES` にエイリアスを追加する。
3. 上表の5ファイルすべてを開き、新キーが要件どおりに扱われるか確認する。
   - `remark-meta-fields.ts`: `applyMetaKey` に `case META_KEYS.<新キー>:` を追加しないとパース結果に格納されない。
   - `task-decoration.ts` / `metatag-decoration.ts`: 正規表現が任意のキーにマッチするため、通常は追加作業不要（装飾のみのため）。
   - `notation-lint.ts`: 値の形式検証が必要なキーであれば、`META_LINE_RE` のキー一覧に追加し、対応する検証ロジック（`checkScheduleLikeValue` 等に相当するもの）を実装する。不要なら対応不要。
   - `reformat-meta-lines.ts`: ASCII 限定の `\w+` を使っているため、日本語エイリアスを持つキーは「メタ行」として認識されない（並び替え対象から漏れる）。この既知の制限を修正するかどうかは、新キー追加時に個別に判断する。
4. パーサ単体テスト（`src/lib/parser/parse-markdown.test.ts` 等）にフィクスチャを追加する。

## 明示的にスコープ外（本ドキュメントでは対応しない）

- 5ファイルの重複を解消する統一レジストリの実装。
- `notation-lint.ts` の6キー固定列挙の是正（`repeat`/`condition`/`purpose`/`savepoint`/`special_note` を lint 対象に加える改修）。
- `reformat-meta-lines.ts` の ASCII 限定正規表現（`\w+`）の是正。

これらはいずれも将来の別 issue で扱う。

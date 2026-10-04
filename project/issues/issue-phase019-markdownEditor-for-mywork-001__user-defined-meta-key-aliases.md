# 特殊メタ情報（@schedule 等）の別名をユーザーが設定画面で定義できるようにする

## 背景
- リポジトリ: `markdownEditor-for-mywork`（Obsidian プラグイン）。
- 要望原文:
  > メタ情報の別名をユーザで定義できるようにして
  > - schedule,planなど、mdパースで意味を持つ特殊メタ情報に別名をつける
  > - 拡張機能の設定画面で設定可能とする
  > - scheduleの既定値はscheduleで固定で変更できないものとする。ほかの特殊メタ情報も同様
  > - 別名の設定例
  >   - 「schedule -> 作業時間、やる時間」 → 「@schedule」と「@作業時間」と「@やる時間」は同じ意味
- 採用した解釈:
  - 対象キーは、パーサが意味を持たせているメタキー全部（`src/lib/contract/canonical.ts` の `META_KEYS`: plan / schedule / due / priority / dependsOn / tags / repeat / condition / purpose / savepoint / special_note / close）。原文が「schedule,planなど」「ほかの特殊メタ情報も同様」としているため。
  - 標準キー名（`schedule` 等）は常に有効で、削除・変更できない。ユーザーは各キーに別名を0個以上追加できる。
  - 既存の組込の日本語別名（`実施日時`→schedule 等）はそのまま残し、ユーザー別名と併用する（組込別名を消すと既存ノートの解釈が変わるため）。
  - 別名で書かれたメタ行は、パース結果（AST の `meta`）では標準キーとして扱う。既存行を書き換える処理（Gantt/Calendar からの日時更新）では、ユーザーが書いた別名をそのまま残す。

## 目的
`@作業時間: 2026-10-07T10:00/12:00` のように別名で書いたメタ情報が、`@schedule:` と同じ意味としてパース・装飾・日付ピッカー・Gantt/Calendar 連携で扱われる。

## 現状
- `src/lib/parser/meta-keys.ts`:
  - `META_KEY_ALIASES`（固定: 想定期間→plan、実施日時→schedule、期限→due、完了イメージ→condition、目的→purpose、セーブポイント→savepoint、特記事項→special_note）。
  - `normalizeMetaKey(raw)`: `raw in META_KEYS` ならそのまま、なければ `META_KEY_ALIASES[raw] ?? null`。
- `normalizeMetaKey` の利用箇所（ここは別名レジストリを足せば自動で対応する）:
  - `src/lib/parser/plugins/remark-meta-fields.ts:110`（パーサ。キー部分は `/^@([\p{L}\p{N}_]+)(\?)?:\s*(.*)$/u` で日本語可）。
  - `src/editor/task-decoration.ts:90`、`src/editor/metatag-decoration.ts:139`（装飾）。
- キー名を直書きしていて別名を認識しない箇所:
  - `src/editor/metatag-decoration.ts:228`（`openDatePickerForLine`）と `:263`（`maybeAutoOpenPicker`）: `/^(\s*- )@(plan|schedule|due)(\?)?:$/`。`keyNameEndOffset = m[1].length + 1 + key.length` でキー名の長さを使う。
  - `src/lib/patch/upsert-meta.ts` `upsertMeta(md, node, metaKey, value)`: 既存行を `- @${metaKey}?:` / `- @${metaKey}:` の前方一致で探す。別名の行（組込の日本語別名も）は見つからず、新しい `@schedule` 行を重複して追加してしまう。利用元: `src/lib/gantt/tree-cell-edit.ts`（`upsertSchedule/Plan/Due`）ほか。
  - `src/editor/notation-lint.ts`（Linter）は別 issue（issue-phase019-markdownEditor-for-mywork-002）で対応する。
- 設定: `src/settings.ts` の `MdAstEditorSettings` / `DEFAULT_SETTINGS` / `migrateSettings`（保存データの補正）/ `MdAstEditorSettingTab.display()`（h3 見出しごとのセクション。例: 108〜113行の分刻み dropdown は `onChange` で `this.plugin.saveSettings()`）。
- `src/plugin.ts`: `onload()` で `loadSettings()` → `AstIndex` 生成。`saveSettings()` は `saveData` のみ。`AstIndex.forceReparse()`（`src/sync/ast-index.ts:88`）で全ファイル再パースできる。

## 実装内容
1. `src/lib/parser/meta-keys.ts`
   - モジュール内にユーザー別名表（`Map<string, MetaKey>`）を持ち、次を追加する。
     ```ts
     export type UserMetaKeyAliases = Partial<Record<MetaKey, string[]>>
     export interface AliasValidationResult { aliases: UserMetaKeyAliases; errors: string[] }
     /** 不正な別名を取り除いた結果とエラーメッセージを返す（純粋関数） */
     export function validateUserMetaKeyAliases(input: UserMetaKeyAliases): AliasValidationResult
     /** 検証済みの別名表をレジストリに設定する */
     export function setUserMetaKeyAliases(aliases: UserMetaKeyAliases): void
     /** canonical キーに対応する全キー名（標準名・組込別名・ユーザー別名） */
     export function getMetaKeyNames(key: MetaKey): string[]
     ```
   - 検証規則（違反した別名は除外し、理由を `errors` に入れる）: 前後空白を除いて空でない / `^[\p{L}\p{N}_]+$`（パーサのキー規則と同じ）に一致 / 標準キー名（`META_KEYS` のいずれか）と同じでない / 組込別名（`META_KEY_ALIASES`）と同じでない / 他のキーの別名と重複しない（同一キー内の重複は1つにまとめる）。
   - `normalizeMetaKey(raw)`: 標準キー → 組込別名 → ユーザー別名 の順で引く。
2. `src/settings.ts`
   - `MdAstEditorSettings` に `metaKeyAliases: UserMetaKeyAliases`、`DEFAULT_SETTINGS.metaKeyAliases = {}` を追加。保存データが不正形状のときは `{}` として読む。
   - 設定タブに h3「メタ情報の別名」セクションを追加。`META_KEYS` の各キーにつき1行の `Setting`:
     - 名前: キー名（例 `schedule`。標準名は固定で編集不可であることを説明文に書く）。
     - 説明: 組込別名があれば表示（例 `組込別名: 実施日時`）。
     - テキスト入力: 別名をカンマ区切り（`,` と `、` の両方を区切りとして受け付ける）。
     - 入力確定時（`inputEl` の `change` イベント = フォーカスアウト/Enter）に全キー分を `validateUserMetaKeyAliases` で検証し、エラーがあれば `new Notice(errors.join('\n'))` を表示。検証済みの値を `settings.metaKeyAliases` に保存し、入力欄の表示も検証後の値に戻す。保存後に `setUserMetaKeyAliases` と `plugin.astIndex.forceReparse()` を呼ぶ。
3. `src/plugin.ts`: `loadSettings()` の直後（`AstIndex` 生成・開始より前）に `setUserMetaKeyAliases(validateUserMetaKeyAliases(this.settings.metaKeyAliases).aliases)` を呼ぶ。
4. `src/editor/metatag-decoration.ts:228, 263`: 正規表現を `/^(\s*- )@([\p{L}\p{N}_]+)(\?)?:$/u` にし、`normalizeMetaKey(m[2])` が `plan`/`schedule`/`due` のときだけ処理する。ピッカーに渡す `key` は正規化後のキー、`keyNameEndOffset` は**書かれたキー名（m[2]）の長さ**で計算する。ピッカー確定時にキー名部分が書き換わる場合は、書かれたキー名を保持すること（ピッカーのコミット処理を確認し、`@schedule` に置き換わらないようにする）。
5. `src/lib/patch/upsert-meta.ts` `upsertMeta`: 既存行の検出を「子行が `- @<名前>?:` または `- @<名前>:` で始まり、`<名前>` が `getMetaKeyNames(metaKey)` のいずれか」に変える。見つかった場合は書かれていたキー名と `?` を保持して値だけ置き換える。見つからない場合の新規挿入は従来どおり標準キー名（`@schedule:` 等）。
6. 既存コメントの書き方に倣い、変更箇所に `issue-phase019-markdownEditor-for-mywork-001` を記す。

## 完了条件
- 設定画面に「メタ情報の別名」セクションがあり、12個の標準キーそれぞれに別名を入力できる。標準キー名自体は変更できない。
- `schedule` に `作業時間、やる時間` を設定すると、`- @作業時間: …` と `- @やる時間: …` が `@schedule` と同じく AST の `meta.schedule` としてパースされ、Gantt/Calendar に表示される。
- 別名の行もライブプレビューで `@schedule` と同じ装飾（日付チップ等）になり、`- @作業時間:` と入力した直後に日付ピッカーが開く。ピッカーで確定しても `@作業時間` のまま残る。
- Gantt のツリー編集やバーのドラッグで日時を更新したとき、別名の行（組込別名 `@実施日時` を含む）が更新され、`@schedule` 行が重複追加されない。
- 不正な別名（記号を含む、標準キー名・組込別名と同じ、他キーと重複）は保存されず、Notice で理由が表示される。
- 設定は Obsidian 再起動後も保持され、起動直後から別名が有効。
- 別名を削除すると、その別名の行は通常のメタ（未知キー）として扱われる。
- `npm test` が通る。

## テスト
- `src/lib/parser/meta-keys.test.ts`（無ければ新規）: `validateUserMetaKeyAliases` の各規則、`normalizeMetaKey` の優先順、`setUserMetaKeyAliases` 後のユーザー別名の解決、`getMetaKeyNames`。テスト間でレジストリを `setUserMetaKeyAliases({})` で戻すこと。
- パーサのテスト: ユーザー別名で書いたメタ行が `meta.schedule` 等になる。
- `src/lib/patch/upsert-meta.test.ts`: 別名行（組込・ユーザー）の値更新でキー名と `?` が保持され、重複行が追加されないこと。
- 手動確認: Obsidian で別名を設定 → ノートに `@作業時間:` を書き、装飾・ピッカー・Gantt/Calendar 表示・Gantt からの更新・再起動後の保持を確認する。

## 依存関係
なし

## 対象外
- 組込の日本語別名の変更・削除。
- `@` 入力時のキー候補サジェストに別名を出すこと。
- `src/editor/reformat-meta-lines.ts`（メタ行の整形コマンド。キー判定が `\w` で日本語キーを認識しないのは既存の挙動）。
- AST から Markdown を全体生成する `src/lib/parser/ast-to-md.ts` で別名を保持すること（標準キー名で出力する現状のまま）。
- Linter（別 issue: issue-phase019-markdownEditor-for-mywork-002）。

## 要確認
なし

## 実装結果
- 実装済み。`npm run test:unit` 629件通過、E2E（`tests/obs-e2e/meta-alias.e2e.ts` ほか）通過。
- 既知: `gantt-view.e2e.ts` の「期間なしサブタスクのドラッグ予定化」が失敗（本issueの変更範囲外。ganttchart ライブラリ側の変更取り込み待ちの可能性。未切り分け）。

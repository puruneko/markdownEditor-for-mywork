# よく使うメタ情報名を設定し、@ サジェストに仕切り線付きで表示する

## 背景
要望原文（markdownEditor-for-mywork）:
> よく使うメタ情報名を拡張機能設定画面に入力できるようにし、そのメタ情報については、@を入力後のschedule,plan,dueの後に仕切り線を入れた後に表示し、サジェストから入力できるようにして。規定値はmemoを入れておいて。

採用した解釈:
- 設定画面に「よく使うメタ情報名」（複数）を入力する欄を追加。既定値は `memo` の1件。
- リスト先頭で `@` を入力したときのサジェストに、schedule / plan / due の後へ仕切り線を入れて、よく使うメタ情報名を表示する。
- よく使うメタ情報名を選択したら `@<名前>: ` を挿入し、カーソルを値の入力位置に置く（日付ピッカーは開かない。日付系ではないため）。

## 目的
日付以外のよく使うメタ情報もサジェストから素早く入力できるようにする。

## 現状
- `src/editor/metatag-suggest.ts`:
  - `CANDIDATE_KEYS = ['schedule','plan','due']` 固定（L15）。`MetaKeySuggestItem { key: DateMetaKey }`。
  - トリガー判定 `matchMetaKeyTrigger`: `/^(\s*)- @([a-z]*)$/`（英小文字のみ）。前方一致する候補が無ければ発火しない。
  - `renderSuggestion`: `@key（ラベル）`。`selectSuggestion`: `key:` を挿入してピッカーを開く（`openDatePickerForLine`）。
  - `src/plugin.ts` L234: `this.registerEditorSuggest(new MetaKeySuggest(this.app))`。
- `src/settings.ts`: `MdAstEditorSettings`（L27〜）、`DEFAULT_SETTINGS`（L52〜）、`migrateSettings`（L14〜。minuteStep と metaKeyAliases を正規化）、`MdAstEditorSettingTab.display()`（L74〜、Obsidian `Setting` で項目を並べる）。
- 別名: `src/lib/parser/meta-keys.ts` の `normalizeMetaKey`（ユーザー定義別名を含めて正規キーへ変換）。

## 実装内容
1. 設定:
   - `MdAstEditorSettings` に `frequentMetaKeys: string[]` を追加。`DEFAULT_SETTINGS.frequentMetaKeys = ['memo']`。
   - `migrateSettings`: 保存値が文字列配列ならそれを使う（空配列も尊重）。未保存（undefined）や不正値なら `['memo']`。
   - 設定タブに「よく使うメタ情報名」を追加（テキスト入力、カンマ区切り。説明文「@入力時のサジェストに schedule/plan/due の後に表示します」）。保存時に前後空白除去・空要素除去・重複除去し、`normalizeMetaKey` が schedule/plan/due になる名前（日付系とその別名）は除外する。
2. サジェスト:
   - `MetaKeySuggest` のコンストラクタで `getFrequentKeys: () => string[]` を受け取り、`plugin.ts` から `() => this.settings.frequentMetaKeys` を渡す。
   - `MetaKeySuggestItem` を `{ key: string; kind: 'date' | 'frequent'; dividerBefore?: boolean }` に拡張。
   - 候補 = 日付系（前方一致）→ よく使う名前（前方一致、設定順）。よく使う側の先頭要素に `dividerBefore: true`（日付系候補が1つ以上ある場合のみ）。
   - トリガー正規表現を `/^(\s*)- @([\p{L}\p{N}_]*)$/u` に広げ、日本語のメタ情報名でも前方一致できるようにする（IME 変換中は従来どおり発火しない）。
   - `renderSuggestion`: frequent は `@名前` のみ表示。`dividerBefore` の項目の要素に `metatag-suggest-item--divider` クラスを付け、CSS（`styles/metatag-wysiwyg.css` の `.metatag-suggest-item-label` 付近）で上側に区切り線（`border-top: 1px solid var(--background-modifier-border)`）を表示。
   - `selectSuggestion`: kind が 'date' は従来どおり。'frequent' は `名前: ` を挿入しカーソルを行末へ。ピッカーは開かない。
3. ファイル冒頭コメント（「memo等の他のメタ情報キーは候補に含めない」）を本仕様に合わせて更新。

## 完了条件
- 設定画面に「よく使うメタ情報名」があり、初期状態で `memo` が入っている。変更は再起動後も保持される。
- リスト先頭で `@` を入力すると、`@schedule` `@plan` `@due`、仕切り線、`@memo`（設定した名前）の順に候補が出る。
- `@m` のように入力すると前方一致で絞り込まれる。
- よく使う名前を選ぶと `- @memo: ` となり、カーソルが値の位置に来る（ピッカーは開かない）。
- schedule/plan/due の選択時の動作は従来どおり。

## テスト
- `src/editor/metatag-suggest.test.ts`: トリガー判定（日本語名含む）、候補の並び順と `dividerBefore`、前方一致、日付系が0件のとき仕切りなし。
- 設定の migrate テスト（既存の settings テストがあればそこへ）: undefined→['memo']、[]→[]、不正値→['memo']。
- `npm run test:unit` が通ること。

## 依存関係
なし

## 対象外
- よく使うメタ情報の値の入力支援（ピッカー等）。
- 設定画面の行高調整（issue-phase020-markdownEditor-for-mywork-005）。

## 要確認
なし

# 非日付メタ情報の＠記号を非表示にする（元要件: 修正したい箇所.md markdownEditor節「日付以外のメタ情報は、wysiwygモードの場合は日付と同様に＠を消し緑の文字色・背景にして」）

## 1. Background（背景）

`修正したい箇所.md` の markdownEditor 節の要件は次のとおりである。

> 日付以外のメタ情報は、wysiwygモードの場合は日付と同様に＠を消し緑の文字色・背景にして。

この要件は **(a) ＠記号を消す（非表示にする）** と **(b) 緑の文字色・背景にする** の2点から成る。

**この要件は、元の実装計画（issue-phase010シリーズの元になった設計計画）のIssue一覧に、対応するIssueとして存在していなかった。** 日付メタの装飾については別のIssue（`issue-phase003-008__meta-autocomplete-and-date-picker.md`）が先行して存在しており、その対応の過程で非日付メタについても**(b) 緑の文字色・背景**の部分だけが偶発的に実装された。しかし**(a) ＠記号を消す**部分は、日付メタ側でのみ実装され、非日付メタには適用されないまま残っている。

現状のコードを確認した結果は以下のとおりである。

- `src/editor/metatag-decoration.ts` の164〜172行付近に、`Decoration.replace`（該当テキストを別の表示に置き換える処理。＠記号ごと別の表示に差し替えることで、結果的に＠が見えなくなる）があるが、**この処理は日付系メタ（`@schedule` 等の日付を値に持つメタ）にのみ適用されている**
- 非日付メタは、同ファイルの180〜187行付近の `Decoration.mark`（テキストはそのまま残し、CSSクラスを付与して見た目だけを変える処理）のみが適用されており、これは緑の文字色・背景を実現するが、**＠記号自体はテキストとして残ったまま**である
- ＠記号を視覚的に隠す（`display: none` 等の）CSS定義も、関連スタイルシートに存在しない

結果として、wysiwygモードで非日付メタ（例: `@purpose`, `@condition`, `@savepoint` 等）を表示すると、緑色には装飾されるが、**先頭の＠記号がそのまま見えてしまう**状態になっている。これは要件の(a)を満たしていない。

## 2. Objective（目的）

wysiwygモードにおいて、日付メタと同様に、非日付メタ情報についても＠記号を視覚的に消し、緑の文字色・背景で表示する。

## 3. Scope（スコープ）

- `src/editor/metatag-decoration.ts` における非日付メタの装飾処理を、日付系メタと同様に「＠記号を消す」処理を含む形に変更する
- 対象は、日付系（`@schedule` 等）以外の全メタキー（`@purpose` / `@condition` / `@savepoint` / `@special_note` / `@waitingOn` / `@dependsOn` / `@tags` / `@repeat` / `@priority` 等、日付以外の値を持つメタ情報全般）

## 4. Implementation requirements（実装要件）

1. `src/editor/metatag-decoration.ts` の非日付メタ処理箇所（現状 `Decoration.mark` のみを適用している180〜187行付近）を、日付系メタと同じ `Decoration.replace` を用いた処理（164〜172行付近の実装）と同等の方式に変更し、**＠記号がテキストとして表示されないようにする**
2. ＠記号を消したうえで、引き続き**緑の文字色・背景**（既存の `Decoration.mark` が付与しているCSSクラス相当のスタイル）を適用する。既存の緑装飾のスタイル定義自体は変更しないこと（既に要件(b)を満たしているため）
3. 日付系メタの既存の＠消去処理（164〜172行付近）の挙動・見た目には影響を与えないこと

**実装方針の選択肢（要確認）**: 日付系メタの `Decoration.replace` は、＠記号を消すと同時に日付のフォーマット変換（ピッカー表示等）も行っている可能性がある。非日付メタには日付フォーマット変換は不要なため、**「＠記号を消して緑色にする」という装飾だけを行う軽量な `Decoration.replace` を新設するか、既存の日付系処理を条件分岐で拡張するか**は、実装時にコードの実際の構造を確認したうえで判断すること。どちらの方式を採るかは本Issueでは指定しない。

## 5. Files / components likely to be changed（変更が見込まれるファイル／コンポーネント）

- `src/editor/metatag-decoration.ts`（164-172行付近の日付系 `Decoration.replace` 処理、180-187行付近の非日付系 `Decoration.mark` 処理）
- 関連するCSS定義（緑の文字色・背景のスタイル。既存のクラス名を確認し、必要なら＠を消した後の表示レイアウトの調整を行う）
- 既存の日付メタ装飾のテスト（あれば）を参考に、同様のテストパターンを非日付メタにも適用する

## 6. Dependencies（依存関係）

- 依存なし。他のIssueの完了を待たずに着手できる
- 日付系メタの＠消去処理（`issue-phase003-008__meta-autocomplete-and-date-picker.md` に由来する既存実装）に手を加える際は、その処理の既存の挙動（日付ピッカー等、他の付随機能があれば）を壊さないよう回帰確認を行うこと

## 7. Acceptance criteria（受け入れ基準）

- wysiwygモードで非日付メタ（例: `@purpose: テスト`）を表示したとき、＠記号が画面上に表示されない
- 同時に、緑の文字色・背景での装飾が引き続き適用される
- 日付系メタ（例: `@schedule: ...`）の既存の表示・挙動に変化がない
- 全てのメタキー種別（日付系・非日付系を問わず）で、装飾後もテキスト編集・カーソル移動などのエディタ操作に支障がないこと

## 8. Test requirements（テスト要件）

- 非日付メタ（複数種のキーを含む）を入力したときに、＠記号が装飾後のDOM上に表示されないことを確認するテストを追加する
- 緑の文字色・背景のCSSクラスが引き続き適用されることを確認する
- 日付系メタの既存テストが引き続き成功することを確認する（回帰確認）

## 9. Out of scope（対象外）

- 日付系メタの＠消去処理自体の変更（既に要件を満たしているため、動作を変えない）
- 統一メタキーレジストリの実装（別の対応事項であり、本Issueでは扱わない）
- メタ情報の値そのものの表示形式（フォーマット等）の変更。本Issueは＠記号の非表示化のみを対象とする

## Progress & Implementation Notes

### History

#### 2026-09-23

- User Instruction:
  - project/governance のルールに従い、issue-phase011 シリーズを順番にすべて実装する

- Change:
  - `src/editor/metatag-decoration.ts` の `buildValueDecorations()`:
    - 値付きメタの非日付分岐（従来 `Decoration.mark` のみ）に、`livePreview && !overlapsSelection` の場合のみ ＠ 記号1文字を `Decoration.replace({})`（widget 省略＝何も描画しない）で消す処理を追加した。値部分の `Decoration.mark`（緑装飾）はそのまま維持
    - コロンなしの裸のメタキー分岐（`@memo` 等）にも同様の ＠ 非表示処理を追加した。`Decoration.replace` と `Decoration.mark` が同じ開始位置で重ならないよう、非表示時はキー本体の mark の開始位置を1文字分ずらした（`keyStart+1`）
    - 日付系メタ（`@plan`/`@schedule`/`@due`）の既存処理・`MetaDateChipWidget` は一切変更していない
    - ファイル冒頭の JSDoc コメントを新しい挙動に合わせて更新した
  - **実装方針の選択（Issue 本文が実装時判断に委ねていた点）**: 「＠を消して緑色にする軽量な `Decoration.replace` を新設する」方式を採用した。日付系の `MetaDateChipWidget`（日付フォーマット変換・ピッカー起動を伴う）は流用せず、widget を省略した空の `Decoration.replace` で ＠ 1文字だけを消す最小実装とした
  - `tests/obs-e2e/metatag-decoration.e2e.ts` に4件の E2E テストケースを追加した（値付き非日付メタの＠非表示、裸キーの＠非表示、日付系メタの回帰確認、カーソルが行に重なった場合の＠復元＝編集可能性の確認）

- Rationale:
  - Issue 本文が明示的に「(a) ＠を消す」「(b) 緑にする」の2点のみを要求し、日付系チップのような値の再フォーマット・ラベル翻訳は求めていなかったため、＠記号1文字のみを消す最小実装とした（値・キーのテキスト自体は変更しない）
  - 緑装飾（(b)）は既存の `Decoration.mark`（本ファイル）と `task-decoration.ts` の別レイヤーの装飾により、変更前から既に満たされていたため、CSS定義は一切変更しなかった（Implementation requirements 項目2どおり）
  - 裸キー分岐でも ＠ を消す対応をした理由: Issue の Background が「日付以外のメタ情報は...＠を消し」と包括的に述べており、値の有無で扱いを分ける理由がないため

- Verification:
  - `npx vitest run` → 25 test files / 512 tests すべて成功（本Issueはコード変更が CM6 の ViewPlugin に閉じており、既存の unit テスト対象外のため新規 unit テストは追加していない）
  - `npx tsc --noEmit` → 変更ファイルに起因する型エラーなし
  - `node esbuild.config.mjs production` → ビルド成功
  - **実機 Obsidian E2E テストを実施**（`.obsidian-cache` にキャッシュ済みの実機環境があったため、目視確認ではなく自動化された実機検証を実施できた）:
    - `npx wdio run wdio.conf.mts --spec tests/obs-e2e/metatag-decoration.e2e.ts` → **13件すべて成功**（新設4件含む）
    - `npx wdio run wdio.conf.mts --spec tests/obs-e2e/task-decoration.e2e.ts` → 8件すべて成功（クロスプラグインの回帰無し）
    - 全 E2E スペック一括実行（`npx wdio run wdio.conf.mts`）→ 8ファイル中7ファイル成功。`gantt-view.e2e.ts` の2件が失敗したが、**本Issueおよび本セッションの他の変更とは無関係の、既存（セッション開始前から存在する）の問題**であることを、該当ファイル（`src/lib/gantt/ast-to-gantt.ts`・`GanttTab.svelte`）を `git stash` で完全に元のコミット済み状態へ戻した上で同じ2件が同じ理由で失敗することを確認して検証済み。原因は `test/vaults/simple/test-tasks.md` の固定フィクスチャ日付（2026年3〜4月）と実行時の現在日時（2026-09-23）のドリフトによるもので、該当テストファイル自身のコメントが「静的フィクスチャに依存する既存スペックのため日付ドリフトに弱い」と明記している既知の限界に該当する。ユーザーへの報告事項として申し送る（別途、日付非依存の実行時生成フィクスチャへの移行 issue を検討されたい）

- Status: 実装完了・実機E2E検証済み。ユーザーの明示的な承認待ちのため Issue は Open のまま（WORKFLOW.md §6）。

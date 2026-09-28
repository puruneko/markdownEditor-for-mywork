# markdownEditor: メタ情報の点線囲い機能は「実装困難のため廃止」と要望されているが、既に要件を満たす実装が存在する（削除するか維持するか要確認）

対象リポジトリ: markdownEditor-for-mywork

## 1. Title
markdownEditor: 点線囲い機能（`cm-metablock-box`）について、要望文の「実装困難につき廃止」という判断と、現在のコードに既に存在する要件充足済みの実装との矛盾を解消する（削除するか、維持して微調整するかは要確認）

## 2. Background
入力要望(ユーザー原文):
「- メタ情報の点線囲いについて、日付系は不要。それ以外について、メタ情報が複数行にわたる時のみ点線で囲う。仕様は以下の通り。
    - メタ情報全体を点線で囲む。囲む範囲は、メタ情報名行以下のネストの部分で、ネストのインデント部分から。行の横幅全体ではない。bulletも囲む範囲内にする。（罫線が途切れるのでこの方法を採用してはいけませんが、イメージ的にはcm-indentに右罫線を引くような感じ）
    - 点線の灰色はもっと薄い色にする。
    @レビュー
    - 実装難しいみたいなので、点線囲い機能は廃止。機能削除して。」

コード調査の結果、**「実装が難しいため廃止する」という@レビューの判断と、現在のコードの実態が食い違っている**ことが判明した。

現在の`src/editor/metatag-decoration.ts`(290-427行目)には、`computeMetaBlockRanges()`(312-342行目)・`collectMetaBlockLineRanges()`(345-358行目)・`buildMetaBlockMarkers()`(370-404行目)・CodeMirror 6の`layer()`拡張`metatagBlockLayer`(412-426行目)という一連の実装が既に存在し、`src/plugin.ts`にも登録済み（`registerEditorExtension(metatagBlockLayer)`）で、現在動作する状態にある。コード内コメント(290-295行目)によれば、これは以前存在した「行全体をborder-left/right装飾で囲む」という実装（要件を満たせなかった古い実装）を廃止し、`layer()` + `RectangleMarker`によるオーバーレイ矩形描画方式に**作り直した結果**である。この現行実装を要望の仕様と照合すると、次のように**多くの点で既に要件を満たしている**。

- **日付系メタ情報の除外**: `computeMetaBlockRanges()`337行目で`!isDateMetaKey(canonicalKey)`を条件にしており、`plan`/`schedule`/`due`は対象から除外される。→ 要件と一致。
- **複数行にわたる場合のみ囲む（1行のメタ情報は囲わない）**: 同関数321-339行目で、ネストする子孫行が無い（`end === i`のまま）場合は`ranges`に追加しない。→ 要件と一致。
- **囲む範囲が行全体の幅ではなくインデント位置基準**: `buildMetaBlockMarkers()`内で、左端をメタキー行のインデント位置（`view.coordsAtPos(keyLine.from + indent, 1)`）、右端をまとまり内の各行の実際の内容の右端の最大値（`view.coordsAtPos(doc.line(n).to, -1)`の最大値）から算出しており、行全体の幅ではなく内容の幅に基づく矩形になっている。→ 要件と一致。
- **異なるメタ情報を1つに統合しない**: `computeMetaBlockRanges()`は各メタキー行ごとに独立した`range`を生成するため、隣接する別のメタ情報は個別の矩形になる。→ 要件と一致。
- **点線の色**: `styles/metatag-wysiwyg.css`(202-206行目)で`.cm-metablock-box { border: 1px dotted rgba(128,128,128,0.35); border-radius: 4px; }`となっており、不透明度35%の薄いグレーになっている。要望の「もっと薄い色に」を満たしているかは主観的判断であり、断定はできない。

このように、@レビューが「実装難しい」と判断した時点の実装（古いborder-left/right方式）と、現在動作している実装（`layer()`+`RectangleMarker`によるオーバーレイ矩形方式）は別物であり、後者は要望の詳細仕様の大半を既に満たしているように見える。**@レビューの「廃止」判断が、この作り直し後の実装を踏まえたものかどうかは実装計画からは判断できない。**

## 3. Objective
点線囲い機能について、(a) 現行の`layer()`+`RectangleMarker`実装は既に要件の大半を満たしていることを踏まえて維持し、必要であれば点線の色味のみ微調整するか、(b) @レビューの「廃止」判断を優先し、現行実装ごと機能を削除するか、をユーザーに確認した上で実施する。

## 4. Scope
markdownEditor-for-mywork リポジトリの `src/editor/metatag-decoration.ts`（`computeMetaBlockRanges`/`collectMetaBlockLineRanges`/`buildMetaBlockMarkers`/`metatagBlockLayer`）、`styles/metatag-wysiwyg.css`（`.cm-metablock-box`）、`src/plugin.ts`（`registerEditorExtension`呼び出し部分）。

## 5. Implementation requirements
1. **【要確認・実装前に必須】維持か削除かの判断**: 上記Backgroundの調査結果（現行実装は既に要件の大半を満たしているように見える）をユーザーに提示し、次のいずれかを確認する。
   - (a) 維持する。この場合、点線の色が「もっと薄い」という要望を十分に満たしているか実機で確認し、必要であれば`rgba(128,128,128,0.35)`の不透明度・色味をさらに調整する。それ以外の変更は不要。
   - (b) @レビューの「廃止」判断を優先し、削除する。この場合、`metatag-decoration.ts`内の`computeMetaBlockRanges`/`collectMetaBlockLineRanges`/`buildMetaBlockMarkers`/`metatagBlockLayer`一式、`plugin.ts`の`registerEditorExtension(metatagBlockLayer)`呼び出し、`styles/metatag-wysiwyg.css`の`.cm-metablock*`関連スタイルを削除する。関連するユニットテスト（`metatag-block.test.ts`等、存在する場合）も削除する。
2. 決定に基づき、上記いずれかを実施する。
   - @レビュー
      - (b)で進める。今の実装は要望を全く満たしていない。囲う部分がかなりずれていて邪魔になっている。また、この実装は前回かなり時間がかかっていたため、無駄なクレジット消費を抑えるためにも廃止としてください。

## 6. Files / components likely to be changed
- markdownEditor-for-mywork/src/editor/metatag-decoration.ts
- markdownEditor-for-mywork/styles/metatag-wysiwyg.css
- markdownEditor-for-mywork/src/plugin.ts
- markdownEditor-for-mywork/src/editor/metatag-block.test.ts（存在する場合）

## 7. Dependencies
- 【要確認】節の決定が完了するまで着手しないこと。

## 8. Acceptance criteria
- (a)維持する場合: 複数行にわたる非日付系メタ情報のみが、インデント位置基準・内容幅基準の点線矩形で囲まれ、色味が要望に照らして十分に薄いグレーになっている。
- (b)削除する場合: 点線囲いに関連するコード・スタイル・登録処理・関連テストが残らず削除されており、エディタの他の機能（メタ情報のチップ表示・色付け等）に影響が無い。

## 9. Test requirements
- (a)維持する場合: 既存のユニットテスト（`computeMetaBlockRanges`等の純粋関数テスト）が引き続き通ることを確認する。色味変更のみであれば追加テストは不要。
- (b)削除する場合: 削除後もビルド・既存テストが正常に通り、メタ情報のチップ表示・編集機能に回帰が無いことを確認する。
- 実機確認: (a)(b)いずれの場合も、Live Previewモードでの表示が期待通りであることを確認する。

## 10. Out of scope
- 日付メタ情報のチップ⇔生テキスト切り替え機構の変更（別issueで対応）。
- 5分単位ON/OFFボタンの設置場所（別issueで対応）。

## History

### 2026-09-28 00:00

- User Instruction:
  - phase015系列のissueを順番にすべて実装せよとの指示。

- Change:
  - 本issueは「5. Implementation requirements」内の@レビューで(b)（廃止・機能削除）が既に選択されていることを確認し、削除を実施した。
  - `src/editor/metatag-decoration.ts`: `MetaBlockRange`インターフェース、`computeMetaBlockRanges`・`collectMetaBlockLineRanges`・`getLayerBaseLeft`・`buildMetaBlockMarkers`関数、`metatagBlockLayer`（`layer()`拡張）一式を削除。未使用になった`layer`・`RectangleMarker`のimportも削除。
  - `src/plugin.ts`: `metatagBlockLayer`のimportと`registerEditorExtension(metatagBlockLayer)`呼び出しを削除。
  - `styles/metatag-wysiwyg.css`: `.cm-metablock-box`ルールと関連コメントを削除。
  - `src/editor/metatag-block.test.ts`（`computeMetaBlockRanges`のユニットテスト）を削除。
  - `tests/obs-e2e/metatag-decoration.e2e.ts`の`.cm-metablock-box`関連e2eテスト2件を削除。
  - `npx vitest run`で全27ファイル558件のユニットテストが通過することを確認（回帰なし）。
  - コンパイル済みの`main.js`/`styles.css`は本セッションでは再ビルドしていない（ユーザーが別途手動ビルド・コミットする運用のため）。

- Rationale:
  - @レビューにより「今の実装は要望を全く満たしておらず邪魔になっている、前回の実装に時間がかかったため無駄なクレジット消費を抑えるためにも廃止」と明記されているため、(a)維持ではなく(b)削除を採用した。

- 現在の状態:
  - 点線囲い機能（`cm-metablock-box`関連コード・スタイル・テスト）を削除済み。クローズ可否のユーザー最終承認待ち。

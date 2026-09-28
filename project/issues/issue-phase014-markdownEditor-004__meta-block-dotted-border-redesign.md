# markdownEditor: メタ情報の点線囲み表示を、インデント基準・複数行限定・日付系除外の仕様に作り直す

対象リポジトリ: markdownEditor-for-mywork

## 1. Title
markdownEditor: メタ情報ブロックの点線囲み(`cm-metablock`)を、行全体ではなくインデント位置基準の範囲に変更し、日付系メタ情報を対象外にし、単一行のメタ情報は囲まないようにする

## 2. Background
入力要望(ユーザー原文、@レビュー含む):
「メタ情報の点線囲いについて、日付系は不要。それ以外について、メタ情報が複数行にわたる時のみ点線で囲う。仕様は以下の通り。
- メタ情報全体を点線で囲む。囲む範囲は、メタ情報名行以下のネストの部分で、ネストのインデント部分から。行の横幅全体ではない。bulletも囲む範囲内にする。（罫線が途切れるのでこの方法を採用してはいけませんが、イメージ的にはcm-indentに右罫線を引くような感じ）
- 点線の灰色はもっと薄い色にする。
@レビュー
- 意図が全く伝わっていない。
- 行全体を囲うのではない。また、メタ情報名称の行のみ囲うのではない。
    - 罫線の幅について：メタ情報名称の行のレベルのインデントの横位置から、メタ情報全体の最大横幅の位置まで。
    - 罫線の高さについて：メタ情報名称行を含めたメタ情報のまとまり全体。異なるメタ情報は１つの囲いにせず個別にする。
- １行のメタ情報は囲わない。
- 罫線の点線をもっと薄い灰色にして。」

コード調査の結果、現在の実装（`src/editor/metatag-decoration.ts` の `classifyMetaBlockLines()`/`buildMetaBlockDecorations()`(294-395行目)、および `styles/metatag-wysiwyg.css` の `.cm-metablock*`(186-202行目))は以下の通り。

- `classifyMetaBlockLines()`(303-330行目)は、`META_LINE_RE`(32行目、日付系・非日付系を区別しない全メタキー共通の正規表現)に一致する**連続する行**のまとまりを `single`/`first`/`mid`/`last` に分類する。この分類ロジック自体は「メタキーの行」のみを見ており、キー直下のネスト（値・子リスト）の複数行のまとまりを正しく捉えられているかは要確認だが、少なくとも**日付系メタ(plan/schedule/due)を除外する判定は無い**（`isDateMetaKey()` を使っていない）。要望の「日付系は不要」が反映されていない。
- `buildMetaBlockDecorations()`(346-369行目)は `Decoration.line({ class: 'cm-metablock cm-metablock-<pos>' })` という**行装飾**を付与している。CodeMirmのLine decorationは対象行の**要素全体**にクラスを付与する仕組みであるため、続く CSS (`styles/metatag-wysiwyg.css` 186-202行目)の `border-left`/`border-right` は**行の横幅全体**に対して適用される。これは要望が明確に否定している「行全体を囲う」実装そのものである。
- `single` 判定（`classifyMetaBlockLines()` 320-322行目）自体は存在し、CSS側でも `.cm-metablock-single` は `cm-metablock-first`/`cm-metablock-last` 相当のスタイルを両方適用する形になっている（191-202行目）が、要望は「1行のメタ情報は囲わない」＝`single`判定のケースでは何も描画しないことを求めている。現状は `single` でも通常の `.cm-metablock` の左右border(188-190行目)が適用され続けるため、1行でも囲われてしまう。
- 点線の色は `--metablock-border: 2px dotted var(--background-modifier-border-hover, #c8c8c8)`(187行目)。要望は「もっと薄い色に」との指摘があるため、現在の色では薄さが不足していると判断されている。

要望の核心は、「メタ情報名称の行のインデント位置から、メタ情報全体（値・ネストした子要素）の最大横幅までを、そのメタ情報のまとまりの高さ分だけ矩形で囲う」という**行全体ではない部分的な囲み**であり、CodeMirrorの行装飾(`Decoration.line`)だけでは実現できない。実現には、対象範囲の左右位置をインデント量・コンテンツ幅から算出し、`position: absolute` 等でオーバーレイ要素として描画する、または `Decoration.widget`/独自のCSS変数(`--indent-start`等)を各行に埋め込んだ上でCSSの `calc()` で左端位置を調整する、といった作り直しが必要になる可能性が高い。

## 3. Objective
複数行にわたる非日付系メタ情報のまとまりのみを、メタ情報名称行のインデント位置から内容の最大横幅までの範囲で、薄い灰色の点線矩形として囲む。単一行のメタ情報、および日付系メタ情報(plan/schedule/due)は囲まない。

## 4. Scope
markdownEditor-for-mywork リポジトリの `src/editor/metatag-decoration.ts`（`classifyMetaBlockLines`/`buildMetaBlockDecorations` 周辺）と、`styles/metatag-wysiwyg.css`（`.cm-metablock*`）。

## 5. Implementation requirements
1. **日付系メタ情報の除外**: `classifyMetaBlockLines()`（またはそれに相当する判定ロジック）で、`META_LINE_RE` に一致した行のキーが `isDateMetaKey()`（`metatag-format.ts` からimport済み、`metatag-decoration.ts` 26行目で既にimportされている）に該当する場合は、点線囲みの対象から除外する。
2. **単一行の除外**: `single` と分類されたメタ情報のまとまりには、点線囲みを一切適用しない（`cm-metablock`/`cm-metablock-single` 系のクラス自体を付与しないか、CSS側で `single` の場合はborderを出さないようにする）。
3. **囲む範囲の横方向**: 罫線の左端は「メタ情報名称行のインデントレベルの横位置」、右端は「そのメタ情報のまとまり全体の中で最大の横幅の位置」とする。行全体の幅を対象にしてはならない。実現方法（CSS `Decoration.line` を使わない別方式への作り直し、`position: absolute` によるオーバーレイ矩形の算出、CodeMirrorの `EditorView.decorations` で計算したピクセル位置を使う等）は実装者の判断とするが、**「行全体に対してborder-left/border-rightを適用する」という現行方式のままでは要件を満たせない**ことを踏まえて設計し直すこと。
4. **囲む範囲の縦方向**: メタ情報名称行を含めた、そのメタ情報のまとまり全体（既存の `first`/`mid`/`last` 判定の考え方は流用できる）。異なるメタ情報（別のキー、または連続していない別のまとまり）は、それぞれ個別の矩形として囲む（現行の `first`/`mid`/`last` ごとの区切りロジックはこの点で概ね妥当）。
5. **色の変更**: `--metablock-border` の色をより薄い灰色に変更する。具体的な色値は明示されていないため、既存の `--background-modifier-border` 系の薄いバリエーション、または透明度を上げた指定（例: 現行の `2px dotted` の線幅・不透明度を下げる）を実装者が判断して調整し、視認性とのバランスを取る。

## 6. Files / components likely to be changed
- markdownEditor-for-mywork/src/editor/metatag-decoration.ts
- markdownEditor-for-mywork/styles/metatag-wysiwyg.css
- 関連ユニットテスト（`classifyMetaBlockLines` のテストがあれば更新）、obs-e2eテスト

## 7. Dependencies
- issue-phase014-markdownEditor-005（メタ情報名称の緑文字色化）と関連するが、CSS上の独立した変更であり、順序に強い制約はない。

## 8. Acceptance criteria
- 複数行にわたる非日付系メタ情報（例: `@memo` の下に複数行の子リストがある場合）が、メタ情報名称行のインデント位置から内容の最大横幅までの矩形で、薄い灰色の点線で囲まれる。
- 単一行のメタ情報（値が1行のみの`@memo: xxx`等）は点線で囲まれない。
- 日付系メタ情報(`@plan`/`@schedule`/`@due`)は、複数行であっても点線で囲まれない。
- 罫線が行の左端から右端まで（行全体）に渡って表示されない。
- 隣接する異なるメタ情報が、1つの囲みに統合されず、それぞれ個別の矩形として囲まれる。

## 9. Test requirements
- ユニットテスト: 日付系メタ情報の複数行ブロックが囲み対象から除外されることを検証する。
- ユニットテスト: 単一行のメタ情報ブロックが囲み対象から除外されることを検証する。
- obs-e2e: 実際のエディタ表示で、点線の左端がインデント位置から始まり、行全体を横断しないことを視覚的またはDOM構造的に確認する。
- 実機確認: 薄い灰色の点線が、既存のUIと比較して視認性の面で妥当であることを目視確認する。

## 10. Out of scope
- メタ情報名称・値のテキストスタイル（緑文字色化等、issue-phase014-markdownEditor-005で対応）。

---

## 2. Progress & Implementation Notes（実装記録）

### History (append-only)

### 2026-09-27 23:58

- User Instruction:
  - phase014シリーズを順番に実装する指示の4件目として着手。

- Change:
  - `src/editor/metatag-decoration.ts`:
    - `classifyMetaBlockLines()`/`classifyDocLine()`/`buildMetaBlockDecorations()`/`metatagBlockPlugin`（行装飾＝`Decoration.line`ベース）を全て削除し、`computeMetaBlockRanges()`（純粋関数）＋`metatagBlockLayer`（`@codemirror/view`の`layer()`＋`RectangleMarker`を用いたオーバーレイ矩形）に作り直した。
    - `computeMetaBlockRanges(lines: string[])`: 「メタキー行＋そのネスト（インデントが深い間の子孫行）」を1つのまとまりとして走査し、(a) ネストが無い（1行のみ）、(b) キーが日付系(plan/schedule/due)、のいずれかに該当するまとまりは結果から除外する。連続する別のメタキー行（インデントが同じでもキーが異なる隣接行）はそれぞれ独立に判定するため、1つの囲みに統合されない（旧実装は「連続するメタ行」を無条件に1つのまとまりとして扱っており、この点は仕様違反だった）。
    - `metatagBlockLayer`: `buildMetaBlockMarkers(view)`が、`view.visibleRanges`内の各メタブロックについて、`view.coordsAtPos()`でメタキー行のインデント開始位置（bulletの直前、左端）とまとまり内全行の最大右端を求め、`view.lineBlockAt()`でまとまりの縦方向の範囲（先頭行の上端〜最終行の下端）を求めて、1つの`RectangleMarker('cm-metablock-box', left, top, width, height)`を生成する。`RectangleMarker`が要求するdocument-relativeな`left`へ変換するための`getBase()`相当の処理（CodeMirror内部の非公開関数）は、`view.scrollDOM`のBoundingClientRectとスクロール量から自前で再実装した（`getLayerBaseLeft()`。本エディタはRTLを想定しないためLTR前提に簡略化）。ライブプレビュー時のみ描画する。
  - `styles/metatag-wysiwyg.css`: `.cm-metablock`/`.cm-metablock-first`/`-last`/`-single`（行全体へのborder-left/right方式）を削除し、`.cm-metablock-box`（矩形要素自体へのborder、box-sizing: border-box、pointer-events: none）に置き換えた。線幅を2px→1pxに、色を`var(--background-modifier-border-hover, #c8c8c8)`（不透明）→`rgba(128, 128, 128, 0.35)`（半透明のグレー）に変更し、要望の「もっと薄い色」に対応した。
  - `src/plugin.ts`: `metatagBlockPlugin`のimport/登録を`metatagBlockLayer`に置き換えた。
  - `src/editor/metatag-block.test.ts`: 旧`classifyMetaBlockLines`向けテストを全て置き換え、新しい`computeMetaBlockRanges`の仕様（日付系除外・単一行除外・別メタキーの非統合・ネスト中の空行の扱い・複数まとまりの同時検出）を検証する13件のテストに書き直した。
  - `tests/obs-e2e/metatag-decoration.e2e.ts`: 旧`.cm-metablock-first`/`-last`/`-mid`ベースの2テストを、新仕様（`.cm-metablock-box`が複数行・非日付系のみに1件だけ生成される、日付系・単一行・別メタキーとは統合されない、矩形の左端がエディタ左端より右にありかつ幅が行全体よりも十分小さい、ソースモードで消える）を検証する2テストに書き直した。

- Rationale:
  - 「行全体ではなくインデント位置基準の部分的な矩形」という要望は、CodeMirrorの行装飾(`Decoration.line`)の仕組み上original実現不可能（Background・Implementation requirements #3で明記）であるため、`@codemirror/view`が公式に提供する`layer()`/`RectangleMarker`（CM6内蔵のカーソル・選択ハイライト等と同じ仕組み）へ作り直した。独自のposition:absoluteオーバーレイを一から実装するより、公式APIを再利用する方が保守性・測定タイミングの正しさ（`requestMeasure`によるDOM読み取り/書き込みの分離）の面で優れると判断した。
  - 旧`classifyMetaBlockLines`は「連続するメタ行」を無条件にグルーピングしており、既存のe2eテスト（3行の異なるメタキーを1つのまとまりとして扱う）自体が新仕様（要望4「異なるメタ情報は個別にする」）と矛盾していたため、テストごと仕様に合わせて書き直した。

- Test results:
  - `npx vitest run`: 571件すべて成功（新規`computeMetaBlockRanges`テスト13件を含む）。
  - `npx wdio run wdio.conf.mts --spec tests/obs-e2e/metatag-decoration.e2e.ts`: 21件成功・2件失敗。失敗2件は本issueの変更と無関係な既存の不具合（issue-phase014-markdownEditor-003のTest resultsで報告済みの問題A・B）であり、本issueのAcceptance criteriaには影響しない。
  - `npx svelte-check`: 本issueで変更した`metatag-decoration.ts`/`plugin.ts`に起因する新規の型エラーなし。

- Acceptance criteria充足状況:
  - 「複数行の非日付系メタ情報がインデント位置〜最大横幅の矩形で薄い灰色の点線に囲まれる」: 満たした（e2eで矩形の左端・幅を構造的に確認）。
  - 「単一行のメタ情報は囲まれない」: 満たした（`computeMetaBlockRanges`のユニットテストおよびe2eの`@priority: 2`で確認）。
  - 「日付系メタ情報は複数行でも囲まれない」: 満たした（`@due`のユニットテスト・e2eで確認）。
  - 「罫線が行全体に渡って表示されない」: 満たした（e2eで矩形幅がスクローラ幅の60%未満であることを確認）。
  - 「隣接する異なるメタ情報が個別の矩形になる」: 満たした（`computeMetaBlockRanges`のユニットテストで複数まとまりの同時検出を確認）。

- Open items:
  - 「点線の色をもっと薄くする」の具体的な数値（何%薄くするか等）はユーザーから明示されていないため、実装者判断で`rgba(128, 128, 128, 0.35)`とした。実機で見え方を確認し、必要であれば数値を調整してほしい。
  - ユーザーの明示的なクローズ承認待ち（`WORKFLOW.md §6`）。

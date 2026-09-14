# 外部アプリ連携データ契約（Markdown Task Interchange）の Spec 策定

## 1. 問題と方向性 — FOR HUMANS

### この Issue が解決すること

本エディタは Markdown を唯一の正の情報源として解析し、その結果を Calendar・Gantt・Kanban・Agenda の各ビューへ投影している。しかし解析結果はプラグイン内部の型（`src/lib/parser/types.ts` の `Document`）に閉じており、プラグイン外のアプリケーションから同じ情報を利用する手段が存在しない。

外部アプリが同じ Markdown を独自に再パースした場合、次の解釈がエディタと食い違う。

- 省略記法の展開（2桁年・分省略・継続省略）
- 仮置き修飾子 `?` の適用範囲と不正位置の扱い
- `@plan` の祖先継承（Markdown には書かれない内部値）
- `@repeat` のオカレンス展開（DTSTART・期間長の維持）
- ステータスマーカー `[>]` `[!]` `[-]` の意味

その結果、同一ファイルから外部アプリとエディタで異なる予定が表示される。オーナーの根本課題である「期限と実施予定の管理不全」は、表示先が増えるほど解釈のズレによって悪化する。

本 Issue は、エディタが解析した結果を外部アプリへ渡すための唯一のデータ契約を Spec として確定し、外部アプリが Markdown を再パースせずにエディタと同一の解釈を再現できる状態を作る。

### 方向性

（2026-09-12 更新。変更前の方向性は「2. 進捗と実装メモ → History」に保存する）

- `project/specs/external-data-contract.spec.md` は、**現行実装が実際に渡しているデータの記述**とする。将来の理想形・未実装の構想を規範として書かない。
- 想定読者は「Calendar・Gantt と並ぶ新しい連携アプリを実装する開発者および AI」とする。
- 記述対象は次の5点とする。
  1. パーサ出力 `Document` の全フィールドと値の決まり方
  2. 受け渡し経路（`SourceEntry[]` / `ViewMountProps` / `registerUpdater`）
  3. 既存4投影（calendar・gantt・kanban・agenda）が実際に渡している値
  4. 書き戻し経路（`onNodePatch` / `upsert-meta`）と DnD ペイロード
  5. 識別子（`id` / `globalKey`）の生成規則と安定性の限界
- 未確定事項・未実装機能・実装と既存 Spec の食い違いは、断定せず**注釈 A-01〜A-11** として明示する。オーナー判断を先取りしない。
- 注釈は、対応する論点が決着した時点で BR 本文へ昇格させ、注釈自体を削除する（Spec §10）。

---

## 2. 進捗と実装メモ — FOR AI

### TODO

（2026-09-12 方針変更後。変更前の TODO は History に保存する）

- [ ] オーナー確認: 注釈 A-04（同一メタキーが複数記述された場合の扱い。実装は last-wins、`markdown-notation-guide.md` §4.1 は複数記述可と記述）
- [ ] オーナー確認: 注釈 A-11（日付のみ期間の終端解釈。`ast-to-calendar.ts` は endExclusive、`time-meta-model.spec.md` BR-006 は終日＝終了日を含む）
- [ ] オーナー承認後、Spec の `status` を `draft` → `active` へ更新する
- [ ] 注釈 A-07（`@plan` 継承）が `issue-phase004-003` で実装された時点で、Spec の該当注釈を BR へ昇格させる
- [ ] 注釈 A-09（`@plan`・`@due`・仮置きの投影）が `issue-phase004-004` で実装された時点で、Spec §4.7 の表と注釈を更新する
- [ ] 別 Issue 候補: 注釈 A-06（`schedule-normalize.ts` の月レベル継続省略未対応。`26-06-01/06-30` が `2026-06-01/2006-30` になる）
- [ ] 別 Issue 候補: 注釈 A-02（`parentId` が型に存在するが常に未代入）の整理
- [ ] プロセス外連携（別アプリへの JSON 受け渡し）が必要になった時点で、シリアライズ形式を別 Issue で定義する（注釈 A-01）

### Notes

- Spec の参考例（§9.2）は、実パーサ `parseMarkdown()` に同一 Markdown を通して出力を確認し、ノード `id`・`lineNumber`・正規化結果を実装と一致させた。
- Spec に埋め込んだ JSON Schema（§9.1）と参考例（§9.2）は、機械検証により整合を確認済み。
- 内部 AST との意図的な差分（外部契約側で変換が必要な箇所）:
  - `path`: 内部は自身を含み位置添字 `[n]` 付き・直近セクションのみ。契約は自身を含まず・添字なし・祖先セクションすべて。
  - `QuoteNode.raw` → 契約では `text` に統一。
  - `parentId`: 内部では未設定。契約では親ノードの `globalKey` を出力する。
  - `tentative`: 内部はキー別 boolean のオブジェクト。契約では各 `TimeValue` 内の `tentative: true`。
  - 継承 `@plan`: 契約では `derived.effectivePlan`（`value` ＋ `inheritedFrom`）として出力し、`meta.plan` には出力しない（time-meta BR-019 準拠）。
  - 日時値: 内部は `"start/end"` の1本の文字列。契約では `raw` に加えて `start` / `end` / `granularity` へ分解する。
- 参照した既存 Spec: `time-meta-model.spec.md`（BR-006・BR-008〜BR-012・BR-018〜BR-020）。
- 参照した実装: `src/lib/parser/{types,parse-markdown,mdast-to-nodes,mdast-to-sections,schedule-normalize,meta-keys}.ts`、`src/lib/parser/plugins/*.ts`、`src/lib/viewmodel/global-key.ts`、`src/lib/recurrence/expand.ts`、`src/lib/calendar/ast-to-calendar.ts`、`src/lib/gantt/ast-to-gantt.ts`。

### History (append-only)

#### 2026-09-12

- User Instruction:
  - エディタが Markdown からパースした情報を、外部アプリでもカレンダー／ガントと同じように利用できるようにしたい。まず外部アプリへ渡すデータのスキーマとその説明の仕様書を Markdown で作成し、`project/` の適切な場所へ格納すること。今後の標準仕様書として使える内容にすること。

- Change:
  - `project/specs/external-data-contract.spec.md` を新規作成（`status: draft`、BR-001〜BR-084、JSON Schema と参考例を含む）。
  - 本 Issue を新規作成（WORKFLOW §2.3 に基づき、既存 phase004 Issue はいずれも時間メタ3層モデルの実装であり、外部連携という別ドメインのため新規起票と判断）。

- Rationale:
  - 外部アプリが Markdown を再パースする方式では解釈のズレが不可避であり、エディタの解析結果そのものを契約として固定する必要がある。
  - Spec を `draft` としたのは、TODO に挙げた4点がオーナー決定を要するため（AI_RUNTIME_RULES §4）。

#### 2026-09-12（2回目・方針変更）

- User Instruction:
  - この Spec は現行実装ベースか、AI の理想ベースかという問い。回答後、「いったん曖昧さを残し注釈として入れた状態で、現状の実装ベースで仕様書を作成して」との指示。現状のまま外部アプリを新しい連携アプリとして追加する場合に、エディタからどんなデータが渡されるかを他の AI が理解できる内容にすること。

- Change:
  - Spec を全面的に書き直した。初版（エクスポート用 JSON 契約 `markdown-task-interchange` 1.0、BR-001〜BR-084、JSON Schema 付き）を破棄し、現行実装の受け渡しデータの記述（BR-001〜BR-067、注釈 A-01〜A-11）へ差し替えた。
  - BR 番号は初版が未承認・未公開であるため振り直した（NAMING_AND_ID_RULES §4 の「公開後は変更しない」に抵触しない）。
  - 参考例（Spec §9.1）は `parseMarkdown` / `extractCalendarItems` / `extractGanttNodes` / `extractKanbanCards` を実行した実出力に差し替えた。
  - 破棄した初版の主な設計要素（採用しなかったもの）: エンベロープ（format / schemaVersion / generatedAt / generator / timezone / contentHash）、`TimeValue` への start/end 分解、`meta` と `derived` の分離、`parentId` の globalKey 必須化、`path` の意味変更（自身除外・添字除去・祖先セクション全段）、`quote.raw` → `text` 改名、`derived.effectivePlan`、消費側の解釈規則（終日 inclusive・未知フィールド無視・MAJOR/MINOR 運用）、JSON Schema。
  - 変更前の「方向性」節の内容:

```
- `project/specs/external-data-contract.spec.md` を新規作成する（本 Issue で作成済み・`status: draft`）。
- 形式名は `markdown-task-interchange`、版は `schemaVersion: "1.0"` とする。
- 片方向（エディタ → 外部アプリ）のみを定義する。書き戻し・双方向同期は対象外とする。
- 内部 AST をそのまま公開せず、JSON 安全かつ言語非依存の表現へ写像する。
  - `meta`（Markdown 記述の忠実な写像）と `derived`（算出値）を明確に分離する。
  - 日時は `TimeValue`（`raw` / `start` / `end` / `granularity` / `tentative`）で表現する。
  - `Map`・`Luxon DateTime`・ライブラリ固有 prop 型を契約に持ち込まない。
- 時間メタの意味論は `project/specs/time-meta-model.spec.md` を参照するのみとし、新しい記法・新しい意味論を発明しない。
- エクスポータの実装（コマンド・出力先・UI）は本 Issue のスコープ外とし、Spec 承認後に別 Issue で起票する。
```

  - 変更前の TODO:

```
- [ ] オーナー確認: 日付のみ期間の終端解釈。本 Spec BR-065 は「開始日 00:00 〜 終了日 23:59:59.999」（終了日を含む）と定義した。これは `project/specs/time-meta-model.spec.md` BR-006（日付のみ＝終日）に整合させた判断である。一方、現行実装 `src/lib/calendar/ast-to-calendar.ts` の date-only 分岐は `endExclusive: rawEnd` として扱っており、`2026-06-01/2026-06-05` の表示が1日ずれる。どちらを正とするか、オーナーの決定が必要。
- [ ] オーナー確認: 同一タスクに同じメタキーが複数記述された場合の扱い。本 Spec BR-058 は「最後に出現した値のみ」（現行 `remark-meta-fields` の実挙動）と定義した。`project/knowledge/markdown-notation-guide.md` §4.1 は「同一タスクに複数の `@schedule` を書くことが可能」と記述しており、両者は不整合。複数 `@schedule` を正式にサポートする場合は契約側も配列表現へ変更が必要（MAJOR 更新）。
- [ ] オーナー確認: `contentHash` を必須とするか。現状は任意フィールドとして定義した。
- [ ] オーナー確認: `path`（`derived.path`）に祖先セクションをすべて含める方針でよいか。内部 AST は直近のセクション見出し1個のみを含めている。
- [ ] オーナー承認後、Spec の `status` を `draft` → `active` へ更新する。
- [ ] Spec 承認後、エクスポータ実装 Issue を起票する（出力コマンド・出力先・複数ファイル選択範囲・テスト）。
- [ ] 別 Issue 候補: `src/lib/parser/schedule-normalize.ts` の継続省略が月レベルの省略に未対応。`26-06-01/06-30` が `2026-06-01/2006-30` という不正値へ黙って変換される（例外も lint も出ない）。本 Issue のスコープ外。
```

- Rationale:
  - 初版は現行実装に存在しないエクスポータを前提とした設計提案であり、実装との対応が取れていなかった。オーナーの意図は「今の状態で連携アプリを作るための参照資料」であり、規範として書くべきは実装の事実である。
  - 未確定点を AI の判断で断定すると、実装と Spec の乖離が固定化する（AI_RUNTIME_RULES §4）。注釈として明示し、決着時に BR へ昇格させる運用とした。

#### 2026-09-12（3回目・読者の限定）

- User Instruction:
  - Spec は外部のアプリが見るものなので、Issue の話はしないこと。リポジトリの他の情報が全く分からない人や AI でも、このライブラリから与えられる情報とその意味が分かるようにすること。Spec 同士の相互参照は可。

- Change:
  - Spec からリポジトリ内部への参照をすべて削除した。削除対象は Issue 番号（issue-phase003-003 / issue-phase004-003 / issue-phase004-004）、governance 文書への参照、knowledge 文書への参照、`src/` 以下のファイルパス。`time-meta-model.spec.md` への参照のみ Spec 間参照として残した。
  - 読者を「ホスト実装を知らない連携アプリ開発者・AI」に固定し、値の意味を自己完結で説明する節を追加した。§3.2 に元になる Markdown 記法の要約とステータスマーカー5種の意味、§3.3 に時間メタ3層モデル（@plan / @schedule / @due / 仮置き）の意味を追加。
  - 主語を「本体」から「ホスト」へ、「投影層のファイル名」から「連携アプリ名」へ統一し、ファイル構成ではなく役割で記述する形に改めた（§4.7・§9.2）。
  - §9 の検証方法からテストファイルのパスを除き、検証層の区分のみとした。
  - §10 から Issue 起票手続きの記述を除き、実装との同期・注釈の昇格・BR 番号不変・記述の欠如は禁止を意味する旨のみとした。
  - BR 構成（BR-001〜BR-067）と注釈（A-01〜A-11）の内容は維持した。実例（§9.1）も実出力のまま維持した。

- Rationale:
  - Spec の配布先が別リポジトリの連携アプリ開発者である以上、リポジトリ内部の識別子・パスは読者にとって解決不能な参照であり、記述の信頼性を下げる。
  - 未確定事項は注釈として残す方針は維持する。読者が「決まっていないこと」を決まっていると誤解しないことが、外部実装の破綻を防ぐ。

#### 2026-09-12（4回目・サンプルデータ整備）

- User Instruction:
  - Spec を `documents/` へ移動した。`documents/` 内に、渡されるデータのサンプル JSON を作成すること。`demo/` に業務パターンとシチュエーションを網羅した約1000行の Markdown を新規作成し、その Markdown から生成される「外部アプリに渡されるデータ」の JSON を `documents/` に作成すること。

- Change:
  - `demo/demo_business_patterns.md`（1005行）を新規作成。インボックス・契約管理・ファシリティ／工事・人事／採用／入退社・経理／稟議・定例業務・移転プロジェクト（4フェーズWBS）・情シス・監査／コンプラ・社内イベント・来客／庶務・出張・クレーム対応・完了アーカイブ・保留案件・法定業務・業務改善・メモの各パターンを収録。末尾に「記法の境界ケース」セクションを置き、空値メタ・`?` 位置不正・数値でない priority・逆転した期間・月レベル継続省略・未知キー・schedule なし repeat・同一キー重複・不正 RRULE・5階層ネスト・見出しレベル飛ばし・4スペースインデントを含めた。
  - `documents/sample-external-data.json`（241行）と `documents/sample-external-data-full.json`（18906行）を生成。いずれも `_about`（生成条件）＋ `sources`（SourceEntry[]、nodeLineMap はオブジェクト化）＋ `projections`（calendar / gantt / kanban / agenda）の構成。
  - 生成スクリプト `tools/generate-sample-data.test.ts` と専用設定 `vitest.tools.config.ts` を追加し、`npm run gen:samples` で再生成できるようにした。通常の単体テストには含めない（`vite.config.ts` の `test.include` は `tools/` を含まないため）。
  - 生成結果と Spec の記述を突き合わせ、次の2点の記述誤りを修正した。
    - §7 の「値が空のメタ行は `meta` に反映されない」は誤り。実装は空値を除去せず、空文字列・`[""]`・`NaN` として保持する。記述を修正し、注釈 A-12 を追加した。
    - ガント投影に「`schedule` を持たないサブタスクを期間なしノードとして出力する」既定オフのオプションが存在することが記述漏れだった。BR-052 として追加し、以降の BR 番号を繰り下げた（BR-001〜BR-068）。
    - 注釈 A-05 に、`NaN` は JSON では `null` として現れる旨を追記した。
  - Spec §9.1 に、同梱する実例ファイル2件への参照表を追加した。

- Rationale:
  - 実装を実行して生成した実出力をサンプルとすることで、Spec の記述と実際の受け渡し内容の乖離を検出できる。実際に本作業で記述誤り2件を検出した。
  - サンプルを手書きせず生成スクリプト経由にしたのは、実装変更時に再生成するだけで同期を保てるようにするため。

#### 2026-09-12（5回目・サンプルの3段階化）

- User Instruction:
  - サンプルが巨大すぎたため、S/M/L の3段階（100行／250行／750行）の Markdown と、それぞれに対応する JSON を作成し、外部アプリ作成者が分かりやすい構成にすること。

- Change:
  - `demo/demo_business_patterns.md`（1005行）と `documents/sample-external-data.json` / `sample-external-data-full.json` を削除し、次の3組に置き換えた。
    - `demo/sample-s.md`（96行） → `documents/sample-external-data-s.json`（1644行）：タスク13件。基本記法のみ
    - `demo/sample-m.md`（266行） → `documents/sample-external-data-m.json`（5457行）：タスク44件。ステータス5種・@plan・仮置き・@repeat・@dependsOn・4階層
    - `demo/sample-l.md`（753行） → `documents/sample-external-data-l.json`（14128行）：タスク126件。多段WBS＋境界ケース
  - L は 1005行版から、他サイズと重複するセクション（社内イベント・来客庶務・出張・法定業務・業務改善・入退社手続き・規程文書管理・移転PJフェーズ3）を削除して構成した。境界ケースセクションは L に維持した。
  - 各 Markdown の冒頭に、そのファイルが含む記法と含まない記法、対になる JSON ファイル名を明記した。読者が S → M → L の順に段階的に読めるようにした。
  - 各 JSON の `_about` に、サイズ・含む記法・他サイズへの参照・生成条件・JSON 化による差異を記載した。
  - 生成スクリプトを3件ループ処理に変更した（`npm run gen:samples`）。
  - Spec §9.1 の実例ファイル表を S/M/L の3行に差し替えた。

- Rationale:
  - 単一の巨大サンプルでは、連携アプリ実装者が最初に全体像を掴むのに不向きだった。段階を分けることで、最小例で構造を理解してから、実務相当・網羅版へ進める。
  - 境界ケースは L のみに置き、S・M は正常系だけにした。最小例に不正入力が混ざると、正常な形が何かを読み取りにくくなるため。

---

## 3. Metadata

- id: issue-phase004-006__external-data-contract-spec
- status: open
- phase: 004
- related_specs: external-data-contract.spec.md, time-meta-model.spec.md
- related_decisions:
- target_files: documents/external-data-contract.spec.md, documents/sample-external-data-{s,m,l}.json, demo/sample-{s,m,l}.md, tools/generate-sample-data.test.ts, vitest.tools.config.ts
- created: 2026-09-12
- updated: 2026-09-12

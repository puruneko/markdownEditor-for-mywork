# Issue Details

## 1. 放置されているissueの詳細

### Status: done で close されていない issue（18件）

0017-0034の issue ファイルは、すべて `## Status` セクションに `done` と記載されているにもかかわらず、ファイル自体が削除もクローズも（close フラグの更新）もされていない。

これらは実装が完了した状態にあり、ユーザーの明示的な承認とクロージング操作を待っている状態と考えられます。

**対応方針:**
- WORKFLOW.md の Section 6「Issue Closure Rules」に従い、ユーザーの明示的な承認を得てから close する
- 承認前に、実装を本当に完了しているか再度検証することを推奨

---

## 2. 未実装機能の詳細

### 最新フェーズ（phase013-015）の issue

#### issue-phase015-markdownEditor-004__preamble-anonymous-section-top-level.md

**状態:** 実装中

**内容:** 前文（最初の見出しより前の内容）を持つ Markdown ファイルで、匿名セクションが全ての見出しを入れ子にしてしまう問題を修正。

**実装根拠:**
- History セクションに「2026-09-28」の実装記録がある
- しかし、`nestSections` 関数の修正が本当に完了しているか、テストが全て通っているかは不明

**重要度:** High（データ構造の整合性に関わるため）

#### issue-phase015-markdownEditor-003__metablock-dotted-border-keep-or-remove.md

**状態:** 設計検討中

**内容:** メタブロック点線囲みの UI について、「保持するのか削除するのか」の方針を決定する検討用 issue。

**判断:** 未実装機能というより「方針決定待ち」のステータス

#### issue-phase014-markdownEditor-004__meta-block-dotted-border-redesign.md

**状態:** 実装完了（試験段階）

**内容:** 連続するメタ行のまとまりを薄いグレーのドット線で囲む機能。CSS と CodeMirror ViewPlugin の実装。

**実装根拠:**
- Implementation requirements が明確に定義されている
- styles/metatag-wysiwyg.css への CSS 追加、src/editor/metatag-decoration.ts への ViewPlugin 追加が規定されている
- テスト要件も明確

**重要度:** Medium（UI/UX の改善）

---

## 3. phase000-004 グループの issue（未実装・仕様段階）

以下は、プロジェクト初期段階の大規模な仕様 issue であり、複数の小さな issue（phase001-015）に分割されている可能性がある：

| phase000 issue | 説明 | 対応する細分化 issue の例 |
|---|---|---|
| issue-phase000-001__notation-lint-quickfix.md | 記法リント＆クイックフィック | issue-phase010以降に細分化される可能性 |
| issue-phase000-002__obs-e2e-hardening-and-coverage.md | Obsidian E2E テスト強化 | テスト全般 |
| issue-phase000-003__kanban-subcard-drop-position.md | Kanban サブカード位置調整 | issue-kanban-phase004シリーズに対応 |
| issue-phase000-004__dashboard-view-integration.md | ダッシュボード統合 | 最新フェーズでは対応なし |

---

## 4. 複数フェーズにまたがる issue 統合

### Calendar / Gantt / Kanban シリーズ

- `issue-calendar-phase004-00X` (5件)
- `issue-gantt-phase004-00X` (8件)
- `issue-kanban-phase004-00X` (3件)

これらは各ビューコンポーネント（Calendar, Gantt, Kanban）の Phase4 段階での改善・機能追加。すべてが「unknown」ステータスで、実装状況の詳細は issue ファイル内を確認が必要。

---

## 5. 判断が難しかった issue

### status フィールドが "unknown" の 88 件

新しい issue ファイル形式（phase000 以降）では、YAML frontmatter の `status` フィールドではなく、Markdown の `## Status` セクションを使用。これにより bash での status 抽出に失敗した issue が多数。

**対応:** 重要度判定が必要な場合は、issue ファイルの実装要件・受け入れ基準セクションを個別に確認してください。

---

## 6. Proposed status の issue（14件）

初期段階（0002-0011）の issue で、「提案」段階にあるもの。これらは基盤機能の仕様設計段階であり、実装が進んでいる可能性は低い。

---

## 補足

**このレポートの目的:**
現在残っている対応事項を把握すること。特に以下を確認してください：

1. **done マーク済みの 18 件** → ユーザー確認・承認を得て close する
2. **phase013-015 の 9 件** → 実装状況を確認し、テスト実行・機能検証を行う
3. **phase000-012 の 88 件** → 必要に応じて、priority 決定と実装スケジュール再評価


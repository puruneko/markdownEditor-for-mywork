# 拡張機能設定画面の各行の高さを小さくしてスリム化する

## 背景
要望原文（markdownEditor-for-mywork）:
> 拡張機能設定画面の各行の高さを全体的に小さくし、スリム化して。

採用した解釈: Obsidian の「設定 > MD AST Editor」タブ全体（ビュー別設定のセクションを含む）で、各設定行の上下余白・説明文の間隔を縮める。項目・文言は変えない。

## 目的
設定画面を一覧しやすくする。

## 現状
- `src/settings.ts` の `MdAstEditorSettingTab.display()`（L74〜）: `containerEl.empty()` 後、`h2` と Obsidian 標準の `new Setting(containerEl)` で各行を作成。ビュー別設定は `src/settings-view-sections.ts` の `renderViewSettingsSections(containerEl, hub)`。
- 設定タブ専用のクラス・CSS は無く、Obsidian 標準の `.setting-item`（上下 padding 約 0.75em）のまま。
- CSS は `styles/*.css` を編集する（ルートの `styles.css` はビルド生成物。`esbuild.config.mjs` の stylesBundlePlugin が結合）。

## 実装内容
1. `display()` の冒頭で `containerEl.addClass('md-ast-editor-settings')` を付与。
2. `styles/base.css` に、このクラス配下だけに効くスタイルを追加:
   - `.setting-item`: `padding-top: 4px; padding-bottom: 4px;`
   - `.setting-item-name`: `line-height: 1.3;`
   - `.setting-item-description`: `padding-top: 0; line-height: 1.3;`
   - `h2`, `h3` 等の見出し・`.setting-item-heading`: 上下 margin/padding を縮小（例 margin: 12px 0 4px）。
   - テキストエリア等の入力欄の高さは変更しない。
3. 他プラグインや Obsidian 本体の設定画面に影響しないよう、セレクタは必ず `.md-ast-editor-settings` から始める。

## 完了条件
- 本プラグインの設定タブで、各行の上下余白が縮み、同じ画面内により多くの項目が表示される。
- 他のプラグイン・Obsidian 本体の設定画面の見た目は変わらない。
- 全項目が従来どおり操作できる。

## テスト
- `npm run build` 後、Obsidian で設定タブを開いて確認（ライト/ダークテーマ）。
- `npm run test:unit` が通ること。

## 依存関係
- issue-phase020-markdownEditor-for-mywork-003__frequent-meta-keys-suggest.md（設定項目が追加されるため、その後に見た目を確認する）

## 対象外
- 設定項目の追加・削除・並べ替え・文言変更。

## 要確認
なし

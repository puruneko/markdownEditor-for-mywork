# 開発再開サマリー

**報告日**: 2026-10-05  
**現在のブランチ**: main  
**最新コミット**: 1afe33d (user commit: main.js)  
**直前の機能実装**: 696048c (feat: phase020 issues 001-005)

---

## 現在の状態

**実装進捗**: Phase020 完了（5つの小機能実装）
- カレンダーで @schedule 付きタスクの @due も期限表示
- 日付入力ピッカーの外側クリックで保存・Esc で破棄
- よく使うメタ情報名を設定で管理、サジェストに優先表示
- @repeat 入力支援ピッカーの実装
- 設定画面のスリム化

**ステージング状態**: ドキュメント更新が多数ステージングされていない
- 削除: `documents/ARCHITECTURE.md` など 5ファイル
- 追加: `README.md`, `documents/META_KEY_GUIDE.md` など新ドキュメント
- 追加: `project/development/` 配下の新開発ドキュメント

**テスト状況**: ユニットテスト群は実行可能（複数スイート存在）

---

## 1. プロダクトの目的と概要

### 概要
**MD AST Editor** は Obsidian プラグインとして動作するマークダウンベースのタスク・プロジェクト管理エディタ。

### 利用者・目的
- マークダウン形式でタスク・プロジェクトを管理したい Obsidian ユーザー
- 複雑なスケジュールと依存関係を扱うニーズ
- 複数のビュー（カレンダー・ガント・かんばん等）で同一データを可視化したい

### 主な特徴
- **マークダウンネイティブ**: プレーンテキストベース、バージョン管理との親和性
- **複数ビュー**: Calendar（日付軸）、Gantt（スケジュール）、Kanban（ステータス列）、Dashboard（集計）
- **メタ情報システム**: @schedule（予定）、@due（期限）、@plan（計画期間）、@priority、@tags、@repeat など
- **3層時間モデル**: plan（計画期間）/ schedule（実施日時）/ due（期限）を区分
- **エディタ統合**: CodeMirror 6 拡張で、メタ情報の自動装飾・サジェスト・日付ピッカー

---

## 2. 技術的な実装

### 技術スタック
| 層 | 技術 |
|---|---|
| **ランタイム** | Obsidian SDK (Electron) |
| **言語** | TypeScript |
| **UI フレームワーク** | Svelte 5 |
| **マークダウン解析** | unified / remark (AST化) |
| **エディタ拡張** | CodeMirror 6 |
| **日時計算** | Luxon、rrule（繰り返し展開） |
| **ビルド** | esbuild、Vite |
| **テスト** | Vitest（単体）、Playwright（E2E）、WebdriverIO（Obsidian E2E） |
| **外部コンポーネント** | svelte-calendar-lib、svelte-gantt-lib、svelte-kanban-lib、svelte-dashboard-lib（別リポジトリ） |

### アーキテクチャ（簡略）

```
Markdown File
    ↓
Parser (remark/unified) → AST (mdast)
    ↓
Contract Layer (Document/Node/Meta)
    ↓
AstIndex (複数ファイル索引) & FileSync (変更通知)
    ↓
EditorEventBus (イベント中継)
    ↓
Views (Calendar/Gantt/Kanban/etc) → Svelte Components
```

### 主要モジュール構成
```
src/
├── plugin.ts                # Obsidianプラグインエントリ（ライフサイクル管理）
├── settings.ts              # プラグイン設定・バリデーション
├── sync/                    # ファイル同期・AST索引・イベント中継
├── views/                   # ビュークラス (Calendar/Gantt/Kanban/Dashboard/AST/ParseDebug)
├── editor/                  # CodeMirror 6 拡張 (fold/decoration/suggest/lint/drag)
└── lib/
    ├── parser/              # Markdown → AST解析、メタキー抽出
    ├── contract/            # データ構造定義 (Document/Node/Meta)
    ├── calendar/            # カレンダービュー用ロジック
    ├── gantt/               # ガント用ロジック
    ├── kanban/              # かんばん用ロジック
    ├── query/               # クエリ実行エンジン
    ├── recurrence/          # 繰り返しスケジュール計算
    ├── format/              # フォーマット・変換
    ├── viewmodel/           # ビュー固有データ構造
    ├── highlight/           # シンタックスハイライト
    └── debug/               # デバッグビュー用
```

### 重要な設計
- **Shadow DOM 分離**: ビューは Obsidian テーマから独立（theme lockdown）
- **AST キャッシング**: 複数ファイルの AST を索引化、ホットリロード対応
- **メタキー正規化**: カノニカル定義 (`meta-keys.ts`) による一元管理
- **ID 管理**: グローバルキー（`${fileName}#${nodeId}`）で全体通し番号化

---

## 3. 実装済みの機能

### Core 機能（完成度：高）
- ✅ **マークダウン解析**: チェックボックス・階層構造・メタ情報抽出
- ✅ **メタ情報システム**: @schedule, @due, @plan, @priority, @tags, @repeat, @memo, @goal, @condition, @dependencies
- ✅ **タスク状態**: [ ], [>], [x] のステータス表示
- ✅ **エディタ装飾**: メタ情報のハイライト、チップ表示、シンタックスハイライト

### ビュー実装（完成度：中～高）

#### Calendar View
- ✅ 日付ベースでタスク可視化
- ✅ @schedule（予定）を日時として表示
- ✅ **最新**: @schedule + @due 両方持つタスクで期限も表示（Phase020-001）
- ✅ ドラッグ&ドロップで日付変更
- ✅ 週・月表示
- 🔄 週末・祝日色分け（未実装）

#### Gantt View
- ✅ スケジュール・依存関係の可視化
- ✅ ツリー構造の階層表示
- ✅ **最新**: サブタスク展開表示（デフォルト ON）
- ✅ ドラッグで日付変更
- 🔄 セル編集で Markdown 書き戻し（未実装）
- 🔄 見出しの @schedule 反映（未実装）

#### Kanban View
- ✅ ステータス列表現（予定・進行中・完了など）
- ✅ グルーピング機能
- 🔄 グルーピング正規化の修正（未実装）

#### Dashboard View
- ✅ メトリクス・統計表示
- ✅ チャート表示

#### 開発者向けビュー
- ✅ AST View: 解析結果のツリー表示
- ✅ ParseDebug View: パーサー動作確認

### エディタ拡張（完成度：高）

#### インライン機能
- ✅ メタ情報のシンタックスハイライト
- ✅ @schedule, @due の日付チップ（クリック可能）
- ✅ **最新**: 日付ピッカーの外側クリックで保存（Phase020-002）
- ✅ 日付ピッカー（時刻入力対応、分刻み設定可）
- ✅ @repeat 入力支援ピッカー（Phase020-004）
- ✅ バリデーション（lint）

#### サジェスト・オートコンプリート
- ✅ @ 入力でメタキー提案
- **最新**: よく使うメタキーを優先表示、仕切り線で区分（Phase020-003）
- ✅ 日付の自然言語入力（「来週」など）の検討対象

#### メタ情報管理
- ✅ メタ情報の折りたたみ・展開（エディタコマンド）
- ✅ メタ行自動整形（推奨位置へ配置）
- 🔄 メタ情報ブロック単位の折りたたみ（2行以上対応）（未実装）

### データ管理（完成度：高）
- ✅ **AST 索引**: Vault 全体またはフォルダ指定で複数ファイル索引化
- ✅ **ファイル同期**: 変更検知（debounce）、ホットリロード
- ✅ **データ書き戻し**: ビューからのドラッグ・編集を Markdown に反映
- ✅ **キャッシング**: パフォーマンス最適化

### 設定機能（完成度：中）
- ✅ リボンアイコン表示切り替え
- ✅ タスクハイライト ON/OFF
- ✅ 日付ピッカー分刻み設定
- **最新**: よく使うメタキー設定（Phase020-003）
- **最新**: 設定画面スリム化（Phase020-005）
- ✅ メタキーユーザー別名定義
- ✅ 索引スコープ設定
- ✅ デバウンス時間調整
- ✅ ビュー別設定の永続化（data.json）
- 🔄 ビュー設定の復元状況の E2E 検証（未実装）

---

## 4. 直近で実装した内容

### Phase020 実装内容（最新）
**コミット**: 696048c (feat: phase020 issues 001-005)

| Issue | タイトル | 内容 | 状態 |
|-------|---------|------|------|
| phase020-001 | カレンダーで @schedule 付きタスクの @due も期限表示 | `extractFromNodes` の条件から `!node.meta?.schedule` を外す → @schedule と @due を両持つタスク対応 | ✅ |
| phase020-002 | 日付ピッカー外側クリック保存 | 外側クリック → 入力保存、Esc → 破棄 | ✅ |
| phase020-003 | よく使うメタキー優先表示 | 設定で指定したメタキー（デフォルト: memo）を @ サジェスト内に仕切り線付きで優先表示 | ✅ |
| phase020-004 | @repeat 入力支援ピッカー | UI で繰り返し設定を入力、複雑な rrule 記法を隠蔽 | ✅ |
| phase020-005 | 設定画面スリム化 | 各行の高さ減少、より多くの設定項目を 1 画面で表示 | ✅ |

### その前の主要実装
- **Phase019** (3 issues): ユーザー定義メタキー別名、lint 整形、ツリーペーン幅設定削除
- **ガント サブタスク展開**: Issue #gantt-phase004-007（デフォルト ON に変更）
- **マルチソース AST インデックス**: 複数ファイル対応の基盤整備
- **Phase002 完了**: @repeat 繰り返し展開、Agenda/Health ビュー実装

### 変更トレンド
- エディタ UX の向上（入力支援・サジェスト改善）
- ビュー設定の拡張・柔軟化
- メタキーシステムの使いやすさ向上

---

## 5. 現在の未完了事項

### Open Issues（主要なもの）

#### エディタ拡張
- 🔄 メタ情報ブロック単位の折りたたみ（2行以上対応）（phase018-003）
- 🔄 メタ情報ブロックの編集可能化
- 🔄 カーソル位置のメタ情報とビューの同期（phase026）

#### ビュー機能
| ビュー | 未実装項目 |
|--------|---------|
| **Calendar** | 週末・祝日の色分け、仮置き表示（半透明） |
| **Gantt** | ツリーセル編集の Markdown 書き戻し、見出し自身の @schedule 反映、explicit schedule flag |
| **Kanban** | グルーピング正規化、表示バグ修正 |
| **Dashboard** | 機能拡張案は複数検討中 |

#### パーサー・データモデル
- 🔄 新しい Markdown parser API 統一（issue 0031）
- 🔄 parser を unified 統一（issue 0033）
- 🔄 期間形式の @due（開始/終了）のカレンダー表示

#### 設定・ポリシー
- 🔄 Section メタの新設（@close / #close / @memo）
- 🔄 クローズ案件の投影前フィルタ
- 🔄 ビュー設定の E2E 検証（保存・復元の完全性確認）

#### 外部ライブラリ連携
- 🔄 svelte-gantt-lib への外部ドロップ対応・イベント公開要望
- 🔄 各ビュー lib の Svelte 5 対応・デリバティブ警告修正

#### 開発者向け
- 🔄 DevTools Element 追跡（Chrome DevTools の要素選択が効かない問題 → 調査済み、原因は SDK 必須機能）
- 🔄 メタキー追加時の 5 ファイルチェックリスト作成

### Issue 数の実態
- **総数**: 163 個
- **Phase 分類**: Phase003, Phase010-020 など多段階に分かれている
- **サブカテゴリ**: obs（Obsidian 統合）、calendar/gantt/kanban/dashboard（ビュー別）、markdownEditor（エディタ）など
- **Closed**: 複数（例: 0036-kanban-click-scroll-offset）

### ドキュメント・コード不一致の可能性
- 削除されたドキュメント（ARCHITECTURE.md など）と新ドキュメント（project/development/ 配下）の対応関係を確認する必要あり
- 実装コードとドキュメントの定義に齟齬がないか確認推奨

---

## 6. 今後の実装の推奨案（簡潔に）

### 短期（次のフェーズ）
1. **ステージング整理**: ドキュメント変更をコミットするか確認して整理
2. **Phase021 計画**: 次のフェーズのissue群（未実装の小機能）をまとめる
3. **テスト拡張**: Phase020 実装後のテストカバレッジ確認・不足テスト追加

### 中期（1～2 フェーズ先）
1. **ビュー UX 向上**: Calendar/Gantt セル編集の Markdown 書き戻し、Kanban グルーピング修正
2. **メタキーシステム整備**: 新メタ（@close など）の追加・lint 整備
3. **外部ライブラリ Svelte 5 対応**: 各 lib の Svelte 5 デリバティブ警告解消

### 長期
1. **データモデル統一**: Parser API の統一（unified 推進）
2. **ビュー高度化**: 依存関係の自動解決、クリティカルパス表示など
3. **Obsidian プラグイン成熟化**: Theme lockdown 完全化、パフォーマンス最適化

---

## 7. 開発再開時に知っておくべき注意点

### 運用ルール
- **Issue 駆動開発**: 機能実装は `project/issues/` のissue ファイルに基づいて実施
  - Haiku（小モデル）が実装できる詳細度が必須
  - Issue 内容は本体に出力しない（内部ドキュメント）
- **Issue Update ポリシー**: 既存issue の更新を優先（新規作成は最小限）
- **Issue Closure**: ユーザー明示的承認後のみ（自動 close 禁止）
- **コミット**: issue closure 時に全関連ファイルをコミット

### ガバナンス重要事項
- **Governance ドキュメント**: `project/governance/` で各ルール定義
  - `WORKFLOW.md`: Issue 駆動開発・closure ルール
  - `NAMING_AND_ID_RULES.md`: ID・命名規則
  - `TESTING_STANDARD.md`: テスト基準
  - `JAPANESE_WRITING_STANDARD.md`: 日本語記述規則
  - `AI_RUNTIME_RULES.md`: AI 実装時の制約

### テスト実行
```bash
npm run test:unit              # ユニットテスト（推奨）
npm run test:obs:e2e:headed   # Obsidian E2E テスト（ヘッド付き）
npm run test                   # 全テスト
```

### 開発環境起動
```bash
npm install
npm run build:dev             # 開発ビルド
npm run obs:update:manifest   # Obsidian へコピー
```

### 外部ライブラリ
- Calendar/Gantt/Kanban/Dashboard: 別リポジトリ（`../calendar-for-mywork` など）
- `npm run libs:update` で最新版インストール
- 修正が必要な場合は各リポジトリで対応後、ここで npm install

### 現在の進行中事項
- 次の Phase（021 以降）の issue テンプレート準備状況を確認
- Svelte 5 への外部ライブラリ対応状況を追跡
- Obsidian プラグインのビルド・テスト環境の安定性確認

### クレジット・トークン効率
- 不要なファイル読み込み避ける（大量の issue ファイル一括読込みは避ける）
- Explore エージェント活用で効率的に code search
- メモリ内容を活用して重複確認を削減

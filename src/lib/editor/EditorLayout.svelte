<script lang="ts">
  import MonacoEditor from './MonacoEditor.svelte'
  import CalendarTab from '../calendar/CalendarTab.svelte'
  import GanttTab from '../gantt/GanttTab.svelte'
  import { parseMarkdown } from '../parser/md-to-ast'
  import { serializeAst } from '../parser/ast-to-md'
  import type { Document } from '../parser/types'

  // Sync direction state
  type Direction = 'idle' | 'md-to-ast' | 'ast-to-md'
  let direction: Direction = $state('idle')

  // Right panel tab state (#0013, #0020)
  type RightTab = 'ast' | 'calendar' | 'gantt'
  let rightTab: RightTab = $state('ast')

  // Initial markdown content (static — used only for initialization)
  const INITIAL_MD = `# Webアプリ開発プロジェクト

> 方針
> - ユーザー体験を最優先とした設計
> - テスト駆動開発を徹底する
> - CI/CDによる継続的デプロイを維持

## 要件定義フェーズ

- 要件整理
  - [x] ステークホルダーヒアリング
    @schedule: 2026-01-15T10:00/2026-01-15T17:00
    - [x] 営業チームヒアリング
      @schedule: 2026-01-15T10:00/2026-01-15T12:00
    - [x] サポートチームヒアリング
      @schedule: 2026-01-15T14:00/2026-01-15T16:00
    - [x] 経営陣へのプレゼン
      @schedule: 2026-01-15T16:00/2026-01-15T17:00
  - [x] ユーザーインタビュー
    @schedule: 2026-01-20T10:00/2026-01-24T18:00
    - [x] インタビュー設計
    - [x] 対象者リクルーティング
    - [x] インタビュー実施（5名）
    - [x] 結果まとめ・分析
  - [x] 競合調査
    @schedule: 2026-01-25T10:00/2026-01-30T18:00
    - [x] 国内競合3社分析
    - [x] 海外サービス5件調査
    - [x] 差別化ポイント整理
  - メモ
    - MVP重視で最初のリリースは機能を絞る
    - モバイルファーストで設計する

- 機能仕様策定
  - [x] ユーザーストーリーマッピング
    @schedule: 2026-02-01T10:00/2026-02-02T18:00
  - [x] 優先度付け（MoSCoW）
    @schedule: 2026-02-03T10:00/2026-02-03T15:00
  - [x] 仕様書ドラフト作成
    @schedule: 2026-02-05T10:00/2026-02-12T18:00
    - [x] 認証・認可仕様
    - [x] データモデル仕様
    - [x] API仕様（REST）
    - [x] 画面遷移図
  - [x] 仕様書レビュー・承認
    @schedule: 2026-02-15T10:00/2026-02-17T18:00

## 設計フェーズ

- システム設計
  - [x] アーキテクチャ設計
    @schedule: 2026-02-18T10:00/2026-02-20T18:00
    - [x] フロントエンド技術選定（Svelte + Vite）
    - [x] バックエンド技術選定（Node.js + Express）
    - [x] DBスキーマ設計（PostgreSQL）
    - [x] インフラ構成図作成（AWS）
  - [x] セキュリティ設計
    @schedule: 2026-02-21T10:00/2026-02-22T18:00
    - [x] 認証方式（JWT + Refresh Token）
    - [x] 権限モデル設計（RBAC）
    - [x] データ暗号化方針
  - [-] マイクロサービス化検討（スコープ外）

- UI/UX設計
  - [x] デザインシステム構築
    @schedule: 2026-02-25T10:00/2026-03-05T18:00
    - [x] カラーパレット定義
    - [x] タイポグラフィ規定
    - [x] コンポーネントライブラリ設計
    - [x] アイコンセット選定
  - [x] ワイヤーフレーム作成
    @schedule: 2026-03-06T10:00/2026-03-10T18:00
    - [x] ログイン・登録画面
    - [x] ダッシュボード
    - [x] タスク管理画面
    - [x] 設定画面
    - [x] 管理者画面
  - [x] プロトタイプ作成
    @schedule: 2026-03-11T10:00/2026-03-14T18:00
  - [x] ユーザビリティテスト
    @schedule: 2026-03-17T10:00/2026-03-20T18:00
    - [x] テスト設計（5タスク）
    - [x] テスト実施（5名）
    - [x] フィードバック反映
  - メモ
    - 主要フローの操作は3クリック以内に収める

## 実装フェーズ

- 開発環境構築
  - [x] リポジトリ設計（モノレポ）
    @schedule: 2026-03-18T10:00/2026-03-18T18:00
  - [x] CI/CDパイプライン構築
    @schedule: 2026-03-19T10:00/2026-03-20T18:00
    - [x] GitHub Actions設定
    - [x] テスト自動実行設定
    - [x] Dockerfileおよびdocker-compose
  - [x] 開発・ステージング環境構築
    @schedule: 2026-03-21T10:00/2026-03-22T18:00

- フロントエンド実装
  - [ ] 共通コンポーネント
    @schedule: 2026-03-23T10:00/2026-03-27T18:00
    - [ ] Button・Inputコンポーネント
      @schedule: 2026-03-23T10:00/2026-03-24T18:00
    - [ ] Modal・Dialogコンポーネント
      @schedule: 2026-03-25T10:00/2026-03-25T18:00
    - [ ] Table・Listコンポーネント
      @schedule: 2026-03-26T10:00/2026-03-26T18:00
    - [ ] Formコンポーネント
      @schedule: 2026-03-27T10:00/2026-03-27T18:00
  - [ ] 認証画面
    @schedule: 2026-03-28T10:00/2026-03-31T18:00
    - [ ] ログイン画面
      @schedule: 2026-03-28T10:00/2026-03-29T18:00
    - [ ] 新規登録画面
      @schedule: 2026-03-30T10:00/2026-03-30T18:00
    - [ ] パスワードリセット画面
      @schedule: 2026-03-31T10:00/2026-03-31T18:00
  - [ ] ダッシュボード画面
    @schedule: 2026-04-01T10:00/2026-04-03T18:00
    - [ ] KPIウィジェット
      @schedule: 2026-04-01T10:00/2026-04-01T18:00
    - [ ] アクティビティフィード
      @schedule: 2026-04-02T10:00/2026-04-02T18:00
    - [ ] クイックアクション
      @schedule: 2026-04-03T10:00/2026-04-03T18:00
  - [ ] タスク管理画面
    @schedule: 2026-04-06T10:00/2026-04-10T18:00
    - [ ] タスク一覧（フィルタ・ソート）
      @schedule: 2026-04-06T10:00/2026-04-07T18:00
    - [ ] タスク詳細・編集
      @schedule: 2026-04-08T10:00/2026-04-08T18:00
    - [ ] タスク作成フロー
      @schedule: 2026-04-09T10:00/2026-04-09T18:00
    - [ ] ドラッグ&ドロップ並び替え
      @schedule: 2026-04-10T10:00/2026-04-10T18:00
  - [ ] 設定画面
    @schedule: 2026-04-13T10:00/2026-04-15T18:00
    - [ ] プロフィール設定
    - [ ] 通知設定
    - [ ] セキュリティ設定（2FA）

- バックエンド実装
  - [ ] 認証API
    @schedule: 2026-03-24T10:00/2026-03-28T18:00
    - [ ] ユーザー登録エンドポイント
      @schedule: 2026-03-24T10:00/2026-03-25T18:00
    - [ ] ログイン・ログアウト
      @schedule: 2026-03-26T10:00/2026-03-26T18:00
    - [ ] トークンリフレッシュ
      @schedule: 2026-03-27T10:00/2026-03-27T18:00
    - [ ] パスワードリセットフロー
      @schedule: 2026-03-28T10:00/2026-03-28T18:00
  - [ ] タスクCRUD API
    @schedule: 2026-03-31T10:00/2026-04-04T18:00
    - [ ] タスク作成・取得
      @schedule: 2026-03-31T10:00/2026-04-01T18:00
    - [ ] タスク更新・削除
      @schedule: 2026-04-02T10:00/2026-04-02T18:00
    - [ ] タスク検索・フィルタリング
      @schedule: 2026-04-03T10:00/2026-04-03T18:00
    - [ ] タスク並び順管理
      @schedule: 2026-04-04T10:00/2026-04-04T18:00
  - [ ] 通知API
    @schedule: 2026-04-07T10:00/2026-04-09T18:00
    - [ ] メール通知（SES）
    - [ ] プッシュ通知（WebPush）
    - [ ] In-App通知
  - [>] WebSocket対応（リアルタイム更新）
    @schedule: 2026-04-14T10:00/2026-04-17T18:00
  - メモ
    - レートリミット: 100req/min/IP
    - レスポンス形式: JSON:API準拠

- データベース
  - [x] マイグレーション設計
    @schedule: 2026-03-20T10:00/2026-03-21T18:00
  - [ ] シードデータ作成
    @schedule: 2026-03-24T10:00/2026-03-24T18:00
  - [ ] インデックス最適化
    @schedule: 2026-04-10T10:00/2026-04-11T18:00
  - [!] N+1問題の調査（ブロック中）
    @schedule: 2026-04-07T10:00/2026-04-07T18:00

## テストフェーズ

- 単体テスト
  - [ ] フロントエンドテスト
    @schedule: 2026-04-16T10:00/2026-04-20T18:00
    - [ ] コンポーネントテスト（Vitest）
    - [ ] ユーティリティ関数テスト
    - [ ] ストアテスト
  - [ ] バックエンドテスト
    @schedule: 2026-04-16T10:00/2026-04-20T18:00
    - [ ] APIエンドポイントテスト
    - [ ] サービス層テスト
    - [ ] DBクエリテスト
  - 目標
    - カバレッジ80%以上

- 統合テスト
  - [ ] E2Eテスト設計
    @schedule: 2026-04-21T10:00/2026-04-22T18:00
  - [ ] E2Eテスト実装（Playwright）
    @schedule: 2026-04-23T10:00/2026-04-27T18:00
    - [ ] 認証フロー
    - [ ] タスクCRUDフロー
    - [ ] 通知フロー
  - [ ] 負荷テスト
    @schedule: 2026-04-28T10:00/2026-04-29T18:00
    - [ ] k6によるシナリオ作成
    - [ ] 1000同時接続テスト

- セキュリティテスト
  - [ ] 脆弱性スキャン
    @schedule: 2026-04-30T10:00/2026-04-30T18:00
  - [-] ペネトレーションテスト（次フェーズに延期）

## リリース準備

- [ ] 本番環境構築
  @schedule: 2026-05-01T10:00/2026-05-05T18:00
  - [ ] AWSリソース構築（Terraform）
  - [ ] CloudFront + S3設定
  - [ ] RDS設定（Multi-AZ）
  - [ ] ElastiCache（Redis）設定
  - [ ] ALB + Auto Scaling設定
- [ ] モニタリング設定
  @schedule: 2026-05-06T10:00/2026-05-07T18:00
  - [ ] DatadogによるAPM設定
  - [ ] エラートラッキング（Sentry）
  - [ ] ログ集約（CloudWatch Logs）
  - [ ] アラート設定
- [ ] ドキュメント整備
  @schedule: 2026-05-08T10:00/2026-05-11T18:00
  - [ ] APIドキュメント（OpenAPI）
  - [ ] 運用手順書
  - [ ] 障害対応フロー

# インフラ刷新プロジェクト

> 目標
> - オンプレミスからクラウドへの完全移行
> - 運用コストを30%削減
> - 可用性99.9%以上を達成

## 現状調査

- [x] 現行システム棚卸し
  @schedule: 2026-01-05T10:00/2026-01-09T18:00
  - [x] サーバー一覧作成（物理/仮想）
  - [x] ネットワーク構成図更新
  - [x] ソフトウェアインベントリ収集
  - [x] 依存関係マッピング
- [x] コスト分析
  @schedule: 2026-01-12T10:00/2026-01-14T18:00
  - [x] 現行TCO算出
  - [x] クラウド移行後TCO試算
  - [x] ROI試算（3年）
- [x] リスク評価
  @schedule: 2026-01-15T10:00/2026-01-16T18:00

## 移行計画

- [x] クラウド設計
  @schedule: 2026-02-01T10:00/2026-02-14T18:00
  - [x] マルチリージョン構成設計
  - [x] ネットワーク設計（VPC・サブネット）
  - [x] セキュリティグループ設計
  - [x] IAMポリシー設計
  - [x] 災害復旧（DR）設計
- [x] 移行順序決定
  @schedule: 2026-02-15T10:00/2026-02-17T18:00
  - [x] Wave 1: 開発環境
  - [x] Wave 2: ステージング環境
  - [x] Wave 3: 本番環境（低トラフィック）
  - [x] Wave 4: 本番環境（高トラフィック）

## Wave 1: 開発環境移行

- [x] 開発環境移行
  @schedule: 2026-02-18T10:00/2026-02-28T18:00
  - [x] EC2インスタンス起動
  - [x] データ移行（スクリプト作成）
  - [x] 動作確認テスト
  - [x] 開発チームへの切り替え案内

## Wave 2: ステージング環境移行

- [x] ステージング移行
  @schedule: 2026-03-01T10:00/2026-03-14T18:00
  - [x] RDS移行（pg_dump/restore）
  - [x] ElastiCache移行
  - [x] S3バケット設定
  - [x] DNS切り替え（Route53）
  - [x] SSL証明書設定（ACM）
  - [x] 負荷テスト実施

## Wave 3: 本番移行（フェーズ1）

- [ ] 本番移行準備
  @schedule: 2026-03-23T10:00/2026-03-27T18:00
  - [ ] 移行リハーサル実施
    @schedule: 2026-03-23T10:00/2026-03-24T18:00
  - [ ] ロールバック手順確認
    @schedule: 2026-03-25T10:00/2026-03-25T18:00
  - [ ] 監視・アラート設定確認
    @schedule: 2026-03-26T10:00/2026-03-26T18:00
  - [ ] カットオーバー計画書最終確認
    @schedule: 2026-03-27T10:00/2026-03-27T18:00
- [ ] 本番カットオーバー（低トラフィックシステム）
  @schedule: 2026-03-28T22:00/2026-03-29T04:00
  - [ ] メンテナンス告知
  - [ ] 旧環境バックアップ
  - [ ] 新環境への切り替え
  - [ ] 動作確認・監視強化
- [>] Wave 4移行（4月中旬に実施予定）
  @schedule: 2026-04-14T22:00/2026-04-15T04:00

## 運用体制整備

- [ ] 運用チーム教育
  @schedule: 2026-04-01T10:00/2026-04-03T18:00
  - [ ] AWS操作研修
  - [ ] インシデント対応訓練
  - [ ] オンコール体制確立
- [ ] コスト最適化
  @schedule: 2026-04-20T10:00/2026-04-24T18:00
  - [ ] Reserved Instancesの購入検討
  - [ ] Savings Plans適用
  - [ ] 不要リソース削除
  - [ ] Auto Scalingポリシー最適化
- メモ
  - 移行完了後6ヶ月はオンプレ環境を維持（緊急時切り戻し用）

# データ分析基盤プロジェクト

> 目標
> - 全社データをリアルタイムに分析可能にする
> - データドリブンな意思決定文化を醸成する

## データ収集層

- [x] データソース調査
  @schedule: 2026-01-20T10:00/2026-01-23T18:00
  - [x] Webアプリのイベントログ
  - [x] 基幹システムDB
  - [x] SaaSツール（Salesforce・Slack等）
  - [x] 外部データ（気象・市場）
- [x] データカタログ作成
  @schedule: 2026-02-03T10:00/2026-02-07T18:00
- [ ] データパイプライン構築
  @schedule: 2026-03-23T10:00/2026-04-03T18:00
  - [ ] Kafkaクラスター構築
    @schedule: 2026-03-23T10:00/2026-03-26T18:00
    - [ ] ブローカー3台構成
    - [ ] トピック設計
    - [ ] スキーマレジストリ設定
  - [ ] Fluentdによるログ収集設定
    @schedule: 2026-03-27T10:00/2026-03-28T18:00
  - [ ] CDC（Change Data Capture）設定
    @schedule: 2026-03-31T10:00/2026-04-01T18:00
    - [ ] Debezium設定（PostgreSQL）
    - [ ] Debezium設定（MySQL）
  - [ ] バッチ取り込み設定（S3 → Kafka）
    @schedule: 2026-04-02T10:00/2026-04-03T18:00

## データストレージ層

- [x] データレイク設計
  @schedule: 2026-02-10T10:00/2026-02-14T18:00
  - [x] S3バケット構成（Bronze/Silver/Gold）
  - [x] パーティション設計
  - [x] ライフサイクルポリシー設定
- [ ] データウェアハウス構築
  @schedule: 2026-04-06T10:00/2026-04-17T18:00
  - [ ] Snowflake環境セットアップ
    @schedule: 2026-04-06T10:00/2026-04-07T18:00
  - [ ] データモデリング（Star Schema）
    @schedule: 2026-04-08T10:00/2026-04-10T18:00
    - [ ] ファクトテーブル設計（5テーブル）
    - [ ] ディメンションテーブル設計（8テーブル）
  - [ ] dbt設定
    @schedule: 2026-04-13T10:00/2026-04-17T18:00
    - [ ] dbtプロジェクト初期化
    - [ ] Bronzeモデル作成
    - [ ] Silverモデル作成
    - [ ] Goldモデル作成
    - [ ] テスト・ドキュメント作成

## 分析・可視化層

- [ ] BIツール設定
  @schedule: 2026-04-20T10:00/2026-04-28T18:00
  - [ ] Looker環境構築
    @schedule: 2026-04-20T10:00/2026-04-21T18:00
  - [ ] 標準ダッシュボード作成（10個）
    @schedule: 2026-04-22T10:00/2026-04-28T18:00
    - [ ] 売上分析ダッシュボード
    - [ ] ユーザー行動分析
    - [ ] 在庫・物流ダッシュボード
    - [ ] マーケティング効果測定
    - [ ] サポート品質ダッシュボード
- [-] MLパイプライン構築（フェーズ2に延期）
  - 需要予測モデル
  - 離脱予測モデル

## データガバナンス

- [ ] データ品質管理
  @schedule: 2026-05-01T10:00/2026-05-07T18:00
  - [ ] Great Expectationsによるバリデーション設定
  - [ ] データ品質ダッシュボード
  - [ ] アノマリー検知アラート設定
- [ ] データセキュリティ
  @schedule: 2026-05-08T10:00/2026-05-12T18:00
  - [ ] PII（個人情報）マスキング処理
  - [ ] アクセスログ監査設定
  - [ ] データ保持ポリシー実装
- メモ
  - GDPR・個人情報保護法への対応必須
  - データオーナーを各部門に設置する

# モバイルアプリ開発

> 対象プラットフォーム: iOS 16以上 / Android 11以上
> 技術スタック: React Native + Expo

## 基盤構築

- [x] 開発環境セットアップ
  @schedule: 2026-02-20T10:00/2026-02-21T18:00
- [x] デザインシステム移植（Webからの流用）
  @schedule: 2026-02-24T10:00/2026-02-28T18:00
  - [x] カラー・タイポグラフィ設定
  - [x] 共通コンポーネント移植
  - [x] アニメーション設定
- [x] 状態管理設計（Zustand）
  @schedule: 2026-03-03T10:00/2026-03-04T18:00
- [x] API通信層設計（React Query + Axios）
  @schedule: 2026-03-05T10:00/2026-03-06T18:00
- [x] ナビゲーション設計（React Navigation v7）
  @schedule: 2026-03-07T10:00/2026-03-08T18:00

## 機能実装

- [x] 認証機能
  @schedule: 2026-03-09T10:00/2026-03-14T18:00
  - [x] ログイン・ログアウト
  - [x] 生体認証（Face ID / 指紋）
  - [x] トークン管理（Secure Store）
- [ ] タスク管理機能
  @schedule: 2026-03-23T10:00/2026-04-03T18:00
  - [ ] タスク一覧画面
    @schedule: 2026-03-23T10:00/2026-03-25T18:00
    - [ ] 無限スクロール実装
    - [ ] スワイプ操作（完了・削除）
    - [ ] プルリフレッシュ
  - [ ] タスク詳細画面
    @schedule: 2026-03-26T10:00/2026-03-27T18:00
  - [ ] タスク作成・編集
    @schedule: 2026-03-28T10:00/2026-03-31T18:00
    - [ ] テキスト入力
    - [ ] 日付ピッカー
    - [ ] 優先度設定
    - [ ] タグ付け
  - [ ] オフライン対応
    @schedule: 2026-04-01T10:00/2026-04-03T18:00
    - [ ] ローカルキャッシュ（SQLite）
    - [ ] バックグラウンド同期
- [ ] 通知機能
  @schedule: 2026-04-06T10:00/2026-04-09T18:00
  - [ ] プッシュ通知受信（Expo Notifications）
    @schedule: 2026-04-06T10:00/2026-04-07T18:00
  - [ ] ローカル通知（リマインダー）
    @schedule: 2026-04-08T10:00/2026-04-08T18:00
  - [ ] 通知設定画面
    @schedule: 2026-04-09T10:00/2026-04-09T18:00
- [>] ウィジェット機能（iOS・Android）
  @schedule: 2026-04-20T10:00/2026-04-25T18:00
- [!] Expo SDK 53へのアップグレード（Breaking Change調査中）
  @schedule: 2026-04-10T10:00/2026-04-11T18:00

## テスト・リリース

- [ ] QAテスト
  @schedule: 2026-04-14T10:00/2026-04-18T18:00
  - [ ] iOSテスト（実機3機種）
  - [ ] Androidテスト（実機4機種）
  - [ ] アクセシビリティテスト
- [ ] ストア申請
  @schedule: 2026-04-21T10:00/2026-04-22T18:00
  - [ ] App Storeスクリーンショット作成
  - [ ] Google Playスクリーンショット作成
  - [ ] プライバシーポリシー更新
  - [ ] App Store申請
  - [ ] Google Play申請
- [ ] リリース後モニタリング
  @schedule: 2026-04-28T10:00/2026-05-02T18:00
  - [ ] クラッシュレート監視（Crashlytics）
  - [ ] レビュー収集・分析

# チーム運営・採用

> 方針
> - 技術力と人間力を兼ね備えたメンバーを採用する
> - 心理的安全性の高いチームを構築する

## 採用活動

- [x] 採用計画策定
  @schedule: 2026-01-10T10:00/2026-01-12T18:00
  - [x] 必要人数・スキルセット定義
  - [x] 採用予算確定
  - [x] 採用チャネル選定
- [x] 求人票作成
  @schedule: 2026-01-13T10:00/2026-01-16T18:00
  - [x] フロントエンドエンジニア
  - [x] バックエンドエンジニア
  - [x] データエンジニア

- フロントエンドエンジニア採用
  - [x] 書類選考（18名 → 8名通過）
    @schedule: 2026-02-01T10:00/2026-02-07T18:00
  - [x] 一次面接（8名 → 4名通過）
    @schedule: 2026-02-10T10:00/2026-02-14T18:00
  - [x] コーディングテスト（4名実施）
    @schedule: 2026-02-17T10:00/2026-02-21T18:00
  - [x] 最終面接（3名 → 2名通過）
    @schedule: 2026-02-24T10:00/2026-02-25T18:00
  - [x] オファー・内定承諾（2名）
    @schedule: 2026-02-28T10:00/2026-03-01T18:00
  - [ ] オンボーディング準備
    @schedule: 2026-03-25T10:00/2026-03-28T18:00
  - [ ] 入社（2名）
    @schedule: 2026-04-01T10:00/2026-04-01T10:00

- バックエンドエンジニア採用
  - [x] 書類選考（24名 → 10名通過）
    @schedule: 2026-02-01T10:00/2026-02-10T18:00
  - [>] 一次面接（進行中）
    @schedule: 2026-03-24T10:00/2026-03-28T18:00
  - [ ] コーディングテスト
    @schedule: 2026-03-31T10:00/2026-04-04T18:00
  - [ ] 最終面接
    @schedule: 2026-04-07T10:00/2026-04-10T18:00
  - [ ] オファー
    @schedule: 2026-04-13T10:00/2026-04-15T18:00

- データエンジニア採用
  - [-] 採用一時停止（予算見直し中）

## チーム育成

- [x] 技術勉強会の定期開催
  @schedule: 2026-01-07T17:00/2026-12-30T18:00
  - 毎週水曜 17:00〜18:00
  - テーマは持ち回り制
- [ ] メンタリング制度設計
  @schedule: 2026-03-24T10:00/2026-03-28T18:00
  - [ ] メンタリングガイドライン作成
  - [ ] ペアリング（シニア-ジュニア）
  - [ ] 月次1on1の仕組み化
- [ ] 技術評価制度改定
  @schedule: 2026-04-01T10:00/2026-04-10T18:00
  - [ ] スキルマトリクス更新
  - [ ] 等級定義の見直し
  - [ ] キャリアパス可視化
- [ ] エンジニア合宿
  @schedule: 2026-05-15T10:00/2026-05-16T18:00
  - [ ] 会場選定
  - [ ] プログラム設計
  - [ ] 懇親会企画

## 組織改善

- [x] 開発プロセス改善
  @schedule: 2026-02-01T10:00/2026-02-28T18:00
  - [x] スプリント長を2週間に変更
  - [x] デイリースタンドアップ時間短縮（15分→10分）
  - [x] レトロスペクティブ手法変更（KPT→Fun/Done/Learn）
- [ ] ドキュメント文化醸成
  @schedule: 2026-03-23T10:00/2026-04-30T18:00
  - [ ] ドキュメントテンプレート整備
    @schedule: 2026-03-23T10:00/2026-03-27T18:00
  - [ ] Notionワークスペース整理
    @schedule: 2026-03-28T10:00/2026-04-01T18:00
  - [ ] ナレッジシェア会（月1回）
    @schedule: 2026-04-15T14:00/2026-04-15T16:00
- [!] バーンアウトリスク者のフォロー（緊急対応中）
  @schedule: 2026-03-23T10:00/2026-03-31T18:00
  - [!] 当該メンバーとの1on1
    @schedule: 2026-03-23T14:00/2026-03-23T15:00
  - [ ] 業務量の再調整
    @schedule: 2026-03-24T10:00/2026-03-24T18:00
  - [ ] マネージャーへのエスカレーション
    @schedule: 2026-03-25T10:00/2026-03-25T12:00
`

  // Editor values — astValue is initialized from INITIAL_MD once (not reactive to mdValue)
  let mdValue: string = $state(INITIAL_MD)
  let astValue: string = $state(JSON.stringify(parseMarkdown(INITIAL_MD), null, 2))

  // Current parsed document — derived from mdValue for the CalendarTab
  let currentDoc: Document = $derived(parseMarkdown(mdValue))

  // Debounce timer refs
  let mdTimer: ReturnType<typeof setTimeout> | null = null
  let astTimer: ReturnType<typeof setTimeout> | null = null

  // Sync lock to prevent loops
  let syncing = false

  function onMdChange(value: string) {
    if (syncing) return
    if (mdTimer) clearTimeout(mdTimer)
    direction = 'md-to-ast'
    mdTimer = setTimeout(() => {
      syncing = true
      try {
        const doc = parseMarkdown(value)
        astValue = JSON.stringify(doc, null, 2)
      } finally {
        syncing = false
        direction = 'idle'
      }
    }, 300)
  }

  function onAstChange(value: string) {
    if (syncing) return
    if (astTimer) clearTimeout(astTimer)
    direction = 'ast-to-md'
    astTimer = setTimeout(() => {
      syncing = true
      try {
        const doc: Document = JSON.parse(value)
        mdValue = serializeAst(doc)
      } catch {
        // Invalid JSON — skip update
      } finally {
        syncing = false
        direction = 'idle'
      }
    }, 500)
  }

  // Calendar → Markdown update (#0017, #0018)
  function onCalendarMdChange(newMd: string) {
    if (syncing) return
    syncing = true
    direction = 'ast-to-md'
    try {
      mdValue = newMd
      astValue = JSON.stringify(parseMarkdown(newMd), null, 2)
    } finally {
      syncing = false
      setTimeout(() => { direction = 'idle' }, 500)
    }
  }
</script>

<div class="layout">
  <!-- Left: Markdown editor -->
  <div class="pane">
    <div class="pane-header">Markdown</div>
    <div class="pane-body">
      <MonacoEditor
        bind:value={mdValue}
        language="md-task"
        onchange={onMdChange}
      />
    </div>
  </div>

  <!-- Center: Direction arrow -->
  <div class="gutter">
    {#if direction === 'md-to-ast'}
      <div class="arrow arrow-right">→</div>
    {:else if direction === 'ast-to-md'}
      <div class="arrow arrow-left">←</div>
    {:else}
      <div class="arrow arrow-idle">⇆</div>
    {/if}
  </div>

  <!-- Right: AST / Calendar tab panel (#0013) -->
  <div class="pane">
    <!-- Tab header -->
    <div class="pane-header tab-header">
      <button
        class="tab-btn {rightTab === 'ast' ? 'active' : ''}"
        onclick={() => rightTab = 'ast'}
      >AST</button>
      <button
        class="tab-btn {rightTab === 'calendar' ? 'active' : ''}"
        onclick={() => rightTab = 'calendar'}
      >Calendar</button>
      <button
        class="tab-btn {rightTab === 'gantt' ? 'active' : ''}"
        onclick={() => rightTab = 'gantt'}
      >Gantt</button>
    </div>

    <!-- Tab content -->
    <div class="pane-body">
      {#if rightTab === 'ast'}
        <MonacoEditor
          bind:value={astValue}
          language="json"
          onchange={onAstChange}
        />
      {:else if rightTab === 'calendar'}
        <CalendarTab
          mdValue={mdValue}
          doc={currentDoc}
          onMdChange={onCalendarMdChange}
        />
      {:else}
        <GanttTab
          mdValue={mdValue}
          doc={currentDoc}
          onMdChange={onCalendarMdChange}
        />
      {/if}
    </div>
  </div>
</div>

<style>
  .layout {
    display: flex;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }

  .pane-header {
    height: 32px;
    line-height: 32px;
    padding: 0 12px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    background: #252526;
    color: #858585;
    border-bottom: 1px solid #333;
    flex-shrink: 0;
  }

  .tab-header {
    display: flex;
    align-items: center;
    padding: 0 4px;
    gap: 2px;
  }

  .tab-btn {
    height: 24px;
    padding: 0 12px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    background: transparent;
    color: #858585;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
    line-height: 24px;
  }

  .tab-btn:hover {
    color: #cccccc;
  }

  .tab-btn.active {
    color: #4ec9b0;
    border-bottom-color: #4ec9b0;
  }

  .pane-body {
    flex: 1;
    overflow: hidden;
  }

  .gutter {
    width: 40px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1e1e1e;
    border-left: 1px solid #333;
    border-right: 1px solid #333;
  }

  .arrow {
    font-size: 18px;
    font-weight: bold;
    transition: color 0.15s, transform 0.15s;
    user-select: none;
  }

  .arrow-right {
    color: #4ec9b0;
    transform: scale(1.2);
  }

  .arrow-left {
    color: #ce9178;
    transform: scale(1.2);
  }

  .arrow-idle {
    color: #555;
  }
</style>

# 日付入力ピッカーの時刻を、入力時点で設定の分刻み（既定15分）に揃える

## 背景
- リポジトリ: `markdownEditor-for-mywork`。
- 要望原文:
  > 日付入力支援の入力単位を15分で固定にして。この単位は拡張機能の設定画面で変えられるようにして。
  > 　@rv: 実装されていない。
- 前回（issue-phase016-markdownEditor-001）で、設定 `minuteStep`（既定15、選択肢 1/5/10/15/30）、設定タブのドロップダウン、ピッカーへの適用はソース上実装済み。
- それでも「実装されていない」とされた原因として、次の2点が考えられる。
  1. 現在のピッカーは、時刻欄に `step` 属性を付け、「決定」時に切り上げるだけ。入力欄では 07 分などの任意の分を入力・表示できるため、「15分固定」に見えない。
  2. 配布先の Obsidian プラグインフォルダに最新ビルドが反映されていない可能性（未確認）。
- 採用した解釈: 「15分で固定」= 入力欄に表示される時刻が常に刻みの倍数になること。上記1を解消し、2も確認手順に含める。

## 目的
ピッカーで時刻を入力・変更した時点で、時刻が設定の刻み（既定15分）に揃い、設定画面で刻みを変更できることが実機で確認できる。

## 現状
- `src/settings.ts`: 10-20行 `migrateSettings`、37行 `minuteStep: MinuteStep`、55行 既定 `15`、96-111行 設定タブ「日付ピッカーの分刻み」。
- `src/plugin.ts` 200行付近: `createMetatagPickerExtension(() => this.settings.minuteStep)`。
- `src/editor/metatag-picker.ts`: 118行 now ボタンは `nowRounded`、164-170行 時刻欄に `step` 属性、195-215行 「決定」時のみ `roundUpToStep`（`src/lib/format/metatag-format.ts` 124行）。
- リポジトリの `data.json` には `minuteStep` が保存されていない。
- `package.json` の `obs:update:manifest` で、`main.js`/`manifest.json`/`styles.css` を Obsidian の vault のプラグインフォルダへコピーする。

## 実装内容
1. `src/editor/metatag-picker.ts`: 開始・終了の時刻欄に `change` ハンドラを追加する。値が刻みの倍数でなければ `roundUpToStep`（決定時と同じ切り上げ規則）で丸めた値を入力欄に反映する。日付が繰り上がる場合（23:50 → 翌日 00:00）は日付欄も更新する。`minuteStep === 1` のときは何もしない。
2. ピッカーを開いたときの初期時刻（既存値から読み込む値）は丸めない（既存データを勝手に変えないため）。
3. `npm run build` → `npm run obs:update:manifest` で配布し、Obsidian 上で次を確認する。
   - 設定タブに「日付ピッカーの分刻み」があり、既定が15分。
   - 変更後、Obsidian を再起動しても値が保持される（`data.json` に `minuteStep` が書かれる）。

変更ファイル: `src/editor/metatag-picker.ts`, 関連テスト

## 完了条件
- 刻み15分の設定で、時刻欄に 10:07 を入力すると、欄の表示が 10:15 になる。
- 刻みを30分に変えると、同じ操作で 10:30 になる。「丸めなし」では 10:07 のまま。
- 23:50 を入力すると、時刻 00:00 と翌日の日付になる。
- 既存値を読み込んだ直後の表示は変わらない。
- 配布先の Obsidian で、設定項目の存在・既定15分・再起動後の保持を確認済み。

## テスト
- `metatag-picker` のテスト（無ければ新規）: 時刻欄 `change` 後の値（15/30/1分刻み、日付繰り上がり）。
- 既存の `roundUpToStep`・`migrateSettings` のテストが green。
- 手動: 上記の Obsidian 実機確認。

## 依存関係
なし

## 対象外
- 刻みの選択肢の変更。
- 時刻入力 UI の作り替え（ネイティブ入力のまま）。

## 要確認
- 「実装されていない」の指摘が、上記以外の箇所（例: 別の入力支援機能）を指す場合は再指示が必要。

## History

### 2026-10-03

- User Instruction:
  - phase017 の issue を順に実装

- Change:
  - 実装済み（単体テスト・ビルド green）。Obsidian 実機確認とクローズ承認は未実施のため Open のまま。

- Rationale:
  - WORKFLOW §6: ユーザー承認なしに closure しない。

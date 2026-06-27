# Issue 0036: カーソル移動時のスクロールオフセット設定

## 状態
Closed

## 概要
カンバン等の外部ビューからカードクリックでカーソル移動する際、対象行を画面上部からN行目に表示するように制御する。
Nの値は設定画面で変更できなければならない。

## 要件

- `MdAstEditorSettings`は`scrollOffsetLines: number`フィールドを持たなければならない。
- `scrollOffsetLines`の既定値は`4`でなければならない。
- `scrollOffsetLines`が`0`の場合は自動スクロール（既存挙動）のままでなければならない。
- カーソル移動後、CodeMirror 6の`cm.scrollDOM.scrollTop`を`(targetLine.top - (scrollOffsetLines - 1) * lineHeight)`に設定しなければならない。
- CM6 API取得失敗時は`try/catch`でフォールバックしなければならない。
- 設定画面に「スクロールオフセット行数」の数値入力を追加しなければならない。

## 対象ファイル
- `src/settings.ts`
- `src/plugin.ts`

## History

### 2026-06-27 20:00

- User Instruction:
  - 外部ライブラリからカーソル移動の際に上部からn行目に表示（既定値4行）。設定で変更可能にする。

- Change:
  - `scrollOffsetLines`フィールドをsettingsに追加
  - `onFocusLine`ハンドラにrequestAnimationFrameベースのスクロールオフセット処理を追加
  - 設定UIにスクロールオフセット行数の数値入力を追加

- Rationale:
  - カンバンカードクリック時に対象行が画面の上端に張り付いてしまい視認性が悪いため

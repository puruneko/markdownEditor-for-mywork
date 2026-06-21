export type FocusLineHandler = (lineNumber: number) => void

/**
 * ビュー（カレンダー/ガント）からエディタへのカーソル移動要求を仲介するイベントバス。
 *
 * - 送信側: `requestFocusLine(lineNumber)` を呼ぶ
 * - 受信側: `onFocusLine(handler)` でリスナーを登録し、返却された解除関数で登録解除する
 */
export class EditorEventBus {
  private handlers: Set<FocusLineHandler> = new Set()

  requestFocusLine(lineNumber: number): void {
    this.handlers.forEach(h => h(lineNumber))
  }

  onFocusLine(handler: FocusLineHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }
}

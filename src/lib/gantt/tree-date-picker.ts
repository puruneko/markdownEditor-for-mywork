/**
 * issue-phase018-markdownEditor-for-mywork-002: Gantt ツリー日時セル用の浮動ピッカー。
 * Shadow DOM の外（document.body）に置き、Obsidian の CSS 変数とピッカーのスタイルを効かせる。
 */
import { buildMetaDatePicker } from '../../editor/metatag-picker'

export interface TreeDatePickerRequest {
  initialValue: string
  minuteStep: number
  anchorEl: HTMLElement
  onCommit: (value: string) => void
  done: () => void
}

/** ピッカーを開き、閉じる関数を返す。確定・外側クリック（保存して閉じる、issue-phase020-002）・Escape（破棄）・戻り値の関数のどれでも閉じる。 */
export function openTreeDatePicker(req: TreeDatePickerRequest): () => void {
  let closed = false
  const picker = buildMetaDatePicker({
    initialValue: req.initialValue,
    initialTentative: false,
    showTentative: false,
    minuteStep: req.minuteStep,
    onCommit: (value) => {
      req.onCommit(value)
      close()
    },
    onClose: () => close(),
  })
  function close() {
    if (closed) return
    closed = true
    picker.destroy()
    picker.dom.remove()
    req.done()
  }
  picker.dom.classList.add('metatag-picker-popup--floating')
  document.body.appendChild(picker.dom)
  const rect = req.anchorEl.getBoundingClientRect()
  const w = picker.dom.offsetWidth
  const h = picker.dom.offsetHeight
  const left = Math.max(0, Math.min(rect.left, window.innerWidth - w))
  const below = rect.bottom + 2
  const top = below + h > window.innerHeight ? Math.max(0, rect.top - h - 2) : below
  picker.dom.style.left = `${left}px`
  picker.dom.style.top = `${top}px`
  picker.mount()
  return close
}

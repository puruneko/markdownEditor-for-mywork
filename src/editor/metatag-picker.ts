/**
 * issue-phase003-008（2026-09-17増分）: @plan/@schedule/@due 用の非モーダル日付・時刻ピッカー。
 *
 * CodeMirror 6 の showTooltip を使い、エディタ内の指定位置に追従するフローティングDOMとして
 * 表示する（Obsidian の Modal は使わない＝背面をブロックしない）。UI はバニラDOMで構築する
 * （Svelteのマウント/アンマウントのライフサイクルをtooltipのライフサイクルへ橋渡しする複雑さを
 * 避けるための実装判断。詳細は project/issues/issue-phase003-008 の「2026-09-17 増分」参照）。
 */
import { StateEffect, StateField, EditorSelection } from '@codemirror/state'
import type { Extension } from '@codemirror/state'
import { showTooltip, tooltips } from '@codemirror/view'
import type { EditorView, Tooltip, TooltipView } from '@codemirror/view'
import {
  META_DATE_KEY_LABEL,
  buildMetaDateValue,
  parseMetaDateValue,
  type DateMetaKey,
} from '../lib/format/metatag-format'

export type MetaPickerMode = 'insert' | 'edit'

export interface MetaPickerTarget {
  /** 書き戻し時の置換開始位置。insert: カーソル位置。edit: キー名直後（`?`/コロンの前）。 */
  from: number
  /** 書き戻し時の置換終了位置（行末）。 */
  to: number
  /** 対象行の先頭位置。コミット後にカーソルをここへ逃がしてチップ表示へ即座に戻すために使う。 */
  lineFrom: number
  key: DateMetaKey
  initialValue: string
  initialTentative: boolean
  /** insert: 新規挿入（`?` は変更不可）。edit: 既存値の再編集（`?` トグルを表示）。 */
  mode: MetaPickerMode
}

export const openMetaPicker = StateEffect.define<MetaPickerTarget | null>()

export const metaPickerField = StateField.define<MetaPickerTarget | null>({
  create() {
    return null
  },
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(openMetaPicker)) value = e.value
    }
    return value
  },
  provide: (f) =>
    showTooltip.computeN([f], (state) => {
      const target = state.field(f)
      if (!target) return []
      const tooltip: Tooltip = {
        pos: target.from,
        above: false,
        strictSide: false,
        arrow: true,
        create: (view) => buildPickerTooltipView(view, target),
      }
      return [tooltip]
    }),
})

/**
 * tooltips() は showTooltip の描画先（ホスト）を提供する拡張。Obsidian本体が既に
 * 含んでいる可能性があるが、含んでいない場合にピッカーが無言で表示されなくなることを
 * 避けるため、明示的に含める（CodeMirror公式ドキュメント推奨）。
 */
export const metatagPickerExtension: Extension = [tooltips(), metaPickerField]

function buildPickerTooltipView(view: EditorView, target: MetaPickerTarget): TooltipView {
  const parsed = parseMetaDateValue(target.initialValue)

  const dom = document.createElement('div')
  dom.className = 'metatag-picker-popup'

  const title = document.createElement('div')
  title.className = 'metatag-picker-title'
  title.textContent = `${META_DATE_KEY_LABEL[target.key]}を設定`
  dom.appendChild(title)

  const startRow = document.createElement('div')
  startRow.className = 'metatag-picker-row'
  const startDateInput = document.createElement('input')
  startDateInput.type = 'date'
  startDateInput.className = 'metatag-picker-date'
  startDateInput.value = parsed.startDate
  const startTimeInput = document.createElement('input')
  startTimeInput.type = 'time'
  startTimeInput.className = 'metatag-picker-time'
  startTimeInput.value = parsed.startTime ?? ''
  startRow.append(startDateInput, startTimeInput)
  dom.appendChild(startRow)

  const rangeToggleRow = document.createElement('label')
  rangeToggleRow.className = 'metatag-picker-checkbox-row'
  const rangeToggle = document.createElement('input')
  rangeToggle.type = 'checkbox'
  rangeToggle.checked = parsed.isRange
  rangeToggleRow.append(rangeToggle, document.createTextNode('期間で指定'))
  dom.appendChild(rangeToggleRow)

  const endRow = document.createElement('div')
  endRow.className = 'metatag-picker-row'
  const endDateInput = document.createElement('input')
  endDateInput.type = 'date'
  endDateInput.className = 'metatag-picker-date'
  endDateInput.value = parsed.endDate ?? parsed.startDate
  const endTimeInput = document.createElement('input')
  endTimeInput.type = 'time'
  endTimeInput.className = 'metatag-picker-time'
  endTimeInput.value = parsed.endTime ?? ''
  endRow.append(endDateInput, endTimeInput)
  endRow.hidden = !parsed.isRange
  dom.appendChild(endRow)

  rangeToggle.addEventListener('change', () => {
    endRow.hidden = !rangeToggle.checked
  })

  let tentativeCheckbox: HTMLInputElement | null = null
  if (target.mode === 'edit') {
    const tentativeRow = document.createElement('label')
    tentativeRow.className = 'metatag-picker-checkbox-row'
    tentativeCheckbox = document.createElement('input')
    tentativeCheckbox.type = 'checkbox'
    tentativeCheckbox.checked = target.initialTentative
    tentativeRow.append(tentativeCheckbox, document.createTextNode('仮置き（?）'))
    dom.appendChild(tentativeRow)
  }

  const buttonRow = document.createElement('div')
  buttonRow.className = 'metatag-picker-button-row'
  const cancelBtn = document.createElement('button')
  cancelBtn.type = 'button'
  cancelBtn.className = 'metatag-picker-btn metatag-picker-btn-cancel'
  cancelBtn.textContent = '閉じる'
  const commitBtn = document.createElement('button')
  commitBtn.type = 'button'
  commitBtn.className = 'metatag-picker-btn metatag-picker-btn-commit'
  commitBtn.textContent = '設定'
  buttonRow.append(cancelBtn, commitBtn)
  dom.appendChild(buttonRow)

  const close = () => {
    view.dispatch({ effects: openMetaPicker.of(null) })
  }

  cancelBtn.addEventListener('mousedown', (e) => {
    e.preventDefault()
    close()
  })

  commitBtn.addEventListener('mousedown', (e) => {
    e.preventDefault()
    if (!startDateInput.value) return
    const isRange = rangeToggle.checked
    const value = buildMetaDateValue({
      startDate: startDateInput.value,
      startTime: startTimeInput.value || null,
      isRange,
      endDate: isRange ? endDateInput.value || startDateInput.value : null,
      endTime: isRange ? endTimeInput.value || null : null,
    })

    if (target.mode === 'insert') {
      view.dispatch({
        changes: { from: target.from, to: target.to, insert: ` ${value}` },
        effects: openMetaPicker.of(null),
      })
    } else {
      const tentative = tentativeCheckbox?.checked ?? target.initialTentative
      view.dispatch({
        changes: { from: target.from, to: target.to, insert: `${tentative ? '?' : ''}: ${value}` },
        // 書き戻し直後にカーソルを行頭へ逃がし、チップ表示へ即座に戻す。
        selection: EditorSelection.cursor(target.lineFrom),
        effects: openMetaPicker.of(null),
      })
    }
  })

  let outsideMouseDown: ((e: MouseEvent) => void) | null = null
  let keyDown: ((e: KeyboardEvent) => void) | null = null

  return {
    dom,
    mount() {
      // 起動をトリガーしたクリック自体で即座に閉じてしまわないよう、リスナー登録を1tick遅らせる。
      setTimeout(() => {
        outsideMouseDown = (e: MouseEvent) => {
          if (!dom.contains(e.target as Node)) close()
        }
        keyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            close()
          }
        }
        document.addEventListener('mousedown', outsideMouseDown, true)
        document.addEventListener('keydown', keyDown, true)
      }, 0)
    },
    destroy() {
      if (outsideMouseDown) document.removeEventListener('mousedown', outsideMouseDown, true)
      if (keyDown) document.removeEventListener('keydown', keyDown, true)
    },
  }
}

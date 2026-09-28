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
  buildMetaDateValue,
  parseMetaDateValue,
  roundUpTo5Min,
  nowRounded,
  nowExact,
  type DateMetaKey,
} from '../lib/format/metatag-format'

export type MetaPickerMode = 'insert' | 'edit'

export interface MetaPickerTarget {
  /** 書き戻し時の置換開始位置。insert/edit共通でキー名直後（`?`/コロンの前）。 */
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

/**
 * issue-phase014-markdownEditor-003: 「5分単位」はピッカー内のチェックボックスを廃止し、
 * プラグイン設定（`MdAstEditorSettings.roundMinuteStep`）へ移行した。CM6拡張はプラグイン
 * 設定を直接参照できないため、`createTaskDragSourceExtension`（`task-drag-source.ts`）と
 * 同じ「コールバックで都度読み出す」パターンで設定値を受け渡す。
 */
export function createMetatagPickerExtension(getRoundMinuteStep: () => boolean): Extension {
  const metaPickerField = StateField.define<MetaPickerTarget | null>({
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
          create: (view) => buildPickerTooltipView(view, target, getRoundMinuteStep()),
        }
        return [tooltip]
      }),
  })
  // tooltips() は showTooltip の描画先（ホスト）を提供する拡張。Obsidian本体が既に
  // 含んでいる可能性があるが、含んでいない場合にピッカーが無言で表示されなくなることを
  // 避けるため、明示的に含める（CodeMirror公式ドキュメント推奨）。
  return [tooltips(), metaPickerField]
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatDateLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** [日付入力][時刻入力][todayボタン][nowボタン] の1行を組み立てる。 */
function buildDateTimeRow(
  initialDate: string,
  initialTime: string,
  roundMinuteStep: boolean,
): { row: HTMLDivElement; dateInput: HTMLInputElement; timeInput: HTMLInputElement } {
  const row = document.createElement('div')
  row.className = 'metatag-picker-row'

  const dateInput = document.createElement('input')
  dateInput.type = 'date'
  dateInput.className = 'metatag-picker-date'
  dateInput.value = initialDate

  const timeInput = document.createElement('input')
  timeInput.type = 'time'
  timeInput.className = 'metatag-picker-time'
  timeInput.value = initialTime

  const todayBtn = document.createElement('button')
  todayBtn.type = 'button'
  todayBtn.className = 'metatag-picker-btn metatag-picker-btn-today'
  todayBtn.textContent = 'today'
  todayBtn.addEventListener('mousedown', (e) => {
    e.preventDefault()
    dateInput.value = formatDateLocal(new Date())
  })

  const nowBtn = document.createElement('button')
  nowBtn.type = 'button'
  nowBtn.className = 'metatag-picker-btn metatag-picker-btn-now'
  nowBtn.textContent = 'now'
  nowBtn.addEventListener('mousedown', (e) => {
    e.preventDefault()
    const now = roundMinuteStep ? nowRounded(new Date()) : nowExact(new Date())
    dateInput.value = now.date
    timeInput.value = now.time
  })

  row.append(dateInput, timeInput, todayBtn, nowBtn)
  return { row, dateInput, timeInput }
}

function buildPickerTooltipView(view: EditorView, target: MetaPickerTarget, roundMinuteStep: boolean): TooltipView {
  const parsed = parseMetaDateValue(target.initialValue)

  const dom = document.createElement('div')
  dom.className = 'metatag-picker-popup'

  const { row: startRow, dateInput: startDateInput, timeInput: startTimeInput } = buildDateTimeRow(
    parsed.startDate,
    parsed.startTime ?? '',
    roundMinuteStep,
  )
  dom.appendChild(startRow)

  const rangeToggleRow = document.createElement('label')
  rangeToggleRow.className = 'metatag-picker-checkbox-row'
  const rangeToggle = document.createElement('input')
  rangeToggle.type = 'checkbox'
  rangeToggle.className = 'metatag-picker-range'
  rangeToggle.checked = parsed.isRange
  rangeToggleRow.append(rangeToggle, document.createTextNode('期間で指定'))
  dom.appendChild(rangeToggleRow)

  const { row: endRow, dateInput: endDateInput, timeInput: endTimeInput } = buildDateTimeRow(
    parsed.endDate ?? parsed.startDate,
    parsed.endTime ?? '',
    roundMinuteStep,
  )
  endRow.hidden = !parsed.isRange
  dom.appendChild(endRow)

  rangeToggle.addEventListener('change', () => {
    endRow.hidden = !rangeToggle.checked
  })

  const bottomRow = document.createElement('div')
  bottomRow.className = 'metatag-picker-button-row'

  if (roundMinuteStep) {
    startTimeInput.step = '300'
    endTimeInput.step = '300'
  } else {
    startTimeInput.removeAttribute('step')
    endTimeInput.removeAttribute('step')
  }

  const tentativeRow = document.createElement('label')
  tentativeRow.className = 'metatag-picker-checkbox-row'
  const tentativeCheckbox = document.createElement('input')
  tentativeCheckbox.type = 'checkbox'
  tentativeCheckbox.className = 'metatag-picker-tentative'
  tentativeCheckbox.checked = target.initialTentative
  tentativeRow.append(tentativeCheckbox, document.createTextNode('仮置き（?）'))
  bottomRow.appendChild(tentativeRow)

  const commitBtn = document.createElement('button')
  commitBtn.type = 'button'
  commitBtn.className = 'metatag-picker-btn metatag-picker-btn-commit'
  commitBtn.textContent = '決定'
  bottomRow.appendChild(commitBtn)

  dom.appendChild(bottomRow)

  const close = () => {
    view.dispatch({ effects: openMetaPicker.of(null) })
  }

  commitBtn.addEventListener('mousedown', (e) => {
    e.preventDefault()
    if (!startDateInput.value) return
    const isRange = rangeToggle.checked
    const roundMinutes = roundMinuteStep

    let startDate = startDateInput.value
    let startTime = startTimeInput.value || null
    if (roundMinutes && startTime) {
      const rounded = roundUpTo5Min(startDate, startTime)
      startDate = rounded.date
      startTime = rounded.time
    }

    let endDate = isRange ? endDateInput.value || startDateInput.value : null
    let endTime = isRange ? endTimeInput.value || null : null
    if (roundMinutes && endDate && endTime) {
      const rounded = roundUpTo5Min(endDate, endTime)
      endDate = rounded.date
      endTime = rounded.time
    }

    const value = buildMetaDateValue({ startDate, startTime, isRange, endDate, endTime })
    const tentative = tentativeCheckbox.checked

    view.dispatch({
      changes: { from: target.from, to: target.to, insert: `${tentative ? '?' : ''}: ${value}` },
      // 書き戻し直後にカーソルを行頭へ逃がし、チップ表示へ即座に戻す。
      selection: EditorSelection.cursor(target.lineFrom),
      effects: openMetaPicker.of(null),
    })
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

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
import { buildRepeatPicker } from './repeat-picker'
import {
  buildMetaDateValue,
  parseMetaDateValue,
  roundUpToStep,
  nowRounded,
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
  key: DateMetaKey | 'repeat'
  initialValue: string
  initialTentative: boolean
  /** insert: 新規挿入（`?` は変更不可）。edit: 既存値の再編集（`?` トグルを表示）。 */
  mode: MetaPickerMode
}

export const openMetaPicker = StateEffect.define<MetaPickerTarget | null>()

/**
 * issue-phase014-markdownEditor-003: 「分刻み」はピッカー内のチェックボックスを廃止し、
 * プラグイン設定（`MdAstEditorSettings.minuteStep`）へ移行した。CM6拡張はプラグイン
 * 設定を直接参照できないため、`createTaskDragSourceExtension`（`task-drag-source.ts`）と
 * 同じ「コールバックで都度読み出す」パターンで設定値を受け渡す。
 */
export function createMetatagPickerExtension(getMinuteStep: () => number): Extension {
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
          create: (view) => buildPickerTooltipView(view, target, getMinuteStep()),
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

/** 分の選択肢（00 から step 刻みで 60 未満）。 */
export function minuteOptions(step: number): string[] {
  const out: string[] = []
  for (let m = 0; m < 60; m += step) out.push(pad2(m))
  return out
}

export interface TimeSelect {
  wrap: HTMLElement
  getTime(): string
  setTime(time: string): void
}

function attachWheel(sel: HTMLSelectElement): void {
  sel.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      if (sel.disabled) return
      const next = sel.selectedIndex + (e.deltaY > 0 ? 1 : -1)
      if (next < 0 || next >= sel.options.length) return
      sel.selectedIndex = next
      sel.dispatchEvent(new Event('change'))
    },
    { passive: false },
  )
}

/** 時・分の2つの選択欄。時が空（--）なら時刻なし。分は刻みの倍数だけを表示する。 */
function buildTimeSelect(initialTime: string, minuteStep: number): TimeSelect {
  const wrap = document.createElement('span')
  wrap.className = 'metatag-picker-time'
  const hour = document.createElement('select')
  hour.className = 'metatag-picker-hour'
  const minute = document.createElement('select')
  minute.className = 'metatag-picker-minute'
  const addOpt = (sel: HTMLSelectElement, v: string, label = v) => {
    const o = document.createElement('option')
    o.value = v
    o.textContent = label
    sel.appendChild(o)
  }
  addOpt(hour, '', '--')
  for (let h = 0; h < 24; h++) addOpt(hour, pad2(h))
  for (const m of minuteOptions(minuteStep)) addOpt(minute, m)
  const sep = document.createElement('span')
  sep.textContent = ':'
  const sync = () => {
    minute.disabled = hour.value === ''
  }
  hour.addEventListener('change', sync)
  attachWheel(hour)
  attachWheel(minute)
  const setTime = (time: string) => {
    const m = /^(\d{2}):(\d{2})$/.exec(time)
    if (!m) {
      hour.value = ''
      minute.value = minute.options[0].value
    } else {
      hour.value = m[1]
      minute.value = m[2]
      if (minute.value !== m[2]) minute.value = minute.options[0].value
    }
    sync()
  }
  setTime(initialTime)
  wrap.append(hour, sep, minute)
  return {
    wrap,
    getTime: () => (hour.value === '' ? '' : `${hour.value}:${minute.value}`),
    setTime,
  }
}

/** [日付入力][時刻選択][todayボタン][nowボタン] の1行を組み立てる。 */
function buildDateTimeRow(
  initialDate: string,
  initialTime: string,
  minuteStep: number,
): { row: HTMLDivElement; dateInput: HTMLInputElement; time: TimeSelect } {
  const row = document.createElement('div')
  row.className = 'metatag-picker-row'

  const dateInput = document.createElement('input')
  dateInput.type = 'date'
  dateInput.className = 'metatag-picker-date'
  dateInput.value = initialDate

  // 既存値の分が刻みの倍数でない場合は切り上げて初期表示する（日付の繰り上がりも反映）。
  if (initialDate && initialTime) {
    const r = roundUpToStep(initialDate, initialTime, minuteStep)
    initialDate = r.date
    initialTime = r.time
    dateInput.value = initialDate
  }
  const time = buildTimeSelect(initialTime, minuteStep)

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
    const now = nowRounded(new Date(), minuteStep)
    dateInput.value = now.date
    time.setTime(now.time)
  })

  row.append(dateInput, time.wrap, todayBtn, nowBtn)
  return { row, dateInput, time }
}

export interface MetaDatePickerOptions {
  initialValue: string
  initialTentative: boolean
  showTentative: boolean
  minuteStep: number
  onCommit: (value: string, tentative: boolean) => void
  onClose: () => void
}

/** CM6 に依存しないピッカー DOM。エディタの tooltip と Gantt ツリーの浮動表示の両方で使う。 */
export function buildMetaDatePicker(opts: MetaDatePickerOptions): { dom: HTMLElement; mount(): void; destroy(): void } {
  const { minuteStep } = opts
  const parsed = parseMetaDateValue(opts.initialValue)

  const dom = document.createElement('div')
  dom.className = 'metatag-picker-popup'

  const { row: startRow, dateInput: startDateInput, time: startTime } = buildDateTimeRow(
    parsed.startDate,
    parsed.startTime ?? '',
    minuteStep,
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

  const { row: endRow, dateInput: endDateInput, time: endTime } = buildDateTimeRow(
    parsed.endDate ?? parsed.startDate,
    parsed.endTime ?? '',
    minuteStep,
  )
  endRow.hidden = !parsed.isRange
  dom.appendChild(endRow)

  rangeToggle.addEventListener('change', () => {
    endRow.hidden = !rangeToggle.checked
  })

  const bottomRow = document.createElement('div')
  bottomRow.className = 'metatag-picker-button-row'

  const tentativeCheckbox = document.createElement('input')
  tentativeCheckbox.type = 'checkbox'
  tentativeCheckbox.className = 'metatag-picker-tentative'
  tentativeCheckbox.checked = opts.initialTentative
  if (opts.showTentative) {
    const tentativeRow = document.createElement('label')
    tentativeRow.className = 'metatag-picker-checkbox-row'
    tentativeRow.append(tentativeCheckbox, document.createTextNode('仮置き（?）'))
    bottomRow.appendChild(tentativeRow)
  }

  const commitBtn = document.createElement('button')
  commitBtn.type = 'button'
  commitBtn.className = 'metatag-picker-btn metatag-picker-btn-commit'
  commitBtn.textContent = '決定'
  bottomRow.appendChild(commitBtn)

  dom.appendChild(bottomRow)

  /** 決定ボタンと外側クリックで共通の保存処理。保存できたら true。 */
  const commitCurrent = (): boolean => {
    if (!startDateInput.value) return false
    const isRange = rangeToggle.checked
    const value = buildMetaDateValue({
      startDate: startDateInput.value,
      startTime: startTime.getTime() || null,
      isRange,
      endDate: isRange ? endDateInput.value || startDateInput.value : null,
      endTime: isRange ? endTime.getTime() || null : null,
    })
    opts.onCommit(value, tentativeCheckbox.checked)
    return true
  }
  commitBtn.addEventListener('mousedown', (e) => {
    e.preventDefault()
    commitCurrent()
  })

  let outsideMouseDown: ((e: MouseEvent) => void) | null = null
  let keyDown: ((e: KeyboardEvent) => void) | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let done = false

  return {
    dom,
    mount() {
      // 起動をトリガーしたクリック自体で即座に閉じてしまわないよう、リスナー登録を1tick遅らせる。
      timer = setTimeout(() => {
        outsideMouseDown = (e: MouseEvent) => {
          if (dom.contains(e.target as Node)) return
          // issue-phase020-002: 外側クリックは保存して閉じる（保存不可なら破棄して閉じる）。Esc は破棄。
          if (done) return
          done = true
          if (!commitCurrent()) opts.onClose()
        }
        keyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            if (done) return
            done = true
            opts.onClose()
          }
        }
        document.addEventListener('mousedown', outsideMouseDown, true)
        document.addEventListener('keydown', keyDown, true)
      }, 0)
    },
    destroy() {
      if (timer) clearTimeout(timer)
      if (outsideMouseDown) document.removeEventListener('mousedown', outsideMouseDown, true)
      if (keyDown) document.removeEventListener('keydown', keyDown, true)
    },
  }
}

function buildPickerTooltipView(view: EditorView, target: MetaPickerTarget, minuteStep: number): TooltipView {
  if (target.key === 'repeat') {
    // issue-phase020-004: @repeat は繰り返し設定ピッカー（仮置き `?` は持たない）。
    return buildRepeatPicker({
      initialValue: target.initialValue,
      onCommit: (value) => {
        view.dispatch({
          changes: { from: target.from, to: target.to, insert: `: ${value}` },
          selection: EditorSelection.cursor(target.lineFrom),
          effects: openMetaPicker.of(null),
        })
      },
      onClose: () => view.dispatch({ effects: openMetaPicker.of(null) }),
    })
  }
  return buildMetaDatePicker({
    initialValue: target.initialValue,
    initialTentative: target.initialTentative,
    showTentative: true,
    minuteStep,
    onCommit: (value, tentative) => {
      view.dispatch({
        changes: { from: target.from, to: target.to, insert: `${tentative ? '?' : ''}: ${value}` },
        // 書き戻し直後にカーソルを行頭へ逃がし、チップ表示へ即座に戻す。
        selection: EditorSelection.cursor(target.lineFrom),
        effects: openMetaPicker.of(null),
      })
    },
    onClose: () => view.dispatch({ effects: openMetaPicker.of(null) }),
  })
}

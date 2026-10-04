/**
 * issue-phase020-markdownEditor-for-mywork-004: @repeat 用の入力支援ピッカー（CM6 非依存の DOM）。
 * 外側クリックで保存、Esc で破棄（issue-phase020-002 と同じ挙動）。
 */
import {
  WEEKDAYS, buildRepeat, defaultRepeatForm, describeRepeat, parseRepeat,
  type RepeatForm, type RepeatFreq, type Weekday,
} from '../lib/format/repeat-format'

export interface RepeatPickerOptions {
  initialValue: string
  onCommit: (value: string) => void
  onClose: () => void
}

const WD_JA = ['月', '火', '水', '木', '金', '土', '日']
const UNIT: Record<RepeatFreq, string> = { DAILY: '日', WEEKLY: '週間', MONTHLY: 'か月', YEARLY: '年' }

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

export function buildRepeatPicker(opts: RepeatPickerOptions): { dom: HTMLElement; mount(): void; destroy(): void } {
  const dom = el('div', 'metatag-picker-popup metatag-repeat-picker')
  const form: RepeatForm = parseRepeat(opts.initialValue) ?? defaultRepeatForm()
  const initialUnsupported = opts.initialValue.trim() !== '' && parseRepeat(opts.initialValue) === null

  const mkSelect = (cls: string, options: [string, string][]) => {
    const s = el('select', cls)
    for (const [v, t] of options) {
      const o = document.createElement('option')
      o.value = v
      o.textContent = t
      s.appendChild(o)
    }
    return s
  }

  // 頻度・間隔
  const freqRow = el('div', 'metatag-picker-row')
  const interval = el('input', 'metatag-repeat-interval')
  interval.type = 'number'
  interval.min = '1'
  const freq = mkSelect('metatag-repeat-freq', [['DAILY', '毎日'], ['WEEKLY', '毎週'], ['MONTHLY', '毎月'], ['YEARLY', '毎年']])
  const unit = el('span', 'metatag-repeat-unit')
  freqRow.append(freq, interval, unit, document.createTextNode('ごと'))

  // 毎週: 曜日
  const wdRow = el('div', 'metatag-picker-row metatag-repeat-weekdays')
  const wdBtns = WEEKDAYS.map((d, i) => {
    const b = el('button', 'metatag-picker-btn metatag-repeat-wd', WD_JA[i])
    b.type = 'button'
    b.dataset.wd = d
    wdRow.appendChild(b)
    return b
  })

  // 毎月
  const monthRow = el('div', 'metatag-picker-row metatag-repeat-monthly')
  const mode = mkSelect('metatag-repeat-mode', [['monthday', '日付'], ['nth-weekday', '第N曜日']])
  const monthDay = el('input', 'metatag-repeat-monthday')
  monthDay.type = 'number'
  monthDay.min = '1'
  monthDay.max = '31'
  const nth = mkSelect('metatag-repeat-nth', [['1', '第1'], ['2', '第2'], ['3', '第3'], ['4', '第4'], ['-1', '最終']])
  const nthWd = mkSelect('metatag-repeat-nthwd', WEEKDAYS.map((d, i) => [d, `${WD_JA[i]}曜日`]))
  monthRow.append(mode, monthDay, document.createTextNode('日'), nth, nthWd)

  const yearNote = el('div', 'metatag-repeat-note', '@schedule の日付に従います')

  // 終了
  const endRow = el('div', 'metatag-picker-row metatag-repeat-end')
  const end = mkSelect('metatag-repeat-endmode', [['none', '終了なし'], ['count', '回数'], ['until', '日付まで']])
  const count = el('input', 'metatag-repeat-count')
  count.type = 'number'
  count.min = '1'
  const until = el('input', 'metatag-repeat-until')
  until.type = 'date'
  endRow.append(end, count, until)

  const summary = el('div', 'metatag-repeat-summary')
  const text = el('input', 'metatag-repeat-text')
  text.type = 'text'
  const warn = el('div', 'metatag-repeat-note', '詳細な指定のためテキストで編集してください')

  const bottom = el('div', 'metatag-picker-button-row')
  const commitBtn = el('button', 'metatag-picker-btn metatag-picker-btn-commit', '決定')
  commitBtn.type = 'button'
  bottom.appendChild(commitBtn)

  dom.append(freqRow, wdRow, monthRow, yearNote, endRow, summary, text, warn, bottom)

  const formControls: (HTMLInputElement | HTMLSelectElement | HTMLButtonElement)[] = [
    freq, interval, ...wdBtns, mode, monthDay, nth, nthWd, end, count, until,
  ]

  /** フォーム値 → 表示（行の出し分け・要約）。テキスト欄は updateText=true のときだけ上書きする。 */
  const render = (updateText: boolean) => {
    freq.value = form.freq
    interval.value = String(form.interval)
    unit.textContent = UNIT[form.freq]
    wdRow.hidden = form.freq !== 'WEEKLY'
    monthRow.hidden = form.freq !== 'MONTHLY'
    yearNote.hidden = form.freq !== 'YEARLY'
    wdBtns.forEach((b) => b.classList.toggle('is-active', form.byWeekday.includes(b.dataset.wd as Weekday)))
    mode.value = form.monthlyMode
    monthDay.value = String(form.byMonthDay)
    monthDay.hidden = form.monthlyMode !== 'monthday'
    nth.hidden = nthWd.hidden = form.monthlyMode !== 'nth-weekday'
    nth.value = String(form.nth)
    nthWd.value = form.nthWeekday
    end.value = form.end
    count.value = String(form.count)
    until.value = form.until
    count.hidden = form.end !== 'count'
    until.hidden = form.end !== 'until'
    const v = buildRepeat(form)
    summary.textContent = describeRepeat(v)
    if (updateText) text.value = v
  }
  const setFormDisabled = (disabled: boolean) => {
    formControls.forEach((c) => (c.disabled = disabled))
    warn.hidden = !disabled
  }

  const readForm = () => {
    form.freq = freq.value as RepeatFreq
    form.interval = Math.max(1, parseInt(interval.value, 10) || 1)
    form.monthlyMode = mode.value as RepeatForm['monthlyMode']
    form.byMonthDay = Math.min(31, Math.max(1, parseInt(monthDay.value, 10) || 1))
    form.nth = Number(nth.value)
    form.nthWeekday = nthWd.value as Weekday
    form.end = end.value as RepeatForm['end']
    form.count = Math.max(1, parseInt(count.value, 10) || 1)
    form.until = until.value
    render(true)
  }
  for (const c of [freq, interval, mode, monthDay, nth, nthWd, end, count, until]) {
    c.addEventListener('change', readForm)
    c.addEventListener('input', readForm)
  }
  for (const b of wdBtns) {
    b.addEventListener('mousedown', (e) => {
      e.preventDefault()
      const d = b.dataset.wd as Weekday
      form.byWeekday = form.byWeekday.includes(d) ? form.byWeekday.filter((x) => x !== d) : [...form.byWeekday, d]
      render(true)
    })
  }
  text.addEventListener('input', () => {
    const parsed = parseRepeat(text.value)
    if (parsed) {
      Object.assign(form, parsed)
      setFormDisabled(false)
      render(false)
    } else {
      setFormDisabled(true)
      summary.textContent = describeRepeat(text.value)
    }
  })

  render(true)
  if (initialUnsupported) {
    text.value = opts.initialValue.trim()
    setFormDisabled(true)
    summary.textContent = text.value
  } else {
    setFormDisabled(false)
    if (opts.initialValue.trim() === '') summary.textContent = describeRepeat(text.value)
  }

  const commitCurrent = (): boolean => {
    const v = text.value.trim()
    if (!v) return false
    opts.onCommit(v)
    return true
  }
  commitBtn.addEventListener('mousedown', (e) => {
    e.preventDefault()
    commitCurrent()
  })

  let outside: ((e: MouseEvent) => void) | null = null
  let keyDown: ((e: KeyboardEvent) => void) | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let done = false
  return {
    dom,
    mount() {
      timer = setTimeout(() => {
        outside = (e) => {
          if (dom.contains(e.target as Node) || done) return
          done = true
          if (!commitCurrent()) opts.onClose()
        }
        keyDown = (e) => {
          if (e.key !== 'Escape') return
          e.preventDefault()
          if (done) return
          done = true
          opts.onClose()
        }
        document.addEventListener('mousedown', outside, true)
        document.addEventListener('keydown', keyDown, true)
      }, 0)
    },
    destroy() {
      if (timer) clearTimeout(timer)
      if (outside) document.removeEventListener('mousedown', outside, true)
      if (keyDown) document.removeEventListener('keydown', keyDown, true)
    },
  }
}

import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildRepeatPicker } from './repeat-picker'

const tick = () => new Promise((r) => setTimeout(r, 5))
const made: { destroy(): void }[] = []
afterEach(() => {
  made.forEach((p) => p.destroy())
  made.length = 0
  document.body.innerHTML = ''
})
async function setup(initialValue: string) {
  const onCommit = vi.fn()
  const onClose = vi.fn()
  const p = buildRepeatPicker({ initialValue, onCommit, onClose })
  made.push(p)
  document.body.appendChild(p.dom)
  p.mount()
  await tick()
  const q = <T extends HTMLElement>(c: string) => p.dom.querySelector(c) as T
  return { p, onCommit, onClose, q }
}

describe('buildRepeatPicker（issue-phase020-004）', () => {
  it('フォーム操作でテキスト値が変わる', async () => {
    const { q } = await setup('FREQ=DAILY')
    const freq = q<HTMLSelectElement>('.metatag-repeat-freq')
    freq.value = 'WEEKLY'
    freq.dispatchEvent(new Event('change'))
    q<HTMLButtonElement>('[data-wd="MO"]').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    q<HTMLButtonElement>('[data-wd="WE"]').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(q<HTMLInputElement>('.metatag-repeat-text').value).toBe('FREQ=WEEKLY;BYDAY=MO,WE')
  })
  it('既存値が反映され、外側 mousedown で保存される', async () => {
    const { onCommit, onClose } = await setup('FREQ=MONTHLY;BYDAY=1FR')
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(onCommit).toHaveBeenCalledWith('FREQ=MONTHLY;BYDAY=1FR')
    expect(onClose).not.toHaveBeenCalled()
  })
  it('Escape は破棄', async () => {
    const { onCommit, onClose } = await setup('FREQ=DAILY')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onCommit).not.toHaveBeenCalled()
  })
  it('非対応 RRULE はフォーム無効のままテキストで保存でき、値が壊れない', async () => {
    const { onCommit, q } = await setup('FREQ=MONTHLY;BYSETPOS=1;BYDAY=MO')
    expect(q<HTMLSelectElement>('.metatag-repeat-freq').disabled).toBe(true)
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(onCommit).toHaveBeenCalledWith('FREQ=MONTHLY;BYSETPOS=1;BYDAY=MO')
  })
})

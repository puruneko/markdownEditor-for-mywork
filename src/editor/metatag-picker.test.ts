import { describe, it, expect, vi, afterEach } from 'vitest'
import { minuteOptions, buildMetaDatePicker } from './metatag-picker'

describe('minuteOptions', () => {
  it.each([
    [15, ['00', '15', '30', '45']],
    [20, ['00', '20', '40']],
    [30, ['00', '30']],
  ])('step %i', (step, expected) => {
    expect(minuteOptions(step)).toEqual(expected)
  })
  it('step 1 は 00〜59', () => {
    expect(minuteOptions(1)).toHaveLength(60)
  })
})

// issue-phase020-markdownEditor-for-mywork-002: 外側クリックで保存、Esc で破棄
describe('buildMetaDatePicker の外側クリック/Esc', () => {
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
    const p = buildMetaDatePicker({
      initialValue, initialTentative: false, showTentative: false, minuteStep: 15, onCommit, onClose,
    })
    made.push(p)
    document.body.appendChild(p.dom)
    p.mount()
    await tick()
    return { p, onCommit, onClose }
  }
  it('外側 mousedown → onCommit（onClose なし）', async () => {
    const { onCommit, onClose } = await setup('2026-10-01')
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(onCommit).toHaveBeenCalledWith('2026-10-01', false)
    expect(onClose).not.toHaveBeenCalled()
  })
  it('Escape → onClose のみ', async () => {
    const { onCommit, onClose } = await setup('2026-10-01')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onCommit).not.toHaveBeenCalled()
  })
  it('開始日が空で外側 mousedown → onCommit なし・onClose あり', async () => {
    const { onCommit, onClose } = await setup('')
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(onCommit).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })
  it('ピッカー内 mousedown → どちらも呼ばれない', async () => {
    const { p, onCommit, onClose } = await setup('2026-10-01')
    p.dom.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(onCommit).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})

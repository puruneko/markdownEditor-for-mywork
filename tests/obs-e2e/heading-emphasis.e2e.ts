import { browser, expect } from '@wdio/globals'
import { obsidianPage } from 'wdio-obsidian-service'
import { openFile, writeVaultFile } from './helpers/obsidian-helpers'

/** クラス名だけでなく、実際にCSSが適用され見た目が変化していることを検証する（issue-phase003-008の教訓）。 */
async function getComputedStyleProp(selector: string, prop: string): Promise<string> {
  return browser.execute(
    (sel: string, p: string) => {
      const el = document.querySelector(sel) as HTMLElement | null
      if (!el) return ''
      return getComputedStyle(el).getPropertyValue(p)
    },
    selector,
    prop,
  )
}

describe('編集モードの見出し強調（issue-phase003-013）', function () {
  before(async function () {
    await browser.reloadObsidian({ vault: './test/vaults/simple' })
  })

  beforeEach(async function () {
    await obsidianPage.resetVault()
  })

  it('H1行に薄い青系の背景と広い行間・大きな文字が適用される', async function () {
    await writeVaultFile('heading-h1.md', ['# 案件A開始', '本文'].join('\n'))
    await openFile('heading-h1.md')
    await browser.waitUntil(async () => (await browser.$('.HyperMD-header-1')).isExisting(), {
      timeout: 5000,
      interval: 200,
      timeoutMsg: '.HyperMD-header-1 が見つからない',
    })

    const bg = await getComputedStyleProp('.HyperMD-header-1', 'background-color')
    const m = bg.match(/rgba?\(([^)]+)\)/)
    expect(m).not.toBeNull()
    const alpha = m![1].split(',').map((s) => parseFloat(s.trim()))[3] ?? 1
    expect(alpha).toBeGreaterThan(0)

    const padding = await getComputedStyleProp('.HyperMD-header-1', 'padding-top')
    expect(parseFloat(padding)).toBeGreaterThan(0)

    const fontSize = await getComputedStyleProp('.cm-header-1', 'font-size')
    const bodyFontSize = await getComputedStyleProp('.cm-line:not(.HyperMD-header)', 'font-size')
    expect(parseFloat(fontSize)).toBeGreaterThan(parseFloat(bodyFontSize))
  })

  it('H2は文字の下だけに灰色の太い下線が引かれ、行全体には下線が付かない', async function () {
    await writeVaultFile('heading-h2.md', ['# セクション', '## サブセクション', '本文'].join('\n'))
    await openFile('heading-h2.md')
    await browser.waitUntil(async () => (await browser.$('.HyperMD-header-2')).isExisting(), {
      timeout: 5000,
      interval: 200,
      timeoutMsg: '.HyperMD-header-2 が見つからない',
    })

    // 下線は行全体（.HyperMD-header-2）ではなく、文字を覆うインラインspan（.cm-header-2）にのみ引く。
    const lineBorderWidth = await getComputedStyleProp('.HyperMD-header-2', 'border-bottom-width')
    expect(parseFloat(lineBorderWidth) || 0).toBe(0)

    const textBorderWidth = await getComputedStyleProp('.cm-header-2', 'border-bottom-width')
    expect(parseFloat(textBorderWidth)).toBeGreaterThanOrEqual(3)

    // 下線は灰色系（--text-muted）であり、H1と同じ青系（アクセントカラー）ではないこと。
    const borderColor = await getComputedStyleProp('.cm-header-2', 'border-bottom-color')
    const m = borderColor.match(/rgba?\(([^)]+)\)/)
    expect(m).not.toBeNull()
    const [r, g, b] = m![1].split(',').map((s) => parseFloat(s.trim()))
    // 灰色 = R/G/B がほぼ同じ値（色相が付いていない）。
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(20)

    const fontSize = await getComputedStyleProp('.cm-header-2', 'font-size')
    const bodyFontSize = await getComputedStyleProp('.cm-line:not(.HyperMD-header)', 'font-size')
    expect(parseFloat(fontSize)).toBeGreaterThan(parseFloat(bodyFontSize))
  })

  it('H3行にはH1/H2向けの背景・下線が付与されない', async function () {
    await writeVaultFile('heading-h3.md', ['### 小見出し', '本文'].join('\n'))
    await openFile('heading-h3.md')
    await browser.waitUntil(async () => (await browser.$('.HyperMD-header-3')).isExisting(), {
      timeout: 5000,
      interval: 200,
      timeoutMsg: '.HyperMD-header-3 が見つからない',
    })

    const bg = await getComputedStyleProp('.HyperMD-header-3', 'background-color')
    expect(bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent').toBe(true)
    const borderWidth = await getComputedStyleProp('.cm-header-3', 'border-bottom-width')
    expect(parseFloat(borderWidth) || 0).toBe(0)
  })
})

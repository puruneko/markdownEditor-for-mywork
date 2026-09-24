import { browser, expect } from '@wdio/globals'
import { obsidianPage } from 'wdio-obsidian-service'
import { openFile, writeVaultFile, waitForFileContentChange } from './helpers/obsidian-helpers'

/**
 * <input type="date"|"time"> はネイティブのセグメント入力のため、WebdriverIOの setValue（キー入力
 * シミュレーション）でISO文字列をそのまま流し込むと桁がずれて壊れる。JSで直接 value を設定し、
 * input/change イベントを発火させる。
 */
async function setNativeInputValue(selector: string, value: string): Promise<void> {
  await browser.execute(
    (sel: string, v: string) => {
      const el = document.querySelector(sel) as HTMLInputElement | null
      if (!el) return
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
      setter.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    },
    selector,
    value,
  )
}

/**
 * クラス名の付与だけでなく、CSSが実際に適用されて見た目が変化していることまで検証する
 * （2026-09-17再増分: styles.css が実機Obsidianへコピーされておらず、クラスは付与されて
 * いるのにCSSが反映されない不具合があったため。クラス存在だけのアサートでは検出できない）。
 */
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

/** 'rgba(r, g, b, a)' / 'rgb(r, g, b)' のアルファ成分が0より大きいか（＝背景が実際に付いているか）。 */
function hasVisibleBackground(color: string): boolean {
  const m = color.match(/rgba?\(([^)]+)\)/)
  if (!m) return false
  const parts = m[1].split(',').map((s) => parseFloat(s.trim()))
  const alpha = parts.length === 4 ? parts[3] : 1
  return alpha > 0
}

/** 'rgb(r, g, b)' が緑系（G成分がR成分より明確に大きい）か。テーマ依存の厳密値比較は避ける。 */
function isGreenish(color: string): boolean {
  const m = color.match(/rgba?\(([^)]+)\)/)
  if (!m) return false
  const [r, g] = m[1].split(',').map((s) => parseFloat(s.trim()))
  return g > r
}

describe('メタタグ装飾・日付ピッカー（issue-phase003-008 2026-09-17増分）', function () {
  before(async function () {
    await browser.reloadObsidian({ vault: './test/vaults/simple' })
  })

  beforeEach(async function () {
    await obsidianPage.resetVault()
  })

  it('日付系以外のメタキー（@priority）が緑系装飾（キー=薄い背景／値=緑文字）で実際に見た目が変わる', async function () {
    await writeVaultFile('metatag-green.md', ['- [ ] タスク', '  - @priority: 1'].join('\n'))
    await openFile('metatag-green.md')
    await browser.waitUntil(
      async () => (await browser.$('.metatag-value.metatag-priority')).isExisting(),
      { timeout: 5000, interval: 200, timeoutMsg: '.metatag-value.metatag-priority が見つからない' },
    )
    await expect(browser.$('.metatag-value.metatag-priority')).toExist()
    await expect(browser.$('.metatag-key.metatag-priority')).toExist()
    await expect(browser.$('.metatag-value.metatag-priority')).toHaveElementClass('metatag')

    // クラスの有無だけでなく、CSSが実際に適用され見た目が変化していることを検証する。
    const keyBg = await getComputedStyleProp('.metatag-key.metatag-priority', 'background-color')
    expect(hasVisibleBackground(keyBg)).toBe(true)
    const valueColor = await getComputedStyleProp('.metatag-value.metatag-priority', 'color')
    expect(isGreenish(valueColor)).toBe(true)
  })

  it('複数行値キー（@完了イメージ）の子リストにもmetatagクラスが付与される', async function () {
    await writeVaultFile(
      'metatag-multi.md',
      ['- [ ] タスク', '  - @完了イメージ:', '    - 条件A', '    - 条件B'].join('\n'),
    )
    await openFile('metatag-multi.md')
    await browser.waitUntil(
      async () => (await browser.$$('.metatag-value.metatag-condition')).length >= 2,
      { timeout: 5000, interval: 200, timeoutMsg: '子リストへのmetatag-condition付与が見つからない' },
    )
    const items = await browser.$$('.metatag-value.metatag-condition')
    expect(items.length).toBeGreaterThanOrEqual(2)
  })

  it('コロンなしの裸のメタキー（@memo）とその直下のネスト全体が装飾される', async function () {
    await writeVaultFile(
      'metatag-bare-key.md',
      ['- [ ] タスク', '  - @memo', '    - あいうえお'].join('\n'),
    )
    await openFile('metatag-bare-key.md')
    await browser.waitUntil(
      async () => (await browser.$('.metatag-key.metatag-unknown')).isExisting(),
      { timeout: 5000, interval: 200, timeoutMsg: '.metatag-key.metatag-unknown（@memo）が見つからない' },
    )
    await expect(browser.$('.metatag-key.metatag-unknown')).toExist()
    await browser.waitUntil(
      async () => (await browser.$('.metatag-value.metatag-unknown')).isExisting(),
      { timeout: 5000, interval: 200, timeoutMsg: 'ネスト行（あいうえお）へのmetatag-unknown付与が見つからない' },
    )
    const nested = browser.$('.metatag-value.metatag-unknown')
    await expect(nested).toExist()
    expect(await nested.getText()).toBe('あいうえお')
  })

  it('@scheduleの値がLive Previewで人間可読なチップ表示になる（yyyy省略・T除去）', async function () {
    await writeVaultFile(
      'metatag-chip.md',
      ['- [ ] タスク', '  - @schedule: 2026-09-17T14:00/2026-09-17T16:00'].join('\n'),
    )
    await openFile('metatag-chip.md')
    await browser.waitUntil(async () => (await browser.$('.metatag-date-chip')).isExisting(), {
      timeout: 5000,
      interval: 200,
      timeoutMsg: '.metatag-date-chip が見つからない',
    })
    const text = await browser.$('.metatag-date-chip').getText()
    expect(text).toBe('予定: 9/17 14:00〜16:00')
  })

  it('チップをクリックすると非モーダルのピッカーが開く', async function () {
    await writeVaultFile('metatag-click.md', ['- [ ] タスク', '  - @due: 2026-09-20'].join('\n'))
    await openFile('metatag-click.md')
    await browser.waitUntil(async () => (await browser.$('.metatag-date-chip')).isExisting(), {
      timeout: 5000,
      interval: 200,
      timeoutMsg: '.metatag-date-chip が見つからない',
    })
    await browser.$('.metatag-date-chip').click()
    await browser.waitUntil(async () => (await browser.$('.metatag-picker-popup')).isExisting(), {
      timeout: 3000,
      interval: 100,
      timeoutMsg: 'ピッカーポップアップが開かない',
    })
    await expect(browser.$('.metatag-picker-popup')).toExist()
    // モーダルではない＝背面をブロックするオーバーレイ要素が存在しないこと。
    await expect(browser.$('.modal-container')).not.toExist()
  })

  it('ピッカーで日付を変更し設定すると、値レンジのみ書き換わる', async function () {
    const fileName = 'metatag-edit.md'
    const before = ['- [ ] タスク', '  - @due: 2026-09-20'].join('\n') + '\n'
    await writeVaultFile(fileName, before)
    await openFile(fileName)
    await browser.waitUntil(async () => (await browser.$('.metatag-date-chip')).isExisting(), {
      timeout: 5000,
      interval: 200,
      timeoutMsg: '.metatag-date-chip が見つからない',
    })
    await browser.$('.metatag-date-chip').click()
    await browser.waitUntil(async () => (await browser.$('.metatag-picker-date')).isExisting(), {
      timeout: 3000,
      interval: 100,
      timeoutMsg: 'ピッカーの日付入力が見つからない',
    })
    await setNativeInputValue('.metatag-picker-date', '2026-09-25')
    await browser.$('.metatag-picker-btn-commit').click()

    const after = await waitForFileContentChange(fileName, before)
    expect(after).toBe(['- [ ] タスク', '  - @due: 2026-09-25'].join('\n') + '\n')
  })

  it('@key: の入力（コロン確定）でピッカーが自動起動し、値のみ挿入される', async function () {
    const fileName = 'metatag-auto-open.md'
    const before = ['- [ ] タスク', '  - @schedule'].join('\n') + '\n'
    await writeVaultFile(fileName, before)
    await openFile(fileName)

    // 実際のキー入力と同じCM6トランザクションを発生させるため、Editor APIで ':' を1文字挿入する。
    // 対象行は index 1（"  - @schedule"）。末尾の改行でファイルにできる空行（lastLine）を
    // 誤って対象にしないよう、行番号を明示指定する。
    await browser.execute(() => {
      const app = (window as any).app
      const editor = app.workspace.activeEditor.editor
      const targetLine = 1
      const ch = editor.getLine(targetLine).length
      editor.replaceRange(':', { line: targetLine, ch }, { line: targetLine, ch })
    })

    await browser.waitUntil(async () => (await browser.$('.metatag-picker-popup')).isExisting(), {
      timeout: 3000,
      interval: 100,
      timeoutMsg: '@schedule: 確定時にピッカーが自動起動しない',
    })

    await setNativeInputValue('.metatag-picker-date', '2026-09-17')
    await setNativeInputValue('.metatag-picker-time', '09:00')
    await browser.$('.metatag-picker-btn-commit').click()

    const after = await waitForFileContentChange(fileName, before)
    expect(after).toBe(['- [ ] タスク', '  - @schedule: 2026-09-17T09:00'].join('\n') + '\n')
  })

  it('ピッカーの背景・文字色がObsidianのライト/ダーク設定に追従する（回帰防止）', async function () {
    // 2026-09-17 再々増分: CodeMirrorの showTooltip が自前で `.cm-tooltip` クラスを付与し、
    // その既定背景色が本プラグインの `--background-primary` 由来の背景を上書きしてしまい、
    // ダークモードでも常に明るい背景のまま（読みにくい）になる実機不具合があった。
    // `.metatag-picker-popup.cm-tooltip` へ詳細度を上げて修正した回帰防止テスト。
    await writeVaultFile('metatag-theme.md', ['- [ ] タスク', '  - @due: 2026-09-20'].join('\n'))
    await openFile('metatag-theme.md')
    await browser.waitUntil(async () => (await browser.$('.metatag-date-chip')).isExisting(), { timeout: 5000 })
    await browser.$('.metatag-date-chip').click()
    await browser.waitUntil(async () => (await browser.$('.metatag-picker-popup')).isExisting(), { timeout: 3000 })

    const readPopupLuminance = async (): Promise<number> =>
      browser.execute(() => {
        const el = document.querySelector('.metatag-picker-popup') as HTMLElement
        const bg = getComputedStyle(el).backgroundColor
        const m = bg.match(/rgba?\(([^)]+)\)/)
        if (!m) return -1
        const [r, g, b] = m[1].split(',').map((s) => parseFloat(s.trim()))
        return 0.299 * r + 0.587 * g + 0.114 * b
      })

    const lightLuminance = await readPopupLuminance()

    await browser.execute(() => {
      document.body.classList.remove('theme-light')
      document.body.classList.add('theme-dark')
    })
    await browser.pause(200)
    const darkLuminance = await readPopupLuminance()

    // ライトモードの背景は明るく（高輝度）、ダークモードでは明確に暗く（低輝度）なること。
    expect(lightLuminance).toBeGreaterThan(180)
    expect(darkLuminance).toBeLessThan(80)
  })

  it('既存の md-ast-meta-key 装飾（後方互換）は引き続き付与される', async function () {
    await writeVaultFile('metatag-back-compat.md', ['- [ ] タスク', '  - @schedule?: 2026-09-17T10:00'].join('\n'))
    await openFile('metatag-back-compat.md')
    await browser.waitUntil(async () => (await browser.$('.md-ast-meta-key')).isExisting(), {
      timeout: 5000,
      interval: 200,
      timeoutMsg: '.md-ast-meta-key が見つからない（既存装飾の後方互換が壊れている）',
    })
    await expect(browser.$('.md-ast-meta-key')).toExist()
    await expect(browser.$('.md-ast-meta-tentative')).toExist()
  })

  // --------------------------------------------------------------
  // issue-phase011-markdownEditor-002: 非日付メタ情報の＠記号を非表示にする
  // --------------------------------------------------------------

  it('非日付メタ（@priority）は wysiwygモードで＠記号がDOM上に表示されない。緑装飾は引き続き適用される', async function () {
    await writeVaultFile('metatag-at-hidden-priority.md', ['- [ ] タスク', '  - @priority: 1'].join('\n'))
    await openFile('metatag-at-hidden-priority.md')
    await browser.waitUntil(
      async () => (await browser.$('.metatag-value.metatag-priority')).isExisting(),
      { timeout: 5000, interval: 200, timeoutMsg: '.metatag-value.metatag-priority が見つからない' },
    )
    // 緑装飾（既存要件）は引き続き適用される（回帰確認）。
    await expect(browser.$('.metatag-key.metatag-priority')).toExist()
    await expect(browser.$('.metatag-value.metatag-priority')).toExist()

    const lineText = await browser.execute(() => {
      const keyEl = document.querySelector('.metatag-key.metatag-priority')
      const line = keyEl?.closest('.cm-line')
      return line?.textContent ?? ''
    })
    expect(lineText).not.toContain('@')
    expect(lineText).toContain('priority: 1')
  })

  it('コロンなしの裸の非日付メタ（@memo）も wysiwygモードで＠記号がDOM上に表示されない', async function () {
    await writeVaultFile('metatag-at-hidden-bare.md', ['- [ ] タスク', '  - @memo', '    - あいうえお'].join('\n'))
    await openFile('metatag-at-hidden-bare.md')
    await browser.waitUntil(
      async () => (await browser.$('.metatag-key.metatag-unknown')).isExisting(),
      { timeout: 5000, interval: 200, timeoutMsg: '.metatag-key.metatag-unknown（@memo）が見つからない' },
    )
    const lineText = await browser.execute(() => {
      const keyEl = document.querySelector('.metatag-key.metatag-unknown')
      const line = keyEl?.closest('.cm-line')
      return line?.textContent ?? ''
    })
    expect(lineText).not.toContain('@')
    expect(lineText).toContain('memo')
  })

  it('日付系メタ（@schedule）の＠非表示・チップ表示には変化がない（回帰確認）', async function () {
    await writeVaultFile(
      'metatag-at-hidden-date-regression.md',
      ['- [ ] タスク', '  - @schedule: 2026-09-17T14:00/2026-09-17T16:00'].join('\n'),
    )
    await openFile('metatag-at-hidden-date-regression.md')
    await browser.waitUntil(async () => (await browser.$('.metatag-date-chip')).isExisting(), {
      timeout: 5000,
      interval: 200,
      timeoutMsg: '.metatag-date-chip が見つからない',
    })
    const text = await browser.$('.metatag-date-chip').getText()
    expect(text).toBe('予定: 9/17 14:00〜16:00')
  })

  it('カーソルが行に重なると、非日付メタも生テキスト（＠付き）に戻り編集できる', async function () {
    const fileName = 'metatag-at-hidden-cursor.md'
    await writeVaultFile(fileName, ['- [ ] タスク', '  - @priority: 1'].join('\n'))
    await openFile(fileName)
    await browser.waitUntil(
      async () => (await browser.$('.metatag-value.metatag-priority')).isExisting(),
      { timeout: 5000, interval: 200, timeoutMsg: '.metatag-value.metatag-priority が見つからない' },
    )

    // カーソルを対象行（index 1）へ移動する。
    await browser.execute(() => {
      const app = (window as any).app
      const editor = app.workspace.activeEditor.editor
      editor.setCursor({ line: 1, ch: 4 })
      editor.focus()
    })

    await browser.waitUntil(
      async () => {
        const lineText = await browser.execute(() => {
          const el = document.querySelector('.metatag-key.metatag-priority, .metatag-value.metatag-priority')
          const line = el?.closest('.cm-line')
          return line?.textContent ?? ''
        })
        return lineText.includes('@priority')
      },
      { timeout: 3000, interval: 100, timeoutMsg: 'カーソルが行に重なっても＠が復元されない' },
    )
  })
})

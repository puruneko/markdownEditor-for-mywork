import { browser } from '@wdio/globals'

/**
 * shadow DOM ヘルパ
 *
 * 全ビュー（ShadowItemView 派生）は `.view-shadow-host` の shadow root 内に描画される。
 * ビュークラス（.gantt-view 等）は shadow の**外側**のコンテナに付く。
 *
 * 重要: `browser.execute` 内の `document.querySelector` は shadow root を貫通しない。
 * shadow 内の要素の検索・座標取得は必ずこのヘルパを使うこと。
 * 存在確認・件数カウントだけなら WDIO の deep selector（`browser.$$('>>>.selector')`）でも可。
 */

type RectLike = { x: number; y: number; width: number; height: number }

/** ビューの shadow root 内でセレクタに一致する要素の件数を返す。 */
export async function countShadow(viewClass: string, selector: string): Promise<number> {
  return browser.execute(
    (vc: string, sel: string) => {
      const host = document.querySelector(`.${vc} .view-shadow-host`)
      if (!host || !host.shadowRoot) return -1
      return host.shadowRoot.querySelectorAll(sel).length
    },
    viewClass,
    selector,
  )
}

/** ビューの shadow root 内の要素の textContent を返す（見つからなければ null）。 */
export async function getShadowText(viewClass: string, selector: string): Promise<string | null> {
  return browser.execute(
    (vc: string, sel: string) => {
      const host = document.querySelector(`.${vc} .view-shadow-host`)
      const el = host?.shadowRoot?.querySelector(sel)
      return el ? (el.textContent ?? '') : null
    },
    viewClass,
    selector,
  )
}

/** shadow root 内の要素の getBoundingClientRect（ビューポート座標）。SVG 要素にも使える。 */
export async function getShadowRect(viewClass: string, selector: string): Promise<RectLike | null> {
  return browser.execute(
    (vc: string, sel: string) => {
      const host = document.querySelector(`.${vc} .view-shadow-host`)
      const el = host?.shadowRoot?.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    },
    viewClass,
    selector,
  )
}

/**
 * shadow root 内で containerSel 配下の itemSel 要素の属性値を DOM 順で返す。
 * カード・バー等の「表示順」アサート用（コンテナ存在のみのアサートは禁止 — obs-0008）。
 *
 * 例: getShadowOrder('kanban-view', '.kanban-lane[data-lane-id="doing"] .kanban-lane-body', '[data-card-id]', 'data-card-id')
 */
export async function getShadowOrder(
  viewClass: string,
  containerSel: string,
  itemSel: string,
  attr: string,
): Promise<string[]> {
  return browser.execute(
    (vc: string, cSel: string, iSel: string, a: string) => {
      const host = document.querySelector(`.${vc} .view-shadow-host`)
      const container = host?.shadowRoot?.querySelector(cSel)
      if (!container) return []
      return Array.from(container.querySelectorAll(iSel)).map(
        (el) => el.getAttribute(a) ?? '',
      )
    },
    viewClass,
    containerSel,
    itemSel,
    attr,
  )
}

/** shadow root 内の要素をクリックする（トグル・ボタン等の操作用）。成功したら true。 */
export async function clickShadow(viewClass: string, selector: string): Promise<boolean> {
  return browser.execute(
    (vc: string, sel: string) => {
      const host = document.querySelector(`.${vc} .view-shadow-host`)
      const el = host?.shadowRoot?.querySelector(sel) as HTMLElement | null
      if (!el) return false
      el.click()
      return true
    },
    viewClass,
    selector,
  )
}

/** shadow root 内の <select> の値を変更して change イベントを発火する。成功したら true。 */
export async function setShadowSelectValue(
  viewClass: string,
  selector: string,
  value: string,
): Promise<boolean> {
  return browser.execute(
    (vc: string, sel: string, v: string) => {
      const host = document.querySelector(`.${vc} .view-shadow-host`)
      const el = host?.shadowRoot?.querySelector(sel) as HTMLSelectElement | null
      if (!el) return false
      el.value = v
      el.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    },
    viewClass,
    selector,
    value,
  )
}

/** shadow root 内の <input> に値を設定して input イベントを発火する（Svelte bind:value 対応）。 */
export async function setShadowInputValue(
  viewClass: string,
  selector: string,
  value: string,
): Promise<boolean> {
  return browser.execute(
    (vc: string, sel: string, v: string) => {
      const host = document.querySelector(`.${vc} .view-shadow-host`)
      const el = host?.shadowRoot?.querySelector(sel) as HTMLInputElement | null
      if (!el) return false
      el.value = v
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    },
    viewClass,
    selector,
    value,
  )
}

/** shadow 内の要素が現れるまで待つ（countShadow > 0 のポーリング）。 */
export async function waitForShadow(
  viewClass: string,
  selector: string,
  opts: { timeout?: number; interval?: number } = {},
): Promise<void> {
  await browser.waitUntil(
    async () => (await countShadow(viewClass, selector)) > 0,
    {
      timeout: opts.timeout ?? 10000,
      interval: opts.interval ?? 500,
      timeoutMsg: `shadow 内に ${selector} が出現しない（view: .${viewClass}）`,
    },
  )
}

import { browser } from '@wdio/globals'
import { getShadowRect } from './shadow-dom'

/**
 * ドラッグ操作ヘルパ（2 方式）
 *
 * 方式A: dispatchPointerDrag — shadow root 内で PointerEvent を直接 dispatch する。
 *   Kanban の DnD（dndContext.svelte.ts）は pointerdown/move/up ＋ 6px しきい値で動く。
 *   合成イベントの setPointerCapture は失敗しうるため、dispatch 前に
 *   Element.prototype.setPointerCapture を no-op 化して回避する。
 *
 * 方式B: dispatchMouseDrag — MouseEvent 版（ガントの drag-handler は mouse イベント＋
 *   window グローバルリスナーで動くため、mousedown は要素へ・move/up は window へ）。
 *
 * どちらも「表示範囲外の要素で browser.action() が out of bounds になる」問題を回避できる。
 */

/**
 * Kanban カードを PointerEvent で target 座標までドラッグする。
 * from/to はビューポート座標。しきい値（6px）を確実に超えるため中間 move を挟む。
 */
export async function dispatchPointerDrag(
  viewClass: string,
  sourceSelector: string,
  to: { x: number; y: number },
): Promise<boolean> {
  return browser.execute(
    (vc: string, srcSel: string, tx: number, ty: number) => {
      const host = document.querySelector(`.${vc} .view-shadow-host`)
      const root = host?.shadowRoot
      if (!root) return false
      const el = root.querySelector(srcSel) as HTMLElement | null
      if (!el) return false

      // 合成 PointerEvent では setPointerCapture が InvalidPointerId で失敗するため無効化
      const origSet = Element.prototype.setPointerCapture
      const origRel = Element.prototype.releasePointerCapture
      Element.prototype.setPointerCapture = function () {}
      Element.prototype.releasePointerCapture = function () {}

      try {
        const r = el.getBoundingClientRect()
        const sx = r.x + r.width / 2
        const sy = r.y + r.height / 2

        const opts = (x: number, y: number) => ({
          bubbles: true,
          cancelable: true,
          composed: true, // shadow 境界を越えて伝播させる
          pointerId: 1,
          isPrimary: true,
          button: 0,
          buttons: 1,
          clientX: x,
          clientY: y,
        })

        el.dispatchEvent(new PointerEvent('pointerdown', opts(sx, sy)))
        // しきい値(6px)超え → 中間 → 目標、と段階的に動かして hit-testing を確実に発火させる
        const steps = [
          { x: sx + 10, y: sy + 10 },
          { x: (sx + tx) / 2, y: (sy + ty) / 2 },
          { x: tx, y: ty },
          { x: tx, y: ty }, // 目標位置で 2 回発火（insertIndex の確定を確実に）
        ]
        // pointermove/up はボード要素（キャプチャ対象）と window の両方へ dispatch する
        const board = root.querySelector('.kanban-board') ?? el
        for (const p of steps) {
          const ev = new PointerEvent('pointermove', opts(p.x, p.y))
          board.dispatchEvent(ev)
        }
        board.dispatchEvent(new PointerEvent('pointerup', { ...opts(tx, ty), buttons: 0 }))
        return true
      } finally {
        Element.prototype.setPointerCapture = origSet
        Element.prototype.releasePointerCapture = origRel
      }
    },
    viewClass,
    sourceSelector,
    to.x,
    to.y,
  )
}

/**
 * Kanban カードを別レーン（またはカードグループ）へドラッグする。
 * cardId は data-card-id（= globalKey）。
 */
export async function dragKanbanCard(
  cardId: string,
  target: { laneId?: string; groupBodySelector?: string },
): Promise<boolean> {
  const targetSel = target.laneId
    ? `.kanban-lane[data-lane-id="${target.laneId}"] .kanban-lane-body`
    : target.groupBodySelector!
  const rect = await getShadowRect('kanban-view', targetSel)
  if (!rect) return false
  return dispatchPointerDrag(
    'kanban-view',
    `[data-card-id="${cardId}"]`,
    { x: rect.x + rect.width / 2, y: rect.y + Math.min(rect.height / 2, 40) },
  )
}

/**
 * MouseEvent ディスパッチ式ドラッグ（ガント用）。
 * mousedown は shadow 内の要素へ、mousemove/mouseup は window へ dispatch する。
 */
export async function dispatchMouseDrag(
  viewClass: string,
  sourceSelector: string,
  deltaX: number,
  deltaY = 0,
): Promise<boolean> {
  return browser.execute(
    (vc: string, srcSel: string, dx: number, dy: number) => {
      const host = document.querySelector(`.${vc} .view-shadow-host`)
      const root = host?.shadowRoot
      if (!root) return false
      const el = root.querySelector(srcSel) as HTMLElement | SVGElement | null
      if (!el) return false

      // スクロールコンテナがあれば先頭へ戻して表示範囲に入れる
      const container = el.closest('.gantt-timeline-container') as HTMLElement | null
      if (container) container.scrollLeft = 0

      const r = el.getBoundingClientRect()
      const cx = r.x + r.width / 2
      const cy = r.y + r.height / 2

      el.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true, cancelable: true, composed: true, clientX: cx, clientY: cy,
      }))
      window.dispatchEvent(new MouseEvent('mousemove', {
        bubbles: true, clientX: cx + dx, clientY: cy + dy,
      }))
      window.dispatchEvent(new MouseEvent('mouseup', {
        bubbles: true, clientX: cx + dx, clientY: cy + dy,
      }))
      return true
    },
    viewClass,
    sourceSelector,
    deltaX,
    deltaY,
  )
}

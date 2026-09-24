import { describe, it, expect } from 'vitest'
import { SHADOW_RESET_CSS } from './ShadowItemView'
import { AstView } from './AstView'
import { FileSync } from '../sync/file-sync'
import { EditorEventBus } from '../sync/editor-event-bus'
import { parseMarkdown } from '../lib/parser/parse-markdown'
import { makeGlobalKey } from '../lib/viewmodel/global-key'
import { createMockApp, WorkspaceLeaf } from '../../tests/mocks/obsidian'

describe('SHADOW_RESET_CSS', () => {
  it(':host が継承プロパティ（color/background/font-size/line-height/letter-spacing）を白基調で固定している', () => {
    const hostBlock = SHADOW_RESET_CSS.match(/:host\s*{[^}]*}/)?.[0] ?? ''
    expect(hostBlock).toContain('color:')
    expect(hostBlock).toContain('background:')
    expect(hostBlock).toContain('font-size:')
    expect(hostBlock).toContain('line-height:')
    expect(hostBlock).toContain('letter-spacing:')
  })
})

describe('ShadowItemView.navigateToNode（オカレンスID正規化）', () => {
  function setupView() {
    const app = createMockApp()
    const fileSync = new FileSync(app as any, 300)
    const bus = new EditorEventBus()

    const md = '- [ ] タスクA\n  - @schedule: 2026-01-01T10:00/2026-01-01T11:00\n'
    const doc = parseMarkdown(md)
    const file = { path: 'note.md' } as any
    // FileSync のイベント監視を実際に開始せず、内部状態のみ直接設定する（テスト用）。
    ;(fileSync as any).currentFile = file
    ;(fileSync as any).currentDoc = doc
    ;(fileSync as any).currentMarkdown = md

    const leaf = new WorkspaceLeaf(app)
    const view = new AstView(leaf as any, fileSync, bus)

    const localId = doc.sections[0].children[0].id
    return { view, bus, doc, localId }
  }

  it('__r 付き globalKey でも正しい行へ遷移する', async () => {
    const { view, bus, doc, localId } = setupView()
    const focusedLines: number[] = []
    bus.onFocusLine((line) => focusedLines.push(line))

    const globalKey = makeGlobalKey('note.md', `${localId}__r3`)
    await (view as any).navigateToNode(globalKey)

    expect(focusedLines).toEqual([doc.nodeLineMap.get(localId)])
  })

  it('サフィックスなしの globalKey でも従来どおり遷移する（回帰）', async () => {
    const { view, bus, doc, localId } = setupView()
    const focusedLines: number[] = []
    bus.onFocusLine((line) => focusedLines.push(line))

    const globalKey = makeGlobalKey('note.md', localId)
    await (view as any).navigateToNode(globalKey)

    expect(focusedLines).toEqual([doc.nodeLineMap.get(localId)])
  })
})

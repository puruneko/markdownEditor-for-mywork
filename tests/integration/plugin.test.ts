import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMockApp } from '../mocks/obsidian'

vi.mock('obsidian', async () => {
  const mock = await import('../mocks/obsidian')
  return mock
})

describe('MdAstEditorPlugin', () => {
  let app: ReturnType<typeof createMockApp>

  beforeEach(() => {
    app = createMockApp()
    app.vault.read.mockResolvedValue('')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('onload()でAST Viewが登録される', async () => {
    const { MdAstEditorPlugin } = await import('../../src/plugin')
    const plugin = new MdAstEditorPlugin(app as any, null as any)
    await plugin.onload()

    expect(plugin.registerView).toHaveBeenCalledWith(
      'md-ast-editor-ast-view',
      expect.any(Function),
    )

    await plugin.onunload()
  })

  it('onload()でopen-ast-viewコマンドが登録される', async () => {
    const { MdAstEditorPlugin } = await import('../../src/plugin')
    const plugin = new MdAstEditorPlugin(app as any, null as any)
    await plugin.onload()

    expect(plugin.addCommand).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'open-ast-view' }),
    )

    await plugin.onunload()
  })

  it('onunload()でdetachLeavesOfTypeが呼ばれる', async () => {
    const { MdAstEditorPlugin } = await import('../../src/plugin')
    const plugin = new MdAstEditorPlugin(app as any, null as any)
    await plugin.onload()
    await plugin.onunload()

    expect(app.workspace.detachLeavesOfType).toHaveBeenCalledWith(
      'md-ast-editor-ast-view',
    )
  })
})

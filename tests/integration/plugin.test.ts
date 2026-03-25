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

  it('onload()でCalendar Viewが登録される', async () => {
    const { MdAstEditorPlugin } = await import('../../src/plugin')
    const plugin = new MdAstEditorPlugin(app as any, null as any)
    await plugin.onload()

    expect(plugin.registerView).toHaveBeenCalledWith(
      'md-ast-editor-calendar-view',
      expect.any(Function),
    )

    await plugin.onunload()
  })

  it('onload()でGantt Viewが登録される', async () => {
    const { MdAstEditorPlugin } = await import('../../src/plugin')
    const plugin = new MdAstEditorPlugin(app as any, null as any)
    await plugin.onload()

    expect(plugin.registerView).toHaveBeenCalledWith(
      'md-ast-editor-gantt-view',
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

  it('onload()でopen-calendar-viewコマンドが登録される', async () => {
    const { MdAstEditorPlugin } = await import('../../src/plugin')
    const plugin = new MdAstEditorPlugin(app as any, null as any)
    await plugin.onload()

    expect(plugin.addCommand).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'open-calendar-view' }),
    )

    await plugin.onunload()
  })

  it('onload()でopen-gantt-viewコマンドが登録される', async () => {
    const { MdAstEditorPlugin } = await import('../../src/plugin')
    const plugin = new MdAstEditorPlugin(app as any, null as any)
    await plugin.onload()

    expect(plugin.addCommand).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'open-gantt-view' }),
    )

    await plugin.onunload()
  })

  it('onunload()でAST/Calendar/Gantt ViewのdetachLeavesOfTypeが呼ばれる', async () => {
    const { MdAstEditorPlugin } = await import('../../src/plugin')
    const plugin = new MdAstEditorPlugin(app as any, null as any)
    await plugin.onload()
    await plugin.onunload()

    expect(app.workspace.detachLeavesOfType).toHaveBeenCalledWith(
      'md-ast-editor-ast-view',
    )
    expect(app.workspace.detachLeavesOfType).toHaveBeenCalledWith(
      'md-ast-editor-calendar-view',
    )
    expect(app.workspace.detachLeavesOfType).toHaveBeenCalledWith(
      'md-ast-editor-gantt-view',
    )
  })

  it('loadSettings()でデフォルト設定がロードされる', async () => {
    const { MdAstEditorPlugin } = await import('../../src/plugin')
    const plugin = new MdAstEditorPlugin(app as any, null as any)
    await plugin.onload()

    expect(plugin.settings).toMatchObject({
      showRibbonIcon: true,
      enableTaskHighlight: true,
      debounceMs: 300,
    })

    await plugin.onunload()
  })
})

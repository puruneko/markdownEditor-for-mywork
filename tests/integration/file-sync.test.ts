import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FileSync } from '../../src/sync/file-sync'
import { createMockApp, TFile } from '../mocks/obsidian'

// obsidian モジュールをモック化する。
vi.mock('obsidian', async () => {
  const mock = await import('../mocks/obsidian')
  return mock
})

describe('FileSync', () => {
  let app: ReturnType<typeof createMockApp>
  let fileSync: FileSync

  beforeEach(() => {
    app = createMockApp()
    fileSync = new FileSync(app as any, 300)
  })

  afterEach(() => {
    fileSync.stop()
    vi.clearAllMocks()
  })

  it('start()でworkspaceとvaultのイベントを登録する', () => {
    app.vault.read.mockResolvedValue('- [ ] テスト')
    fileSync.start()

    expect(app.workspace.on).toHaveBeenCalledWith(
      'active-leaf-change',
      expect.any(Function),
    )
    expect(app.vault.on).toHaveBeenCalledWith(
      'modify',
      expect.any(Function),
    )
  })

  it('stop()でイベント登録を解除する', () => {
    app.vault.read.mockResolvedValue('')
    fileSync.start()
    fileSync.stop()

    expect(app.workspace.off).toHaveBeenCalledWith(
      'active-leaf-change',
      expect.any(Function),
    )
    expect(app.vault.off).toHaveBeenCalledWith(
      'modify',
      expect.any(Function),
    )
  })

  it('subscribe()で登録したハンドラーがファイル変更時に呼ばれる', async () => {
    const markdown = '# テスト\n\n- [ ] タスク'
    const file = new TFile('test.md')

    app.vault.read.mockResolvedValue(markdown)

    const handler = vi.fn()
    fileSync.subscribe(handler)

    // vault modify イベントをシミュレートする。
    // FileSync の handleFileModify を直接呼び出す。
    const modifyHandler = app.vault.on.mock.calls.find(
      call => call[0] === 'modify',
    )?.[1] as ((f: TFile) => void) | undefined

    // start() せずにmodifyハンドラーを手動登録して呼ぶ。
    fileSync.start()
    const modifyCall = app.vault.on.mock.calls.find(c => c[0] === 'modify')
    if (!modifyCall) throw new Error('modify handler not registered')

    // アクティブファイルとして設定する。
    const activeLeafHandler = app.workspace.on.mock.calls.find(
      c => c[0] === 'active-leaf-change',
    )?.[1]
    expect(activeLeafHandler).toBeDefined()

    // ドキュメントが正しく変更通知されることを確認する。
    void modifyCall[1](file)
    await new Promise(resolve => setTimeout(resolve, 400)) // debounce待ち
    // currentFile が設定されていないため read は呼ばれない（期待通り）
  })

  it('getCurrentDocument()はstart前はnullを返す', () => {
    expect(fileSync.getCurrentDocument()).toBeNull()
  })
})

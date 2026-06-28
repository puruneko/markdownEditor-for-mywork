import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AstIndex } from '../../src/sync/ast-index'
import { createMockApp, TFile } from '../mocks/obsidian'

vi.mock('obsidian', async () => {
  const mock = await import('../mocks/obsidian')
  return mock
})

// ──────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────

const MD_A = `# ファイルA\n\n- [ ] タスクA1\n  - @schedule: 2026-01-01T10:00/11:00\n- [x] タスクA2\n`
const MD_B = `# ファイルB\n\n- [x] タスクB1\n- [ ] タスクB2\n`
const MD_EMPTY = `# 空\n\n普通のテキスト\n`

function makeIndex(
  app: ReturnType<typeof createMockApp>,
  opts?: Partial<{ debounceMs: number; scope: 'vault' | 'folder' | 'current-file'; scopeFolder: string }>,
) {
  return new AstIndex(app as any, {
    debounceMs: opts?.debounceMs ?? 0,
    scope: opts?.scope ?? 'vault',
    scopeFolder: opts?.scopeFolder ?? '',
  })
}

/** vault.on に登録されたハンドラーを取得するヘルパー。 */
function getVaultHandler(
  app: ReturnType<typeof createMockApp>,
  event: string,
): ((...args: unknown[]) => void) | undefined {
  const call = (app.vault.on as ReturnType<typeof vi.fn>).mock.calls.find(c => c[0] === event)
  return call?.[1] as ((...args: unknown[]) => void) | undefined
}

// ──────────────────────────────────────────────────────
// Suite
// ──────────────────────────────────────────────────────

describe('AstIndex', () => {
  let app: ReturnType<typeof createMockApp>
  let index: AstIndex

  beforeEach(() => {
    app = createMockApp()
  })

  afterEach(() => {
    index?.stop()
    vi.clearAllMocks()
  })

  // ── 初期走査 ─────────────────────────────────────────

  describe('初期走査', () => {
    it('start() で vault 内全 Markdown を索引化する', async () => {
      const fileA = new TFile('a.md')
      const fileB = new TFile('b.md')
      app.vault.getMarkdownFiles.mockReturnValue([fileA, fileB])
      app.vault.read
        .mockResolvedValueOnce(MD_A)
        .mockResolvedValueOnce(MD_B)

      index = makeIndex(app)
      await index.start()

      expect(index.getDocument('a.md')).toBeDefined()
      expect(index.getDocument('b.md')).toBeDefined()
      expect(index.getDocument('unknown.md')).toBeUndefined()
    })

    it('start() 後に getAllTaskNodes がスコープ内全タスクを返す', async () => {
      const fileA = new TFile('a.md')
      const fileB = new TFile('b.md')
      app.vault.getMarkdownFiles.mockReturnValue([fileA, fileB])
      app.vault.read
        .mockResolvedValueOnce(MD_A)
        .mockResolvedValueOnce(MD_B)

      index = makeIndex(app)
      await index.start()

      const tasks = index.getAllTaskNodes()
      expect(tasks.length).toBeGreaterThanOrEqual(4) // A1, A2, B1, B2
      expect(tasks.every(t => t.node.type === 'task')).toBe(true)
      expect(tasks.some(t => t.path === 'a.md')).toBe(true)
      expect(tasks.some(t => t.path === 'b.md')).toBe(true)
    })

    it('.md 以外のファイルは索引化しない', async () => {
      const mdFile = new TFile('notes.md')
      const imgFile = new TFile('image.png')
      app.vault.getMarkdownFiles.mockReturnValue([mdFile]) // getMarkdownFiles は .md のみ返す
      app.vault.read.mockResolvedValue(MD_A)

      index = makeIndex(app)
      await index.start()

      expect(index.getDocument('notes.md')).toBeDefined()
      expect(index.getDocument('image.png')).toBeUndefined()
    })
  })

  // ── 差分更新 ─────────────────────────────────────────

  describe('差分更新（変更ファイルのみ再パース）', () => {
    it('modify イベントで変更ファイルのみ Document が更新される', async () => {
      const fileA = new TFile('a.md')
      const fileB = new TFile('b.md')
      app.vault.getMarkdownFiles.mockReturnValue([fileA, fileB])
      app.vault.read
        .mockResolvedValueOnce(MD_A)
        .mockResolvedValueOnce(MD_B)

      index = makeIndex(app)
      await index.start()

      const docBBefore = index.getDocument('b.md')

      // a.md を変更する
      const updatedA = `# 更新A\n\n- [ ] 新タスク\n`
      app.vault.read.mockResolvedValueOnce(updatedA)

      const modifyHandler = getVaultHandler(app, 'modify')!
      modifyHandler(fileA)
      await vi.waitFor(() => {
        expect(index.getDocument('a.md')?.sections[0].title).toBe('更新A')
      })

      // b.md の Document 参照は同一オブジェクトのまま（再パースされていない）
      expect(index.getDocument('b.md')).toBe(docBBefore)
    })

    it('onChange コールバックが modify 後に発火する', async () => {
      const fileA = new TFile('a.md')
      app.vault.getMarkdownFiles.mockReturnValue([fileA])
      app.vault.read
        .mockResolvedValueOnce(MD_A)
        .mockResolvedValueOnce('# 更新\n')

      index = makeIndex(app)
      await index.start()

      const onChange = vi.fn()
      index.onChange(onChange)

      const modifyHandler = getVaultHandler(app, 'modify')!
      modifyHandler(fileA)
      await vi.waitFor(() => {
        expect(onChange).toHaveBeenCalled()
      })
    })

    it('onChange の解除関数で購読を解除できる', async () => {
      const fileA = new TFile('a.md')
      app.vault.getMarkdownFiles.mockReturnValue([fileA])
      app.vault.read
        .mockResolvedValueOnce(MD_A)
        .mockResolvedValueOnce('# 更新\n')

      index = makeIndex(app)
      await index.start()

      const onChange = vi.fn()
      const unsubscribe = index.onChange(onChange)
      unsubscribe()

      const modifyHandler = getVaultHandler(app, 'modify')!
      modifyHandler(fileA)
      await new Promise(r => setTimeout(r, 20))

      expect(onChange).not.toHaveBeenCalled()
    })
  })

  // ── create / delete / rename ──────────────────────────

  describe('create イベント', () => {
    it('create で新ファイルが索引に追加される', async () => {
      app.vault.getMarkdownFiles.mockReturnValue([])
      index = makeIndex(app)
      await index.start()

      const newFile = new TFile('new.md')
      app.vault.read.mockResolvedValue(MD_B)

      const createHandler = getVaultHandler(app, 'create')!
      createHandler(newFile)
      await vi.waitFor(() => {
        expect(index.getDocument('new.md')).toBeDefined()
      })
    })
  })

  describe('delete イベント', () => {
    it('delete でエントリが索引から削除される', async () => {
      const fileA = new TFile('a.md')
      app.vault.getMarkdownFiles.mockReturnValue([fileA])
      app.vault.read.mockResolvedValue(MD_A)

      index = makeIndex(app)
      await index.start()
      expect(index.getDocument('a.md')).toBeDefined()

      const onChange = vi.fn()
      index.onChange(onChange)

      const deleteHandler = getVaultHandler(app, 'delete')!
      deleteHandler(fileA)

      expect(index.getDocument('a.md')).toBeUndefined()
      expect(onChange).toHaveBeenCalled()
    })
  })

  describe('rename イベント', () => {
    it('rename で旧パスが削除され新パスが追加される', async () => {
      const fileA = new TFile('old.md')
      app.vault.getMarkdownFiles.mockReturnValue([fileA])
      app.vault.read
        .mockResolvedValueOnce(MD_A)  // 初期走査
        .mockResolvedValueOnce(MD_A)  // rename 後の再パース

      index = makeIndex(app)
      await index.start()
      expect(index.getDocument('old.md')).toBeDefined()

      const renamedFile = new TFile('new.md')
      const renameHandler = getVaultHandler(app, 'rename')!
      renameHandler(renamedFile, 'old.md')
      await vi.waitFor(() => {
        expect(index.getDocument('new.md')).toBeDefined()
      })

      expect(index.getDocument('old.md')).toBeUndefined()
    })
  })

  // ── resolveLine ───────────────────────────────────────

  describe('resolveLine', () => {
    it('有効な (path, nodeId) で 0-based 行番号を返す', async () => {
      const fileA = new TFile('a.md')
      app.vault.getMarkdownFiles.mockReturnValue([fileA])
      app.vault.read.mockResolvedValue(MD_A)

      index = makeIndex(app)
      await index.start()

      const tasks = index.getAllTaskNodes()
      const entry = tasks.find(t => t.path === 'a.md')
      expect(entry).toBeDefined()

      const line = index.resolveLine('a.md', entry!.node.id)
      expect(typeof line).toBe('number')
      expect(line!).toBeGreaterThanOrEqual(0)
    })

    it('存在しない path は undefined を返す', async () => {
      app.vault.getMarkdownFiles.mockReturnValue([])
      index = makeIndex(app)
      await index.start()

      expect(index.resolveLine('missing.md', 'any-id')).toBeUndefined()
    })

    it('存在しない nodeId は undefined を返す', async () => {
      const fileA = new TFile('a.md')
      app.vault.getMarkdownFiles.mockReturnValue([fileA])
      app.vault.read.mockResolvedValue(MD_A)

      index = makeIndex(app)
      await index.start()

      expect(index.resolveLine('a.md', 'no-such-node')).toBeUndefined()
    })
  })

  // ── スコープ ──────────────────────────────────────────

  describe('スコープ別列挙', () => {
    async function setupTwoFiles() {
      const fileA = new TFile('folder/a.md')
      const fileB = new TFile('other/b.md')
      app.vault.getMarkdownFiles.mockReturnValue([fileA, fileB])
      app.vault.read
        .mockResolvedValueOnce(MD_A)
        .mockResolvedValueOnce(MD_B)
      return { fileA, fileB }
    }

    it('vault スコープで全ファイルを返す', async () => {
      await setupTwoFiles()
      index = makeIndex(app, { scope: 'vault' })
      await index.start()

      const docs = index.getDocuments('vault')
      expect(docs.size).toBe(2)
    })

    it('folder スコープで指定フォルダ内のみ返す', async () => {
      await setupTwoFiles()
      index = makeIndex(app, { scope: 'folder', scopeFolder: 'folder/' })
      await index.start()

      const docs = index.getDocuments('folder')
      expect(docs.has('folder/a.md')).toBe(true)
      expect(docs.has('other/b.md')).toBe(false)
    })

    it('folder スコープ外のファイルは getAllTaskNodes に含まれない', async () => {
      await setupTwoFiles()
      index = makeIndex(app, { scope: 'folder', scopeFolder: 'folder/' })
      await index.start()

      const tasks = index.getAllTaskNodes()
      expect(tasks.every(t => t.path.startsWith('folder/'))).toBe(true)
    })

    it('current-file スコープで setCurrentFilePath に一致するファイルのみ返す', async () => {
      await setupTwoFiles()
      index = makeIndex(app, { scope: 'current-file' })
      index.setCurrentFilePath('folder/a.md')
      await index.start()

      const docs = index.getDocuments('current-file')
      expect(docs.has('folder/a.md')).toBe(true)
      expect(docs.has('other/b.md')).toBe(false)
    })
  })

  // ── stop / イベント解除 ───────────────────────────────

  describe('stop()', () => {
    it('stop() で vault イベントが解除される', async () => {
      app.vault.getMarkdownFiles.mockReturnValue([])
      index = makeIndex(app)
      await index.start()
      index.stop()

      expect(app.vault.off).toHaveBeenCalledWith('modify', expect.any(Function))
      expect(app.vault.off).toHaveBeenCalledWith('create', expect.any(Function))
      expect(app.vault.off).toHaveBeenCalledWith('delete', expect.any(Function))
      expect(app.vault.off).toHaveBeenCalledWith('rename', expect.any(Function))
    })
  })
})

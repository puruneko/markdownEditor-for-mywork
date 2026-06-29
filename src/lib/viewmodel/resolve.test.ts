import { describe, it, expect, vi } from 'vitest'
import { resolveRef, patchInFile } from './resolve'
import { makeGlobalKey } from './global-key'
import { parseMarkdown } from '../parser/parse-markdown'

// ----------------------------------------------------------------
// AstIndex モック
// ----------------------------------------------------------------

function makeMockIndex(docs: Record<string, string>): any {
  const parsed = Object.fromEntries(
    Object.entries(docs).map(([path, md]) => [path, parseMarkdown(md)])
  )
  return {
    getDocument: (path: string) => parsed[path] ?? undefined,
  }
}

// ----------------------------------------------------------------
// resolveRef
// ----------------------------------------------------------------

describe('resolveRef', () => {
  const MD = '- [ ] タスクA\n- [x] タスクB\n'

  it('globalKey から正しいノードを解決する', () => {
    const doc = parseMarkdown(MD)
    const localId = doc.sections[0].children[0].id
    const globalKey = makeGlobalKey('note.md', localId)
    const index = makeMockIndex({ 'note.md': MD })

    const result = resolveRef(index, globalKey)
    expect(result).toBeDefined()
    expect(result!.filePath).toBe('note.md')
    expect(result!.localId).toBe(localId)
    expect(result!.node.text).toBe('タスクA')
  })

  it('存在しないファイルパスは undefined を返す', () => {
    const index = makeMockIndex({ 'note.md': MD })
    const globalKey = makeGlobalKey('missing.md', 's1.n0')
    expect(resolveRef(index, globalKey)).toBeUndefined()
  })

  it('存在しない localId は undefined を返す', () => {
    const index = makeMockIndex({ 'note.md': MD })
    const globalKey = makeGlobalKey('note.md', 'nonexistent')
    expect(resolveRef(index, globalKey)).toBeUndefined()
  })

  it('2ファイルがある場合に正しいファイルのノードを解決する', () => {
    const mdA = '- [ ] タスクA\n'
    const mdB = '- [ ] タスクB\n'
    const docA = parseMarkdown(mdA)
    const docB = parseMarkdown(mdB)
    const idA = docA.sections[0].children[0].id
    const idB = docB.sections[0].children[0].id

    const index = makeMockIndex({ 'fileA.md': mdA, 'fileB.md': mdB })

    const refA = resolveRef(index, makeGlobalKey('fileA.md', idA))
    const refB = resolveRef(index, makeGlobalKey('fileB.md', idB))

    expect(refA?.node.text).toBe('タスクA')
    expect(refB?.node.text).toBe('タスクB')
  })
})

// ----------------------------------------------------------------
// patchInFile
// ----------------------------------------------------------------

describe('patchInFile', () => {
  const MD = '- [ ] タスクA\n'

  it('該当ファイルを読み取り patcher を適用して書き戻す', async () => {
    const doc = parseMarkdown(MD)
    const localId = doc.sections[0].children[0].id
    const globalKey = makeGlobalKey('note.md', localId)
    const index = makeMockIndex({ 'note.md': MD })

    const readFile = vi.fn().mockResolvedValue(MD)
    const writeFile = vi.fn().mockResolvedValue(undefined)
    const patcher = vi.fn((_md: string, _doc: any, _node: any) => '- [x] タスクA\n')

    await patchInFile(index, globalKey, readFile, writeFile, patcher)

    expect(readFile).toHaveBeenCalledWith('note.md')
    expect(patcher).toHaveBeenCalledWith(MD, doc, expect.objectContaining({ text: 'タスクA' }))
    expect(writeFile).toHaveBeenCalledWith('note.md', '- [x] タスクA\n')
  })

  it('patcher が同じ内容を返した場合は writeFile を呼ばない', async () => {
    const doc = parseMarkdown(MD)
    const localId = doc.sections[0].children[0].id
    const globalKey = makeGlobalKey('note.md', localId)
    const index = makeMockIndex({ 'note.md': MD })

    const readFile = vi.fn().mockResolvedValue(MD)
    const writeFile = vi.fn()
    // patcher が md をそのまま返す
    await patchInFile(index, globalKey, readFile, writeFile, (md) => md)

    expect(writeFile).not.toHaveBeenCalled()
  })

  it('存在しないファイルの場合は何もしない', async () => {
    const index = makeMockIndex({})
    const globalKey = makeGlobalKey('missing.md', 's1.n0')
    const readFile = vi.fn()
    const writeFile = vi.fn()

    await patchInFile(index, globalKey, readFile, writeFile, (md) => md)

    expect(readFile).not.toHaveBeenCalled()
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('他ファイルを書き換えない（globalKey が指すファイルのみ変更）', async () => {
    const mdA = '- [ ] タスクA\n'
    const mdB = '- [ ] タスクB\n'
    const docA = parseMarkdown(mdA)
    const idA = docA.sections[0].children[0].id

    const index = makeMockIndex({ 'fileA.md': mdA, 'fileB.md': mdB })
    const readFile = vi.fn().mockImplementation((path: string) =>
      Promise.resolve(path === 'fileA.md' ? mdA : mdB)
    )
    const writeFile = vi.fn().mockResolvedValue(undefined)

    await patchInFile(
      index,
      makeGlobalKey('fileA.md', idA),
      readFile,
      writeFile,
      (md) => md.replace('タスクA', '完了A'),
    )

    // fileA.md だけが書き換えられる
    expect(writeFile).toHaveBeenCalledTimes(1)
    expect(writeFile).toHaveBeenCalledWith('fileA.md', '- [ ] 完了A\n')
  })
})

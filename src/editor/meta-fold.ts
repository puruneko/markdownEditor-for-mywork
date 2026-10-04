/**
 * issue-phase017-markdownEditor-for-mywork-003: タスクのメタ情報ブロックの折りたたみ。
 *
 * issue-phase018-003: メタ項目（子行を持つメタ行）ごとに、`@key` 直後の小ボタンで子行を隠す。
 * 隠すのは表示上の装飾だけで、Markdown 本文は変更しない（効果のみのトランザクションなので
 * undo 履歴にも残らない）。状態は保存しない。
 */
import { Decoration, EditorView, WidgetType } from '@codemirror/view'
import type { DecorationSet } from '@codemirror/view'
import { EditorState, StateEffect, StateField } from '@codemirror/state'
import type { Extension, Range } from '@codemirror/state'

// metatag-decoration.ts の META_LINE_RE と同じ判定（あちらは obsidian に依存するため複製）。
const META_LINE_RE = /^(\s*- )@([\p{L}\p{N}_]+)(\?)?(?::(.*))?$/u
const TASK_LINE_RE = /^(\s*)- \[.\] /

function getIndent(text: string): number {
  return text.length - text.trimStart().length
}

export interface MetaItemBlock {
  /** メタ行の0始まり行番号 */
  metaLine: number
  /** メタ行内の `@key`（`?` を含む）直後の文字位置（行頭からのオフセット） */
  keyEnd: number
  /** 最初の子行（0始まり） */
  firstChildLine: number
  /** 最後の子行（0始まり、含む） */
  lastChildLine: number
}

/** タスク配下のメタ行のうち、より深いインデントの子行を持つもの（折りたたみ対象）を検出する（純粋関数）。 */
export function findFoldableMetaItems(lines: string[]): MetaItemBlock[] {
  const items: MetaItemBlock[] = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(META_LINE_RE)
    if (!m) continue
    const indent = getIndent(lines[i])
    // 直近の浅いインデントの行がタスク行（またはメタ行）でなければタスク配下ではない。
    let parent = -1
    for (let j = i - 1; j >= 0; j--) {
      if (lines[j].trim() === '') continue
      if (getIndent(lines[j]) < indent) {
        parent = j
        break
      }
    }
    if (parent < 0 || !(TASK_LINE_RE.test(lines[parent]) || META_LINE_RE.test(lines[parent]))) continue
    let last = -1
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() === '' || getIndent(lines[j]) <= indent) break
      last = j
    }
    if (last < 0) continue
    items.push({
      metaLine: i,
      keyEnd: m[1].length + 1 + m[2].length + (m[3] ? 1 : 0),
      firstChildLine: i + 1,
      lastChildLine: last,
    })
  }
  return items
}

export const toggleMetaFold = StateEffect.define<number>() // メタ行の行頭位置
export const foldAllMeta = StateEffect.define<null>()
export const unfoldAllMeta = StateEffect.define<null>()

function itemsOf(state: EditorState): MetaItemBlock[] {
  const lines: string[] = []
  for (let n = 1; n <= state.doc.lines; n++) lines.push(state.doc.line(n).text)
  return findFoldableMetaItems(lines)
}

/** 隠す範囲: メタ行の行末〜最後の子行の行末。 */
function hiddenRange(state: EditorState, b: MetaItemBlock): { from: number; to: number } {
  return { from: state.doc.line(b.metaLine + 1).to, to: state.doc.line(b.lastChildLine + 1).to }
}

/** 折りたたみ中のメタ行の行頭位置の配列。 */
export const metaFoldField = StateField.define<number[]>({
  create: () => [],
  update(value, tr) {
    let folded = tr.docChanged ? value.map((p) => tr.changes.mapPos(p)) : value
    const items = itemsOf(tr.state)
    const byPos = new Map(items.map((b) => [tr.state.doc.line(b.metaLine + 1).from, b]))
    for (const e of tr.effects) {
      if (e.is(toggleMetaFold)) {
        folded = folded.includes(e.value) ? folded.filter((p) => p !== e.value) : [...folded, e.value]
      } else if (e.is(foldAllMeta)) {
        folded = [...byPos.keys()]
      } else if (e.is(unfoldAllMeta)) {
        folded = []
      }
    }
    // 子行を持たなくなった位置は捨てる。カーソルが隠れた範囲に入ったら自動で展開する。
    const head = tr.state.selection.main.head
    return [...new Set(folded)].filter((p) => {
      const b = byPos.get(p)
      if (!b) return false
      const r = hiddenRange(tr.state, b)
      return !(head > r.from && head <= r.to)
    })
  },
})

class ToggleWidget extends WidgetType {
  constructor(
    private readonly metaPos: number,
    private readonly folded: boolean,
  ) {
    super()
  }
  eq(other: ToggleWidget): boolean {
    return other.metaPos === this.metaPos && other.folded === this.folded
  }
  toDOM(view: EditorView): HTMLElement {
    const el = document.createElement('span')
    el.className = 'metatag-fold-toggle'
    el.textContent = this.folded ? '▸' : '▾'
    el.setAttribute('role', 'button')
    el.addEventListener('mousedown', (e) => {
      e.preventDefault()
      view.dispatch({ effects: toggleMetaFold.of(this.metaPos) })
    })
    return el
  }
  ignoreEvent(): boolean {
    return false
  }
}

function buildDecorations(state: EditorState): DecorationSet {
  const folded = new Set(state.field(metaFoldField))
  const ranges: Range<Decoration>[] = []
  for (const b of itemsOf(state)) {
    const line = state.doc.line(b.metaLine + 1)
    const isFolded = folded.has(line.from)
    ranges.push(Decoration.widget({ widget: new ToggleWidget(line.from, isFolded), side: 1 }).range(line.from + b.keyEnd))
    if (isFolded) {
      const r = hiddenRange(state, b)
      ranges.push(Decoration.replace({}).range(r.from, r.to))
    }
  }
  return Decoration.set(ranges, true)
}

const metaFoldDecorations = StateField.define<DecorationSet>({
  create: (state) => buildDecorations(state),
  update(value, tr) {
    const touched = tr.docChanged || tr.selection || tr.effects.some((e) => e.is(toggleMetaFold) || e.is(foldAllMeta) || e.is(unfoldAllMeta))
    return touched ? buildDecorations(tr.state) : value
  },
  provide: (f) => EditorView.decorations.from(f),
})

export function createMetaFoldExtension(): Extension {
  return [metaFoldField, metaFoldDecorations]
}

/** カーソルがメタ行ならそのメタ項目、子行ならその親メタ項目を折りたたむ/展開する。 */
export function toggleMetaFoldAtCursor(view: EditorView): boolean {
  const state = view.state
  const cursorLine = state.doc.lineAt(state.selection.main.head).number - 1
  const hit = itemsOf(state).find((b) => cursorLine >= b.metaLine && cursorLine <= b.lastChildLine)
  if (!hit) return false
  view.dispatch({ effects: toggleMetaFold.of(state.doc.line(hit.metaLine + 1).from) })
  return true
}

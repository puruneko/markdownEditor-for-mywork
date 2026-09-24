import { ViewPlugin, Decoration, WidgetType } from '@codemirror/view'
import type { DecorationSet, EditorView, ViewUpdate } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { normalizeMetaKey } from '../lib/parser/meta-keys'

// ----------------------------------------------------------------
// Status marker patterns
// ----------------------------------------------------------------

const STATUS_MARK: Record<string, string> = {
  '?': 'task-status-planning',
  ' ': 'task-status-todo',
  'x': 'task-status-done',
  'X': 'task-status-done',
  '>': 'task-status-doing',
  '!': 'task-status-blocked',
  '/': 'task-status-deferred',
  '-': 'task-status-hold',
}

// キー部分は Unicode 文字クラスで日本語キー（`@実施日時:` 等）にも対応する（issue-phase005-001）。
// remark-meta-fields.ts の META_LINE_RE と同じ考え方だが、ここでは装飾のみが目的のため、
// 既知キーへの正規化は行わず「@<何か>:」の形であれば一律で装飾する。
const META_RE = /^(\s*- )@([\p{L}\p{N}_]+)(\?)?:/u

// ----------------------------------------------------------------
// Build decorations for visible lines
// ----------------------------------------------------------------

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = view.state.doc

  for (const { from, to } of view.visibleRanges) {
    let pos = from
    while (pos <= to) {
      const line = doc.lineAt(pos)
      const text = line.text

      // ブロッククォート内はタスクハイライトを適用しない。
      const trimmed = text.trimStart()
      if (!trimmed.startsWith('>')) {
        // Check for task status marker: "- [x] " pattern
        const taskMatch = text.match(/^(\s*- \[)([xX>!\-?/ ])(\] )/)
        if (taskMatch) {
          const markerChar = taskMatch[2]
          const cls = STATUS_MARK[markerChar]
          if (cls) {
            const markerStart = line.from + text.indexOf('- [')
            // Decorate the entire task line
            builder.add(
              line.from,
              line.to,
              Decoration.mark({ class: `md-ast-${cls}` }),
            )
          }
        }

        // Check for meta key: @schedule: @due: @plan: etc. (optionally with `?` — tentative).
        const metaMatch = text.match(META_RE)
        if (metaMatch) {
          const key = metaMatch[2]
          const tentative = !!metaMatch[3]
          const keyStart = line.from + text.indexOf('@')
          const keyEnd = keyStart + `@${key}${metaMatch[3] ?? ''}:`.length
          const classes = ['md-ast-meta-key']
          if (key === 'plan' || key === '想定期間') classes.push('md-ast-meta-key--plan')
          if (tentative) classes.push('md-ast-meta-tentative')
          // issue-phase003-008（2026-09-17増分）: 全メタキー共通の「メタタグ」視覚装飾クラス。
          // 未知キーは metatag-unknown とし、生の（日本語を含む）キー文字列をクラス名化しない。
          const canonicalKey = normalizeMetaKey(key) ?? 'unknown'
          classes.push('metatag', 'metatag-key', `metatag-${canonicalKey}`)
          if (tentative) classes.push('metatag-tentative')
          builder.add(
            keyStart,
            keyEnd,
            Decoration.mark({ class: classes.join(' ') }),
          )
        }
      }

      pos = line.to + 1
    }
  }

  return builder.finish()
}

// ----------------------------------------------------------------
// ViewPlugin
// ----------------------------------------------------------------

export const taskDecorationPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  { decorations: (v) => v.decorations },
)

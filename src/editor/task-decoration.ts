import { ViewPlugin, Decoration, WidgetType } from '@codemirror/view'
import type { DecorationSet, EditorView, ViewUpdate } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

// ----------------------------------------------------------------
// Status marker patterns
// ----------------------------------------------------------------

const STATUS_MARK: Record<string, string> = {
  ' ': 'task-status-todo',
  'x': 'task-status-done',
  'X': 'task-status-done',
  '>': 'task-status-doing',
  '!': 'task-status-blocked',
  '-': 'task-status-hold',
}

const META_RE = /^(\s*- )@(plan|schedule|due|priority|tags|dependsOn)(\?)?:/

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
        const taskMatch = text.match(/^(\s*- \[)([xX>!\- ])(\] )/)
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
          if (key === 'plan') classes.push('md-ast-meta-key--plan')
          if (tentative) classes.push('md-ast-meta-tentative')
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

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import type { Root } from 'mdast'
import type { Document } from './types'
import remarkTaskStatus from './plugins/remark-task-status'
import remarkMetaFields from './plugins/remark-meta-fields'
import { buildSectionsFromRoot } from './mdast-to-sections'

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkTaskStatus)
  .use(remarkMetaFields)

// Strip common leading indent so that tab-indented top-level list items
// (e.g. user accidentally pressed Tab before the first item in Obsidian)
// are not misidentified as indented code blocks by CommonMark parser.
function stripCommonIndent(markdown: string): string {
  const lines = markdown.split('\n')
  let minIndent = Infinity
  for (const line of lines) {
    if (line.trim() === '') continue
    const m = line.match(/^(\s*)/)
    const len = m ? m[1].replace(/\t/g, '    ').length : 0
    if (len < minIndent) minIndent = len
  }
  if (minIndent === 0 || minIndent === Infinity) return markdown
  // Strip exactly minIndent spaces (converting leading tabs to spaces first)
  return lines
    .map(line => {
      const expanded = line.replace(/^(\t*)/, (_, tabs: string) => '    '.repeat(tabs.length))
      return expanded.slice(minIndent)
    })
    .join('\n')
}

export function parseMarkdown(markdown: string): Document {
  const normalized = stripCommonIndent(markdown)
  const root = processor.parse(normalized) as Root
  processor.runSync(root)
  const { sections, nodeLineMap } = buildSectionsFromRoot(root)
  return { type: 'document', sections, nodeLineMap }
}

import { parseMarkdown } from './parser/parse-markdown'

export interface MarkdownSource {
  path: string
  doc: ReturnType<typeof parseMarkdown>
}

export function src(md: string, path = 'test.md'): MarkdownSource[] {
  return [{ path, doc: parseMarkdown(md) }]
}

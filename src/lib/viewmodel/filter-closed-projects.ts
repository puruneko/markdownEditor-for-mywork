import type { Document, Section } from '../parser/types'
import type { SourceEntry } from './contract'

/**
 * `close: true` の Section（サブセクション含め任意の深さ）を、その配下（children・
 * subSections）ごと除外する。パース結果（Document 自体）は変更しない。ホストの投影処理
 * の手前で一度だけ呼び、全投影（calendar/gantt/kanban/dashboard）がこの出力を使う
 * （issue-phase010-markdownEditor-007。DEC-05: 各ライブラリ側に `close` を渡して
 * 個別に除外させない）。
 */
function filterSection(section: Section): Section | null {
  if (section.close) return null

  let subSectionsChanged = false
  const subSections: Section[] = []
  for (const sub of section.subSections) {
    const filtered = filterSection(sub)
    if (filtered !== sub) subSectionsChanged = true
    if (filtered !== null) subSections.push(filtered)
  }

  if (!subSectionsChanged) return section
  return { ...section, subSections }
}

/** ホストの投影処理の手前で一度だけ適用する、クローズ案件の除外フィルタ。 */
export function filterClosedProjects(sources: SourceEntry[]): SourceEntry[] {
  return sources.map((source) => {
    const { doc } = source
    let sectionsChanged = false
    const sections: Section[] = []
    for (const section of doc.sections) {
      const filtered = filterSection(section)
      if (filtered !== section) sectionsChanged = true
      if (filtered !== null) sections.push(filtered)
    }

    if (!sectionsChanged) return source
    const filteredDoc: Document = { ...doc, sections }
    return { path: source.path, doc: filteredDoc }
  })
}

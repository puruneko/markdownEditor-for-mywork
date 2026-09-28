/**
 * issue-phase003-008（2026-09-17増分）: 全メタキーの「メタタグ」値装飾。
 *
 * - 日付系（@plan/@schedule/@due）: Live Preview（wysiwyg）かつカーソルが当該行に
 *   重なっていない場合のみ、値を人間可読な「メタタグ表示」チップへ置換する（Decoration.replace）。
 *   それ以外（Source Mode・カーソルが行に重なる）は生テキストへの色付け（Decoration.mark）に留める。
 * - 日付系以外: 常に Decoration.mark で緑系の装飾を与える（＠記号は消さず、そのまま表示する。
 *   issue-phase011-markdownEditor-002 で一時的に＠を非表示にしたが、issue-phase012-markdownEditor-005
 *   でユーザーの要望「＠は消さないで」により、この非表示化は取り消された）。
 * - メタ行（コロン付き `@key: value` だけでなく、コロンなしの裸の `@key` も含む）の直下の
 *   ネスト全体（インデントが深い間の子孫行すべて）を「そのメタタグに属する」ものとして同じ
 *   クラスで装飾する（issue-phase003-008 2026-09-17 再々増分: `@memo` の下に平文の子リストが
 *   ある場合等、どこまでがメタ情報なのかエディタ上で直感的にわかるようにするため）。
 *
 * キー部分（`@key:`、コロン付き）自体の装飾は既存 src/editor/task-decoration.ts が担う
 * （後方互換のため既存クラスはそちらに残し、metatag系クラスのみ本ファイルと分担する）。
 * コロンなしの裸のキー（`@memo` 等）は task-decoration.ts の正規表現にマッチしないため、
 * そのキー部分の装飾は本ファイルが担う。
 */
import { ViewPlugin, Decoration, WidgetType } from '@codemirror/view'
import type { DecorationSet, EditorView, ViewUpdate } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { editorLivePreviewField } from 'obsidian'
import { normalizeMetaKey } from '../lib/parser/meta-keys'
import { formatMetaDateValue, isDateMetaKey } from '../lib/format/metatag-format'
import type { DateMetaKey } from '../lib/format/metatag-format'
import { openMetaPicker, type MetaPickerTarget } from './metatag-picker'

// コロンは任意（`@key: value` と、コロンなしの裸の `@key` の両方にマッチする）。
// コロンがある場合のみ group4（値）が定義される（空文字列 = 値なしのコロン付き）。
const META_LINE_RE = /^(\s*- )@([\p{L}\p{N}_]+)(\?)?(?::(.*))?$/u

function getIndent(text: string): number {
  return text.length - text.trimStart().length
}

class MetaDateChipWidget extends WidgetType {
  constructor(
    private readonly key: DateMetaKey,
    private readonly value: string,
    private readonly tentative: boolean,
    private readonly target: MetaPickerTarget,
  ) {
    super()
  }

  eq(other: MetaDateChipWidget): boolean {
    return (
      other.key === this.key &&
      other.value === this.value &&
      other.tentative === this.tentative &&
      other.target.from === this.target.from &&
      other.target.to === this.target.to
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const span = document.createElement('span')
    // 後方互換: この widget は元々 task-decoration.ts の Decoration.mark（`.md-ast-meta-key` 等）
    // が付いていた範囲を丸ごと Decoration.replace で置き換えるため、既存クラスをここにも
    // 引き継ぐ（tests/obs-e2e/task-decoration.e2e.ts が依存する）。
    const legacyClasses = ['md-ast-meta-key']
    if (this.key === 'plan') legacyClasses.push('md-ast-meta-key--plan')
    if (this.tentative) legacyClasses.push('md-ast-meta-tentative')
    span.className = `${legacyClasses.join(' ')} metatag metatag-value metatag-${this.key} metatag-date-chip${
      this.tentative ? ' metatag-tentative' : ''
    }`
    const labelByKey: Record<DateMetaKey, string> = { plan: '計画', schedule: '予定', due: '期限' }
    const formatted = formatMetaDateValue(this.value)
    span.textContent = `${labelByKey[this.key]}: ${formatted}${this.tentative ? ' ?' : ''}`
    span.setAttribute('role', 'button')
    span.tabIndex = 0
    const target = this.target
    span.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      view.dispatch({ effects: openMetaPicker.of(target) })
    })
    return span
  }

  ignoreEvent(): boolean {
    return false
  }
}

function buildValueDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = view.state.doc
  const livePreview = view.state.field(editorLivePreviewField, false)
  const selection = view.state.selection

  // 直近に見つかったメタ行の「ネスト対象領域」。このメタ行より深いインデントの子孫行を
  // すべて同じメタタグとして装飾する。コロンの有無・値の有無を問わず、メタ行を見つけた
  // 時点で必ずセットする（issue-phase003-008 2026-09-17再々増分）。
  let metaNestRegion: { key: string; indent: number } | null = null

  for (const { from, to } of view.visibleRanges) {
    let pos = from
    while (pos <= to) {
      const line = doc.lineAt(pos)
      const text = line.text
      const trimmed = text.trimStart()

      if (trimmed.startsWith('>')) {
        pos = line.to + 1
        continue
      }

      if (metaNestRegion) {
        const indent = getIndent(text)
        if (trimmed === '') {
          // 空行はスキップ（領域は継続）。
        } else if (indent > metaNestRegion.indent) {
          // 箇条書きマーカー（`- `）自体は装飾対象に含めず、実際のテキスト内容のみを対象にする。
          const bulletMatch = trimmed.match(/^-\s+/)
          const contentStart = line.from + indent + (bulletMatch ? bulletMatch[0].length : 0)
          if (contentStart < line.to) {
            builder.add(
              contentStart,
              line.to,
              Decoration.mark({ class: `metatag metatag-value metatag-${metaNestRegion.key}` }),
            )
          }
        } else {
          metaNestRegion = null
        }
      }

      const match = text.match(META_LINE_RE)
      if (match) {
        const [, , rawKey, qMark, restRaw] = match
        const hasColon = restRaw !== undefined
        const atIdx = text.indexOf('@')
        const keyStart = line.from + atIdx
        const keyNameEnd = keyStart + 1 + rawKey.length
        const colonPos = keyNameEnd + (qMark ? 1 : 0)

        const canonicalKey = normalizeMetaKey(rawKey) ?? 'unknown'
        const tentative = !!qMark

        if (hasColon) {
          const valueLeadingSpace = restRaw.length - restRaw.trimStart().length
          const valueEndTrimLength = restRaw.trimEnd().length
          const valueStart = colonPos + 1 + valueLeadingSpace
          const valueEnd = colonPos + 1 + valueEndTrimLength
          const valueText = valueEnd > valueStart ? doc.sliceString(valueStart, valueEnd) : ''

          if (valueText.length > 0) {
            if (isDateMetaKey(canonicalKey)) {
              const replaceFrom = keyStart
              const replaceTo = line.to
              const overlapsSelection = selection.ranges.some(
                (r) => r.to >= replaceFrom && r.from <= replaceTo,
              )
              if (livePreview && !overlapsSelection) {
                const target: MetaPickerTarget = {
                  from: keyNameEnd,
                  to: line.to,
                  lineFrom: line.from,
                  key: canonicalKey,
                  initialValue: valueText,
                  initialTentative: tentative,
                  mode: 'edit',
                }
                builder.add(
                  replaceFrom,
                  replaceTo,
                  Decoration.replace({
                    widget: new MetaDateChipWidget(canonicalKey, valueText, tentative, target),
                  }),
                )
              } else {
                builder.add(
                  valueStart,
                  valueEnd,
                  Decoration.mark({
                    class: `metatag metatag-value metatag-${canonicalKey}${tentative ? ' metatag-tentative' : ''}`,
                  }),
                )
              }
            } else {
              builder.add(
                valueStart,
                valueEnd,
                Decoration.mark({
                  class: `metatag metatag-value metatag-${canonicalKey}${tentative ? ' metatag-tentative' : ''}`,
                }),
              )
            }
          }
        } else {
          // コロンなしの裸のメタキー（例: `@memo`）。task-decoration.ts の正規表現はコロン必須
          // のためここでキー部分自体を装飾する。
          builder.add(
            keyStart,
            colonPos,
            Decoration.mark({
              class: `metatag metatag-key metatag-${canonicalKey}${tentative ? ' metatag-tentative' : ''}`,
            }),
          )
        }

        // コロンの有無・値の有無を問わず、このメタ行より深い子孫行すべてを装飾対象にする。
        metaNestRegion = { key: canonicalKey, indent: getIndent(text) }
      }

      pos = line.to + 1
    }
  }

  return builder.finish()
}

/**
 * 指定行が「日付系メタキー直後・値が空」（`@plan:` 等、コロンで終わる裸のキー行）に一致する
 * 場合、insertモードの日付ピッカーを開く。一致しなければ何もしない（呼び出し側で事前チェック
 * 済みかどうかによらず安全に呼べる）。
 *
 * issue-phase013-markdownEditor-002: リスト先頭の「@」サジェストで`@plan:`等を一括挿入した
 * 直後にもピッカーを開けるよう、`maybeAutoOpenPicker`からこの起動処理をexport関数として
 * 切り出した。
 */
export function openDatePickerForLine(view: EditorView, lineFrom: number): void {
  if (!view.dom.isConnected) return
  if (lineFrom > view.state.doc.length) return
  const line = view.state.doc.lineAt(lineFrom)
  const m = line.text.match(/^(\s*- )@(plan|schedule|due)(\?)?:$/)
  if (!m) return
  const key = m[2] as DateMetaKey
  const tentative = !!m[3]
  // キー名直後（`?`/コロンの前）の位置。コミット時に `?:`/`:` ごと書き換えるための置換開始位置。
  const keyNameEndOffset = m[1].length + 1 + key.length

  view.dispatch({
    effects: openMetaPicker.of({
      from: line.from + keyNameEndOffset,
      to: line.to,
      lineFrom: line.from,
      key,
      initialValue: '',
      initialTentative: tentative,
      mode: 'insert',
    }),
  })
}

/** 挿入された1文字が ':' で、行が「日付系メタキー確定直後・値が空」に一致する場合のみ発火する。 */
function maybeAutoOpenPicker(update: ViewUpdate): void {
  let triggeredPos: number | null = null
  for (const tr of update.transactions) {
    if (!tr.docChanged) continue
    tr.changes.iterChanges((_fromA, _toA, _fromB, toB, inserted) => {
      if (inserted.toString() === ':') triggeredPos = toB
    })
  }
  if (triggeredPos === null) return

  const view = update.view
  const pos = triggeredPos
  const line = update.state.doc.lineAt(pos)
  if (pos !== line.to) return
  if (!/^(\s*- )@(plan|schedule|due)(\?)?:$/.test(line.text)) return
  const lineFrom = line.from

  queueMicrotask(() => {
    openDatePickerForLine(view, lineFrom)
  })
}

export const metatagValuePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildValueDecorations(view)
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildValueDecorations(update.view)
      }
      if (update.docChanged) {
        maybeAutoOpenPicker(update)
      }
    }
  },
  { decorations: (v) => v.decorations },
)


/**
 * issue-phase003-008（2026-09-17増分）: 全メタキーの「メタタグ」値装飾。
 *
 * - 日付系（@plan/@schedule/@due）: Live Preview（wysiwyg）かつカーソルが当該行に
 *   重なっていない場合のみ、値を人間可読な「メタタグ表示」チップへ置換する（Decoration.replace）。
 *   それ以外（Source Mode・カーソルが行に重なる）は生テキストへの色付け（Decoration.mark）に留める。
 * - 日付系以外（issue-phase011-markdownEditor-002）: Live Preview かつカーソルが行に重なって
 *   いない場合、＠記号1文字だけを Decoration.replace（widget省略）で非表示にし、キー・値本体は
 *   Decoration.mark による緑系の装飾のまま残す（日付系のような値のフォーマット変換・ピッカーは
 *   行わない軽量な方式）。Source Mode・カーソルが行に重なる場合は＠を含めて生テキストのまま。
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
              // issue-phase011-markdownEditor-002: 日付系と同様に、wysiwyg（Live Preview）かつ
              // カーソルが行に重なっていない場合のみ ＠ 記号を非表示にする。値のフォーマット
              // 変換やピッカーは不要なため、＠ 1文字だけを Decoration.replace（widget 省略）で
              // 消す軽量な方式にする（日付系の MetaDateChipWidget は流用しない）。
              const overlapsSelection = selection.ranges.some(
                (r) => r.to >= keyStart && r.from <= valueEnd,
              )
              if (livePreview && !overlapsSelection) {
                builder.add(keyStart, keyStart + 1, Decoration.replace({}))
              }
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
          // issue-phase011-markdownEditor-002: 値付きメタと同様に ＠ を非表示にする。
          // ＠ の Decoration.replace とキー本体の Decoration.mark が同じ開始位置で重なると
          // RangeSetBuilder がエラーになるため、非表示時はマークの開始位置を1文字分ずらす。
          const overlapsSelection = selection.ranges.some(
            (r) => r.to >= keyStart && r.from <= colonPos,
          )
          const hideAt = livePreview && !overlapsSelection
          if (hideAt) {
            builder.add(keyStart, keyStart + 1, Decoration.replace({}))
          }
          builder.add(
            hideAt ? keyStart + 1 : keyStart,
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
  const m = line.text.match(/^(\s*- )@(plan|schedule|due)(\?)?:$/)
  if (!m) return
  const key = m[2] as DateMetaKey
  const tentative = !!m[3]
  const lineText = line.text
  const lineFrom = line.from

  queueMicrotask(() => {
    if (!view.dom.isConnected) return
    if (lineFrom >= view.state.doc.length) return
    const cur = view.state.doc.lineAt(lineFrom)
    if (cur.text !== lineText) return
    view.dispatch({
      effects: openMetaPicker.of({
        from: cur.to,
        to: cur.to,
        lineFrom: cur.from,
        key,
        initialValue: '',
        initialTentative: tentative,
        mode: 'insert',
      }),
    })
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

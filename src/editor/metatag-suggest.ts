/**
 * issue-phase013-markdownEditor-002: リスト項目の先頭で「@」を入力した際に
 * schedule/plan/due をサジェストし、選択時に日付ピッカー（issue-phase013-markdownEditor-001で
 * 改修済み）を自動的に開く。マウス操作のみで入力を完結できるようにする。
 *
 * memo等の他のメタ情報キーは候補に含めない（強制しない）。入力済み文字列に前方一致する
 * 候補が1つも無くなった時点で `onTrigger` が null を返し、サジェストは自動的に閉じる。
 */
import { EditorSuggest } from 'obsidian'
import type { App, Editor, EditorPosition, EditorSuggestContext, EditorSuggestTriggerInfo, TFile } from 'obsidian'
import type { EditorView } from '@codemirror/view'
import { META_DATE_KEY_LABEL, type DateMetaKey } from '../lib/format/metatag-format'
import { openDatePickerForLine } from './metatag-decoration'

const CANDIDATE_KEYS: readonly DateMetaKey[] = ['schedule', 'plan', 'due']

export interface MetaKeySuggestItem {
  key: DateMetaKey
}

/** カーソル直前の行テキストから、トリガー対象（リスト先頭の`@`+英小文字のみ）かどうかを判定する。 */
export function matchMetaKeyTrigger(beforeCursor: string): { indent: string; query: string } | null {
  const m = beforeCursor.match(/^(\s*)- @([a-z]*)$/)
  if (!m) return null
  return { indent: m[1], query: m[2] }
}

function getCmView(editor: Editor): EditorView | undefined {
  // Obsidian Editor（CM6バックエンド）は非公開プロパティ `cm` にCodeMirrorの EditorView を持つ。
  // 既存コード（plugin.ts の editorEventBus.onFocusLine）と同じ取得パターン。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (editor as any).cm as EditorView | undefined
}

export class MetaKeySuggest extends EditorSuggest<MetaKeySuggestItem> {
  constructor(app: App) {
    super(app)
    // issue-phase014-markdownEditor-002: サジェスト表示中はTabキーでもEnterキーと同様に
    // 選択中の候補を決定できるようにする。`PopoverSuggest.suggestions`（内部の`Suggest`
    // インスタンス）が持つ`useSelectedItem()`はEnterキー確定時に内部的に呼ばれているのと
    // 同じ非公開メソッドで、公開APIには存在しないため型定義上アクセスできない。
    this.scope.register([], 'Tab', (evt) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const suggestions = (this as any).suggestions
      if (suggestions && typeof suggestions.useSelectedItem === 'function') {
        suggestions.useSelectedItem(evt)
      }
      return false
    })
  }

  onTrigger(cursor: EditorPosition, editor: Editor, _file: TFile | null): EditorSuggestTriggerInfo | null {
    // IME変換中は発火しない。
    const cmView = getCmView(editor)
    if (cmView?.composing) return null

    const line = editor.getLine(cursor.line)
    const before = line.slice(0, cursor.ch)
    const trigger = matchMetaKeyTrigger(before)
    if (!trigger) return null

    // 前方一致する候補が1つも無い場合は発火しない（サジェストを自動的に閉じる＝発火させない）。
    if (!CANDIDATE_KEYS.some((k) => k.startsWith(trigger.query))) return null

    return {
      start: { line: cursor.line, ch: cursor.ch - trigger.query.length },
      end: cursor,
      query: trigger.query,
    }
  }

  getSuggestions(context: EditorSuggestContext): MetaKeySuggestItem[] {
    return CANDIDATE_KEYS.filter((k) => k.startsWith(context.query)).map((key) => ({ key }))
  }

  renderSuggestion(value: MetaKeySuggestItem, el: HTMLElement): void {
    el.createSpan({ text: `@${value.key}` })
    el.createSpan({ text: `（${META_DATE_KEY_LABEL[value.key]}）`, cls: 'metatag-suggest-item-label' })
  }

  selectSuggestion(value: MetaKeySuggestItem, _evt: MouseEvent | KeyboardEvent): void {
    const { context } = this
    if (!context) return
    const { editor, start, end } = context

    const insertText = `${value.key}:`
    editor.replaceRange(insertText, start, end)
    const newCursor: EditorPosition = { line: start.line, ch: start.ch + insertText.length }
    editor.setCursor(newCursor)

    const cmView = getCmView(editor)
    if (!cmView) return
    const cmLineNumber = newCursor.line + 1 // Obsidian Editorは0-based、CM6のdoc.line()は1-based
    queueMicrotask(() => {
      if (cmLineNumber > cmView.state.doc.lines) return
      const line = cmView.state.doc.line(cmLineNumber)
      openDatePickerForLine(cmView, line.from)
    })
  }
}

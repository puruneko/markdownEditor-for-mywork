import { linter } from '@codemirror/lint'
import type { Diagnostic } from '@codemirror/lint'
import type { EditorView } from '@codemirror/view'
import { normalizeSchedule, normalizeDue } from '../lib/parser/schedule-normalize'
import { findMisplacedMetaLineIndices } from './reformat-meta-lines'

// ──────────────────────────────────────────────────────
// Pure-function types (no CM6 dependency)
// ──────────────────────────────────────────────────────

export interface LintAction {
  /** Label shown in the quick-fix popup. */
  name: string
  /** String that replaces [from, to] in the document when applied. */
  replacement: string
}

export interface LintResult {
  /** Document-absolute start offset. */
  from: number
  /** Document-absolute end offset (exclusive). */
  to: number
  message: string
  actions?: LintAction[]
}

// ──────────────────────────────────────────────────────
// Patterns — aligned with task-decoration.ts and remark-meta-fields.ts
// ──────────────────────────────────────────────────────

/** Task checkbox line: optional indent + "- [X] ". */
const TASK_LINE_RE = /^\s*- \[[ xX>!\-]\] /

/**
 * Child-list meta line: "  - @key: value" or "  - @key?: value".
 * `?`（仮置き）はキー直後・コロン直前のみ有効（remark-meta-fields.ts と整合）。
 */
const META_LINE_RE = /^(\s*- )@(plan|schedule|due|priority|tags|dependsOn)(\?)?:\s*(.*)/

/** `?` がキー直後・コロン直前以外の位置にある不正な形（例: "@schedule ?:"）。 */
const TENTATIVE_BAD_SPACE_RE = /^(\s*- )@(\w+)\s+\?:/

/** `?` がキー名の前にある不正な形（例: "@?schedule:"）。 */
const TENTATIVE_BAD_PREFIX_RE = /^(\s*- )@\?(\w+):/

/** Wrong separators between start and end datetime. */
const WRONG_SEP_RE = /[〜～／]|から/

/** ISO date / datetime after schedule-normalize expansion. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/

function isValidIso(s: string): boolean {
  return ISO_DATE_RE.test(s)
}

// ──────────────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────────────

function validateScheduleFormat(rawValue: string, valueDocFrom: number): LintResult[] {
  const normalized = normalizeSchedule(rawValue)
  const slashIdx = normalized.indexOf('/')
  if (slashIdx === -1) return []

  const results: LintResult[] = []
  const normStart = normalized.slice(0, slashIdx)
  const normEnd = normalized.slice(slashIdx + 1)

  if (!isValidIso(normStart)) {
    results.push({
      from: valueDocFrom,
      to: valueDocFrom + rawValue.length,
      message: `開始日時が ISO 形式（YYYY-MM-DD または YYYY-MM-DDTHH:mm）ではありません（正規化後: ${normStart}）。`,
    })
  }
  if (!isValidIso(normEnd)) {
    results.push({
      from: valueDocFrom,
      to: valueDocFrom + rawValue.length,
      message: `終了日時が ISO 形式（YYYY-MM-DD または YYYY-MM-DDTHH:mm）ではありません（正規化後: ${normEnd}）。`,
    })
  }
  return results
}

/**
 * @schedule と @plan は同じ期間形式・同じ正規化（normalizeSchedule）を使う
 * （time-meta-model.spec.md BR-012）ため、値チェックロジックを共有する。
 */
function checkScheduleLikeValue(rawValue: string, valueDocFrom: number, keyLabel: 'schedule' | 'plan'): LintResult[] {
  // Rule 4: wrong separator → quickfix
  const sepMatch = WRONG_SEP_RE.exec(rawValue)
  if (sepMatch) {
    const sepFrom = valueDocFrom + sepMatch.index
    const sepTo = sepFrom + sepMatch[0].length
    const fixedValue =
      rawValue.slice(0, sepMatch.index) + '/' + rawValue.slice(sepMatch.index + sepMatch[0].length)
    return [
      {
        from: sepFrom,
        to: sepTo,
        message: '区切り文字が正しくありません。開始と終了の区切りには `/` を使ってください。',
        actions: [{ name: '/ に修正', replacement: '/' }],
      },
      ...validateScheduleFormat(fixedValue, valueDocFrom),
    ]
  }

  // Rule 1: no slash → missing end, warning only
  if (!rawValue.includes('/')) {
    const displayTarget = keyLabel === 'plan' ? '枠として' : 'カレンダー等に'
    return [
      {
        from: valueDocFrom,
        to: valueDocFrom + rawValue.length,
        message:
          `@${keyLabel} には開始と終了を \`/\` で区切って記述してください（例: 2026-01-01T10:00/11:00）。終了が設定されていないため${displayTarget}表示されません。`,
      },
    ]
  }

  // Rule 2: ISO format validation
  return validateScheduleFormat(rawValue, valueDocFrom)
}

function checkDueValue(rawValue: string, valueDocFrom: number): LintResult[] {
  const normalized = normalizeDue(rawValue)
  const slashIdx = normalized.indexOf('/')

  // 一点日付
  if (slashIdx === -1) {
    if (!isValidIso(normalized)) {
      return [
        {
          from: valueDocFrom,
          to: valueDocFrom + rawValue.length,
          message: `@due の日付が ISO 形式（YYYY-MM-DD）ではありません（正規化後: ${normalized}）。`,
        },
      ]
    }
    return []
  }

  // 期間（issue-phase004-002）
  const start = normalized.slice(0, slashIdx)
  const end = normalized.slice(slashIdx + 1)

  if (!isValidIso(start) || !isValidIso(end)) {
    return [
      {
        from: valueDocFrom,
        to: valueDocFrom + rawValue.length,
        message: `@due の期間が ISO 形式（YYYY-MM-DD または YYYY-MM-DD/YYYY-MM-DD）ではありません（正規化後: ${normalized}）。`,
      },
    ]
  }

  if (end < start) {
    return [
      {
        from: valueDocFrom,
        to: valueDocFrom + rawValue.length,
        message: '@due の期間が逆順です（終了が開始より前になっています）。',
      },
    ]
  }

  return []
}

/**
 * 仮置き修飾子 `?` の位置不正を検出する（time-meta-model.spec.md BR-008・BR-011）。
 * `?` はキー名の直後・コロンの前にのみ有効。それ以外（`@key ?:` / `@?key:`）は
 * META_LINE_RE にマッチしないため、この専用チェックで検出し quickfix を提示する。
 */
function checkTentativeMarkerPosition(lineText: string, lineFrom: number): LintResult[] {
  let m = TENTATIVE_BAD_SPACE_RE.exec(lineText)
  if (!m) m = TENTATIVE_BAD_PREFIX_RE.exec(lineText)
  if (!m) return []

  const key = m[2]
  const matchFrom = lineFrom + m.index + m[1].length
  const matchTo = lineFrom + m[0].length
  return [
    {
      from: matchFrom,
      to: matchTo,
      message: '仮置き修飾子 `?` の位置が正しくありません。キー名の直後・コロンの前に置いてください。',
      actions: [{ name: `@${key}?: に修正`, replacement: `@${key}?:` }],
    },
  ]
}

// ──────────────────────────────────────────────────────
// Public pure function
// ──────────────────────────────────────────────────────

/**
 * Lint a single Markdown line.
 * Caller must skip lines that are inside fenced code blocks.
 *
 * @param lineText  Raw text of the line.
 * @param lineFrom  Document-absolute offset of the first character.
 */
export function lintLine(lineText: string, lineFrom: number): LintResult[] {
  // Blockquote lines are excluded (mirrors task-decoration.ts rule)
  if (lineText.trimStart().startsWith('>')) return []

  // Rule 3: @key: written inline on a task checkbox line
  if (TASK_LINE_RE.test(lineText)) {
    const inlineRe = /@(plan|schedule|due|priority|tags|dependsOn)\??:/
    const m = inlineRe.exec(lineText)
    if (m) {
      const from = lineFrom + m.index
      return [
        {
          from,
          to: from + m[0].length,
          message: `@${m[1]}: はタスク行内ではなく、子リスト（インデントした \`- @${m[1]}:\`）として記述してください。`,
        },
      ]
    }
    return []
  }

  // `?` の位置不正（child-list meta line 特有。META_LINE_RE にはマッチしない形）
  const tentativeIssues = checkTentativeMarkerPosition(lineText, lineFrom)
  if (tentativeIssues.length > 0) return tentativeIssues

  // Rules 1, 2, 4: child-list meta line
  const metaMatch = META_LINE_RE.exec(lineText)
  if (!metaMatch) return []

  const key = metaMatch[2]
  // Value starts at fullMatch.length − capturedGroup4.length from line start
  const valueDocFrom = lineFrom + metaMatch[0].length - metaMatch[4].length
  const rawValue = metaMatch[4].trimEnd()

  if (key === 'schedule') return checkScheduleLikeValue(rawValue, valueDocFrom, 'schedule')
  if (key === 'plan') return checkScheduleLikeValue(rawValue, valueDocFrom, 'plan')
  if (key === 'due') return checkDueValue(rawValue, valueDocFrom)
  return []
}

// ──────────────────────────────────────────────────────
// CM6 linter extension
// ──────────────────────────────────────────────────────

/**
 * Returns a CodeMirror 6 linter extension that highlights notation errors
 * in @schedule / @due / @meta fields.
 */
export function createNotationLintExtension() {
  return linter((view: EditorView): Diagnostic[] => {
    const diagnostics: Diagnostic[] = []
    const doc = view.state.doc
    let inCodeBlock = false

    for (let i = 1; i <= doc.lines; i++) {
      const line = doc.line(i)
      const trimmed = line.text.trimStart()

      // Toggle code-block state on fence markers
      if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
        inCodeBlock = !inCodeBlock
        continue
      }
      if (inCodeBlock) continue

      for (const result of lintLine(line.text, line.from)) {
        diagnostics.push({
          from: result.from,
          to: result.to,
          severity: 'warning',
          message: result.message,
          actions: result.actions?.map(action => ({
            name: action.name,
            apply(view: EditorView, from: number, to: number) {
              view.dispatch({ changes: { from, to, insert: action.replacement } })
            },
          })),
        })
      }
    }

    // メタ推奨位置（情報レベル。time-meta-model.spec.md BR-026）:
    // 位置が不正なわけではないため warning にはしない。
    for (const lineIndex of findMisplacedMetaLineIndices(doc.toString())) {
      const line = doc.line(lineIndex + 1)
      diagnostics.push({
        from: line.from,
        to: line.to,
        severity: 'info',
        message: 'このメタ行はタスク（またはグループ）行の直下への配置を推奨します。コマンドパレットの「メタ行を推奨位置へ整形」で一括整形できます。',
      })
    }

    return diagnostics
  })
}

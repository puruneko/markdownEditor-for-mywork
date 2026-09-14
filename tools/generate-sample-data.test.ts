import { describe, it } from 'vitest'
import { writeFileSync, readFileSync } from 'node:fs'
import { DateTime } from 'luxon'
import { parseMarkdown } from '../src/lib/parser/parse-markdown'
import { extractCalendarItems } from '../src/lib/calendar/ast-to-calendar'
import { extractGanttNodes } from '../src/lib/gantt/ast-to-gantt'
import { extractKanbanCards } from '../src/lib/kanban/ast-to-kanban'
import { buildAgenda } from '../src/lib/agenda/ast-to-agenda'
import type { Document } from '../src/lib/parser/types'

/**
 * documents/ 配下のサンプルデータを、ホスト実装を実際に実行して生成する。
 *   npm run gen:samples
 * 出力ファイルは手で編集しない。入力 Markdown か実装を変えたら再生成する。
 */

const VIEW_RANGE = {
  start: DateTime.fromISO('2026-07-01T00:00'),
  end: DateTime.fromISO('2026-07-31T23:59'),
}
const TODAY = DateTime.fromISO('2026-07-06T09:00')

/** nodeLineMap は Map なので JSON 化のためオブジェクトへ変換する */
function docToJson(doc: Document): unknown {
  return {
    type: doc.type,
    sections: doc.sections,
    nodeLineMap: Object.fromEntries(doc.nodeLineMap),
  }
}

const COMMON_ABOUT = {
  仕様書: 'documents/external-data-contract.spec.md',
  生成元: 'このリポジトリのホスト実装（解析処理と各投影処理）を実行して得た実出力',
  再生成: 'npm run gen:samples（このファイルは手で編集しない）',
  読み方: {
    sources: 'ホストが連携アプリへ渡す SourceEntry[] そのもの。仕様書 §4.1〜§4.5 に対応する',
    projections:
      'ホストが sources を変換して各連携アプリへ渡している値。仕様書 §4.7 に対応する。連携アプリが実際に受け取るのはこの形',
  },
  生成条件: {
    'calendar / gantt の表示範囲': '2026-07-01T00:00 〜 2026-07-31T23:59（@repeat の展開範囲）',
    'agenda の基準日': '2026-07-06',
    'gantt のオプション': '既定値。@schedule を持たないサブタスクは出力していない（仕様書 BR-052）',
  },
  'JSON 化による差異': {
    'sources[].doc.nodeLineMap':
      '実際の受け渡しでは Map<string, number>。JSON 化のためオブジェクトへ変換している（仕様書 注釈 A-01）',
    priority:
      '数値に変換できない @priority は実際には NaN になるが、JSON では null として現れる（仕様書 注釈 A-05）',
    日時: '投影結果の日時は Luxon DateTime であり、JSON 化するとオフセット付き ISO 文字列になる',
  },
}

type Sample = { size: 'S' | 'M' | 'L'; md: string; out: string; このファイル: string; 含む記法: string }

const SAMPLES: Sample[] = [
  {
    size: 'S',
    md: 'demo/sample-s.md',
    out: 'documents/sample-external-data-s.json',
    このファイル: '最小サンプル（入力96行）。連携アプリ実装者が最初に読む1本',
    含む記法:
      '見出し2階層・グループ・タスク3種（todo/doing/done）・@schedule・@due・@priority・@tags・引用・メモのみのリスト',
  },
  {
    size: 'M',
    md: 'demo/sample-m.md',
    out: 'documents/sample-external-data-m.json',
    このファイル: '実務サンプル（入力266行）。1ヶ月分の総務業務を想定した現実的な分量',
    含む記法:
      'S の内容 ＋ ステータス5種すべて・@plan・仮置き `?`・@repeat・@dependsOn・日付のみの期間・複数日の期間・省略記法・4階層の入れ子',
  },
  {
    size: 'L',
    md: 'demo/sample-l.md',
    out: 'documents/sample-external-data-l.json',
    このファイル: '網羅サンプル（入力753行）。業務パターンと記法を一通り含む',
    含む記法:
      'M の内容 ＋ 多段 WBS・部門横断の業務パターン ＋ 境界ケース（空値メタ・`?` の位置不正・数値でない優先度・逆転した期間・展開されない省略記法・未知キー・予定のない繰り返し・同一キー重複・不正な繰り返し規則・5階層・見出しレベル飛ばし・4スペースインデント）',
  },
]

describe('generate sample data', () => {
  for (const sample of SAMPLES) {
    it(`${sample.size}: ${sample.md}`, () => {
      const md = readFileSync(sample.md, 'utf8')
      const doc = parseMarkdown(md)
      const sources = [{ path: sample.md, doc }]
      const payload = {
        _about: {
          サイズ: sample.size,
          このファイル: sample.このファイル,
          入力Markdown: sample.md,
          含む記法: sample.含む記法,
          他のサイズ: SAMPLES.filter(s => s.size !== sample.size).map(s => `${s.size}: ${s.out}`),
          ...COMMON_ABOUT,
        },
        sources: [{ path: sample.md, doc: docToJson(doc) }],
        projections: {
          calendar: extractCalendarItems(sources, VIEW_RANGE),
          gantt: extractGanttNodes(sources, VIEW_RANGE),
          kanban: extractKanbanCards(sources),
          agenda: buildAgenda(sources, TODAY),
        },
      }
      writeFileSync(sample.out, JSON.stringify(payload, null, 2) + '\n')
    })
  }
})

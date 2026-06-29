import { describe, it, expect } from 'vitest'
import { DateTime } from 'luxon'
import { parseMarkdown } from '../parser/parse-markdown'
import { buildAgenda } from './ast-to-agenda'
import type { AgendaBuckets } from './ast-to-agenda'

// ----------------------------------------------------------------
// ヘルパー
// ----------------------------------------------------------------

function src(md: string, path = 'test.md') {
  return [{ path, doc: parseMarkdown(md) }]
}

// 固定 today: 2026-07-07（火曜日）。今週 = 2026-07-06(Mon)〜2026-07-12(Sun)
const TODAY = DateTime.fromISO('2026-07-07')

function agenda(md: string, path = 'test.md'): AgendaBuckets {
  return buildAgenda(src(md, path), TODAY)
}

// ----------------------------------------------------------------
// 基本振り分け
// ----------------------------------------------------------------

describe('buildAgenda — 基本振り分け', () => {
  it('過去日付は overdue に入る', () => {
    const md = '- [ ] 昨日のタスク\n  - @schedule: 2026-07-01T10:00/2026-07-06T11:00\n'
    const { overdue } = agenda(md)
    expect(overdue).toHaveLength(1)
    expect(overdue[0].text).toBe('昨日のタスク')
  })

  it('今日と同日は today に入る', () => {
    const md = '- [ ] 今日のタスク\n  - @schedule: 2026-07-07T09:00/2026-07-07T10:00\n'
    const { today } = agenda(md)
    expect(today).toHaveLength(1)
    expect(today[0].text).toBe('今日のタスク')
  })

  it('明日から今週末（日曜）は thisWeek に入る', () => {
    const md = [
      '- [ ] 明日',
      '  - @schedule: 2026-07-08T10:00/2026-07-08T11:00',
      '- [ ] 今週金曜',
      '  - @due: 2026-07-11',
      '- [ ] 今週日曜',
      '  - @due: 2026-07-12',
    ].join('\n') + '\n'
    const { thisWeek } = agenda(md)
    expect(thisWeek).toHaveLength(3)
  })

  it('来週以降の日付はどのバケツにも入らない', () => {
    const md = '- [ ] 来週月曜\n  - @due: 2026-07-13\n'
    const { overdue, today, thisWeek, undated } = agenda(md)
    expect(overdue).toHaveLength(0)
    expect(today).toHaveLength(0)
    expect(thisWeek).toHaveLength(0)
    expect(undated).toHaveLength(0)
  })

  it('日付なし（@schedule も @due もない）は undated に入る', () => {
    const md = '- [ ] 日付なしタスク\n'
    const { undated } = agenda(md)
    expect(undated).toHaveLength(1)
    expect(undated[0].text).toBe('日付なしタスク')
  })

  it('完了タスク（done）はどのバケツにも入らない', () => {
    const md = '- [x] 完了済み\n  - @due: 2026-07-07\n'
    const { overdue, today, thisWeek, undated } = agenda(md)
    const all = [...overdue, ...today, ...thisWeek, ...undated]
    expect(all).toHaveLength(0)
  })
})

// ----------------------------------------------------------------
// 日付解決の優先順
// ----------------------------------------------------------------

describe('buildAgenda — 日付解決', () => {
  it('@schedule の終了日を優先して使う', () => {
    // @schedule 終了日 = 2026-07-07（today）、@due = 過去
    const md = '- [ ] タスク\n  - @schedule: 2026-07-07T09:00/2026-07-07T10:00\n  - @due: 2026-07-01\n'
    const { today, overdue } = agenda(md)
    expect(today).toHaveLength(1)
    expect(overdue).toHaveLength(0)
  })

  it('@schedule がない場合は @due を使う', () => {
    const md = '- [ ] タスク\n  - @due: 2026-07-06\n'
    const { overdue } = agenda(md)
    expect(overdue).toHaveLength(1)
    expect(overdue[0].text).toBe('タスク')
  })

  it('@schedule にスラッシュがない場合は @due にフォールバックする', () => {
    // @schedule: 2026-07-07（スラッシュなし）は終了日が取れない → @due: 2026-07-07 を採用
    const md = '- [ ] タスク\n  - @schedule: 2026-07-07\n  - @due: 2026-07-07\n'
    const { today } = agenda(md)
    expect(today).toHaveLength(1)
  })
})

// ----------------------------------------------------------------
// ステータス: 未完 4 種 + done 除外
// ----------------------------------------------------------------

describe('buildAgenda — ステータスフィルタ', () => {
  it('todo/doing/blocked/hold はすべて未完として含まれる', () => {
    const md = [
      '- [ ] todo タスク',
      '  - @due: 2026-07-07',
      '- [>] doing タスク',
      '  - @due: 2026-07-07',
      '- [!] blocked タスク',
      '  - @due: 2026-07-07',
      '- [-] hold タスク',
      '  - @due: 2026-07-07',
    ].join('\n') + '\n'
    const { today } = agenda(md)
    expect(today).toHaveLength(4)
  })

  it('done タスクは除外される', () => {
    const md = '- [x] done タスク\n  - @due: 2026-07-07\n'
    const { today } = agenda(md)
    expect(today).toHaveLength(0)
  })
})

// ----------------------------------------------------------------
// 並び順
// ----------------------------------------------------------------

describe('buildAgenda — 並び順', () => {
  it('同一バケツ内で日付昇順', () => {
    const md = [
      '- [ ] 過去2日前',
      '  - @due: 2026-07-05',
      '- [ ] 過去1日前',
      '  - @due: 2026-07-06',
      '- [ ] 過去3日前',
      '  - @due: 2026-07-04',
    ].join('\n') + '\n'
    const { overdue } = agenda(md)
    expect(overdue[0].text).toBe('過去3日前')
    expect(overdue[1].text).toBe('過去2日前')
    expect(overdue[2].text).toBe('過去1日前')
  })

  it('同日付なら priority 昇順（小さいほど高優先）', () => {
    const md = [
      '- [ ] 優先度3',
      '  - @due: 2026-07-07',
      '  - @priority: 3',
      '- [ ] 優先度1',
      '  - @due: 2026-07-07',
      '  - @priority: 1',
      '- [ ] 優先度2',
      '  - @due: 2026-07-07',
      '  - @priority: 2',
    ].join('\n') + '\n'
    const { today } = agenda(md)
    expect(today[0].text).toBe('優先度1')
    expect(today[1].text).toBe('優先度2')
    expect(today[2].text).toBe('優先度3')
  })

  it('同日付・同 priority なら ステータス順 todo < doing < blocked < hold', () => {
    const md = [
      '- [-] hold タスク',
      '  - @due: 2026-07-07',
      '- [ ] todo タスク',
      '  - @due: 2026-07-07',
      '- [!] blocked タスク',
      '  - @due: 2026-07-07',
      '- [>] doing タスク',
      '  - @due: 2026-07-07',
    ].join('\n') + '\n'
    const { today } = agenda(md)
    expect(today[0].status).toBe('todo')
    expect(today[1].status).toBe('doing')
    expect(today[2].status).toBe('blocked')
    expect(today[3].status).toBe('hold')
  })

  it('priority 未指定は priority 指定済みの後', () => {
    const md = [
      '- [ ] 優先度なし',
      '  - @due: 2026-07-07',
      '- [ ] 優先度1',
      '  - @due: 2026-07-07',
      '  - @priority: 1',
    ].join('\n') + '\n'
    const { today } = agenda(md)
    expect(today[0].text).toBe('優先度1')
    expect(today[1].text).toBe('優先度なし')
  })
})

// ----------------------------------------------------------------
// 境界条件
// ----------------------------------------------------------------

describe('buildAgenda — 境界条件', () => {
  it('今週月曜（today = 火曜）は overdue', () => {
    const md = '- [ ] 月曜タスク\n  - @due: 2026-07-06\n'
    const { overdue } = agenda(md)
    expect(overdue).toHaveLength(1)
  })

  it('今週日曜（週末）は thisWeek に含まれる', () => {
    const md = '- [ ] 日曜タスク\n  - @due: 2026-07-12\n'
    const { thisWeek } = agenda(md)
    expect(thisWeek).toHaveLength(1)
  })

  it('来週月曜はどのバケツにも入らない', () => {
    const md = '- [ ] 来週\n  - @due: 2026-07-13\n'
    const { overdue, today, thisWeek, undated } = agenda(md)
    expect([...overdue, ...today, ...thisWeek, ...undated]).toHaveLength(0)
  })
})

// ----------------------------------------------------------------
// 複数ソース
// ----------------------------------------------------------------

describe('buildAgenda — 複数ソース', () => {
  it('複数ファイルのタスクを横断してバケツに振り分ける', () => {
    const sources = [
      { path: 'fileA.md', doc: parseMarkdown('- [ ] ファイルAの今日\n  - @due: 2026-07-07\n') },
      { path: 'fileB.md', doc: parseMarkdown('- [ ] ファイルBの期限超過\n  - @due: 2026-07-06\n') },
      { path: 'fileC.md', doc: parseMarkdown('- [ ] ファイルCの日付なし\n') },
    ]
    const buckets = buildAgenda(sources, TODAY)
    expect(buckets.today).toHaveLength(1)
    expect(buckets.overdue).toHaveLength(1)
    expect(buckets.undated).toHaveLength(1)
    expect(buckets.today[0].path).toBe('fileA.md')
    expect(buckets.overdue[0].path).toBe('fileB.md')
  })

  it('globalKey は sourcePath::localId 形式', () => {
    const md = '- [ ] タスク\n  - @due: 2026-07-07\n'
    const { today } = agenda(md, 'notes/work.md')
    expect(today[0].globalKey).toMatch(/^notes\/work\.md::/)
  })
})

// ----------------------------------------------------------------
// @schedule の終了日（時刻なし）
// ----------------------------------------------------------------

describe('buildAgenda — @schedule 日付のみ形式', () => {
  it('@schedule が日付のみ形式（YYYY-MM-DD/YYYY-MM-DD）の場合も終了日で判定', () => {
    const md = '- [ ] 日付のみ schedule\n  - @schedule: 2026-07-06/2026-07-07\n'
    const { today } = agenda(md)
    expect(today).toHaveLength(1)
  })
})

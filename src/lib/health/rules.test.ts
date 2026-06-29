import { describe, it, expect } from 'vitest'
import { DateTime } from 'luxon'
import { parseMarkdown } from '../parser/parse-markdown'
import { runHealthChecks, DEFAULT_HEALTH_CONFIG } from './rules'
import type { HealthConfig } from './rules'

// ----------------------------------------------------------------
// ヘルパー
// ----------------------------------------------------------------

function src(md: string, path = 'test.md') {
  return [{ path, doc: parseMarkdown(md) }]
}

// 固定 today: 2026-07-07（火曜）
const TODAY = DateTime.fromISO('2026-07-07')

function check(md: string, cfg: Partial<HealthConfig> = {}) {
  const config: HealthConfig = {
    ...DEFAULT_HEALTH_CONFIG,
    ...cfg,
    rules: { ...DEFAULT_HEALTH_CONFIG.rules, ...(cfg.rules ?? {}) },
  }
  return runHealthChecks(src(md), TODAY, config)
}

// ----------------------------------------------------------------
// Rule 1: undated — 未完で日付なし
// ----------------------------------------------------------------

describe('Rule 1: undated', () => {
  it('@schedule も @due もない未完タスクを検出する', () => {
    const md = '- [ ] 日付なしタスク\n'
    const findings = check(md)
    const found = findings.filter(f => f.ruleId === 'undated')
    expect(found).toHaveLength(1)
    expect(found[0].message).toContain('日付なしタスク')
  })

  it('@schedule があれば undated にならない', () => {
    const md = '- [ ] タスク\n  - @schedule: 2026-07-07T10:00/2026-07-07T11:00\n'
    const findings = check(md)
    expect(findings.filter(f => f.ruleId === 'undated')).toHaveLength(0)
  })

  it('@due があれば undated にならない', () => {
    const md = '- [ ] タスク\n  - @due: 2026-07-07\n'
    const findings = check(md)
    expect(findings.filter(f => f.ruleId === 'undated')).toHaveLength(0)
  })

  it('完了タスク（done）は対象外', () => {
    const md = '- [x] 完了タスク\n'
    const findings = check(md)
    expect(findings.filter(f => f.ruleId === 'undated')).toHaveLength(0)
  })

  it('ルール OFF 時は検出しない', () => {
    const md = '- [ ] 日付なし\n'
    const findings = check(md, { rules: { undated: false, overdue: true, stale: true, unresolvedDeps: true, readyTasks: true, malformed: true } })
    expect(findings.filter(f => f.ruleId === 'undated')).toHaveLength(0)
  })
})

// ----------------------------------------------------------------
// Rule 2: overdue — 過去日付で未完
// ----------------------------------------------------------------

describe('Rule 2: overdue', () => {
  it('過去日付（@schedule 終了日）の未完タスクを検出する', () => {
    const md = '- [ ] 期限超過\n  - @schedule: 2026-07-05T10:00/2026-07-06T11:00\n'
    const findings = check(md)
    const found = findings.filter(f => f.ruleId === 'overdue')
    expect(found).toHaveLength(1)
    expect(found[0].message).toContain('2026-07-06')
  })

  it('過去日付（@due）の未完タスクを検出する', () => {
    const md = '- [ ] タスク\n  - @due: 2026-07-06\n'
    const findings = check(md)
    expect(findings.filter(f => f.ruleId === 'overdue')).toHaveLength(1)
  })

  it('today の日付は overdue にならない（境界）', () => {
    const md = '- [ ] 今日\n  - @due: 2026-07-07\n'
    const findings = check(md)
    expect(findings.filter(f => f.ruleId === 'overdue')).toHaveLength(0)
  })

  it('完了タスクは対象外', () => {
    const md = '- [x] 完了済み\n  - @due: 2026-07-01\n'
    const findings = check(md)
    expect(findings.filter(f => f.ruleId === 'overdue')).toHaveLength(0)
  })

  it('ルール OFF 時は検出しない', () => {
    const md = '- [ ] 期限超過\n  - @due: 2026-07-01\n'
    const findings = check(md, { rules: { undated: true, overdue: false, stale: true, unresolvedDeps: true, readyTasks: true, malformed: true } })
    expect(findings.filter(f => f.ruleId === 'overdue')).toHaveLength(0)
  })
})

// ----------------------------------------------------------------
// Rule 3: stale — doing で N 日以上放置
// ----------------------------------------------------------------

describe('Rule 3: stale', () => {
  it('doing のまま staleDays 以上経過したタスクを検出する', () => {
    // today=2026-07-07, 開始=2026-06-29, elapsed=8日, staleDays=7
    const md = '- [>] 停滞タスク\n  - @schedule: 2026-06-29T10:00/2026-06-29T11:00\n'
    const findings = check(md, { staleDays: 7 })
    const found = findings.filter(f => f.ruleId === 'stale')
    expect(found).toHaveLength(1)
    expect(found[0].message).toContain('停滞タスク')
  })

  it('staleDays 未満なら検出しない', () => {
    // today=2026-07-07, 開始=2026-07-06, elapsed=1日, staleDays=7
    const md = '- [>] 新しい doing\n  - @schedule: 2026-07-06T10:00/2026-07-06T11:00\n'
    const findings = check(md, { staleDays: 7 })
    expect(findings.filter(f => f.ruleId === 'stale')).toHaveLength(0)
  })

  it('ちょうど staleDays 日の境界: 検出する', () => {
    // today=2026-07-07, 開始=2026-06-30, elapsed=7日
    const md = '- [>] ちょうど7日\n  - @schedule: 2026-06-30T10:00/2026-06-30T11:00\n'
    const findings = check(md, { staleDays: 7 })
    expect(findings.filter(f => f.ruleId === 'stale')).toHaveLength(1)
  })

  it('doing 以外のステータスは stale にならない', () => {
    const md = '- [ ] todo タスク\n  - @schedule: 2026-06-01T10:00/2026-06-01T11:00\n'
    const findings = check(md, { staleDays: 7 })
    expect(findings.filter(f => f.ruleId === 'stale')).toHaveLength(0)
  })

  it('@schedule がなければ stale 判定しない', () => {
    const md = '- [>] スケジュールなし doing\n  - @due: 2026-06-01\n'
    const findings = check(md, { staleDays: 7 })
    expect(findings.filter(f => f.ruleId === 'stale')).toHaveLength(0)
  })

  it('ルール OFF 時は検出しない', () => {
    const md = '- [>] 停滞\n  - @schedule: 2026-06-01T10:00/2026-06-01T11:00\n'
    const findings = check(md, { staleDays: 7, rules: { undated: true, overdue: true, stale: false, unresolvedDeps: true, readyTasks: true, malformed: true } })
    expect(findings.filter(f => f.ruleId === 'stale')).toHaveLength(0)
  })
})

// ----------------------------------------------------------------
// Rule 4: unresolved-deps — 依存先が見つからない
// ----------------------------------------------------------------

describe('Rule 4: unresolved-deps', () => {
  it('@dependsOn の参照先が存在しない場合に検出する', () => {
    const md = '- [ ] タスクA\n  - @dependsOn: 存在しないタスク\n'
    const findings = check(md)
    const found = findings.filter(f => f.ruleId === 'unresolved-deps')
    expect(found).toHaveLength(1)
    expect(found[0].message).toContain('存在しないタスク')
  })

  it('@dependsOn の参照先が存在すれば検出しない', () => {
    const md = [
      '- [ ] タスクA',
      '  - @dependsOn: タスクB',
      '- [x] タスクB',
    ].join('\n') + '\n'
    const findings = check(md)
    expect(findings.filter(f => f.ruleId === 'unresolved-deps')).toHaveLength(0)
  })

  it('複数の依存先の一部が未解決なら検出する', () => {
    const md = [
      '- [ ] タスクA',
      '  - @dependsOn: タスクB, 存在しない',
      '- [x] タスクB',
    ].join('\n') + '\n'
    const findings = check(md)
    expect(findings.filter(f => f.ruleId === 'unresolved-deps')).toHaveLength(1)
  })

  it('@dependsOn がなければ対象外', () => {
    const md = '- [ ] 依存なしタスク\n'
    const findings = check(md)
    expect(findings.filter(f => f.ruleId === 'unresolved-deps')).toHaveLength(0)
  })
})

// ----------------------------------------------------------------
// Rule 5: ready-tasks — 依存先が全完了で着手可能
// ----------------------------------------------------------------

describe('Rule 5: ready-tasks', () => {
  it('依存先がすべて done なら着手可能として検出する', () => {
    const md = [
      '- [ ] タスクA',
      '  - @dependsOn: タスクB',
      '- [x] タスクB',
    ].join('\n') + '\n'
    const findings = check(md)
    const found = findings.filter(f => f.ruleId === 'ready-tasks')
    expect(found).toHaveLength(1)
    expect(found[0].message).toContain('タスクA')
  })

  it('依存先に未完タスクが残っていれば検出しない', () => {
    const md = [
      '- [ ] タスクA',
      '  - @dependsOn: タスクB',
      '- [ ] タスクB',
    ].join('\n') + '\n'
    const findings = check(md)
    expect(findings.filter(f => f.ruleId === 'ready-tasks')).toHaveLength(0)
  })

  it('複数依存先がすべて done なら検出する', () => {
    const md = [
      '- [ ] タスクA',
      '  - @dependsOn: タスクB, タスクC',
      '- [x] タスクB',
      '- [x] タスクC',
    ].join('\n') + '\n'
    const findings = check(md)
    expect(findings.filter(f => f.ruleId === 'ready-tasks')).toHaveLength(1)
  })

  it('doing タスクは ready-tasks 対象外（すでに着手済み）', () => {
    const md = [
      '- [>] タスクA',
      '  - @dependsOn: タスクB',
      '- [x] タスクB',
    ].join('\n') + '\n'
    const findings = check(md)
    expect(findings.filter(f => f.ruleId === 'ready-tasks')).toHaveLength(0)
  })

  it('依存先が未解決の場合は ready-tasks 判定しない', () => {
    const md = [
      '- [ ] タスクA',
      '  - @dependsOn: 存在しない',
    ].join('\n') + '\n'
    const findings = check(md)
    expect(findings.filter(f => f.ruleId === 'ready-tasks')).toHaveLength(0)
  })
})

// ----------------------------------------------------------------
// Rule 6: malformed — lintLine と同一基準
// ----------------------------------------------------------------

describe('Rule 6: malformed', () => {
  it('@schedule にスラッシュがない場合を検出する', () => {
    const md = '- [ ] タスク\n  - @schedule: 2026-07-07T10:00\n'
    const findings = check(md)
    const found = findings.filter(f => f.ruleId === 'malformed')
    expect(found).toHaveLength(1)
    expect(found[0].message).toContain('@schedule')
  })

  it('@schedule に誤った区切り文字を検出する', () => {
    const md = '- [ ] タスク\n  - @schedule: 2026-07-07T10:00〜11:00\n'
    const findings = check(md)
    expect(findings.filter(f => f.ruleId === 'malformed')).toHaveLength(1)
  })

  it('@due が ISO 形式でない場合を検出する', () => {
    const md = '- [ ] タスク\n  - @due: 2026/07/07\n'
    const findings = check(md)
    expect(findings.filter(f => f.ruleId === 'malformed')).toHaveLength(1)
  })

  it('正しい @schedule/@due は検出しない', () => {
    const md = '- [ ] タスク\n  - @schedule: 2026-07-07T10:00/2026-07-07T11:00\n  - @due: 2026-07-07\n'
    const findings = check(md)
    expect(findings.filter(f => f.ruleId === 'malformed')).toHaveLength(0)
  })

  it('lintLine と同一基準: notation-lint.ts のルールと結果が一致', () => {
    // スラッシュなし @schedule はリントでも検出される
    const md = '- [ ] タスク\n  - @schedule: 2026-07-07\n'
    const findings = check(md)
    expect(findings.filter(f => f.ruleId === 'malformed')).toHaveLength(1)
  })
})

// ----------------------------------------------------------------
// 複数ソース横断
// ----------------------------------------------------------------

describe('runHealthChecks — 複数ソース', () => {
  it('複数ファイルのタスクを横断して検出する', () => {
    const sources = [
      { path: 'fileA.md', doc: parseMarkdown('- [ ] 日付なし A\n') },
      { path: 'fileB.md', doc: parseMarkdown('- [ ] 日付なし B\n') },
    ]
    const findings = runHealthChecks(sources, TODAY)
    const undated = findings.filter(f => f.ruleId === 'undated')
    expect(undated).toHaveLength(2)
    const paths = undated.map(f => f.path)
    expect(paths).toContain('fileA.md')
    expect(paths).toContain('fileB.md')
  })

  it('globalKey は sourcePath::localId 形式', () => {
    const md = '- [ ] タスク\n'
    const findings = runHealthChecks(src(md, 'notes/work.md'), TODAY)
    expect(findings[0].globalKey).toMatch(/^notes\/work\.md::/)
  })

  it('依存先突き合わせは全ソースを横断する', () => {
    const sources = [
      { path: 'fileA.md', doc: parseMarkdown('- [ ] タスクA\n  - @dependsOn: タスクB\n') },
      { path: 'fileB.md', doc: parseMarkdown('- [x] タスクB\n') },
    ]
    const findings = runHealthChecks(sources, TODAY)
    // fileB にタスクBがあるので unresolved-deps にはならない
    expect(findings.filter(f => f.ruleId === 'unresolved-deps')).toHaveLength(0)
    // タスクBは done なので ready-tasks が出る
    expect(findings.filter(f => f.ruleId === 'ready-tasks')).toHaveLength(1)
  })
})

// ----------------------------------------------------------------
// DEFAULT_HEALTH_CONFIG
// ----------------------------------------------------------------

describe('DEFAULT_HEALTH_CONFIG', () => {
  it('staleDays が 7 であること', () => {
    expect(DEFAULT_HEALTH_CONFIG.staleDays).toBe(7)
  })

  it('全ルールがデフォルトで有効', () => {
    const { rules } = DEFAULT_HEALTH_CONFIG
    expect(rules.undated).toBe(true)
    expect(rules.overdue).toBe(true)
    expect(rules.stale).toBe(true)
    expect(rules.unresolvedDeps).toBe(true)
    expect(rules.readyTasks).toBe(true)
    expect(rules.malformed).toBe(true)
  })
})

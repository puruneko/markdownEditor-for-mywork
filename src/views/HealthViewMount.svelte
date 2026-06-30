<script lang="ts">
  import { DateTime } from 'luxon'
  import { runHealthChecks, DEFAULT_HEALTH_CONFIG } from '../lib/health/rules'
  import type { HealthConfig, HealthFinding, RuleId } from '../lib/health/rules'
  import type { Document, TaskNode } from '../lib/parser/types'
  import type { SourceEntry } from '../lib/viewmodel/contract'

  interface Props {
    sources: SourceEntry[]
    registerUpdater: (fn: (sources: SourceEntry[]) => void) => void
    onNodeClick: (globalKey: string) => void
    onNodePatch: (globalKey: string, patcher: (md: string, doc: Document, node: TaskNode) => string) => Promise<void>
    onReload: () => void
    config?: HealthConfig
  }

  let { sources: initialSources, registerUpdater, onNodeClick, config }: Props = $props()

  let sources = $state(initialSources)
  let now = $state(DateTime.now())

  registerUpdater((newSources) => { sources = newSources })

  // 1分ごとに now を更新
  $effect(() => {
    const id = setInterval(() => { now = DateTime.now() }, 60_000)
    return () => clearInterval(id)
  })

  const effectiveConfig = $derived(config ?? DEFAULT_HEALTH_CONFIG)
  let findings = $derived(runHealthChecks(sources, now, effectiveConfig))

  const RULE_LABELS: Record<RuleId, string> = {
    'undated':          '⬜ 日付なし',
    'overdue':          '⚠ 期限超過',
    'stale':            '🕐 doing 停滞',
    'unresolved-deps':  '🔗 未解決依存',
    'ready-tasks':      '✅ 着手可能',
    'malformed':        '⛔ 形式不正',
  }

  const RULE_ORDER: RuleId[] = [
    'overdue', 'stale', 'malformed', 'unresolved-deps', 'ready-tasks', 'undated',
  ]

  type GroupedFindings = Map<RuleId, HealthFinding[]>

  let grouped: GroupedFindings = $derived.by(() => {
    const map = new Map<RuleId, HealthFinding[]>()
    for (const f of findings) {
      const list = map.get(f.ruleId) ?? []
      list.push(f)
      map.set(f.ruleId, list)
    }
    return map
  })
</script>

<div class="health-mount">
  <div class="health-header">
    <span class="health-title">Health Check</span>
    <span class="finding-total">
      {findings.length > 0 ? `${findings.length} 件` : '問題なし'}
    </span>
  </div>

  <div class="health-body">

    {#if findings.length === 0}
      <p class="empty-message">検出された問題はありません。</p>
    {:else}
      {#each RULE_ORDER as ruleId (ruleId)}
        {#if grouped.has(ruleId)}
          {@const ruleFindings = grouped.get(ruleId)!}
          <section class="rule-group rule-{ruleId}">
            <h3 class="rule-label">
              {RULE_LABELS[ruleId]}
              <span class="count">({ruleFindings.length})</span>
            </h3>
            {#each ruleFindings as finding (finding.globalKey + finding.line)}
              <button class="finding-row" onclick={() => onNodeClick(finding.globalKey)}>
                <span class="finding-path">{finding.path.split('/').pop()}</span>
                <span class="finding-line">:{finding.line + 1}</span>
                <span class="finding-message">{finding.message}</span>
              </button>
            {/each}
          </section>
        {/if}
      {/each}
    {/if}

  </div>
</div>

<style>
  .health-mount {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
    font-size: 13px;
    color: var(--text-normal, #222);
    background: var(--background-primary, #fff);
  }

  .health-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--background-modifier-border, #ddd);
    font-weight: 600;
  }

  .health-title {
    font-size: 14px;
  }

  .finding-total {
    font-size: 12px;
    color: var(--text-muted, #888);
  }

  .health-body {
    flex: 1 1 0;
    overflow-y: auto;
    padding: 4px 0;
  }

  .rule-group {
    padding: 4px 0 8px;
  }

  .rule-label {
    padding: 4px 12px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted, #888);
    margin: 0;
  }

  .rule-overdue .rule-label,
  .rule-stale .rule-label   { color: var(--color-red, #d32f2f); }
  .rule-malformed .rule-label { color: var(--color-orange, #e65100); }
  .rule-ready-tasks .rule-label { color: var(--color-green, #2e7d32); }

  .count {
    font-weight: 400;
  }

  .finding-row {
    display: flex;
    align-items: baseline;
    gap: 4px;
    width: 100%;
    padding: 4px 12px;
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
    border-radius: 3px;
  }

  .finding-row:hover {
    background: var(--background-modifier-hover, #f0f0f0);
  }

  .finding-path {
    flex-shrink: 0;
    font-size: 11px;
    color: var(--text-accent, #4a86e8);
    font-weight: 500;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .finding-line {
    flex-shrink: 0;
    font-size: 11px;
    color: var(--text-muted, #888);
  }

  .finding-message {
    flex: 1 1 0;
    font-size: 12px;
    color: var(--text-normal, #333);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .empty-message {
    padding: 24px 12px;
    color: var(--text-muted, #888);
    font-size: 13px;
  }
</style>

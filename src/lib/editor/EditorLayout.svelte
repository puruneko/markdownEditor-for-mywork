<script lang="ts">
  import MonacoEditor from './MonacoEditor.svelte'
  import CalendarTab from '../calendar/CalendarTab.svelte'
  import GanttTab from '../gantt/GanttTab.svelte'
  import { parseMarkdown } from '../parser/md-to-ast'
  import { serializeAst } from '../parser/ast-to-md'
  import type { Document } from '../parser/types'

  // Sync direction state
  type Direction = 'idle' | 'md-to-ast' | 'ast-to-md'
  let direction: Direction = $state('idle')

  // Right panel tab state (#0013, #0020)
  type RightTab = 'ast' | 'calendar' | 'gantt'
  let rightTab: RightTab = $state('ast')

  // Initial markdown content (static — used only for initialization)
  const INITIAL_MD = `# Webアプリ開発

> 方針
> - シンプル設計

- 企画
  - [x] 要件整理
    @schedule: 2026-04-01T10:00/2026-04-01T12:00
    - [x] 機能洗い出し
  - メモ
    - MVP重視

- 設計
  - [ ] 画面設計
    @schedule: 2026-04-02T10:00/2026-04-02T18:00
    - [ ] ワイヤー作成
      @schedule: 2026-04-02T10:00/2026-04-02T14:00
    - [ ] UIレビュー
      @schedule: 2026-04-02T15:00/2026-04-02T18:00
  - [-] API設計（保留）

- 実装
  - フロント
    - [ ] コンポーネント
      @schedule: 2026-04-05T10:00/2026-04-05T18:00
      - [ ] Button
        @schedule: 2026-04-05T10:00/2026-04-05T12:00
  - バックエンド
    - [ ] API実装
      @schedule: 2026-04-06T10:00/2026-04-06T18:00

## 運用

- 監視
  - [>] ログ監視
    @schedule: 2026-04-20T10:00/2026-04-20T12:00
  - [!] アラート設定（ブロック中）
`

  // Editor values — astValue is initialized from INITIAL_MD once (not reactive to mdValue)
  let mdValue: string = $state(INITIAL_MD)
  let astValue: string = $state(JSON.stringify(parseMarkdown(INITIAL_MD), null, 2))

  // Current parsed document — derived from mdValue for the CalendarTab
  let currentDoc: Document = $derived(parseMarkdown(mdValue))

  // Debounce timer refs
  let mdTimer: ReturnType<typeof setTimeout> | null = null
  let astTimer: ReturnType<typeof setTimeout> | null = null

  // Sync lock to prevent loops
  let syncing = false

  function onMdChange(value: string) {
    if (syncing) return
    if (mdTimer) clearTimeout(mdTimer)
    direction = 'md-to-ast'
    mdTimer = setTimeout(() => {
      syncing = true
      try {
        const doc = parseMarkdown(value)
        astValue = JSON.stringify(doc, null, 2)
      } finally {
        syncing = false
        direction = 'idle'
      }
    }, 300)
  }

  function onAstChange(value: string) {
    if (syncing) return
    if (astTimer) clearTimeout(astTimer)
    direction = 'ast-to-md'
    astTimer = setTimeout(() => {
      syncing = true
      try {
        const doc: Document = JSON.parse(value)
        mdValue = serializeAst(doc)
      } catch {
        // Invalid JSON — skip update
      } finally {
        syncing = false
        direction = 'idle'
      }
    }, 500)
  }

  // Calendar → Markdown update (#0017, #0018)
  function onCalendarMdChange(newMd: string) {
    if (syncing) return
    syncing = true
    direction = 'ast-to-md'
    try {
      mdValue = newMd
      astValue = JSON.stringify(parseMarkdown(newMd), null, 2)
    } finally {
      syncing = false
      setTimeout(() => { direction = 'idle' }, 500)
    }
  }
</script>

<div class="layout">
  <!-- Left: Markdown editor -->
  <div class="pane">
    <div class="pane-header">Markdown</div>
    <div class="pane-body">
      <MonacoEditor
        bind:value={mdValue}
        language="md-task"
        onchange={onMdChange}
      />
    </div>
  </div>

  <!-- Center: Direction arrow -->
  <div class="gutter">
    {#if direction === 'md-to-ast'}
      <div class="arrow arrow-right">→</div>
    {:else if direction === 'ast-to-md'}
      <div class="arrow arrow-left">←</div>
    {:else}
      <div class="arrow arrow-idle">⇆</div>
    {/if}
  </div>

  <!-- Right: AST / Calendar tab panel (#0013) -->
  <div class="pane">
    <!-- Tab header -->
    <div class="pane-header tab-header">
      <button
        class="tab-btn {rightTab === 'ast' ? 'active' : ''}"
        onclick={() => rightTab = 'ast'}
      >AST</button>
      <button
        class="tab-btn {rightTab === 'calendar' ? 'active' : ''}"
        onclick={() => rightTab = 'calendar'}
      >Calendar</button>
      <button
        class="tab-btn {rightTab === 'gantt' ? 'active' : ''}"
        onclick={() => rightTab = 'gantt'}
      >Gantt</button>
    </div>

    <!-- Tab content -->
    <div class="pane-body">
      {#if rightTab === 'ast'}
        <MonacoEditor
          bind:value={astValue}
          language="json"
          onchange={onAstChange}
        />
      {:else if rightTab === 'calendar'}
        <CalendarTab
          mdValue={mdValue}
          doc={currentDoc}
          onMdChange={onCalendarMdChange}
        />
      {:else}
        <GanttTab
          mdValue={mdValue}
          doc={currentDoc}
          onMdChange={onCalendarMdChange}
        />
      {/if}
    </div>
  </div>
</div>

<style>
  .layout {
    display: flex;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }

  .pane-header {
    height: 32px;
    line-height: 32px;
    padding: 0 12px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    background: #252526;
    color: #858585;
    border-bottom: 1px solid #333;
    flex-shrink: 0;
  }

  .tab-header {
    display: flex;
    align-items: center;
    padding: 0 4px;
    gap: 2px;
  }

  .tab-btn {
    height: 24px;
    padding: 0 12px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    background: transparent;
    color: #858585;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
    line-height: 24px;
  }

  .tab-btn:hover {
    color: #cccccc;
  }

  .tab-btn.active {
    color: #4ec9b0;
    border-bottom-color: #4ec9b0;
  }

  .pane-body {
    flex: 1;
    overflow: hidden;
  }

  .gutter {
    width: 40px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1e1e1e;
    border-left: 1px solid #333;
    border-right: 1px solid #333;
  }

  .arrow {
    font-size: 18px;
    font-weight: bold;
    transition: color 0.15s, transform 0.15s;
    user-select: none;
  }

  .arrow-right {
    color: #4ec9b0;
    transform: scale(1.2);
  }

  .arrow-left {
    color: #ce9178;
    transform: scale(1.2);
  }

  .arrow-idle {
    color: #555;
  }
</style>

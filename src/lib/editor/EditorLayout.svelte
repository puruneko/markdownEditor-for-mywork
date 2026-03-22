<script lang="ts">
  import MonacoEditor from './MonacoEditor.svelte'
  import { parseMarkdown } from '../parser/md-to-ast'
  import { serializeAst } from '../parser/ast-to-md'
  import type { Document } from '../parser/types'

  // Sync direction state
  type Direction = 'idle' | 'md-to-ast' | 'ast-to-md'
  let direction: Direction = $state('idle')

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
    - [ ] UIレビュー
  - [-] API設計（保留）

## 運用

- 監視
  - [>] ログ監視
    @schedule: 2026-04-20T10:00/2026-04-20T12:00
  - [!] アラート設定（ブロック中）
`

  // Editor values — astValue is initialized from INITIAL_MD once (not reactive to mdValue)
  let mdValue: string = $state(INITIAL_MD)
  let astValue: string = $state(JSON.stringify(parseMarkdown(INITIAL_MD), null, 2))

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

  <!-- Right: AST editor -->
  <div class="pane">
    <div class="pane-header">AST (JSON)</div>
    <div class="pane-body">
      <MonacoEditor
        bind:value={astValue}
        language="json"
        onchange={onAstChange}
      />
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

<script lang="ts">
  import MonacoEditor from './MonacoEditor.svelte'
  import CalendarTab from '../calendar/CalendarTab.svelte'
  import GanttTab from '../gantt/GanttTab.svelte'
  import KanbanTab from '../kanban/KanbanTab.svelte'
  import { parseMarkdown } from '../parser/parse-markdown'
  import { serializeAst } from '../parser/ast-to-md'
  import type { Document, TaskNode, Node } from '../parser/types'
  import type { SourceEntry } from '../viewmodel/contract'
  import { parseGlobalKey } from '../viewmodel/global-key'
  import DEMO_MD from '../../../demo/demo_markdown.md?raw'

  // ── App-wide settings (persisted in localStorage) ──────────────
  const SETTINGS_KEY = 'md-ast-editor-settings'

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY)
      if (raw) return JSON.parse(raw) as Record<string, unknown>
    } catch { /* ignore */ }
    return {}
  }

  function saveSettings(patch: Record<string, unknown>) {
    try {
      const current = loadSettings()
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...patch }))
    } catch { /* ignore */ }
  }

  const _saved = loadSettings()

  let settingsOpen: boolean = $state(false)
  let enableTaskHighlight: boolean = $state((_saved.enableTaskHighlight ?? true) as boolean)
  let debounceMs: number = $state((_saved.debounceMs ?? 300) as number)

  $effect(() => { saveSettings({ enableTaskHighlight }) })
  $effect(() => { saveSettings({ debounceMs }) })

  // computed Monaco language
  const editorLanguage = $derived(enableTaskHighlight ? 'md-task' : 'plaintext')

  // Sync direction state
  type Direction = 'idle' | 'md-to-ast' | 'ast-to-md'
  let direction: Direction = $state('idle')

  // Right panel tab state (#0013, #0020)
  type RightTab = 'ast' | 'calendar' | 'gantt' | 'kanban'
  let rightTab: RightTab = $state('ast')

  // Initial markdown content — demo/demo_markdown.md から静的インポート
  const INITIAL_MD = DEMO_MD

  // Editor values — astValue is initialized from INITIAL_MD once (not reactive to mdValue)
  let mdValue: string = $state(INITIAL_MD)
  let astValue: string = $state(JSON.stringify(parseMarkdown(INITIAL_MD), null, 2))

  // Current parsed document — derived from mdValue for the CalendarTab
  let currentDoc: Document = $derived(parseMarkdown(mdValue))

  // dev モードの単一ソース（パスは固定のダミー）
  const DEV_PATH = 'dev.md'
  let sources: SourceEntry[] = $derived([{ path: DEV_PATH, doc: currentDoc }])

  // ノード id でドキュメントを線形探索
  function findTaskNode(nodes: Node[], id: string): TaskNode | null {
    for (const node of nodes) {
      if (node.type === 'task' && node.id === id) return node
      if ((node.type === 'task' || node.type === 'list') && node.children.length > 0) {
        const found = findTaskNode(node.children, id)
        if (found) return found
      }
    }
    return null
  }

  function findTaskNodeInDoc(doc: Document, localId: string): TaskNode | null {
    for (const section of doc.sections) {
      const found = findTaskNode(section.children, localId)
      if (found) return found
      for (const sub of section.subSections) {
        const foundSub = findTaskNode(sub.children, localId)
        if (foundSub) return foundSub
      }
    }
    return null
  }

  // Calendar/Gantt/Kanban からの書き戻し（globalKey + patcher パターン）
  async function onNodePatch(
    globalKey: string,
    patcher: (md: string, doc: Document, node: TaskNode) => string,
  ): Promise<void> {
    const { localId } = parseGlobalKey(globalKey)
    const node = findTaskNodeInDoc(currentDoc, localId)
    if (!node) return
    const newMd = patcher(mdValue, currentDoc, node)
    onCalendarMdChange(newMd)
  }

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
    }, debounceMs)
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

  // #0026: カレンダー/ガントアイテムクリック → Monaco エディタの対応行へスクロール
  let revealInEditor: ((line: number) => void) | null = null

  function handleNodeClick(globalKey: string) {
    const { localId } = parseGlobalKey(globalKey)
    const line = currentDoc.nodeLineMap.get(localId)
    if (line !== undefined) revealInEditor?.(line)
  }
</script>

<div class="layout">
  <!-- Left: Markdown editor -->
  <div class="pane">
    <div class="pane-header">
      <span class="pane-title">Markdown</span>
      <button
        class="settings-btn {settingsOpen ? 'active' : ''}"
        onclick={() => settingsOpen = !settingsOpen}
        title="設定"
        aria-label="アプリ設定を開く"
      >⚙</button>
    </div>

    {#if settingsOpen}
      <div class="settings-panel">
        <div class="settings-row">
          <label class="settings-label" for="setting-task-highlight">タスクハイライト</label>
          <input
            id="setting-task-highlight"
            type="checkbox"
            bind:checked={enableTaskHighlight}
            class="settings-check"
          />
        </div>
        <div class="settings-row">
          <label class="settings-label" for="setting-debounce">同期デバウンス (ms)</label>
          <input
            id="setting-debounce"
            type="number"
            min="0"
            max="5000"
            step="50"
            bind:value={debounceMs}
            class="settings-input"
          />
        </div>
      </div>
    {/if}

    <div class="pane-body">
      <MonacoEditor
        bind:value={mdValue}
        language={editorLanguage}
        onchange={onMdChange}
        registerReveal={(fn) => { revealInEditor = fn }}
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
      <button
        class="tab-btn {rightTab === 'kanban' ? 'active' : ''}"
        onclick={() => rightTab = 'kanban'}
      >Kanban</button>
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
          {sources}
          {onNodePatch}
          onNodeClick={handleNodeClick}
        />
      {:else if rightTab === 'gantt'}
        <GanttTab
          {sources}
          {onNodePatch}
          onNodeClick={handleNodeClick}
        />
      {:else}
        <KanbanTab
          {sources}
          {onNodePatch}
          onNodeClick={handleNodeClick}
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
    padding: 0 8px 0 12px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    background: #252526;
    color: #858585;
    border-bottom: 1px solid #333;
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  .pane-title {
    flex: 1;
  }

  .settings-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: #858585;
    font-size: 14px;
    cursor: pointer;
    border-radius: 3px;
    transition: color 0.15s, background 0.15s;
    line-height: 1;
    padding: 0;
  }

  .settings-btn:hover {
    color: #cccccc;
    background: #3a3a3a;
  }

  .settings-btn.active {
    color: #4ec9b0;
    background: #2a3a38;
  }

  .settings-panel {
    background: #1e1e1e;
    border-bottom: 1px solid #444;
    padding: 8px 12px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .settings-row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
  }

  .settings-label {
    color: #cccccc;
    flex: 1;
    user-select: none;
  }

  .settings-check {
    width: 14px;
    height: 14px;
    cursor: pointer;
    accent-color: #4ec9b0;
  }

  .settings-input {
    width: 70px;
    background: #2d2d2d;
    border: 1px solid #555;
    border-radius: 3px;
    color: #cccccc;
    font-size: 12px;
    padding: 2px 6px;
    text-align: right;
  }

  .settings-input:focus {
    outline: 1px solid #4ec9b0;
    border-color: #4ec9b0;
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

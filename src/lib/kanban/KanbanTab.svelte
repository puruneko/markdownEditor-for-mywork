<script lang="ts">
  import { KanbanBoard } from 'svelte-kanban-lib'
  import type { CardData, CardMoveEvent, ConfigChangeEvent, LaneDefinition } from 'svelte-kanban-lib'
  import type { KanbanBoardConfig } from 'svelte-kanban-lib'
  import {
    extractKanbanCards,
    createKanbanConfig,
    DEFAULT_KANBAN_CONFIG,
    KANBAN_FIELD_DEFINITIONS,
  } from './ast-to-kanban'
  import type { KanbanCard } from './ast-to-kanban'
  import { patchNodeStatus } from '../calendar/markdown-patch'
  import type { Document, TaskNode, Status } from '../parser/types'
  import type { SourceEntry } from '../viewmodel/contract'
  import { makeGlobalKey } from '../viewmodel/global-key'
  import { MD_TASK_MIME } from '../../editor/task-drag-source'
  import type { TaskDragPayload } from '../../editor/task-drag-source'

  interface Props {
    /** 複数ソース（ファイルパスと Document のペア）— カード抽出とキーの名前空間化に使用 */
    sources: SourceEntry[]
    /** globalKey を受けて該当ファイルへ書き戻す非同期コールバック */
    onNodePatch: (globalKey: string, patcher: (md: string, doc: Document, node: TaskNode) => string) => Promise<void>
    /** カードクリック時に globalKey を通知するコールバック */
    onNodeClick?: (globalKey: string) => void
  }

  let { sources, onNodePatch, onNodeClick }: Props = $props()

  // カード抽出（sources 変化のたびに再計算）
  const cards: KanbanCard[] = $derived(extractKanbanCards(sources))

  $effect(() => {
    const withDesc = cards.filter(c => c.description)
    console.debug('[KanbanTab] cards derived', {
      total: cards.length,
      withDescription: withDesc.length,
      sample: withDesc.slice(0, 3).map(c => ({ id: c.id, title: c.title, description: c.description })),
    })
  })

  // ユーザーがカスタマイズできるレーン定義と board 設定
  let userLanes: LaneDefinition[] = $state([...DEFAULT_KANBAN_CONFIG.lanes])
  let userGroupBy = $state<string>('section')
  let userSectionDepth = $state<number>(2)
  let allowCrossGroupMove = $state(false)
  let cardTitleMultiline = $state(false)

  const config: KanbanBoardConfig = $derived({
    ...createKanbanConfig(cards, userGroupBy, userSectionDepth),
    lanes: userLanes,
    allowCrossGroupMove,
    cardTitleMultiline,
  })

  function handleCardMove(event: CardMoveEvent): void {
    const { card, updatedCard } = event
    const newStatus = updatedCard.status as Status
    // card.id は globalKey — patchInFile が該当ファイルを解決して書き戻す
    void onNodePatch(card.id, (md, _doc, node) => patchNodeStatus(md, node, newStatus))
  }

  // ----------------------------------------------------------------
  // 外部ドロップ（エディタからのタスク DnD）
  // ----------------------------------------------------------------

  const VALID_STATUSES = new Set<string>(['todo', 'doing', 'done', 'blocked', 'hold'])

  function handleExternalDragOver(e: DragEvent) {
    if (!e.dataTransfer?.types.includes(MD_TASK_MIME)) return
    const target = e.target as HTMLElement
    if (!target.closest?.('[data-lane-id]')) return
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }

  function handleExternalDrop(e: DragEvent) {
    const raw = e.dataTransfer?.getData(MD_TASK_MIME)
    if (!raw) return

    // status grouping のときのみ対応（lane ID = status 値）
    if (userGroupBy !== 'status') return

    let payload: TaskDragPayload
    try { payload = JSON.parse(raw) } catch { return }

    const target = e.target as HTMLElement
    const laneEl = target.closest?.('[data-lane-id]') as HTMLElement | null
    if (!laneEl) return

    const laneId = laneEl.getAttribute('data-lane-id')
    if (!laneId || !VALID_STATUSES.has(laneId)) return

    const globalKey = makeGlobalKey(payload.sourcePath, payload.nodeId)
    void onNodePatch(globalKey, (md, _doc, node) => patchNodeStatus(md, node, laneId as Status))
  }

  function handleConfigChange(event: ConfigChangeEvent): void {
    userLanes = event.config.lanes
    userGroupBy = event.config.groupBy ?? 'section'
    userSectionDepth = event.config.sectionDepth ?? 2
    allowCrossGroupMove = event.config.allowCrossGroupMove ?? false
    cardTitleMultiline = event.config.cardTitleMultiline ?? false
  }
</script>

{#snippet cardContent(card: CardData)}
  {@const c = card as KanbanCard}
  <div
    class="kanban-card-inner"
    role="button"
    tabindex="0"
    onpointerdown={(e) => {
      // KanbanCard calls e.preventDefault() on pointerdown (for DnD), which suppresses
      // the click event. Work around by tracking movement via window pointerup capture.
      const startX = e.clientX
      const startY = e.clientY
      const id = card.id  // globalKey
      const handleUp = (evt: PointerEvent): void => {
        window.removeEventListener('pointerup', handleUp, true)
        const dx = evt.clientX - startX
        const dy = evt.clientY - startY
        if (dx * dx + dy * dy < 64) onNodeClick?.(id)  // < 8px = click
      }
      window.addEventListener('pointerup', handleUp, { capture: true, once: true })
    }}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') onNodeClick?.(card.id) }}
  >
    <div class="card-title">{c.title}</div>
    {#if c.due}
      <div class="card-meta">期限: {c.due}</div>
    {/if}
    {#if c.priority !== undefined}
      <div class="card-meta">優先度: {c.priority}</div>
    {/if}
  </div>
{/snippet}

<div
  class="kanban-tab"
  ondragover={handleExternalDragOver}
  ondrop={handleExternalDrop}
>
  <KanbanBoard
    {cards}
    {config}
    fieldDefinitions={KANBAN_FIELD_DEFINITIONS}
    cardSnippet={cardContent}
    onCardMove={handleCardMove}
    onConfigChange={handleConfigChange}
  />
</div>

<style>
  /* ------------------------------------------------------------------
   * CSS custom properties — Obsidian変数を優先し、ブラウザダーク環境では
   * フォールバック値を使用する。
   * ------------------------------------------------------------------ */
  .kanban-tab {
    width: 100%;
    height: 100%;
    overflow: hidden;

    /* Board */
    --kanban-bg:               var(--background-primary,     #1e1e1e);
    --kanban-font:             var(--font-interface,         system-ui, sans-serif);

    /* Toolbar */
    --kanban-toolbar-bg:       var(--background-primary-alt, #252526);
    --kanban-toolbar-border:   var(--background-modifier-border, #404040);

    /* Buttons */
    --kanban-btn-bg:           var(--interactive-normal,     #2d2d30);
    --kanban-btn-hover-bg:     var(--interactive-hover,      #3e3e42);
    --kanban-btn-color:        var(--text-normal,            #cccccc);

    /* Lanes */
    --kanban-lane-width:       220px;
    --kanban-lane-gap:         8px;
    --kanban-lanes-padding:    12px;
    --kanban-lane-padding:     8px;
    --kanban-lane-radius:      6px;
    --kanban-lane-bg:          var(--background-secondary,   #252526);
    --kanban-lane-border:      var(--background-modifier-border, #404040);
    --kanban-lane-header-bg:   var(--background-secondary-alt, #2d2d30);
    --kanban-lane-title-color: var(--text-normal,            #d4d4d4);
    --kanban-lane-count-bg:    var(--background-modifier-border, #3e3e42);
    --kanban-lane-count-color: var(--text-muted,             #858585);

    /* Cards */
    --kanban-card-bg:          var(--background-primary,     #1e1e1e);
    --kanban-card-border:      var(--background-modifier-border, #404040);
    --kanban-card-radius:      4px;
    --kanban-card-padding:     8px 10px;
    --kanban-card-gap:         6px;
    --kanban-card-key-color:   var(--text-accent,            #9cdcfe);
    --kanban-card-value-color: var(--text-normal,            #d4d4d4);
    --kanban-card-id-color:    var(--text-faint,             #4ec9b0);

    /* Groups */
    --kanban-group-border:              var(--background-modifier-border, #404040);
    --kanban-group-header-bg:           var(--background-secondary-alt,   #2d2d30);
    --kanban-group-header-hover-bg:     var(--background-modifier-hover,  #3e3e42);
    --kanban-group-label-color:         var(--text-normal,                #cccccc);
    --kanban-group-count-bg:            var(--background-modifier-border,  #3e3e42);
    --kanban-group-count-color:         var(--text-muted,                  #858585);
    --kanban-group-accent:              var(--interactive-accent,          #4ec9b0);
    --kanban-group-header-height:       43px;
    --kanban-section-header-bg:         var(--background-primary-alt,     #252526);
    --kanban-section-header-hover-bg:   var(--background-modifier-hover,  #2d2d30);
    --kanban-group-children-border:     var(--interactive-accent,         #4ec9b0);
    --kanban-group-children-border-l2:  var(--background-modifier-border, #404040);
    --kanban-group-children-border-l3:  var(--background-modifier-border, #3a3a3a);

    /* Accent / Filter */
    --kanban-accent:               var(--interactive-accent,      #4ec9b0);
    --kanban-filter-bg:            var(--background-primary,      #252526);
    --kanban-filter-border:        var(--background-modifier-border, #404040);
    --kanban-filter-nested-bg:     var(--background-secondary,    #2d2d30);
    --kanban-filter-nested-border: var(--background-modifier-border, #404040);
  }

  .kanban-card-inner {
    cursor: pointer;
    padding: 4px 2px;
    width: 100%;
  }

  .kanban-card-inner:hover .card-title {
    color: var(--interactive-accent, #4ec9b0);
  }

  .card-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-normal, #cccccc);
    line-height: 1.4;
    word-break: break-word;
    transition: color 0.1s;
  }

  .card-meta {
    font-size: 11px;
    color: var(--text-muted, #888);
    margin-top: 3px;
  }
</style>

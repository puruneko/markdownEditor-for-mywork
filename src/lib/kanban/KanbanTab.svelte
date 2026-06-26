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
  import { findNodeById, patchNodeStatus } from '../calendar/markdown-patch'
  import type { Document, Status } from '../parser/types'

  interface Props {
    /** Raw markdown string — patch target */
    mdValue: string
    /** Parsed AST — card extraction and node lookup */
    doc: Document
    onMdChange: (newMd: string) => void
    /** カードクリック時にノードIDを通知するコールバック */
    onNodeClick?: (nodeId: string) => void
  }

  let { mdValue, doc, onMdChange, onNodeClick }: Props = $props()

  // カード抽出（doc 変化のたびに再計算）
  const cards: KanbanCard[] = $derived(extractKanbanCards(doc))

  // ユーザーがカスタマイズできるレーン定義と board 設定
  let userLanes: LaneDefinition[] = $state([...DEFAULT_KANBAN_CONFIG.lanes])
  let userGroupBy = $state<string>('section')
  let userSectionDepth = $state<number>(2)
  let allowCrossGroupMove = $state(false)
  let cardTitleMultiline = $state(false)

  // ライブラリの section 配列フィールド + sectionDepth を使った config を生成する。
  // groups 定義は渡さず、ライブラリがカードから自動収集する。
  const config: KanbanBoardConfig = $derived({
    ...createKanbanConfig(cards, userGroupBy, userSectionDepth),
    lanes: userLanes,
    allowCrossGroupMove,
    cardTitleMultiline,
  })

  function handleCardMove(event: CardMoveEvent): void {
    const { card, updatedCard } = event
    const node = findNodeById(doc, card.id)
    if (!node) return
    const newStatus = updatedCard.status as Status
    const newMd = patchNodeStatus(mdValue, node, newStatus)
    if (newMd !== mdValue) onMdChange(newMd)
  }

  // ユーザーが変更したすべての board 設定を保持する
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
      const id = card.id
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

<div class="kanban-tab">
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
   * Obsidian では :root / body に --background-primary 等が定義されているため
   * var(--obsidian-var, fallback) が正しく解決される。
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
    --kanban-group-border:          var(--background-modifier-border, #404040);
    --kanban-group-header-bg:       var(--background-secondary-alt,   #2d2d30);
    --kanban-group-header-hover-bg: var(--background-modifier-hover,  #3e3e42);
    --kanban-group-label-color:     var(--text-normal,                #cccccc);
    --kanban-group-count-bg:        var(--background-modifier-border,  #3e3e42);
    --kanban-group-count-color:     var(--text-muted,                  #858585);
    --kanban-group-accent:          var(--interactive-accent,          #4ec9b0);

    /* Accent / Filter */
    --kanban-accent:               var(--interactive-accent,      #4ec9b0);
    --kanban-filter-bg:            var(--background-primary,      #252526);
    --kanban-filter-border:        var(--background-modifier-border, #404040);
    --kanban-filter-nested-bg:     var(--background-secondary,    #2d2d30);
    --kanban-filter-nested-border: var(--background-modifier-border, #404040);
  }

  /* カスタムカードスニペットのスタイル */
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

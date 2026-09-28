<script lang="ts">
  import { KanbanBoard, HIERARCHY_GROUP_BY } from 'svelte-kanban-lib'
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
  import type { KanbanUserConfig } from './kanban-user-config'
  import { makeGlobalKey } from '../viewmodel/global-key'
  import { MD_TASK_MIME } from '../../editor/task-drag-source'
  import type { TaskDragPayload } from '../../editor/task-drag-source'
  import { STATUS_BY_MARKER } from '../contract/canonical'

  interface Props {
    /** 複数ソース（ファイルパスと Document のペア）— カード抽出とキーの名前空間化に使用 */
    sources: SourceEntry[]
    /** globalKey を受けて該当ファイルへ書き戻す非同期コールバック */
    onNodePatch: (globalKey: string, patcher: (md: string, doc: Document, node: TaskNode) => string) => Promise<void>
    /** カードクリック時に globalKey を通知するコールバック */
    onNodeClick?: (globalKey: string) => void
    /** 設定ハブから読み込んだ、永続化済みのユーザー設定（レーン・グルーピング等）。 */
    initialUserConfig?: Partial<KanbanUserConfig>
    /** ユーザー設定が変化するたびに呼ばれる、設定ハブへの永続化コールバック。 */
    onUserConfigChange?: (config: KanbanUserConfig) => void
  }

  let { sources, onNodePatch, onNodeClick, initialUserConfig, onUserConfigChange }: Props = $props()

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
  // （issue-phase010-markdownEditor-005: 設定ハブから読み込んだ initialUserConfig で初期化する）
  let userLanes: LaneDefinition[] = $state(initialUserConfig?.lanes ?? [...DEFAULT_KANBAN_CONFIG.lanes])
  // 既定は階層グルーピング（見出し階層でカードをグループ化）
  let userGroupBy = $state<string>(initialUserConfig?.groupBy ?? HIERARCHY_GROUP_BY)
  let headingLevel = $state<number>(initialUserConfig?.headingLevel ?? 2)
  let showUnits = $state<boolean>(initialUserConfig?.showUnits ?? false)
  let allowCrossGroupMove = $state(initialUserConfig?.allowCrossGroupMove ?? false)
  let cardTitleMultiline = $state(initialUserConfig?.cardTitleMultiline ?? false)

  const config: KanbanBoardConfig = $derived({
    ...createKanbanConfig(cards, headingLevel, showUnits),
    lanes: userLanes,
    groupBy: userGroupBy,
    headingLevel,
    showUnits,
    allowCrossGroupMove,
    cardTitleMultiline,
    theme: 'light',
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

  const VALID_STATUSES = new Set<string>(Object.values(STATUS_BY_MARKER))

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
    userGroupBy = event.config.groupBy ?? HIERARCHY_GROUP_BY
    headingLevel = event.config.headingLevel ?? 2
    showUnits = event.config.showUnits ?? false
    allowCrossGroupMove = event.config.allowCrossGroupMove ?? false
    cardTitleMultiline = event.config.cardTitleMultiline ?? false
    onUserConfigChange?.({
      lanes: userLanes,
      groupBy: userGroupBy,
      headingLevel,
      showUnits,
      allowCrossGroupMove,
      cardTitleMultiline,
    })
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
   * CSS custom properties — issue-phase012-markdownEditor-001: テーマ遮断方針の
   * 徹底のため、Obsidian の背景・文字・アクセントカラー変数を参照する宣言は削除した
   * （宣言が無ければ kanban ライブラリ側の既定フォールバック機構により、
   * ライブラリ自身の明るい既定色がそのまま使われる。ライブラリ側は変更不要）。
   * レイアウト値（幅・余白・角丸等）は Obsidian 変数を参照していないため残す。
   * ------------------------------------------------------------------ */
  .kanban-tab {
    width: 100%;
    height: 100%;
    overflow: hidden;

    /* Board */
    --kanban-font:             var(--font-interface,         system-ui, sans-serif);

    /* Lanes */
    --kanban-lane-width:       220px;
    --kanban-lane-gap:         8px;
    --kanban-lanes-padding:    12px;
    --kanban-lane-padding:     8px;
    --kanban-lane-radius:      6px;

    /* Cards */
    --kanban-card-radius:      4px;
    --kanban-card-padding:     8px 10px;
    --kanban-card-gap:         6px;

    /* Groups */
    --kanban-group-header-height:       43px;
  }

  .kanban-card-inner {
    cursor: pointer;
    padding: 4px 2px;
    width: 100%;
  }

  .kanban-card-inner:hover .card-title {
    color: var(--host-accent);
  }

  .card-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--host-text);
    line-height: 1.4;
    word-break: break-word;
    transition: color 0.1s;
  }

  .card-meta {
    font-size: 11px;
    color: var(--host-text-muted);
    margin-top: 3px;
  }
</style>

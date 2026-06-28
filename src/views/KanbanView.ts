import { WorkspaceLeaf } from 'obsidian'
import type { Component } from 'svelte'
import KanbanViewMount from './KanbanViewMount.svelte'
import type { FileSync } from '../sync/file-sync'
import type { AstIndex } from '../sync/ast-index'
import type { EditorEventBus } from '../sync/editor-event-bus'
import { ShadowItemView } from './ShadowItemView'
import type { ViewMountProps } from './ShadowItemView'

export const KANBAN_VIEW_TYPE = 'md-ast-editor-kanban-view'

export class KanbanView extends ShadowItemView {
  constructor(leaf: WorkspaceLeaf, fileSync: FileSync, editorEventBus: EditorEventBus, astIndex?: AstIndex) {
    super(leaf, fileSync, editorEventBus, astIndex)
  }

  getViewType(): string { return KANBAN_VIEW_TYPE }
  getDisplayText(): string { return 'Kanban View' }
  getIcon(): string { return 'layout-grid' }

  protected getViewClass(): string { return 'kanban-view' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected getMountComponent(): Component<ViewMountProps, any, any> {
    return KanbanViewMount
  }
}

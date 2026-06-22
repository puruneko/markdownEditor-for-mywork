import { WorkspaceLeaf } from 'obsidian'
import type { Component } from 'svelte'
import GanttViewMount from './GanttViewMount.svelte'
import type { FileSync } from '../sync/file-sync'
import type { EditorEventBus } from '../sync/editor-event-bus'
import { ShadowItemView } from './ShadowItemView'
import type { ViewMountProps } from './ShadowItemView'

export const GANTT_VIEW_TYPE = 'md-ast-editor-gantt-view'

export class GanttView extends ShadowItemView {
  constructor(leaf: WorkspaceLeaf, fileSync: FileSync, editorEventBus: EditorEventBus) {
    super(leaf, fileSync, editorEventBus)
  }

  getViewType(): string { return GANTT_VIEW_TYPE }
  getDisplayText(): string { return 'Gantt View' }
  getIcon(): string { return 'bar-chart-2' }

  protected getViewClass(): string { return 'gantt-view' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected getMountComponent(): Component<ViewMountProps, any, any> {
    return GanttViewMount
  }
}

import { WorkspaceLeaf } from 'obsidian'
import type { Component } from 'svelte'
import GanttViewMount from './GanttViewMount.svelte'
import type { FileSync } from '../sync/file-sync'
import type { AstIndex } from '../sync/ast-index'
import type { EditorEventBus } from '../sync/editor-event-bus'
import type { MdAstEditorSettings } from '../settings'
import { ShadowItemView } from './ShadowItemView'
import type { ViewMountProps } from './ShadowItemView'

export const GANTT_VIEW_TYPE = 'md-ast-editor-gantt-view'

export class GanttView extends ShadowItemView {
  private settings: MdAstEditorSettings

  constructor(
    leaf: WorkspaceLeaf,
    settings: MdAstEditorSettings,
    fileSync: FileSync,
    editorEventBus: EditorEventBus,
    astIndex?: AstIndex,
  ) {
    super(leaf, fileSync, editorEventBus, astIndex)
    this.settings = settings
  }

  getViewType(): string { return GANTT_VIEW_TYPE }
  getDisplayText(): string { return 'Gantt View' }
  getIcon(): string { return 'bar-chart-2' }

  protected getViewClass(): string { return 'gantt-view' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected getMountComponent(): Component<ViewMountProps, any, any> {
    return GanttViewMount
  }

  protected getExtraMountProps(): Record<string, unknown> {
    return { expandSubtasks: this.settings.ganttExpandSubtasks }
  }
}

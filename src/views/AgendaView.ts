import { WorkspaceLeaf } from 'obsidian'
import type { Component } from 'svelte'
import AgendaViewMount from './AgendaViewMount.svelte'
import type { FileSync } from '../sync/file-sync'
import type { AstIndex } from '../sync/ast-index'
import type { EditorEventBus } from '../sync/editor-event-bus'
import { ShadowItemView } from './ShadowItemView'
import type { ViewMountProps } from './ShadowItemView'

export const AGENDA_VIEW_TYPE = 'md-ast-editor-agenda-view'

export class AgendaView extends ShadowItemView {
  constructor(leaf: WorkspaceLeaf, fileSync: FileSync, editorEventBus: EditorEventBus, astIndex?: AstIndex) {
    super(leaf, fileSync, editorEventBus, astIndex)
  }

  getViewType(): string { return AGENDA_VIEW_TYPE }
  getDisplayText(): string { return 'Agenda View' }
  getIcon(): string { return 'calendar-check' }

  protected getViewClass(): string { return 'agenda-view' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected getMountComponent(): Component<ViewMountProps, any, any> {
    return AgendaViewMount
  }
}

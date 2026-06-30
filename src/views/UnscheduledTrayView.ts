import { WorkspaceLeaf } from 'obsidian'
import type { Component } from 'svelte'
import UnscheduledTrayViewMount from './UnscheduledTrayViewMount.svelte'
import type { FileSync } from '../sync/file-sync'
import type { AstIndex } from '../sync/ast-index'
import type { EditorEventBus } from '../sync/editor-event-bus'
import { ShadowItemView } from './ShadowItemView'
import type { ViewMountProps } from './ShadowItemView'

export const UNSCHEDULED_TRAY_VIEW_TYPE = 'md-ast-editor-unscheduled-tray-view'

export class UnscheduledTrayView extends ShadowItemView {
  constructor(leaf: WorkspaceLeaf, fileSync: FileSync, editorEventBus: EditorEventBus, astIndex?: AstIndex) {
    super(leaf, fileSync, editorEventBus, astIndex)
  }

  getViewType(): string { return UNSCHEDULED_TRAY_VIEW_TYPE }
  getDisplayText(): string { return 'Unscheduled Tray' }
  getIcon(): string { return 'inbox' }

  protected getViewClass(): string { return 'unscheduled-tray-view' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected getMountComponent(): Component<ViewMountProps, any, any> {
    return UnscheduledTrayViewMount
  }
}

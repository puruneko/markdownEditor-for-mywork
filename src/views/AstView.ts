import type { WorkspaceLeaf } from 'obsidian'
import type { Component } from 'svelte'
import { ShadowItemView } from './ShadowItemView'
import type { ViewMountProps } from './ShadowItemView'
import AstViewMount from './AstViewMount.svelte'
import type { FileSync } from '../sync/file-sync'
import type { EditorEventBus } from '../sync/editor-event-bus'

export const AST_VIEW_TYPE = 'md-ast-editor-ast-view'

export class AstView extends ShadowItemView {
  constructor(leaf: WorkspaceLeaf, fileSync: FileSync, editorEventBus: EditorEventBus) {
    super(leaf, fileSync, editorEventBus)
  }

  getViewType(): string { return AST_VIEW_TYPE }
  getDisplayText(): string { return 'AST View' }
  getIcon(): string { return 'code-2' }
  protected getViewClass(): string { return 'ast-view-container' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected getMountComponent(): Component<ViewMountProps, any, any> {
    return AstViewMount as Component<ViewMountProps, any, any>
  }
}

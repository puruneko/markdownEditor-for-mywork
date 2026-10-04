import type { WorkspaceLeaf } from 'obsidian'
import type { Component } from 'svelte'
import { ShadowItemView } from './ShadowItemView'
import type { ViewMountProps } from './ShadowItemView'
import ParseDebugViewMount from './ParseDebugViewMount.svelte'
import type { FileSync } from '../sync/file-sync'
import type { AstIndex } from '../sync/ast-index'
import type { EditorEventBus } from '../sync/editor-event-bus'

export const PARSE_DEBUG_VIEW_TYPE = 'md-ast-editor-parse-debug-view'

/** パース済み Document を確認するデバッグ用パネル（issue-phase015-markdownEditor-005）。 */
export class ParseDebugView extends ShadowItemView {
  constructor(leaf: WorkspaceLeaf, fileSync: FileSync, editorEventBus: EditorEventBus, astIndex?: AstIndex) {
    super(leaf, fileSync, editorEventBus, astIndex)
  }

  getViewType(): string { return PARSE_DEBUG_VIEW_TYPE }
  getDisplayText(): string { return 'Parse Debug' }
  getIcon(): string { return 'bug' }
  protected getViewClass(): string { return 'parse-debug-view-container' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected getMountComponent(): Component<ViewMountProps, any, any> {
    return ParseDebugViewMount as Component<ViewMountProps, any, any>
  }
}

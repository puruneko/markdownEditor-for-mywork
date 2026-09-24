import { WorkspaceLeaf } from 'obsidian'
import type { Component } from 'svelte'
import DashboardViewMount from './DashboardViewMount.svelte'
import type { FileSync } from '../sync/file-sync'
import type { AstIndex } from '../sync/ast-index'
import type { EditorEventBus } from '../sync/editor-event-bus'
import type { SourceEntry } from '../lib/viewmodel/contract'
import { filterClosedProjects } from '../lib/viewmodel/filter-closed-projects'
import { ShadowItemView } from './ShadowItemView'
import type { ViewMountProps } from './ShadowItemView'

export const DASHBOARD_VIEW_TYPE = 'md-ast-editor-dashboard-view'

export class DashboardView extends ShadowItemView {
  constructor(leaf: WorkspaceLeaf, fileSync: FileSync, editorEventBus: EditorEventBus, astIndex?: AstIndex) {
    super(leaf, fileSync, editorEventBus, astIndex)
  }

  getViewType(): string { return DASHBOARD_VIEW_TYPE }
  getDisplayText(): string { return 'Dashboard View' }
  getIcon(): string { return 'layout-dashboard' }

  protected getViewClass(): string { return 'dashboard-view' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected getMountComponent(): Component<ViewMountProps, any, any> {
    return DashboardViewMount
  }

  // issue-phase010-markdownEditor-007: クローズ案件を投影の手前で一括除外する。
  protected getSources(): SourceEntry[] {
    return filterClosedProjects(super.getSources())
  }
}

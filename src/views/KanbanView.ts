import { WorkspaceLeaf } from 'obsidian'
import type { Component } from 'svelte'
import KanbanViewMount from './KanbanViewMount.svelte'
import type { FileSync } from '../sync/file-sync'
import type { AstIndex } from '../sync/ast-index'
import type { EditorEventBus } from '../sync/editor-event-bus'
import type { ViewSettingsHub } from '../settings-hub'
import type { KanbanUserConfig } from '../lib/kanban/kanban-user-config'
import type { SourceEntry } from '../lib/viewmodel/contract'
import { filterClosedProjects } from '../lib/viewmodel/filter-closed-projects'
import { ShadowItemView } from './ShadowItemView'
import type { ViewMountProps } from './ShadowItemView'

export const KANBAN_VIEW_TYPE = 'md-ast-editor-kanban-view'
const KANBAN_SETTINGS_NAMESPACE = 'kanban'

export class KanbanView extends ShadowItemView {
  private settingsHub: ViewSettingsHub

  constructor(
    leaf: WorkspaceLeaf,
    fileSync: FileSync,
    editorEventBus: EditorEventBus,
    settingsHub: ViewSettingsHub,
    astIndex?: AstIndex,
  ) {
    super(leaf, fileSync, editorEventBus, astIndex)
    this.settingsHub = settingsHub
  }

  getViewType(): string { return KANBAN_VIEW_TYPE }
  getDisplayText(): string { return 'Kanban View' }
  getIcon(): string { return 'layout-grid' }

  protected getViewClass(): string { return 'kanban-view' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected getMountComponent(): Component<ViewMountProps, any, any> {
    return KanbanViewMount
  }

  protected getExtraMountProps(): Record<string, unknown> {
    return {
      initialUserConfig: this.settingsHub.get<KanbanUserConfig>(KANBAN_SETTINGS_NAMESPACE),
      onUserConfigChange: (config: KanbanUserConfig) =>
        this.settingsHub.set<KanbanUserConfig>(KANBAN_SETTINGS_NAMESPACE, config),
    }
  }

  // issue-phase010-markdownEditor-007: クローズ案件を投影の手前で一括除外する。
  protected getSources(): SourceEntry[] {
    return filterClosedProjects(super.getSources())
  }
}

import { WorkspaceLeaf } from 'obsidian'
import type { Component } from 'svelte'
import CalendarViewMount from './CalendarViewMount.svelte'
import type { FileSync } from '../sync/file-sync'
import type { AstIndex } from '../sync/ast-index'
import type { EditorEventBus } from '../sync/editor-event-bus'
import type { ViewSettingsHub } from '../settings-hub'
import { createHubStorageBackend } from '../lib/calendar/hub-storage-backend'
import type { SourceEntry } from '../lib/viewmodel/contract'
import { filterClosedProjects } from '../lib/viewmodel/filter-closed-projects'
import { ShadowItemView } from './ShadowItemView'
import type { ViewMountProps } from './ShadowItemView'

export const CALENDAR_VIEW_TYPE = 'md-ast-editor-calendar-view'

export class CalendarView extends ShadowItemView {
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

  getViewType(): string { return CALENDAR_VIEW_TYPE }
  getDisplayText(): string { return 'Calendar View' }
  getIcon(): string { return 'calendar' }

  protected getViewClass(): string { return 'calendar-view' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected getMountComponent(): Component<ViewMountProps, any, any> {
    return CalendarViewMount
  }

  protected getExtraMountProps(): Record<string, unknown> {
    return { storageBackend: createHubStorageBackend(this.settingsHub) }
  }

  // issue-phase010-markdownEditor-007: クローズ案件を投影の手前で一括除外する。
  protected getSources(): SourceEntry[] {
    return filterClosedProjects(super.getSources())
  }
}

import { WorkspaceLeaf } from 'obsidian'
import type { Component } from 'svelte'
import CalendarViewMount from './CalendarViewMount.svelte'
import type { FileSync } from '../sync/file-sync'
import type { AstIndex } from '../sync/ast-index'
import type { EditorEventBus } from '../sync/editor-event-bus'
import { ShadowItemView } from './ShadowItemView'
import type { ViewMountProps } from './ShadowItemView'

export const CALENDAR_VIEW_TYPE = 'md-ast-editor-calendar-view'

export class CalendarView extends ShadowItemView {
  constructor(leaf: WorkspaceLeaf, fileSync: FileSync, editorEventBus: EditorEventBus, astIndex?: AstIndex) {
    super(leaf, fileSync, editorEventBus, astIndex)
  }

  getViewType(): string { return CALENDAR_VIEW_TYPE }
  getDisplayText(): string { return 'Calendar View' }
  getIcon(): string { return 'calendar' }

  protected getViewClass(): string { return 'calendar-view' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected getMountComponent(): Component<ViewMountProps, any, any> {
    return CalendarViewMount
  }
}

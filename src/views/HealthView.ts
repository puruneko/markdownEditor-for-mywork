import { WorkspaceLeaf } from 'obsidian'
import type { Component } from 'svelte'
import HealthViewMount from './HealthViewMount.svelte'
import type { FileSync } from '../sync/file-sync'
import type { AstIndex } from '../sync/ast-index'
import type { EditorEventBus } from '../sync/editor-event-bus'
import type { MdAstEditorSettings } from '../settings'
import type { HealthConfig } from '../lib/health/rules'
import { ShadowItemView } from './ShadowItemView'
import type { ViewMountProps } from './ShadowItemView'

export const HEALTH_VIEW_TYPE = 'md-ast-editor-health-view'

export class HealthView extends ShadowItemView {
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

  getViewType(): string { return HEALTH_VIEW_TYPE }
  getDisplayText(): string { return 'Health Check' }
  getIcon(): string { return 'stethoscope' }

  protected getViewClass(): string { return 'health-view' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected getMountComponent(): Component<ViewMountProps, any, any> {
    return HealthViewMount
  }

  protected getExtraMountProps(): Record<string, unknown> {
    const config: HealthConfig = {
      staleDays: this.settings.healthStaleDays,
      rules: { ...this.settings.healthRules },
    }
    return { config }
  }
}

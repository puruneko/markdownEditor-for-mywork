import { Plugin } from 'obsidian'
import { AstView, AST_VIEW_TYPE } from './views/AstView'
import { CalendarView, CALENDAR_VIEW_TYPE } from './views/CalendarView'
import { GanttView, GANTT_VIEW_TYPE } from './views/GanttView'
import { FileSync } from './sync/file-sync'
import { taskDecorationPlugin } from './editor/task-decoration'
import { MdAstEditorSettingTab, DEFAULT_SETTINGS } from './settings'
import type { MdAstEditorSettings } from './settings'

export class MdAstEditorPlugin extends Plugin {
  private fileSync!: FileSync
  settings!: MdAstEditorSettings

  async onload(): Promise<void> {
    await this.loadSettings()

    this.fileSync = new FileSync(this.app)

    this.registerView(
      AST_VIEW_TYPE,
      (leaf) => new AstView(leaf, this.fileSync),
    )

    this.registerView(
      CALENDAR_VIEW_TYPE,
      (leaf) => new CalendarView(leaf, this.fileSync),
    )

    this.registerView(
      GANTT_VIEW_TYPE,
      (leaf) => new GanttView(leaf, this.fileSync),
    )

    this.addCommand({
      id: 'open-ast-view',
      name: 'AST View を開く',
      callback: () => void this.openView(AST_VIEW_TYPE),
    })

    this.addCommand({
      id: 'open-calendar-view',
      name: 'Calendar View を開く',
      callback: () => void this.openView(CALENDAR_VIEW_TYPE),
    })

    this.addCommand({
      id: 'open-gantt-view',
      name: 'Gantt View を開く',
      callback: () => void this.openView(GANTT_VIEW_TYPE),
    })

    if (this.settings.showRibbonIcon) {
      this.addRibbonIcon('code-2', 'AST View を開く', () => {
        void this.openView(AST_VIEW_TYPE)
      })
    }

    if (this.settings.enableTaskHighlight) {
      this.registerEditorExtension(taskDecorationPlugin)
    }

    this.addSettingTab(new MdAstEditorSettingTab(this.app, this))

    this.fileSync.start()
  }

  async onunload(): Promise<void> {
    this.fileSync.stop()
    this.app.workspace.detachLeavesOfType(AST_VIEW_TYPE)
    this.app.workspace.detachLeavesOfType(CALENDAR_VIEW_TYPE)
    this.app.workspace.detachLeavesOfType(GANTT_VIEW_TYPE)
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings)
  }

  private async openView(viewType: string): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(viewType)
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0])
      return
    }

    const leaf = this.app.workspace.getRightLeaf(false)
    if (!leaf) return

    await leaf.setViewState({ type: viewType, active: true })
    this.app.workspace.revealLeaf(leaf)
  }
}

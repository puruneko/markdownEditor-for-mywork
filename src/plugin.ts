import { Plugin, MarkdownView } from 'obsidian'
import type { WorkspaceLeaf } from 'obsidian'
import { AstView, AST_VIEW_TYPE } from './views/AstView'
import { CalendarView, CALENDAR_VIEW_TYPE } from './views/CalendarView'
import { GanttView, GANTT_VIEW_TYPE } from './views/GanttView'
import { KanbanView, KANBAN_VIEW_TYPE } from './views/KanbanView'
import { AgendaView, AGENDA_VIEW_TYPE } from './views/AgendaView'
import { HealthView, HEALTH_VIEW_TYPE } from './views/HealthView'
import { UnscheduledTrayView, UNSCHEDULED_TRAY_VIEW_TYPE } from './views/UnscheduledTrayView'
import { FileSync } from './sync/file-sync'
import { AstIndex } from './sync/ast-index'
import { EditorEventBus } from './sync/editor-event-bus'
import { taskDecorationPlugin } from './editor/task-decoration'
import { createNotationLintExtension } from './editor/notation-lint'
import { createTaskDragSourceExtension } from './editor/task-drag-source'
import { createQueryBlockProcessor } from './views/query-block'
import { MdAstEditorSettingTab, DEFAULT_SETTINGS } from './settings'
import type { MdAstEditorSettings } from './settings'

export class MdAstEditorPlugin extends Plugin {
  fileSync!: FileSync
  astIndex!: AstIndex
  editorEventBus!: EditorEventBus
  settings!: MdAstEditorSettings

  async onload(): Promise<void> {
    await this.loadSettings()

    this.fileSync = new FileSync(this.app, this.settings.debounceMs)
    this.astIndex = new AstIndex(this.app, {
      debounceMs: this.settings.debounceMs,
      scope: this.settings.indexScope,
      scopeFolder: this.settings.indexScopeFolder,
    })
    this.editorEventBus = new EditorEventBus()

    // カレンダー/ガントからのカーソル移動要求をエディタに反映する。
    this.editorEventBus.onFocusLine((lineNumber) => {
      void (async () => {
        const currentFile = this.fileSync.getCurrentFile()
        if (!currentFile) return

        // FileSync が追跡しているファイルを表示している既存リーフを探す。
        let targetLeaf: WorkspaceLeaf | null = null
        this.app.workspace.iterateAllLeaves((leaf) => {
          if (!targetLeaf && leaf.view instanceof MarkdownView && leaf.view.file?.path === currentFile.path) {
            targetLeaf = leaf
          }
        })

        if (!targetLeaf) {
          // 開いているタブがなければ新規リーフでファイルを開く。
          targetLeaf = this.app.workspace.getLeaf(false)
          if (!targetLeaf) return
          await (targetLeaf as WorkspaceLeaf).openFile(currentFile)
        }

        this.app.workspace.revealLeaf(targetLeaf as WorkspaceLeaf)
        const mdView = (targetLeaf as WorkspaceLeaf).view as MarkdownView
        mdView.editor.setCursor({ line: lineNumber, ch: 0 })
        mdView.editor.focus()

        const scrollOffsetLines = this.settings.scrollOffsetLines
        if (scrollOffsetLines > 0) {
          requestAnimationFrame(() => {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const cm = (mdView.editor as any).cm
              if (!cm) return
              // CodeMirror 6 は行番号が 1-based
              const line = cm.state.doc.line(lineNumber + 1)
              const block = cm.lineBlockAt(line.from)
              const lineHeight: number = cm.defaultLineHeight
              cm.scrollDOM.scrollTop = Math.max(0, block.top - (scrollOffsetLines - 1) * lineHeight)
            } catch {
              // CM6 API 取得失敗時はフォールバック（デフォルトスクロールのまま）
            }
          })
        }
      })()
    })

    this.registerView(
      AST_VIEW_TYPE,
      (leaf) => new AstView(leaf, this.fileSync, this.editorEventBus),
    )

    this.registerView(
      CALENDAR_VIEW_TYPE,
      (leaf) => new CalendarView(leaf, this.fileSync, this.editorEventBus, this.astIndex),
    )

    this.registerView(
      GANTT_VIEW_TYPE,
      (leaf) => new GanttView(leaf, this.fileSync, this.editorEventBus, this.astIndex),
    )

    this.registerView(
      KANBAN_VIEW_TYPE,
      (leaf) => new KanbanView(leaf, this.fileSync, this.editorEventBus, this.astIndex),
    )

    this.registerView(
      AGENDA_VIEW_TYPE,
      (leaf) => new AgendaView(leaf, this.fileSync, this.editorEventBus, this.astIndex),
    )

    this.registerView(
      HEALTH_VIEW_TYPE,
      (leaf) => new HealthView(leaf, this.settings, this.fileSync, this.editorEventBus, this.astIndex),
    )

    this.registerView(
      UNSCHEDULED_TRAY_VIEW_TYPE,
      (leaf) => new UnscheduledTrayView(leaf, this.fileSync, this.editorEventBus, this.astIndex),
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

    this.addCommand({
      id: 'open-kanban-view',
      name: 'Kanban View を開く',
      callback: () => void this.openView(KANBAN_VIEW_TYPE),
    })

    this.addCommand({
      id: 'open-agenda-view',
      name: 'Agenda View を開く',
      callback: () => void this.openView(AGENDA_VIEW_TYPE),
    })

    this.addCommand({
      id: 'open-health-view',
      name: 'Health Check を開く',
      callback: () => void this.openView(HEALTH_VIEW_TYPE),
    })

    this.addCommand({
      id: 'open-unscheduled-tray',
      name: '未スケジュール・トレイを開く',
      callback: () => void this.openView(UNSCHEDULED_TRAY_VIEW_TYPE),
    })

    if (this.settings.showRibbonIcon) {
      this.addRibbonIcon('code-2', 'AST View を開く', () => {
        void this.openView(AST_VIEW_TYPE)
      })
      this.addRibbonIcon('calendar', 'Calendar View を開く', () => {
        void this.openView(CALENDAR_VIEW_TYPE)
      })
      this.addRibbonIcon('bar-chart-2', 'Gantt View を開く', () => {
        void this.openView(GANTT_VIEW_TYPE)
      })
      this.addRibbonIcon('layout-grid', 'Kanban View を開く', () => {
        void this.openView(KANBAN_VIEW_TYPE)
      })
      this.addRibbonIcon('calendar-check', 'Agenda View を開く', () => {
        void this.openView(AGENDA_VIEW_TYPE)
      })
      this.addRibbonIcon('stethoscope', 'Health Check を開く', () => {
        void this.openView(HEALTH_VIEW_TYPE)
      })
      this.addRibbonIcon('inbox', '未スケジュール・トレイを開く', () => {
        void this.openView(UNSCHEDULED_TRAY_VIEW_TYPE)
      })
    }

    if (this.settings.enableTaskHighlight) {
      this.registerEditorExtension(taskDecorationPlugin)
      this.registerEditorExtension(createNotationLintExtension())
    }

    this.registerEditorExtension(
      createTaskDragSourceExtension(() => {
        const doc = this.fileSync.getCurrentDocument()
        const file = this.fileSync.getCurrentFile()
        if (!doc || !file) return null
        return { sourcePath: file.path, doc }
      }),
    )

    this.registerMarkdownCodeBlockProcessor(
      'task-query',
      createQueryBlockProcessor(this.app, this.astIndex),
    )

    this.addSettingTab(new MdAstEditorSettingTab(this.app, this))

    // FileSync のアクティブファイル変更を AstIndex に反映する（current-file スコープ用）。
    this.fileSync.subscribe((_, file) => {
      this.astIndex.setCurrentFilePath(file.path)
    })

    this.fileSync.start()
    void this.astIndex.start()
  }

  async onunload(): Promise<void> {
    this.fileSync.stop()
    this.astIndex.stop()
    this.app.workspace.detachLeavesOfType(AST_VIEW_TYPE)
    this.app.workspace.detachLeavesOfType(CALENDAR_VIEW_TYPE)
    this.app.workspace.detachLeavesOfType(GANTT_VIEW_TYPE)
    this.app.workspace.detachLeavesOfType(KANBAN_VIEW_TYPE)
    this.app.workspace.detachLeavesOfType(AGENDA_VIEW_TYPE)
    this.app.workspace.detachLeavesOfType(HEALTH_VIEW_TYPE)
    this.app.workspace.detachLeavesOfType(UNSCHEDULED_TRAY_VIEW_TYPE)
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

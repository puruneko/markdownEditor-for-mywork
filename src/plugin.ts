import { Plugin, MarkdownView, Notice } from 'obsidian'
import type { WorkspaceLeaf } from 'obsidian'
import { AstView, AST_VIEW_TYPE } from './views/AstView'
import { CalendarView, CALENDAR_VIEW_TYPE } from './views/CalendarView'
import { GanttView, GANTT_VIEW_TYPE } from './views/GanttView'
import { KanbanView, KANBAN_VIEW_TYPE } from './views/KanbanView'
import { DashboardView, DASHBOARD_VIEW_TYPE } from './views/DashboardView'
import { FileSync } from './sync/file-sync'
import { AstIndex } from './sync/ast-index'
import { EditorEventBus } from './sync/editor-event-bus'
import { taskDecorationPlugin } from './editor/task-decoration'
import { metatagValuePlugin } from './editor/metatag-decoration'
import { metatagPickerExtension } from './editor/metatag-picker'
import { createNotationLintExtension } from './editor/notation-lint'
import { createTaskDragSourceExtension } from './editor/task-drag-source'
import { reformatMetaLines } from './editor/reformat-meta-lines'
import { createQueryBlockProcessor } from './views/query-block'
import { MdAstEditorSettingTab, DEFAULT_SETTINGS } from './settings'
import type { MdAstEditorSettings } from './settings'
import { ViewSettingsHub } from './settings-hub'

export class MdAstEditorPlugin extends Plugin {
  fileSync!: FileSync
  astIndex!: AstIndex
  editorEventBus!: EditorEventBus
  settings!: MdAstEditorSettings
  settingsHub!: ViewSettingsHub

  async onload(): Promise<void> {
    await this.loadSettings()
    this.settingsHub = new ViewSettingsHub(this)

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
      (leaf) => new CalendarView(leaf, this.fileSync, this.editorEventBus, this.settingsHub, this.astIndex),
    )

    this.registerView(
      GANTT_VIEW_TYPE,
      (leaf) => new GanttView(leaf, this.settings, this.fileSync, this.editorEventBus, this.astIndex),
    )

    this.registerView(
      KANBAN_VIEW_TYPE,
      (leaf) => new KanbanView(leaf, this.fileSync, this.editorEventBus, this.settingsHub, this.astIndex),
    )

    this.registerView(
      DASHBOARD_VIEW_TYPE,
      (leaf) => new DashboardView(leaf, this.fileSync, this.editorEventBus, this.astIndex),
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
      id: 'open-dashboard-view',
      name: 'Dashboard View を開く',
      callback: () => void this.openView(DASHBOARD_VIEW_TYPE),
    })

    // issue-phase004-005: メタ行を推奨位置（タスク直下）へ一括整形する。
    // オーナー決定により自動実行・保存時フックは禁止。ユーザーがコマンドを呼んだ時のみ動作する。
    this.addCommand({
      id: 'reformat-meta-lines',
      name: 'メタ行を推奨位置へ整形（現在のファイル）',
      editorCallback: (editor) => {
        const original = editor.getValue()
        const { result, movedCount } = reformatMetaLines(original)
        if (movedCount > 0 && result !== original) {
          editor.setValue(result)
        }
        new Notice(
          movedCount > 0
            ? `${movedCount} 件のメタ行を移動しました。`
            : '整形が必要なメタ行はありませんでした。',
        )
      },
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
      this.addRibbonIcon('layout-dashboard', 'Dashboard View を開く', () => {
        void this.openView(DASHBOARD_VIEW_TYPE)
      })
    }

    if (this.settings.enableTaskHighlight) {
      this.registerEditorExtension(taskDecorationPlugin)
      this.registerEditorExtension(createNotationLintExtension())
      // issue-phase003-008（2026-09-17増分）: メタタグの緑装飾・日付チップ・ピッカー。
      this.registerEditorExtension(metatagValuePlugin)
      this.registerEditorExtension(metatagPickerExtension)
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
    this.app.workspace.detachLeavesOfType(DASHBOARD_VIEW_TYPE)
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

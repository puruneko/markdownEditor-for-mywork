import { PluginSettingTab, Setting } from 'obsidian'
import type { App } from 'obsidian'
import type { MdAstEditorPlugin } from './plugin'
import type { IndexScope } from './sync/ast-index'

export interface MdAstEditorSettings {
  showRibbonIcon: boolean
  enableTaskHighlight: boolean
  debounceMs: number
  scrollOffsetLines: number
  /** AstIndex が索引化するスコープ。既定は Vault 全体。 */
  indexScope: IndexScope
  /** indexScope が 'folder' の場合に対象フォルダのパスを指定する（末尾スラッシュ不要）。 */
  indexScopeFolder: string
  /** DnD でタスクをカレンダー時間グリッドにドロップしたときの既定所要時間（分）。 */
  defaultDurationMin: number
  /** Gantt View: サブタスクを個別行として展開表示するかどうか（既定 true）。 */
  ganttExpandSubtasks: boolean
  /**
   * 設定ハブ（ViewSettingsHub）が管理する、ビュー別の名前空間ごとの設定値
   * （issue-phase010-markdownEditor-005）。キーはビュー名（例: 'calendar' / 'kanban'）。
   * 各ビューが独自の形状のオブジェクトを読み書きするため、ここでは型を specifiy しない。
   */
  viewSettings: Record<string, unknown>
}

export const DEFAULT_SETTINGS: MdAstEditorSettings = {
  showRibbonIcon: true,
  enableTaskHighlight: true,
  debounceMs: 300,
  scrollOffsetLines: 4,
  indexScope: 'vault',
  indexScopeFolder: '',
  defaultDurationMin: 60,
  ganttExpandSubtasks: true,
  viewSettings: {},
}

export class MdAstEditorSettingTab extends PluginSettingTab {
  plugin: MdAstEditorPlugin

  constructor(app: App, plugin: MdAstEditorPlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()
    containerEl.createEl('h2', { text: 'MD AST Editor 設定' })

    new Setting(containerEl)
      .setName('リボンアイコンを表示')
      .setDesc('左サイドバーにAST / Calendar / Gantt Viewを開くアイコンを表示します。')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.showRibbonIcon)
          .onChange(async (value) => {
            this.plugin.settings.showRibbonIcon = value
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('タスクハイライトを有効化')
      .setDesc('エディタ内のタスクステータスとメタ情報をハイライト表示します。')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.enableTaskHighlight)
          .onChange(async (value) => {
            this.plugin.settings.enableTaskHighlight = value
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('デバウンス間隔 (ms)')
      .setDesc('ファイル変更検知の遅延時間（ミリ秒）。小さいほど即時反映されますが負荷が増えます。')
      .addText(text =>
        text
          .setPlaceholder('300')
          .setValue(String(this.plugin.settings.debounceMs))
          .onChange(async (value) => {
            const num = parseInt(value, 10)
            if (!isNaN(num) && num >= 0) {
              this.plugin.settings.debounceMs = num
              this.plugin.fileSync.setDebounceMs(num)
              await this.plugin.saveSettings()
            }
          }),
      )

    new Setting(containerEl)
      .setName('スクロールオフセット行数')
      .setDesc('カード等をクリックしてカーソル移動する際、対象行を画面上から何行目に表示するか（0 = 自動）')
      .addText(text =>
        text
          .setPlaceholder('4')
          .setValue(String(this.plugin.settings.scrollOffsetLines))
          .onChange(async (value) => {
            const num = parseInt(value, 10)
            if (!isNaN(num) && num >= 0) {
              this.plugin.settings.scrollOffsetLines = num
              await this.plugin.saveSettings()
            }
          }),
      )

    containerEl.createEl('h3', { text: 'AST インデックス' })

    new Setting(containerEl)
      .setName('索引スコープ')
      .setDesc('AstIndex が索引化する範囲を選択します。')
      .addDropdown(drop =>
        drop
          .addOption('vault', 'Vault 全体')
          .addOption('folder', '指定フォルダ')
          .addOption('current-file', '現在のファイルのみ')
          .setValue(this.plugin.settings.indexScope)
          .onChange(async (value) => {
            this.plugin.settings.indexScope = value as IndexScope
            await this.plugin.saveSettings()
            await this.plugin.astIndex.setScope(value as IndexScope, this.plugin.settings.indexScopeFolder)
          }),
      )

    new Setting(containerEl)
      .setName('対象フォルダ')
      .setDesc('索引スコープが「指定フォルダ」の場合の対象フォルダパス（例: notes/tasks）。')
      .addText(text =>
        text
          .setPlaceholder('notes/tasks')
          .setValue(this.plugin.settings.indexScopeFolder)
          .onChange(async (value) => {
            this.plugin.settings.indexScopeFolder = value.trim()
            await this.plugin.saveSettings()
            await this.plugin.astIndex.setScope(this.plugin.settings.indexScope, value.trim())
          }),
      )

    containerEl.createEl('h3', { text: 'Gantt View' })

    new Setting(containerEl)
      .setName('サブタスク展開')
      .setDesc('ONにすると、期間未設定のサブタスクも親タスクの下にテキスト行として表示します（既定 ON。OFFにすると従来どおり集約表示。反映には Gantt View の再オープンが必要）。')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.ganttExpandSubtasks)
          .onChange(async (value) => {
            this.plugin.settings.ganttExpandSubtasks = value
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('既定所要時間 (分)')
      .setDesc('エディタからタスクをガントの時間グリッドへドラッグ＆ドロップした際の既定の所要時間（分）。反映には Gantt View の再オープンが必要です。')
      .addText(text =>
        text
          .setPlaceholder('60')
          .setValue(String(this.plugin.settings.defaultDurationMin))
          .onChange(async (value) => {
            const num = parseInt(value, 10)
            if (!isNaN(num) && num >= 1) {
              this.plugin.settings.defaultDurationMin = num
              await this.plugin.saveSettings()
            }
          }),
      )
  }
}

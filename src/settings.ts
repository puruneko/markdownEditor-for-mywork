import { PluginSettingTab, Setting } from 'obsidian'
import type { App } from 'obsidian'
import type { MdAstEditorPlugin } from './plugin'

export interface MdAstEditorSettings {
  showRibbonIcon: boolean
  enableTaskHighlight: boolean
  debounceMs: number
}

export const DEFAULT_SETTINGS: MdAstEditorSettings = {
  showRibbonIcon: true,
  enableTaskHighlight: true,
  debounceMs: 300,
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
      .setDesc('左サイドバーにAST Viewを開くアイコンを表示します。')
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
              await this.plugin.saveSettings()
            }
          }),
      )
  }
}

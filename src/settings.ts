import { PluginSettingTab, Setting } from 'obsidian'
import type { App } from 'obsidian'
import type { MdAstEditorPlugin } from './plugin'
import type { IndexScope } from './sync/ast-index'
import type { HealthRuleConfig } from './lib/health/rules'

export interface MdAstEditorSettings {
  showRibbonIcon: boolean
  enableTaskHighlight: boolean
  debounceMs: number
  scrollOffsetLines: number
  /** AstIndex が索引化するスコープ。既定は Vault 全体。 */
  indexScope: IndexScope
  /** indexScope が 'folder' の場合に対象フォルダのパスを指定する（末尾スラッシュ不要）。 */
  indexScopeFolder: string
  /** HealthView: doing 停滞判定の閾値（日数）。 */
  healthStaleDays: number
  /** HealthView: 各ルールの ON/OFF。 */
  healthRules: HealthRuleConfig
  /** DnD でタスクをカレンダー時間グリッドにドロップしたときの既定所要時間（分）。 */
  defaultDurationMin: number
}

export const DEFAULT_SETTINGS: MdAstEditorSettings = {
  showRibbonIcon: true,
  enableTaskHighlight: true,
  debounceMs: 300,
  scrollOffsetLines: 4,
  indexScope: 'vault',
  indexScopeFolder: '',
  healthStaleDays: 7,
  defaultDurationMin: 60,
  healthRules: {
    undated: true,
    overdue: true,
    stale: true,
    unresolvedDeps: true,
    readyTasks: true,
    malformed: true,
  },
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

    containerEl.createEl('h3', { text: 'ヘルスチェック' })

    new Setting(containerEl)
      .setName('停滞判定の閾値（日数）')
      .setDesc('doing のまま何日経過したら「停滞」と見なすか（既定: 7 日）。')
      .addText(text =>
        text
          .setPlaceholder('7')
          .setValue(String(this.plugin.settings.healthStaleDays))
          .onChange(async (value) => {
            const num = parseInt(value, 10)
            if (!isNaN(num) && num >= 1) {
              this.plugin.settings.healthStaleDays = num
              await this.plugin.saveSettings()
            }
          }),
      )

    const ruleLabels: Array<{ key: keyof typeof this.plugin.settings.healthRules; label: string; desc: string }> = [
      { key: 'undated',       label: 'ルール1: 日付なし',     desc: '未完なのに @schedule/@due がないタスクを検出' },
      { key: 'overdue',       label: 'ルール2: 期限超過',     desc: '過去日付なのに未完のタスクを検出' },
      { key: 'stale',         label: 'ルール3: doing 停滞',   desc: 'doing のまま閾値以上放置されたタスクを検出' },
      { key: 'unresolvedDeps',label: 'ルール4: 未解決依存',   desc: '@dependsOn の参照先が見つからないタスクを検出' },
      { key: 'readyTasks',    label: 'ルール5: 着手可能',     desc: '依存先がすべて完了し着手可能になったタスクを検出' },
      { key: 'malformed',     label: 'ルール6: 形式不正',     desc: 'メタ記法が不正で集計から漏れているタスクを検出' },
    ]

    for (const { key, label, desc } of ruleLabels) {
      new Setting(containerEl)
        .setName(label)
        .setDesc(desc)
        .addToggle(toggle =>
          toggle
            .setValue(this.plugin.settings.healthRules[key])
            .onChange(async (value) => {
              this.plugin.settings.healthRules[key] = value
              await this.plugin.saveSettings()
            }),
        )
    }
  }
}

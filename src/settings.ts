import { Notice, PluginSettingTab, Setting } from 'obsidian'
import { META_KEYS, normalizeMetaKey, META_KEY_ALIASES, setUserMetaKeyAliases, validateUserMetaKeyAliases } from './lib/parser/meta-keys'
import type { MetaKey, UserMetaKeyAliases } from './lib/parser/meta-keys'
import type { App } from 'obsidian'
import type { MdAstEditorPlugin } from './plugin'
import { renderViewSettingsSections } from './settings-view-sections'
import type { IndexScope } from './sync/ast-index'

export type MinuteStep = 1 | 5 | 10 | 15 | 20 | 30

const MINUTE_STEPS: readonly number[] = [1, 5, 10, 15, 20, 30]

/** 生の保存データから minuteStep を決定する（旧 roundMinuteStep の移行を含む）。Object.assign の前に呼ぶこと。 */
export function migrateSettings(raw: unknown): Partial<MdAstEditorSettings> {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const { roundMinuteStep: legacy, ...rest } = obj
  let minuteStep: MinuteStep = 15
  if (typeof obj.minuteStep === 'number' && MINUTE_STEPS.includes(obj.minuteStep)) {
    minuteStep = obj.minuteStep as MinuteStep
  } else if (obj.minuteStep === undefined && legacy === false) {
    minuteStep = 1
  }
  const metaKeyAliases = obj.metaKeyAliases && typeof obj.metaKeyAliases === 'object' && !Array.isArray(obj.metaKeyAliases) ? obj.metaKeyAliases : {}
  const frequentMetaKeys =
    Array.isArray(obj.frequentMetaKeys) && obj.frequentMetaKeys.every((v) => typeof v === 'string')
      ? (obj.frequentMetaKeys as string[])
      : ['memo']
  return { ...rest, minuteStep, metaKeyAliases, frequentMetaKeys } as Partial<MdAstEditorSettings>
}

/** カンマ区切り入力を整形する。空要素・重複・日付系（別名含む）を除く。 */
export function parseFrequentMetaKeys(input: string): string[] {
  const out: string[] = []
  for (const k of input.split(/[,、]/).map(s => s.trim())) {
    if (!k || out.includes(k)) continue
    const n = normalizeMetaKey(k)
    if (n === 'schedule' || n === 'plan' || n === 'due') continue
    out.push(k)
  }
  return out
}

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
  /** 日付入力ピッカーの分刻み（1=丸めなし、既定 15）。issue-phase016-markdownEditor-001。 */
  minuteStep: MinuteStep
  /**
   * 設定ハブ（ViewSettingsHub）が管理する、ビュー別の名前空間ごとの設定値
   * （issue-phase010-markdownEditor-005）。キーはビュー名（例: 'calendar' / 'kanban'）。
   * 各ビューが独自の形状のオブジェクトを読み書きするため、ここでは型を specifiy しない。
   */
  viewSettings: Record<string, unknown>
  /** 特殊メタキーのユーザー定義別名（issue-phase019-markdownEditor-for-mywork-001）。 */
  metaKeyAliases: UserMetaKeyAliases
  /** @ サジェストに日付系の後ろへ表示するよく使うメタ情報名（issue-phase020-markdownEditor-for-mywork-003）。 */
  frequentMetaKeys: string[]
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
  minuteStep: 15,
  viewSettings: {},
  metaKeyAliases: {},
  frequentMetaKeys: ['memo'],
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
    containerEl.addClass('md-ast-editor-settings')
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
      .setName('日付ピッカーの分刻み')
      .setDesc('@plan/@schedule/@due の日付入力ピッカーの時刻欄で選べる分の刻みです。')
      .addDropdown(drop =>
        drop
          .addOption('1', '丸めなし')
          .addOption('5', '5分')
          .addOption('10', '10分')
          .addOption('15', '15分')
          .addOption('20', '20分')
          .addOption('30', '30分')
          .setValue(String(this.plugin.settings.minuteStep))
          .onChange(async (value) => {
            this.plugin.settings.minuteStep = Number(value) as MinuteStep
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('よく使うメタ情報名')
      .setDesc('@入力時のサジェストに schedule/plan/due の後に表示します。カンマ区切り。')
      .addText(text => {
        text.setValue(this.plugin.settings.frequentMetaKeys.join(', '))
        text.inputEl.addEventListener('change', async () => {
          const keys = parseFrequentMetaKeys(text.inputEl.value)
          this.plugin.settings.frequentMetaKeys = keys
          text.inputEl.value = keys.join(', ')
          await this.plugin.saveSettings()
        })
      })

    containerEl.createEl('h3', { text: 'メタ情報の別名' })
    const aliasInputs = new Map<MetaKey, HTMLInputElement>()
    for (const key of Object.keys(META_KEYS) as MetaKey[]) {
      const builtin = Object.entries(META_KEY_ALIASES).filter(([, k]) => k === key).map(([a]) => a)
      const desc = '標準キー名は固定です。別名はカンマ区切りで入力。' + (builtin.length ? ` 組込別名: ${builtin.join('、')}` : '')
      new Setting(containerEl)
        .setName(key)
        .setDesc(desc)
        .addText(text => {
          text.setValue((this.plugin.settings.metaKeyAliases[key] ?? []).join(', '))
          aliasInputs.set(key, text.inputEl)
          text.inputEl.addEventListener('change', async () => {
            const raw: UserMetaKeyAliases = {}
            for (const [k, el] of aliasInputs) {
              raw[k] = el.value.split(/[,、]/).map(s => s.trim()).filter(s => s !== '')
            }
            const { aliases, errors } = validateUserMetaKeyAliases(raw)
            if (errors.length) new Notice(errors.join('\n'))
            this.plugin.settings.metaKeyAliases = aliases
            for (const [k, el] of aliasInputs) el.value = (aliases[k] ?? []).join(', ')
            setUserMetaKeyAliases(aliases)
            await this.plugin.saveSettings()
            this.plugin.astIndex.forceReparse()
          })
        })
    }

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

    // issue-phase017-005: ビュー別設定セクション。
    renderViewSettingsSections(containerEl, this.plugin.settingsHub)
  }
}
